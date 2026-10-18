import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Who } from '../files/access'
import { commit, fresh, next, type Op } from '../files/repo'
import { get } from '../store'
import { insist, now } from '../model'
import { managedPair, contextFences, ownerGuards } from './duplicate-authority'
import { candidate, evidenceFences, reconcile, sourceInventory } from './duplicate-evidence'
import { referenceInventory, referencePatch } from './duplicate-references'
import type { ReferencePlan, ReferenceReceipt } from './duplicate-model'

const brief=(row:{id:string;payload:ReferenceReceipt})=>({id:row.id,...row.payload,changes:row.payload.changes.map(c=>({id:c.id,kind:c.kind})),canUndo:!row.payload.undone})
export async function previewReferences(env:Bindings,s:Session,w:Who,input:any) {
 const pair=await managedPair(env,s,w,input),sources=await sourceInventory(env,s),a=await candidate(env,pair.a,sources),b=await candidate(env,pair.b,sources)
 if(input.keepVersion!==undefined)insist(input.keepVersion===pair.a.payload.current,'duplicate_content_changed',409)
 if(input.duplicateVersion!==undefined)insist(input.duplicateVersion===pair.b.payload.current,'duplicate_content_changed',409)
 insist(reconcile(a,b),'duplicate_content_changed',409)
 const inventory=await referenceInventory(env,s,w,pair.b,pair.a)
 const row=fresh<ReferencePlan>('duplicate_reference_plan',{keep:pair.a.id,duplicate:pair.b.id,keepRevision:pair.a.revision,duplicateRevision:pair.b.revision,keepVersion:pair.a.payload.current!,duplicateVersion:pair.b.payload.current!,references:inventory.references,at:now(),by:s.operator.email,state:'pending'})
 await commit(env,s,[{row}],{fences:[...contextFences([pair.keep,pair.duplicate]),...evidenceFences(a,b)],statements:ownerGuards(s,[pair.keep,pair.duplicate]),audits:[{action:'duplicate.references.preview',object:pair.a.id,detail:{plan:row.id,source:pair.b.id,version:row.payload.keepVersion}}]})
 return {id:row.id,...row.payload,notice:'Only selected Chest references change. Pinned versions and vendor URLs keep their original targets; external capabilities need separate owner approval.'}
}
export async function decideReferences(env:Bindings,s:Session,w:Who,id:string,input:any) {
 const plan=await get<ReferencePlan>(env,'duplicate_reference_plan',id),p=plan.payload,pair=await managedPair(env,s,w,p)
 insist(p.state==='pending','reference_plan_closed',409)
 if(input.action==='decline'){
  await commit(env,s,[{row:next(plan,{...p,state:'declined'}),previous:plan}],{fences:contextFences([pair.keep,pair.duplicate]),statements:ownerGuards(s,[pair.keep,pair.duplicate]),audits:[{action:'duplicate.references.decline',object:p.keep,detail:{plan:id}}]})
  return {id,state:'declined'}
 }
 insist(pair.a.revision===p.keepRevision&&pair.b.revision===p.duplicateRevision,'reference_plan_stale',409)
 const selected:string[]=Array.isArray(input.references)?input.references:[input.reference]
 insist(selected.length>0&&selected.every(v=>typeof v==='string')&&new Set(selected).size===selected.length,'choose_references')
 const inventory=await referenceInventory(env,s,w,pair.b,pair.a),ops:Op[]=[],changes:ReferenceReceipt['changes']=[]
 for(const refId of selected){
  const proposed=p.references.find(r=>r.id===refId),live=inventory.references.find(r=>r.id===refId),row=inventory.rows.find(r=>r.id===refId)
  insist(proposed&&live&&row&&!proposed.blocked&&!live.blocked,'reference_repair_refused',409)
  insist(live.revision===proposed.revision&&live.version===proposed.version,'reference_plan_stale',409)
  if(live.kind!=='prefs')insist(input.approveExternal===true||input.approveExternal==='yes','external_repoint_approval_required',403)
  const patch=referencePatch(live,row,p.duplicate,p.keep),before=Object.fromEntries(Object.keys(patch).map(key=>[key,row.payload[key]])),updated=next(row,{...row.payload,...patch})
  ops.push({row:updated,previous:row});changes.push({id:row.id,kind:live.kind,revision:updated.revision,originalVersion:live.sourceVersion,before,after:patch})
 }
 const receipt=fresh<ReferenceReceipt>('duplicate_reference_receipt',{keep:p.keep,duplicate:p.duplicate,keepVersion:p.keepVersion,duplicateVersion:p.duplicateVersion,at:now(),by:s.operator.email,changes,undone:null})
 await commit(env,s,[...ops,{row:receipt},{row:next(plan,{...p,state:'applied',receipt:receipt.id}),previous:plan}],{fences:[...contextFences([pair.keep,pair.duplicate,...inventory.contexts]),...inventory.fences],statements:[...ownerGuards(s,[pair.keep,pair.duplicate,...inventory.contexts]),...inventory.statements],changes:[{item:p.keep,space:pair.a.payload.space,kind:'duplicate.references'},{item:p.duplicate,space:pair.b.payload.space,kind:'duplicate.references'}],audits:[{action:'duplicate.references.apply',object:p.keep,detail:{plan:id,receipt:receipt.id,source:p.duplicate,references:selected,version:p.keepVersion,externalApproved:input.approveExternal===true||input.approveExternal==='yes'}}]})
 return brief(receipt)
}
export async function undoReferences(env:Bindings,s:Session,w:Who,id:string){
 const receipt=await get<ReferenceReceipt>(env,'duplicate_reference_receipt',id),p=receipt.payload,pair=await managedPair(env,s,w,p)
 insist(!p.undone,'reference_repair_already_undone',409)
 // Undo is also an explicit owner action. Recheck the old target's current sharing policy and each bookmark
 // owner's access. Never revive a revoked link or silently clobber any intervening preference/link change.
 const inventory=await referenceInventory(env,s,w,pair.a,pair.b),ops:Op[]=[]
 for(const change of p.changes){
  const row=await get(env,change.kind,change.id),ref=inventory.references.find(r=>r.id===change.id)
  insist(row.revision===change.revision,'reference_changed_since_repair',409)
  insist(ref&&!ref.blocked&&ref.version===change.originalVersion,'reference_undo_refused',409)
  ops.push({row:next(row,{...row.payload,...change.before}),previous:row})
 }
 const updated=next(receipt,{...p,undone:{at:now(),by:s.operator.email}})
 await commit(env,s,[...ops,{row:updated,previous:receipt}],{fences:[...contextFences([pair.keep,pair.duplicate,...inventory.contexts]),...inventory.fences],statements:[...ownerGuards(s,[pair.keep,pair.duplicate,...inventory.contexts]),...inventory.statements],changes:[{item:p.keep,space:pair.a.payload.space,kind:'duplicate.references.undo'},{item:p.duplicate,space:pair.b.payload.space,kind:'duplicate.references.undo'}],audits:[{action:'duplicate.references.undo',object:p.keep,detail:{receipt:id,source:p.duplicate}}]})
 return brief(updated)
}
export {brief as referenceReceiptBrief}
