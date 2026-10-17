import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { allowed, everything, start, who } from '../files/access'
import type { Space } from '../files/model'
import { esc, field, hidden, select, form, card, stamp } from '../ui-shared'
import { filesLinks } from '../files/ui-pages'
import { pathOf } from '../files/exposure'
import { intakeExecute } from './intake'
import { intakePage } from './ui-intake'
import { rulesExecute } from './rules'
import { duplicatesExecute } from './duplicates'
const back='/app/filing', inline={className:'form form-inline',buttonClass:'btn btn-outline'}
const head=(title:string,lede:string)=>`<div class="page-head"><h1>${esc(title)}</h1><p class="lede">${esc(lede)}</p></div><div class="lib-tools">${filesLinks()}<p class="lib-links"><a class="link" href="/app/filing">Filing activity</a> · <a class="link" href="/app/filing/intake">Email intake</a> · <a class="link" href="/app/filing/rules">Rules &amp; agent</a> · <a class="link" href="/app/filing/duplicates">Duplicates</a></p></div>`
const item=(id:string,name:string)=>`<a class="link" href="/app/items/${esc(id)}">${esc(name)}</a>`
export async function filingPage(env:Bindings,s:Session,url:URL):Promise<string|null>{
 if(!/^\/app\/filing(\/|$)/.test(url.pathname))return null
 const w=await who(env,s), spaces=(await list<Space>(env,'space')).filter(r=>['manager','owner'].includes(start(r.payload,w).role??'')).map(r=>({id:r.id,label:r.payload.name})), all=await everything(env,w)
 const files=[...all.values()].filter(e=>e.row.payload.type==='file'&&!e.state.trash&&allowed(e,'manage')).map(e=>({id:e.row.id,label:pathOf(all,e.row.id)}))
 const folders=[...all.values()].filter(e=>e.row.payload.type==='folder'&&!e.state.trash&&allowed(e,'manage')).map(e=>({id:e.row.id,label:pathOf(all,e.row.id)})).sort((a,b)=>a.label.localeCompare(b.label))
 if(url.pathname==='/app/filing/intake'){
  const data:any=await intakeExecute(env,s,'GET',['filing','intake'],{})
  const configs=data.intakes.map((r:any)=>`<li><strong>${esc(r.payload.address)}</strong> → ${item(r.payload.folder,all.has(r.payload.folder)?pathOf(all,r.payload.folder):'Folder')}<p class="quiet">${r.payload.enabled?'Enabled':'Paused'} · configured by ${esc(r.payload.by)}</p>${form('/filing/intake',hidden('space',r.payload.space)+hidden('folder',r.payload.folder)+hidden('address',r.payload.address)+hidden('enabled',r.payload.enabled?'false':'true'),r.payload.enabled?'Pause intake':'Enable intake',url.pathname,inline)}</li>`).join('')
  const receipts=data.receipts.map((r:any)=>`<li>${item(r.payload.item,r.payload.filename)}<p class="quiet">From ${esc(r.payload.sender)} · ${stamp(r.payload.at)}<br>Message ${esc(r.payload.messageId)}</p></li>`).join('')
  return intakePage({head:head('Email intake','Give a space its own email address. Files attached to emails sent there land in a folder you choose, exactly as sent, with who sent them and when.'),unavailable:data.unavailable,spaces,folders,configs,receipts,local:env.AUTH_LOCAL==='true',origin:env.AUTH_ORIGIN,path:url.pathname})
 }
 if(url.pathname==='/app/filing/duplicates'){
  const d:any=await duplicatesExecute(env,s,'GET',['filing','duplicates'],{},url)
  return head('Merge duplicates','Review identical bytes and similar extracted text. Merging keeps both originals, every version and existing links; you can undo it.')+card('Proposed merges',d.proposals.length?`<ul class="events">${d.proposals.map((p:any)=>`<li><strong>${item(p.keep.id,p.keep.name)} + ${item(p.duplicate.id,p.duplicate.name)}</strong><p class="quiet">${esc(p.keep.spaceName??'')} → ${esc(p.duplicate.spaceName??'')}</p><p>${p.reason==='exact_hash'?'Identical file bytes':`Similar content · ${Math.round(p.similarity*100)}% similarity`}</p>${p.canMerge?form('/filing/duplicates/merge',hidden('keep',p.keep.id)+hidden('duplicate',p.duplicate.id),'Merge keeping versions',url.pathname,inline):'<p class="quiet">An owner with manage access to both files can merge these.</p>'}</li>`).join('')}</ul>`:'<p class="quiet">No duplicate proposals in the files you can access.</p>')+card('Merge history',d.merges.length?`<ul class="events">${d.merges.map((m:any)=>`<li>${item(m.keep.id,m.keep.name)} ← ${item(m.duplicate.id,m.duplicate.name)}<p class="quiet">${stamp(m.at)} · ${m.undone?'Undone':'Merged; originals and links retained'}</p>${m.canUndo?form(`/filing/duplicates/${m.id}/undo`,'','Undo merge',url.pathname,inline):''}</li>`).join('')}</ul>`:'<p class="quiet">No merges yet.</p>')
 }
 if(url.pathname==='/app/filing/rules'){
  const d:any=await rulesExecute(env,s,'GET',['filing','rules'],{},url), a:any=await rulesExecute(env,s,'GET',['filing','agent'],{},url)
  const root=[{id:'',label:'Space root'},...folders]
  const rows=d.rules.map((r:any)=>`<li><strong>${esc(r.payload.name)}</strong><p class="quiet">${esc(r.payload.match.type||'Any type')} · ${esc(r.payload.match.sender||'Any sender')} · ${esc(r.payload.match.content||'Any content')} → ${esc(r.payload.destination&&all.has(r.payload.destination)?pathOf(all,r.payload.destination):'Space root')} · ${r.payload.enabled?'Enabled':'Paused'}</p>${form('/filing/rules',hidden('id',r.id)+hidden('space',r.payload.space)+hidden('source',r.payload.source??'')+hidden('destination',r.payload.destination??'')+hidden('name',r.payload.name)+hidden('match',JSON.stringify(r.payload.match))+hidden('enabled',r.payload.enabled?'false':'true'),r.payload.enabled?'Pause rule':'Enable rule',url.pathname,inline)}</li>`).join('')
  const suggestions=(a.suggestions??[]).filter((r:any)=>(r.payload??r).state==='pending').map((r:any)=>{const p=r.payload??r;return `<li>${item(p.item,all.get(p.item)?.row.payload.name??'File')}<p>${esc(p.explanation??p.reason??'Review the proposed filing')}</p><p class="quiet">${esc(p.destinationPath)} · ${esc(p.quote)} · ${esc(p.uncertainty)}</p>${form('/filing/agent',hidden('action','apply')+hidden('suggestion',r.id),'Apply proposed move',url.pathname,inline)}${form('/filing/agent',hidden('action','decline')+hidden('suggestion',r.id),'Decline',url.pathname,inline)}</li>`}).join('')
  return head('Rules & agent','File arrivals by type, sender and content. Every move has a reason and Undo in Filing activity.')+card('Add a standing rule',form('/filing/rules',`<div class="form-grid">${field('Rule name','name')}${select('Space','space',spaces)}${select('Arriving in','source',root)}${select('File into','destination',root)}${field('File type (an ending such as .pdf, or a type such as application/pdf)','type','','text',false)}${field('Sender email (exact)','sender','','text',false)}${field('Document content contains','content','','text',false)}</div><p class="quiet">All entered conditions must match. The first matching enabled rule handles the file. Rules keep the original bytes and stay inside one space. Permission changes or name conflicts block a move visibly.</p>`,'Create rule',url.pathname))+card('Standing rules',rows?`<ul class="events">${rows}</ul>`:'<p class="quiet">No rules yet. Uploads and email attachments stay in their chosen folder.</p>')+card('AI filing agent',`<p>${esc(a.message??a.reader?.unavailable??(a.reader?.missing?'AI filing needs the install’s model key. Add one under Reading scans in People & settings.':null)??'The agent uses the installation’s AI model key. Add it under Reading scans in People & settings; only the owner can change it. Rules work without a key.')}</p><p><a class="link" href="/app/admin">Manage the install’s AI key</a></p>${form('/filing/agent',hidden('action','preview')+select('File to classify','item',files)+select('Proposed destination','destination',[{id:'',label:'Let agent choose'},...folders]),'Preview filing',url.pathname)}${files.length?'':'<p class="quiet">Upload a file first to ask the agent where it belongs.</p>'}${suggestions?`<ul class="events">${suggestions}</ul>`:''}`)
 }
 const d:any=await rulesExecute(env,s,'GET',['filing','moves'],{},url)
 return head('Filing activity',`${d.filedThisWeek} files filed this week. Undone moves remain in this history.`)+card('Moves and explanations',d.moves.length?`<ol class="events">${d.moves.map((r:any)=>{const m=r.payload;return `<li><strong>${item(m.item,m.name)} → ${esc(m.destinationPath??m.destination??'Space root')}</strong><p>${esc(m.explanation)}</p><p class="quiet">${esc(m.evidence)}</p><p class="quiet">${stamp(m.at)} · ${esc(m.status)}${m.reason?` · ${esc(m.reason)}`:''}</p>${m.status==='filed'?form(`/filing/moves/${r.id}/undo`,'','Undo',back,inline):''}</li>`}).join('')}</ol>`:'<p class="quiet">No filing moves yet. Set up an email address or a standing rule to start.</p>')
}
export function filingInput(input:any){
 if(input.path==='/filing/rules'){
  if(typeof input.match==='string')input.match=JSON.parse(input.match)
  else input.match={type:input.type??'',sender:input.sender??'',content:input.content??''}
  input.source=input.source||null;input.destination=input.destination||null
  if(typeof input.enabled==='string')input.enabled=input.enabled==='true'
 }
 if(input.path==='/filing/agent')input.destination=input.destination||null
}
