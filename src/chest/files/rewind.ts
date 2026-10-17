import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { canonicalJson, sha256 } from '../../modules/import-kit/src/d1/index'
import { ChestError, id, insist, now, type Row } from '../model'
import { commit, maybe, next, spaceItems } from './repo'
import { chain, descend, isAdmin, level, start, type Who } from './access'
import type { FileVersion, Item, Link, Role, Space } from './model'
// Point-in-time rewind (RECOVER-001). A preview lists what returning a space, a folder tree or a personal area to a
// recorded moment would change: earlier versions, names, places and trash state, and items added since, which go to
// trash. Applying a reviewed preview writes each change as a new attributed state; later versions and items stay
// recoverable. Sharing is never restored: grants, links and identities removed since that moment stay removed.
type Change = { id: string; name: string; kinds: string[]; version?: string; renameTo?: string; moveTo?: { space: string; parent: string | null }; trash?: boolean }
type Event = { action: string; detail: any; at: string }
const point = (value: unknown) => { insist(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'invalid_point'); const at = new Date(value).toISOString(); insist(Date.parse(at) <= Date.now(), 'invalid_point'); return at }
async function scope(env: Bindings, s: Session, w: Who, input: any): Promise<{ space: Row<Space>; items: Row<Item>[]; label: string; role: Role }> {
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
 const rows = await spaceItems(env, space.id), tree = [folder], walk = (p: string) => { for (const x of rows) if (x.payload.parent === p) { tree.push(x); walk(x.id) } }; walk(folder.id)
 // Below manager, a person rewinds only the files they created.
 return { space, items: isAdmin(s) || r >= 5 ? tree : tree.filter(x => x.payload.createdBy === s.operator.email), label: `folder:${folder.id}`, role: state.role ?? 'manager' }
}
export async function plan(env: Bindings, s: Session, w: Who, input: any) {
 const at = point(input.at), { space, items, label, role } = await scope(env, s, w, input), ids = new Set(items.map(i => i.id)), changes: Change[] = []
 const history = (await env.DB.prepare("SELECT object_id, action, detail, at FROM chest_audit WHERE action IN ('item.rename','item.move','item.trash','item.restore','share.remove','share.expired','link.remove','space.members') ORDER BY at").all()).results as ({ object_id: string } & Event)[]
 const events = (key: string) => history.filter(e => e.object_id === key).map(e => ({ action: e.action, detail: JSON.parse(e.detail), at: e.at }))
 for (const item of items) {
  const p = item.payload, mine = events(item.id), later = mine.filter(e => e.at > at), change: Change = { id: item.id, name: p.name, kinds: [] }
  if (p.createdAt > at) { if (!p.trash) { change.kinds.push('added since'); change.trash = true } }
  else {
   const then = [...p.versions].filter(v => v.at <= at).at(-1), current = p.versions.find(v => v.id === p.current)
   if (then && current && then.checksum !== current.checksum) { change.kinds.push('earlier version'); change.version = then.id }
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
export async function apply(env: Bindings, s: Session, w: Who, input: any) {
 const preview = await plan(env, s, w, input); insist(input.fingerprint === preview.fingerprint, 'rewind_plan_changed', 409)
 const chosen = Array.isArray(input.items) ? new Set(input.items.map(String)) : null, done: string[] = []
 // Folders first, so restored children land in restored parents.
 const depth = async (key: string) => (await chain(env, key)).chain.length, ordered: [number, Change][] = []
 for (const c of preview.changes) if (!chosen || chosen.has(c.id)) ordered.push([await depth(c.id), c])
 for (const [, c] of ordered.sort((a, b) => a[0] - b[0])) {
  const item = await get<Item>(env, 'item', c.id), p = structuredClone(item.payload), at = now()
  if (c.version) { const source = p.versions.find(v => v.id === c.version)!; const v: FileVersion = { ...source, id: id(), at, actor: s.operator.email, arrival: 'restore', name: '', restoredFrom: source.id }; delete v.device; p.versions.push(v); p.current = v.id }
  if (c.renameTo) { const taken = (await spaceItems(env, p.space)).some(r => r.id !== c.id && r.payload.parent === p.parent && !r.payload.trash && r.payload.name.toLowerCase() === c.renameTo!.toLowerCase()); p.name = taken ? `${c.renameTo} (restored)` : c.renameTo }
  if (c.moveTo && (c.moveTo.parent === null || await maybe<Item>(env, 'item', c.moveTo.parent))) { p.space = c.moveTo.space; p.parent = c.moveTo.parent }
  if (c.trash !== undefined) p.trash = c.trash ? { by: s.operator.email, at, role: preview.role } : null
  p.updatedAt = at
  await commit(env, s, [{ row: next(item, p), previous: item }], { changes: [{ item: c.id, space: p.space, kind: 'rewind' }], audits: [{ action: 'rewind.item', object: c.id, detail: { at: preview.at, kinds: c.kinds, version: p.current } }] })
  done.push(c.id)
 }
 await commit(env, s, [], { audits: [{ action: 'rewind.apply', object: preview.scope, detail: { at: preview.at, items: done.length, fingerprint: preview.fingerprint } }] })
 return { at: preview.at, scope: preview.scope, applied: done }
}
