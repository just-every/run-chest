import type { Bindings } from '../../auth.server'
import { insist } from '../model'
import { commit, fresh, maybe } from '../files/repo'
import { who } from '../files/access'
import { byteRange, bytes as original } from '../files/items'
import { assertContent } from '../content-security/scan'
import { live, resource, spend, type Authorized } from './auth'

type ByteLink = { grant: string; item: string; version: string; expires: string }
const blobLimit = 10 * 1024 ** 2
export const byteUri = (item: string, version: string) => `chest://item/${encodeURIComponent(item)}/version/${encodeURIComponent(version)}`

async function retained(env: Bindings, auth: Authorized, item: string, version: string) {
 const ctx = await resource(env, auth, item, 'download'), row = ctx.chain.at(-1)!
 const original = row.payload.versions.find(v => v.id === version)
 insist(original, 'version_not_found', 404)
 await assertContent(env, original.checksum)
 return {ctx, row, original}
}

// A link is a locator, never authority. It remains bound to its issuing grant
// even when a different grant has access to exactly the same original.
export async function readOriginal(env: Bindings, auth: Authorized, item: string, version: string, range: string | null, linkId?: string | null) {
 const link = linkId == null ? null : await maybe<ByteLink>(env, 'integration-byte-link', linkId)
 if (linkId != null) {
  insist(link && link.payload.grant === auth.grant.id && link.payload.item === item && link.payload.version === version, 'byte_link_not_found', 404)
  insist(Date.parse(link.payload.expires) > Date.now(), 'byte_link_expired', 410)
 }
 const {ctx, original: v} = await retained(env, auth, item, version)
 const size = range ? byteRange(v.size, range).length : v.size
 await commit(env, auth.session, [spend(auth, {bytes: size})], {fences: [...ctx.fences, ...(link ? [link] : [])]})
 const current = await live(env, auth) as Authorized
 const response = await original(env, current.session, await who(env, current.session), item, version, true, range)
 if (!response.body) return response
 const reader = response.body.getReader(); let pending = new Uint8Array(0), cancelled = false
 return new Response(new ReadableStream<Uint8Array>({
  async pull(controller) { try {
   if (!pending.length) { const next = await reader.read(); if (cancelled) return; if (next.done) { controller.close(); reader.releaseLock(); return } pending = next.value }
   await live(env, current, item, 'download')
   await assertContent(env, v.checksum)
   if (link) insist(Date.parse(link.payload.expires) > Date.now(), 'byte_link_expired', 410)
   if (cancelled) return
   const chunk = pending.subarray(0, 256 * 1024); pending = pending.subarray(chunk.length); controller.enqueue(chunk)
  } catch (error) { pending = new Uint8Array(0); if (!cancelled) controller.error(error); await reader.cancel() } },
  async cancel() { cancelled = true; pending = new Uint8Array(0); await reader.cancel() },
 }, {highWaterMark: 0}), {status: response.status, headers: {...Object.fromEntries(response.headers), 'accept-ranges': 'bytes'}})
}

export async function originalResource(env: Bindings, auth: Authorized, item: string, version: string, blobOnly = false) {
 const {ctx, original: v} = await retained(env, auth, item, version)
 const metadata = {id: item, version, size: v.size, sha256: v.checksum, mediaType: v.mediaType}
 if (v.size > blobLimit) {
  insist(!blobOnly, 'original_requires_byte_link', 413)
  // Refuse an over-budget read before returning even a byte locator. Actual
  // transfers reserve their requested interval, so interrupted downloads resume.
  spend(auth, {bytes: v.size})
  const link = fresh<ByteLink>('integration-byte-link', {grant: auth.grant.id, item, version, expires: new Date(Date.now() + 5 * 60 * 1000).toISOString()})
  await commit(env, auth.session, [{row: link}], {fences: ctx.fences})
  const byteLink = `${env.AUTH_ORIGIN}/api/chest/integrations/v1/items/${encodeURIComponent(item)}/bytes/${encodeURIComponent(version)}?link=${encodeURIComponent(link.id)}`
  return {content: [{type: 'text', text: JSON.stringify({...metadata, byteLink, expiresAt: link.payload.expires})}], structuredContent: {...metadata, byteLink, expiresAt: link.payload.expires}, isError: false}
 }
 const response = await readOriginal(env, auth, item, version, null), bytes = await response.arrayBuffer()
 // Blob output is assembled before the JSON response, so check authority once
 // more after consuming storage and before publishing the embedded original.
 await live(env, auth, item, 'download'); await assertContent(env, v.checksum)
 insist(bytes.byteLength === v.size, 'original_incomplete', 503)
 const resource = {uri: byteUri(item, version), mimeType: v.mediaType, blob: Buffer.from(bytes).toString('base64')}
 return {content: [{type: 'resource', resource}], structuredContent: {...metadata, uri: resource.uri}, isError: false}
}
