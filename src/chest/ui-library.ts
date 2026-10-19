import { esc,field,form,details,filingFields,icon,kindLabel,isoDay } from './ui-shared'
import { icons } from '../ui/icons'
const relation=(d:any)=>d.reference?.kind?`${esc(kindLabel(d.reference.kind))} <span aria-hidden="true">·</span> ${esc(d.reference.name)}`:'Unfiled'
// One record row: its status on a folder tab, title and relationship, then the mono facts and a chevron to the record.
function row(r:any,q:string){const d=r.payload,v=d.versions.find((v:any)=>v.id===d.approved),href=`/app/documents/${r.id}`
 return `<article class="rec"><span class="chip${v?' chip-action':''} rec-tag">${v?'Approved':'Awaiting approval'}</span><div class="rec-card">
 <div class="rec-name">${icon('document')}<div><h2><a href="${href}">${esc(d.title)}</a></h2><p class="rec-rel">${relation(d)}</p></div></div>
 <dl class="rec-facts"><div><dt>${v?'Approved:':'Awaiting approval'}</dt><dd>${v?`<span class="mono one-line" title="${esc(v.filename)}">${esc(v.filename)}</span>`:''}<span class="mono">${d.versions.length} version(s)</span></dd></div><div><dt>Owner:</dt><dd class="mono one-line" title="${esc(d.owner)}">${esc(d.owner)}</dd></div><div><dt>Review:</dt><dd class="mono">${isoDay(d.reviewDate||'Not scheduled')}</dd></div><div><dt>Expiry:</dt><dd class="mono">${isoDay(d.expiryDate||'Not scheduled')}</dd></div></dl>
 ${r.fieldIssues.length?`<p class="rec-issue"><a class="chip chip-issue" href="${href}">${r.fieldIssues.length} field issue(s) under the current document type</a></p>`:''}${q?`<p class="rec-match mono">${esc((d.versions.find((v:any)=>v.text.toLowerCase().includes(q.toLowerCase()))?.text||'').slice(0,180))}</p>`:''}
 <a class="rec-open" href="${href}" tabindex="-1" aria-hidden="true">${icon('chevron')}</a></div></article>`}
// The review and expiry work panel: every scheduled date on an accessible record, with its state.
function work(data:any){const today=new Date().toISOString().slice(0,10)
 const items=data.documents.flatMap((r:any)=>['review','expiry'].filter(kind=>r.payload[kind+'Date']).map(kind=>{const date=r.payload[kind+'Date'],done=r.payload.completions.some((c:any)=>c.kind===kind&&c.date===date),state=done?'Completed with evidence':date<=today?'Due':'Upcoming'
  return `<li><a href="/app/documents/${r.id}">${esc(r.payload.title)}</a><span class="mono work-when">${kind} ${isoDay(date)}</span><span class="chip${state==='Due'?' chip-due':state==='Upcoming'?' chip-upcoming':''}">${state}</span></li>`})).join('')
 return `<aside class="card side-card" aria-labelledby="work-title"><h2 id="work-title">Review and expiry work</h2>${items?`<ul class="work-list">${items}</ul>`:'<p class="mono quiet">No scheduled work.</p>'}</aside>`}
function empty(data:any,trash:boolean){return `<div class="empty-state empty-grid"><span class="empty-icon">${icons.books}</span><p>${trash?'Trash is empty.':'No accessible records. Create a collection and document type, then upload an original.'}</p>${data.me.role==='owner'&&!trash?'<a class="btn" href="/app/admin">People &amp; settings</a>':''}</div>`}
export function library(data:any,q:string,trash:boolean){
 const upload=data.collections.length&&data.schemas.length?details('Upload a document',form('/documents',filingFields(data)+field('Original file','file','','file'),'Upload and submit'),'btn'):'<p class="quiet">A collection and document type are needed before upload.</p>'
 return `<div class="page-head"><h1>${trash?'Trash':'Document library'}</h1><p class="lede">${data.count} accessible records. Approved versions remain current while replacements are reviewed.</p></div>
 <div class="lib-tools"><form class="search" method="get" action="/app/library"><label class="search-field">${icon('search')}<span class="sr-only">Search titles, fields and the words inside documents and scans</span><input name="q" type="search" value="${esc(q)}" placeholder="Search titles, fields, text"></label><button class="btn">Search</button></form><p class="lib-links"><a class="link" href="/app/library?trash=true">Open reversible trash</a> <span aria-hidden="true">·</span> <a class="link" href="/app/library">Active records</a></p><div class="lib-upload">${upload}</div></div>
 <div class="with-side"><section class="records" aria-label="${trash?'Trash':'Records'}">${data.documents.map((r:any)=>row(r,q)).join('')||empty(data,trash)}</section>${work(data)}</div>`
}
