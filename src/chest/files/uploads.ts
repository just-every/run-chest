import { effectiveGovernance, prepareFiling } from './folder-metadata'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { custody, signature, SMALL, streamDigest } from '../blobs'
import { ChestError, id, insist, now, type Row } from '../model'
import { commit, fresh, maybe, next, where, type Op } from './repo'
import { context, demand, type Who } from './access'
import { addVersion, createItem, folderOf, place, siblings, unique } from './items'
import { day, name, type FileVersion, type Item } from './model'
// Resumable uploads (TRANSFER-001). A browser or client opens an upload session for a new file in a folder or a new
// version of a file, sends the bytes as numbered parts to an R2 multipart upload, and completes it. Parts already
// received survive a lost connection, a reload or a restart: choosing the same file again in the same place resumes
// the open session and sends only the missing parts. Completion verifies every byte before the file appears.
export const PART = 8 * 1024 * 1024, MAX = 4 * 1024 ** 3
type Target = { space: string; parent: string | null; item: string | null }
export type Upload = Target & { filing?: Item['filing']; owner: string; name: string; size: number; lastModified: number; checksum: string | null; partSize: number; key: string; multipart: string; state: 'open' | 'complete'; result?: { item: string; version: string }; createdAt: string; expiresAt: string }
type Part = { upload: string; n: number; etag: string; size: number }
const count = (u: Upload) => Math.ceil(u.size / u.partSize)
const expected = (u: Upload, n: number) => n < count(u) ? u.partSize : u.size - (count(u) - 1) * u.partSize
const parts = (env: Bindings, key: string) => where<Part>(env, 'upload-part', '$.upload', key)
// The person may still add to the place (or replace the file) on every request, not only when the session opened.
async function allowedTarget(env: Bindings, w: Who, t: { space?: unknown; parent?: unknown; item?: unknown }): Promise<Target> {
 if (typeof t.item === 'string' && t.item) { const ctx = await context(env, w, t.item), item = ctx.chain.at(-1)!; demand(ctx, 'contribute'); insist(item.payload.type === 'file', 'not_a_file'); return { space: ctx.space.id, parent: item.payload.parent, item: item.id } }
 const p = await place(env, w, t.space, t.parent); return { space: p.space.id, parent: folderOf(p), item: null }
}
async function mine(env: Bindings, w: Who, key: string) {
 const row = await maybe<Upload>(env, 'upload', key); if (!row || row.payload.owner !== w.email) throw new ChestError('not_found', 404)
 return row
}
async function view(env: Bindings, row: Row<Upload>) {
 const u = row.payload, done = (await parts(env, row.id)).map(p => p.payload)
 return { id: row.id, name: u.name, size: u.size, partSize: u.partSize, parts: done.map(p => p.n).sort((a, b) => a - b), received: done.reduce((n, p) => n + p.size, 0), state: u.state, result: u.result ?? null, target: { space: u.space, parent: u.parent, item: u.item }, createdAt: u.createdAt, expiresAt: u.expiresAt }
}
export async function begin(env: Bindings, s: Session, w: Who, input: any) {
 const target = await allowedTarget(env, w, input), value = name(input.name), size = input.size, lastModified = Number.isSafeInteger(input.lastModified) ? input.lastModified : 0
 insist(Number.isSafeInteger(size) && size > 0, 'invalid_size'); insist(size <= MAX, 'file_too_large', 413)
 insist(input.checksum === undefined || (typeof input.checksum === 'string' && /^[0-9a-f]{64}$/.test(input.checksum)), 'invalid_checksum')
 if (!target.item) unique(await siblings(env, target.space, target.parent), value)
 const open = (await where<Upload>(env, 'upload', '$.owner', w.email)).find(r => { const u = r.payload; return u.state === 'open' && Date.parse(u.expiresAt) > Date.now() && u.space === target.space && u.parent === target.parent && u.item === target.item && u.name === value && u.size === size && u.lastModified === lastModified })
 const ctx = target.item ? await context(env,w,target.item) : await place(env,w,target.space,target.parent)
 const existingItem = target.item ? ctx.chain.at(-1)!.payload : {type:'file',createdBy:w.email} as Item
 // Reservations have no trusted media type yet. A scan-intake reservation may defer missing values;
 // completion inspects actual bytes and applies the folder rule before publishing any file.
 const filing = (await prepareFiling(env,ctx,existingItem,input,w.email,!!effectiveGovernance(ctx,existingItem)?.scanIntake)).filing
 if (open) {
  const updated=next(open,{...open.payload,filing});await commit(env,s,[{row:updated,previous:open}],{fences:ctx.fences});return view(env,updated)
 }
 const key = id(), staging = `uploads/${key}`, multipart = await env.BLOBS.createMultipartUpload(staging), at = now()
 const row = fresh<Upload>('upload', { ...target, filing, owner: w.email, name: value, size, lastModified, checksum: input.checksum ?? null, partSize: PART, key: staging, multipart: multipart.uploadId, state: 'open', createdAt: at, expiresAt: new Date(Date.now() + 6 * day).toISOString() }, key)
 await commit(env, s, [{ row }], { fences:ctx.fences, audits: [{ action: 'upload.begin', object: key, detail: { ...target, size } }] })
 return view(env, row)
}
export async function status(env: Bindings, w: Who, key: string) { return view(env, await mine(env, w, key)) }
export async function receive(env: Bindings, s: Session, w: Who, key: string, n: number, request: Request) {
 const row = await mine(env, w, key), u = row.payload; insist(u.state === 'open', 'upload_complete', 409); insist(Date.parse(u.expiresAt) > Date.now(), 'upload_expired', 410)
 insist(Number.isSafeInteger(n) && n >= 1 && n <= count(u), 'invalid_part')
 await allowedTarget(env, w, u)
 const length = Number(request.headers.get('content-length') ?? -1); insist(length === -1 || length === expected(u, n), 'part_size')
 const bytes = new Uint8Array(await request.arrayBuffer()); insist(bytes.length === expected(u, n), 'part_size')
 const sent = await env.BLOBS.resumeMultipartUpload(u.key, u.multipart).uploadPart(n, bytes), previous = await maybe<Part>(env, 'upload-part', `${key}:${n}`)
 const part: Part = { upload: key, n, etag: sent.etag, size: bytes.length }
 await commit(env, s, previous ? [{ row: next(previous, part), previous }] : [{ row: fresh('upload-part', part, `${key}:${n}`) }], { fences: [row] })
 return view(env, row)
}
// Completing twice never makes a second file: the session closes in the same batch that publishes the file.
export async function complete(env: Bindings, s: Session, w: Who, key: string) {
 const row = await mine(env, w, key), u = row.payload
 if (u.state === 'complete') return view(env, row)
 const target = await allowedTarget(env, w, u), received = (await parts(env, key)).sort((a, b) => a.payload.n - b.payload.n)
 insist(received.length === count(u) && received.every((p, i) => p.payload.n === i + 1 && p.payload.size === expected(u, i + 1)), 'upload_incomplete', 409)
 if (!await env.BLOBS.head(u.key)) await env.BLOBS.resumeMultipartUpload(u.key, u.multipart).complete(received.map(p => ({ partNumber: p.payload.n, etag: p.payload.etag })))
 const closing = (made: Row<Item>): Op[] => [{ row: next(row, { ...u, state: 'complete', result: { item: made.id, version: made.payload.current! } }), previous: row }, ...received.map(p => ({ row: p, previous: p, remove: true }))]
 let small: Uint8Array | undefined, version: FileVersion | undefined
 if (u.size <= SMALL) {
  const blob = await env.BLOBS.get(u.key); insist(blob, 'blob_missing', 503); small = new Uint8Array(await blob.arrayBuffer()); insist(small.length === u.size, 'size_mismatch')
 } else {
  const { checksum, size } = await streamDigest(env, u.key); insist(size === u.size, 'size_mismatch'); insist(!u.checksum || u.checksum === checksum, 'checksum_mismatch')
  const head = await env.BLOBS.get(u.key, { range: { offset: 0, length: 1024 } }); insist(head, 'blob_missing', 503)
  const kind = signature(new Uint8Array(await head.arrayBuffer())) ?? { mediaType: 'application/octet-stream', preview: 'unsupported' }
  await custody(env, u.key, checksum, size, kind.mediaType, s.operator.email)
  version = { id: id(), filename: u.name, checksum, size, ...kind, text: '', parser: 'chest:signature-only:1', at: now(), actor: s.operator.email, arrival: 'upload', name: '' }
 }
 const input = { ...(u.filing ? { schema:u.filing.schema, fields:u.filing.fields, owner:u.filing.owner } : {}), checksum: u.checksum ?? undefined, size: u.size }
 if (u.item) await addVersion(env, s, w, u.item, small ?? null, { ...input, filename: u.name }, 'upload', { version, ops: closing })
 else await createItem(env, s, w, { ...input, space: target.space, parent: target.parent, name: u.name, type: 'file' }, 'upload', small, { version, ops: closing })
 await env.BLOBS.delete(u.key)
 return view(env, (await maybe<Upload>(env, 'upload', key))!)
}
export async function cancel(env: Bindings, s: Session, w: Who, key: string) {
 const row = await mine(env, w, key), u = row.payload; insist(u.state === 'open', 'upload_complete', 409)
 try { await env.BLOBS.resumeMultipartUpload(u.key, u.multipart).abort() } catch { /* already completed or expired at R2 */ }
 await env.BLOBS.delete(u.key)
 await commit(env, s, [{ row, previous: row, remove: true }, ...(await parts(env, key)).map(p => ({ row: p, previous: p, remove: true }))], { audits: [{ action: 'upload.cancel', object: key, detail: { name: u.name, size: u.size } }] })
 return { id: key, state: 'cancelled' }
}
// Open uploads in one place, for the folder page: what was received and how to continue.
export async function unfinished(env: Bindings, w: Who, t: { space?: string; parent?: string | null; item?: string | null }) {
 const rows = (await where<Upload>(env, 'upload', '$.owner', w.email)).filter(r => r.payload.state === 'open' && Date.parse(r.payload.expiresAt) > Date.now() && (t.item ? r.payload.item === t.item : !r.payload.item && r.payload.parent === (t.parent ?? null) && (t.parent || r.payload.space === t.space)))
 return Promise.all(rows.map(r => view(env, r)))
}
