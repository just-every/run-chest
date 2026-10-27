import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { digest } from '../blobs'
import { assertContent } from '../content-security/scan'
import { guardDownload } from '../upload-protection/guard'
import { insist } from '../model'
import { esc } from '../ui-shared'
import { context, demand, who, type Who } from './access'

// Only metadata is read. No archive member is inflated, opened or written to storage.
const MAX_ORIGINAL = 8 * 1024 * 1024, MAX_DIRECTORY = 1024 * 1024, MAX_ENTRIES = 1000
type Entry = { name: string; directory: boolean; depth: number; size: number; compressedSize: number }
type Listing = { state: 'ready' | 'malformed' | 'unsupported' | 'over-bound'; reason: string; entries: Entry[]; files: number; directories: number; size: number; compressedSize: number }
const empty = (state: Listing['state'], reason: string): Listing => ({ state, reason, entries: [], files: 0, directories: 0, size: 0, compressedSize: 0 })
function directory(bytes: Uint8Array): Listing {
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 const u16 = (at: number) => view.getUint16(at, true), u32 = (at: number) => view.getUint32(at, true)
 const require = (ok: unknown, state: Listing['state'] = 'malformed', reason = 'The ZIP directory is incomplete or inconsistent.') => { if (!ok) throw empty(state, reason) }
 try {
  require(bytes.length >= 22)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
  require(end >= Math.max(0, bytes.length - 65557))
  require(!u16(end + 4) && !u16(end + 6) && u16(end + 8) === u16(end + 10), 'unsupported', 'Split ZIP archives are unsupported.')
  const count = u16(end + 10), length = u32(end + 12), start = u32(end + 16)
  require(count !== 65535 && length !== 0xffffffff && start !== 0xffffffff && !(end >= 20 && u32(end - 20) === 0x07064b50), 'unsupported', 'ZIP64 archives are unsupported in this bounded listing.')
  require(count <= MAX_ENTRIES && length <= MAX_DIRECTORY, 'over-bound', 'The ZIP exceeds the listing limit of 1,000 entries or 1 MiB of directory metadata.')
  require(start + length === end)
  const entries: Entry[] = []; let at = start, size = 0, compressedSize = 0
  for (let i = 0; i < count; i++) {
   require(at + 46 <= end && u32(at) === 0x02014b50)
   const flags = u16(at + 8), method = u16(at + 10), packed = u32(at + 20), unpacked = u32(at + 24), names = u16(at + 28), extra = u16(at + 30), comment = u16(at + 32), local = u32(at + 42)
   require(!(flags & 0x2041) && [0, 8].includes(method) && !u16(at + 34), 'unsupported', 'Encrypted, split or unsupported-compression ZIP archives cannot be listed.')
   require(packed !== 0xffffffff && unpacked !== 0xffffffff && local !== 0xffffffff, 'unsupported', 'ZIP64 entries are unsupported in this bounded listing.')
   require(names > 0 && names <= 1024, 'over-bound', 'An entry name exceeds the bounded listing limit.')
   require(at + 46 + names + extra + comment <= end)
   const raw = bytes.subarray(at + 46, at + 46 + names)
   require((flags & 0x800) || raw.every(b => b < 128), 'unsupported', 'Legacy non-ASCII ZIP names are unsupported; use UTF-8 names.')
   let name: string
   try { name = new TextDecoder('utf-8', { fatal: true }).decode(raw) } catch { throw empty('malformed', 'An entry name is not valid UTF-8.') }
   const depth = name.split('/').filter(Boolean).length - 1
   require(depth < 64, 'over-bound', 'The ZIP hierarchy exceeds 64 levels.')
   require(!/[\u0000-\u001f\u007f]/.test(name))
   require(local + 30 <= start && u32(local) === 0x04034b50)
   const localNames = u16(local + 26), data = local + 30 + localNames + u16(local + 28)
   require(u16(local + 6) === flags && u16(local + 8) === method && localNames === names && data + packed <= start)
   require(raw.every((b, n) => bytes[local + 30 + n] === b))
   const crc = u32(at + 16), localCrc = u32(local + 14), localPacked = u32(local + 18), localUnpacked = u32(local + 22)
   require(method !== 0 || packed === unpacked, 'malformed', 'A stored ZIP entry has contradictory compressed and original sizes.')
   if (flags & 8) {
    require((!localCrc || localCrc === crc) && (!localPacked || localPacked === packed) && (!localUnpacked || localUnpacked === unpacked), 'malformed', 'The ZIP local header contradicts its directory checksum or sizes.')
    const descriptor = data + packed
    const matches = (offset: number) => offset + 12 <= start && u32(offset) === crc && u32(offset + 4) === packed && u32(offset + 8) === unpacked
    require(matches(descriptor) || (descriptor + 16 <= start && u32(descriptor) === 0x08074b50 && matches(descriptor + 4)), 'malformed', 'A required ZIP data descriptor is missing, truncated or contradicts the directory.')
   } else require(localCrc === crc && localPacked === packed && localUnpacked === unpacked, 'malformed', 'The ZIP local header contradicts its directory checksum or sizes.')
   entries.push({ name, directory: name.endsWith('/'), depth: Math.max(0, depth), size: unpacked, compressedSize: packed })
   size += unpacked; compressedSize += packed; at += 46 + names + extra + comment
  }
  require(at === end)
  return { state: 'ready', reason: '', entries, files: entries.filter(e => !e.directory).length, directories: entries.filter(e => e.directory).length, size, compressedSize }
 } catch (error) {
  if (error && typeof error === 'object' && 'state' in error) return error as Listing
  return empty('malformed', 'The ZIP directory is incomplete or inconsistent.')
 }
}

