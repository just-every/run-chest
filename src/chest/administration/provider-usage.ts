import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { id, now, insist } from '../model'
import { maybe, commit } from '../files/repo'
import { canAdmin } from './roles'
import type { CostRates } from './costs'
import { reportScope, eventCondition, contentCondition } from './report-scope'
import { csvCell, eventFilters } from './reports'

// No endpoint, request content, provider diagnostics or credentials enter receipts.
export async function providerFetch(env: Bindings, provider: string, object: string, actor: string, request: Request, model = 'request') {
 const rates=(await maybe<CostRates>(env,'admin-cost-rates','admin-cost-rates'))?.payload??null
 const rate=rates?.aiProvider===provider&&rates.aiModel===model?rates:null
 const key=id(),startedAt=now(),requestBytes=request.body?(request.headers.has('content-length')?Number(request.headers.get('content-length')):(await request.clone().arrayBuffer()).byteLength):0
 const redact=await (await import('../audit/privacy')).identityRedactor(env)
 const initial={provider,model,startedAt,requestBytes,responseBytes:0,input:null as number|null,output:null as number|null,quote:rate?.quote??null,rateAt:rate?.updatedAt??null,inputUsdPerMillion:rate?.aiInputUsdPerMillion??null,outputUsdPerMillion:rate?.aiOutputUsdPerMillion??null,requestUsd:rate?.aiRequestUsd??null,usd:null as number|null,outcome:'running',status:null as number|null,networkProvider:rates?.provider??null,networkQuote:rates?.quote??null,networkRateAt:rates?.updatedAt??null,networkUsd:rates?Number((requestBytes/1e9*rates.egressUsdPerGb).toFixed(9)):null}
 await env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(key,await redact(actor),'provider.usage',await redact(object),await redact(JSON.stringify(initial)),startedAt).run()
 async function finish(extra:Record<string,unknown>){await env.DB.prepare('UPDATE chest_audit SET detail=? WHERE id=?').bind(await (await (await import('../audit/privacy')).identityRedactor(env))(JSON.stringify({...initial,...extra,finishedAt:now()})),key).run()}
 try{
  const response=await fetch(request),reader=response.body?.getReader(),chunks:Uint8Array[]=[];let size=0
  try{if(reader)for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;insist(size<=32*1024*1024,'provider_receipt_too_large',502);chunks.push(part.value)}}finally{await reader?.cancel()}
  const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length}
  let data:any=null;try{data=JSON.parse(new TextDecoder().decode(raw))}catch{}
  const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null
  const input=count(data?.usage?.input_tokens??data?.usage?.prompt_tokens),output=count(data?.usage?.output_tokens??data?.usage?.completion_tokens)
  const cacheInput=(count(data?.usage?.cache_creation_input_tokens)??0)+(count(data?.usage?.cache_read_input_tokens)??0)+(count(data?.usage?.prompt_tokens_details?.cached_tokens)??0)
  const usd=rate&&(model==='request'||input!==null&&output!==null&&cacheInput===0)?Number(((model==='request'?0:input!/1e6*rate.aiInputUsdPerMillion!+output!/1e6*rate.aiOutputUsdPerMillion!)+(rate.aiRequestUsd??0)).toFixed(9)):null
  await finish({responseBytes:raw.length,input,output,cacheInput,usd,status:response.status,outcome:response.ok?'succeeded':'refused'})
  return new Response(raw.length?raw:null,{status:response.status,statusText:response.statusText,headers:response.headers})
 }catch(error){await finish({outcome:'uncertain'});throw error}
}
export async function administrativeProviderUsage(env:Bindings,s:Session,params:URLSearchParams){
 const scope=await reportScope(env,s,params.get('group')),fence=eventCondition(scope),content=contentCondition(scope),dates=new URLSearchParams()
 for(const k of ['from','to'])if(params.get(k))dates.set(k,params.get(k)!)
 const f=eventFilters(dates),pricing=await canAdmin(env,s,'audit-reporting')
 for(const name of ['provider','model'])if(params.get(name)){insist(params.get(name)!.length<=120,'invalid_provider_filter');f.conditions.push(`json_extract(detail,'$.${name}')=?`);f.values.push(params.get(name))}
 const custody=scope.global?{sql:fence.sql,params:fence.params}:{sql:`(${fence.sql} OR EXISTS(SELECT 1 FROM chest_records r,json_each(r.payload,'$.versions') v WHERE r.kind IN ('item','document') AND ${content.sql} AND (('extract:'||json_extract(v.value,'$.checksum'))=a.object_id OR ('content-scan:'||json_extract(v.value,'$.checksum'))=a.object_id OR ('version:'||json_extract(v.value,'$.id'))=a.object_id)))`,params:[...fence.params,...content.params]}
 const source=await env.DB.prepare(`SELECT object_id,at,detail FROM chest_audit a WHERE action='provider.usage' AND ${custody.sql}${f.conditions.length?' AND '+f.conditions.join(' AND '):''} ORDER BY at,id`).bind(...custody.params,...f.values).all<{object_id:string;at:string;detail:string}>()
 const rows=source.results.map(r=>{const d=JSON.parse(r.detail);return {item:r.object_id,at:r.at,provider:d.provider,model:d.model,requestBytes:d.requestBytes,responseBytes:d.responseBytes,input:d.input,output:d.output,cacheInput:d.cacheInput??null,outcome:d.outcome==='running'&&Date.parse(d.startedAt)<Date.now()-5*60000?'uncertain':d.outcome,quote:pricing?d.quote:null,rateAt:pricing?d.rateAt:null,usd:pricing?d.usd:null,networkProvider:pricing?d.networkProvider:null,networkQuote:pricing?d.networkQuote:null,networkRateAt:pricing?d.networkRateAt:null,networkUsd:pricing?d.networkUsd:null}})
 await commit(env,s,[],{audits:[{action:'admin.provider-usage.read',object:'administration',detail:{count:rows.length}}]})
 return {rows,estimatedUsd:Number(rows.reduce((n,r)=>n+(r.usd??0),0).toFixed(9)),networkEstimatedUsd:Number(rows.reduce((n,r)=>n+(r.networkUsd??0),0).toFixed(9)),unknownCosts:rows.filter(r=>r.usd===null).length,basis:'Dated provider calls, reported uncached token usage and serialized request and response bytes. Quotes are preserved at request start. Outbound request bytes have a separate estimate from the named network provider. Failed or interrupted calls can be billed; cached usage without a matching tier quote, missing usage and missing prices remain unknown. These are estimates, not provider invoices.'}
}
export async function administrativeProviderUsageCsv(env:Bindings,s:Session,p:URLSearchParams){
 const d=await administrativeProviderUsage(env,s,p)
 return new Response(['At,Item ID,Provider,Model,Request bytes,Response bytes,Input units,Output units,Cached input units,Outcome,Quote,Rate recorded at,Estimated provider USD,Network provider,Network quote,Network rate recorded at,Estimated network USD',...d.rows.map(r=>[r.at,r.item,r.provider,r.model,r.requestBytes,r.responseBytes,r.input,r.output,r.cacheInput,r.outcome,r.quote,r.rateAt,r.usd,r.networkProvider,r.networkQuote,r.networkRateAt,r.networkUsd].map(csvCell).join(','))].join('\r\n')+'\r\n',{headers:{'content-type':'text/csv; charset=utf-8','cache-control':'no-store','content-disposition':'attachment; filename="chest-provider-usage.csv"'}})
}
