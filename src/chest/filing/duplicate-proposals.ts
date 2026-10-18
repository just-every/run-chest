import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { allowed, everything, type Who } from '../files/access'
import { list } from '../store'
import { current, decisionId, type Decline, type DuplicateState, type Merge, type ReferencePlan, type ReferenceReceipt } from './duplicate-model'
import { candidate, lineageBrief, reconcile, sourceInventory } from './duplicate-evidence'
import { mergeBrief, visibleContext } from './duplicate-view'
import { referenceReceiptBrief } from './duplicate-repair'

export async function proposals(env:Bindings,s:Session,w:Who,url:URL){
 const all=await everything(env,w),space=url.searchParams.get('space'),folder=url.searchParams.get('parent')
 const states=new Map((await list<DuplicateState>(env,'duplicate_state')).map(r=>[r.payload.item,r.payload]))
 const declines=new Map((await list<Decline>(env,'duplicate_decline')).map(r=>[r.id,r]))
 const files=[...all.values()].filter(e=>e.row.payload.type==='file'&&!e.state.trash&&allowed(e,'view')&&current(e.row.payload)&&!states.get(e.row.id)?.duplicateMerge&&(!space||e.row.payload.space===space)&&(!folder||e.row.payload.parent===folder))
 files.sort((a,b)=>a.row.payload.createdAt.localeCompare(b.row.payload.createdAt)||a.row.id.localeCompare(b.row.id))
 const sources=await sourceInventory(env,s),candidates=await Promise.all(files.map(async entry=>({entry,candidate:await candidate(env,entry.row,sources)}))),found=[],declined=[]
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
  let a=candidates[i],b=candidates[j]
  if(!states.get(a.entry.row.id)?.duplicateMerges?.length&&states.get(b.entry.row.id)?.duplicateMerges?.length)[a,b]=[b,a]
  const similarity=reconcile(a.candidate,b.candidate);if(!similarity)continue
  const p={keep:{...lineageBrief(a.candidate),spaceName:a.entry.space.payload.name},duplicate:{...lineageBrief(b.candidate),spaceName:b.entry.space.payload.name},...similarity,
   canMerge:s.operator.role==='owner'&&allowed(a.entry,'manage')&&allowed(b.entry,'manage')&&!states.get(b.entry.row.id)?.duplicateMerges?.length}
  const decision=declines.get(decisionId(a.entry.row.payload,b.entry.row.payload,a.entry.row.id,b.entry.row.id))
  if(decision)declined.push({...p,decision:{at:decision.payload.at,by:decision.payload.by}});else found.push(p)
 }
 const merges=[]
 for(const row of await list<Merge>(env,'duplicate_merge')){
  const keep=await visibleContext(env,w,row.payload.keep),duplicate=await visibleContext(env,w,row.payload.duplicate)
  if(keep&&duplicate)merges.push(mergeBrief(s,row,keep,duplicate))
 }
 const plans=[],repairs=[]
 if(s.operator.role==='owner'){
  for(const row of await list<ReferencePlan>(env,'duplicate_reference_plan'))if(await visibleContext(env,w,row.payload.keep)&&await visibleContext(env,w,row.payload.duplicate))plans.push({id:row.id,...row.payload})
  for(const row of await list<ReferenceReceipt>(env,'duplicate_reference_receipt'))if(await visibleContext(env,w,row.payload.keep)&&await visibleContext(env,w,row.payload.duplicate))repairs.push(referenceReceiptBrief(row))
 }
 merges.sort((a,b)=>b.at.localeCompare(a.at));plans.sort((a,b)=>b.at.localeCompare(a.at));repairs.sort((a,b)=>b.at.localeCompare(a.at))
 return {proposals:found,declined,merges,plans,repairs,counts:{proposals:found.length,merges:merges.length,declined:declined.length},scope:'accessible files and their retained originals'}
}
