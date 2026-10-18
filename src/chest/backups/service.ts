import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { list } from '../store'
import { insist,now } from '../model'
import { commit,fresh,maybe,next } from '../files/repo'
import { notice,deliver } from '../files/notify'
export type BackupSettings={enabled:boolean;everyHours:number;retentionDays:number;bucket:string;requestedAt:string|null;lastClaim?:string|null}
export type BackupRun={state:'running'|'complete'|'failed'|'interrupted';at:string;finishedAt?:string;error?:string;key?:string;bytes?:number;objects?:number;sha256?:string;notifiedAt?:string;checkedAt?:string;drill?:string}
const settingsId='backup-settings:independent'
export async function backupView(env:Bindings,s:Session){
 owner(s)
 const settings=await maybe<BackupSettings>(env,'backup-settings',settingsId),runs=(await list<BackupRun>(env,'backup-run')).sort((a,b)=>b.payload.at.localeCompare(a.payload.at)),contact=await maybe<{at:string}>(env,'backup-contact','backup-contact:runner')
 return {settings:settings?.payload??{enabled:false,everyHours:24,retentionDays:30,bucket:'',requestedAt:null},revision:settings?.revision??'',runs:runs.slice(0,30).map(r=>({id:r.id,...r.payload})),lastSuccess:runs.find(r=>r.payload.state==='complete')?.payload??null,contact:contact?.payload.at??null}
}
export async function backupAction(env:Bindings,s:Session,input:any){
 owner(s);if(input.action==='interrupt'){insist(input.confirm===true,'backup_inspection_confirmation_required');const run=await maybe<BackupRun>(env,'backup-run',String(input.id));insist(run?.payload.state==='running','backup_not_running',409);await commit(env,s,[{row:next(run,{...run.payload,state:'interrupted',finishedAt:now()}),previous:run}],{audits:[{action:'backup.interrupt',object:run.id,detail:{outcome:'interrupted'}}]});return {interrupted:true}}
 const old=await maybe<BackupSettings>(env,'backup-settings',settingsId)
 if(input.action==='request'){insist(old,'backup_schedule_required');const payload={...old.payload,requestedAt:now()};await commit(env,s,[{row:next(old,payload),previous:old}],{audits:[{action:'backup.request',object:settingsId,detail:{}}]});return payload}
 insist(typeof input.enabled==='boolean'&&Number.isInteger(input.everyHours)&&input.everyHours>=1&&input.everyHours<=168&&Number.isInteger(input.retentionDays)&&input.retentionDays>=1&&input.retentionDays<=3650,'invalid_backup_schedule')
 insist(typeof input.bucket==='string'&&/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(input.bucket),'invalid_backup_bucket')
 const payload:BackupSettings={enabled:input.enabled,everyHours:input.everyHours,retentionDays:input.retentionDays,bucket:input.bucket,requestedAt:old?.payload.requestedAt??null,lastClaim:old?.payload.lastClaim??null},row=old?next(old,payload):fresh('backup-settings',payload,settingsId)
 await commit(env,s,[{row,...(old?{previous:old}:{})}],{audits:[{action:'backup.schedule',object:settingsId,detail:{before:old?.payload??null,after:payload}}]});return payload
}
// An independent runner holds the Cloudflare credentials and records outcomes directly in D1.
// The application only sends the recorded failure notice, not backups or decryption keys.
export async function sweepBackups(env:Bindings){
 for(const row of (await list<BackupRun>(env,'backup-run')).filter(r=>['failed','interrupted'].includes(r.payload.state)&&!r.payload.notifiedAt)){
  const message=notice(env.OWNER_EMAIL,'backup.failed',null,env.OWNER_EMAIL,`Independent backup did not complete (${row.payload.state}). Originals are unchanged. Open Administration to inspect the backup runner and try again after checking the independent copy.`)
  try{await commit(env,null,[{row:next(row,{...row.payload,notifiedAt:now()}),previous:row},{row:message}],{audits:[{action:'backup.failure.notice',object:row.id,detail:{state:row.payload.state}}]});await deliver(env,null,[message])}catch{ /* A parallel sweep may already have claimed this notice. Its durable run remains visible. */ }
 }
}
