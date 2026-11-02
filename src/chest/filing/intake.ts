import { attempt } from '../audit/journal'
import PostalMime from 'postal-mime'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list, snapshot } from '../store'
import { insist, now, type Row } from '../model'
import { context, demand, start, who, whoFor } from '../files/access'
import { admit, createItem, siblings } from '../files/items'
import { commit, fresh, maybe, next, where } from '../files/repo'
import type { Item, Space } from '../files/model'
import { managed } from '../read/settings'
export type Intake = { space: string; folder: string; address: string; enabled: boolean; senderScope?: 'any' | 'exact'; allowedSender?: string | null; by: string; at: string }
export type IntakeReceipt = { space: string; intake: string; item: string; messageId: string; sender: string; envelopeFrom: string; date: string; subject: string; filename: string; checksum: string; at: string }
const available = (env: Bindings) => !managed(env)
async function manager(env: Bindings, s: Session, space: string) {
 const row = await get<Space>(env, 'space', space), w = await who(env, s)
 insist(['manager', 'owner'].includes(start(row.payload, w).role ?? ''), 'administer_refused', 403)
 return { row, w }
}
export async function intakeExecute(env: Bindings, s: Session, method: string, parts: string[], input: any) {
 if (parts[0] !== 'filing' || parts[1] !== 'intake') return undefined
 const w = await who(env, s)
 if (method === 'GET') {
  const spaces = (await list<Space>(env, 'space')).filter(r => ['manager', 'owner'].includes(start(r.payload, w).role ?? '')).map(r => r.id)
  return { unavailable: available(env) ? null : 'Email intake is not available yet on RER Managed hosting.', intakes: (await list<Intake>(env, 'intake')).filter(r => spaces.includes(r.payload.space)), receipts: (await list<IntakeReceipt>(env, 'intake-receipt')).filter(r => spaces.includes(r.payload.space)).sort((a,b)=>b.payload.at.localeCompare(a.payload.at)).slice(0,50) }
 }
 insist(method === 'POST', 'method_not_allowed', 405)
 insist(available(env), 'email_intake_not_available_yet', 409)
 const { row: space, w: actor } = await manager(env, s, input.space)
 const ctx = await context(env, actor, input.folder); demand(ctx, 'manage')
 insist(ctx.space.id === space.id && ctx.chain.at(-1)!.payload.type === 'folder', 'intake_folder_required')
 const address = String(input.address ?? '').trim().toLowerCase()
 insist(/^[a-z0-9][a-z0-9._-]{0,63}@[a-z0-9.-]+\.[a-z]{2,}$/.test(address), 'invalid_intake_address')
 const key = `intake:${space.id}`, previous = await maybe<Intake>(env, 'intake', key)
 insist(!(await list<Intake>(env,'intake')).some(r=>r.id!==key && r.payload.address===address), 'intake_address_taken',409)
 // Omitted policy fields on an existing address preserve its scope, including pause and enable.
 const senderScope = input.senderScope ?? previous?.payload.senderScope ?? (previous ? 'any' : 'exact')
 insist(senderScope === 'any' || senderScope === 'exact', 'invalid_sender_scope')
 const allowedSender = senderScope === 'exact' ? String(input.allowedSender ?? previous?.payload.allowedSender ?? '').trim().toLowerCase() : null
 insist(senderScope !== 'exact' || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(allowedSender!), 'invalid_allowed_sender')
 const payload: Intake = { space: space.id, folder: input.folder, address, enabled: input.enabled !== false && input.enabled !== 'false', senderScope, allowedSender, by: s.operator.email, at: now() }
 const row = previous ? next(previous, payload) : fresh('intake',payload,key)
 await commit(env,s,[{row,...(previous?{previous}:{})}],{fences:[space,...ctx.fences],audits:[{action:'intake.configure',object:key,detail:{address,folder:input.folder,enabled:payload.enabled,senderScope,allowedSender}}]})
 return row
}
// An incoming email acts only through its saved, still-active standing grant. This is never a browser session.
async function intakeActor(env: Bindings, config: Row<Intake>): Promise<Session> {
 const op: any = await env.DB.prepare("SELECT * FROM oa_operators WHERE email=? AND status='active'").bind(config.payload.by).first()
 insist(op, 'intake_owner_inactive',403)
 const fence = snapshot(config)
 return { id: `intake:${config.id}`, operator: { id: op.id, email: op.email, role: op.role, displayName: op.display_name }, predicate: { sql: `(${fence.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?)`, params: [...fence.params,op.id,op.version] } } as unknown as Session
}
export async function receiveIntake(env: Bindings, message: ForwardableEmailMessage) {
 try { return await attempt(env,message.from,'automation.intake','email intake',{authority:'standing email intake grant'},async()=>{
  insist(available(env),'email_intake_not_available_yet',409)
  const configs = await where<Intake>(env,'intake','$.address',message.to.toLowerCase()), config = configs.find(r=>r.payload.enabled)
  insist(config,'intake_address_not_configured',404)
  // Cloudflare's envelope is the restriction boundary; MIME From is untrusted provenance.
  insist(config.payload.senderScope !== 'exact' || message.from.trim().toLowerCase() === config.payload.allowedSender, 'intake_sender_refused',403)
  insist(message.rawSize <= 12_000_000,'email_too_large',413)
  const raw=new Uint8Array(await new Response(message.raw).arrayBuffer());insist(raw.length<=12_000_000,'email_too_large',413)
  const email = await PostalMime.parse(raw,{maxNestingDepth:20,maxHeadersSize:64000}), files = email.attachments.filter(a=>a.filename && a.disposition!=='inline')
  insist(files.length>0 && files.length<=10,'one_to_ten_attachments_required')
  const s = await intakeActor(env,config), w=await whoFor(env,config.payload.by), ctx=await context(env,w,config.payload.folder)
  demand(ctx,'manage');insist(ctx.space.id===config.payload.space,'intake_folder_moved',409)
  const sender=email.from?.address ?? message.from, messageId=email.messageId || `sha256:${await hash(raw)}`
  for(let index=0;index<files.length;index++){
   const f=files[index], bytes=typeof f.content==='string'?Uint8Array.from(atob(f.content),c=>c.charCodeAt(0)):new Uint8Array(f.content)
   const receiptId=`intake-receipt:${await hash(new TextEncoder().encode(`${config.id}\n${sender.toLowerCase()}\n${messageId}\n${index}`))}`
   const existing=await maybe<IntakeReceipt>(env,'intake-receipt',receiptId)
   if(existing){insist(existing.payload.checksum===await hash(bytes),'intake_message_changed',409);continue}
   const taken=new Set((await siblings(env,config.payload.space,config.payload.folder)).map(r=>r.payload.name.toLowerCase()))
   const original=f.filename!, dot=original.lastIndexOf('.'), stem=dot>0?original.slice(0,dot):original, ext=dot>0?original.slice(dot):''
   let filename=original;for(let n=2;taken.has(filename.toLowerCase());n++)filename=`${stem} (${n})${ext}`
   const v=await admit(env,bytes,filename,sender,'email')
   const item=await createItem(env,s,w,{space:config.payload.space,parent:config.payload.folder,name:filename},'email',bytes,{version:v,sender,ops:item=>[{row:fresh<IntakeReceipt>('intake-receipt',{space:config.payload.space,intake:config.id,item:item.id,messageId,sender,envelopeFrom:message.from,date:email.date??'',subject:email.subject??'',filename:original,checksum:v.checksum,at:now()},receiptId)}]})
  }
 })}catch(error){message.setReject(error instanceof Error && /^[a-z_]+$/.test(error.message)?error.message:'Attachment filing could not finish; contact the space manager.')}
}
async function hash(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(b=>b.toString(16).padStart(2,'0')).join('')}
