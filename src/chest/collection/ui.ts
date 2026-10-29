import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { allowed, everything, who } from '../files/access'
import type { RequestPolicy } from '../files/request-model'
import { card, esc, field, form, hidden, select, stamp } from '../ui-shared'
import { collectionExecute } from './api'
import { requestFields } from '../files/request-panel'
import { shareTargets } from '../files/share-targets'
const back='/app/collection',inline={className:'form form-inline',buttonClass:'btn btn-outline'}
const stateLabel=(state:string)=>({accepted:'Accepted · reminders stopped',mismatch:'Evidence needs attention',awaiting_confirmation:'Waiting for recipient confirmation'}[state]??state)
function requirementPanel(collection:any,e:any,email:string,owner:boolean) {
 const r=e.requirement
 const details=`<p>${esc(stateLabel(e.state))}</p>${e.reasons.length?`<ul>${e.reasons.map((reason:string)=>`<li>${esc(reason)}</li>`).join('')}</ul>`:''}<p class="quiet">Request checklist: ${esc(r.checklist)}${r.version?`<br>Exact version: <code>${esc(r.version)}</code>`:''}${e.submission?`<br>Matched submission: <code>${esc(e.submission)}</code>`:''}</p>${e.approval?`<p>Approved by ${esc(e.approval.actor)} · ${stamp(e.approval.at)}</p>`:'<p>Human approval still required.</p>'}`
 const delivery=e.transfer.length?`<details><summary>Transfer evidence (${e.transfer.length})</summary><ul>${e.transfer.map((t:any)=>`<li>${esc(t.payload.kind)} · ${esc(t.payload.actor)} · ${stamp(t.payload.at)}</li>`).join('')}</ul></details>`:'<p class="quiet">No matching transfer evidence recorded.</p>'
 const people=`<ul>${e.recipients.map((p:any)=>`<li>${esc(p.email)}: ${p.confirmed?'personally confirmed':p.access?'confirmation needed':'access revoked; owner review needed'}</li>`).join('')}</ul>`
 const audit=e.confirmations.length?`<details><summary>Confirmation history</summary><ul>${e.confirmations.map((c:any)=>`<li>${esc(c.payload.recipient)} · ${stamp(c.payload.at)}${c.payload.invalidatedAt?` · reopened: ${esc(c.payload.reason)}`:' · exact version and checksum recorded'}</li>`).join('')}</ul></details>`:''
 const mine=e.recipients.find((p:any)=>p.email===email)
 const open=r.item&&r.version&&(owner||mine?.access)?`<p><a class="link" href="/app/items/${esc(r.item)}">Open file</a> · <a class="link" href="/api/chest/items/${esc(r.item)}/bytes/${esc(r.version)}?download=true" download>Download this exact version</a></p>`:''
 const confirm=mine?.access&&!mine.confirmed&&e.state!=='mismatch'?form(`/collection/${collection.id}/confirm`,hidden('requirement',r.id)+hidden('item',r.item)+hidden('version',r.version)+hidden('confirm','true')+`<p>I personally received and checked this exact approved version. Opening a link or receiving an email alone does not establish this.</p>`,'I confirm this exact version',back):''
 const candidates=owner&&e.candidates.length?form(`/collection/${collection.id}/requirements`,hidden('requirements',JSON.stringify(collection.requirements))+hidden('bindRequirement',r.id)+select('Submitted material','candidate',e.candidates.filter((c:any)=>c.item).map((c:any)=>({id:JSON.stringify({item:c.item,version:c.version,submission:c.submission}),label:`${c.status} · version ${c.version}`})))+'<p class="quiet">Selecting evidence does not approve it. A replacement needs its own review and recipient confirmation.</p>','Use this exact submission',back,inline):''
 const proposal=e.state==='mismatch'?'<p><strong>Proposed new delivery:</strong> review the replacement, approve its exact version and restore only the intended recipient’s access if appropriate. Then send it for a fresh confirmation. This checklist grants no access and approves no files.</p>':''
 return `<li class="collection-wrap"><h3>${esc(r.label)}</h3>${details}${open}${people}${confirm}${proposal}${candidates}${delivery}${audit}</li>`
}
export async function collectionPage(env:Bindings,request:Request,s:Session,url:URL):Promise<string|null> {
 if(url.pathname!==back)return null
 const data=await collectionExecute(env,request,s,'GET',['collection'],{},url),owner=s.operator.role==='owner'
 const selected=url.searchParams.get('checklist'),rows=selected?data.checklists.filter((c:any)=>c.id===selected):data.checklists
 const head='<div class="page-head"><h1>Collection checklist</h1><p class="lede">Match requested records to the exact approved versions and each intended recipient’s personal confirmation.</p></div><p class="lib-links"><a class="link" href="/app/files">Files</a> · <a class="link" href="/app/collection">All checklists</a></p>'
 const panels=rows.map((c:any)=>{
  const own=owner&&c.owner===s.operator.email
  const policy=own?`<details><summary>Reminder authorization</summary>${form(`/collection/${c.id}/policy`,`<div class="form-grid">${field('Approved reminder cadence (hours)','cadenceHours',String(c.cadenceHours),'number')}${select('Send reminders automatically','sendReminders',[{id:'false',label:'Draft only'},{id:'true',label:'Send to approved recipients'}],String(c.sendReminders))}${select('Checklist','enabled',[{id:'true',label:'Active'},{id:'false',label:'Paused'}],String(c.enabled))}</div><p>Approved recipients: ${esc(c.recipients.join(', '))}. Recipient changes require a new owner checklist. Access loss stops reminders to that person.</p>`,'Save reminder authorization',back)}${form(`/collection/${c.id}/remind`,'<p>Send due reminders within this authorization and cadence. Accepted material is excluded.</p>','Send due reminders',back,inline)}</details>`:''
  return card(c.title,`<p><strong>${c.state==='accepted'?'All material accepted · reminders stopped':'Collection open'}</strong> · ${c.enabled?'Active':'Paused'}</p><p class="quiet">${c.sendReminders?`Reminders authorized every ${esc(c.cadenceHours)} hours`:'Reminders drafted only; sending needs owner authorization'}</p><ol class="events">${c.evidence.map((e:any)=>requirementPanel(c,e,s.operator.email,own)).join('')}</ol>${policy}${c.reminderDrafts.length?`<details><summary>Reminder drafts</summary>${c.reminderDrafts.map((d:any)=>`<p><strong>To ${esc(d.to)}</strong></p><p class="collection-wrap">${esc(d.message)}</p>`).join('')}</details>`:''}${c.reminderHistory.length?`<details><summary>Reminder history</summary><ul>${c.reminderHistory.map((r:any)=>`<li>${esc(r.payload.recipient)} · ${stamp(r.payload.at)} · ${esc(r.payload.status)}</li>`).join('')}</ul></details>`:''}`)
 }).join('')
 let create=''
 if(owner) {
  const all=await everything(env,await who(env,s)),requests=(await list<RequestPolicy>(env,'file-request')).filter(r=>{const e=all.get(r.payload.folder);return e&&!e.state.trash&&allowed(e,'share')&&r.payload.checklist?.length})
  const choices=requests.flatMap(r=>r.payload.checklist!.map(label=>({id:JSON.stringify({request:r.id,checklist:label,folder:r.payload.folder}),label:`${r.payload.title} · ${label}`})))
  create=choices.length?card('Start a checklist',form('/collection',`<div class="form-grid">${field('Checklist title','title')}${select('First requested record','request1',choices)}${select('Second requested record','request2',[{id:'',label:'None'},...choices],'',false)}${field('Approved recipient emails','recipients','','text')}${field('Approved reminder cadence (hours)','cadenceHours','24','number')}${select('Reminder authorization','sendReminders',[{id:'false',label:'Draft reminders only'},{id:'true',label:'Send to these approved recipients'}])}</div><p>Choose records from the same request folder. Recipients must have active Chest accounts and current access. Submitters use the original file request; its receipt does not approve the material.</p>`,'Create collection checklist',back)) :card('Ask for files',form('/collection-request',select('Folder to receive them','folder',await shareTargets(env,await who(env,s),'folder'))+requestFields(),'Create file request',back))
 }
 return head+panels+(!rows.length?card('No collection checklists','<p>No accessible checklists are assigned to you yet.</p>'):'')+create
}
// Browser forms carry choices already shown to the owner; the API still validates every binding and ACL.
export function collectionInput(input:any) {
 if(input.path==='/collection-request'&&input.folder)input.path=`/items/${input.folder}/file-requests`
 if(input.path==='/collection'&&input.request1) {
  const selected=[input.request1,input.request2].filter(Boolean).map(v=>JSON.parse(v))
  input.folder=selected[0].folder;input.requirements=selected.map(({request,checklist}:any)=>({request,checklist,label:checklist}))
 }
 if(input.bindRequirement&&input.candidate) {
  const requirements=typeof input.requirements==='string'?JSON.parse(input.requirements):input.requirements,choice=JSON.parse(input.candidate)
  input.requirements=requirements.map((r:any)=>r.id===input.bindRequirement?{...r,...choice}:r)
 }
}
