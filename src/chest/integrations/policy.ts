import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, type Group, type Row } from '../model'
import { decode, list, sessionPredicate } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { requireAdmin, requireAdminGroup } from '../administration/roles'
import { actions, readActions, type Action, type AppPolicy, type Client, type Grant } from './model'
export async function policyState(env: Bindings) {return (await env.DB.prepare("SELECT * FROM chest_records WHERE kind IN ('integration-policy','group') ORDER BY id").all()).results.map(decode)}
export function policyReason(rows: Row[],email: string,client: string,scopes: Action[]) {
 const groups=rows.filter(r=>r.kind==='group'&&(r as Row<Group>).payload.members.includes(email)),rules=rows.filter(r=>r.kind==='integration-policy'&&(r.payload.scope==='organization'||groups.some(g=>g.id===r.payload.group))) as Row<AppPolicy>[]
 for(const r of rules){const p=r.payload,app=p.apps[client];if(p.mode==='none')return 'app_policy_authorization_disabled';if(app==='blocked')return 'app_policy_app_blocked';if(p.mode==='allowlist'&&!app)return 'app_policy_allowlist_only';if(app==='read_only'&&scopes.some(a=>!readActions.includes(a)))return 'app_policy_read_only'}
 return null
}
// Include absence and the exact group/policy set: inserting a new restrictive rule between authorization and
// publication invalidates the existing commit, just as changing an existing rule does.
export function policyPredicate(rows: Row[]) {return {sql:"(SELECT COUNT(*) FROM chest_records WHERE kind IN ('integration-policy','group'))=? AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE r.kind IN ('integration-policy','group') AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND r.revision=json_extract(j.value,'$.revision') AND r.payload=json_extract(j.value,'$.payload')))",params:[rows.length,JSON.stringify(rows.map(r=>({id:r.id,revision:r.revision,payload:JSON.stringify(r.payload)})))]}}
export function attach(s: Session,p: {sql:string;params:unknown[]}) {const current=sessionPredicate(s);(s as any).predicate={sql:`(${current.sql}) AND (${p.sql})`,params:[...current.params,...p.params]}}
export async function demandPolicy(env: Bindings,s: Session,client: string,scopes: Action[]) {const state=await policyState(env),reason=policyReason(state,s.operator.email,client,scopes);insist(!reason,reason??'app_policy_refused',403);attach(s,policyPredicate(state));return state}
export async function savePolicy(env: Bindings,s: Session,input: any) {
 const scope=input.scope??'organization';insist(scope==='organization'||scope==='group','invalid_app_policy_scope')
 if(scope==='group')await requireAdminGroup(env,s,'sharing-security',input.group);else await requireAdmin(env,s,'sharing-security')
 insist(['any','allowlist','none'].includes(input.mode),'invalid_app_policy_mode');const apps=input.apps??{};insist(apps&&typeof apps==='object'&&!Array.isArray(apps)&&Object.values(apps).every(v=>['trusted','read_only','blocked'].includes(String(v))),'invalid_app_disposition')
 for(const key of Object.keys(apps))insist(await maybe<Client>(env,'integration-client',key),'app_not_found',404)
 const id=scope==='organization'?'integration-policy:organization':`integration-policy:group:${input.group}`,previous=await maybe<AppPolicy>(env,'integration-policy',id),payload:AppPolicy={scope,...(scope==='group'?{group:input.group}:{}),mode:input.mode,apps,at:now(),by:s.operator.email},row=previous?next(previous,payload):fresh('integration-policy',payload,id)
 const state=await policyState(env);attach(s,policyPredicate(state));const after=[...state.filter(r=>r.id!==id),row],revocations=[]
 for(const grant of await list<Grant>(env,'integration-grant')){if(grant.payload.revokedAt||scope==='group'&&!state.some(r=>r.kind==='group'&&r.id===input.group&&r.payload.members.includes(grant.payload.user)))continue;const reason=policyReason(after,grant.payload.user,grant.payload.client,grant.payload.actions);if(reason)revocations.push({row:next(grant,{...grant.payload,revokedAt:now(),reason}),previous:grant})}
 await commit(env,s,[{row,previous:previous??undefined},...revocations],{audits:[{action:'integration.policy',object:id,detail:{before:previous?.payload??null,after:payload,revoked:revocations.map(r=>r.row.id)}}]});return row
}
export function scopeList(value: unknown): Action[] {const values=Array.isArray(value)?value:typeof value==='string'?value.split(/[\s,]+/):[];insist(values.length>0&&values.every(v=>actions.includes(v as Action)),'invalid_app_actions');return [...new Set(values)] as Action[]}
