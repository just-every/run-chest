import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { id, insist, now } from '../model'
import { ownerPredicate } from '../store'
import { assertion, ScimError, sql, transact, type Predicate, type Sql } from './scim-common'
import { load, saveResource, type Resource } from './scim-resources'

type Authority = { predicate: Predicate; actor: string }
type Review = { id: string; resource_id: string; revision: string; data: string; status: string; created_at: string; decided_at: string|null }
type Proposal = { before: { name: string; members: string[] }; removed: string[]; added: string[]; requested: any; deleted: boolean; authority: Authority; effectiveRevision: string }
// Safety revocation is immediate and affects only removed members. The desired name/additions/deletion remain
// pending until the owner sees the complete before/after change. Decline never restores a revoked membership.
export async function reviewGroupChange(env: Bindings, auth: Authority, previous: Resource, input: any, desired: { name: string; members: string[] }, deleted: boolean): Promise<void> {
 const pending = await env.DB.prepare("SELECT * FROM chest_sso_group_reviews WHERE resource_id=? AND status='pending'").bind(previous.id).first<Review>()
 const removed: string[] = previous.record.members.filter((email: string) => !desired.members.includes(email))
 if (!removed.length && !pending && !deleted) return
 const requested = { displayName: desired.name, active: input.active ?? true, ...(input.externalId ? { externalId: String(input.externalId).trim() } : {}), members: (input.members ?? []).map((m: any) => ({ value: m.value })).sort((a: {value:string}, b: {value:string}) => a.value.localeCompare(b.value)) }
 if (pending) {
  const saved: Proposal = JSON.parse(pending.data)
  if (JSON.stringify(saved.requested) === JSON.stringify(requested) && saved.deleted === deleted && saved.effectiveRevision === previous.record_revision) throw new ScimError(409, 'This group change awaits owner review in People & settings. Removed members already have no group access.')
 }
 const revision = id(), key = id(), effective = { ...previous.record, members: previous.record.members.filter((email: string) => desired.members.includes(email)) }
 const earlier: Proposal|undefined = pending ? JSON.parse(pending.data) : undefined
 const before = earlier?.before ?? { name: previous.record.name, members: previous.record.members as string[] }
 const proposal: Proposal = { before, removed: before.members.filter(email => !desired.members.includes(email)), added: desired.members.filter(email => !before.members.includes(email)), requested, deleted, authority: auth, effectiveRevision: revision }
 const statements: Sql[] = [
  assertion({ sql: 'EXISTS(SELECT 1 FROM chest_records WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM chest_scim_resources WHERE id=? AND revision=? AND deleted=0)', params: [previous.record_id, previous.record_revision, previous.id, previous.revision] }),
  ...(pending ? [assertion({ sql: "EXISTS(SELECT 1 FROM chest_sso_group_reviews WHERE id=? AND revision=? AND status='pending')", params: [pending.id, pending.revision] })] : []),
  sql("UPDATE chest_sso_group_reviews SET status='superseded',decided_at=? WHERE resource_id=? AND status='pending'", now(), previous.id),
  sql('UPDATE chest_records SET payload=?,revision=? WHERE id=?', JSON.stringify(effective), revision, previous.record_id),
  sql("INSERT INTO chest_sso_group_reviews(id,resource_id,revision,data,status,created_at) VALUES(?,?,?,?,'pending',?)", key, previous.id, id(), JSON.stringify(proposal), now()),
 ]
 await transact(env, auth.predicate, statements, 'scim.group.review', previous.id, auth.actor)
 throw new ScimError(409, 'This group change awaits owner review in People & settings. Removed members already have no group access.')
}
export async function groupReviewView(env: Bindings) {
 const rows = (await env.DB.prepare("SELECT * FROM chest_sso_group_reviews WHERE status='pending' OR id IN (SELECT id FROM chest_sso_group_reviews WHERE status!='pending' ORDER BY created_at DESC LIMIT 100) ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,created_at DESC").all<Review>()).results
 return rows.map(row => { const p: Proposal = JSON.parse(row.data); return { id: row.id, revision: row.revision, resource: row.resource_id, status: row.status, at: row.created_at, decidedAt: row.decided_at, before: p.before, removed: p.removed, added: p.added, name: p.requested.displayName, deleted: p.deleted } })
}
export async function decideGroupReview(env: Bindings, s: Session, input: any) {
 owner(s)
 const row = await env.DB.prepare("SELECT * FROM chest_sso_group_reviews WHERE id=? AND status='pending'").bind(String(input.id)).first<Review>()
 insist(row && row.revision === input.revision, 'lifecycle_review_changed', 409)
 insist(input.decision === 'apply' || input.decision === 'decline', 'invalid_decision')
 const p: Proposal = JSON.parse(row.data), previous = await load(env, 'Group', row.resource_id)
 insist(previous.record_revision === p.effectiveRevision, 'lifecycle_review_changed', 409)
 const actor = ownerPredicate(s), review: Predicate = { sql: "EXISTS(SELECT 1 FROM chest_sso_group_reviews WHERE id=? AND revision=? AND status='pending')", params: [row.id, row.revision] }
 const authority = { actor: s.operator.email, predicate: { sql: `(${actor.sql}) AND (${review.sql}) AND (${p.authority.predicate.sql})`, params: [...actor.params, ...review.params, ...p.authority.predicate.params] } }
 const finish = sql("UPDATE chest_sso_group_reviews SET status=?,decided_at=? WHERE id=? AND revision=? AND status='pending'", input.decision === 'apply' ? 'applied' : 'declined', now(), row.id, row.revision)
 if (input.decision === 'apply') {
  // The provider credential and exact review stay live through the same SQL batch as the confirmed membership.
  await saveResource(env, authority, 'Group', p.requested, previous, p.deleted, { reviewed: true, statements: [finish] })
 } else await transact(env, {sql:`(${actor.sql}) AND (${review.sql})`,params:[...actor.params,...review.params]}, [assertion({ sql: 'EXISTS(SELECT 1 FROM chest_records WHERE id=? AND revision=?)', params: [previous.record_id, previous.record_revision] }), finish], 'scim.group.review.decline', previous.id, s.operator.email)
 return { decided: true }
}
