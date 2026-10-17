import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { canonicalJson, sha256 } from '../../modules/import-kit/src/d1/index'
import { ChestError, id, insist, now, type Row } from '../model'
import { commit, fresh, maybe, next, spaceItems, type Op } from './repo'
import { allowed, chain, context, descend, isAdmin, level, start, type Who } from './access'
import type { FileVersion, Item, Link, Role, Space, Trash } from './model'
// Point-in-time rewind (RECOVER-001). A preview lists what returning a space, a folder tree or a personal area to a
// recorded moment would change: earlier versions, names, places and trash state, and items added since, which go to
// trash. Applying a reviewed preview writes each change as a new attributed state; later versions and items stay
// recoverable. Sharing is never restored: grants, links and identities removed since that moment stay removed.
// Every applied rewind leaves a receipt with each item's state just before it, so the rewind can be undone.
type Change = { id: string; name: string; kinds: string[]; version?: string; versionAt?: string; renameTo?: string; moveTo?: { space: string; parent: string | null }; trash?: boolean }
type Event = { action: string; detail: any; at: string }
const point = (value: unknown) => { insist(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'invalid_point'); const at = new Date(value).toISOString(); insist(Date.parse(at) <= Date.now(), 'invalid_point'); return at }
async function scope(env: Bindings, s: Session, w: Who, input: any, at: string): Promise<{ space: Row<Space>; items: Row<Item>[]; label: string; role: Role }> {
 if (typeof input.space === 'string') {
  const space = await get<Space>(env, 'space', input.space), role = start(space.payload, w).role
  insist(isAdmin(s) || role === 'manager' || role === 'owner', role ? 'rewind_refused' : 'not_found', role ? 403 : 404)
  return { space, items: await spaceItems(env, space.id), label: `space:${space.id}`, role: role ?? 'manager' }
 }
 insist(typeof input.folder === 'string', 'invalid_scope')
 const { space, chain: nodes } = await chain(env, input.folder), links = await list<Link>(env, 'link'); let state = start(space.payload, w)
 for (const node of nodes) state = descend(state, node, w, links)
 const folder = nodes.at(-1)!, r = level(state); insist(folder.payload.type === 'folder', 'not_a_folder')
 if (!isAdmin(s) && r < 3) throw new ChestError(r ? 'rewind_refused' : 'not_found', r ? 403 : 404)
 const rows = new Map((await spaceItems(env, space.id)).map(x => [x.id, x])), tree = new Map<string, Row<Item>>([[folder.id, folder]])
 const walk = (p: string) => { for (const x of rows.values()) if (x.payload.parent === p && !tree.has(x.id)) { tree.set(x.id, x); walk(x.id) } }; walk(folder.id)
 // Items that were inside the folder at that moment and have been moved out since come back with it, when the person
 // may move them where they are now.
 const moves = (await env.DB.prepare("SELECT object_id, detail FROM chest_audit WHERE action='item.move' AND at>? ORDER BY at").bind(at).all()).results as { object_id: string; detail: string }[], first = new Map<string, any>()
 for (const m of moves) if (!first.has(m.object_id)) first.set(m.object_id, JSON.parse(m.detail).from)
 for (let added = true; added; ) {
  added = false
  for (const [key, from] of first) {
   if (tree.has(key) || !from || !tree.has(from.parent)) continue
   const item = await maybe<Item>(env, 'item', key); if (!item) continue
   const ctx = await context(env, w, key); if (!isAdmin(s) && !allowed(ctx, 'manage')) continue
   tree.set(key, item); if (item.payload.space !== space.id) for (const x of await spaceItems(env, item.payload.space)) rows.set(x.id, x)
   walk(key); added = true
  }
 }
 // Below manager, a person rewinds only the files they created.
 const items = [...tree.values()]
 return { space, items: isAdmin(s) || r >= 5 ? items : items.filter(x => x.payload.createdBy === s.operator.email), label: `folder:${folder.id}`, role: state.role ?? 'manager' }
}
export async function plan(env: Bindings, s: Session, w: Who, input: any) {
 const at = point(input.at), { space, items, label, role } = await scope(env, s, w, input, at), ids = new Set(items.map(i => i.id)), changes: Change[] = []
 const history = (await env.DB.prepare("SELECT object_id, action, detail, at FROM chest_audit WHERE action IN ('item.rename','item.move','item.trash','item.restore','share.remove','share.expired','link.remove','space.members') ORDER BY at").all()).results as ({ object_id: string } & Event)[]
 const events = (key: string) => history.filter(e => e.object_id === key).map(e => ({ action: e.action, detail: JSON.parse(e.detail), at: e.at }))
 for (const item of items) {
  const p = item.payload, mine = events(item.id), later = mine.filter(e => e.at > at), change: Change = { id: item.id, name: p.name, kinds: [] }
  if (p.createdAt > at) { if (!p.trash) { change.kinds.push('added since'); change.trash = true } }
  else {
   const then = [...p.versions].filter(v => v.at <= at).at(-1), current = p.versions.find(v => v.id === p.current)
   if (then && current && then.checksum !== current.checksum) { change.kinds.push('earlier version'); change.version = then.id; change.versionAt = then.at }
   const renamed = later.find(e => e.action === 'item.rename'); if (renamed && renamed.detail.before !== p.name) { change.kinds.push('name'); change.renameTo = renamed.detail.before }
   const moved = later.find(e => e.action === 'item.move'); if (moved && (moved.detail.from.parent !== p.parent || moved.detail.from.space !== p.space)) { change.kinds.push('place'); change.moveTo = moved.detail.from }
   const trashedThen = mine.filter(e => e.at <= at && (e.action === 'item.trash' || e.action === 'item.restore')).at(-1)?.action === 'item.trash'
   if (trashedThen !== !!p.trash) { change.kinds.push(trashedThen ? 'trashed then' : 'not trashed then'); change.trash = trashedThen }
  }
  if (change.kinds.length) changes.push(change)
 }
 const sharing = history.filter(e => e.at > at && (ids.has(e.object_id) || e.object_id === space.id) && ['share.remove', 'share.expired', 'link.remove', 'space.members'].includes(e.action)).map(e => ({ object: e.object_id, action: e.action, at: e.at, detail: JSON.parse(e.detail) }))
 return { at, scope: label, role, changes, sharing: { restored: false, removedSince: sharing }, fingerprint: sha256(canonicalJson({ at, label, changes } as any)) }
}
type Before = { current: string | null; name: string; space: string; parent: string | null; trash: Trash | null }
export type Receipt = { scope: string; at: string; by: string; appliedAt: string; items: { id: string; name: string; kinds: string[]; revision: string; before: Before }[]; undone: null | { by: string; at: string; restored: string[]; skipped: string[] } }
const before = (p: Item): Before => ({ current: p.current, name: p.name, space: p.space, parent: p.parent, trash: p.trash })
// A folder that changes space takes its whole tree with it, as an ordinary move does.
async function carried(env: Bindings, key: string, from: string, to: string): Promise<Op[]> {
 if (from === to) return []
 const rows = await spaceItems(env, from), ops: Op[] = [], walk = (p: string) => { for (const r of rows) if (r.payload.parent === p) { ops.push({ row: next(r, { ...r.payload, space: to }), previous: r }); walk(r.id) } }
 walk(key); return ops
}
const freeName = async (env: Bindings, p: Item, key: string, wanted: string) => (await spaceItems(env, p.space)).some(r => r.id !== key && r.payload.parent === p.parent && !r.payload.trash && r.payload.name.toLowerCase() === wanted.toLowerCase()) ? `${wanted} (restored)` : wanted
const restored = (p: Item, source: string, actor: string, at: string) => { const from = p.versions.find(v => v.id === source)!, v: FileVersion = { ...from, id: id(), at, actor, arrival: 'restore', name: '', restoredFrom: from.id }; delete v.device; p.versions.push(v); p.current = v.id }
export async function apply(env: Bindings, s: Session, w: Who, input: any) {
 const preview = await plan(env, s, w, input); insist(input.fingerprint === preview.fingerprint, 'rewind_plan_changed', 409)
 const chosen = Array.isArray(input.items) ? new Set(input.items.map(String)) : null, done: string[] = [], receipt: Receipt = { scope: preview.scope, at: preview.at, by: s.operator.email, appliedAt: now(), items: [], undone: null }
 // Folders first, so restored children land in restored parents.
 const depth = async (key: string) => (await chain(env, key)).chain.length, ordered: [number, Change][] = []
 for (const c of preview.changes) if (!chosen || chosen.has(c.id)) ordered.push([await depth(c.id), c])
 for (const [, c] of ordered.sort((a, b) => a[0] - b[0])) {
  const item = await get<Item>(env, 'item', c.id), p = structuredClone(item.payload), at = now()
  if (c.version) restored(p, c.version, s.operator.email, at)
  if (c.renameTo) p.name = await freeName(env, p, c.id, c.renameTo)
  if (c.moveTo && (c.moveTo.parent === null || await maybe<Item>(env, 'item', c.moveTo.parent))) { p.space = c.moveTo.space; p.parent = c.moveTo.parent }
  if (c.trash !== undefined) p.trash = c.trash ? { by: s.operator.email, at, role: preview.role } : null
  p.updatedAt = at
  const row = next(item, p)
  await commit(env, s, [{ row, previous: item }, ...await carried(env, c.id, item.payload.space, p.space)], { changes: [{ item: c.id, space: p.space, kind: 'rewind' }], audits: [{ action: 'rewind.item', object: c.id, detail: { at: preview.at, kinds: c.kinds, version: p.current } }] })
  receipt.items.push({ id: c.id, name: c.name, kinds: c.kinds, revision: row.revision, before: before(item.payload) }); done.push(c.id)
 }
 const record = fresh<Receipt>('rewind', receipt)
 await commit(env, s, [{ row: record }], { audits: [{ action: 'rewind.apply', object: preview.scope, detail: { at: preview.at, items: done.length, fingerprint: preview.fingerprint, receipt: record.id } }] })
 return { id: record.id, at: preview.at, scope: preview.scope, applied: done }
}
const target = (label: string) => { const [kind, key] = label.split(':'); return kind === 'space' ? { space: key } : { folder: key } }
// Undo returns every item the rewind changed to its state just before it, as a new attributed state. An item changed
// again since the rewind is left as it is and reported.
export async function undo(env: Bindings, s: Session, w: Who, key: string) {
 const record = await get<Receipt>(env, 'rewind', key), r = record.payload
 await scope(env, s, w, target(r.scope), r.at); insist(!r.undone, 'rewind_already_undone', 409)
 const restoredIds: string[] = [], skipped: string[] = []
 for (const entry of [...r.items].reverse()) {
  const item = await maybe<Item>(env, 'item', entry.id); if (!item || item.revision !== entry.revision) { skipped.push(entry.id); continue }
  const p = structuredClone(item.payload), b = entry.before, at = now()
  if (b.current && b.current !== p.current) restored(p, b.current, s.operator.email, at)
  if (b.space !== p.space || b.parent !== p.parent) { p.space = b.space; p.parent = b.parent }
  if (b.name !== p.name) p.name = await freeName(env, p, entry.id, b.name)
  p.trash = b.trash; p.updatedAt = at
  await commit(env, s, [{ row: next(item, p), previous: item }, ...await carried(env, entry.id, item.payload.space, p.space)], { changes: [{ item: entry.id, space: p.space, kind: 'rewind' }], audits: [{ action: 'rewind.undo.item', object: entry.id, detail: { receipt: key, version: p.current } }] })
  restoredIds.push(entry.id)
 }
 const done = next(record, { ...r, undone: { by: s.operator.email, at: now(), restored: restoredIds, skipped } })
 await commit(env, s, [{ row: done, previous: record }], { audits: [{ action: 'rewind.undo', object: r.scope, detail: { receipt: key, restored: restoredIds.length, skipped: skipped.length } }] })
 return { id: key, scope: r.scope, at: r.at, restored: restoredIds, skipped }
}
// The latest rewinds of one scope, for its page.
export async function rewinds(env: Bindings, label: string) {
 return (await list<Receipt>(env, 'rewind')).filter(x => x.payload.scope === label).sort((a, b) => b.payload.appliedAt.localeCompare(a.payload.appliedAt)).slice(0, 3).map(x => ({ id: x.id, ...x.payload }))
}
