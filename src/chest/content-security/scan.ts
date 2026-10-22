import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row, type Group } from '../model'
import { list } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { ownerOnly, policy } from './policy'
export type Scan = { checksum:string; size:number; filename:string; actor:string; state:'pending'|'clean'|'infected'|'failed'; sensitive:boolean; reason:string; engine:string; at:string; released?:{by:string;at:string;reason:string} }
const key=(checksum:string)=>`content-scan:${checksum}`
export const scanRecord=(env:Bindings,checksum:string)=>maybe<Scan>(env,'content-scan',key(checksum))
export async function scanUpload(env:Bindings,v:{checksum:string;size:number;filename:string;actor:string}) {
 if(!(await policy(env)).enabled){await assertContent(env,v.checksum);return}
 let row=await scanRecord(env,v.checksum)
 if(row?.payload.state==='clean'||row?.payload.released)return
 // Persist pending before network work. A timeout, refusal or crash can never leave a readable original.
 if(!row){row=fresh<Scan>('content-scan',{...v,state:'pending',sensitive:true,reason:'Waiting for the configured content scanner',engine:'',at:now()},key(v.checksum));await commit(env,null,[{row}],{by:v.actor,audits:[{action:'security.content.pending',object:row.id}]})}
 if(row.payload.state==='infected')throw new ChestError('content_quarantined',423)
 let result:Pick<Scan,'state'|'sensitive'|'reason'|'engine'>
 try {
  const endpoint=new URL(env.CONTENT_SCANNER_URL!);insist(!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash,'invalid_scanner_endpoint',503);insist(endpoint.protocol==='https:'||env.AUTH_LOCAL==='true'&&['localhost','127.0.0.1'].includes(endpoint.hostname),'scanner_requires_https',503)
  insist(v.size<=32*1024**2,'scanner_original_too_large',413)
  const blob=await env.BLOBS.get(`sha256/${v.checksum}`);insist(blob&&blob.size===v.size,'blob_missing',503)
  const original=new Uint8Array(await blob.arrayBuffer())
  const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{authorization:`Bearer ${env.CONTENT_SCANNER_TOKEN}`,'content-type':'application/octet-stream','content-length':String(v.size),'x-content-sha256':v.checksum},body:original,signal:AbortSignal.timeout(120_000)})
  insist(response.ok,'scanner_unavailable',503)
  const r=await response.json() as any
  insist(r.checksum===v.checksum&&r.size===v.size&&['clean','infected'].includes(r.state)&&typeof r.sensitive==='boolean'&&typeof r.engine==='string'&&r.engine.length>0&&r.engine.length<=200&&typeof r.reason==='string'&&r.reason.length<=500,'invalid_scanner_receipt',503)
  result={state:r.state,sensitive:r.sensitive,engine:r.engine,reason:r.reason}
 } catch(error) {const code=error instanceof ChestError?error.code:error instanceof DOMException&&['TimeoutError','AbortError'].includes(error.name)?error.name:'scanner_transport_failed';result={state:'failed',sensitive:true,engine:'',reason:`The content scanner did not return a verified verdict (${code}). Original retained; retry scanning.`}}
 const updated=next(row,{...row.payload,...result,at:now()})
 await commit(env,null,[{row:updated,previous:row}],{by:v.actor,audits:[{action:'security.content.verdict',object:row.id,detail:{state:result.state,sensitive:result.sensitive,engine:result.engine}}]})
 if(result.state!=='clean')throw new ChestError('content_quarantined',423)
}
export async function assertContent(env:Bindings,checksum:string) {
 const p=await policy(env);if(!p.consentAt)return
 const row=await scanRecord(env,checksum)
 if(!row&&!p.enabled)return
 insist(row&&(row.payload.state==='clean'||row.payload.released),'content_quarantined',423)
}
export async function contentReadable(env:Bindings,versions:{checksum:string}[],email:string,external=false) {
 const p=await policy(env);if(!p.consentAt)return true
 for(const v of versions){const r=await scanRecord(env,v.checksum);if(!r){if(p.enabled)return false;continue}if(r.payload.state!=='clean'&&!r.payload.released)return false
  if(r.payload.sensitive){
   if(external)return false
   if(await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active' AND role='owner'").bind(email).first())continue
   const groups=await list<Group>(env,'group');if(!groups.some(g=>p.sensitiveGroups.includes(g.id)&&g.payload.members.includes(email)))return false
  }
 }
 return true
}
export async function releaseScan(env:Bindings,s:Session,checksum:string,input:any) {
 await ownerOnly(env,s);const row=await scanRecord(env,checksum);insist(row,'not_found',404)
 insist(input.confirm===true&&typeof input.reason==='string'&&input.reason.trim().length>=5&&input.reason.length<=1000,'release_reason_and_confirmation_required')
 const after=next(row,{...row.payload,released:{by:s.operator.email,at:now(),reason:input.reason.trim()}})
 await commit(env,s,[{row:after,previous:row}],{audits:[{action:'security.content.release',object:row.id,detail:{checksum,verdict:row.payload.state,reason:input.reason.trim()}}]});return after
}
