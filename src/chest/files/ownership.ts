import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { ChestError, insist, now, type Row } from '../model'
import { context, demand, type Who } from './access'
import { commit, fresh, next, spaceItems, type Op } from './repo'
import { deliver, notice } from './notify'
import { name, type FileRequest, type PublicLink, type Grant, type Item, type Space } from './model'
import { personal } from './spaces'

type Identity = { id: string; email: string; version: number }
type Snapshot = { id: string; revision: string }
export type OwnershipOffer = {
 item: string; itemName: string; itemType: Item['type']; sender: string; recipient: string; retainEditor: boolean
 at: string; status: 'pending'|'accepted'|'declined'|'cancelled'; decidedAt?: string
 source: string; chain: Snapshot[]; tree: Snapshot[]; identities: Identity[]
}
// An offer is consent to the exact tree the sender saw. Neither editing/moving that tree nor deactivating and
// reactivating either participant can turn an old request into fresh authority. No credential travels with it.
async function identity(env: Bindings, email: string) {
 const found = await env.DB.prepare("SELECT id,email,version FROM oa_operators WHERE email=? AND status='active'").bind(email).first<Identity>()
 insist(found, 'ownership_active_colleague_required', 409); return found
}
const snapshot = (row: Row): Snapshot => ({ id: row.id, revision: row.revision })
async function tree(env: Bindings, root: Row<Item>) {
 const children = new Map<string, Row<Item>[]>()
 for (const row of await spaceItems(env, root.payload.space)) if (row.payload.parent) children.set(row.payload.parent, [...children.get(row.payload.parent) ?? [], row])
 const rows: Row<Item>[] = [], seen = new Set<string>(), pending = [root]
 while (pending.length) {
  const row = pending.pop()!; insist(!seen.has(row.id), 'tree_corrupt', 503); seen.add(row.id); rows.push(row)
  pending.push(...children.get(row.id) ?? [])
 }
 return rows
}
// These assertions are in the same SQL transaction as publication, including phantom descendants or another offer
// inserted after the initial reads. Statements run after writes, so the tree guard compares stable IDs only.
function guards(identities: Identity[], item: string, rows: Row<Item>[], pendingOffer?: string) {
 const statements = identities.map(i => ({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND status='active') THEN 1 ELSE 0 END", params: [i.id, i.email, i.version] as unknown[] }))
 statements.push({ sql: `WITH RECURSIVE tree(id) AS (SELECT ? UNION SELECT r.id FROM chest_records r JOIN tree t ON json_extract(r.payload,'$.parent')=t.id WHERE r.kind='item')
 INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM tree)=json_array_length(?) AND NOT EXISTS(SELECT id FROM tree EXCEPT SELECT value FROM json_each(?)) THEN 1 ELSE 0 END`, params: [item, JSON.stringify(rows.map(r => r.id)), JSON.stringify(rows.map(r => r.id))] })
 if (pendingOffer) statements.push({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records WHERE kind='ownership' AND json_extract(payload,'$.item')=? AND json_extract(payload,'$.status')='pending')=1 AND EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind='ownership' AND json_extract(payload,'$.status')='pending') THEN 1 ELSE 0 END", params: [item, pendingOffer] })
 return statements
}
async function publish(env: Bindings, s: Session, ops: Op[], options: NonNullable<Parameters<typeof commit>[3]>) {
 try { await commit(env, s, ops, options) }
 catch (error) { if (String(error).includes('CHECK constraint failed')) throw new ChestError('ownership_changed', 409); throw error }
}
export async function offerOwnership(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'administer')
 insist(ctx.space.payload.kind === 'personal' && ctx.space.payload.owner === s.operator.email, 'ownership_personal_only', 403)
 insist(typeof input.recipient === 'string', 'invalid_recipient')
 const recipient = input.recipient.trim().toLowerCase(); insist(recipient !== s.operator.email, 'ownership_self', 400)
 insist(input.retainEditor === undefined || typeof input.retainEditor === 'boolean', 'invalid_retain_editor')
 const identities = await Promise.all([identity(env, s.operator.email), identity(env, recipient)]), rows = await tree(env, item)
 insist(!(await list<OwnershipOffer>(env, 'ownership')).some(o => o.payload.item === key && o.payload.status === 'pending'), 'ownership_already_pending', 409)
 const row = fresh<OwnershipOffer>('ownership', { item: key, itemName: item.payload.name, itemType: item.payload.type, sender: s.operator.email, recipient, retainEditor: input.retainEditor !== false, at: now(), status: 'pending', source: ctx.space.id, chain: [ctx.space, ...ctx.chain].map(snapshot), tree: rows.map(snapshot), identities })
 const n = notice(recipient, 'ownership.request', null, s.operator.email, `${s.operator.displayName || s.operator.email} offered you ownership of "${item.payload.name}". Accept or decline in Chest.`, row.id)
 await publish(env, s, [{ row }, { row: n }], { fences: [...ctx.fences, ...rows], statements: guards(identities, key, rows, row.id), audits: [{ action: 'ownership.offer', object: key, detail: { offer: row.id, recipient, retainEditor: row.payload.retainEditor } }] })
 await deliver(env, s, [n]); return ownershipView(env, s, w, row.id)
}
async function participant(env: Bindings, s: Session, id: string) {
 const row = await get<OwnershipOffer>(env, 'ownership', id)
 insist(row.payload.sender === s.operator.email || row.payload.recipient === s.operator.email, 'not_found', 404); return row
}
async function current(env: Bindings, offer: OwnershipOffer) {
 const root = await get<Item>(env, 'item', offer.item), rows = await tree(env, root)
 insist(root.payload.space === offer.source && rows.length === offer.tree.length && offer.tree.every(saved => rows.some(r => r.id === saved.id && r.revision === saved.revision)), 'ownership_offer_stale', 409)
 const fences: Row[] = [...rows]
 for (const saved of offer.chain) {
  const row = await get(env, saved.id === offer.source ? 'space' : 'item', saved.id)
  insist(row.revision === saved.revision, 'ownership_offer_stale', 409); fences.push(row)
 }
 const source = fences.find(r => r.id === offer.source) as Row<Space>
 insist(source.payload.kind === 'personal' && source.payload.owner === offer.sender && !root.payload.trash, 'ownership_offer_stale', 409)
 for (const saved of offer.identities) { const active = await identity(env, saved.email); insist(active.id === saved.id && active.version === saved.version, 'ownership_offer_stale', 409) }
 return { root, rows, fences }
}
export async function ownershipView(env: Bindings, s: Session, _w: Who, id: string) {
 const row = await participant(env, s, id), p = row.payload
 let stale = false
 if (p.status === 'pending') { try { await current(env, p) } catch (e) { if (e instanceof ChestError && [404, 409].includes(e.status)) stale = true; else throw e } }
 return { id, item: p.item, itemName: p.itemName, itemType: p.itemType, sender: p.sender, recipient: p.recipient, retainEditor: p.retainEditor, at: p.at, status: p.status, decidedAt: p.decidedAt, mine: p.sender === s.operator.email, canAccept: p.recipient === s.operator.email && p.status === 'pending' && !stale, stale }
}
export async function ownershipInbox(env: Bindings, s: Session, w: Who) {
 const rows = (await list<OwnershipOffer>(env, 'ownership')).filter(r => r.payload.sender === s.operator.email || r.payload.recipient === s.operator.email).sort((a, b) => b.payload.at.localeCompare(a.payload.at))
 return Promise.all(rows.map(row => ownershipView(env, s, w, row.id)))
}
export async function ownershipForItem(env: Bindings, s: Session, w: Who, key: string) {
 const rows = (await list<OwnershipOffer>(env, 'ownership')).filter(r => r.payload.item === key && (r.payload.sender === s.operator.email || r.payload.recipient === s.operator.email))
 return Promise.all(rows.map(row => ownershipView(env, s, w, row.id)))
}
// Preserve inherited named rights when detaching the root from its old folder. Restricted descendants keep their
// own direct grants; the former owner's editor grant is explicit there because restriction stops inheritance.
function inheritedGrants(fences: Row[], offer: OwnershipOffer, root: Row<Item>) {
 let grants: Grant[] = []
 for (const saved of offer.chain.filter(s => s.id !== offer.source && s.id !== root.id)) {
  const row = fences.find(r => r.id === saved.id) as Row<Item>
  if (row.payload.restricted) grants = []
  grants.push(...row.payload.grants)
 }
 return root.payload.restricted ? [] : grants
}
export async function decideOwnership(env: Bindings, s: Session, w: Who, id: string, input: any) {
 const row = await participant(env, s, id), p = row.payload
 insist(p.recipient === s.operator.email, 'ownership_recipient_required', 403); insist(p.status === 'pending', 'ownership_closed', 409)
 insist(input.decision === 'accept' || input.decision === 'decline', 'invalid_decision')
 if (input.decision === 'decline') return close(env, s, w, row, 'declined')
 const { root, rows, fences } = await current(env, p), destination = await personal(env, s), value = input.name ? name(input.name) : root.payload.name
 insist(!(await spaceItems(env, destination.id)).some(r => !r.payload.trash && r.payload.parent === null && r.payload.name.toLowerCase() === value.toLowerCase()), 'ownership_name_taken', 409)
 const at = now(), inherited = inheritedGrants(fences, p, root)
 const noDownload = p.chain.some(saved => saved.id !== p.source && (fences.find(r => r.id === saved.id) as Row<Item>).payload.noDownload)
 const ops: Op[] = rows.map(item => {
  let grants = item.id === root.id ? [...inherited, ...item.payload.grants] : [...item.payload.grants]
  if (!p.retainEditor) grants = grants.filter(g => g.principal !== p.sender)
  else if (item.id === root.id || item.payload.restricted) { grants = grants.filter(g => g.principal !== p.sender); grants.push({ principal: p.sender, role: 'editor', by: s.operator.email, at }) }
  return { row: next(item, { ...item.payload, space: destination.id, grants, ...(item.id === root.id ? { parent: null, name: value, updatedAt: at, noDownload } : {}) }), previous: item }
 })
 const ids=new Set(rows.map(r=>r.id)), links=[...(await list<PublicLink>(env,'public-link')), ...(await list<FileRequest>(env,'file-request'))].filter(r=>ids.has('item' in r.payload?r.payload.item:r.payload.folder))
 // The new owner takes responsibility for existing capabilities without changing their tokens or authorship.
 for(const link of links)ops.push({row:next(link as Row,{...link.payload,custodian:p.recipient}),previous:link as Row})
 const n = notice(p.sender, 'ownership.accepted', p.item, s.operator.email, `${s.operator.displayName || s.operator.email} accepted ownership of "${value}".${p.retainEditor ? ' You remain an editor.' : ' Your direct access was removed.'}`, row.id)
 ops.push({ row: next(row, { ...p, status: 'accepted', decidedAt: at }), previous: row }, { row: n })
 const statements = guards(p.identities, p.item, rows)
 statements.push({sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records WHERE kind IN ('public-link','file-request') AND COALESCE(json_extract(payload,'$.item'),json_extract(payload,'$.folder')) IN (SELECT value FROM json_each(?)))=? THEN 1 ELSE 0 END",params:[JSON.stringify([...ids]),links.length]})
 statements.push({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM chest_records WHERE kind='item' AND id<>? AND json_extract(payload,'$.space')=? AND json_extract(payload,'$.parent') IS NULL AND json_extract(payload,'$.trash') IS NULL AND lower(json_extract(payload,'$.name'))=lower(?)) THEN 1 ELSE 0 END", params: [p.item, destination.id, value] })
 await publish(env, s, ops, { fences: [...fences, destination], statements, changes: rows.flatMap(item => [p.source, destination.id].map(space => ({ item: item.id, space, kind: 'ownership' }))), audits: [{ action: 'ownership.accept', object: p.item, detail: { offer: id, sender: p.sender, recipient: p.recipient, retainEditor: p.retainEditor, items: rows.length, name: value } }] })
 await deliver(env, s, [n]); return ownershipView(env, s, w, id)
}
async function close(env: Bindings, s: Session, w: Who, row: Row<OwnershipOffer>, status: 'declined'|'cancelled') {
 const p = row.payload, to = status === 'declined' ? p.sender : p.recipient
 const n = notice(to, `ownership.${status}`, null, s.operator.email, `The ownership request for "${p.itemName}" was ${status}. Ownership has not changed.`, row.id)
 await publish(env, s, [{ row: next(row, { ...p, status, decidedAt: now() }), previous: row }, { row: n }], { audits: [{ action: status === 'declined' ? 'ownership.decline' : 'ownership.cancel', object: p.item, detail: { offer: row.id, recipient: p.recipient } }] })
 await deliver(env, s, [n]); return ownershipView(env, s, w, row.id)
}
export async function cancelOwnership(env: Bindings, s: Session, w: Who, id: string) {
 const row = await participant(env, s, id); insist(row.payload.sender === s.operator.email, 'ownership_sender_required', 403); insist(row.payload.status === 'pending', 'ownership_closed', 409)
 return close(env, s, w, row, 'cancelled')
}
