import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, type Row } from '../model'
import { get, list, ownerPredicate, snapshot } from '../store'
import { context, demand, whoFor } from '../files/access'
import { commit, fresh, next, where } from '../files/repo'
import { deliver, notice } from '../files/notify'
import type { Checklist, Evidence, Reminder } from './model'
import { recipientAccess, refresh } from './evidence'

export function reminderDraft(env:Bindings,row:Row<Checklist>,pending:Evidence[]) {
 return `${row.payload.title}: please supply or confirm the exact approved material for ${pending.map(e=>e.requirement.label).join(', ')}. Review the version and confirm personally: ${env.AUTH_ORIGIN}/app/collection?checklist=${row.id}. A provider receipt or a view does not confirm receipt by you.`
}
export async function standingSession(env:Bindings,row:Row<Checklist>) {
 const actor:any=await env.DB.prepare("SELECT id,email,role,version FROM oa_operators WHERE email=? AND status='active' AND role='owner'").bind(row.payload.owner).first()
 insist(actor,'collection_owner_inactive',403)
 const ctx=await context(env,await whoFor(env,row.payload.owner),row.payload.folder);demand(ctx,'share')
 const p=snapshot(row)
 const session={id:`collection:${row.id}`,kind:'owner collection authority',operator:{id:actor.id,email:actor.email,role:actor.role},predicate:{sql:`(${p.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner' AND version=?)`,params:[...p.params,actor.id,actor.version]}} as unknown as Session
 return {session,fences:ctx.fences}
}
export async function remind(env:Bindings,row:Row<Checklist>,session:Session) {
 const p=row.payload,result=await refresh(env,row,session),sent:Row<Reminder>[]=[]
 if(!p.enabled||!p.sendReminders||result.state==='accepted')return {state:result.state,reminders:sent}
 const authority=await context(env,await whoFor(env,p.owner),p.folder);demand(authority,'share');const guard=ownerPredicate(session)
 const previous=await where<Reminder>(env,'collection-reminder','$.collection',row.id)
 for(const email of p.recipients) {
  const pending=result.evidence.filter(e=>!e.recipients.find(r=>r.email===email)?.confirmed)
  if(!pending.length)continue
  const latest=previous.filter(r=>r.payload.recipient===email).sort((a,b)=>b.payload.at.localeCompare(a.payload.at))[0]
  if(latest&&Date.parse(latest.payload.at)+p.cadenceHours*3600000>Date.now())continue
  // Access loss is a proposed redelivery, never a reason to send to a new audience or grant access.
  const current=await Promise.all(pending.map(e=>recipientAccess(env,email,e.requirement.item??p.folder)))
  if(current.some(a=>!a.access))continue
  const message=reminderDraft(env,row,pending)
  const n=notice(email,'collection.reminder',null,p.owner,message),reminder=fresh<Reminder>('collection-reminder',{collection:row.id,recipient:email,at:now(),requirements:pending.map(e=>e.requirement.id),notice:n.id,status:'queued'})
  await commit(env,session,[{row:n},{row:reminder}],{fences:result.fences.concat(authority.fences,current.flatMap(a=>a.fences),latest?[latest]:[]),statements:[{sql:`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${guard.sql}) THEN 1 ELSE 0 END`,params:guard.params},{sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND status='active') THEN 1 ELSE 0 END",params:[email]},{sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM chest_records WHERE id<>? AND kind='collection-reminder' AND json_extract(payload,'$.collection')=? AND json_extract(payload,'$.recipient')=? AND julianday(json_extract(payload,'$.at'))>julianday(?)) THEN 1 ELSE 0 END",params:[reminder.id,row.id,email,new Date(Date.now()-p.cadenceHours*3600000).toISOString()]}],audits:[{action:'collection.reminder',object:row.id,detail:{recipient:email,requirements:reminder.payload.requirements}}]})
  // Re-read authority immediately before the external side effect; no mail is replayed by a restore.
  const live=await get<Checklist>(env,'collection-checklist',row.id),still=await refresh(env,live,session),access=await Promise.all(pending.map(e=>recipientAccess(env,email,e.requirement.item??p.folder)))
  let status='suppressed:permission_or_policy_changed'
  if(live.revision===row.revision&&live.payload.enabled&&live.payload.sendReminders&&still.state!=='accepted'&&access.every(a=>a.access))status=(await deliver(env,session,[n]))[0].payload.email
  else await commit(env,session,[{row:next(n,{...n.payload,email:status}),previous:n}])
  const updated=next(reminder,{...reminder.payload,status});await commit(env,session,[{row:updated,previous:reminder}]);sent.push(updated)
 }
 return {state:result.state,reminders:sent}
}
export async function collectionSweep(env:Bindings) {
 const outcomes:{id:string;state?:string;error?:string}[]=[]
 for(const row of await list<Checklist>(env,'collection-checklist')) {
  try {const {session}=await standingSession(env,row);const result=await remind(env,row,session);outcomes.push({id:row.id,state:result.state})}
  catch(e) {outcomes.push({id:row.id,error:e instanceof Error?e.message:'collection_failed'})}
 }
 return outcomes
}
