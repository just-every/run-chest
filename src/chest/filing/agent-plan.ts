import { attempt } from '../audit/journal'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text, type Person, type Row } from '../model'
import { get, list } from '../store'
import { context, demand, who, type Who } from '../files/access'
import { place } from '../files/items'
import type { Item } from '../files/model'
import { commit, fresh, maybe, next, spaceItems } from '../files/repo'
import { readerState } from '../read/settings'
import type { Extraction } from '../read/jobs'
import { classify, type Classification } from './provider'
import { moveFile } from './shared'
import { policyGuards, policySnapshot } from './batch-plan'
import type { AgentScope } from './agent-scope'

export type FilingSuggestion=Classification&{item:string;name:string;space:string;version:string;itemRevision:string;destinationRevision:string|null;by:string;at:string;state:'pending'|'applied'|'declined'|'blocked'|'processing';model:string;destinationPath:string;sourcePath:string;scope?:string;scopeRevision?:string;policies:string;problem?:string}
export async function previewAgent(env:Bindings,s:Session,w:Who,input:any,scope?:Row<AgentScope>){
 const state=await readerState(env);if(!('config'in state))return {available:false,message:'missing'in state?state.missing:state.unavailable}
 const ctx=await context(env,w,text(input.item,'item'));demand(ctx,'manage')
 const item=ctx.chain.at(-1)!,v=item.payload.versions.find(v=>v.id===item.payload.current);insist(item.payload.type==='file'&&v,'not_a_file')
 const folders:{id:string;path:string;revision:string;fences:Row[];metadata:unknown}[]=[]
 const candidates=scope?await Promise.all(scope.payload.destinations.map(id=>get<Item>(env,'item',id))):await spaceItems(env,item.payload.space)
 for(const folder of candidates){
  if(folder.payload.type!=='folder'||folder.payload.trash||folder.id===item.payload.parent||(input.destination&&folder.id!==input.destination))continue
  try{const dest=await place(env,w,item.payload.space,folder.id);folders.push({id:folder.id,path:[dest.space.payload.name,...dest.chain.map(r=>r.payload.name)].join(' / '),revision:folder.revision,fences:dest.fences,metadata:folder.payload.filing??null})}catch(error){if(!(error instanceof Error&&'code'in error))throw error}
  if(folders.length>=80)break
 }
 insist(folders.length,'filing_no_destinations')
 const extracted=await maybe<Extraction>(env,'extract',`extract:${v.checksum}`),source=[v.text,extracted?.payload.text??''].filter(Boolean).join('\n').slice(0,24000)
 const provenance=(await env.DB.prepare("SELECT payload FROM chest_records WHERE kind='intake-receipt' AND json_extract(payload,'$.item')=?").bind(item.id).all<{payload:string}>()).results.map(r=>{const p=JSON.parse(r.payload);return{sender:p.sender,date:p.date,subject:p.subject,messageId:p.messageId}})
 const people:{email:string;name:string}[]=[]
 for(const person of await list<Person>(env,'person')){if(person.payload.status==='inactive')continue;try{const c=await context(env,await (await import('../files/access')).whoFor(env,person.id),item.id);demand(c,'view');people.push({email:person.id,name:person.payload.name})}catch{}}
 const policies=await policySnapshot(env),key=scope?`filing-auto:${scope.id}:${item.id}:${v.id}`:undefined
 if(key){const known=await maybe<FilingSuggestion>(env,'filing_suggestion',key);if(known)return{available:true,suggestion:known}}
 const row=fresh<FilingSuggestion>('filing_suggestion',{destination:'',explanation:'Classification started; no filing has been applied.',quote:'',confidence:0,uncertainty:'Awaiting model response',taxonomy:[],responsible:'',proposedName:'',tags:[],item:item.id,name:item.payload.name,space:item.payload.space,version:v.id,itemRevision:item.revision,destinationRevision:null,destinationPath:'',sourcePath:[ctx.space.payload.name,...ctx.chain.map(r=>r.payload.name)].join(' / '),by:s.operator.email,at:now(),state:'processing',model:state.config.model,policies,...(scope?{scope:scope.id,scopeRevision:scope.revision}:{})},key)
 const fences=[...ctx.fences,...folders.flatMap(f=>f.fences),...(scope?[scope]:[])]
 await commit(env,s,[{row}],{fences,statements:policyGuards(policies),audits:[{action:'filing.agent.read',object:item.id,detail:{suggestion:row.id,version:v.id,model:state.config.model,scope:scope?.id,source:provenance}}]})
 try{
  const answer=await attempt(env,s.operator.email,'provider.classify',item.id,{authority:scope?'standing folder grant':`${s.kind}:${s.operator.role}`,version:v.id,provider:state.config.provider,model:state.config.model},()=>classify(state.config,{name:item.payload.name,text:source,version:v.id,destinations:folders.map(({id,path,metadata})=>({id,path,metadata})),people,provenance,metadata:{standingGrant:scope?{source:scope.payload.source,destinations:scope.payload.destinations,minimumConfidence:scope.payload.minimumConfidence,allowRename:scope.payload.allowRename,allowTag:scope.payload.allowTag}:null,filing:item.payload.filing??null,reading:extracted?.payload.state??(v.text?'done':'unreadable'),truncated:v.text.length+(extracted?.payload.text.length??0)>24000||extracted?.payload.truncatedAt!==null&&extracted?.payload.truncatedAt!==undefined}}))
  const live=await context(env,await who(env,s),item.id);demand(live,'manage');insist(live.chain.at(-1)!.revision===item.revision,'filing_stale',409)
  const destination=folders.find(f=>f.id===answer.destination),updated=next(row,{...row.payload,...answer,state:'pending' as const,destinationRevision:destination?.revision??null,destinationPath:destination?.path??''})
  await commit(env,s,[{row:updated,previous:row}],{fences,statements:policyGuards(policies),audits:[{action:'filing.agent.suggest',object:item.id,detail:{suggestion:row.id,version:v.id,scope:scope?.id}}]})
  return{available:true,suggestion:updated}
 }catch(error){
  const current=await get<FilingSuggestion>(env,'filing_suggestion',row.id),blocked=next(current,{...current.payload,state:'blocked' as const,problem:error instanceof Error&&'code'in error?String(error.code):'Classification did not finish. Review the file and request a new preview.'})
  // Recording failure needs a live actor, but never retries a paid request or emits a filing notice.
  await commit(env,null,[{row:blocked,previous:current}],{by:s.operator.email,audits:[{action:'filing.agent.blocked',object:item.id,detail:{suggestion:row.id,reason:blocked.payload.problem}}]})
  throw error
 }
}
export async function applyAgent(env:Bindings,s:Session,w:Who,input:any,scope?:Row<AgentScope>){
 const suggestion=await get<FilingSuggestion>(env,'filing_suggestion',text(input.suggestion,'suggestion')),ctx=await context(env,w,suggestion.payload.item);demand(ctx,'manage')
 insist(suggestion.payload.state==='pending','filing_suggestion_closed',409)
 if(input.action==='decline'){const row=next(suggestion,{...suggestion.payload,state:'declined' as const});await commit(env,s,[{row,previous:suggestion}],{fences:ctx.fences,audits:[{action:'filing.agent.decline',object:suggestion.payload.item}]});return{suggestion:row}}
 const item=ctx.chain.at(-1)!;insist(item.revision===suggestion.payload.itemRevision&&item.payload.current===suggestion.payload.version,'filing_stale',409)
 insist(suggestion.payload.destination,'filing_uncertain_requires_destination',409)
 const destination=await get<Item>(env,'item',suggestion.payload.destination);insist(destination.revision===suggestion.payload.destinationRevision,'filing_destination_stale',409)
 if(scope)insist(scope.id===suggestion.payload.scope&&scope.revision===suggestion.payload.scopeRevision&&scope.payload.destinations.includes(destination.id)&&item.payload.parent===scope.payload.source,'filing_scope_changed',409)
 insist(await policySnapshot(env)===suggestion.payload.policies,'filing_policy_changed',409)
 const updated=next(suggestion,{...suggestion.payload,state:'applied' as const})
 return moveFile(env,s,w,item,destination.id,{by:s.operator.email,explanation:suggestion.payload.explanation,evidence:`Version ${suggestion.payload.version}: “${suggestion.payload.quote}”; confidence ${suggestion.payload.confidence}; ${suggestion.payload.uncertainty}`},`filing-agent:${suggestion.id}`,{ops:[{row:updated,previous:suggestion}],fences:scope?[scope]:[],statements:policyGuards(suggestion.payload.policies),rename:!scope||scope.payload.allowRename?suggestion.payload.proposedName:undefined,tags:!scope||scope.payload.allowTag?suggestion.payload.tags:undefined})
}
