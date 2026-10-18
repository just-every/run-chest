import { administrativePersonAction } from '../administration/people'
import { requireAdmin } from '../administration/roles'
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
export async function offboard(env:Bindings,request:Request,s:Session,input:any){return administrativePersonAction(env,request,s,{...input,action:'offboard'})}
export async function sharingPolicy(env: Bindings, s: Session, input: any) {
 await requireAdmin(env,s,'sharing-security'); const max = input.maxGrantDays
 insist(max === null || (Number.isInteger(max) && max >= 1 && max <= 3650), 'invalid_policy')
 const old = await maybe<{ maxGrantDays: number | null }>(env, 'policy', 'policy:sharing'), payload = { maxGrantDays: max }
 await commit(env, s, [old ? { row: next(old, payload), previous: old } : { row: fresh('policy', payload, 'policy:sharing') }], { audits: [{ action: 'policy.sharing', object: 'policy:sharing', detail: { before: old?.payload ?? { maxGrantDays: null }, after: payload } }] })
 return payload
}
