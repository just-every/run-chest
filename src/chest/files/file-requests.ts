import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { ChestError, insist, now, type Row } from '../model'
import { operatorMail } from '../../mail.server.mjs'
import { commit, fresh, next, where } from './repo'
import { context, demand, isAdmin, stillSharing, type Who } from './access'
import { randomToken, tokenHash, tokenShape } from './capability'
import { admit, siblings } from './items'
import { linkDate } from './public-links'
import { deliver, notice } from './notify'
import { name, type FileRequest, type Item } from './model'
// File requests (SHARE-002): someone who may share a folder asks anyone, with no account, to upload into it. The
// uploader sees only the request's title and message, never the folder's contents or name; each file lands as a new
// item in that folder, attributed to the submitter, and the person who asked gets a notice and an email.
export const requestPrefix = 'chest_req_'
const maxFileBytes = 8_000_000
const optional = (value: unknown, field: string, max: number) => { if (value === undefined || value === null || value === '') return ''; insist(typeof value === 'string' && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value), `invalid_${field}`); return value.trim() }
function typesOf(value: unknown) {
 const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : []
 const types = [...new Set(list.map(t => String(t).trim().toLowerCase().replace(/^\./, '')).filter(Boolean))]
 insist(types.length <= 20 && types.every(t => /^[a-z0-9]{1,10}$/.test(t)), 'invalid_types'); return types
}
function megabytes(value: unknown) {
 if (value === undefined || value === null || value === '') return maxFileBytes
 const n = Number(value); insist(Number.isFinite(n) && n > 0 && n <= maxFileBytes / 1_000_000, 'invalid_max_size'); return Math.round(n * 1_000_000)
}
export async function createFileRequest(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), folder = ctx.chain.at(-1)!; demand(ctx, 'share'); insist(folder.payload.type === 'folder', 'not_a_folder')
 const secret = randomToken(requestPrefix), row = fresh<FileRequest>('file-request', { folder: key, title: optional(input.title, 'title', 200) || `Files for ${folder.payload.name}`, message: optional(input.message, 'message', 2000), types: typesOf(input.types), maxBytes: megabytes(input.maxMegabytes), deadline: linkDate(input.deadline), tokenHash: await tokenHash(secret), createdBy: s.operator.email, at: now(), uploads: 0 })
 await commit(env, s, [{ row }], { fences: ctx.fences, audits: [{ action: 'file-request.create', object: key, detail: { request: row.id, types: row.payload.types, maxBytes: row.payload.maxBytes, deadline: row.payload.deadline } }] })
 return { request: describeRequest(row), url: `${env.AUTH_ORIGIN}/r/${secret}`, email: operatorMail(env) && env.MAIL_FROM ? 'available' : 'not_available' }
}
export async function closeFileRequest(env: Bindings, s: Session, w: Who, id: string) {
 const request = await get<FileRequest>(env, 'file-request', id)
 if (request.payload.createdBy !== s.operator.email && !isAdmin(s)) { const ctx = await context(env, w, request.payload.folder); demand({ ...ctx, state: { ...ctx.state, trash: null } }, 'share') }
 if (request.payload.closedAt) return { request: describeRequest(request) }
 const row = next(request, { ...request.payload, closedAt: now(), closedBy: s.operator.email })
 await commit(env, s, [{ row, previous: request }], { audits: [{ action: 'file-request.close', object: request.payload.folder, detail: { request: id } }] })
 return { request: describeRequest(row) }
}
export const requestOpen = (r: FileRequest, at = Date.now()) => !r.closedAt && (!r.deadline || Date.parse(r.deadline) > at)
export const describeRequest = (row: Row<FileRequest>) => ({ id: row.id, folder: row.payload.folder, title: row.payload.title, message: row.payload.message, types: row.payload.types, maxBytes: row.payload.maxBytes, deadline: row.payload.deadline, uploads: row.payload.uploads, createdBy: row.payload.createdBy, at: row.payload.at, closedAt: row.payload.closedAt ?? null, open: requestOpen(row.payload) })
export const requestsOn = async (env: Bindings, key: string) => (await where<FileRequest>(env, 'file-request', '$.folder', key)).map(describeRequest)
// The public door: an open request whose asker may still share the folder.
export async function resolveRequest(env: Bindings, secret: string) {
 if (!tokenShape(requestPrefix).test(secret)) return null
 const [request] = await where<FileRequest>(env, 'file-request', '$.tokenHash', await tokenHash(secret)); if (!request) return null
 if (!requestOpen(request.payload)) return { request, ctx: null }
 const ctx = await stillSharing(env, request.payload.createdBy, request.payload.folder)
 return { request, ctx: ctx && ctx.chain.at(-1)!.payload.type === 'folder' ? ctx : null }
}
const extension = (filename: string) => (/\.([A-Za-z0-9]{1,10})$/.exec(filename)?.[1] ?? '').toLowerCase()
function freeName(taken: Set<string>, filename: string) {
 const ext = extension(filename), stem = ext ? filename.slice(0, -ext.length - 1) : filename
 for (let n = 1; ; n++) { const candidate = n === 1 ? filename : `${stem} (${n})${ext ? `.${ext}` : ''}`; if (!taken.has(candidate.toLowerCase())) return candidate }
}
export type Submission = { name: string; email: string; files: { filename: string; bytes: Uint8Array }[] }
// Each file is checked against the request's type and size limits and verified into custody before one commit that
// also re-checks the request and the folder, so closing the request or losing the folder refuses the upload.
export async function submit(env: Bindings, secret: string, input: Submission) {
 const resolved = await resolveRequest(env, secret); if (!resolved?.ctx) throw new ChestError(resolved ? 'request_closed' : 'request_not_found', 404)
 const { request, ctx } = resolved, folder = ctx.chain.at(-1)!
 const submitter = { name: optional(input.name, 'name', 120), email: optional(input.email, 'email', 254).toLowerCase() }
 insist(!submitter.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitter.email), 'invalid_email')
 insist(input.files.length >= 1 && input.files.length <= 10, 'files_required')
 const by = `${submitter.email || 'anonymous'} via file request`, taken = new Set((await siblings(env, ctx.space.id, folder.id)).map(r => r.payload.name.toLowerCase())), at = now(), rows: Row<Item>[] = []
 for (const f of input.files) {
  const filename = name(f.filename, 'filename')
  insist(!request.payload.types.length || request.payload.types.includes(extension(filename)), 'type_not_allowed', 415)
  insist(f.bytes.length <= request.payload.maxBytes, 'file_too_large', 413)
  const value = freeName(taken, filename); taken.add(value.toLowerCase())
  const v = await admit(env, f.bytes, value, by, 'upload')
  rows.push(fresh<Item>('item', { space: ctx.space.id, parent: folder.id, type: 'file', name: value, createdBy: request.payload.createdBy, createdAt: at, updatedAt: at, restricted: false, noDownload: false, grants: [], trash: null, versions: [v], current: v.id }))
 }
 const who = submitter.name ? `${submitter.name}${submitter.email ? ` (${submitter.email})` : ''}` : submitter.email || 'Someone'
 const note = notice(request.payload.createdBy, 'file-request.upload', rows.length === 1 ? rows[0].id : folder.id, who, `${who} uploaded ${rows.map(r => `"${r.payload.name}"`).join(', ')} to "${folder.payload.name}" through your file request "${request.payload.title}".`)
 await commit(env, null, [{ row: next(request, { ...request.payload, uploads: request.payload.uploads + rows.length }), previous: request }, ...rows.map(row => ({ row })), { row: note }], { by, fences: [request, ...ctx.fences], changes: rows.map(r => ({ item: r.id, space: ctx.space.id, kind: 'create' })), audits: rows.map(r => ({ action: 'file-request.upload', object: r.id, detail: { request: request.id, folder: folder.id, version: r.payload.current, size: r.payload.versions[0].size, checksum: r.payload.versions[0].checksum, submitter: submitter.email || null } })) })
 await deliver(env, null, [note])
 return { title: request.payload.title, at, files: rows.map(r => ({ name: r.payload.name, size: r.payload.versions[0].size, checksum: r.payload.versions[0].checksum })) }
}
