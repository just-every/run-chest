import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text } from '../model'
import { commit, fresh } from '../files/repo'
import { scopeList } from './policy'
import { endpoint, insertSecret, random, seal } from './secrets'
import type { Budget, Client } from './model'
// Null is an explicit absence of a grant cap. Saved numeric budgets keep their meaning.
export function budget(input: any): Budget {
 const result: Budget={requests:null,mutations:null,bytes:null}
 for(const key of ['requests','mutations','bytes'] as const){
  const value=input?.[key]
  if(value===undefined||value===null||typeof value==='string'&&value.trim()==='')continue
  insist(typeof value==='string'||typeof value==='number','invalid_app_budget')
  const n=Number(value)
  insist(Number.isSafeInteger(n)&&n>=0&&n<=(key==='bytes'?1099511627776:1000000),'invalid_app_budget')
  result[key]=n
 }
 return result
}
export function resources(input: unknown): string[] {const rows=Array.isArray(input)?input:typeof input==='string'?input.split(/[\s,]+/):[];insist(rows.length>0&&rows.length<=100&&rows.every(r=>typeof r==='string'&&r.length>0&&r.length<=240),'invalid_app_resources');return [...new Set(rows)]}
export async function registerClient(env: Bindings,s: Session,input: any) {
 const redirects:unknown[]=Array.isArray(input.redirects)?input.redirects:[],origins:unknown[]=Array.isArray(input.pickerOrigins)?input.pickerOrigins:[]
 insist(redirects.length>0&&redirects.length<=20&&origins.length<=20,'invalid_app_redirects')
 const urls=redirects.map(v=>endpoint(v,env.AUTH_LOCAL==='true').href),pickerOrigins=origins.map(v=>{const u=endpoint(v,env.AUTH_LOCAL==='true');insist(u.href===u.origin+'/'||u.href===u.origin,'picker_requires_exact_origin');return u.origin})
 const confidential=input.confidential===true,row=fresh<Client>('integration-client',{name:text(input.name,'app_name',120),owner:s.operator.email,redirects:[...new Set(urls)],pickerOrigins:[...new Set(pickerOrigins)],actions:scopeList(input.actions),confidential,at:now()}),clientSecret=confidential?random('chest_client_'):null
 await commit(env,s,[{row}],{audits:[{action:'integration.client.register',object:row.id,detail:{name:row.payload.name,actions:row.payload.actions,confidential}}],statements:clientSecret?[insertSecret(`client:${row.id}`,await seal(env,`client:${row.id}`,{hash:await (await import('./secrets')).hash(clientSecret)}),s.operator.email)]:[]})
 return {client:{id:row.id,...row.payload},...(clientSecret?{clientSecret}:{})}
}
