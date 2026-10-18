import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { get, list } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { allowed, context, demand, who } from '../files/access'
import type { Device } from '../files/devices'
import { grantKey, reportKey, type Diagnosis, type Grant, type LocalFile, type Report, type ReportRow } from './model'
const HASH = /^[a-f0-9]{64}$/
const safePath = (path: unknown): path is string => typeof path === 'string' && path.length > 0 && path.length <= 4096 && !/[\x00-\x1f\\]/.test(path) && !path.startsWith('/') && !path.split('/').some(p => !p || p === '.' || p === '..' || p === '.chest-sync')
async function device(env: Bindings, s: Session, key: string) {
 const row = await get<Device>(env,'device',key)
 insist(row.payload.owner === s.operator.email && !row.payload.revokedAt,'device_unavailable',403)
 return row
}
async function folder(env: Bindings,s: Session,key: string,action: 'view'|'contribute' = 'view') {
 const ctx = await context(env,await who(env,s),key);demand(ctx,action)
 insist(ctx.chain.at(-1)!.payload.type === 'folder','not_a_folder');return ctx
}
export async function receiveReport(env: Bindings,s: Session,input: any) {
 const deviceId = (s as any).device as string;insist(deviceId,'device_required',403)
 const d = await device(env,s,deviceId)
 insist(typeof input.folder === 'string' && typeof input.clientVersion === 'string' && input.clientVersion.length <= 80,'invalid_sync_report')
 insist(input.cache && Number.isSafeInteger(input.cache.freeBytes) && input.cache.freeBytes >= 0 && Array.isArray(input.files) && input.files.length <= 500,'invalid_sync_report')
 const files: LocalFile[] = [], seen = new Set<string>()
 for(const f of input.files) {
  insist(f && typeof f.item === 'string' && f.item.length <= 200 && !seen.has(f.item) && safePath(f.path),'invalid_sync_report');seen.add(f.item)
  insist(f.baseVersion === null || typeof f.baseVersion === 'string' && f.baseVersion.length <= 200,'invalid_sync_report')
  insist(f.localChecksum === null || typeof f.localChecksum === 'string' && HASH.test(f.localChecksum),'invalid_sync_report')
  insist(Number.isSafeInteger(f.localSize) && f.localSize >= 0 && ['queued','paused','conflicted','failed','up-to-date'].includes(f.state) && typeof f.reason === 'string' && f.reason.length <= 500,'invalid_sync_report')
  insist(f.conflictItem === undefined || typeof f.conflictItem === 'string' && f.conflictItem.length <= 200,'invalid_sync_report')
  files.push({item:f.item,path:f.path,baseVersion:f.baseVersion,localChecksum:f.localChecksum,localSize:f.localSize,state:f.state,reason:f.reason,...f.conflictItem ? {conflictItem:f.conflictItem} : {}})
 }
 const key=reportKey(deviceId,input.folder),previous=await maybe<Report>(env,'sync-report',key)
 // A revoked folder may report its existing queue, but cannot introduce a new scope or read any server data.
 let fences: Row[] = [d]
 try { const ctx=await folder(env,s,input.folder);fences.push(...ctx.fences) }
 catch(error){if(!(error instanceof ChestError) || ![403,404].includes(error.status) || !previous)throw error}
 const payload: Report={owner:s.operator.email,device:deviceId,folder:input.folder,clientVersion:input.clientVersion,cache:{freeBytes:input.cache.freeBytes},files,at:now(),paused:files.some(f=>f.state==='paused')}
 await commit(env,s,[{row:previous?next(previous,payload):fresh('sync-report',payload,key),...previous?{previous}:{}}],{fences,audits:[{action:'sync.report',object:deviceId,detail:{folder:input.folder,files:files.length,paused:payload.paused}}]})
 return {accepted:true}
}
export async function repairInstructions(env: Bindings,s: Session,key: string) {
 const deviceId=(s as any).device as string;insist(deviceId && typeof key==='string','device_required',403)
 const d=await device(env,s,deviceId),ctx=await folder(env,s,key,'contribute');demand(ctx,'download')
 const report=await maybe<Report>(env,'sync-report',reportKey(deviceId,key)),grant=await maybe<Grant>(env,'sync-grant',grantKey(deviceId,key))
 const active=grant && !grant.payload.consumed && grant.payload.owner===s.operator.email && grant.payload.expiresAt>Date.now() && report?.revision===grant.payload.report
 if(active)await commit(env,s,[{row:next(grant,{...grant.payload,consumed:true}),previous:grant}],{fences:[d,...ctx.fences,report!],audits:[{action:'sync.repair.consume',object:deviceId,detail:{folder:key,setting:'resume'}}]})
 return {paused:report?.payload.paused ?? false,grant:active?{resume:true}:null}
}
async function diagnose(env: Bindings,s: Session,row: ReportRow): Promise<Diagnosis> {
 const p=row.payload,d=await device(env,s,p.device),result: Diagnosis={id:row.id,revision:row.revision,device:p.device,folder:p.folder,deviceName:d.payload.name,folderName:'Folder access unavailable',at:p.at,freeBytes:p.cache.freeBytes,paused:p.paused,canResume:false,files:[],state:'waiting'}
 let ctx: Awaited<ReturnType<typeof folder>>
 try{ctx=await folder(env,s,p.folder);result.folderName=ctx.chain.at(-1)!.payload.name;result.canResume=p.paused&&allowed(ctx,'contribute')&&allowed(ctx,'download')}
 catch(e){if(!(e instanceof ChestError)||![403,404].includes(e.status))throw e;result.files=p.files.map(f=>({item:'',path:'Local file retained',state:'denied',reason:'Folder access was removed. Local work is retained; no permission is expanded.'}));return result}
 for(const f of p.files) {
  try {
   const current=await context(env,await who(env,s),f.item);demand(current,'download')
   insist(current.chain.some(node=>node.id===p.folder),'outside_repair_scope',403)
   const item=current.chain.at(-1)!,v=item.payload.versions.find(v=>v.id===item.payload.current);insist(v,'not_a_file')
   const exact=f.baseVersion===v.id && f.localChecksum===v.checksum && f.localSize===v.size
   const divergent=f.localChecksum!==v.checksum && f.baseVersion!==v.id
   const state=f.state==='conflicted'?'conflicted':divergent?'conflicted':exact&&f.state==='up-to-date'?'verified':f.state==='up-to-date'?'unverified':f.state
   const reason=state==='verified'?'The companion re-read the local file; its version, size and SHA-256 match the retained server original.':state==='conflicted'?'Local and remote work differ. Both are retained. A person must choose; resume will not overwrite either.':f.reason || 'The client has not verified matching bytes yet.'
   let conflictItem: string|undefined
   if(f.conflictItem){try{const copy=await context(env,await who(env,s),f.conflictItem);demand(copy,'view');if(copy.chain.some(node=>node.id===p.folder))conflictItem=f.conflictItem}catch(e){if(!(e instanceof ChestError))throw e}}
   result.files.push({item:f.item,path:f.path,state,reason,localChecksum:f.localChecksum,remoteChecksum:v.checksum,...conflictItem?{conflictItem}:{}})
  }catch(e){if(!(e instanceof ChestError)||![403,404].includes(e.status))throw e;result.files.push({item:'',path:'Local file retained',state:'denied',reason:'Current access or folder scope refuses this file. Local work is retained.'})}
 }
 const fresh=Date.now()-Date.parse(p.at)<5*60_000
 result.state=!fresh?'stale':result.files.length && result.files.every(f=>f.state==='verified')?'verified':'waiting'
 const grant=await maybe<Grant>(env,'sync-grant',grantKey(p.device,p.folder))
 result.resumeAuthorized=!!grant && !grant.payload.consumed && grant.payload.report===row.revision && grant.payload.expiresAt>Date.now()
 if(result.resumeAuthorized)result.canResume=false
 return result
}
export async function repairs(env: Bindings,s: Session) {
 const reports=(await list<Report>(env,'sync-report')).filter(r=>r.payload.owner===s.operator.email)
 const output: Diagnosis[]=[]
 for(const r of reports){try{output.push(await diagnose(env,s,r))}catch(e){if(!(e instanceof ChestError)||e.code!=='device_unavailable')throw e}}
 return output
}
export async function authorizeResume(env: Bindings,s: Session,input: any) {
 insist(typeof input.device==='string'&&typeof input.folder==='string'&&typeof input.revision==='string','invalid_sync_repair')
 const d=await device(env,s,input.device),ctx=await folder(env,s,input.folder,'contribute');demand(ctx,'download')
 const report=await get<Report>(env,'sync-report',reportKey(input.device,input.folder));insist(report.revision===input.revision && report.payload.paused,'sync_report_changed',409)
 const key=grantKey(input.device,input.folder),previous=await maybe<Grant>(env,'sync-grant',key),payload: Grant={owner:s.operator.email,device:d.id,folder:input.folder,report:report.revision,expiresAt:Date.now()+24*3600_000,by:s.operator.email}
 await commit(env,s,[{row:previous?next(previous,payload):fresh('sync-grant',payload,key),...previous?{previous}:{}}],{fences:[d,report,...ctx.fences],audits:[{action:'sync.repair.authorize',object:d.id,detail:{folder:input.folder,setting:'resume',report:report.revision}}]})
 return {authorized:true,setting:'resume',status:'waiting_for_device'}
}
