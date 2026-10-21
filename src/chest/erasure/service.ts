import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { digest } from '../blobs'
import { id, insist, now, type Row } from '../model'
import { decode, get, list } from '../store'
import { commit, fresh, maybe, next, type Op } from '../files/repo'
import { eraseReading } from '../read/jobs'
import { identityPlan } from './identity'
import { eraseImportCustody, eraseIdentityCustody } from './custody'
import { erasureJournal, portableFences, sourceIdentity } from './journal'
import type { BackupLocation, ErasureReceipt, ErasureTarget, Hold, JournalEntry } from './model'
const allRecords=async(env:Bindings)=>(await env.DB.prepare('SELECT * FROM chest_records ORDER BY id').all()).results.map(decode)
const refers=(value:any,ids:Set<string>):boolean=>typeof value==='string'?ids.has(value):Array.isArray(value)?value.some(v=>refers(v,ids)):!!value&&typeof value==='object'&&Object.values(value).some(v=>refers(v,ids))
export async function erasureView(env:Bindings,s:Session){
 owner(s);await sourceIdentity(env)
 return {receipts:(await list<ErasureReceipt>(env,'erasure')).map(r=>({...r.payload,id:r.id})).sort((a,b)=>b.at.localeCompare(a.at)),backups:(await list<BackupLocation>(env,'erasure-backup')).map(r=>({id:r.id,...r.payload})),holds:(await list<Hold>(env,'erasure-hold')).map(r=>({id:r.id,...r.payload})),people:(await list(env,'person')).filter(r=>r.id!==s.operator.email).map(r=>({id:r.id,name:r.payload.name})),items:(await list(env,'item')).filter(r=>r.payload.trash).map(r=>({id:r.id,name:r.payload.name})),documents:(await list(env,'document')).filter(r=>r.payload.trash).map(r=>({id:r.id,name:r.payload.title}))}
}
export async function registerBackup(env:Bindings,s:Session,input:any){
 owner(s);const name=String(input.name??'').trim(),locator=String(input.locator??'').trim(),retention=String(input.retention??'').trim()
 insist(name&&name.length<160&&locator&&locator.length<1024&&retention&&retention.length<1000,'invalid_backup_location')
 // The registry is a location description, never an authenticated URL or provider credential.
 insist(!/[?#@]/.test(locator)&&!/^https?:\/\//.test(locator),'private_backup_reference_required')
 const row=fresh<BackupLocation>('erasure-backup',{name,locator,locatorSha256:await digest(new TextEncoder().encode(locator)),retention})
 await commit(env,s,[{row}],{audits:[{action:'erasure.backup.register',object:row.id}]});return {id:row.id,...row.payload}
}
export async function saveHold(env:Bindings,s:Session,input:any){
 owner(s);const scope=String(input.scope),subject=String(input.subject??''),reason=String(input.reason??'').trim()
 insist(['item','document','identity'].includes(scope)&&subject&&reason&&reason.length<=1000,'invalid_erasure_hold')
 const old=input.id?await get<Hold>(env,'erasure-hold',String(input.id)):null,payload={scope:scope as Hold['scope'],subject,reason,active:input.active!==false&&input.active!=='false'}
 const row=old?next(old,payload):fresh('erasure-hold',payload)
 await commit(env,s,[{row,previous:old??undefined}],{audits:[{action:'erasure.hold.change',object:row.id,detail:{active:payload.active}}]});return {id:row.id,...payload}
}
export async function requestErasure(env:Bindings,s:Session,input:any,authorizedRows?:Row[]){
 if(!authorizedRows)owner(s)
 const records=await allRecords(env),items=new Set<string>(),documents=new Set<string>(),email=input.email?String(input.email).trim().toLowerCase():null
 if(email)insist(input.confirm===email,'confirm_identity')
 if(input.item){const row=records.find(r=>r.id===input.item&&r.kind==='item');insist(row,'not_found',404);insist(row.payload.trash,'not_in_trash',409);items.add(row.id)}
 if(input.document){const row=records.find(r=>r.id===input.document&&r.kind==='document');insist(row?.payload.trash,'not_in_trash',409);documents.add(row.id)}
 if(authorizedRows)for(const row of authorizedRows)items.add(row.id)
 const person=email?await identityPlan(env,s,email):null
 const personal=person?records.filter(r=>r.kind==='space'&&r.payload.kind==='personal'&&r.payload.owner===email):[]
 for(const row of records)if(row.kind==='item'&&personal.some(p=>p.id===row.payload.space))items.add(row.id)
 let changed=true;while(changed){changed=false;for(const row of records)if(row.kind==='item'&&items.has(row.payload.parent)&&!items.has(row.id)){items.add(row.id);changed=true}}
 insist(items.size||documents.size||person,'erasure_selection_required')
 const selected=records.filter(r=>items.has(r.id)||documents.has(r.id)),checksums=[...new Set([...selected.flatMap(r=>(r.payload.versions??[]).map((v:any)=>v.checksum as string)),...records.filter(r=>r.kind==='signature'&&items.has(r.payload.item)&&r.payload.rendition).map(r=>r.payload.rendition.checksum as string)])],at=now(),key=id()
 const entry:JournalEntry={id:key,at,items:[...items],documents:[...documents],identities:person?[person.hash]:[],checksums}
 const holds=(await list<Hold>(env,'erasure-hold')).filter(h=>h.payload.active&&((h.payload.scope==='item'&&items.has(h.payload.subject))||(h.payload.scope==='document'&&documents.has(h.payload.subject))||(h.payload.scope==='identity'&&h.payload.subject===email)))
 const targets:ErasureTarget[]=holds.map(h=>({store:'preservation hold',status:'held',detail:h.payload.reason}))
 const receipt=fresh<ErasureReceipt>('erasure',{...entry,by:s.operator.email,state:holds.length?'held':'pending',targets,originals:{pending:checksums,removed:[],shared:[]},versions:selected.reduce((n,r)=>n+(r.payload.versions??[]).length,0),bytes:selected.reduce((n,r)=>n+(r.payload.versions??[]).reduce((a:number,v:any)=>a+v.size,0),0),scope:person?'identity and personal files':documents.size?'governed records':'files'},key)
 // A preservation request is deliberately recorded without touching the held object or its bytes.
 if(holds.length){await commit(env,s,[{row:receipt}],{audits:[{action:'erasure.held',object:key,detail:{outcome:'held'}}]});return receipt}
 // Custody erasure happens before native removal; interruption leaves an inspectable pending operation.
 await commit(env,s,[{row:receipt}],{audits:[{action:'erasure.request',object:key,detail:{outcome:'pending'}}]})
 return continueErasure(env,s,receipt,{records,selected,personal,person,email})
}
type Plan={records:Row[];selected:Row[];personal:Row[];person:Awaited<ReturnType<typeof identityPlan>>|null;email:string|null}
async function continueErasure(env:Bindings,s:Session,receipt:Row<ErasureReceipt>,plan:Plan){
 const p=receipt.payload,ids=new Set([...p.items,...p.documents]),removed=new Map(plan.selected.map(r=>[r.id,r])),protectedKinds=new Set(['erasure','erasure-journal','erasure-backup','erasure-hold','audit-erased'])
 for(const key of p.documents)await eraseImportCustody(env,s,key)
 if(plan.person&&plan.email)await eraseIdentityCustody(env,s,plan.email,plan.person.hash)
 const related=new Set<string>(ids)
 // Follow application authority and job references to a fixed point, including guest sessions/challenges,
 // multipart staging, snapshots, pending notices and recoverable operation snapshots.
 let changed=true;while(changed){changed=false;for(const row of plan.records){if(protectedKinds.has(row.kind)||['item','document','space','person','schema','collection','group'].includes(row.kind)||removed.has(row.id))continue
  if(refers(row.payload,related)){removed.set(row.id,row);related.add(row.id);changed=true}
 }}
 for(const row of plan.personal)removed.set(row.id,row)
 if(plan.person){const row=plan.records.find(r=>r.kind==='person'&&r.id===plan.email);if(row)removed.set(row.id,row)}
 const stageKeys=[...removed.values()].filter(r=>['upload','request-upload'].includes(r.kind)&&r.payload.key).map(r=>r.payload.key as string)
 const ops:Op[]=[...removed.values()].filter(r=>!p.documents.includes(r.id)).map(row=>({row,previous:row,remove:true}))
 if(plan.person)ops.push(...plan.person.ops.filter(o=>!removed.has(o.row.id)))
 const journal=fresh<JournalEntry>('erasure-journal',{id:p.id,at:p.at,items:p.items,documents:p.documents,identities:p.identities,checksums:p.checksums},`erasure-journal:${receipt.id}`)
 const portable=await portableFences(env,[...removed.values()],!!plan.person)
 const targets:ErasureTarget[]=[{store:'metadata and access',status:'complete',detail:'Selected records, retained versions and referencing authority removed.'},{store:'import staging and custody',status:'complete',detail:'Affected retained originals, plans and reverse snapshots withdrawn and source IDs fenced.'}]
 for(const b of await list<BackupLocation>(env,'erasure-backup'))targets.push({store:b.payload.name,backup:b.id,status:'pending',detail:`Delete affected copy and report its verified result. Retention: ${b.payload.retention}`})
 for(const b of await list(env,'backup-run'))if(b.payload.state==='complete')targets.push({store:'independent backup',backup:b.id,status:'pending',detail:'This pre-erasure archive may contain selected data; its independent runner must confirm removal under provider retention.'})
 const after=next(receipt,{...p,targets})
 await commit(env,s,[...ops,{row:journal},{row:after,previous:receipt}],{fences:plan.records.filter(r=>!p.documents.includes(r.id)),statements:[{sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records)=? THEN 1 ELSE 0 END',params:[plan.records.length+2-removed.size]},...(plan.person?.statements??[]),...portable],changes:[...ids].map(item=>({item,space:'erased',kind:'erase'})),audits:[{action:'item.erase',object:receipt.id,detail:{outcome:'records_erased',items:ids.size}}]})
 for(const key of stageKeys)await env.BLOBS.delete(key)
 if(plan.person)await plan.person.redactAudit()
 await minimizeAudit(env,ids)
 return finishOriginals(env,s,after)
}
async function minimizeAudit(env:Bindings,ids:Set<string>){
 const rows=(await env.DB.prepare('SELECT id,object_id,detail FROM chest_audit').all<any>()).results
 for(const row of rows){let detail:any;try{detail=JSON.parse(row.detail)}catch{detail={}}
  if(ids.has(row.object_id)||refers(detail,ids))await env.DB.prepare("UPDATE chest_audit SET detail=? WHERE id=?").bind(JSON.stringify({erased:true}),row.id).run()
 }
}
export async function finishOriginals(env:Bindings,s:Session,receipt:Row<ErasureReceipt>){
 const p=receipt.payload,removed=[...p.originals.removed],shared=[...p.originals.shared],pending:string[]=[]
 for(const sum of p.originals.pending){
  const used=await env.DB.prepare("SELECT 1 FROM chest_records WHERE kind NOT LIKE 'erasure%' AND kind NOT IN ('audit-erased','extract','reading') AND instr(payload,?)>0 LIMIT 1").bind(sum).first()
  if(used){shared.push(sum);continue}
  try{await env.BLOBS.delete(`sha256/${sum}`);await eraseReading(env,sum);insist(!await env.BLOBS.head(`sha256/${sum}`),'original_delete_unconfirmed',503);removed.push(sum)}catch{pending.push(sum)}
 }
 const targets=[...p.targets.filter(t=>t.store!=='originals and derivatives'),{store:'originals and derivatives',status:pending.length?'pending' as const:'complete' as const,detail:pending.length?'Storage deletion not confirmed; retry this operation.':`${removed.length} unshared originals and their derived readings removed; ${shared.length} copies still needed by independent records retained.`}]
 const done=next(receipt,{...p,targets,originals:{pending,removed:[...new Set(removed)],shared:[...new Set(shared)]},state:targets.every(t=>t.status==='complete')?'complete' as const:'pending' as const})
 await commit(env,s,[{row:done,previous:receipt}],{audits:[{action:'erasure.outcome',object:receipt.id,detail:{outcome:done.payload.state}}]});return done
}
export async function backupResult(env:Bindings,s:Session,key:string,input:any){
 owner(s);const row=await get<ErasureReceipt>(env,'erasure',key),backup=await get<BackupLocation>(env,'erasure-backup',String(input.backup))
 insist(row.payload.targets.some(t=>t.backup===backup.id),'backup_not_in_erasure')
 insist(['complete','pending','held'].includes(input.status)&&input.locatorSha256===backup.payload.locatorSha256,'invalid_backup_result')
 if(input.status==='complete')insist(input.verified===true&&/^[a-f0-9]{64}$/.test(input.sha256),'verified_backup_deletion_required')
 const detail=input.status==='complete'?'Owner confirmed the private deletion tool verified the archive and read back its absence.':String(input.detail??'Deletion not confirmed.').slice(0,1000)
 const targets=row.payload.targets.map(t=>t.backup===backup.id?{...t,status:input.status,detail}:t),updated=next(row,{...row.payload,targets,state:targets.every(t=>t.status==='complete')?'complete' as const:'pending' as const})
 await commit(env,s,[{row:updated,previous:row}],{audits:[{action:'erasure.backup.result',object:key,detail:{backup:backup.id,outcome:input.status,ownerAttestation:true}}]});return updated
}
export async function erasureExecute(env:Bindings,s:Session,method:string,parts:string[],input:any){
 if(parts[0]!=='erasure')return undefined
 owner(s)
 if(method==='GET'&&parts[1]==='backups')return {format:'chest-erasure-backups-1',backups:(await list<BackupLocation>(env,'erasure-backup')).map(r=>({id:r.id,...r.payload}))}
 if(method==='GET'&&parts[1]==='journal')return erasureJournal(env,s)
 if(method==='GET')return erasureView(env,s)
 insist(method==='POST','method_not_allowed',405)
 if(parts[1]==='backups')return registerBackup(env,s,input)
 if(parts[1]==='holds')return saveHold(env,s,input)
 if(parts[1]&&parts[2]==='backup-result')return backupResult(env,s,parts[1],input)
 if(parts[1]&&parts[2]==='retry'){const row=await get<ErasureReceipt>(env,'erasure',parts[1]);insist(row.payload.state!=='held','hold_requires_new_review',409);insist(await maybe(env,'erasure-journal',`erasure-journal:${row.id}`),'erasure_needs_owner_review',409);return finishOriginals(env,s,row)}
 return requestErasure(env,s,input)
}
