import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get,list } from '../store'
import { insist,now,type Row } from '../model'
import { commit,fresh,next } from '../files/repo'
import { plan,apply,type Receipt } from '../files/rewind'
import { who } from '../files/access'
import type { Space } from '../files/model'
import { requireAdmin,canAdmin } from './roles'

type RecoveryPlan={by:string;at:string;preparedAt:string;state:'prepared'|'partial'|'complete';scopes:{space:string;preview:Awaited<ReturnType<typeof plan>>;receipt?:string;applied?:string[];error?:string}[]}
async function scopes(env:Bindings,s:Session,input:any){
 const spaces=await list<Space>(env,'space')
 if(input.email){const email=String(input.email).toLowerCase();await requireAdmin(env,s,'content-recovery',email);return spaces.filter(r=>r.payload.kind==='personal'&&(r.payload.owner===email||r.payload.formerOwner===email))}
 const space=await get<Space>(env,'space',String(input.space));await requireAdmin(env,s,'content-recovery',space.payload.formerOwner??(space.payload.owner||space.payload.createdBy));return [space]
}
function recoverySession(s:Session):Session{return Object.assign({...s},{administrationRecovery:true})}
function publicPlan(row:Row<RecoveryPlan>){return {id:row.id,state:row.payload.state,at:row.payload.at,preparedAt:row.payload.preparedAt,scopes:row.payload.scopes.map(scope=>({space:scope.space,receipt:scope.receipt,applied:scope.applied??[],error:scope.error,changes:scope.preview.changes.map(c=>({id:c.id,kinds:c.kinds,version:c.version,versionAt:c.versionAt,changesHierarchy:!!c.moveTo,changesName:!!c.renameTo})),sharing:{restored:false,changes:scope.preview.sharing.removedSince.map(e=>({object:e.object,action:e.action,at:e.at}))}}))}}
export async function recoveryTargets(env:Bindings,s:Session){
 const spaces=[];for(const r of await list<Space>(env,'space'))if(await canAdmin(env,s,'content-recovery',r.payload.formerOwner??(r.payload.owner||r.payload.createdBy)))spaces.push({id:r.id,kind:r.payload.kind,owner:r.payload.owner,formerOwner:r.payload.formerOwner})
 return spaces
}
export async function prepareRecovery(env:Bindings,s:Session,input:any){
 const selected=await scopes(env,s,input);insist(selected.length,'recovery_scope_not_found',404);const w=await who(env,s),previews=[]
 for(const space of selected)previews.push({space:space.id,preview:await plan(env,recoverySession(s),w,{space:space.id,at:input.at})})
 const row=fresh<RecoveryPlan>('admin-recovery-plan',{by:s.operator.email,at:new Date(input.at).toISOString(),preparedAt:now(),state:'prepared',scopes:previews})
 await commit(env,s,[{row}],{audits:[{action:'admin.recovery.preview',object:row.id,detail:{scopeCount:previews.length,itemCount:previews.reduce((n,p)=>n+p.preview.changes.length,0)}}]});return publicPlan(row)
}
export async function recoveryView(env:Bindings,s:Session,key:string){const row=await get<RecoveryPlan>(env,'admin-recovery-plan',key);for(const scope of row.payload.scopes)await scopes(env,s,{space:scope.space});return publicPlan(row)}
export async function applyRecovery(env:Bindings,s:Session,key:string,input:any){
 let row=await get<RecoveryPlan>(env,'admin-recovery-plan',key);insist(row.payload.by===s.operator.email,'recovery_plan_actor_changed',403);insist(row.payload.state!=='complete','recovery_already_complete',409)
 const selected=Array.isArray(input.items)?new Set<string>(input.items):null;insist(selected&&selected.size,'select_recovery_items')
 for(let index=0;index<row.payload.scopes.length;index++){
  const scope=row.payload.scopes[index];if(scope.receipt)continue
  await scopes(env,s,{space:scope.space});const chosen=scope.preview.changes.filter(c=>selected.has(c.id)).map(c=>c.id);if(!chosen.length)continue
  const updatedScope={...scope}
  try{const result=await apply(env,recoverySession(s),await who(env,s),{space:scope.space,at:row.payload.at,fingerprint:scope.preview.fingerprint,items:chosen});updatedScope.receipt=result.id;updatedScope.applied=result.applied;delete updatedScope.error}
  catch(error){updatedScope.error=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'recovery_not_completed'}
  const updated=next(row,{...row.payload,scopes:row.payload.scopes.map((value,i)=>i===index?updatedScope:value),state:'partial' as const});await commit(env,s,[{row:updated,previous:row}],{audits:[{action:'admin.recovery.scope',object:row.id,detail:{space:scope.space,receipt:updatedScope.receipt??null,error:updatedScope.error??null}}]});row=updated
 }
 const failed=row.payload.scopes.some(scope=>scope.error),updated=next(row,{...row.payload,state:failed?'partial' as const:'complete' as const});await commit(env,s,[{row:updated,previous:row}],{audits:[{action:'admin.recovery.finish',object:row.id,detail:{state:updated.payload.state}}]});return publicPlan(updated)
}
