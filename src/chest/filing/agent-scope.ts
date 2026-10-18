import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text, type Row } from '../model'
import { get, snapshot } from '../store'
import { context, demand, who, whoFor } from '../files/access'
import { commit, fresh, next } from '../files/repo'

export type AgentScope={source:string;space:string;destinations:string[];minimumConfidence:number;allowRename:boolean;allowTag:boolean;enabled:boolean;by:string;at:string;problem?:string}
export async function scopeContext(env:Bindings,scope:Row<AgentScope>){
 insist(scope.payload.enabled,'filing_scope_paused',409)
 const actor:any=await env.DB.prepare("SELECT * FROM oa_operators WHERE email=? AND status='active'").bind(scope.payload.by).first();insist(actor,'rule_owner_inactive',403)
 const w=await whoFor(env,scope.payload.by),source=await context(env,w,scope.payload.source);demand(source,'manage')
 insist(source.chain.at(-1)!.payload.type==='folder'&&source.space.id===scope.payload.space,'filing_scope_changed',409)
 const fences:Row[]=[scope,...source.fences]
 for(const id of scope.payload.destinations){const destination=await context(env,w,id);demand(destination,'manage');insist(destination.space.id===scope.payload.space&&destination.chain.at(-1)!.payload.type==='folder','filing_scope_changed',409);fences.push(...destination.fences)}
 const p=snapshot(scope),s={id:`filing:${scope.id}`,kind:'standing folder grant',operator:{id:actor.id,email:actor.email,role:actor.role,displayName:actor.display_name},predicate:{sql:`(${p.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?)`,params:[...p.params,actor.id,actor.version]}} as unknown as Session
 return {w,s,source,fences}
}
export async function saveScope(env:Bindings,s:Session,input:any){
 const w=await who(env,s),source=await context(env,w,text(input.source,'source'));demand(source,'manage');insist(source.chain.at(-1)!.payload.type==='folder','filing_source_folder_required')
 insist(Array.isArray(input.destinations)&&input.destinations.length>0&&input.destinations.length<=80&&input.destinations.every((d:unknown)=>typeof d==='string'&&d!==input.source),'filing_destinations_required')
 const destinations=[...new Set<string>(input.destinations)],fences=[...source.fences]
 for(const id of destinations){const c=await context(env,w,id);demand(c,'manage');insist(c.space.id===source.space.id&&c.chain.at(-1)!.payload.type==='folder','filing_same_space_required');fences.push(...c.fences)}
 const confidence=Number(input.minimumConfidence??0.9);insist(Number.isFinite(confidence)&&confidence>=0.5&&confidence<=1,'invalid_filing_confidence')
 const row=fresh<AgentScope>('filing_scope',{source:input.source,space:source.space.id,destinations,minimumConfidence:confidence,allowRename:input.allowRename===true,allowTag:input.allowTag===true,enabled:true,by:s.operator.email,at:now()})
 await commit(env,s,[{row}],{fences,audits:[{action:'filing.agent.grant',object:input.source,detail:{scope:row.id,after:row.payload}}]});return row
}
export async function toggleScope(env:Bindings,s:Session,input:any){
 const row=await get<AgentScope>(env,'filing_scope',text(input.scope,'scope'));insist(row.payload.by===s.operator.email,'filing_scope_owner_required',403)
 const enabled=input.enabled===true||input.enabled==='true'
 if(enabled)await scopeContext(env,{...row,payload:{...row.payload,enabled:true}})
 const updated=next(row,{...row.payload,enabled})
 await commit(env,s,[{row:updated,previous:row}],{audits:[{action:'filing.agent.scope',object:row.payload.source,detail:{before:row.payload,after:updated.payload}}]});return updated
}
