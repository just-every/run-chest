import { operatorAuth,type Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { owner } from './access'
import { get,list,write,changed } from './store'
import { insist,id,type Person } from './model'
export async function syncPeople(env:Bindings,request:Request,s:Session) {
 const operators=s.operator.role==='owner'?await operatorAuth(env).listOperators(request):[s.operator]
 const current=await list<Person>(env,'person')
 for(const o of operators){const payload={email:o.email,name:o.displayName,role:o.role,status:o.status,development:o.email.endsWith('@dev.localhost')};const old=current.find(p=>p.id===o.email);if(!old||JSON.stringify(old.payload)!==JSON.stringify(payload))await write(env,s,{id:o.email,kind:'person',payload,revision:id()},'identity.sync',old)}
}
export async function peopleAction(env:Bindings,request:Request,s:Session,input:any) {
 owner(s);const auth=operatorAuth(env)
 if(input.action==='invite'){await auth.invite(request,{email:input.email,displayName:input.name,role:'member',returnTo:'/app/files'});await syncPeople(env,request,s);return {invited:true}}
 const operators=await auth.listOperators(request);const op=operators.find(p=>p.email===input.email);insist(op,'person_not_found',404)
 if(input.action==='sessions')return auth.listSessions(request,op.id)
 if(input.action==='revoke'){await auth.revokeSession(request,String(input.session));return {revoked:true}}
 insist(input.action==='deactivate'||input.action==='reactivate','invalid_action');await auth.setOperatorStatus(request,op.id,input.action==='deactivate'?'inactive':'active');await syncPeople(env,request,s);return {updated:true}
}
