import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { list } from '../store'
import { context, demand, who } from '../files/access'
import type { Batch } from './batch-model'
import { previewBatch } from './batch-plan'
import { changeBatch } from './batch-apply'
export async function batchesExecute(env:Bindings,s:Session,method:string,parts:string[],input:any):Promise<any>{
 if(parts[0]!=='filing'||parts[1]!=='batches')return undefined
 if(method==='GET'){
  const w=await who(env,s),rows=[]
  for(const row of (await list<Batch>(env,'filing_batch')).filter(r=>r.payload.by===s.operator.email)){
   const items=[];for(const item of row.payload.items){try{demand(await context(env,w,item.item),'manage');items.push(item)}catch{}}
   if(items.length)rows.push({...row,payload:{...row.payload,items}})
  }
  return {batches:rows.sort((a,b)=>b.payload.at.localeCompare(a.payload.at))}
 }
 insist(method==='POST','method_not_allowed',405)
 if(!parts[2])return previewBatch(env,s,input)
 insist(['apply','undo'].includes(parts[3]),'invalid_action')
 const row=await changeBatch(env,s,parts[2],parts[3]),visible=await batchesExecute(env,s,'GET',['filing','batches'],{})
 return visible.batches.find((r:any)=>r.id===row.id)??{id:row.id,payload:{items:[]}}
}
