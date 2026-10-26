import { canAdmin } from './roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now } from '../model'
import { commit, maybe } from '../files/repo'
import { viewFilter } from '../audit/privacy'
import { eventCondition, reportScope } from './report-scope'
import { csvCell, eventFilters } from './reports'
import type { CostRates } from './costs'

const basis = 'Instrumented response bytes, including originals, rendered previews, selection archives and signing PDFs. Repeated ranges count again. Durable checkpoints precede output: bytes in an unfinished checkpoint are uncertain, never asserted as client receipt or a provider invoice. Completed and cancelled streams retain their emitted prefix. Organization archive totals include ZIP framing; Scoped archive totals count original member bytes at the enclosing ZIP output checkpoint under current custody and omit shared framing. Reserved member bytes stay uncertain until output is recorded. Earlier generated-member receipts retain their assembly-only label. Historical traffic before instrumentation is excluded. Unknown rates remain unknown.'
export type EgressCheckpoint = {bytes:number;reservedBytes:number;outcome:string}
export async function egressReceipt(env: Bindings, item:string, actor:string, door:string) {
 const rates = (await maybe<CostRates>(env, 'admin-cost-rates', 'admin-cost-rates'))?.payload ?? null
 const at=now(),stream=crypto.randomUUID(),key=crypto.randomUUID()
 const anonymize=await (await import('../audit/privacy')).identityRedactor(env)
 const detail=(state:EgressCheckpoint)=>({...state,startedAt:at,stream,door,measurement:door==='archive member'?'zip-output':'response-output',checkpointAt:now(),provider:rates?.provider??null,quote:rates?.quote??null,rateAt:rates?.updatedAt??null,usdPerGb:rates?.egressUsdPerGb??null,usd:rates?Number((state.bytes/1e9*rates.egressUsdPerGb).toFixed(9)):null})
 await env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(key,await anonymize(actor),'transfer.egress',await anonymize(item),await anonymize(JSON.stringify(detail({bytes:0,reservedBytes:0,outcome:'running'}))),at).run()
 let previous=''
 return async(state:EgressCheckpoint)=>{
  const serialized=JSON.stringify(state);if(serialized===previous)return
  await env.DB.prepare('UPDATE chest_audit SET detail=? WHERE id=?').bind(await (await (await import('../audit/privacy')).identityRedactor(env))(JSON.stringify(detail(state))),key).run()
  previous=serialized
 }
}
// Reserve output durably before enqueueing it. Member observers use this same
// output boundary, so ZIP assembly never counts as delivery of an original.
export async function meterOriginal(env: Bindings, response: Response, item: string, actor: string, door: string, expectedBytes?: number, observe?: (state:EgressCheckpoint)=>Promise<void>) {
 if (!response.ok || !response.body) return response
 const reader=response.body.getReader(),receipt=await egressReceipt(env,item,actor,door)
 // Known originals need a bounded number of durable checkpoints within D1's
 // invocation query budget, even when storage yields tiny chunks.
 const batchBytes=expectedBytes===undefined?256*1024:Math.min(32*1024*1024,Math.max(256*1024,Math.ceil(expectedBytes/128)))
 let bytes=0,reservedBytes=0,recorded=false,cancelled=false,pending=Promise.resolve()
 function checkpoint(outcome:string){
  const state={bytes,reservedBytes,outcome}
  const next=pending.then(async()=>{await observe?.(state);await receipt(state)})
  // Cancellation may arrive while an observer is persisting member rows.
  // Serialize writes so an earlier running checkpoint cannot replace its outcome.
  pending=next.catch(()=>{})
  return next
 }
 async function record(outcome:string) { if(recorded)return;recorded=true;await checkpoint(outcome) }
 const body = new ReadableStream<Uint8Array>({
  async pull(controller) {
   try {
    // Storage can yield four-kilobyte pieces. Coalesce a bounded output batch so
    // durable admission does not require one database transaction for each piece.
    const parts:Uint8Array[]=[];let size=0,ended=false
    while(size<batchBytes){const part=await reader.read();if(part.done){ended=true;break}parts.push(part.value);size+=part.value.byteLength}
    if(cancelled)return
    if(!size&&ended){insist(expectedBytes===undefined||bytes===expectedBytes,'incomplete_original',503);await record('complete');controller.close();return}
    const value=parts.length===1?parts[0]:new Uint8Array(size)
    if(parts.length>1){let offset=0;for(const part of parts){value.set(part,offset);offset+=part.byteLength}}
    parts.length=0
    reservedBytes=bytes+size
    insist(expectedBytes===undefined||reservedBytes<=expectedBytes,'original_size_mismatch',503)
    await checkpoint('running')
    if(cancelled)return
    controller.enqueue(value);bytes=reservedBytes
    await checkpoint('running')
    if(ended||expectedBytes!==undefined&&bytes===expectedBytes){insist(expectedBytes===undefined||bytes===expectedBytes,'incomplete_original',503);if(!ended)insist((await reader.read()).done,'original_size_mismatch',503);await record('complete');controller.close()}
   } catch(error){if(cancelled)return;try{await record('failed')}finally{controller.error(error);await reader.cancel(error)}}
  },
  async cancel(reason){cancelled=true;try{await reader.cancel(reason)}finally{await record('cancelled')}},
 },{highWaterMark:0})
 return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers})
}
export async function administrativeEgress(env: Bindings, s: Session, params: URLSearchParams) {
 const scope = await reportScope(env, s, params.get('group')), fence = eventCondition(scope)
 const dates = new URLSearchParams(); for (const key of ['from','to']) if (params.get(key)) dates.set(key,params.get(key)!)
 const coverage=scope.global?" AND COALESCE(json_extract(detail,'$.door'),'')!='archive member'":" AND COALESCE(json_extract(detail,'$.door'),'')!='selection archive'"
 const filter = eventFilters(dates), visible = await viewFilter(env,true,true)
 const result = await env.DB.prepare(`SELECT actor,object_id,at,action,detail FROM chest_audit a WHERE action='transfer.egress' AND ${fence.sql}${coverage}${filter.conditions.length ? ' AND '+filter.conditions.join(' AND ') : ''} ORDER BY at,id`).bind(...fence.params,...filter.values).all<{actor:string;object_id:string;at:string;action:string;detail:string}>()
 const showCosts = await canAdmin(env,s,'audit-reporting')
 const rows = result.results.filter(r=>visible(r)).map(r=>{const d=JSON.parse(r.detail);const interrupted=d.outcome==='running'&&Date.parse(d.checkpointAt??r.at)<Date.now()-5*60000;return {item:r.object_id,at:r.at,startedAt:d.startedAt,door:d.door,byteBasis:d.door==='archive member'?(d.measurement==='zip-output'?'Original member bytes at ZIP output checkpoints':'Generated original chunks entering ZIP assembly'):'Emitted response prefix',bytes:d.bytes,outcome:interrupted?'uncertain':d.outcome,uncertainBytes:Math.max(0,(d.reservedBytes??d.bytes)-d.bytes),provider:showCosts?d.provider:null,quote:showCosts?d.quote:null,rateAt:showCosts?d.rateAt:null,usdPerGb:showCosts?d.usdPerGb:null,usd:showCosts?d.usd:null}})
 const bytes = rows.reduce((n,r)=>n+r.bytes,0), unknownBytes = rows.filter(r=>r.usd===null).reduce((n,r)=>n+r.bytes,0)
 const estimatedUsd = Number(rows.reduce((n,r)=>n+(r.usd??0),0).toFixed(9))
 await commit(env,s,[],{audits:[{action:'admin.egress.read',object:'administration',detail:{count:rows.length}}]})
 return {basis,rows,bytes,unknownBytes,estimatedUsd,uncertainBytes:rows.reduce((n,r)=>n+r.uncertainBytes,0),groups:scope.groups}
}
export async function administrativeEgressCsv(env: Bindings, s: Session, params: URLSearchParams) {
 const d=await administrativeEgress(env,s,params)
 const rows=d.rows.map(r=>[r.at,r.startedAt,r.item,r.door,r.bytes,r.outcome,r.provider,r.quote,r.rateAt,r.usdPerGb,r.usd,r.uncertainBytes,r.byteBasis])
 return new Response(['Receipt at,Started at,Item ID,Door,Recorded bytes,Outcome,Provider,Quote,Rate recorded at,USD per decimal GB,Estimated USD,Uncertain reserved bytes,Byte basis',...rows.map(r=>r.map(csvCell).join(','))].join('\r\n')+'\r\n',{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="chest-egress.csv"','cache-control':'no-store'}})
}
