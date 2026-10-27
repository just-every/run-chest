import { meterOriginal } from '../administration/egress'
import { policy as contentPolicy } from '../content-security/policy'
import { memberProjection } from './member-link-controls'
import { contentReadable, assertContent } from '../content-security/scan'
import { protect, guardDownload } from '../upload-protection/guard'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, recordAccess } from '../store'
import { fromBase64, inspect, retain, serve } from '../blobs'
import { ChestError, id, insist, now, type Row, type Version } from '../model'
import { commit, fresh, next, spaceItems, folderItems, type Op, type Audit } from './repo'
import { allowed, context, demand, descend, start, type Ctx, type Who } from './access'
import { name, type Arrival, type FileVersion, type Item, type Space } from './model'
import { effectiveGovernance } from './folder-metadata'
import { versionPublication } from './governance'
// Ordinary files need no type, reviewer or approval. Every replacement, restore and copy is a new immutable version
// whose bytes were verified before custody; the stable item ID, its grants and links never change.
export async function place(env: Bindings, w: Who, spaceKey: unknown, parent: unknown): Promise<Ctx> {
 if (parent !== null && parent !== undefined && parent !== '') { insist(typeof parent === 'string', 'invalid_parent'); const c = await context(env, w, parent); insist(c.chain.at(-1)!.payload.type === 'folder', 'parent_not_folder'); demand(c, 'contribute'); return c }
 insist(typeof spaceKey === 'string', 'invalid_space'); const space = await get<Space>(env, 'space', spaceKey)
 const ctx: Ctx = { space, chain: [], state: start(space.payload, w), links: [], fences: [space, ...w.groups] }; demand(ctx, 'contribute'); return ctx
}
export const folderOf = (ctx: Ctx) => ctx.chain.at(-1)?.id ?? null
export async function siblings(env: Bindings, space: string, parent: string | null) { return folderItems(env, space, parent) }
export function unique(rows: Row<Item>[], value: string, except?: string) { insist(!rows.some(r => r.id !== except && r.payload.name.toLowerCase() === value.toLowerCase()), 'name_taken', 409) }
export async function admit(env: Bindings, bytes: Uint8Array, filename: string, actor: string, arrival: Arrival, input: { checksum?: unknown; size?: unknown } = {}, extra: Partial<FileVersion> = {}): Promise<FileVersion> {
 const v = await inspect(bytes, filename, actor, '')
 insist(!input.checksum || input.checksum === v.checksum, 'checksum_mismatch'); insist(input.size === undefined || input.size === v.size, 'size_mismatch')
 await retain(env, bytes, v)
 return { id: v.id, filename: v.filename, checksum: v.checksum, size: v.size, mediaType: v.mediaType, preview: v.preview, text: v.text, parser: v.parser, at: v.at, actor, arrival, name: '', ...extra }
}
// A resumable upload passes the version it already admitted, and the operations that close its session in the same batch.
export type Admitted = { sender?: string; version?: FileVersion; ops?: (row: Row<Item>) => Op[]; fences?: Row[]; audits?: Audit[] }
export async function createItem(env: Bindings, s: Session, w: Who, input: any, arrival: Arrival = 'upload', bytes?: Uint8Array, more: Admitted = {}) {
 const p = await place(env, w, input.space, input.parent), parent = folderOf(p), value = name(input.name), at = now()
 unique(await siblings(env, p.space.id, parent), value)
 const type = input.type === 'folder' ? 'folder' : 'file', versions: FileVersion[] = []
 if (type === 'file') await protect(env,s,{space:p.space.id,parent,name:value},bytes ?? (more.version ? null : fromBase64(input.base64)),more.version)
 if (type === 'file') versions.push(more.version ?? await admit(env, bytes ?? fromBase64(input.base64), value, s.operator.email, arrival, input, input.device ? { device: input.device } : {}))
 const payload: Item = { space: p.space.id, parent, type, name: value, createdBy: s.operator.email, createdAt: at, updatedAt: at, restricted: false, noDownload: false, grants: [], trash: null, versions: [], current: null }
 const row = fresh<Item>('item', versions[0] ? await versionPublication(env, p, payload, versions[0], input) : payload)
 await commit(env, s, [{ row }, ...more.ops?.(row) ?? []], { fences: [...p.fences,...more.fences ?? []], changes: [{ item: row.id, space: p.space.id, kind: 'create' }], audits: [{ action: type === 'folder' ? 'folder.create' : arrival === 'created' ? 'file.create' : 'file.upload', object: row.id, detail: { space: p.space.id, parent, version: row.payload.current, arrival } },...more.audits ?? []] })
 if(type === 'file'){const {runArrival}=await import('../filing/rules');return (await runArrival(env,s,w,row,more.sender)).item}
 return row
}
export async function addVersion(env: Bindings, s: Session, w: Who, key: string, bytes: Uint8Array | null, input: any, arrival: Arrival = 'upload', more: Admitted = {}) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'contribute'); insist(item.payload.type === 'file', 'not_a_file')
 await protect(env,s,{item,space:item.payload.space,parent:item.payload.parent,name:typeof input.filename==='string'?input.filename:item.payload.name},bytes,more.version)
 const v = more.version ?? await admit(env, bytes!, typeof input.filename === 'string' ? name(input.filename, 'filename') : item.payload.name, s.operator.email, arrival, input, input.device ? { device: input.device } : {})
 const row = next(item, await versionPublication(env, ctx, item.payload, v, input))
 await commit(env, s, [{ row, previous: item }, ...more.ops?.(row) ?? []], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'version' }], audits: [{ action: 'version.upload', object: key, detail: { version: v.id, arrival } }] })
 return row
}
export async function nameVersion(env: Bindings, s: Session, w: Who, key: string, versionId: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'contribute')
 const v = item.payload.versions.find(v => v.id === versionId); insist(v, 'version_not_found', 404)
 insist(typeof input.name === 'string' && input.name.length <= 120 && !/[\x00-\x1f]/.test(input.name), 'invalid_version_name')
 const row = next(item, { ...item.payload, versions: item.payload.versions.map(x => x.id === versionId ? { ...x, name: input.name.trim() } : x) })
 await commit(env, s, [{ row, previous: item }], { fences: ctx.fences, audits: [{ action: 'version.name', object: key, detail: { version: versionId, before: v.name, after: input.name.trim() } }] })
 return row
}
// A restore adds a new attributed version with the chosen bytes; later versions stay downloadable.
export async function restoreVersion(env: Bindings, s: Session, w: Who, key: string, versionId: string) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'contribute')
 const source = item.payload.versions.find(v => v.id === versionId); insist(source, 'version_not_found', 404)
 insist(await env.BLOBS.head(`sha256/${source.checksum}`), 'blob_missing', 503)
 const v: FileVersion = { ...source, id: id(), at: now(), actor: s.operator.email, arrival: 'restore', name: '', restoredFrom: source.id }; delete v.device
 const row = next(item, await versionPublication(env, ctx, item.payload, v))
 await commit(env, s, [{ row, previous: item }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'version' }], audits: [{ action: 'version.restore', object: key, detail: { source: source.id, version: v.id } }] })
 return row
}
export async function rename(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'contribute'); const value = name(input.name)
 unique(await siblings(env, item.payload.space, item.payload.parent), value, key)
 await commit(env, s, [{ row: next(item, { ...item.payload, name: value, updatedAt: now() }), previous: item }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'rename' }], audits: [{ action: 'item.rename', object: key, detail: { before: item.payload.name, after: value } }] })
 return get<Item>(env, 'item', key)
}
async function subtree(env: Bindings, item: Row<Item>) {
 if(item.payload.type!=='folder')return []
 const rows = await spaceItems(env, item.payload.space), result: Row<Item>[] = [], walk = (parent: string) => { for (const r of rows) if (r.payload.parent === parent) { insist(result.length < 5000, 'tree_too_large'); result.push(r); walk(r.id) } }
 walk(item.id); return result
}
// Moving needs manage rights throughout the tree and contribute rights at the destination; inherited access follows it.
export async function move(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'manage')
 const descendants = await subtree(env, item)
 for (const child of descendants) { const access = await context(env, w, child.id); demand(access, 'manage'); ctx.fences.push(...access.fences) }
 const dest = await place(env, w, input.space ?? item.payload.space, input.parent), parent = folderOf(dest)
 insist(!dest.chain.some(n => n.id === key), 'move_into_itself'); unique(await siblings(env, dest.space.id, parent), item.payload.name, key)
 const ops: Op[] = [{ row: next(item, { ...item.payload, governance: effectiveGovernance(ctx, item.payload), space: dest.space.id, parent, updatedAt: now() }), previous: item }]
 if (dest.space.id !== item.payload.space) for (const r of descendants) ops.push({ row: next(r, { ...r.payload, space: dest.space.id }), previous: r })
 await commit(env, s, ops, { fences: [...ctx.fences, ...dest.fences], changes: [...new Set([item.payload.space, dest.space.id])].map(space => ({ item: key, space, kind: 'move' })), audits: [{ action: 'item.move', object: key, detail: { from: { space: item.payload.space, parent: item.payload.parent }, to: { space: dest.space.id, parent } } }] })
 return get<Item>(env, 'item', key)
}
export async function copy(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'manage'); demand(ctx, 'download')
 const dest = await place(env, w, input.space ?? item.payload.space, input.parent), parent = folderOf(dest), at = now()
 insist(!dest.chain.some(n => n.id === key), 'copy_into_itself')
 const value = typeof input.name === 'string' ? name(input.name) : item.payload.name; unique(await siblings(env, dest.space.id, parent), value)
 const ids = new Map<string, string>([[key, id() as string]]), ops: Op[] = []
 const clone = async (r: Row<Item>, newParent: string | null, newName: string) => { const sourceCtx=await context(env,w,r.id);demand(sourceCtx,'manage');demand(sourceCtx,'download');ctx.fences.push(...sourceCtx.fences); const v = r.payload.versions.find(v => v.id === r.payload.current), versions = v ? [{ ...v, id: id(), at, actor: s.operator.email, arrival: 'copy' as Arrival, name: '', restoredFrom: undefined, device: undefined }] : []
  const payload: Item = { space: dest.space.id, parent: newParent, type: r.payload.type, name: newName, createdBy: s.operator.email, createdAt: at, updatedAt: at, restricted: false, noDownload: false, grants: [], trash: null, versions: [], current: null }
  ops.push({ row: fresh<Item>('item', versions[0] ? await versionPublication(env, dest, { ...payload, governance:effectiveGovernance(sourceCtx,r.payload), ...(r.payload.filing ? { filing: r.payload.filing } : {}) }, versions[0], input) : { ...payload, governance:effectiveGovernance(sourceCtx,r.payload) }, ids.get(r.id)!) }) }
 await clone(item, parent, value)
 for (const r of (await subtree(env, item)).filter(r => !r.payload.trash)) { if (!ids.has(r.payload.parent!)) continue; ids.set(r.id, id()); await clone(r, ids.get(r.payload.parent!)!, r.payload.name) }
 await commit(env, s, ops, { fences: [...ctx.fences, ...dest.fences], changes: ops.map(o => ({ item: o.row.id, space: dest.space.id, kind: 'create' })), audits: [{ action: 'item.copy', object: ids.get(key)!, detail: { source: key, items: ops.length } }] })
 return get<Item>(env, 'item', ids.get(key)!)
}
export async function itemSettings(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'administer')
 for (const k of ['restricted', 'noDownload']) insist(input[k] === undefined || typeof input[k] === 'boolean', 'invalid_settings')
 const after = { restricted: input.restricted ?? item.payload.restricted, noDownload: input.noDownload ?? item.payload.noDownload }
 await commit(env, s, [{ row: next(item, { ...item.payload, ...after }), previous: item }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'item.settings', object: key, detail: { before: { restricted: item.payload.restricted, noDownload: item.payload.noDownload }, after } }] })
 return get<Item>(env, 'item', key)
}
export async function children(env: Bindings, w: Who, ctx: Ctx, parent: string | null) {
 const entries=(await folderItems(env, ctx.space.id, parent)).map(r => ({ row: r, state: descend(ctx.state, r, w, ctx.links) })).filter(c => c.state.role).sort((a, b) => (a.row.payload.type === b.row.payload.type ? 0 : a.row.payload.type === 'folder' ? -1 : 1) || a.row.payload.name.localeCompare(b.row.payload.name))
 const {hiddenMerged}=await import('../filing/duplicate-view'), hidden=await hiddenMerged(env,w,entries.map(e=>({...e,space:ctx.space})))
 const result=[],security=await contentPolicy(env);for(const e of entries){const p=memberProjection(ctx.space,[...ctx.chain,e.row],ctx.links,w,descend(ctx.directState??ctx.state,e.row,w,[]),e.state);if(p.state.role&&!hidden.has(e.row.id)&&await contentReadable(env,p.row.payload.versions,w.email,false,security))result.push(p)}return result
}
// Every original response needs download rights, including inline text and range requests.
// Restricted readers use rendered page previews. Recheck access after reading content, before returning a response.
export async function bytes(env: Bindings, s: Session, w: Who, key: string, versionId: string, download: boolean, range?: string | null, action?: string) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'view')
 await guardDownload(env,s,item)
 const v = item.payload.versions.find(v => v.id === versionId); insist(v, 'version_not_found', 404)
 demand(ctx, 'download')
 await assertContent(env,v.checksum)
 const response = range ? await ranged(env, v, range) : await serve(env, v as unknown as Version, download)
 const current = await context(env, await (await import('./access')).who(env, s), key); demand(current, 'download')
 insist(current.chain.at(-1)!.payload.versions.some(version => version.id === v.id && version.checksum === v.checksum), 'version_not_found', 404)
 await recordAccess(env, s, item, action ?? (download || range ? 'version.download' : 'version.preview'), v.id,range?Number(response.headers.get('content-length')):v.size)
 return meterOriginal(env,response,key,s.operator.email,action??(download||range?'file download':'original preview'),range?Number(response.headers.get('content-length')):v.size)
}
async function ranged(env: Bindings, v: FileVersion, range: string) {
 const m = /^bytes=(\d+)-(\d*)$/.exec(range); if (!m) throw new ChestError('invalid_range', 416)
 const start = Number(m[1]), end = m[2] ? Math.min(Number(m[2]), v.size - 1) : v.size - 1; if (start > end || start >= v.size) throw new ChestError('invalid_range', 416)
 const blob = await env.BLOBS.get(`sha256/${v.checksum}`, { range: { offset: start, length: end - start + 1 } }); insist(blob, 'blob_missing', 503)
 return new Response(blob.body, { status: 206, headers: { 'content-type': v.mediaType, 'content-range': `bytes ${start}-${end}/${v.size}`, 'content-length': String(end - start + 1), 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'content-security-policy': "sandbox; default-src 'none'" } })
}
