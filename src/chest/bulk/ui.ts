import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { allowed, everything, start, who } from '../files/access'
import type { Space } from '../files/model'
import { card, esc, field, form, hidden, select, stamp } from '../ui-shared'
import { jobs, ownedJob, selection, viewJob } from './jobs'
const back='/app/bulk'
const states: Record<string,string> = { pending:'Work remains',complete:'Completed',partial:'Partial result',ready:'Ready to download',cancelled:'Cancelled',succeeded:'Succeeded',refused:'Refused' }
export function selectionControls(entries: {id:string;name:string}[], returnTo='/app/files') {
 if(!entries.length)return ''
 return `<form method="get" action="/app/bulk" class="form bulk-selection" aria-label="Select files and folders">${hidden('returnTo',returnTo)}<fieldset><legend>Select files and folders</legend>${entries.map(e=>`<label><input type="checkbox" name="items" value="${esc(e.id)}"> ${esc(e.name)}</label>`).join('')}</fieldset><p data-selection-count aria-live="polite"></p><button class="btn btn-outline">Actions for selected items</button><button type="button" class="btn btn-outline" data-clear-selection>Clear selection</button></form>`
}
export function bulkInput(input:any) { for(const k of ['confirmExternal','confirmNonMember'])if(input[k]!==undefined)input[k]=input[k]===true||input[k]==='true' }
export async function bulkPage(env: Bindings, s: Session, url: URL): Promise<string|null> {
 if(url.pathname!==back&&!url.pathname.startsWith(back+'/'))return null
 const key=url.pathname.slice(back.length+1)
 const intro=`<div class="page-head"><h1>Selected items</h1><p class="lede">Move, copy, share, recover or download a selection. Each item uses your current access; refusals stay visible.</p></div><p class="lib-links"><a class="link" href="/app/files">Files</a> · <a class="link" href="/app/bulk">Your jobs</a></p>`
 if(key) {
  const job=await ownedJob(env,s,key),data=await viewJob(env,s,job),running=job.payload.state==='active'&&data.state==='pending'
  const progress=`<p role="status"><strong>${esc(states[data.state]??data.state)}</strong> · ${data.done} of ${data.total} items checked · ${data.succeeded} ${data.action==='download'?'ready':'succeeded'} · ${data.refused} refused</p>`
  const controls=(running?form(`/bulk/${key}/run`,'<p>Resume unprocessed items using your current role. Already recorded items are never repeated.</p>','Resume remaining items',`${back}/${key}`,{buttonClass:'btn btn-outline'}):'')+(job.payload.state==='active'&&data.action==='download'?`<p><a class="btn" href="/api/chest/bulk/${esc(key)}/archive" download>Download selection ZIP</a></p><p class="quiet">The ZIP checks access again for every original and contains a reconciliation manifest. A broken connection requires downloading the archive again. Receiving a link does not confirm delivery.</p>`:'')+(running?form(`/bulk/${key}/cancel`,'<p>Stop remaining work. Completed items are retained.</p>','Cancel remaining work',`${back}/${key}`,{buttonClass:'btn btn-outline'}):'')
  const entries=`<ol class="events">${data.entries.map(e=>`<li><strong>${esc(e.name??'Item unavailable with current access')}</strong> · ${esc(states[e.outcome]??(e.outcome==='ready'?'Ready to download':'Waiting'))}${e.reason?`<p class="quiet">${esc(e.reason.replaceAll('_',' '))}</p>`:''}${e.result&&e.name&&e.outcome==='succeeded'?`<p><a class="link" href="${data.action==='trash'?'/app/files/trash':'/app/items/'+esc(e.result)}">${data.action==='trash'?'Open in Trash':'Open result'}</a></p>`:''}</li>`).join('')}</ol>`
  return intro+`<div data-bulk-job="${esc(key)}" data-bulk-pending="${running}">${card(`${data.action[0].toUpperCase()+data.action.slice(1)} selection`,progress+controls+entries)}</div>`
 }
 const selected=url.searchParams.getAll('items')
 if(selected.length) {
  const ids=selection({items:selected}),w=await who(env,s),catalog=await everything(env,w)
  const names=ids.map(id=>{const e=catalog.get(id);return e&&allowed(e,'view')&&(!e.state.trash||e.state.manager||e.row.payload.trash?.by===s.operator.email)?e.row.payload.name:'Item unavailable with current access'})
  const spaces=(await list<Space>(env,'space')).filter(row=>allowed({space:row,state:start(row.payload,w)},'contribute'))
  const folders=[...catalog.values()].filter(e=>e.row.payload.type==='folder'&&!e.state.trash&&allowed(e,'contribute'))
  const destination=select('Destination space','space',spaces.map(r=>({id:r.id,label:r.payload.name})),'',false)+select('Destination folder','parent',[{id:'',label:'Root of destination space'},...folders.map(e=>({id:e.row.id,label:`${e.space.payload.name} / ${e.row.payload.name}`}))],'',false)
  const options=select('Action','action',[{id:'move',label:'Move'},{id:'copy',label:'Copy'},{id:'share',label:'Share'},{id:'trash',label:'Move to trash'},{id:'restore',label:'Restore from trash'},{id:'download',label:'Download ZIP'}]).replace('<select ', '<select aria-label="Action" ')
  const sharing=field('Share with person or group','principal','','text',false)+select('Sharing role','role',[{id:'viewer',label:'Viewer'},{id:'commenter',label:'Commenter'},{id:'editor',label:'Editor'}])+field('Sharing expiry','expires','','date',false)+field('Message','message','','text',false)+`<label><input type="checkbox" name="confirmExternal" value="true"> I confirm sharing these items with the specified external recipients, within the current sharing policy.</label>`
  return intro+card(`${ids.length} selected items`,`<ul>${names.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>${form('/bulk',hidden('items',JSON.stringify(ids))+options+`<details><summary>Destination for move or copy</summary><div class="form-grid">${destination}</div></details><details><summary>Recipient for sharing</summary><div class="form-grid">${sharing}</div></details><p class="quiet">Folders include their trees. Existing rights and policies apply to every selected item. You can leave this page and resume the stored job later.</p>`,'Start selected action',back)}`)
 }
 const rows=await jobs(env,s)
 return intro+card('Your stored jobs',rows.length?`<ul class="events">${rows.map(j=>`<li><a class="link" href="${back}/${esc(j.id)}">${esc(j.action)} · ${esc(states[j.state]??j.state)}</a><p>${j.done} of ${j.total} checked · ${j.refused} refused · ${stamp(j.at)}</p></li>`).join('')}</ul>`:'<p>Select items from a folder, search results or trash to start a job.</p>')
}
