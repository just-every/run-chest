import { deprovisionAuthority } from '../organisation/revoke-authority'
import type { Bindings } from '../../auth.server'
import { authConfig } from '../../auth.server'
import { createOperatorAuth,type Session } from '../../modules/operator-auth/index.mjs'
import { personLine } from '../names'
import { namingInviter } from '../invitation-mail'
import { operatorMail } from '../../mail.server.mjs'
import { insist,now,type Group } from '../model'
import { list,sessionPredicate } from '../store'
import { commit,fresh,maybe,next,type Op } from '../files/repo'
import { deprovisionTransfer,planTransfer } from '../organisation/offboarding'
import { requireAdmin,canAdmin,guardAdminDeactivation,requireAdminGroup } from './roles'
// Identity administration deliberately does not elevate the actor's OA role or content ACL.
export async function administrativePeople(env:Bindings,s:Session){
 const people=(await env.DB.prepare('SELECT id,email,display_name AS name,status,role FROM oa_operators ORDER BY email').all<{id:string;email:string;name:string;status:string;role:string}>()).results,result=[]
 for(const p of people){const manage=await canAdmin(env,s,'user-management',p.email),helpdesk=await canAdmin(env,s,'help-desk',p.email);if(manage||helpdesk)result.push({...p,manage,helpdesk})}
 return result
}
export async function administrativePersonAction(env:Bindings,request:Request,s:Session,input:any){
 const email=String(input.email??'').trim().toLowerCase(),action=String(input.action)
 if(action==='invite'||action==='resend-invite'){
  const resend=action==='resend-invite',target=resend?await env.DB.prepare("SELECT display_name AS name FROM oa_operators WHERE email=? AND status='invited'").bind(email).first<{name:string}>():null
  if(resend){insist(target,'invitation_not_found',404);await requireAdmin(env,s,'help-desk',email)}
  else if(input.group)await requireAdminGroup(env,s,'user-management',String(input.group));else await requireAdmin(env,s,'user-management',email)
  const auth=createOperatorAuth({db:env.DB,config:authConfig(env),mailSender:namingInviter(operatorMail(env),personLine(s.operator.displayName,s.operator.email)),clientIp:r=>r.headers.get('CF-Connecting-IP')??'',rolePolicy:async({actor,action,role})=>actor.id===s.operator.id&&action==='operators:invite'&&role==='member'&&!!await env.DB.prepare(`SELECT 1 WHERE (${sessionPredicate(s).sql})`).bind(...sessionPredicate(s).params).first()})
  await auth.invite(request,{email,displayName:target?.name??String(input.name),role:'member',returnTo:'/app/files'})
  const audited=Object.assign({...s},{predicate:undefined})
  if(resend)await requireAdmin(env,audited,'help-desk',email);else if(input.group)await requireAdminGroup(env,audited,'user-management',String(input.group));else await requireAdmin(env,audited,'user-management',email)
  const identity=await env.DB.prepare('SELECT email,display_name AS name,role,status FROM oa_operators WHERE email=?').bind(email).first<{email:string;name:string;role:string;status:string}>();insist(identity,'person_not_found',404)
  const previous=await maybe(env,'person',email),payload={...identity,development:email.endsWith('@dev.localhost')},ops:Op[]=[{row:previous?next(previous,payload):fresh('person',payload,email),previous:previous??undefined}]
  if(input.group&&!resend){const group=await getGroup(env,String(input.group));ops.push({row:next(group,{...group.payload,members:[...new Set([...group.payload.members,email])]}),previous:group})}
  await commit(env,audited,ops,{audits:[{action:resend?'admin.person.resend-invite':'admin.person.invite',object:email,detail:{group:input.group??null}}]});return {invited:true}
 }
 const target=await env.DB.prepare('SELECT id,email,display_name AS name,status,role,version FROM oa_operators WHERE email=?').bind(email).first<{id:string;email:string;name:string;status:string;role:string;version:number}>();insist(target,'person_not_found',404)
 if(action==='sessions'||action==='revoke-session'||action==='revoke-sessions'||action==='revoke-devices'){
  await requireAdmin(env,s,'help-desk',email)
  if(action==='sessions'){await commit(env,s,[],{audits:[{action:'admin.person.sessions',object:email}]});return (await env.DB.prepare("SELECT a.id,a.kind,a.created_at AS createdAt,a.expires_at AS expiresAt,a.revoked_at AS revokedAt,CASE WHEN a.revoked_at IS NULL AND a.expires_at>? AND a.operator_version=o.version AND o.status='active' THEN 1 ELSE 0 END AS active FROM oa_sessions a JOIN oa_operators o ON o.id=a.operator_id WHERE a.operator_id=? ORDER BY a.created_at DESC").bind(Date.now(),target.id).all()).results.map((r:any)=>({...r,active:!!r.active}))}
  if(action==='revoke-session'){const held=await env.DB.prepare('SELECT 1 FROM oa_sessions WHERE id=? AND operator_id=?').bind(String(input.session),target.id).first();insist(held,'session_not_found',404);await commit(env,s,[],{audits:[{action:'admin.person.revoke-session',object:email}],statements:[{sql:'UPDATE oa_sessions SET revoked_at=? WHERE id=? AND operator_id=?',params:[Date.now(),input.session,target.id]}]});return {revoked:true}}
  await commit(env,s,[],{audits:[{action:'admin.person.'+action,object:email}],statements:[action==='revoke-devices'?{sql:'UPDATE chest_device_credentials SET revoked_at=? WHERE email=?',params:[now(),email]}:{sql:'UPDATE oa_sessions SET revoked_at=? WHERE operator_id=?',params:[Date.now(),target.id]}]});return {revoked:true}
 }
 if(action==='deactivate'||action==='reactivate'||action==='offboard'){
  await requireAdmin(env,s,'user-management',email);insist(email!==s.operator.email&&target.role!=='owner','owner_required',403);await guardAdminDeactivation(env,s,email)
  const previous=await maybe(env,'person',email),person={email,name:target.name,role:target.role,status:action==='reactivate'?'active':'inactive',development:email.endsWith('@dev.localhost')},ops:Op[]=[{row:previous?next(previous,person):fresh('person',person,email),previous:previous??undefined}],statements:{sql:string;params:unknown[]}[]=[{sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status=?) THEN 1 ELSE 0 END',params:[target.id,target.version,target.status]}]
  if(action==='offboard'){
   const plan=input.to?await planTransfer(env,email,String(input.to),s.operator.email):await deprovisionTransfer(env,email,s.operator.email)
   await requireAdmin(env,s,'user-management',plan.summary.to)
   statements.push(...plan.statements)
  }
  if(action!=='reactivate')statements.push(...deprovisionAuthority(email,s.operator.email))
  statements.push({sql:'UPDATE oa_operators SET status=? WHERE id=?',params:[action==='reactivate'?'active':'inactive',target.id]});if(action!=='reactivate')statements.push({sql:'UPDATE chest_device_credentials SET revoked_at=? WHERE email=?',params:[now(),email]})
  await commit(env,s,ops,{audits:[{action:'admin.person.'+action,object:email,detail:{before:target.status,after:action==='reactivate'?'active':'inactive',successor:input.to??null}}],statements});return {updated:true}
 }
 insist(false,'invalid_action')
}
const getGroup=async(env:Bindings,key:string)=>{const row=(await list<Group>(env,'group')).find(g=>g.id===key);insist(row,'group_not_found',404);return row}
export async function administrativeGroup(env:Bindings,s:Session,input:any){const row=await getGroup(env,String(input.group));await requireAdminGroup(env,s,'user-management',row.id);const email=String(input.email).toLowerCase();insist(await env.DB.prepare('SELECT 1 FROM oa_operators WHERE email=?').bind(email).first(),'person_not_found',404);insist(['add','remove'].includes(input.action),'invalid_action');const members=input.action==='add'?[...new Set([...row.payload.members,email])]:row.payload.members.filter(p=>p!==email);await commit(env,s,[{row:next(row,{...row.payload,members}),previous:row}],{audits:[{action:'admin.group.members',object:row.id,detail:{before:row.payload.members,after:members}}]});return {updated:true}}
