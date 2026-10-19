import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, id, insist, now } from '../model'
import { ownerPredicate } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { seal, unseal } from './settings'
import { assertion, sql, type Sql } from './scim-common'

type Identity = { id: string; email: string; role: string; status: string; version: number }
type Stored = { id: string; kind: string; payload: string; revision: string }
type Authority = { identities: Identity[]; grants: Stored[] }
type Selection = { purpose: 'chest-offboarding'; email: string; to: string }
const configKey = (email: string) => `offboarding-successor:${email}`
const address = (value: unknown) => { insist(typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), 'invalid_email'); return value.trim().toLowerCase() }
const match = `(kind='space' AND json_extract(payload,'$.kind')='personal' AND json_extract(payload,'$.owner')=? )
 OR (kind='document' AND (json_extract(payload,'$.owner')=? OR json_extract(payload,'$.reviewer')=? OR EXISTS(SELECT 1 FROM json_each(payload,'$.versions') v WHERE json_extract(v.value,'$.reviewer')=? AND json_extract(v.value,'$.state')!='approved')))
 OR (kind='item' AND (json_extract(payload,'$.governance.reviewer')=? OR json_extract(payload,'$.filing.owner')=? OR EXISTS(SELECT 1 FROM json_each(payload,'$.versions') v WHERE json_extract(v.value,'$.review.reviewer')=? AND json_extract(v.value,'$.review.state')!='approved')))`
