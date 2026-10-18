import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { list } from '../store'
import { context, demand, type Who } from '../files/access'
import { managed,readerView,saveReader } from '../read/settings'
import { previewAgent,applyAgent,type FilingSuggestion } from './agent-plan'
import { saveScope,toggleScope,type AgentScope } from './agent-scope'
import { sweepAgents } from './agent-arrivals'
export type { FilingSuggestion } from './agent-plan'
const unavailable={available:false,message:'Not available yet on RER Managed hosting.'}
export async function agentExecute(env:Bindings,s:Session,w:Who,method:string,input:any,url:URL):Promise<unknown>{
 if(managed(env))return unavailable
 if(method==='GET'){
  const suggestions=[]
  for(const row of await list<FilingSuggestion>(env,'filing_suggestion')){
   if(url.searchParams.get('space')&&row.payload.space!==url.searchParams.get('space'))continue
   try{demand(await context(env,w,row.payload.item),'manage');suggestions.push(row)}catch{}
  }
  return{available:true,reader:await readerView(env),suggestions:suggestions.sort((a,b)=>b.payload.at.localeCompare(a.payload.at)),scopes:(await list<AgentScope>(env,'filing_scope')).filter(r=>r.payload.by===w.email)}
 }
 if(method==='POST'){
  if(input.action==='configure')return saveReader(env,s,input)
  if(input.action==='apply'||input.action==='decline')return applyAgent(env,s,w,input)
  if(input.action==='preview'||input.action==='run')return previewAgent(env,s,w,input)
  if(input.action==='grant')return saveScope(env,s,input)
  if(input.action==='scope-toggle')return toggleScope(env,s,input)
  if(input.action==='sweep'){insist(typeof input.scope==='string','scope_required');await sweepAgents(env,input.scope,s);return agentExecute(env,s,w,'GET',{},url)}
 }
 insist(false,'not_found',404)
}
