import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, text, type Row } from '../model'
import { get, list, sessionPredicate } from '../store'
import { commit, fresh, next, type Op } from '../files/repo'
import { notice, deliver } from '../files/notify'
import type { AdminGrant } from './roles'

type Identity = { id: string; email: string; version: number; role: string; status: string }
type Predicate = { sql: string; params: unknown[] }
type Offer = { state: 'pending' | 'accepted' | 'declined' | 'cancelled'; by: string; to: string; offeredAt: string; sessionCreatedAt: number; source: Identity; target: Identity; keepGrants: string[]; decidedAt?: string }
const kind = 'installation-owner-offer', freshness = 600000
async function identities(env: Bindings) {
 return (await env.DB.prepare('SELECT id,email,version,role,status FROM oa_operators ORDER BY email').all<Identity>()).results
}
const identityGuard = (i: Identity): Predicate => ({ sql: 'EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND role=? AND status=?)', params: [i.id, i.email, i.version, i.role, i.status] })
function guarded(s: Session, guards: Predicate[]): Session {
 const parts = [sessionPredicate(s), ...guards]
 return Object.assign({ ...s }, { predicate: { sql: parts.map(p => `(${p.sql})`).join(' AND '), params: parts.flatMap(p => p.params) } })
}
async function verify(env: Bindings, s: Session) {
 const p = sessionPredicate(s)
 insist(await env.DB.prepare(`SELECT 1 WHERE (${p.sql})`).bind(...p.params).first(), 'owner_offer_stale', 409)
}
function freshSignIn(s: Session, after?: string): Predicate {
 const at = Date.now(), afterAt = after === undefined ? -1 : Date.parse(after)
 insist(['native', 'oidc', 'password'].includes(s.kind) && Number.isFinite(s.createdAt) && s.createdAt <= at && s.createdAt >= at - freshness && s.createdAt > afterAt, 'fresh_sign_in_required', 403)
 return { sql: "EXISTS(SELECT 1 FROM oa_sessions WHERE id=? AND operator_id=? AND created_at=? AND created_at BETWEEN ? AND ? AND created_at>? AND kind IN ('native','oidc','password'))", params: [s.id, s.operator.id, s.createdAt, at - freshness, at, afterAt] }
}
// The entire grant set is fenced, including absence: a concurrent reassignment cannot survive an offer's decision.
function grantsGuard(rows: Row<AdminGrant>[]): Predicate {
 return { sql: "(SELECT COUNT(*) FROM chest_records WHERE kind='admin-grant')=? AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE r.kind='admin-grant' AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND r.revision=json_extract(j.value,'$.revision') AND r.payload=json_extract(j.value,'$.payload')))", params: [rows.length, JSON.stringify(rows.map(r => ({ id: r.id, revision: r.revision, payload: JSON.stringify(r.payload) })))] }
}
const singleOwner = (source: Identity): Predicate => ({ sql: "(SELECT COUNT(*) FROM oa_operators WHERE role='owner' AND status='active')=1 AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')", params: [source.id] })
function activeSuper(target: Identity | undefined, grants: Row<AdminGrant>[]): asserts target is Identity {
 insist(target?.status === 'active' && target.role !== 'owner' && grants.some(g => g.payload.email === target.email && g.payload.super === true), 'active_super_admin_required', 409)
}
async function publish(env: Bindings, s: Session, ops: Op[], options: NonNullable<Parameters<typeof commit>[3]>) {
 try { await commit(env, s, ops, options) }
 catch (error) { if (String(error).includes('CHECK constraint failed')) throw new ChestError('owner_offer_stale', 409); throw error }
}
const notifications = (p: Offer, from: string, message: string) => [p.by, p.to].map(to => notice(to, 'installation.owner', null, from, `${message}\n\nReview installation ownership: /app/administration`))
function actor(rows: Identity[], s: Session) {
 return rows.find(o => o.id === s.operator.id && o.email === s.operator.email && o.version === s.operator.version && o.status === 'active')
}
export async function offerOwner(env: Bindings, s: Session, input: any) {
 const [people, grants] = await Promise.all([identities(env), list<AdminGrant>(env, 'admin-grant')])
 const source = actor(people, s)
 insist(source?.role === 'owner', 'owner_required', 403)
 const proof = freshSignIn(s), email = text(input.email, 'email', 254).toLowerCase()
 const target = people.find(o => o.email === email && o.id !== source.id)
 activeSuper(target, grants)
 const keep = input.keepGrants ?? []
 insist(Array.isArray(keep) && keep.every((id: unknown) => typeof id === 'string' && grants.some(g => g.id === id && g.payload.email === source.email)), 'invalid_keep_grants')
 const p: Offer = { state: 'pending', by: source.email, to: target.email, offeredAt: now(), sessionCreatedAt: s.createdAt, source, target, keepGrants: [...new Set<string>(keep)] }
 const row = fresh(kind, p), notices = notifications(p, source.email, `${source.email} offered installation ownership to ${target.email}. Sign in again after this offer to accept. The former owner retains only the explicitly selected administrative grants.`)
 const authorized = guarded(s, [proof, identityGuard(source), identityGuard(target), singleOwner(source), grantsGuard(grants)])
 await verify(env, authorized)
 await publish(env, authorized, [{ row }, ...notices.map(row => ({ row }))], { audits: [{ action: 'admin.owner.offer', object: row.id, detail: { by: p.by, to: p.to, keepGrants: p.keepGrants } }] })
 await deliver(env, s, notices)
 return row
}
async function participant(env: Bindings, s: Session, id: string) {
 const row = await get<Offer>(env, kind, id)
 insist(row.payload.by === s.operator.email || row.payload.to === s.operator.email, 'not_found', 404)
 return row
}
async function close(env: Bindings, s: Session, row: Row<Offer>, state: 'declined' | 'cancelled') {
 insist(row.payload.state === 'pending', 'owner_offer_closed', 409)
 const p = { ...row.payload, state, decidedAt: now() }, updated = next(row, p), notices = notifications(p, s.operator.email, `The installation ownership offer was ${state}.`)
 await publish(env, s, [{ row: updated, previous: row }, ...notices.map(row => ({ row }))], { audits: [{ action: `admin.owner.${state}`, object: row.id, detail: { by: p.by, to: p.to } }] })
 await deliver(env, s, notices)
 return updated
}
export async function cancelOwner(env: Bindings, s: Session, id: string) {
 const row = await participant(env, s, id), people = await identities(env), source = actor(people, s)
 insist(row.payload.by === s.operator.email && source?.role === 'owner', 'owner_required', 403)
 return close(env, guarded(s, [identityGuard(source), singleOwner(source)]), row, 'cancelled')
}
export async function acceptOwner(env: Bindings, s: Session, id: string, input: any) {
 const row = await participant(env, s, id), p = row.payload
 insist(p.to === s.operator.email, 'owner_offer_recipient_required', 403)
 insist(p.state === 'pending', 'owner_offer_closed', 409)
 insist(input.decision === 'accept' || input.decision === 'decline', 'invalid_decision')
 if (input.decision === 'decline') return close(env, s, row, 'declined')
 const proof = freshSignIn(s, p.offeredAt)
 const [people, grants] = await Promise.all([identities(env), list<AdminGrant>(env, 'admin-grant')])
 const target = actor(people, s)
 activeSuper(target, grants)
 insist(target.id === p.target.id && target.version === p.target.version, 'owner_offer_stale', 409)
 insist(people.some(o => o.id === p.source.id && o.email === p.by && o.role === 'owner' && o.status === 'active' && o.version === p.source.version), 'owner_offer_stale', 409)
 insist(p.keepGrants.every(id => grants.some(g => g.id === id && g.payload.email === p.by)), 'owner_offer_stale', 409)
 const authorized = guarded(s, [proof, identityGuard(p.source), identityGuard(p.target), singleOwner(p.source), grantsGuard(grants)])
 await verify(env, authorized)
 const removed = grants.filter(g => g.payload.email === p.by && !p.keepGrants.includes(g.id))
 const updated = next(row, { ...p, state: 'accepted' as const, decidedAt: now() }), notices = notifications(updated.payload, p.to, `${p.to} accepted installation ownership from ${p.by}. Both participants must sign in again.`)
 // Commit asserts the pending offer, identities, grants and fresh session before writing anything. Promote first
 // so OA's last-owner trigger holds; OA's role-version trigger invalidates both participants' old credentials.
 await publish(env, authorized, [{ row: updated, previous: row }, ...removed.map(row => ({ row, previous: row, remove: true })), ...notices.map(row => ({ row }))], {
  audits: [{ action: 'admin.owner.accept', object: id, detail: { by: p.by, to: p.to, keepGrants: p.keepGrants, removedGrants: removed.map(r => r.id) } }],
  statements: [
   { sql: "UPDATE oa_operators SET role='owner' WHERE id=? AND email=? AND version=? AND status='active' AND role=?", params: [p.target.id, p.to, p.target.version, p.target.role] },
   { sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND version=?) THEN 1 ELSE 0 END", params: [p.target.id, p.target.version + 1] },
   { sql: "UPDATE oa_operators SET role='member' WHERE id=? AND email=? AND version=? AND status='active' AND role='owner'", params: [p.source.id, p.by, p.source.version] },
   { sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='member' AND version=?) AND (SELECT COUNT(*) FROM oa_operators WHERE role='owner' AND status='active')=1 THEN 1 ELSE 0 END", params: [p.source.id, p.source.version + 1] },
   { sql: 'UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id IN (?,?)', params: [Date.now(), p.source.id, p.target.id] },
  ],
 })
 // Delivery updates only these committed notices; the accepting session is intentionally invalid now.
 await deliver(env, null, notices)
 return { offer: updated, signInAgain: true }
}
export async function ownerOffers(env: Bindings, s: Session) {
 const [rows, people, grants] = await Promise.all([list<Offer>(env, kind), identities(env), list<AdminGrant>(env, 'admin-grant')])
 const current = actor(people, s)
 insist(current, 'sign_in_required', 401)
 const authorized = guarded(s, [identityGuard(current), grantsGuard(grants)])
 const offers = rows.filter(r => r.payload.by === current.email || r.payload.to === current.email)
 const candidates = current.role === 'owner' ? people.filter(o => o.status === 'active' && o.id !== current.id && o.role !== 'owner' && grants.some(g => g.payload.email === o.email && g.payload.super === true)).map(o => ({ email: o.email })) : []
 await publish(env, authorized, [], { fences: offers, audits: [{ action: 'admin.owner.view', object: 'organization' }] })
 return { offers, candidates, grants: current.role === 'owner' ? grants.filter(g => g.payload.email === current.email) : [] }
}