export async function archivePreview(env: Bindings, s: Session, w: Who, key: string, version: string, html: boolean) {
 insist(!w.guest, 'staff_required', 403)
 const ctx = await context(env, w, key); demand(ctx, 'download')
 const item = ctx.chain.at(-1)!, v = item.payload.versions.find(v => v.id === version)
 insist(v, 'version_not_found', 404)
 await guardDownload(env, s, item); await assertContent(env, v.checksum)
 let listing: Listing
 if (!/\.zip$/i.test(v.filename)) listing = empty('unsupported', 'Only ZIP directory listings are supported here.')
 else if (v.size > MAX_ORIGINAL) listing = empty('over-bound', 'The original exceeds the 8 MiB ZIP listing limit.')
 else {
  const blob = await env.BLOBS.get(`sha256/${v.checksum}`); insist(blob && blob.size === v.size, 'blob_integrity', 503)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  insist(bytes.length === v.size && await digest(bytes) === v.checksum, 'blob_integrity', 503)
  listing = directory(bytes)
 }
 // A revocation or quarantine during storage reads wins before metadata leaves the Worker.
 const current = await context(env, await who(env, s), key); demand(current, 'download')
 await guardDownload(env, s, current.chain.at(-1)!); await assertContent(env, v.checksum)
 insist(current.chain.at(-1)!.payload.versions.some(x => x.id === v.id && x.checksum === v.checksum), 'version_not_found', 404)
 const result = { ...listing, version: v.id, checksum: v.checksum, originalSize: v.size, renderer: 'chest-zip-directory-v1' }
 const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
 if (!html) return Response.json(result, { headers })
 const rows = listing.entries.map(e => `<li style="padding-left:${Math.min(e.depth, 8)}em"><span>${esc(e.name)}</span><br><small>${e.directory ? 'Folder' : 'File'} · ${e.size} bytes · ${e.compressedSize} compressed bytes</small></li>`).join('')
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ZIP directory</title><style>body{font:15px system-ui;margin:16px;line-height:1.5}li{margin:12px 0;overflow-wrap:anywhere}ul{padding:0;list-style:none}small{font-size:13px}p{overflow-wrap:anywhere}</style><h1>ZIP directory</h1><p>${esc(v.filename)} · ${v.id === current.chain.at(-1)!.payload.current ? 'Current version' : 'Retained version'}</p><p role="status">${listing.state === 'ready' ? `${listing.files} files · ${listing.directories} folders · ${listing.size} bytes · ${listing.compressedSize} compressed bytes` : `${esc(listing.state)}: ${esc(listing.reason)}`}</p><ul aria-label="Archive entries">${rows}</ul><p>No entries are extracted. <a href="/api/chest/items/${esc(key)}/bytes/${esc(v.id)}?download=true">Download original</a></p><p>Source version: ${esc(v.id)}<br>SHA-256: ${esc(v.checksum)}<br>Renderer: chest-zip-directory-v1</p></html>`, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "sandbox allow-same-origin allow-downloads; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'" } })
}

export function archivePanel(d: any) {
 const v = d.versions.find((v: any) => v.id === d.item.current)
 return v && /\.zip$/i.test(v.filename) ? `<section class="office-panel"><h2 class="section-title">ZIP directory</h2><iframe class="office-frame" title="ZIP directory" sandbox="allow-same-origin allow-downloads" src="/api/chest/items/${esc(d.id)}/archive-preview/${esc(v.id)}?format=html"></iframe></section>` : ''
}
