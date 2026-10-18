import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { get } from '../store'
import { context, demand, who, type Who } from '../files/access'
import { place, siblings, unique } from '../files/items'
import { versionPublication } from '../files/governance'
import { effectiveGovernance } from '../files/folder-metadata'
import { name, type Item } from '../files/model'
import { commit, fresh, next, spaceItems, type Op } from '../files/repo'
import { assertSQL } from './shared'
import { checkPlan, policySnapshot, policyGuards } from './batch-plan'
import { fence, type Batch, type BatchItem } from './batch-model'

export const collision = (row:Row<Item>) => assertSQL("NOT EXISTS(SELECT 1 FROM chest_records WHERE kind='item' AND id<>? AND json_extract(payload,'$.space')=? AND json_extract(payload,'$.parent') IS ? AND json_extract(payload,'$.trash') IS NULL AND lower(json_extract(payload,'$.name'))=lower(?))",[row.id,row.payload.space,row.payload.parent,row.payload.name])
async function applyItem(env:Bindings,s:Session,w:Who,batch:Row<Batch>,index:number) {
 const entry=batch.payload.items[index],{ctx,item,dest,fences,payload}=await checkPlan(env,w,entry)
 const at=now(),updated=next(item,{...payload,parent:entry.destination,name:entry.afterName,tags:[...new Set([...(item.payload.tags??[]),...(batch.payload.actions.tag?[batch.payload.actions.tag]:[])])],updatedAt:at})
 const created:Row<Item>[]=[],ops:Op[]=[{row:updated,previous:item}],reserved=new Map<string,Row<Item>>()
 const base:Item={...item.payload,parent:entry.destination,name:'',createdAt:at,createdBy:s.operator.email,updatedAt:at,trash:null,versions:[],current:null,approved:null,governance:effectiveGovernance(ctx,item.payload),noDownload:ctx.state.noDownload||item.payload.noDownload}
 let root:string|null=entry.destination
 if(batch.payload.actions.unzip){const folder=fresh<Item>('item',{...base,type:'folder',name:name(entry.afterName.replace(/\.[^.]+$/,'')+' extracted')});unique(await siblings(env,item.payload.space,root),folder.payload.name);created.push(folder);root=folder.id;reserved.set('',folder)}
 for(const derivative of entry.derivatives){
  const parts=derivative.path.split('/');let parent=root,path=''
  for(const segment of parts.slice(0,-1)){
   path=path?path+'/'+segment:segment;let folder=reserved.get(path)
   if(!folder){folder=fresh<Item>('item',{...base,type:'folder',name:name(segment),parent,restricted:false,grants:[]});created.push(folder);reserved.set(path,folder)}
   parent=folder.id
  }
  const filename=name(parts.at(-1)!)
  if(!batch.payload.actions.unzip)unique(await siblings(env,item.payload.space,parent),filename)
  const derivativeCtx={...dest,chain:[...dest.chain,...created.filter(r=>r.payload.type==='folder'&&(r.id===parent||r.id===root))]}
  const original={...base,type:'file' as const,parent,name:filename,...(batch.payload.actions.unzip?{restricted:false,grants:[]}:{})}
  const output=fresh<Item>('item',await versionPublication(env,derivativeCtx,original,derivative.version))
  insist(await env.BLOBS.head(`sha256/${derivative.version.checksum}`),'blob_missing',503);created.push(output)
 }
 ops.push(...created.map(row=>({row})))
 const result:BatchItem={...entry,state:'applied',appliedRevision:updated.revision,created:created.map(fence)}
 const row=next(batch,{...batch.payload,items:batch.payload.items.map((e,n)=>n===index?result:e)})
 await commit(env,s,[...ops,{row,previous:batch}],{fences:[...fences,...ctx.fences,...dest.fences],statements:[...policyGuards(entry.policies),collision(updated),...created.map(collision)],changes:[updated,...created].map(r=>({item:r.id,space:r.payload.space,kind:'filing'})),audits:[{action:'filing.batch.apply',object:item.id,detail:{batch:batch.id,version:entry.version,actions:batch.payload.actions,policy:entry.fences,created:created.map(r=>r.id)}}]})
 return row
}
async function undoItem(env:Bindings,s:Session,w:Who,batch:Row<Batch>,index:number){
 const entry=batch.payload.items[index],ctx=await context(env,w,entry.item);demand(ctx,'manage')
 const current=ctx.chain.at(-1)!;insist(current.revision===entry.appliedRevision,'filing_undo_stale',409)
 insist(await policySnapshot(env)===entry.policies,'filing_policy_changed',409)
 const fences:Row[]=[]
 for(const f of entry.fences.filter(f=>f.id!==entry.item)){const row=await get(env,f.kind,f.id);insist(row.revision===f.revision,'filing_permissions_changed',409);fences.push(row)}
 const dest=await place(env,w,entry.before.space,entry.before.parent)
 unique(await siblings(env,entry.before.space,entry.before.parent),entry.before.name,entry.item)
 const originals:Row<Item>[]=[]
 for(const f of entry.created??[]){const row=await get<Item>(env,'item',f.id);insist(row.revision===f.revision,'filing_undo_stale',409);originals.push(row)}
 const ids=new Set(originals.map(r=>r.id));insist(!(await spaceItems(env,entry.before.space)).some(r=>r.payload.parent&&ids.has(r.payload.parent)&&!ids.has(r.id)),'filing_undo_stale',409)
 const row=next(current,{...entry.before,updatedAt:now()}),updated=next(batch,{...batch.payload,items:batch.payload.items.map((e,n)=>n===index?{...entry,state:'undone' as const}:e)})
 await commit(env,s,[{row,previous:current},...originals.map(r=>({row:next(r,{...r.payload,trash:{by:s.operator.email,at:now(),role:ctx.state.role!}}),previous:r})),{row:updated,previous:batch}],{fences:[...ctx.fences,...dest.fences,...fences],statements:[...policyGuards(entry.policies),collision(row)],changes:[{item:entry.item,space:entry.before.space,kind:'filing.undo'}],audits:[{action:'filing.batch.undo',object:entry.item,detail:{batch:batch.id,version:entry.version,derivativesRetainedInTrash:originals.map(r=>r.id)}}]})
 return updated
}
export async function changeBatch(env:Bindings,s:Session,key:string,action:string){
 let batch=await get<Batch>(env,'filing_batch',key);insist(batch.payload.by===s.operator.email,'filing_plan_owner_required',403)
 const w=await who(env,s)
 for(let index=0;index<batch.payload.items.length;index++){
  const entry=batch.payload.items[index];if(entry.state!==(action==='undo'?'applied':'ready'))continue
  try{batch=await(action==='undo'?undoItem:applyItem)(env,s,w,batch,index)}
  catch(error){
   const conflict=String(error).includes('CHECK constraint failed');if(!(error instanceof ChestError)&&!conflict)throw error
   batch=await get<Batch>(env,'filing_batch',key);const current=batch.payload.items[index];if(current.state!==entry.state)continue
   const failed={...current,...(action==='undo'?{}:{state:'blocked' as const}),reason:error instanceof ChestError?error.code:'filing_changed_during_execution'}
   const updated=next(batch,{...batch.payload,items:batch.payload.items.map((e,n)=>n===index?failed:e)})
   await commit(env,s,[{row:updated,previous:batch}],{audits:[{action:`filing.batch.${action}.blocked`,object:entry.item,detail:{batch:key,reason:failed.reason}}]});batch=updated
  }
 }
 return batch
}
