import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { validPerson } from '../access'
import { insist, now, type Group, type Row } from '../model'
import { commit, fresh, maybe, next, type Op } from './repo'
import { allowed, context, demand, descend, everything, isAdmin, level, start, type Who } from './access'
import { deliver, notice } from './notify'
import { personLine } from '../names'
import { day, live, rank, role, shareRoles, type AccessRequest, type Expiry, type Grant, type Item, type Link, type Notice, type Prefs, type Space } from './model'
// Item sharing (SHARE-004): people with share rights grant viewer, commenter or editor to colleagues or groups with
// an optional message and expiry; recipients get an in-app notice and an email and find the item under Shared with me.
async function recipients(env: Bindings, value: unknown): Promise<{ principal: string; emails: string[] }> {
 insist(typeof value === 'string' && value.length > 0, 'invalid_principal')
 if (value.includes('@')) { const email = await validPerson(env, value); return { principal: email, emails: [email] } }
 const group = await get<Group>(env, 'group', value); return { principal: group.id, emails: group.payload.members }
}
async function maximumDays(env: Bindings) { return (await maybe<{ maxGrantDays: number | null }>(env, 'policy', 'policy:sharing'))?.payload.maxGrantDays ?? null }
async function expiry(env: Bindings, value: unknown) {
 if (value === undefined || value === null || value === '') return undefined
 insist(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'invalid_expiry')
 const at = `${value}T23:59:59.999Z`, max = await maximumDays(env); insist(Number.isFinite(Date.parse(at)) && Date.parse(at) > Date.now(), 'invalid_expiry')
 insist(max === null || Date.parse(at) <= Date.now() + (max + 1) * day, 'expiry_beyond_maximum'); return at
}
const optional = (value: unknown, field: string, max = 1000) => { if (value === undefined || value === null || value === '') return ''; insist(typeof value === 'string' && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value), `invalid_${field}`); return value.trim() }
const expiryKey = (item: string, principal: string) => `expiry:${item}:${principal}`
async function expiryOps(env: Bindings, item: string, principal: string, grant?: Grant): Promise<Op[]> {
 const old = await maybe<Expiry>(env, 'expiry', expiryKey(item, principal))
 if (!grant?.expires) return old ? [{ row: old, previous: old, remove: true }] : []
 const payload: Expiry = { item, principal, expires: grant.expires, by: grant.by }
 return [old ? { row: next(old, payload), previous: old } : { row: fresh('expiry', payload, expiryKey(item, principal)) }]
}
export async function share(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'share')
 const r = role(input.role, shareRoles); insist(rank[r] <= rank[ctx.state.role!], 'role_above_own', 403)
 const { principal, emails } = await recipients(env, input.principal); insist(principal !== s.operator.email, 'cannot_share_with_self')
 const message = optional(input.message, 'message'), expires = await expiry(env, input.expires)
 const grant: Grant = { principal, role: r, by: s.operator.email, at: now(), ...(expires ? { expires } : {}), ...(message ? { message } : {}) }
 const notices = emails.filter(e => e !== s.operator.email).map(e => notice(e, 'share', key, s.operator.email, `${personLine(s.operator.displayName, s.operator.email)} shared "${item.payload.name}" with you as ${r}.${message ? `\n\n${message}` : ''}${expires ? `\n\nAccess expires ${expires.slice(0, 10)}.` : ''}`))
 await commit(env, s, [{ row: next(item, { ...item.payload, grants: [...item.payload.grants.filter(g => g.principal !== principal), grant] }), previous: item }, ...await expiryOps(env, key, principal, grant), ...notices.map(row => ({ row }))], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'share.grant', object: key, detail: { principal, role: r, expires: expires ?? null } }] })
 await deliver(env, s, notices)
 return get<Item>(env, 'item', key)
}
export async function unshare(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'share')
 const grant = item.payload.grants.find(g => g.principal === input.principal); insist(grant, 'grant_not_found', 404)
 await commit(env, s, [{ row: next(item, { ...item.payload, grants: item.payload.grants.filter(g => g !== grant) }), previous: item }, ...await expiryOps(env, key, grant.principal)], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'share.remove', object: key, detail: { principal: grant.principal, role: grant.role } }] })
 return get<Item>(env, 'item', key)
}
// One-step extend from an expiry notice: seven more days, within the admin maximum, and only from the date the
// notice named, so repeating it moves the date once.
export async function extend(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'share')
 const grant = item.payload.grants.find(g => g.principal === input.principal); insist(grant?.expires && live(grant), 'grant_not_found', 404); insist(input.from === grant.expires, 'already_extended', 409)
 const max = await maximumDays(env), wanted = Date.parse(grant.expires) + 7 * day, cap = max === null ? Infinity : Date.now() + (max + 1) * day
 const expires = new Date(Math.min(wanted, cap)).toISOString(); insist(expires > grant.expires, 'expiry_at_maximum', 409)
 const extended = { ...grant, expires }
 await commit(env, s, [{ row: next(item, { ...item.payload, grants: item.payload.grants.map(g => g === grant ? extended : g) }), previous: item }, ...await expiryOps(env, key, grant.principal, extended)], { fences: ctx.fences, audits: [{ action: 'share.extend', object: key, detail: { principal: grant.principal, before: grant.expires, after: expires } }] })
 return get<Item>(env, 'item', key)
}
export async function sharedWithMe(env: Bindings, w: Who, query: URLSearchParams) {
 const links = await list<Link>(env, 'link'), sharer = query.get('sharer') || '', from = query.get('from') || '', to = query.get('to') || '', rows: any[] = []
 for (const e of (await everything(env, w)).values()) {
  if (e.state.trash || !e.state.role || (e.space.payload.kind === 'personal' && e.space.payload.owner === w.email)) continue
  const grant = e.row.payload.grants.filter(g => w.principals.includes(g.principal) && live(g) && g.by !== w.email).sort((a, b) => b.at.localeCompare(a.at))[0]
  const link = links.find(l => l.payload.item === e.row.id && w.opened.includes(l.id))
  if (!grant && !link) continue
  const entry = { id: e.row.id, name: e.row.payload.name, type: e.row.payload.type, role: e.state.role, sharer: grant?.by ?? link!.payload.createdBy, at: grant?.at ?? link!.payload.at, via: grant ? 'grant' : 'link', expires: grant?.expires ?? null }
  if ((sharer && entry.sharer !== sharer) || (from && entry.at.slice(0, 10) < from) || (to && entry.at.slice(0, 10) > to)) continue
  rows.push(entry)
 }
 return rows.sort((a, b) => b.at.localeCompare(a.at))
}
export async function prefs(env: Bindings, s: Session, w: Who, key: string, input: any) {
 demand(await context(env, w, key), 'view')
 const id = `prefs:${s.operator.email}`, old = await maybe<Prefs>(env, 'prefs', id), p = old?.payload ?? { starred: [], shortcuts: [] }
 const toggle = (list: string[], on: unknown) => { insist(typeof on === 'boolean', 'invalid_preference'); return on ? [...new Set([...list, key])] : list.filter(x => x !== key) }
 const payload = { starred: input.starred === undefined ? p.starred : toggle(p.starred, input.starred), shortcuts: input.shortcut === undefined ? p.shortcuts : toggle(p.shortcuts, input.shortcut) }
 // A shortcut only places the item in the person's area: it grants nothing and opens under current access.
 await commit(env, s, [old ? { row: next(old, payload), previous: old } : { row: fresh('prefs', payload, id) }], { audits: [{ action: input.shortcut === undefined ? 'item.star' : 'item.shortcut', object: key, detail: { starred: input.starred, shortcut: input.shortcut } }] })
 return payload
}
// Who may decide a request: everyone with share rights on the item (owners, file editors, then managers). When none
// is active, for example after an owner left without a successor, the installation's admins decide.
export async function approversFor(env: Bindings, space: Row<Space>, nodes: Row<Item>[]) {
 const people = (await env.DB.prepare("SELECT email, role FROM oa_operators WHERE status='active' ORDER BY email").all()).results as { email: string; role: string }[], groups = await list<Group>(env, 'group'), ranked: [number, string][] = []
 for (const p of people) {
  const mine = groups.filter(g => g.payload.members.includes(p.email)), w: Who = { email: p.email, principals: [p.email, ...mine.map(g => g.id)], groups: mine, opened: [] }
  let state = start(space.payload, w); for (const node of nodes) state = descend(state, node, w, [])
  if (allowed({ space, state }, 'share')) ranked.push([state.role === 'owner' ? 0 : state.role === 'manager' ? 2 : 1, p.email])
 }
 return ranked.length ? ranked.sort((a, b) => a[0] - b[0]).map(r => r[1]) : people.filter(p => p.role === 'owner' || p.role === 'admin').map(p => p.email)
}
// Request access never reveals the item's name to the requester; it reaches the approvers by notice and email.
export async function requestAccess(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; insist(!ctx.state.trash, 'not_found', 404); insist(!allowed(ctx, 'view'), 'already_has_access', 409)
 const r = role(input.role ?? 'viewer', shareRoles), message = optional(input.message, 'message')
 const open = (await list<AccessRequest>(env, 'request')).find(x => x.payload.item === key && x.payload.requester === s.operator.email && x.payload.status === 'pending')
 if (open) return { request: open.id, status: open.payload.status }
 const approvers = await approversFor(env, ctx.space, ctx.chain), at = now()
 const row = fresh<AccessRequest>('request', { item: key, requester: s.operator.email, role: r, message, at, expiresAt: new Date(Date.parse(at) + 30 * day).toISOString(), status: 'pending', approvers })
 const notices = approvers.map(e => notice(e, 'request', key, s.operator.email, `${personLine(s.operator.displayName, s.operator.email)} asked for ${r} access to "${item.payload.name}".${message ? `\n\n${message}` : ''}`, row.id))
 await commit(env, s, [{ row }, ...notices.map(row => ({ row }))], { fences: ctx.fences, audits: [{ action: 'access.request', object: key, detail: { request: row.id, role: r, approvers: approvers.length } }] })
 await deliver(env, s, notices)
 return { request: row.id, status: 'pending' }
}
export async function requestView(env: Bindings, s: Session, w: Who, id: string) {
 const req = await get<AccessRequest>(env, 'request', id), mine = req.payload.requester === s.operator.email
 insist(mine || req.payload.approvers.includes(s.operator.email), 'not_found', 404)
 const item = await maybe<Item>(env, 'item', req.payload.item)
 return { id, ...req.payload, approvers: mine ? undefined : req.payload.approvers, itemName: mine ? null : item?.payload.name ?? null }
}
export async function decide(env: Bindings, s: Session, w: Who, id: string, input: any) {
 const req = await get<AccessRequest>(env, 'request', id); insist(req.payload.status === 'pending', 'request_closed', 409); insist(Date.parse(req.payload.expiresAt) > Date.now(), 'request_expired', 409)
 insist(req.payload.approvers.includes(s.operator.email), 'not_an_approver', 403)
 const ctx = await context(env, w, req.payload.item), item = ctx.chain.at(-1)!; insist(!ctx.state.trash, 'not_found', 404)
 const share = allowed(ctx, 'share'); insist(share || isAdmin(s), 'share_refused', 403)
 insist(input.decision === 'approve' || input.decision === 'decline', 'invalid_decision')
 const ops: Op[] = [], at = now(); let granted: Grant | undefined
 if (input.decision === 'approve') {
  const r = role(input.role ?? req.payload.role, shareRoles); insist(rank[r] <= rank[req.payload.role], 'role_above_request'); insist(!share || rank[r] <= level(ctx.state), 'role_above_own', 403)
  granted = { principal: req.payload.requester, role: r, by: s.operator.email, at }
  ops.push({ row: next(item, { ...item.payload, grants: [...item.payload.grants.filter(g => g.principal !== granted!.principal), granted] }), previous: item }, ...await expiryOps(env, item.id, granted.principal))
 }
 const decided = next(req, { ...req.payload, status: input.decision === 'approve' ? 'approved' as const : 'declined' as const, decidedBy: s.operator.email, decidedAt: at, ...(granted ? { grantedRole: granted.role } : {}) })
 const told = notice(req.payload.requester, 'request.decision', granted ? item.id : null, s.operator.email, granted ? `Your access request for "${item.payload.name}" was approved as ${granted.role}.` : 'Your access request was declined.', id)
 await commit(env, s, [...ops, { row: decided, previous: req }, { row: told }], { fences: ctx.fences, changes: granted ? [{ item: item.id, space: ctx.space.id, kind: 'access' }] : [], audits: [{ action: `access.${input.decision}`, object: item.id, detail: { request: id, role: granted?.role ?? null } }] })
 await deliver(env, s, [told])
 return { id, status: decided.payload.status, grantedRole: granted?.role ?? null }
}
export async function pending(env: Bindings, w: Who, item?: string) { return (await list<AccessRequest>(env, 'request')).filter(r => r.payload.status === 'pending' && r.payload.approvers.includes(w.email) && (!item || r.payload.item === item)) }
export async function notices(env: Bindings, w: Who) { return (await list<Notice>(env, 'notice')).filter(n => n.payload.to === w.email).sort((a, b) => b.payload.at.localeCompare(a.payload.at)).slice(0, 200) }
export async function markRead(env: Bindings, s: Session, w: Who) {
 const unread = (await notices(env, w)).filter(n => !n.payload.read)
 if (unread.length) await commit(env, s, unread.map(n => ({ row: next(n, { ...n.payload, read: true }), previous: n })))
 return { read: unread.length }
}
// Time-based duties run on the next request after they fall due: the one-day expiry notice, refusing and recording
// an expired grant, and closing requests after 30 days. Each duty commits alone; a concurrent request that already
// performed it makes this commit's snapshot stale, so nothing is sent twice.
export async function sweep(env: Bindings) {
 const t = Date.now()
 for (const x of await list<Expiry>(env, 'expiry')) {
  try {
   const item = await maybe<Item>(env, 'item', x.payload.item); if (!item) continue
   const grant = item.payload.grants.find(g => g.principal === x.payload.principal && g.expires === x.payload.expires)
   if (Date.parse(x.payload.expires) <= t) {
    await commit(env, null, [{ row: x, previous: x, remove: true }, ...(grant ? [{ row: next(item, { ...item.payload, grants: item.payload.grants.filter(g => g !== grant) }), previous: item }] : [])], { changes: [{ item: item.id, space: item.payload.space, kind: 'access' }], audits: [{ action: 'share.expired', object: item.id, detail: { principal: x.payload.principal, expires: x.payload.expires } }] })
   } else if (!x.payload.noticeAt && Date.parse(x.payload.expires) - t <= day && grant) {
    // A grantee group may since have been deleted: its former members are no longer told; the sharer still is.
    const emails = x.payload.principal.includes('@') ? [x.payload.principal] : (await maybe<Group>(env, 'group', x.payload.principal))?.payload.members ?? []
    const text = `Access to "${item.payload.name}" for ${x.payload.principal} (${grant.role}) expires ${x.payload.expires.slice(0, 16).replace('T', ' ')} UTC.`
    const rows = [...new Set([x.payload.by, ...emails])].map(e => notice(e, 'share.expiring', item.id, 'chest:system', text))
    await commit(env, null, [{ row: next(x, { ...x.payload, noticeAt: new Date(t).toISOString() }), previous: x }, ...rows.map(row => ({ row }))], { audits: [{ action: 'share.expiry_notice', object: item.id, detail: { principal: x.payload.principal, notices: rows.length } }] })
    await deliver(env, null, rows)
   }
  } catch (e) { if (!String((e as Error)?.message).includes('CHECK constraint failed')) throw e }
 }
 for (const r of await list<AccessRequest>(env, 'request')) {
  if (r.payload.status !== 'pending' || Date.parse(r.payload.expiresAt) > t) continue
  try {
   const told = notice(r.payload.requester, 'request.expired', null, 'chest:system', 'Your access request expired after 30 days without a decision.', r.id)
   await commit(env, null, [{ row: next(r, { ...r.payload, status: 'expired' as const }), previous: r }, { row: told }], { audits: [{ action: 'access.expired', object: r.payload.item, detail: { request: r.id } }] })
   await deliver(env, null, [told])
  } catch (e) { if (!String((e as Error)?.message).includes('CHECK constraint failed')) throw e }
 }
}
