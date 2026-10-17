import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { ChestError, insist, now, type Row } from '../model'
import { commit, fresh, next, spaceItems, type Op } from './repo'
import { chain, context, demand, descend, everything, isAdmin, level, start, type Who } from './access'
import { type Expiry, type Item, type Link, type Space } from './model'
// Trash is self-service and reversible (CHEST-13): whoever trashed an item restores it while they still hold the role
// that let them trash it; space managers restore anything in their space and admins restore across spaces without
// opening content. Trashed originals and history stay until a manager (or a personal area's owner) erases them.
export async function trash(env: Bindings, s: Session, w: Who, key: string) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'manage')
 await commit(env, s, [{ row: next(item, { ...item.payload, trash: { by: s.operator.email, at: now(), role: ctx.state.role! } }), previous: item }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'trash' }], audits: [{ action: 'item.trash', object: key, detail: { outcome: 'trashed', role: ctx.state.role } }] })
 return get<Item>(env, 'item', key)
}
// The person's state on a trashed item as if it were not trashed: roles still come from the space and the path.
async function standing(env: Bindings, w: Who, key: string) {
 const { space, chain: nodes } = await chain(env, key), links = await list<Link>(env, 'link'), item = nodes.at(-1)!
 insist(item.payload.trash, 'not_in_trash', 409)
 let state = start(space.payload, w)
 for (const node of nodes) state = descend(state, node.id === key ? { ...node, payload: { ...node.payload, trash: null } } : node, w, links)
 return { space, nodes, item, state, fences: [space, ...nodes, ...w.groups] }
}
export async function restore(env: Bindings, s: Session, w: Who, key: string) {
 const { space, nodes, item, state, fences } = await standing(env, w, key), r = level(state)
 const permitted = r >= 5 || (item.payload.trash!.by === s.operator.email && r >= 4) || isAdmin(s)
 if (!permitted) throw new ChestError(r >= 1 ? 'restore_refused' : 'not_found', r >= 1 ? 403 : 404)
 insist(!state.trash, 'parent_in_trash', 409)
 await commit(env, s, [{ row: next(item, { ...item.payload, trash: null }), previous: item }], { fences, changes: [{ item: key, space: space.id, kind: 'restore' }], audits: [{ action: 'item.restore', object: key, detail: { outcome: 'restored', trashedBy: item.payload.trash!.by, path: nodes.length } }] })
 return get<Item>(env, 'item', key)
}
// What a person sees in trash: their own trashed items, and every trashed item in spaces they manage. Admins also see
// trashed items elsewhere, by space and date only, so they can restore without opening them.
export async function trashView(env: Bindings, s: Session, w: Who) {
 const rows: any[] = []
 for (const e of (await everything(env, w)).values()) {
  const t = e.row.payload.trash; if (!t) continue
  const r = level(e.state), mine = t.by === s.operator.email, managed = e.state.manager
  if (!mine && !managed && !isAdmin(s)) continue
  const named = mine || managed || r >= 1
  rows.push({ id: e.row.id, name: named ? e.row.payload.name : null, type: e.row.payload.type, space: { id: e.space.id, name: e.space.payload.kind === 'personal' ? 'Personal area' : e.space.payload.name }, trashedBy: t.by, trashedAt: t.at, mine, managed, erasable: e.state.manager })
 }
 return rows.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt))
}
// Permanent erasure of a trashed item and its tree (the ERASE-001 path for files): records, links and expiries go
// in one batch with a receipt; original bytes no other record references are then removed and the receipt completed.
export async function erase(env: Bindings, s: Session, w: Who, key: string) {
 const { space, item, state, fences } = await standing(env, w, key)
 if (!(space.payload.kind === 'team' ? state.role === 'manager' : state.role === 'owner')) throw new ChestError(level(state) >= 1 ? 'erase_refused' : 'not_found', level(state) >= 1 ? 403 : 404)
 const rows = await spaceItems(env, space.id), tree: Row<Item>[] = [item], walk = (p: string) => { for (const r of rows) if (r.payload.parent === p) { tree.push(r); walk(r.id) } }; walk(key)
 const ids = new Set(tree.map(r => r.id)), links = (await list<Link>(env, 'link')).filter(l => ids.has(l.payload.item)), expiries = (await list<Expiry>(env, 'expiry')).filter(x => ids.has(x.payload.item)), notes = (await list<{ item: string }>(env, 'comment')).filter(c => ids.has(c.payload.item))
 const checksums = [...new Set(tree.flatMap(r => r.payload.versions.map(v => v.checksum)))]
 const receipt = fresh('erasure', { scope: 'files', space: space.id, items: [...ids], versions: tree.reduce((n, r) => n + r.payload.versions.length, 0), bytes: tree.reduce((n, r) => n + r.payload.versions.reduce((a, v) => a + v.size, 0), 0), by: s.operator.email, at: now(), originals: { pending: checksums, removed: [] as string[], shared: [] as string[] }, state: 'records_erased' })
 const ops: Op[] = [...tree, ...links, ...expiries, ...notes].map(row => ({ row, previous: row, remove: true }))
 // The minimized audit keeps who did what and when; names and other details of erased items are dropped.
 await commit(env, s, [...ops, { row: receipt }], { fences, changes: [...ids].map(item => ({ item, space: space.id, kind: 'erase' })), audits: [{ action: 'item.erase', object: key, detail: { outcome: 'erased', receipt: receipt.id, items: ids.size } }], statements: [...ids].map(object => ({ sql: `UPDATE chest_audit SET detail='{"erased":true}' WHERE object_id=? AND action<>'item.erase'`, params: [object] })) })
 const removed: string[] = [], shared: string[] = []
 for (const sum of checksums) {
  const used = await env.DB.prepare("SELECT 1 FROM chest_records WHERE kind<>'erasure' AND instr(payload,?)>0 LIMIT 1").bind(sum).first()
  if (used) shared.push(sum); else { await env.BLOBS.delete(`sha256/${sum}`); removed.push(sum) }
 }
 const done = next(receipt, { ...receipt.payload, originals: { pending: [], removed, shared }, state: 'complete' })
 await commit(env, s, [{ row: done, previous: receipt }], { audits: [{ action: 'erasure.complete', object: receipt.id, detail: { removed: removed.length, shared: shared.length } }] })
 return done
}
