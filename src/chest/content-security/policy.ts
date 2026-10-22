import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, type Group } from '../model'
import { list } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { requireAdmin, requireAdminGroup } from '../administration/roles'

export type ActivityRule = { files: number; bytes: number; deletions: number; pause: boolean }
export type ContentPolicy = { enabled: boolean; sensitiveGroups: string[]; consentAt?: string }
export const defaults: ActivityRule = { files: 500, bytes: 5 * 1024 ** 3, deletions: 200, pause: false }
export const policyKey = 'content-security:policy'
export async function ownerOnly(env: Bindings, s: Session) {
 insist(await env.DB.prepare("SELECT 1 FROM oa_operators WHERE id=? AND email=? AND role='owner' AND status='active'").bind(s.operator.id,s.operator.email).first(), 'owner_required', 403)
 await requireAdmin(env,s,'sharing-security')
}
export async function policy(env: Bindings): Promise<ContentPolicy> { return (await maybe<ContentPolicy>(env,'content-policy',policyKey))?.payload ?? {enabled:false,sensitiveGroups:[]} }
export async function rules(env: Bindings, email: string) {
 const groups=(await list<Group>(env,'group')).filter(g=>g.payload.members.includes(email)), rows=await list<ActivityRule>(env,'activity-rule')
 return [{id:'organization',name:'Organization',...defaults,...rows.find(r=>r.id==='activity:organization')?.payload},...rows.filter(r=>groups.some(g=>r.id===`activity:${g.id}`)).map(r=>({id:r.id.slice(9),name:groups.find(g=>r.id===`activity:${g.id}`)!.payload.name,...r.payload}))]
}
export async function savePolicy(env: Bindings,s: Session,input:any) {
 await ownerOnly(env,s)
 const previous=await maybe<ContentPolicy>(env,'content-policy',policyKey), before=await policy(env)
 insist(typeof input.enabled==='boolean' && Array.isArray(input.sensitiveGroups) && input.sensitiveGroups.every((g:unknown)=>typeof g==='string'),'invalid_content_policy')
 const groups=await list<Group>(env,'group');insist(input.sensitiveGroups.every((g:string)=>groups.some(r=>r.id===g)),'invalid_groups')
 // Enabling transmits originals to the installation's own configured processor. It requires deliberate consent.
 insist(input.confirm===true,'explicit_content_policy_confirmation_required')
 if(input.enabled)insist(env.CONTENT_SCANNER_URL && env.CONTENT_SCANNER_TOKEN,'content_scanner_not_configured',503)
 const after:ContentPolicy={enabled:input.enabled,sensitiveGroups:[...new Set<string>(input.sensitiveGroups)],consentAt:new Date().toISOString()}
 const row=previous?next(previous,after):fresh('content-policy',after,policyKey)
 await commit(env,s,[{row,previous:previous??undefined}],{audits:[{action:'security.content.policy',object:policyKey,detail:{before,after}}]});return after
}
export async function saveRule(env:Bindings,s:Session,input:any) {
 const scope=input.scope??'organization'
 if(scope==='organization')await requireAdmin(env,s,'sharing-security');else await requireAdminGroup(env,s,'sharing-security',scope)
 const after:ActivityRule={files:Number(input.files),bytes:Number(input.bytes),deletions:Number(input.deletions),pause:input.pause}
 insist([after.files,after.bytes,after.deletions].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=Number.MAX_SAFE_INTEGER)&&typeof after.pause==='boolean','invalid_activity_rule')
 const key=`activity:${scope}`,previous=await maybe<ActivityRule>(env,'activity-rule',key),row=previous?next(previous,after):fresh('activity-rule',after,key)
 await commit(env,s,[{row,previous:previous??undefined}],{audits:[{action:'security.activity.policy',object:key,detail:{before:previous?.payload??defaults,after,windowMinutes:10}}]});return row
}
