import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { get, snapshot } from '../store'
import { commit, next } from '../files/repo'
import { context, demand, who } from '../files/access'
import { requireMfa } from '../security/session'
import { guardDownload } from '../upload-protection/guard'
import { attach, demandPolicy, policyPredicate, policyReason, policyState } from './policy'
import { hash, secret } from './secrets'
import type { Action, Budget, Client, Grant } from './model'
export type Token = { grant: string; expires: string; operatorVersion: number }
export type Authorized = { session: Session; grant: Row<Grant>; client: Row<Client>; credential: string; tokenId: string; request: Request }
export async function authorize(env: Bindings,request: Request): Promise<Authorized> {
 const token=/^Bearer (chest_oauth_[A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')??'');insist(token,'oauth_authentication_required',401)
 return credentialSession(env,request,`token:${await hash(token[1])}`)
}
export async function credentialSession(env: Bindings,request: Request,tokenId: string): Promise<Authorized> {
 const saved=await secret<Token>(env,tokenId);insist(saved&&Date.parse(saved.value.expires)>Date.now(),'oauth_token_expired',401)
 const grant=await get<Grant>(env,'integration-grant',saved.value.grant),client=await get<Client>(env,'integration-client',grant.payload.client),g=grant.payload
 insist(!g.revokedAt&&!client.payload.revokedAt,'oauth_grant_revoked',401);insist(Date.parse(g.expires)>Date.now(),'oauth_grant_expired',401)
 const operator=await env.DB.prepare("SELECT * FROM oa_operators WHERE id=? AND email=? AND status='active' AND version=?").bind(g.operator,g.user,saved.value.operatorVersion).first<any>();insist(operator&&operator.version===g.operatorVersion,'oauth_identity_changed',401)
 const state=await policyState(env),reason=policyReason(state,g.user,g.client,g.actions);insist(!reason,reason??'app_policy_refused',403)
 const session={agent:{id:client.id,sponsor:g.user,grant:grant.id},id:`integration:${grant.id}`,kind:'integration',operatorId:operator.id,operator:{id:operator.id,email:operator.email,displayName:operator.display_name,role:operator.role,status:'active',version:operator.version,createdAt:operator.created_at},createdAt:Date.parse(g.at),expiresAt:Date.parse(g.expires),predicate:{sql:"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND status='active' AND version=?) AND EXISTS(SELECT 1 FROM chest_integration_secrets WHERE id=? AND value=?)",params:[operator.id,operator.email,operator.version,tokenId,saved.sealed]}} as unknown as Session
 insist(!await env.DB.prepare('SELECT 1 FROM chest_activity_pauses WHERE subject=?').bind(tokenId).first(),'activity_token_paused',423)
 const liveCredential=(session as any).predicate;(session as any).predicate={sql:`(${liveCredential.sql}) AND NOT EXISTS(SELECT 1 FROM chest_activity_pauses WHERE subject=?)`,params:[...liveCredential.params,tokenId]}
 ;(session as any).contentToken=tokenId.replace(/^token:/,'')
 const authority={...grant.payload} as any;delete authority.used;delete authority.lastUse
 attach(session,{sql:"EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind='integration-grant' AND json_remove(payload,'$.used','$.lastUse')=?)",params:[grant.id,JSON.stringify(authority)]});attach(session,snapshot(client));attach(session,policyPredicate(state));await requireMfa(env,session)
 return {session,grant,client,credential:saved.sealed,tokenId,request}
}
export function action(auth: Authorized,scope: Action) {insist(auth.grant.payload.actions.includes(scope),'oauth_action_outside_grant',403)}
export async function resource(env: Bindings,auth: Authorized,key: string,scope: Action) {
 action(auth,scope);const ctx=await context(env,await who(env,auth.session),key);demand(scope==='webhook'?{...ctx,state:{...ctx.state,trash:null}}:ctx,'view');insist(ctx.chain.some(row=>auth.grant.payload.resources.includes(row.id)),'oauth_resource_outside_grant',403);if(scope==='download'){demand(ctx,'download');await guardDownload(env,auth.session,ctx.chain.at(-1)!)}return ctx
}
export async function live(env: Bindings,auth: Authorized,key?: string,scope?: Action) {const current=await credentialSession(env,auth.request,auth.tokenId);if(key&&scope)return resource(env,current,key,scope);if(scope)action(current,scope);return current}
export function spend(auth: Authorized,delta: Partial<Budget>) {
 const g=auth.grant,used={...g.payload.used};for(const key of ['requests','mutations','bytes'] as const){used[key]+=(delta[key]??0);insist(Number.isSafeInteger(used[key])&&(g.payload.budget[key]===null||used[key]<=g.payload.budget[key]!),`oauth_${key}_budget_exhausted`,429)}
 return {row:next(g,{...g.payload,used,lastUse:now()}),previous:g}
}
export async function requestBudget(env: Bindings,auth: Authorized) {await commit(env,auth.session,[spend(auth,{requests:1})],{audits:[{action:'integration.call',object:auth.grant.id,detail:{client:auth.client.id}}]});return credentialSession(env,auth.request,auth.tokenId)}
export async function revokeGrant(env: Bindings,s: Session,id: string) {const row=await get<Grant>(env,'integration-grant',id);if(row.payload.user!==s.operator.email){const {requireAdmin}=await import('../administration/roles');await requireAdmin(env,s,'sharing-security',row.payload.user)};if(!row.payload.revokedAt)await commit(env,s,[{row:next(row,{...row.payload,revokedAt:now(),reason:'revoked_by_user_or_admin'}),previous:row}],{audits:[{action:'integration.grant.revoke',object:id,detail:{client:row.payload.client}}]});return {revoked:id}}
