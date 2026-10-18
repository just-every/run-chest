import type { Bindings } from '../../auth.server'
import { AuthError } from '../../modules/operator-auth/index.mjs'
import { principalCanAdmin } from './roles'
// An invitation is not a durable escape from the issuer's group scope. Admission checks the live target scope.
export async function checkInvitationScope(env:Bindings,session:{id:string},operator:{id:string;email:string}){
 const invitation=await env.DB.prepare("SELECT issuer.email AS issuer FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id JOIN oa_operators issuer ON issuer.id=t.issuer_id WHERE s.id=? AND t.kind='invite'").bind(session.id).first<{issuer:string}>()
 if(!invitation||await principalCanAdmin(env,invitation.issuer,'user-management',operator.email)||await principalCanAdmin(env,invitation.issuer,'help-desk',operator.email))return
 await env.DB.batch([
 env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE id=? AND status='active'").bind(operator.id),
 env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=?').bind(Date.now(),operator.id),
 env.DB.prepare('UPDATE chest_device_credentials SET revoked_at=? WHERE email=?').bind(new Date().toISOString(),operator.email)])
 throw new AuthError('invitation_admin_scope_changed',403)
}
