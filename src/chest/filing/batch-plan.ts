import type { Bindings } from '../../auth.server'
import { cleared } from '../threats/guard'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { get, list } from '../store'
import { context, demand, who, type Who } from '../files/access'
import { admit, place, siblings, unique } from '../files/items'
import { effectiveGovernance, prepareFiling } from '../files/folder-metadata'
import type { Item } from '../files/model'
import { commit, fresh, spaceItems } from '../files/repo'
import { assertSQL, preserveAudience } from './shared'
import { preservePublicAudience } from './public-audience'
import { actions, fence, renamed, type Batch, type BatchItem } from './batch-model'
import { transform } from './transforms'

// A policy snapshot includes absence as well as revisions. Adding a policy or a capability after preview is stale.
export async function policySnapshot(env: Bindings) {
 const rows = (await Promise.all(['link-policy','link','public-link','group'].map(k => list(env,k)))).flat()
 return JSON.stringify(rows.map(fence).sort((a,b) => a.id.localeCompare(b.id)))
}
export function policyGuards(signature:string){
 const rows=JSON.parse(signature) as ReturnType<typeof fence>[]
 return [...['link-policy','link','public-link','group'].map(kind=>assertSQL("(SELECT count(*) FROM chest_records WHERE kind=?)=?",[kind,rows.filter(r=>r.kind===kind).length])),...rows.map(r=>assertSQL('EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind=? AND revision=?)',[r.id,r.kind,r.revision]))]
}
export async function checkPlan(env: Bindings, w: Who, entry: BatchItem) {
 const ctx = await context(env,w,entry.item); demand(ctx,'manage')
 const item = ctx.chain.at(-1)!
 insist(item.revision === entry.revision && item.payload.current === entry.version,'filing_stale',409)
 insist(await policySnapshot(env) === entry.policies,'filing_policy_changed',409)
 const fences: Row[] = []
 for (const f of entry.fences) { const row = await get(env,f.kind,f.id); insist(row.revision === f.revision,'filing_permissions_changed',409); fences.push(row) }
 const dest = await place(env,w,item.payload.space,entry.destination)
 preserveAudience(ctx,dest,item); await preservePublicAudience(env,ctx,dest,item)
 const payload = await prepareFiling(env,dest,{...item.payload,governance:effectiveGovernance(ctx,item.payload)})
 unique(await siblings(env,item.payload.space,entry.destination),entry.afterName,item.id)
 return {ctx,item,dest,fences,payload}
}
export async function previewBatch(env: Bindings, s: Session, input: any) {
 const w=await who(env,s), action=actions(input.actions)
 insist(Array.isArray(input.items) && input.items.length>0 && input.items.length<=100 && input.items.every((x:unknown)=>typeof x==='string'),'select_one_to_100_items')
 const selected = new Map<string,Row<Item>>()
 for (const key of input.items) {
  const ctx=await context(env,w,key);demand(ctx,'manage');const row=ctx.chain.at(-1)!
  if(row.payload.type==='file')selected.set(row.id,row)
  else {
   const tree=await spaceItems(env,row.payload.space), inside=new Set([row.id]);let grew=true
   while(grew){grew=false;for(const child of tree)if(child.payload.parent&&inside.has(child.payload.parent)&&!inside.has(child.id)){inside.add(child.id);grew=true}}
   for(const child of tree)if(inside.has(child.id)&&child.payload.type==='file'&&!child.payload.trash){const c=await context(env,w,child.id);demand(c,'manage');selected.set(child.id,child)}
  }
  insist(selected.size<=100,'filing_batch_too_large',413)
 }
 insist(selected.size,'filing_no_files')
 const policies=await policySnapshot(env), items:BatchItem[]=[]
 for(const item of selected.values()) {
  const version=item.payload.current;insist(version,'file_without_version')
  const entry:BatchItem={item:item.id,name:item.payload.name,version,revision:item.revision,before:item.payload,afterName:item.payload.name,destination:item.payload.parent,path:'',fences:[],policies,derivatives:[],state:'ready'}
  try {
   entry.afterName=renamed(item.payload.name,action.rename);entry.destination=action.destination===undefined?item.payload.parent:action.destination
   const ctx=await context(env,w,item.id);demand(ctx,'manage')
   const dest=await place(env,w,item.payload.space,entry.destination)
   preserveAudience(ctx,dest,item);const publicAudience=await preservePublicAudience(env,ctx,dest,item)
   await prepareFiling(env,dest,{...item.payload,governance:effectiveGovernance(ctx,item.payload)})
   unique(await siblings(env,item.payload.space,entry.destination),entry.afterName,item.id)
   entry.path=[dest.space.payload.name,...dest.chain.map(n=>n.payload.name),entry.afterName].join(' / ')
   entry.fences=[...new Map([...ctx.fences,...dest.fences,...publicAudience.links].map(r=>[r.id,fence(r)])).values()]
   if(action.convert||action.unzip) {
    demand(ctx,'download');const v=item.payload.versions.find(v=>v.id===version)!
    insist(v.size<=16*1024*1024,'filing_transform_too_large',413)
    await cleared(env,v.checksum,v.size)
    const blob=await env.BLOBS.get(`sha256/${v.checksum}`);insist(blob,'blob_missing',503)
    const outputs=await transform(new Uint8Array(await blob.arrayBuffer()),entry.afterName,action.unzip?'unzip':'convert')
    for(const output of outputs)entry.derivatives.push({path:output.path,version:await admit(env,output.bytes,output.path.split('/').at(-1)!,s.operator.email,'created',{}, {transformation:{sourceItem:item.id,sourceVersion:version,operation:action.unzip?'unzip':'convert'}})})
   }
   await checkPlan(env,w,entry)
  }catch(error){if(!(error instanceof ChestError))throw error;entry.state='blocked';entry.reason=error.code;entry.derivatives=[]}
  items.push(entry)
 }
 const row=fresh<Batch>('filing_batch',{by:s.operator.email,at:now(),actions:action,items})
 await commit(env,s,[{row}],{audits:[{action:'filing.batch.preview',object:row.id,detail:{items:items.length,actions:action}}]})
 return row
}
