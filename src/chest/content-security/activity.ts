import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, id, now } from '../model'
import { sessionPredicate, snapshot } from '../store'
import { commit, type Audit } from '../files/repo'
import { deliver, notice } from '../files/notify'
import { principalCanAdmin, requireAdmin } from '../administration/roles'
import { rules } from './policy'
const windowMs=10*60_000
// Account totals span all sessions. Devices and OAuth tokens additionally have independent pause identities.
export async function activity(env:Bindings,s:Session|null,kind:'download'|'delete',size=0,external?:{actor:string;source:string;fences?:any[]}) {
 const fingerprint=s?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.id))),b=>b.toString(16).padStart(2,'0')).join(''):''
 const actor=s?.operator.email??external!.actor,source=s?(String((s as any).device?`device:${(s as any).device}`:(s as any).contentToken?`token:${(s as any).contentToken}`:`session:${fingerprint}`)):external!.source
 const subjects=[`account:${actor}`,...(source.startsWith('device:')||source.startsWith('token:')||!s?[source]:[])],configs=await rules(env,actor)
 const batch=id(),at=Date.now(),since=at-windowMs,prepare=(sql:string,...params:unknown[])=>env.DB.prepare(sql).bind(...params)
 const predicates=s?[sessionPredicate(s)]:(external?.fences??[]).map(snapshot)
 const statements=predicates.map(p=>prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`,...p.params))
 // Insert only when no subject is already paused. D1 serializes admission, alert creation and the pause.
 const active=`NOT EXISTS(SELECT 1 FROM chest_activity_pauses WHERE subject IN (SELECT value FROM json_each(?)))`
 statements.push(prepare(`INSERT INTO chest_activity_events(id,actor,source,kind,bytes,at) SELECT ?,?,?,?,?,? WHERE ${active}`,batch,actor,source,kind,size,at,JSON.stringify(subjects)))
 for(const subject of subjects){
  const condition=subject.startsWith('account:')?'actor=?':'source=?',identity=subject.startsWith('account:')?actor:source
  for(const config of configs){
   const count=`(SELECT COUNT(*) FROM chest_activity_events WHERE ${condition} AND kind=? AND at>?)`,bytes=`(SELECT COALESCE(SUM(bytes),0) FROM chest_activity_events WHERE ${condition} AND kind='download' AND at>?)`
   const limit=kind==='download'?config.files:config.deletions
   const detail=JSON.stringify({rule:config.id,name:config.name,kind,limit,byteLimit:kind==='download'?config.bytes:null,windowMinutes:10,pause:config.pause})
   statements.push(prepare(`INSERT INTO chest_activity_alerts(id,batch,subject,actor,rule,kind,detail,at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM chest_activity_events WHERE id=?) AND (${count}>? ${kind==='download'?`OR ${bytes}>?`:''}) AND NOT EXISTS(SELECT 1 FROM chest_activity_alerts WHERE subject=? AND rule=? AND kind=? AND at>?)`,id(),batch,subject,actor,config.id,kind,detail,at,batch,identity,kind,since,limit,...(kind==='download'?[identity,since,config.bytes]:[]),subject,config.id,kind,since))
   if(config.pause&&kind==='download')statements.push(prepare(`INSERT OR IGNORE INTO chest_activity_pauses(subject,actor,rule,at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM chest_activity_events WHERE id=?) AND (${count}>? OR ${bytes}>?)`,subject,actor,config.id,at,batch,identity,kind,since,limit,identity,since,config.bytes))
  }
 }
 statements.push(prepare("INSERT INTO chest_audit SELECT id,actor,'security.activity.alert',subject,detail,? FROM chest_activity_alerts WHERE batch=?",now(),batch),prepare('DELETE FROM chest_activity_events WHERE at<=?',since),prepare('DELETE FROM chest_assert'),prepare('SELECT * FROM chest_activity_alerts WHERE batch=?',batch),prepare('SELECT * FROM chest_activity_pauses WHERE subject IN (SELECT value FROM json_each(?))',JSON.stringify(subjects)))
 const result=await env.DB.batch(statements),alerts=result.at(-2)!.results as any[],pauses=result.at(-1)!.results as any[]
 if(alerts.length){const operators=(await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active'").all<{email:string}>()).results,rows=[]
  for(const o of operators)if(await principalCanAdmin(env,o.email,'sharing-security',actor))rows.push(notice(o.email,'security.activity',null,actor,`Mass activity alert for ${actor}: ${alerts.map(a=>{const d=JSON.parse(a.detail);return `${d.name}: ${kind} threshold exceeded (${d.limit} items${d.byteLimit?` or ${d.byteLimit} bytes`:''} in 10 minutes)`}).join('; ')}.${pauses.length?' Downloads are paused for the affected source.':''}`))
  if(rows.length){await commit(env,null,rows.map(row=>({row})));await deliver(env,null,rows)}
 }
 insist(kind!=='download'||!pauses.length,'activity_downloads_paused',423)
}
export async function activityAudits(env:Bindings,s:Session|null,audits:Audit[]) {
 if(!s)return
 for(const a of audits)if(['item.trash','item.erase','document.trash','document.erase'].includes(a.action))await activity(env,s,'delete')
}
export async function resumeActivity(env:Bindings,s:Session,subject:string,input:any) {
 const row=await env.DB.prepare('SELECT * FROM chest_activity_pauses WHERE subject=?').bind(subject).first<any>();insist(row,'not_found',404)
 await requireAdmin(env,s,'sharing-security',row.actor)
 insist(typeof input.reason==='string'&&input.reason.trim().length>=5&&input.reason.length<=1000,'resume_reason_required')
 await commit(env,s,[],{statements:[{sql:'DELETE FROM chest_activity_pauses WHERE subject=?',params:[subject]}],audits:[{action:'security.activity.resume',object:subject,detail:{rule:row.rule,reason:input.reason.trim()}}]})
 return {resumed:subject}
}
