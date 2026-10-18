import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { isAdministrator,requireAdmin } from '../administration/roles'
import { insist, id, now } from '../model'
import { list, sessionPredicate } from '../store'
export type MfaPolicy = { enabled:boolean; groups:string[]; graceDays:number; resistantAdmins:boolean; sessionHours:number; idleMinutes:number; requireIdpMfa:boolean }
export const defaults:MfaPolicy={enabled:false,groups:[],graceDays:0,resistantAdmins:false,sessionHours:24,idleMinutes:60,requireIdpMfa:false}
export async function mfaPolicy(env:Bindings):Promise<MfaPolicy>{const row=await env.DB.prepare('SELECT payload FROM chest_mfa_policy WHERE singleton=1').first<{payload:string}>();return row?JSON.parse(row.payload):defaults}
export async function requirement(env:Bindings,s:Session){
 const policy=await mfaPolicy(env),groups=await list(env,'group'),administrator=await isAdministrator(env,s),selected=policy.enabled||groups.some(g=>policy.groups.includes(g.id)&&g.payload.members.includes(s.operator.email))
 return {policy,required:selected||policy.resistantAdmins&&administrator,resistant:policy.resistantAdmins&&administrator}
}
export async function saveMfaPolicy(env:Bindings,s:Session,input:any){
 await requireAdmin(env,s,'sharing-security');const before=await mfaPolicy(env),groups=Array.isArray(input.groups)?input.groups:[],known=await list(env,'group'),number=(key:string,min:number,max:number)=>{const n=Number(input[key]);insist(Number.isInteger(n)&&n>=min&&n<=max,'invalid_'+key);return n}
 insist(groups.every((g:unknown)=>typeof g==='string'&&known.some(k=>k.id===g)),'invalid_groups')
 const after:MfaPolicy={enabled:input.enabled===true||input.enabled==='true',groups,graceDays:number('graceDays',0,30),resistantAdmins:input.resistantAdmins===true||input.resistantAdmins==='true',sessionHours:number('sessionHours',1,720),idleMinutes:number('idleMinutes',1,1440),requireIdpMfa:input.requireIdpMfa===true||input.requireIdpMfa==='true'},guard=sessionPredicate(s)
 await env.DB.batch([
 env.DB.prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${guard.sql}) THEN 1 ELSE 0 END`).bind(...guard.params),
 env.DB.prepare('INSERT INTO chest_mfa_policy VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload,revision=excluded.revision').bind(JSON.stringify(after),id()),
 env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(id(),s.operator.email,'security.mfa.policy','organisation',JSON.stringify({before,after}),now()),
 env.DB.prepare('DELETE FROM chest_assert')]);return after
}
