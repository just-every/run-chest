import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, type Row } from '../model'
import { get, list } from '../store'
import type { Item } from '../files/model'
import { commit, maybe, next, where } from '../files/repo'
import type { Extraction } from '../read/jobs'
import { previewAgent,applyAgent,type FilingSuggestion } from './agent-plan'
import { scopeContext,type AgentScope } from './agent-scope'

async function blockedScope(env:Bindings,scope:Row<AgentScope>,error:unknown){
 const reason=error instanceof ChestError?error.code:'filing_changed_during_execution'
 if(scope.payload.problem===reason)return
 try{await commit(env,null,[{row:next(scope,{...scope.payload,problem:reason}),previous:scope}],{by:scope.payload.by,audits:[{action:'filing.agent.scope.blocked',object:scope.payload.source,detail:{scope:scope.id,reason}}]})}catch(e){if(!String(e).includes('CHECK constraint failed'))throw e}
}

export async function classifyArrival(env:Bindings,item:Row<Item>,scope:Row<AgentScope>){
 const {w,s}=await scopeContext(env,scope)
 // Authorization is checked before source text, extraction or message provenance is fetched.
 const live=await get<Item>(env,'item',item.id)
 if(live.payload.parent!==scope.payload.source||live.payload.space!==scope.payload.space||live.payload.type!=='file'||live.payload.trash||!live.payload.current)return null
 const key=`filing-auto:${scope.id}:${live.id}:${live.payload.current}`
 if(await maybe(env,'filing_suggestion',key))return null
 const v=live.payload.versions.find(v=>v.id===live.payload.current)!
 if(!v.text&&['application/pdf','application/octet-stream','image/jpeg','image/png','image/webp','image/heic'].includes(v.mediaType)){
  const extracted=await maybe<Extraction>(env,'extract',`extract:${v.checksum}`)
  if(!extracted||['queued','reading','needs_key','unavailable'].includes(extracted.payload.state))return null
 }
 const preview=await previewAgent(env,s,w,{item:live.id},scope)
 if(!preview.suggestion)return null
 const p=preview.suggestion.payload
 if(p.state==='pending'&&p.destination&&p.confidence>=scope.payload.minimumConfidence&&!p.uncertainty.trim())return applyAgent(env,s,w,{suggestion:preview.suggestion.id},scope)
 return preview
}
export async function automaticArrival(env:Bindings,item:Row<Item>){
 for(const scope of (await where<AgentScope>(env,'filing_scope','$.source',item.payload.parent??'')).filter(r=>r.payload.enabled).sort((a,b)=>a.payload.at.localeCompare(b.payload.at))){
  try{return await classifyArrival(env,item,scope)}catch(error){if(String(error).includes('CHECK constraint failed'))return null;if(!(error instanceof ChestError))throw error;await blockedScope(env,scope,error);return null}
 }
 return null
}
let running:Promise<void>|null=null,last=0
export function sweepAgents(env:Bindings,only?:string,s?:Session):Promise<void>{
 if(running)return running
 if(!only&&Date.now()-last<5000)return Promise.resolve()
 last=Date.now()
 running=(async()=>{
  const until=Date.now()+4000
  for(const scope of (await list<AgentScope>(env,'filing_scope')).filter(r=>r.payload.enabled&&(!only||r.id===only))){
   if(s&&scope.payload.by!==s.operator.email)throw new ChestError('filing_scope_owner_required',403)
   try{
    await scopeContext(env,scope)
    for(const item of await where<Item>(env,'item','$.parent',scope.payload.source)){
     await classifyArrival(env,item,scope)
     if(Date.now()>until)return
    }
   }catch(error){if(String(error).includes('CHECK constraint failed'))continue;if(!(error instanceof ChestError))throw error;await blockedScope(env,scope,error);if(only)throw error}
  }
 })().finally(()=>{running=null})
 return running
}
