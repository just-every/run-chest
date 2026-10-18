import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { who, type Who } from '../files/access'
import { commit, fresh, maybe, next } from '../files/repo'
import { get } from '../store'
import { insist, now, type Row } from '../model'
import { current, decisionId, stateId, type Decline, type DuplicateState, type Merge } from './duplicate-model'
import { mergeBrief } from './duplicate-view'
import { contextFences, managedPair, ownerGuards } from './duplicate-authority'
import { candidate, evidenceFences, reconcile, sourceInventory } from './duplicate-evidence'
import { proposals } from './duplicate-proposals'
import { previewReferences, decideReferences, undoReferences } from './duplicate-repair'
export { hiddenMerged, mergeView } from './duplicate-view'

const membership=(item:string,previous:Row<DuplicateState>|null,payload:DuplicateState)=>({row:previous?next(previous,payload):fresh('duplicate_state',payload,stateId(item)),previous:previous??undefined})
async function pair(env:Bindings,s:Session,w:Who,input:any){
 const p=await managedPair(env,s,w,input)
 const [as,bs]=await Promise.all([maybe<DuplicateState>(env,'duplicate_state',stateId(p.a.id)),maybe<DuplicateState>(env,'duplicate_state',stateId(p.b.id))])
 return {...p,as,bs}
}
function expected(input:any,a:Row,b:Row){
 if(input.keepVersion!==undefined)insist(input.keepVersion===a.payload.current,'duplicate_content_changed',409)
 if(input.duplicateVersion!==undefined)insist(input.duplicateVersion===b.payload.current,'duplicate_content_changed',409)
}
async function merge(env:Bindings,s:Session,w:Who,input:any){
 const {a,b,keep,duplicate,as,bs}=await pair(env,s,w,input)
 expected(input,a,b)
 insist(!as?.payload.duplicateMerge&&!bs?.payload.duplicateMerge&&!bs?.payload.duplicateMerges?.length,'already_merged',409)
 insist(!await maybe(env,'duplicate_decline',decisionId(a.payload,b.payload,a.id,b.id)),'duplicate_proposal_declined',409)
 const av=current(a.payload),bv=current(b.payload);insist(av&&bv,'version_not_found',404)
 const sources=await sourceInventory(env,s),ae=await candidate(env,a,sources),be=await candidate(env,b,sources),comparison=reconcile(ae,be)
 insist(comparison,'duplicate_content_changed',409)
 const receipt=fresh<Merge>('duplicate_merge',{keep:a.id,duplicate:b.id,keepVersion:av.id,duplicateVersion:bv.id,reason:comparison.reason,similarity:comparison.similarity,at:now(),by:s.operator.email,undone:null})
 const canonical=membership(a.id,as,{item:a.id,duplicateMerges:[...as?.payload.duplicateMerges??[],receipt.id]}),alias=membership(b.id,bs,{item:b.id,duplicateMerge:{keep:a.id,merge:receipt.id}})
 await commit(env,s,[canonical,alias,{row:receipt}],{fences:[...contextFences([keep,duplicate]),...evidenceFences(ae,be)],statements:[...ownerGuards(s,[keep,duplicate]),{sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?) THEN 1 ELSE 0 END',params:[decisionId(a.payload,b.payload,a.id,b.id)]}],changes:[a,b].map(r=>({item:r.id,space:r.payload.space,kind:'duplicate.merge'})),audits:[{action:'duplicate.merge',object:a.id,detail:{merge:receipt.id,duplicate:b.id,reason:comparison.reason,keepVersion:av.id,duplicateVersion:bv.id}}]})
 return mergeBrief(s,receipt,keep,duplicate)
}
async function decline(env:Bindings,s:Session,w:Who,input:any){
 const {a,b,keep,duplicate}=await managedPair(env,s,w,input);expected(input,a,b)
 const key=decisionId(a.payload,b.payload,a.id,b.id),previous=await maybe<Decline>(env,'duplicate_decline',key)
 if(previous)return {id:previous.id,...previous.payload}
 const sources=await sourceInventory(env,s),ae=await candidate(env,a,sources),be=await candidate(env,b,sources)
 insist(reconcile(ae,be),'duplicate_content_changed',409)
 const row=fresh<Decline>('duplicate_decline',{keep:a.id,duplicate:b.id,keepVersion:a.payload.current!,duplicateVersion:b.payload.current!,at:now(),by:s.operator.email},key)
 await commit(env,s,[{row}],{fences:[...contextFences([keep,duplicate]),...evidenceFences(ae,be)],statements:ownerGuards(s,[keep,duplicate]),audits:[{action:'duplicate.decline',object:a.id,detail:{duplicate:b.id,keepVersion:row.payload.keepVersion,duplicateVersion:row.payload.duplicateVersion}}]})
 return {id:row.id,...row.payload}
}
async function undo(env:Bindings,s:Session,w:Who,key:string){
 const receipt=await get<Merge>(env,'duplicate_merge',key),p=receipt.payload
 const {a,b,keep,duplicate,as,bs}=await pair(env,s,w,p)
 insist(!p.undone,'merge_already_undone',409)
 insist(bs?.payload.duplicateMerge?.merge===key&&as?.payload.duplicateMerges?.includes(key),'merge_state_changed',409)
 const canonical:DuplicateState={item:a.id,duplicateMerges:as!.payload.duplicateMerges!.filter(id=>id!==key)};if(!canonical.duplicateMerges!.length)delete canonical.duplicateMerges
 const done=next(receipt,{...p,undone:{at:now(),by:s.operator.email}})
 await commit(env,s,[membership(a.id,as,canonical),membership(b.id,bs,{item:b.id}),{row:done,previous:receipt}],{fences:contextFences([keep,duplicate]),statements:ownerGuards(s,[keep,duplicate]),changes:[a,b].map(r=>({item:r.id,space:r.payload.space,kind:'duplicate.undo'})),audits:[{action:'duplicate.undo',object:a.id,detail:{merge:key,duplicate:b.id}}]})
 return mergeBrief(s,done,keep,duplicate)
}
export async function duplicatesExecute(env:Bindings,s:Session,method:string,parts:string[],input:any,url:URL):Promise<unknown>{
 if(parts[0]!=='filing'||parts[1]!=='duplicates')return undefined
 const w=await who(env,s)
 if(method==='GET'&&parts.length===2)return proposals(env,s,w,url)
 if(method==='POST'&&parts.length===3){
  if(parts[2]==='merge')return merge(env,s,w,input)
  if(parts[2]==='decline')return decline(env,s,w,input)
  if(parts[2]==='references')return previewReferences(env,s,w,input)
 }
 if(method==='POST'&&parts[2]==='references'&&parts.length===4)return decideReferences(env,s,w,parts[3],input)
 if(method==='POST'&&parts[2]==='references'&&parts[4]==='undo'&&parts.length===5)return undoReferences(env,s,w,parts[3])
 if(method==='POST'&&parts[2]&&parts[3]==='undo'&&parts.length===4)return undo(env,s,w,parts[2])
 return undefined
}
