import { card, details, esc, field, form, hidden, select, stamp } from '../ui-shared'
// The package form: on a file or folder page the item is fixed; on Deliveries the person picks one.
function packageForm(first:string,back:string) {
 return form('/transfers',first+select('Delivery audience','audience',[{id:'public',label:'Anyone with the link'},{id:'guests',label:'Invited emails (verification required)'}])+field('Invited emails (comma separated)','guests','','text',false)+field('Email the package to (optional)','sendTo','','email',false)+field('Expires','expires','','date',false)+field('Download sessions allowed','limit','','number',false)+select('Ask recipients to confirm receipt','receipt',[{id:'false',label:'No'},{id:'true',label:'Yes'}]),'Create delivery package',back)
}
export function transferForm(item:string,title:string,back:string) {
 return card('Send a delivery package',`<p>Freeze the current file or folder versions. Recipients can resume interrupted downloads; receipts distinguish views, bytes served and explicit confirmation.</p>${packageForm(hidden('item',item)+field('Package title','title',title),back)}`,'side-card')
}
export function transfersPage(rows:any[],targets:{id:string;label:string}[]=[]) {
 const create=targets.length?packageForm(select('File or folder to send','item',targets)+field('Package title','title'),'/app/transfers'):'<p class="quiet">Nothing here can be sent yet.</p>'
 return `<div class="page-head"><h1>Deliveries</h1><p class="lede">Pinned packages and their delivery evidence.</p></div>${rows.length?`<ul class="events">${rows.map(r=>`<li><a class="link" href="/app/transfers/${esc(r.id)}">${esc(r.title)}</a> · ${r.started} download sessions · ${stamp(r.at)}</li>`).join('')}</ul>${targets.length?details('New delivery package',create):''}`:card('Send a delivery package',create)}`
}
const labels:Record<string,string>={view:'Page viewed (human not proven)',scanner_view:'Scanner or preview-bot view',started:'Download session started',bytes_completed:'Complete file bytes served',confirmed:'Recipient explicitly confirmed',mail_accepted:'Email provider accepted (receipt not proven)'}
export function transferPage(d:any) {
 return `<div class="page-head"><h1>${esc(d.title)}</h1><p class="lede">${d.started}${d.limit?` of ${d.limit}`:''} download sessions started · ${d.link.policyBlocked?'Blocked by sharing policy':esc(d.link.state)}</p></div><p><a class="link" href="/app/items/${esc(d.item)}">Open original</a></p>${d.link.state==='revoked'?'':form(`/transfers/${d.id}/revoke`,'','Revoke package',`/app/transfers/${d.id}`)}${card('Delivery evidence',`<p>Views can come from mail scanners. Bytes served records server delivery, not a saved file or human receipt. Public confirmations are self-reported; invited confirmations name the verified email.</p>${d.events.length?`<ol class="events">${d.events.map((e:any)=>`<li><strong>${esc(labels[e.kind])}</strong> · ${esc(e.actor)} · ${stamp(e.at)}${e.version?`<p class="mono">Version ${esc(e.version)}${e.bytes===undefined?'':` · ${e.bytes} bytes`}</p>`:''}</li>`).join('')}</ol>`:'<p>No delivery activity yet.</p>'}`)}`
}
