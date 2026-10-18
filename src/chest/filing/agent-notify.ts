import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { allowed, context, demand, descend, start, whoFor } from '../files/access'
import { commit, next } from '../files/repo'
import type { Item, Notice, Space } from '../files/model'
import type { Person, Row } from '../model'
import { deliver, notice } from '../files/notify'
import type { FilingMove } from './shared'

// The notice and its recipient list are a durable part of filing. Replays only deliver queued notices,
// and delivery rechecks current access so revocation cannot disclose a new path or a file name.
export async function filingNotices(env:Bindings,s:Session,item:Row<Item>,move:Row<FilingMove>,destination:string){
 const rows:Row<Notice>[]=[],fences:Row[]=[]
 const active=new Set((await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active'").all<{email:string}>()).results.map(p=>p.email))
 for(const person of await list<Person>(env,'person')){
  if(!active.has(person.id)||person.payload.status==='inactive')continue
  const w=await whoFor(env,person.id),space=await get<Space>(env,'space',item.payload.space)
  const dest=move.payload.destination?await context(env,w,move.payload.destination):{space,chain:[],state:start(space.payload,w),links:[],fences:[space,...w.groups]}
  const state=descend(dest.state,item,w,dest.links)
  if(!allowed({space:dest.space,state},'view'))continue
  let visiblePath='Shared file'
  if(dest.chain.every((_,i)=>{let state=start(space.payload,w);for(const node of dest.chain.slice(0,i+1))state=descend(state,node,w,dest.links);return !!state.role}))visiblePath=destination
  const row=notice(person.id,'filing',item.id,s.operator.email,`Filed ${item.payload.name} → ${visiblePath}`);row.payload.undo=move.id;rows.push(row)
  fences.push(person,...w.groups,...dest.fences)
 }
 return {rows,fences}
}
export async function deliverFiling(env:Bindings,s:Session,rows:Row<Notice>[]){
 for(const row of rows){
  try{const w=await whoFor(env,row.payload.to),ctx=await context(env,w,row.payload.item!);demand(ctx,'view');await deliver(env,s,[row])}
  catch(error){if(!(error instanceof Error&&'code'in error))throw error;const current=await get<Notice>(env,'notice',row.id);if(current.payload.email==='queued')await commit(env,s,[{row:next(current,{...current.payload,email:'suppressed:access_revoked'}),previous:current}])}
 }
}
