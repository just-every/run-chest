import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { allowed, context, demand, everything, who, type Ctx, type Who } from '../files/access'
import { commit, fresh, maybe, next } from '../files/repo'
import { get, list, ownerPredicate } from '../store'
import { insist, now, type Row } from '../model'
import { current, fileBrief, stateId, type DuplicateState, type Merge } from './duplicate-model'
import { evidence, match } from './duplicate-match'
import { mergeBrief, visibleContext } from './duplicate-view'
export { hiddenMerged, mergeView } from './duplicate-view'

// Grant rows and the actual granting links are fenced alongside both file snapshots. Expiring grants are checked
// at SQL execution time, and owner authority is checked against the live operator rather than the session copy.
function guards(s: Session, w: Who, contexts: Ctx[]) {
 const owner = ownerPredicate(s), expiries = new Set<string>()
 for (const c of contexts) for (const grant of [...c.space.payload.members, ...c.chain.flatMap(n => n.payload.grants)]) {
  if (w.principals.includes(grant.principal) && grant.expires && Date.parse(grant.expires) > Date.now()) expiries.add(grant.expires)
 }
 return [
  { sql: `INSERT INTO chest_assert(ok) SELECT CASE WHEN (${owner.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=?) THEN 1 ELSE 0 END`, params: [...owner.params, s.operator.id, s.operator.email] },
  ...[...expiries].map(expiry => ({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN julianday(?)>julianday('now') THEN 1 ELSE 0 END", params: [expiry] })),
 ]
}
const fences = (contexts: Ctx[]) => contexts.flatMap(c => [...c.fences, ...c.links])
async function pair(env: Bindings, s: Session, w: Who, keepId: string, duplicateId: string) {
 insist(s.operator.role === 'owner', 'owner_approval_required', 403)
 const keep = await context(env, w, keepId), duplicate = await context(env, w, duplicateId)
 demand(keep, 'manage'); demand(duplicate, 'manage')
 const a = keep.chain.at(-1)!, b = duplicate.chain.at(-1)!
 insist(a.payload.type === 'file' && b.payload.type === 'file', 'not_a_file')
 const [as, bs] = await Promise.all([maybe<DuplicateState>(env, 'duplicate_state', stateId(a.id)), maybe<DuplicateState>(env, 'duplicate_state', stateId(b.id))])
 return { keep, duplicate, a, b, as, bs }
}
const membership = (item: string, previous: Row<DuplicateState> | null, payload: DuplicateState) => ({ row: previous ? next(previous, payload) : fresh('duplicate_state', payload, stateId(item)), previous: previous ?? undefined })
async function proposals(env: Bindings, s: Session, w: Who, url: URL) {
 const all = await everything(env, w), space = url.searchParams.get('space'), folder = url.searchParams.get('parent')
 const states = new Map((await list<DuplicateState>(env, 'duplicate_state')).map(r => [r.payload.item, r.payload]))
 const files = [...all.values()].filter(e => e.row.payload.type === 'file' && !e.state.trash && allowed(e, 'view') && !states.get(e.row.id)?.duplicateMerge && (!space || e.row.payload.space === space) && (!folder || e.row.payload.parent === folder))
 files.sort((a, b) => a.row.payload.createdAt.localeCompare(b.row.payload.createdAt) || a.row.id.localeCompare(b.row.id))
 const candidates = []
 for (const entry of files) { const version = current(entry.row.payload); if (version) candidates.push({ entry, evidence: await evidence(env, version) }) }
 const found = []
 for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
  let a = candidates[i], b = candidates[j]
  // Prefer an existing canonical file so another duplicate can join it without nesting alias chains.
  if (!states.get(a.entry.row.id)?.duplicateMerges?.length && states.get(b.entry.row.id)?.duplicateMerges?.length) [a, b] = [b, a]
  const similarity = match(a.evidence, b.evidence)
  if (!similarity) continue
  found.push({ keep: {...fileBrief(a.entry.row),spaceName:a.entry.space.payload.name}, duplicate: {...fileBrief(b.entry.row),spaceName:b.entry.space.payload.name}, ...similarity,
   canMerge: s.operator.role === 'owner' && allowed(a.entry, 'manage') && allowed(b.entry, 'manage') && !states.get(b.entry.row.id)?.duplicateMerges?.length,
   evidence: { currentVersionsOnly: true, differentBytes: a.evidence.version.checksum !== b.evidence.version.checksum, originalLinksRetained: true, approvalsCombined: false } })
 }
 const merges = []
 for (const row of await list<Merge>(env, 'duplicate_merge')) {
  const keep = await visibleContext(env, w, row.payload.keep), duplicate = await visibleContext(env, w, row.payload.duplicate)
  if (keep && duplicate) merges.push(mergeBrief(s, row, keep, duplicate))
 }
 merges.sort((a, b) => b.at.localeCompare(a.at))
 return { proposals: found, merges, counts: { proposals: found.length, merges: merges.length }, scope: 'accessible ordinary files' }
}
async function merge(env: Bindings, s: Session, w: Who, input: any) {
 insist(typeof input?.keep === 'string' && typeof input?.duplicate === 'string' && input.keep !== input.duplicate, 'invalid_duplicate_pair')
 const { a, b, keep, duplicate, as, bs } = await pair(env, s, w, input.keep, input.duplicate)
 insist(!as?.payload.duplicateMerge && !bs?.payload.duplicateMerge && !bs?.payload.duplicateMerges?.length, 'already_merged', 409)
 const av = current(a.payload), bv = current(b.payload); insist(av && bv, 'version_not_found', 404)
 const ae = await evidence(env, av), be = await evidence(env, bv), comparison = match(ae, be)
 insist(comparison, 'duplicate_content_changed', 409)
 const at = now(), receipt = fresh<Merge>('duplicate_merge', { keep: a.id, duplicate: b.id, keepVersion: av.id, duplicateVersion: bv.id, ...comparison, at, by: s.operator.email, undone: null })
 const canonical = membership(a.id, as, { item: a.id, duplicateMerges: [...as?.payload.duplicateMerges ?? [], receipt.id] })
 const alias = membership(b.id, bs, { item: b.id, duplicateMerge: { keep: a.id, merge: receipt.id } })
 await commit(env, s, [canonical, alias, { row: receipt }], {
  fences: [...fences([keep, duplicate]), ...[ae.text.row, be.text.row].filter((r): r is NonNullable<typeof r> => !!r)], statements: guards(s, w, [keep, duplicate]),
  changes: [a, b].map(r => ({ item: r.id, space: r.payload.space, kind: 'duplicate.merge' })),
  audits: [{ action: 'duplicate.merge', object: a.id, detail: { merge: receipt.id, duplicate: b.id, ...comparison, keepVersion: av.id, duplicateVersion: bv.id } }],
 })
 return mergeBrief(s, receipt, keep, duplicate)
}
async function undo(env: Bindings, s: Session, w: Who, key: string) {
 const receipt = await get<Merge>(env, 'duplicate_merge', key), p = receipt.payload
 const { a, b, keep, duplicate, as, bs } = await pair(env, s, w, p.keep, p.duplicate)
 insist(!p.undone, 'merge_already_undone', 409)
 insist(bs?.payload.duplicateMerge?.merge === key && as?.payload.duplicateMerges?.includes(key), 'merge_state_changed', 409)
 const source: DuplicateState = { item: b.id }
 const canonical: DuplicateState = { item: a.id, duplicateMerges: as!.payload.duplicateMerges!.filter(id => id !== key) }; if (!canonical.duplicateMerges!.length) delete canonical.duplicateMerges
 const done = next(receipt, { ...p, undone: { at: now(), by: s.operator.email } })
 await commit(env, s, [membership(a.id, as, canonical), membership(b.id, bs, source), { row: done, previous: receipt }], {
  fences: fences([keep, duplicate]), statements: guards(s, w, [keep, duplicate]),
  changes: [a, b].map(r => ({ item: r.id, space: r.payload.space, kind: 'duplicate.undo' })),
  audits: [{ action: 'duplicate.undo', object: a.id, detail: { merge: key, duplicate: b.id } }],
 })
 return mergeBrief(s, done, keep, duplicate)
}
export async function duplicatesExecute(env: Bindings, s: Session, method: string, parts: string[], input: any, url: URL): Promise<unknown> {
 if (parts[0] !== 'filing' || parts[1] !== 'duplicates') return undefined
 const w = await who(env, s)
 if (method === 'GET' && parts.length === 2) return proposals(env, s, w, url)
 if (method === 'POST' && parts[2] === 'merge' && parts.length === 3) return merge(env, s, w, input)
 if (method === 'POST' && parts[2] && parts[3] === 'undo' && parts.length === 4) return undo(env, s, w, parts[2])
 return undefined
}