const matchParams = (email: string) => Array(7).fill(email)
async function authority(env: Bindings): Promise<Authority> {
 const [identities, grants] = await Promise.all([
  env.DB.prepare('SELECT id,email,role,status,version FROM oa_operators ORDER BY id').all<Identity>(),
  env.DB.prepare("SELECT * FROM chest_records WHERE kind='admin-grant' ORDER BY id").all<Stored>(),
 ])
 return { identities: identities.results, grants: grants.results }
}
// Exact sets catch inserted/replaced rows as well as changes to a row already read.
function recordSet(where: string, params: unknown[], rows: Stored[]): Sql {
 return assertion({ sql: `(SELECT COUNT(*) FROM chest_records WHERE ${where})=? AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE (${where}) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND r.kind=json_extract(j.value,'$.kind') AND r.payload=json_extract(j.value,'$.payload') AND r.revision=json_extract(j.value,'$.revision')))`, params: [...params, rows.length, ...params, JSON.stringify(rows)] })
}
function authorityGuards(state: Authority): Sql[] {
 return [assertion({ sql: `(SELECT COUNT(*) FROM oa_operators)=? AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE o.id=json_extract(j.value,'$.id') AND o.email=json_extract(j.value,'$.email') AND o.role=json_extract(j.value,'$.role') AND o.status=json_extract(j.value,'$.status') AND o.version=json_extract(j.value,'$.version')))`, params: [state.identities.length, JSON.stringify(state.identities)] }), recordSet("kind='admin-grant'", [], state.grants)]
}
function protectedTarget(state: Authority, email: string) {
 const target = state.identities.find(p => p.email === email)
 insist(target, 'person_not_found', 404)
 insist(target.role !== 'owner', 'offboarding_owner_protected', 409)
 const supers = new Set(state.grants.filter(g => JSON.parse(g.payload).super === true).map(g => JSON.parse(g.payload).email))
 if (supers.has(email)) insist(state.identities.some(p => p.email !== email && p.status === 'active' && (p.role === 'owner' || supers.has(p.email))), 'last_super_admin', 409)
 return target
}
async function configured(env: Bindings, email: string) {
 const row = await maybe<{ email: string; sealed: string }>(env, 'offboarding-successor', configKey(email))
 if (!row) return { row, selection: null }
 let selection: Selection
 try { selection = await unseal<Selection>(env, row.payload.sealed) }
 catch { throw new ChestError('offboarding_successor_reconfirmation_required', 409) }
 insist(selection.purpose === 'chest-offboarding' && selection.email === email && row.payload.email === email, 'offboarding_successor_reconfirmation_required', 409)
 return { row, selection }
}
function configGuard(row: Awaited<ReturnType<typeof configured>>['row'], email: string) {
 return row ? assertion({ sql: 'EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind=? AND payload=? AND revision=?)', params: [row.id, row.kind, JSON.stringify(row.payload), row.revision] }) : assertion({ sql: 'NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?)', params: [configKey(email)] })
}
async function transfer(env: Bindings, from: string, to: string, actor: string, state: Authority) {
 protectedTarget(state, from)
 insist(from !== to && state.identities.some(p => p.email === to && p.status === 'active'), 'offboarding_successor_unavailable', 409)
 const [found, receipt] = await Promise.all([
  env.DB.prepare(`SELECT * FROM chest_records WHERE ${match} ORDER BY id`).bind(...matchParams(from)).all<Stored>(),
  env.DB.prepare('SELECT * FROM chest_records WHERE id=?').bind(`offboarding:${from}`).first<Stored>(),
 ])
 insist(!receipt || receipt.kind === 'offboarding', 'offboarding_receipt_conflict', 409)
 const rows = found.results, at = now(), summary = { from, to, personalAreas: 0, documents: 0, items: 0, records: rows.length }
 const statements: Sql[] = [...authorityGuards(state), recordSet(`(${match})`, matchParams(from), rows), receipt ? recordSet('id=?', [receipt.id], [receipt]) : recordSet('id=?', [`offboarding:${from}`], [])]
 for (const row of rows) {
  const p = JSON.parse(row.payload)
  if (row.kind === 'space') { p.owner = to; p.formerOwner ??= from; p.name = `Files from ${from}`; summary.personalAreas++ }
  if (row.kind === 'document') {
   if (p.owner === from) p.owner = to
   if (p.reviewer === from) p.reviewer = to
   for (const version of p.versions ?? []) if (version.reviewer === from && version.state !== 'approved') version.reviewer = to
   summary.documents++
  }
  if (row.kind === 'item') {
   if (p.governance?.reviewer === from) p.governance.reviewer = to
   if (p.filing?.owner === from) p.filing.owner = to
   for (const version of p.versions ?? []) if (version.review?.reviewer === from && version.review.state !== 'approved') version.review.reviewer = to
   summary.items++
   statements.push(sql('INSERT INTO chest_changes(item,space,kind,at) VALUES(?,?,?,?)', row.id, p.space, 'offboarding', at))
  }
  // Only present custody and undecided assignments change. Version IDs, object hashes, actors,
  // review events, approved decisions, links, grants and original bytes remain untouched.
  statements.push(sql('UPDATE chest_records SET payload=?,revision=? WHERE id=?', JSON.stringify(p), id(), row.id))
 }
 const payload = JSON.stringify({ from, to, by: actor, at, summary })
 statements.push(receipt ? sql('UPDATE chest_records SET payload=?,revision=? WHERE id=?', payload, id(), receipt.id) : sql("INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,'offboarding',?,?)", `offboarding:${from}`, payload, id()))
 statements.push(sql('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)', id(), actor, 'organisation.offboarding.transfer', from, JSON.stringify(summary), at))
 return { statements, summary }
}
// These statements MUST precede the identity status update in the caller's atomic transaction.
// This helper neither publishes a transfer nor deactivates an identity on its own.
export async function planTransfer(env: Bindings, from: string, to: string, actor: string) {
 return transfer(env, address(from), address(to), actor, await authority(env))
}
export async function deprovisionTransfer(env: Bindings, email: string, actor: string): Promise<{ statements: Sql[]; summary: any }> {
 email = address(email)
 const [state, config] = await Promise.all([authority(env), configured(env, email)])
 const owner = state.identities.filter(p => p.role === 'owner' && p.status === 'active')
 insist(config.selection || owner.length === 1, 'offboarding_owner_unavailable', 409)
 const to = config.selection?.to ?? owner[0].email
 const plan = await transfer(env, email, to, actor, state)
 return { ...plan, statements: [configGuard(config.row, email), ...plan.statements] }
}
export async function saveOffboarding(env: Bindings, s: Session, input: any) {
 const owner = ownerPredicate(s)
 insist(await env.DB.prepare(`SELECT 1 WHERE (${owner.sql})`).bind(...owner.params).first(), 'owner_required', 403)
 const email = address(input.email), state = await authority(env)
 protectedTarget(state, email)
 const to = input.to === undefined || input.to === '' ? null : address(input.to)
 insist(to === null || to !== email && state.identities.some(p => p.email === to && p.status === 'active'), 'offboarding_successor_unavailable', 409)
 const previous = await maybe(env, 'offboarding-successor', configKey(email))
 const payload = to ? { email, sealed: await seal(env, { purpose: 'chest-offboarding', email, to }) } : null
 await commit(env, s, payload ? [{ row: previous ? next(previous, payload) : fresh('offboarding-successor', payload, configKey(email)), previous: previous ?? undefined }] : previous ? [{ row: previous, previous, remove: true }] : [], { preconditions: [assertion(owner), ...authorityGuards(state)], audits: [{ action: 'organisation.offboarding.successor', object: email, detail: { successor: to, policy: to ? 'named_successor' : 'current_installation_owner' } }] })
 return offboardingView(env)
}
export async function offboardingView(env: Bindings) {
 const [state, rows] = await Promise.all([authority(env), env.DB.prepare("SELECT * FROM chest_records WHERE kind='offboarding-successor' ORDER BY id").all<Stored>()])
 const successors: { email: string; to: string | null; needsConfirmation: boolean }[] = []
 for (const row of rows.results) {
  const payload = JSON.parse(row.payload)
  try { const selection = await unseal<Selection>(env, payload.sealed); insist(selection.purpose === 'chest-offboarding' && selection.email === payload.email && row.id === configKey(selection.email), 'invalid_successor'); successors.push({ ...selection, needsConfirmation: !state.identities.some(p => p.email === selection.to && p.status === 'active') }) }
  catch { successors.push({ email: payload.email, to: null, needsConfirmation: true }) }
 }
 return { defaultSuccessor: state.identities.find(p => p.role === 'owner' && p.status === 'active')?.email ?? null, people: state.identities.map(p => ({ email: p.email, status: p.status, owner: p.role === 'owner' })), successors }
}
