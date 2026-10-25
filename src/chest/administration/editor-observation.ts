import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
import { requireAdmin } from './roles'
import { providerFetch } from './provider-usage'
const key='admin-editor-observation'
export const editorObservation=(env:Bindings)=>maybe<{at:string;product:string|null;version:string|null;documents:null;connections:null;outcome:string}>(env,key,key)
export async function probeEditor(env:Bindings,s:Session){
 await requireAdmin(env,s,'service-settings')
 insist(env.COLLABORA_URL,'collabora_not_configured',503)
 const origin=new URL(env.COLLABORA_URL),local=['localhost','127.0.0.1','[::1]']
 insist((origin.protocol==='https:'||origin.protocol==='http:'&&local.includes(origin.hostname)&&local.includes(new URL(env.AUTH_ORIGIN).hostname))&&!origin.username&&!origin.password&&!origin.search&&!origin.hash,'collabora_requires_https',503)
 const clean=(v:unknown)=>typeof v==='string'&&v.length<=120&&!/[<>\p{Cc}\p{Cf}]/u.test(v)?v:null
 let product=null,version=null,outcome='unavailable'
 try{const response=await providerFetch(env,'Collabora Online','editor','chest:editor',new Request(new URL('/hosting/capabilities',origin),{redirect:'manual',signal:AbortSignal.timeout(15000)}));if(response.ok){const data=await response.json() as any;product=clean(data.productName);version=clean(data.productVersion);outcome=product?'reported':'unavailable'}}catch{}
 // The public capabilities endpoint does not report licensed capacity or live connections.
 const payload={at:now(),product,version,documents:null,connections:null,outcome},before=await editorObservation(env)
 await commit(env,s,[{row:before?next(before,payload):fresh(key,payload,key),previous:before??undefined}],{audits:[{action:'office.provider.observe',object:'editor',detail:payload}]})
 return payload
}
