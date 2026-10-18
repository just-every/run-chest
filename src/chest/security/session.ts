import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { requirement } from './policy'
export async function sessionSecurity(env:Bindings,s:Session,touch=true){
 const {policy,required,resistant}=await requirement(env,s),proof=await env.DB.prepare('SELECT * FROM chest_mfa_verified WHERE session_id=?').bind(s.id).first<{method:string;verified_at:number;last_seen:number}>(),at=Date.now()
 const began=s.createdAt,last=proof?.last_seen??s.createdAt
 if(at-began>=policy.sessionHours*3600000||at-last>=policy.idleMinutes*60000){await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(at,s.id).run();return {allowed:false,reason:'session_expired',required,resistant,policy}}
 const enrolled=!!await env.DB.prepare('SELECT id FROM chest_mfa_factors WHERE operator_id=? LIMIT 1').bind(s.operator.id).first()
 const needs=required||enrolled,idp=s.kind==='oidc'&&!resistant&&(!policy.requireIdpMfa||proof?.method==='idp'),qualified=proof&&proof.method!=='none'
 const finalAllowed=idp||!needs||!!qualified&&(!resistant||proof.method==='webauthn')
 if(finalAllowed&&touch)await env.DB.prepare("INSERT INTO chest_mfa_verified VALUES(?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET last_seen=excluded.last_seen").bind(s.id,proof?.method??'none',began,at).run()
 return {allowed:finalAllowed,reason:finalAllowed?'':resistant?'security_key_required':'mfa_required',required,resistant,policy}
}
export async function requireMfa(env:Bindings,s:Session){const state=await sessionSecurity(env,s);insist(state.allowed,state.reason,403)}
export async function stampMfa(env:Bindings,s:Session,method:string){const at=Date.now();await env.DB.prepare('INSERT INTO chest_mfa_verified VALUES(?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET method=excluded.method,verified_at=excluded.verified_at,last_seen=excluded.last_seen').bind(s.id,method,at,at).run();if(method!=='none')await env.DB.prepare('DELETE FROM chest_mfa_limits WHERE operator_id=?').bind(s.operator.id).run()}
