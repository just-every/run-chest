import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, type Row } from '../model'
import { get, snapshot } from '../store'
import { commit, fresh, next } from '../files/repo'
import { context, demand, who } from '../files/access'
import { budget, resources } from './clients'
import { attach, demandPolicy, scopeList } from './policy'
import { equal, hash, insertSecret, random, seal, secret } from './secrets'
import type { Client, Grant, Intent } from './model'
export async function beginConsent(env: Bindings,s: Session,url: URL) {
 const q=url.searchParams,client=await get<Client>(env,'integration-client',q.get('client_id')??'');insist(!client.payload.revokedAt,'oauth_client_revoked',403)
 const redirect=q.get('redirect_uri')??'';insist(client.payload.redirects.includes(redirect),'oauth_redirect_mismatch',400);insist(q.get('response_type')==='code'&&q.get('code_challenge_method')==='S256','oauth_pkce_required')
 const challenge=q.get('code_challenge')??'';insist(/^[A-Za-z0-9_-]{43}$/.test(challenge),'oauth_invalid_challenge');const state=q.get('state')??'';insist(state.length>=16&&state.length<=512,'oauth_state_required')
 const scopes=scopeList(q.get('scope')),roots=resources(q.getAll('resource'));insist(scopes.every(a=>client.payload.actions.includes(a)),'oauth_action_expansion',403)
 await demandPolicy(env,s,client.id,scopes);const fences: Row[]=[client],named=[];for(const root of roots){const c=await context(env,await who(env,s),root);demand(c,'view');fences.push(...c.fences);named.push({id:root,name:c.chain.at(-1)!.payload.name})}
 const pickerOrigin=q.get('picker_origin')??undefined;insist(!pickerOrigin||client.payload.pickerOrigins.includes(pickerOrigin),'oauth_picker_origin_mismatch',403)
 const row=fresh<Intent>('integration-intent',{client:client.id,user:s.operator.email,redirect,challenge,state,resources:roots,actions:scopes,budget:budget({requests:q.get('budget_requests')??undefined,mutations:q.get('budget_mutations')??undefined,bytes:q.get('budget_bytes')??undefined}),expires:new Date(Date.now()+10*60000).toISOString(),...(pickerOrigin?{pickerOrigin}:{})})
 await commit(env,s,[{row}],{fences,audits:[{action:'integration.consent.view',object:client.id,detail:{actions:scopes,resources:roots}}]});return {intent:row,client,named}
}
export async function consent(env: Bindings,s: Session,input: any) {
 const row=await get<Intent>(env,'integration-intent',input.intent),i=row.payload;insist(i.user===s.operator.email&&!i.used&&Date.parse(i.expires)>Date.now(),'oauth_consent_expired',403)
 const client=await get<Client>(env,'integration-client',i.client);insist(!client.payload.revokedAt&&client.payload.redirects.includes(i.redirect),'oauth_client_revoked',403);await demandPolicy(env,s,client.id,i.actions)
 const result=new URL(i.redirect);result.searchParams.set('state',i.state)
 if(input.decision!=='allow'){await commit(env,s,[{row:next(row,{...i,used:now()}),previous:row}],{fences:[client]});result.searchParams.set('error','access_denied');return result.href}
 const fences:Row[]=[client];for(const key of i.resources){const c=await context(env,await who(env,s),key);demand(c,'view');fences.push(...c.fences)}
 const grant=fresh<Grant>('integration-grant',{client:client.id,user:s.operator.email,operator:s.operator.id,operatorVersion:s.operator.version,resources:i.resources,actions:i.actions,budget:i.budget,used:{requests:0,mutations:0,bytes:0},at:now(),expires:new Date(Date.now()+24*3600000).toISOString()}),code=random('chest_code_'),id=`code:${await hash(code)}`
 await commit(env,s,[{row:grant},{row:next(row,{...i,used:now()}),previous:row}],{fences,audits:[{action:'integration.grant.authorize',object:grant.id,detail:{client:client.id,resources:i.resources,actions:i.actions,budget:i.budget}}],statements:[insertSecret(id,await seal(env,id,{grant:grant.id,client:client.id,redirect:i.redirect,challenge:i.challenge,expires:new Date(Date.now()+5*60000).toISOString()}),s.operator.email),{sql:'INSERT INTO chest_mfa_verified(session_id,method,verified_at,last_seen) SELECT ?,method,?,? FROM chest_mfa_verified WHERE session_id=?',params:[`integration:${grant.id}`,Date.now(),Date.now(),s.id]}]});result.searchParams.set('code',code);return result.href
}
export async function exchange(env: Bindings,input: any,origin: string|null) {
 insist(input.grant_type==='authorization_code','oauth_grant_type_not_supported');const client=await get<Client>(env,'integration-client',String(input.client_id??''));insist(!client.payload.revokedAt,'oauth_client_revoked',401)
 insist(!origin||client.payload.redirects.some(u=>new URL(u).origin===origin)||client.payload.pickerOrigins.includes(origin),'oauth_origin_mismatch',403)
 if(client.payload.confidential){const stored=await secret<{hash:string}>(env,`client:${client.id}`);insist(stored&&equal(stored.value.hash,await hash(String(input.client_secret??''))),'oauth_client_authentication_failed',401)}
 const code=String(input.code??''),verifier=String(input.code_verifier??'');insist(/^chest_code_[A-Za-z0-9_-]{43}$/.test(code)&&/^[A-Za-z0-9._~-]{43,128}$/.test(verifier),'oauth_invalid_code',400)
 const id=`code:${await hash(code)}`,stored=await secret<{grant:string;client:string;redirect:string;challenge:string;expires:string}>(env,id);insist(stored&&stored.value.client===client.id&&stored.value.redirect===input.redirect_uri&&Date.parse(stored.value.expires)>Date.now(),'oauth_invalid_code',400)
 const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');insist(equal(stored.value.challenge,challenge),'oauth_pkce_mismatch',400)
 const grant=await get<Grant>(env,'integration-grant',stored.value.grant);insist(!grant.payload.revokedAt,'oauth_grant_revoked',401)
 const operator=await env.DB.prepare("SELECT * FROM oa_operators WHERE id=? AND status='active' AND version=?").bind(grant.payload.operator,grant.payload.operatorVersion).first<any>();insist(operator,'oauth_identity_changed',401)
 const s={id:`integration-exchange:${grant.id}`,operator:{id:operator.id,email:operator.email,version:operator.version,role:operator.role},predicate:{sql:"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?) AND EXISTS(SELECT 1 FROM chest_integration_secrets WHERE id=? AND value=?)",params:[operator.id,operator.version,id,stored.sealed]}} as unknown as Session
 await demandPolicy(env,s,client.id,grant.payload.actions);const token=random('chest_oauth_'),tokenId=`token:${await hash(token)}`
 await commit(env,s,[],{fences:[grant,client],audits:[{action:'integration.token.issue',object:grant.id,detail:{client:client.id}}],statements:[{sql:'DELETE FROM chest_integration_secrets WHERE id=?',params:[id]},insertSecret(tokenId,await seal(env,tokenId,{grant:grant.id,expires:grant.payload.expires,operatorVersion:grant.payload.operatorVersion}),operator.email)]})
 return {access_token:token,token_type:'Bearer',expires_in:Math.max(0,Math.floor((Date.parse(grant.payload.expires)-Date.now())/1000)),scope:grant.payload.actions.join(' '),grant:grant.id}
}
