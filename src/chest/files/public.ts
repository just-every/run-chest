import { runtimeBindings, type Bindings } from '../../auth.server'
import { serve, digest } from '../blobs'
import { officePreview } from '../office/codec'
import { officeDocument } from '../office/service'
import { ChestError, insist, type Person, type Version } from '../model'
import { personName } from '../names'
import { failure } from '../api'
import { commit, maybe, next } from './repo'
import { passwordMatches, unlockCookie, unlocked } from './capability'
import { fileThrough, reachable, resolveLink, type Resolved } from './public-links'
import { resolveRequest, submit } from './file-requests'
import { closedRequest, linkPage, megabytes, missingRequest, passwordPage, publicPage, receiptPage, refusedLink, requestPage } from './ui-public'
// The doors for people without an account: /l/<token> (a link for anyone) and /r/<token> (a file request). Every
// request resolves the token again; posts must come from this origin.
const anyone = 'anyone with the link'
export async function publicResponse(request: Request, original: Bindings): Promise<Response | null> {
 const url = new URL(request.url), [door, secret, sub, key, extra] = url.pathname.split('/').filter(Boolean)
 if ((door !== 'l' && door !== 'r') || !secret || extra !== undefined) return null
 const env = runtimeBindings(original)
 try {
  if (request.method === 'POST') insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'invalid_origin', 403)
  else insist(request.method === 'GET' || request.method === 'HEAD', 'method_not_allowed', 405)
  if (door === 'l' && !sub) return request.method === 'POST' ? unlock(env, request, secret) : open(env, request, secret)
  if (door === 'l' && sub === 'p' && key && request.method === 'GET') return preview(env, request, secret, key)
  if (door === 'l' && sub === 'f' && key && request.method === 'GET') return download(env, request, secret, key)
  if (door === 'r' && !sub) return request.method === 'POST' ? upload(env, request, secret) : ask(env, secret)
  return refusedLink('not_found')
 } catch (e) { const r = failure(e), body = await r.json() as { error: string }; return publicPage('Not accepted', `<p>Chest did not accept that request.</p><p class="mono">${body.error}</p>`, r.status) }
}
async function locked(env: Bindings, request: Request, r: Resolved) { return !!r.link.payload.password && !await unlocked(env, request, r.link.id, r.link.payload.password.hash) }
async function open(env: Bindings, request: Request, secret: string) {
 const r = await resolveLink(env, secret), base = `/l/${secret}`; if ('refused' in r) return refusedLink(r.refused)
 if (await locked(env, request, r)) return passwordPage(base)
 const files = (await reachable(env, r)).map(({ row, path }) => { const v = row.payload.versions.find(v => v.id === row.payload.current)!; return { id: row.id, path, name: row.payload.name, size: v.size, mediaType: v.mediaType } })
 await commit(env, null, [], { by: anyone, audits: [{ action: 'link.view', object: r.root.id, detail: { link: r.link.id } }] })
 return linkPage(base, r.link.payload, r.root.payload, files, !r.state.noDownload)
}
async function preview(env: Bindings, request: Request, secret: string, key: string) {
 const r = await resolveLink(env, secret); if ('refused' in r) return refusedLink(r.refused)
 if (await locked(env, request, r)) return passwordPage(`/l/${secret}`, false, 401)
 const file = await fileThrough(env, r, key); if (!file) return refusedLink('unavailable')
 const v = file.row.payload.versions.find(v => v.id === file.row.payload.current); insist(v, 'version_not_found', 404)
 insist(v.size <= 8_000_000, 'office_file_too_large', 413)
 const blob = await env.BLOBS.get(`sha256/${v.checksum}`); insist(blob, 'blob_missing', 503)
 const bytes = new Uint8Array(await blob.arrayBuffer()); insist(bytes.length === v.size && await digest(bytes) === v.checksum, 'blob_integrity', 503)
 const result = await officePreview(bytes); insist(result, 'office_format_unsupported', 415)
 await commit(env, null, [], { by: anyone, fences: file.fences, audits: [{ action: 'link.preview', object: file.row.id, detail: { link: r.link.id, version: v.id } }] })
 return officeDocument(result.html)
}
// Ten wrong passwords for one link in 15 minutes pause it; every refusal is audited without the attempt itself.
async function unlock(env: Bindings, request: Request, secret: string) {
 const r = await resolveLink(env, secret), base = `/l/${secret}`; if ('refused' in r) return refusedLink(r.refused)
 if (!r.link.payload.password) return new Response(null, { status: 303, headers: { location: base } })
 const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM chest_audit WHERE action='link.password.refused' AND object_id=? AND at>? AND json_extract(detail,'$.link')=?").bind(r.root.id, new Date(Date.now() - 15 * 60_000).toISOString(), r.link.id).first<{ n: number }>()
 if ((recent?.n ?? 0) >= 10) return publicPage('Too many attempts', '<p>This link is paused after too many wrong passwords. Try again in 15 minutes.</p>', 429)
 const form = await request.formData()
 if (!await passwordMatches(r.link.payload.password, form.get('password'))) { await commit(env, null, [], { by: anyone, audits: [{ action: 'link.password.refused', object: r.root.id, detail: { link: r.link.id } }] }); return passwordPage(base, true, 401) }
 return new Response(null, { status: 303, headers: { location: base, 'set-cookie': await unlockCookie(env, base, r.link.id, r.link.payload.password.hash), 'cache-control': 'no-store' } })
}
// A download counts against the limit in the same commit that re-checks the link, the item's path and the sharer, so
// parallel downloads at the limit cannot pass it and a revoke between the check and the count refuses the bytes.
async function download(env: Bindings, request: Request, secret: string, key: string) {
 for (let attempt = 0; attempt < 6; attempt++) {
  const r = await resolveLink(env, secret); if ('refused' in r) return refusedLink(r.refused)
  if (await locked(env, request, r)) return passwordPage(`/l/${secret}`, false, 401)
  const file = await fileThrough(env, r, key); if (!file) return refusedLink(r.state.noDownload ? 'download_off' : 'not_found')
  const v = file.row.payload.versions.find(v => v.id === file.row.payload.current); insist(v, 'version_not_found', 404)
  const response = await serve(env, v as unknown as Version, true), link = r.link.payload
  try { await commit(env, null, [{ row: next(r.link, { ...link, downloads: link.downloads + 1 }), previous: r.link }], { by: anyone, fences: file.fences, audits: [{ action: 'link.download', object: file.row.id, detail: { link: r.link.id, version: v.id, downloads: link.downloads + 1, limit: link.limit } }] }); return response }
  catch (e) { if (!String((e as Error)?.message).includes('CHECK constraint failed')) throw e }
 }
 throw new ChestError('busy_try_again', 503)
}
async function ask(env: Bindings, secret: string) {
 const found = await resolveRequest(env, secret); if (!found) return missingRequest(); if (!found.ctx) return closedRequest()
 return requestPage(`/r/${secret}`, { ...found.request.payload, asker: await asker(env, found.request.payload.createdBy) })
}
async function asker(env: Bindings, email: string) { return personName((await maybe<Person>(env, 'person', email))?.payload.name, email) }
const plain: Record<string, (r: { types: string[]; maxBytes: number }) => string> = {
 storage_limit_exceeded: () => 'This space has reached its storage limit. Ask the person who sent this request to contact the owner before uploading again.',
 type_not_allowed: r => `That type of file is not accepted here. Accepted: ${r.types.join(', ')}.`,
 file_too_large: r => `A file is larger than this request accepts (${megabytes(r.maxBytes)} each).`,
 file_size: () => 'Files must have content and be at most 8 MB each.',
 text_file_too_large: () => 'Plain-text files must be at most 500 kB.',
 files_required: () => 'Choose between one and ten files.',
 invalid_email: () => 'Enter a valid email address, or leave it empty.',
 invalid_filename: () => 'A file name is not accepted. Rename the file and try again.',
 invalid_name: () => 'Enter a shorter name, or leave it empty.',
}
async function upload(env: Bindings, request: Request, secret: string) {
 const found = await resolveRequest(env, secret); if (!found) return missingRequest(); if (!found.ctx) return closedRequest()
 const action = `/r/${secret}`, r = found.request.payload, view = async (error: string, status: number) => requestPage(action, { ...r, asker: await asker(env, r.createdBy) }, error, status)
 if (Number(request.headers.get('content-length') || 0) > 90_000_000) return view(plain.files_required(r), 413)
 const form = await request.formData(), files: { filename: string; bytes: Uint8Array }[] = []
 for (const f of form.getAll('files')) if (typeof f !== 'string' && f.size) files.push({ filename: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })
 const text = (k: string) => { const v = form.get(k); return typeof v === 'string' ? v : '' }
 try { return receiptPage(action, await submit(env, secret, { name: text('name'), email: text('email'), files })) }
 catch (e) {
  if (e instanceof ChestError && (e.code === 'request_closed' || e.code === 'request_not_found')) return closedRequest()
  if (e instanceof ChestError && plain[e.code]) return view(plain[e.code](r), e.status === 400 ? 422 : e.status)
  throw e
 }
}
