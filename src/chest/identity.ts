import { administrativePersonAction } from './administration/people'
import { operatorAuth,type Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { owner } from './access'
import { get,list,write,changed } from './store'
import { insist,id,type Person } from './model'
import { personLine } from './names'
export async function syncPeople(env:Bindings,request:Request,s:Session) {
 const operators=s.operator.role==='owner'?await operatorAuth(env).listOperators(request):[s.operator]
 const current=await list<Person>(env,'person')
 for(const o of operators){const payload={email:o.email,name:o.displayName,role:o.role,status:o.status,development:o.email.endsWith('@dev.localhost')};const old=current.find(p=>p.id===o.email);if(!old||JSON.stringify(old.payload)!==JSON.stringify(payload))await write(env,s,{id:o.email,kind:'person',payload,revision:id()},'identity.sync',old)}
}
export async function peopleAction(env:Bindings,request:Request,s:Session,input:any) {
 if(input.action==='revoke'){const target=await env.DB.prepare('SELECT o.email FROM oa_sessions a JOIN oa_operators o ON o.id=a.operator_id WHERE a.id=?').bind(input.session).first<{email:string}>();insist(target,'session_not_found',404);return administrativePersonAction(env,request,s,{...input,action:'revoke-session',email:target.email})}
 return administrativePersonAction(env,request,s,input)
}
