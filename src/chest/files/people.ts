import { operatorAuth, type Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { validPerson } from '../access'
import { syncPeople } from '../identity'
import { insist, now } from '../model'
import { commit, fresh, maybe, next, type Op } from './repo'
import { isAdmin } from './access'
import { personalId, type Space } from './model'
// Offboarding (SPACE-001): an admin deactivates a departing person and names who receives their personal area. Team
// content never belonged to the person; their personal files move as a whole, keeping IDs, versions, grants and links.
// The successor also receives access requests for those files (SHARE-004).
export async function offboard(env: Bindings, request: Request, s: Session, input: any) {
 insist(isAdmin(s), 'admin_required', 403)
 const from = await validPerson(env, input.email), to = await validPerson(env, input.to); insist(from !== to && from !== s.operator.email, 'invalid_offboarding')
 const auth = operatorAuth(env), op = (await auth.listOperators(request)).find(o => o.email === from); insist(op, 'person_not_found', 404)
 await auth.setOperatorStatus(request, op.id, 'inactive')
 const area = await maybe<Space>(env, 'space', personalId(from)), old = await maybe(env, 'offboarding', `offboarding:${from}`), at = now(), record = { from, to, by: s.operator.email, at }, ops: Op[] = []
 if (area) ops.push({ row: next(area, { ...area.payload, owner: to, formerOwner: from, name: `Files from ${from}` }), previous: area })
 ops.push(old ? { row: next(old, record), previous: old } : { row: fresh('offboarding', record, `offboarding:${from}`) })
 await commit(env, s, ops, { changes: area ? [{ item: area.id, space: area.id, kind: 'access' }] : [], audits: [{ action: 'person.offboard', object: from, detail: { to, personalArea: !!area } }] })
 await syncPeople(env, request, s)
 return { offboarded: from, successor: to }
}
export async function sharingPolicy(env: Bindings, s: Session, input: any) {
 insist(isAdmin(s), 'admin_required', 403); const max = input.maxGrantDays
 insist(max === null || (Number.isInteger(max) && max >= 1 && max <= 3650), 'invalid_policy')
 const old = await maybe<{ maxGrantDays: number | null }>(env, 'policy', 'policy:sharing'), payload = { maxGrantDays: max }
 await commit(env, s, [old ? { row: next(old, payload), previous: old } : { row: fresh('policy', payload, 'policy:sharing') }], { audits: [{ action: 'policy.sharing', object: 'policy:sharing', detail: { before: old?.payload ?? { maxGrantDays: null }, after: payload } }] })
 return payload
}
