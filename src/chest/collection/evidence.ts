import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { facts } from '../audit/journal'
import { identityRedactor } from '../audit/privacy'
import { id } from '../model'
import { get, list } from '../store'
import { allowed, context, demand, whoFor } from '../files/access'
import { commit, maybe, next, where } from '../files/repo'
import type { Item } from '../files/model'
import type { RequestPolicy, RequestSubmission } from '../files/request-model'
import type { Checklist, Confirmation, Evidence, TransferEvidence } from './model'

export async function active(env:Bindings,email:string) { return !!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first() }
export async function collectionContext(env:Bindings,s:Session,row:Row<Checklist>,write=false) {
 insist(row.payload.owner===s.operator.email||row.payload.recipients.includes(s.operator.email),'not_found',404)
 if(write)insist(s.operator.role==='owner'&&row.payload.owner===s.operator.email,'owner_required',403)
 const ctx=await context(env,await whoFor(env,s.operator.email),row.payload.folder);demand(ctx,write?'share':'view');return ctx
}
// The fingerprint binds the actual authorization inputs, not an item's content revision. An ACL change
// invalidates a prior human confirmation even when the same bytes happen to remain readable.
export async function recipientAccess(env:Bindings,email:string,key:string) {
 if(!await active(env,email))return {access:false,permission:null,fences:[] as Row[]}
 try {
  const w=await whoFor(env,email),ctx=await context(env,w,key)
  const access=!ctx.state.trash&&allowed(ctx,'download')
  const policy={space:ctx.space.payload,groups:w.groups.map(g=>({id:g.id,members:g.payload.members})),path:ctx.chain.map(i=>({id:i.id,space:i.payload.space,parent:i.payload.parent,restricted:i.payload.restricted,grants:i.payload.grants,noDownload:i.payload.noDownload,trash:i.payload.trash})),links:ctx.links.map(l=>({id:l.id,payload:l.payload})),role:ctx.state.role}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(policy))),permission=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  return {access,permission,fences:ctx.fences}
 } catch(e) {if(e instanceof ChestError&&[403,404].includes(e.status))return {access:false,permission:null,fences:[] as Row[]};throw e}
}
export async function inspect(env:Bindings,row:Row<Checklist>) {
 const confirmations=await where<Confirmation>(env,'collection-confirmation','$.collection',row.id),events=await list<TransferEvidence>(env,'transfer-event'),fences:Row[]=[row],evidence:Evidence[]=[]
 for(const r of row.payload.requirements) {
  const request=await maybe<RequestPolicy>(env,'file-request',r.request),submissions=await where<RequestSubmission>(env,'request-submission','$.request',r.request)
  if(request)fences.push(request)
  fences.push(...submissions)
  const candidates=submissions.filter(s=>s.payload.checklist===r.checklist).flatMap(s=>s.payload.files.map(f=>({submission:s.id,item:f.item??null,version:f.version.id,status:s.payload.status})))
  const matching=submissions.find(s=>(!r.submission||s.id===r.submission)&&s.payload.checklist===r.checklist&&s.payload.status==='accepted'&&s.payload.files.some(f=>f.item===r.item&&f.version.id===r.version))
  const item=r.item?await maybe<Item>(env,'item',r.item):null,version=item?.payload.versions.find(v=>v.id===r.version),reasons:string[]=[]
  if(item)fences.push(item)
  if(!request||request.payload.folder!==row.payload.folder)reasons.push('Request is missing or outside the checklist folder')
  if(!r.item||!r.version)reasons.push('Choose an exact submitted item and version')
  else if(!matching)reasons.push('No accepted request submission matches this requirement and exact version')
  if(r.item&&!item)reasons.push('Item is missing')
  if(item&&(item.payload.trash||item.payload.parent!==row.payload.folder))reasons.push('Item was removed from the collection folder')
  if(r.version&&(!version||item?.payload.versions.at(-1)?.id!==r.version||item?.payload.current!==r.version))reasons.push('Required version is superseded or no longer current')
  if(r.version&&(!version?.review||version.review.state!=='approved'||item?.payload.approved!==r.version))reasons.push('Exact version needs current human approval')
  const recipients:Evidence['recipients']=[]
  for(const email of row.payload.recipients) {
   const a=await recipientAccess(env,email,r.item??row.payload.folder);fences.push(...a.fences)
   const confirmed=!!version&&confirmations.some(c=>!c.payload.invalidatedAt&&c.payload.requirement===r.id&&c.payload.item===r.item&&c.payload.version===r.version&&c.payload.recipient===email&&c.payload.checksum===version.checksum&&c.payload.permission===a.permission)
   recipients.push({email,access:a.access,permission:a.permission,confirmed:a.access&&reasons.length===0&&confirmed})
  }
  if(recipients.some(r=>!r.access))reasons.push('An approved recipient no longer has download access; propose a new delivery for owner review')
  const state=reasons.length?'mismatch':recipients.every(r=>r.confirmed)?'accepted':'awaiting_confirmation'
  evidence.push({requirement:r,state,reasons,submission:matching?.id??null,approval:version?.review?.state==='approved'?{actor:version.review.actor??version.review.reviewer,at:version.review.at??''}:null,confirmations:confirmations.filter(c=>c.payload.requirement===r.id),transfer:events.filter(t=>t.payload.item===r.item&&t.payload.version===r.version&&row.payload.recipients.includes(t.payload.actor)),recipients,candidates})
 }
 return {evidence,fences,confirmations,state:evidence.length&&evidence.every(e=>e.state==='accepted')?'accepted':'open'}
}
// Durable invalidation prevents a revoked confirmation from silently coming back after restoration.
export async function refresh(env:Bindings,row:Row<Checklist>,s:Session|null=null) {
 const result=await inspect(env,row),invalid=result.confirmations.filter(c=>!c.payload.invalidatedAt&&(!result.evidence.some(e=>e.requirement.id===c.payload.requirement)||result.evidence.some(e=>e.requirement.id===c.payload.requirement&&(e.reasons.length>0||!e.recipients.some(r=>r.email===c.payload.recipient&&r.access&&r.permission===c.payload.permission)))))
 if(invalid.length){
  const at=now(),redact=await identityRedactor(env),actor=await redact(s?.operator.email??'chest:collection'),statements=[]
  for(const confirmation of invalid){
   // Sweeps and a person's GET can observe the same revoked confirmation. Invalidation is monotonic: the
   // conditional update and its audit claim the row once, rather than racing two revision-snapshot writes.
   statements.push({sql:"UPDATE chest_records SET payload=json_set(payload,'$.invalidatedAt',?,'$.reason',?),revision=? WHERE id=? AND kind='collection-confirmation' AND revision=? AND json_extract(payload,'$.invalidatedAt') IS NULL",params:[at,'Required evidence, approval or recipient permission changed',id(),confirmation.id,confirmation.revision]})
   statements.push({sql:'INSERT INTO chest_audit SELECT ?,?,?,?,?,? WHERE changes()>0',params:[id(),actor,'collection.reopened',row.id,await redact(JSON.stringify(facts({confirmations:[confirmation.id]},s?`${s.kind}:${s.operator.role}`:'chest:collection'))),at]})
  }
  await commit(env,s,[],{fences:result.fences,statements})
 }
 return invalid.length?inspect(env,row):result
}
