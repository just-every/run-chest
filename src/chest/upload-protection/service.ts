import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { insist, now, type Row } from '../model'
import { commit, next } from '../files/repo'
import { canAdmin, requireAdmin } from '../administration/roles'
import { context, demand, who } from '../files/access'
import { admit } from '../files/items'
import { versionPublication } from '../files/governance'
import type { Incident } from './model'

async function authorize(env: Bindings,s: Session,row: Row<Incident>) {
 if(row.payload.actor!==s.operator.email) await requireAdmin(env,s,'sharing-security',row.payload.actor)
}
export async function incidents(env: Bindings,s: Session) {
 const rows = [...await list<Incident>(env,'upload-protection'),...await list<Incident>(env,'upload-incident')], result=[]
 for(const r of rows) if(r.payload.actor===s.operator.email||await canAdmin(env,s,'sharing-security',r.payload.actor)) result.push(await incidentView(env,s,r.id))
 return result.sort((a,b)=>b.detectedAt.localeCompare(a.detectedAt))
}
export async function incidentView(env: Bindings,s: Session,key: string) {
 let row:Row<Incident>
 try{row=await get<Incident>(env,'upload-protection',key)}catch{row=await get<Incident>(env,'upload-incident',key)}
 await authorize(env,s,row)
 const w=await who(env,s),changes=[]
 for(const c of row.payload.changes){let accessible=false
  if(c.item)try{demand(await context(env,w,c.item),'view');accessible=true}catch{}
  else accessible=row.payload.actor===s.operator.email
  changes.push({...c,name:accessible?c.name:'Restricted item',checksum:accessible?c.checksum:null,item:accessible?c.item:null})
 }
 return {id:row.id,...row.payload,changes}
}
// Every held candidate is resolved individually. Releases never replace an intervening edit, and no bulk rewind
// can resurrect revoked sharing. Security authority alone supplies no content access or bytes.
export async function decideIncident(env: Bindings,s: Session,key: string,input:any) {
 let row=await get<Incident>(env,'upload-protection',key);await authorize(env,s,row)
 insist(['keep','release','resume'].includes(input.action),'invalid_incident_action')
 if(input.action==='resume'){
  insist(row.payload.changes.every(c=>c.state!=='held'),'resolve_held_changes_first',409)
  const updated=next(row,{...row.payload,paused:false,resumedAt:now(),resumedBy:s.operator.email})
  await commit(env,s,[{row:updated,previous:row}],{audits:[{action:'security.upload.resume',object:key}]});return incidentView(env,s,key)
 }
 insist(row.payload.paused,'incident_already_resumed',409)
 if(input.action==='keep'){
  const updated=next(row,{...row.payload,changes:row.payload.changes.map(c=>c.state==='held'?{...c,state:'kept' as const,outcome:'Original kept current; suspect bytes retained in quarantine'}:c)})
  await commit(env,s,[{row:updated,previous:row}],{audits:[{action:'security.upload.keep-originals',object:key}]});return incidentView(env,s,key)
 }
 const w=await who(env,s)
 for(const held of row.payload.changes.filter(c=>c.state==='held')){
  let state:'released'|'conflict'='released',outcome='',version:string|undefined
  if(!held.item){
   // New-file release is deliberately not inferred: a quarantine entry is not a file and cannot grant a destination.
   state='conflict';outcome='New file retained in quarantine; download the source from your device and upload after resuming.'
  }else{
   const ctx=await context(env,w,held.item);demand(ctx,'contribute');const item=ctx.chain.at(-1)!
   if(item.payload.current!==held.source){state='conflict';outcome='A later version is current. It was retained; suspect bytes stay quarantined.'}
   else{
    const blob=await env.BLOBS.get(`sha256/${held.checksum}`);insist(blob,'blob_missing',503)
    const v=await admit(env,new Uint8Array(await blob.arrayBuffer()),held.name,s.operator.email,'upload',{checksum:held.checksum,size:held.size})
    const updated=next(item,await versionPublication(env,ctx,item.payload,v)),after=next(row,{...row.payload,changes:row.payload.changes.map(c=>c.id===held.id?{...c,state:'released' as const,version:v.id,outcome:'Explicitly released as a new version'}:c)})
    await commit(env,s,[{row:updated,previous:item},{row:after,previous:row}],{fences:ctx.fences,changes:[{item:item.id,space:item.payload.space,kind:'version'}],audits:[{action:'security.upload.release',object:item.id,detail:{incident:key,version:v.id,checksum:v.checksum,source:held.source}}]})
    row=after;continue
   }
  }
  const after=next(row,{...row.payload,changes:row.payload.changes.map(c=>c.id===held.id?{...c,state,outcome,version}:c)})
  await commit(env,s,[{row:after,previous:row}],{audits:[{action:'security.upload.conflict',object:key,detail:{change:held.id,outcome}}]});row=after
 }
 return incidentView(env,s,key)
}
export async function protectionExecute(env:Bindings,s:Session,method:string,parts:string[],input:any){
 if(method==='GET')return parts[1]?incidentView(env,s,parts[1]):incidents(env,s)
 insist(method==='POST'&&parts[1],'not_found',404);return decideIncident(env,s,parts[1],input)
}
