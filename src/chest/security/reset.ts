import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { operatorMail } from '../../mail.server.mjs'
import { owner } from '../access'
import { insist,id,now } from '../model'
import { commit,fresh } from '../files/repo'
import { notice,deliver } from '../files/notify'
const digest=async(value:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('base64url')
export async function resetFactor(env:Bindings,s:Session,input:any){
 owner(s);insist(input.verified===true||input.verified==='true','identity_verification_required');const target=await env.DB.prepare("SELECT id,email FROM oa_operators WHERE email=? AND status='active'").bind(String(input.email).toLowerCase()).first<{id:string;email:string}>();insist(target,'person_not_found',404)
 const token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),until=Date.now()+86400000
 await commit(env,s,[],{audits:[{action:'security.mfa.reset.request',object:target.email,detail:{identityVerified:true}}],statements:[{sql:'DELETE FROM chest_mfa_resets WHERE operator_id=?',params:[target.id]},{sql:'INSERT INTO chest_mfa_resets VALUES(?,?,?,NULL)',params:[await digest(token),target.id,until]}]})
 const sender=operatorMail(env);insist(sender&&env.MAIL_FROM,'mail_not_configured',503);const url=`${env.AUTH_ORIGIN}/security?reset=${token}`
 const result=await sender.send({deliveryId:id(),from:env.MAIL_FROM,to:[target.email],subject:'Reset your Chest sign-in factors',text:`A help-desk administrator verified your identity and requested a sign-in factor reset.\n\nSign in by email, then open this single-use enrollment link within 24 hours:\n${url}\n\nIf you did not ask for this, contact your administrator.`,html:`<p>A help-desk administrator requested a sign-in factor reset. Sign in by email, then <a href="${url}">enroll again within 24 hours</a>. If you did not ask for this, contact your administrator.</p>`,headers:{'Auto-Submitted':'auto-generated'}})
 insist(result.status==='accepted'||result.status==='development','reset_mail_not_accepted',503)
 return {resetSent:true,expiresAt:new Date(until).toISOString()}
}
export async function consumeReset(env:Bindings,s:Session,token:string){
 const key=await digest(token)
 insist(await env.DB.prepare('SELECT 1 FROM chest_mfa_resets WHERE digest=? AND operator_id=? AND consumed_at IS NULL AND expires_at>?').bind(key,s.operator.id,Date.now()).first(),'reset_link_expired_or_used')
 await commit(env,s,[],{audits:[{action:'security.mfa.reset',object:s.operator.email}],statements:[
 {sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_mfa_resets WHERE digest=? AND operator_id=? AND consumed_at IS NULL AND expires_at>?) THEN 1 ELSE 0 END',params:[key,s.operator.id,Date.now()]},
 {sql:'UPDATE chest_mfa_resets SET consumed_at=? WHERE digest=?',params:[Date.now(),key]},
 {sql:'DELETE FROM chest_mfa_factors WHERE operator_id=?',params:[s.operator.id]},
 {sql:'DELETE FROM chest_mfa_recovery WHERE operator_id=?',params:[s.operator.id]},
 {sql:'DELETE FROM chest_mfa_verified WHERE session_id IN (SELECT id FROM oa_sessions WHERE operator_id=?)',params:[s.operator.id]},
 {sql:'DELETE FROM chest_mfa_challenges WHERE session_id IN (SELECT id FROM oa_sessions WHERE operator_id=?)',params:[s.operator.id]},
 {sql:'UPDATE oa_sessions SET revoked_at=? WHERE operator_id=? AND id<>?',params:[Date.now(),s.operator.id,s.id]},
 {sql:'UPDATE chest_device_credentials SET revoked_at=? WHERE email=?',params:[now(),s.operator.email]}]})
 const n=notice(s.operator.email,'security.mfa.reset',null,s.operator.email,'Your sign-in factors were reset. Other sessions and devices were revoked. Enroll a new factor before opening files.');await commit(env,s,[{row:n}]);await deliver(env,s,[n]);return {enroll:true}
}
