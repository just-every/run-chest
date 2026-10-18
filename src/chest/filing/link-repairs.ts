import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { ChestError, insist, now } from '../model'
import { context, demand, who, whoFor } from '../files/access'
import { commit, fresh, maybe, next } from '../files/repo'
import type { LinkScope, Repair } from './link-model'
import { scanLinks } from './link-scan'
import { repairLink, undoRepair } from './link-repair-actions'
const scopeId=(by:string,item:string)=>`link-scope:${by}:${item}`
export async function repairView(env:Bindings,s:Session){
 const w=await who(env,s),scopes=[]
 for(const row of (await list<LinkScope>(env,'link-scope')).filter(r=>r.payload.by===w.email)){
  try{const scan=await scanLinks(env,w,row.payload.item,row.payload.intended);scopes.push({id:row.id,...row.payload,name:scan.name,findings:scan.findings})}
  catch(e){if(!(e instanceof ChestError && [403,404].includes(e.status)))throw e;scopes.push({id:row.id,...row.payload,name:'Scope no longer accessible',findings:[],blocked:true})}
 }
 const history=[]
 for(const r of await list<Repair>(env,'link-repair')){
  if(r.payload.by!==w.email)continue
  try{const ctx=await context(env,w,r.payload.item);demand(ctx,'share');const p=r.payload;history.push({id:r.id,item:p.item,name:ctx.chain.at(-1)!.payload.name,link:p.link,action:p.action,at:p.at,automatic:p.automatic,undone:p.undone,canUndo:s.operator.role==='owner'&&!p.undone&&p.action!=='decline'})}catch(e){if(!(e instanceof ChestError && [403,404].includes(e.status)))throw e}
 }
 return {scopes,history:history.sort((a,b)=>b.at.localeCompare(a.at)),owner:s.operator.role==='owner'}
}
export async function linkRepairsExecute(env:Bindings,s:Session,method:string,parts:string[],input:any){
 if(parts[0]!=='link-repairs')return undefined
 const w=await who(env,s)
 if(method==='GET')return repairView(env,s)
 if(method==='POST' && parts[1]==='scope'){
  const item=String(input.item),ctx=await context(env,w,item);demand(ctx,'share')
  const automatic=input.automatic===true || input.automatic==='true'
  // Standing grants authorize restrictive revocation and the notification to the grant's owner, never new access.
  const intended=[...new Set(String(input.intended??'').split(/[;,\n]/).map(x=>x.trim().toLowerCase()).filter(Boolean))]
  insist(intended.length<=100 && intended.every(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)),'invalid_collaborators')
  const old=await maybe<LinkScope>(env,'link-scope',scopeId(w.email,item)),payload:LinkScope={item,by:w.email,intended,automatic,lastScan:null}
  await commit(env,s,[{row:old?next(old,payload):fresh('link-scope',payload,scopeId(w.email,item)),previous:old??undefined}],{fences:ctx.fences,audits:[{action:'link.repair.scope',object:item,detail:{before:old?.payload??null,after:payload}}]})
  return repairView(env,s)
 }
 if(method==='POST' && parts[1]==='scan'){
  const scope=await get<LinkScope>(env,'link-scope',scopeId(w.email,String(input.item)))
  const scan=await scanLinks(env,w,scope.payload.item,scope.payload.intended)
  await commit(env,s,[{row:next(scope,{...scope.payload,lastScan:now()}),previous:scope}],{fences:scan.fences,audits:[{action:'link.repair.scan',object:scan.item,detail:{findings:scan.findings.length,links:scan.findings.map(f=>f.id)}}]})
  return scan.findings
 }
 if(method==='POST' && parts[1]==='apply'){
  const scope=await maybe<LinkScope>(env,'link-scope',scopeId(w.email,String(input.item)))
  return repairLink(env,s,w,{...input,intended:scope?.payload.intended??[]})
 }
 if(method==='POST' && parts[1] && parts[2]==='undo')return undoRepair(env,s,w,parts[1])
 insist(false,'not_found',404)
}
// Traffic and scheduled events run due grants. Each grant is re-authorized against its active person and current
// item ACL, including every ancestor and current groups. No cached session or owner-wide capability is created.
export async function sweepLinkRepairs(env:Bindings){
 for(const scope of (await list<LinkScope>(env,'link-scope')).filter(r=>r.payload.automatic && (!r.payload.lastScan || Date.parse(r.payload.lastScan)<Date.now()-15*60000)).slice(0,20)){
  if(!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(scope.payload.by).first())continue
  const w=await whoFor(env,scope.payload.by)
  try{
   const scan=await scanLinks(env,w,scope.payload.item,scope.payload.intended)
   // Compare-and-swap claims this scan before doing work; concurrent requests cannot execute the same grant twice.
   const claimed=next(scope,{...scope.payload,lastScan:now()})
   await commit(env,null,[{row:claimed,previous:scope}],{fences:scan.fences,by:w.email})
   for(const f of scan.findings)await repairLink(env,null,w,{item:f.item,link:f.id,revision:f.revision,action:'revoke'},claimed)
  }catch(error){
   if(error instanceof ChestError && [403,404,409].includes(error.status))continue
   // A concurrent snapshot loses the claim and does no repair. Unexpected failures remain visible to the runtime.
   if(String(error).includes('CHECK constraint failed: ok'))continue
   throw error
  }
 }
}
