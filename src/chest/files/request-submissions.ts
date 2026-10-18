import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { get } from '../store'
import { context, demand, type Ctx, type Who } from './access'
import { commit, fresh, maybe, next, where, type Op } from './repo'
import { versionPublication } from './governance'
import { siblings } from './items'
import { deliver, notice } from './notify'
import type { Item, FileVersion } from './model'
import { extension, newRequestItem, optional, type RequestPolicy, type RequestSubmission, type Visitor } from './request-model'

export function submissionView(row: Row<RequestSubmission>, allowReplacement=false) {
 const p=row.payload
 return {id:row.id,title:p.title,at:p.at,status:p.status,reasons:p.reasons,checklist:p.checklist,verified:p.submitter.verified,replaces:p.replaces??null,canReplace:allowReplacement&&p.status==='accepted'&&p.files.length===1,files:p.files.map(f=>({name:f.name,size:f.version.size,checksum:f.version.checksum}))}
}
export async function ownSubmissions(env:Bindings,r:Row<RequestPolicy>,visitor:Row<Visitor>) { return (await where<RequestSubmission>(env,'request-submission','$.visitor',visitor.id)).filter(s=>s.payload.request===r.id).map(s=>submissionView(s,!!r.payload.allowReplacement)).sort((a,b)=>b.at.localeCompare(a.at)) }
export async function ownReceipt(env:Bindings,r:Row<RequestPolicy>,visitor:Row<Visitor>,key:string) { const row=await maybe<RequestSubmission>(env,'request-submission',key);insist(row&&row.payload.request===r.id&&row.payload.visitor===visitor.id,'not_found',404);return submissionView(row,!!r.payload.allowReplacement) }
function freeName(taken:Set<string>,filename:string) { const ext=extension(filename),stem=ext?filename.slice(0,-ext.length-1):filename;for(let n=1;;n++){const v=n===1?filename:`${stem} (${n})${ext?`.${ext}`:''}`;if(!taken.has(v.toLowerCase())){taken.add(v.toLowerCase());return v}} }
async function replacement(env:Bindings,r:Row<RequestPolicy>,visitor:Row<Visitor>,key:string) {
 insist(r.payload.allowReplacement,'replacement_not_allowed',403)
 const old=await maybe<RequestSubmission>(env,'request-submission',key)
 insist(old&&old.payload.request===r.id&&old.payload.visitor===visitor.id,'not_found',404)
 insist(old.payload.status==='accepted'&&old.payload.files.length===1,'replacement_not_available',409)
 const item=await get<Item>(env,'item',old.payload.files[0].item!)
 insist(item.payload.parent===r.payload.folder&&!item.payload.trash&&!item.payload.restricted&&item.payload.versions.at(-1)?.id===old.payload.files[0].version.id,'replacement_not_available',409)
 return {old,item}
}
// Originals have already been checked into custody. Only this commit admits an item; held arrivals never become
// items and cannot appear in search, preview, sync, or public downloads.
export async function publishSubmission(env:Bindings,r:Row<RequestPolicy>,ctx:Ctx,visitor:Row<Visitor>,input:{name:string;email:string;checklist?:string;replace?:string;filing?:Record<string,unknown>},files:{version:FileVersion;reasons:string[]}[],extra:Op[]|((submission:Row<RequestSubmission>)=>Op[])=[]) {
 const p=r.payload;insist(!p.closedAt,'request_closed',410)
 const late=!!p.deadline&&Date.parse(p.deadline)<=Date.now();insist(!late||p.late==='quarantine','request_closed',410)
 const checklist=optional(input.checklist,'checklist',160);insist(!(p.checklist?.length)||p.checklist.includes(checklist),'checklist_required')
 const email=visitor.payload.email??optional(input.email,'email',254).toLowerCase();insist(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'invalid_email')
 const submitter={name:optional(input.name,'name',120),email,verified:!!visitor.payload.email},by=`${email||'anonymous'} via file request`,at=now()
 const replacing=input.replace?await replacement(env,r,visitor,input.replace):null;insist(!replacing||files.length===1,'replacement_one_file')
 const prior=await where<RequestSubmission>(env,'request-submission','$.request',r.id),seen=new Set(prior.filter(s=>s.payload.status!=='rejected').flatMap(s=>s.payload.files.map(f=>f.version.checksum)))
 const duplicate=files.some(f=>seen.has(f.version.checksum))||new Set(files.map(f=>f.version.checksum)).size<files.length
 insist(!duplicate||p.duplicates!=='reject','duplicate_submission',409)
 const reasons=[...new Set([...files.flatMap(f=>f.reasons),...(late?['late submission']:[]),...(duplicate?['duplicate content']:[])])]
 const held=files.some(f=>f.reasons.length>0)||late||(duplicate&&p.duplicates==='quarantine')
 const taken=new Set((await siblings(env,ctx.space.id,p.folder)).map(s=>s.payload.name.toLowerCase())),items:Row<Item>[]=[]
 const entries:RequestSubmission['files']=[]
 for(const f of files) {
  const v={...f.version,actor:by},filename=replacing?replacing.item.payload.name:freeName(taken,v.filename)
  if(held){entries.push({name:filename,version:v});continue}
  const original=replacing?.item,payload=await versionPublication(env,ctx,original?.payload??newRequestItem(p,ctx.space.id,filename,at),v,input.filing??{})
  const item=original?next(original,payload):fresh<Item>('item',payload);items.push(item);entries.push({name:filename,version:v,item:item.id})
 }
 const submission=fresh<RequestSubmission>('request-submission',{space:ctx.space.id,request:r.id,visitor:visitor.id,title:p.title,at,submitter,checklist,status:held?'quarantined':'accepted',reasons,files:entries,filing:input.filing??{},...(replacing?{replaces:replacing.old.id}:{})})
 const who=submitter.name?`${submitter.name}${email?` (${email})`:''}`:email||'Someone',folder=ctx.chain.at(-1)!
 const note=notice(p.custodian??p.createdBy,'file-request.upload',items.length===1?items[0].id:folder.id,who,`${who} uploaded ${entries.map(f=>`"${f.name}"`).join(', ')} to "${folder.payload.name}" through your file request "${p.title}".${held?` Held in quarantine: ${reasons.join(', ')}.`:''}`)
 const ops:Op[]=[{row:next(r,{...p,uploads:p.uploads+entries.length}),previous:r},{row:submission},...items.map(row=>({row,...(replacing?{previous:replacing.item}:{})})),{row:note},...(typeof extra==='function'?extra(submission):extra)]
 if(replacing&&!held)ops.push({row:next(replacing.old,{...replacing.old.payload,status:'superseded'}),previous:replacing.old})
 await commit(env,null,ops,{by,fences:[...ctx.fences,visitor,...(replacing?[replacing.old,replacing.item]:[])],changes:items.map(i=>({item:i.id,space:ctx.space.id,kind:replacing?'version':'create'})),audits:entries.map(f=>({action:held?'file-request.quarantine':'file-request.upload',object:f.item??p.folder,detail:{request:r.id,submission:submission.id,version:f.version.id,size:f.version.size,checksum:f.version.checksum,submitter:email||null,verified:submitter.verified,reasons}})),statements:p.deadline&&p.late!=='quarantine'?[{sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN julianday(?)>julianday('now') THEN 1 ELSE 0 END",params:[p.deadline]}]:[]})
 await deliver(env,null,[note]);return submissionView(submission,!!p.allowReplacement)
}
export async function ownerSubmissions(env:Bindings,request:string) { return (await where<RequestSubmission>(env,'request-submission','$.request',request)).map(r=>({...submissionView(r),submitter:r.payload.submitter,decidedBy:r.payload.decidedBy??null})).sort((a,b)=>b.at.localeCompare(a.at)) }
export async function reviewRequestSubmission(env:Bindings,s:Session,w:Who,requestId:string,key:string,input:any) {
 const r=await get<RequestPolicy>(env,'file-request',requestId),ctx=await context(env,w,r.payload.folder);demand(ctx,'share')
 const row=await get<RequestSubmission>(env,'request-submission',key),p=row.payload;insist(p.request===r.id,'not_found',404);insist(p.status==='quarantined','submission_not_quarantined',409)
 insist(['release','reject'].includes(input.decision),'invalid_decision')
 // Active/executable bytes remain held: staff may reject them, never publish them through an override.
 insist(input.decision!=='release'||!p.reasons.includes('active or executable content'),'unsafe_content_cannot_release',403)
 const ops:Op[]=[],items:Row<Item>[]=[],taken=new Set((await siblings(env,ctx.space.id,r.payload.folder)).map(i=>i.payload.name.toLowerCase())),entries:RequestSubmission['files']=[]
 let replacing:Awaited<ReturnType<typeof replacement>>|null=null
 if(input.decision==='release'&&p.replaces) {const visitor=await get<Visitor>(env,'request-visitor',p.visitor);replacing=await replacement(env,r,visitor,p.replaces);ctx.fences.push(visitor,replacing.old,replacing.item)}
 for(const f of p.files) {
  if(input.decision==='reject'){entries.push(f);continue}
  const filename=replacing?replacing.item.payload.name:freeName(taken,f.name),payload=await versionPublication(env,ctx,replacing?.item.payload??newRequestItem(r.payload,ctx.space.id,filename,p.at),f.version,p.filing),item=replacing?next(replacing.item,payload):fresh<Item>('item',payload)
  items.push(item);ops.push({row:item,...(replacing?{previous:replacing.item}:{})});entries.push({...f,name:filename,item:item.id})
 }
 if(replacing)ops.push({row:next(replacing.old,{...replacing.old.payload,status:'superseded'}),previous:replacing.old})
 const updated=next(row,{...p,status:input.decision==='release'?'accepted':'rejected',files:entries,decidedBy:s.operator.email,decidedAt:now()})
 await commit(env,s,[...ops,{row:updated,previous:row}],{fences:[r,...ctx.fences],changes:items.map(i=>({item:i.id,space:ctx.space.id,kind:replacing?'version':'create'})),audits:[{action:`file-request.${input.decision}`,object:r.payload.folder,detail:{request:r.id,submission:row.id,reasons:p.reasons}}]})
 return submissionView(updated,!!r.payload.allowReplacement)
}
