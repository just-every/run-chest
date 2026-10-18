import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner, validPerson } from '../access'
import { id, insist, now, text, type Row } from '../model'
import { get, list, ownerPredicate } from '../store'
import { context, demand, who } from '../files/access'
import { commit, fresh, next, where } from '../files/repo'
import type { RequestPolicy, RequestSubmission } from '../files/request-model'
import type { Checklist, Confirmation, Reminder, Requirement } from './model'
import { active, collectionContext, recipientAccess, refresh } from './evidence'
import { remind, reminderDraft } from './reminders'

const flag=(value:unknown)=>value===true||value==='true'
const cadence=(value:unknown)=>{const n=Number(value);insist(Number.isFinite(n)&&n>=1&&n<=8760,'invalid_cadence_hours');return n}
async function requirements(env:Bindings,s:Session,input:unknown,folder:string,old:Requirement[]=[]) {
 const values=typeof input==='string'?JSON.parse(input):input
 insist(Array.isArray(values)&&values.length>0&&values.length<=30,'collection_requirements_required')
 const result:Requirement[]=[],fences:Row[]=[]
 for(const value of values) {
  const request=await get<RequestPolicy>(env,'file-request',text(value.request,'request')),checklist=text(value.checklist,'checklist',160)
  insist(request.payload.folder===folder&&request.payload.checklist?.includes(checklist),'collection_request_requirement_mismatch');fences.push(request)
  const item=value.item?text(value.item,'item'):null,version=value.version?text(value.version,'version'):null,submission=value.submission?text(value.submission,'submission'):null
  insist(!!item===!!version,'collection_exact_version_required')
  if(item&&version) {
   const ctx=await context(env,await who(env,s),item);demand(ctx,'view');fences.push(...ctx.fences)
   const submissions=await list<RequestSubmission>(env,'request-submission')
   insist(submissions.some(r=>(!submission||r.id===submission)&&r.payload.request===request.id&&r.payload.checklist===checklist&&r.payload.files.some(f=>f.item===item&&f.version.id===version)),'collection_submission_mismatch')
  }
  const fields={label:text(value.label??checklist,'label',160),request:request.id,checklist,item,version,submission}
  const previous=old.find(r=>JSON.stringify({...r,id:undefined})===JSON.stringify({...fields,id:undefined}))
  result.push({...fields,id:previous?.id??id()})
 }
 insist(new Set(result.map(r=>`${r.request}\n${r.checklist}`)).size===result.length,'collection_duplicate_requirement')
 return {requirements:result,fences}
}
async function audience(env:Bindings,input:unknown) {
 const values=typeof input==='string'?input.split(/[\s,;]+/).filter(Boolean):input
 insist(Array.isArray(values)&&values.length>0&&values.length<=30,'collection_recipients_required')
 const recipients=[...new Set<string>(await Promise.all(values.map(v=>validPerson(env,v))))]
 for(const email of recipients)insist(await active(env,email),'collection_authenticated_recipient_required')
 return recipients
}
async function view(env:Bindings,s:Session,row:Row<Checklist>) {
 await collectionContext(env,s,row)
 const data=await refresh(env,row,s),isOwner=row.payload.owner===s.operator.email&&s.operator.role==='owner'
 const evidence=[]
 for(const e of data.evidence) {
  const access=e.requirement.item?await recipientAccess(env,s.operator.email,e.requirement.item):await recipientAccess(env,s.operator.email,row.payload.folder)
  if(!access.access)evidence.push({...e,requirement:{...e.requirement,item:null,version:null,submission:null},submission:null,approval:null,confirmations:[],transfer:[],candidates:[],recipients:e.recipients.filter(r=>r.email===s.operator.email),reasons:['Current access is required to inspect this material; ask the owner to review delivery']})
  else evidence.push(isOwner?e:{...e,candidates:[],confirmations:e.confirmations.filter(c=>c.payload.recipient===s.operator.email),transfer:e.transfer.filter(t=>t.payload.actor===s.operator.email),recipients:e.recipients.filter(r=>r.email===s.operator.email)})
 }
 const reminderHistory=(await where<Reminder>(env,'collection-reminder','$.collection',row.id)).filter(r=>isOwner||r.payload.recipient===s.operator.email)
 const reminderDrafts=[]
 if(isOwner&&row.payload.enabled&&data.state!=='accepted')for(const email of row.payload.recipients) {
  const pending=data.evidence.filter(e=>!e.recipients.find(r=>r.email===email)?.confirmed)
  if(pending.length&&pending.every(e=>e.recipients.find(r=>r.email===email)?.access))reminderDrafts.push({to:email,message:reminderDraft(env,row,pending)})
 }
 return {id:row.id,...row.payload,requirements:evidence.map(e=>e.requirement),state:data.state,evidence,reminderDrafts,reminderHistory}
}
export async function collectionExecute(env:Bindings,request:Request,s:Session,method:string,parts:string[],input:any,url:URL):Promise<any> {
 if(parts[0]!=='collection')return undefined
 if(method!=='GET'&&method!=='HEAD')insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','invalid_origin',403)
 if(parts.length===1&&method==='GET') {
  const rows=await list<Checklist>(env,'collection-checklist'),checklists=[]
  for(const row of rows)if(row.payload.owner===s.operator.email||row.payload.recipients.includes(s.operator.email)) {
   try{await collectionContext(env,s,row)}catch(e){if(e instanceof Error&&'status'in e&&[403,404].includes(Number(e.status)))continue;throw e}
   checklists.push(await view(env,s,row))
  }
  return {checklists}
 }
 if(parts.length===1&&method==='POST') {
  owner(s);const folder=text(input.folder,'folder'),ctx=await context(env,await who(env,s),folder);demand(ctx,'share');insist(ctx.chain.at(-1)?.payload.type==='folder','collection_folder_required')
  const r=await requirements(env,s,input.requirements,folder),recipients=await audience(env,input.recipients)
  const recipientFences:Row[]=[]
  for(const email of recipients){const a=await recipientAccess(env,email,folder);insist(a.access,'collection_recipient_access_required',403);recipientFences.push(...a.fences)}
  const row=fresh<Checklist>('collection-checklist',{title:text(input.title,'title'),folder,space:ctx.space.id,owner:s.operator.email,recipients,cadenceHours:cadence(input.cadenceHours??24),sendReminders:flag(input.sendReminders),enabled:true,requirements:r.requirements,at:now()})
  const guard=ownerPredicate(s)
  await commit(env,s,[{row}],{fences:[...ctx.fences,...r.fences,...recipientFences],statements:[{sql:`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${guard.sql}) THEN 1 ELSE 0 END`,params:guard.params}],audits:[{action:'collection.create',object:row.id,detail:{recipients,cadenceHours:row.payload.cadenceHours,sendReminders:row.payload.sendReminders}}]})
  return view(env,s,row)
 }
 const row=await get<Checklist>(env,'collection-checklist',parts[1]);await collectionContext(env,s,row)
 if(parts.length===2&&method==='GET')return view(env,s,row)
 insist(parts.length===3&&method==='POST','not_found',404)
 if(parts[2]==='confirm') {
  insist(row.payload.enabled&&row.payload.recipients.includes(s.operator.email),'collection_intended_recipient_required',403)
  insist(input.confirm===true||input.confirm==='true','collection_explicit_confirmation_required')
  const data=await refresh(env,row,s),requirement=text(input.requirement,'requirement'),e=data.evidence.find(e=>e.requirement.id===requirement)
  insist(e,'collection_requirement_not_found',404);insist(e.state!=='mismatch'&&e.requirement.item===input.item&&e.requirement.version===input.version,'collection_exact_approved_version_required',409)
  const a=await recipientAccess(env,s.operator.email,e.requirement.item!);insist(a.access&&a.permission,'collection_recipient_access_required',403)
  const item=await get(env,'item',e.requirement.item!),v=item.payload.versions.find((v:any)=>v.id===input.version)
  const confirmation=fresh<Confirmation>('collection-confirmation',{collection:row.id,requirement,item:input.item,version:input.version,checksum:v.checksum,recipient:s.operator.email,permission:a.permission,at:now()})
  await commit(env,s,[{row:confirmation}],{fences:[...data.fences,...a.fences,item],audits:[{action:'collection.confirmed',object:row.id,detail:{requirement,item:input.item,version:input.version,checksum:v.checksum,recipient:s.operator.email}}]})
  return view(env,s,row)
 }
 const ctx=await collectionContext(env,s,row,true),guard=ownerPredicate(s),statements=[{sql:`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${guard.sql}) THEN 1 ELSE 0 END`,params:guard.params}]
 if(parts[2]==='remind')return remind(env,row,s)
 let updated:Row<Checklist>,fences:Row[]=[]
 if(parts[2]==='requirements') {const r=await requirements(env,s,input.requirements,row.payload.folder,row.payload.requirements);fences=r.fences;updated=next(row,{...row.payload,requirements:r.requirements})}
 else if(parts[2]==='policy')updated=next(row,{...row.payload,cadenceHours:input.cadenceHours===undefined?row.payload.cadenceHours:cadence(input.cadenceHours),sendReminders:input.sendReminders===undefined?row.payload.sendReminders:flag(input.sendReminders),enabled:input.enabled===undefined?row.payload.enabled:flag(input.enabled)})
 else {insist(false,'not_found',404)}
 await commit(env,s,[{row:updated,previous:row}],{fences:[...ctx.fences,...fences],statements,audits:[{action:`collection.${parts[2]}`,object:row.id,detail:{before:row.payload,after:updated.payload}}]})
 return view(env,s,updated)
}
