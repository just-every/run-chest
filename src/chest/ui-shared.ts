import { icons, type IconName } from '../ui/icons'
import { typedFields } from './ui-fields'
export const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const json=(v:unknown)=>esc(JSON.stringify(v,null,2))
export const icon=(name:IconName)=>`<span class="icon" aria-hidden="true">${icons[name]}</span>`
// Form controls: the label text sits above its control, both inside the label so it names the control.
export const field=(label:string,name:string,value='',type='text',required=true)=>`<label class="field"><span class="field-label">${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required?'required':''}${type==='date'||type==='email'?' class="mono"':''}></label>`
export const area=(label:string,name:string,value:unknown,required=true)=>`<label class="field"><span class="field-label">${esc(label)}</span><textarea name="${esc(name)}" ${required?'required':''}>${typeof value==='string'?esc(value):json(value)}</textarea></label>`
// A row may carry `at`: its label then ends in that moment, which the browser rewrites on its own clock (/chest-time.js).
export const select=(label:string,name:string,rows:{id:string,label:string,at?:string}[],selected='',required=true)=>`<label class="field"><span class="field-label">${esc(label)}</span><select name="${name}" ${required?'required':''}>${rows.map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}${r.at?` data-at="${esc(r.at)}" data-prefix="${esc(r.label.slice(0,r.label.length-utcText(r.at).length))}"`:''}>${esc(r.label)}</option>`).join('')}</select></label>`
export const form=(path:string,body:string,button:string,returnTo='/app/library',{className='form',buttonClass='btn'}:{className?:string,buttonClass?:string}={})=>`<form class="${className}" method="post" action="/app/action" enctype="multipart/form-data"><input type="hidden" name="path" value="${esc(path)}"><input type="hidden" name="returnTo" value="${esc(returnTo)}">${body}<button class="${buttonClass}">${esc(button)}</button></form>`
// An email box that suggests the people already in this Chest; any other address can be typed.
export const personPicker=(label:string,name:string,people:{id:string,payload:{name:string}}[],list:string)=>`<label class="field"><span class="field-label">${esc(label)}</span><input name="${esc(name)}" type="email" required class="mono" list="${esc(list)}" autocomplete="off"><datalist id="${esc(list)}">${people.map(p=>`<option value="${esc(p.id)}">${esc(p.payload.name)}</option>`).join('')}</datalist></label>`
// A moment: UTC on the server, the person's own clock in the browser (/chest-time.js). `when` is the compact US form
// the file table and details panel use ("Oct 14, 2026, 9:24 AM"); `day` is a date alone ("Nov 30").
export const stamp=(at:string)=>at?`<time datetime="${esc(at)}" data-local>${esc(at.slice(0,16).replace('T',' '))} UTC</time>`:''
const us=(at:string,o:Intl.DateTimeFormatOptions)=>new Date(at).toLocaleString('en-US',{timeZone:'UTC',...o})
export const when=(at:string)=>{if(!at||isNaN(Date.parse(at)))return '';const text=us(at,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});return `<time datetime="${esc(at)}" data-local="short" title="${esc(text)} UTC">${esc(text)}</time>`}
// A moment in text that cannot be localized in the browser (an option label, a notice): the same US form, in UTC, named.
export const utcText=(at:string)=>`${us(at,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})} UTC`
export const day=(at:string)=>at&&!isNaN(Date.parse(at))?esc(us(at,{month:'short',day:'numeric'})):''
// A calendar date kept as YYYY-MM-DD, read the US way ("Oct 24, 2026"); anything else prints as it is.
export const isoDay=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)?esc(us(date+'T12:00:00Z',{month:'short',day:'numeric',year:'numeric'})):esc(date)
// A person as a round initial in one of five soft tones, picked from their email so it stays the same everywhere.
export const tone=(email:string)=>1+[...email].reduce((n,c)=>n+c.charCodeAt(0),0)%5
export const avatar=(p:{email:string,name:string},label=false)=>`<span class="avatar tone-${tone(p.email)}"${label?` title="${esc(p.name)}"`:' aria-hidden="true"'}>${esc((p.name||p.email).trim()[0]?.toUpperCase()??'?')}</span>`
// A person by name, from the people the page already has; an address nobody has a name for shows as it is.
export const nameOf=(people:{id:string,payload:{name:string}}[])=>{const names=new Map(people.map(p=>[p.id,p.payload.name]));return (email:string)=>names.get(email)||email}
export const hidden=(name:string,value:string)=>`<input type="hidden" name="${name}" value="${esc(value)}">`
// A disclosure: the summary looks like a button (ink by default) and opens its form in a card below it.
export const details=(title:string,body:string,summaryClass='btn')=>`<details class="disclosure"><summary class="${summaryClass}">${esc(title)}</summary><div class="disclosure-panel">${body}</div></details>`
export const card=(title:string,body:string,className='')=>`<section class="card ${className}"><h2>${esc(title)}</h2>${body}</section>`
export const kindLabel=(kind?:string)=>kind?kind[0].toUpperCase()+kind.slice(1):''
export function fieldWarnings(issues:{field:string;message:string}[]=[]){return issues.length?`<section class="card card-issue" aria-label="Current document type issues"><h2>Fields need attention</h2><p>Saved values are retained. Edit filing to meet the current document type before submitting a replacement.</p><ul>${issues.map(issue=>`<li><strong>${esc(issue.field)}</strong>: ${esc(issue.message)}</li>`).join('')}</ul></section>`:''}
export function filingFields(data:any,doc:any={}){const people=data.people.filter((p:any)=>p.payload.status!=='inactive').map((p:any)=>({id:p.id,label:p.payload.name+' · '+p.id}));return `<div class="form-grid">${field('Title','title',doc.title||'')+select('Collection','collection',data.collections.map((r:any)=>({id:r.id,label:r.payload.name})),doc.collection)+select('Responsible owner','owner',people,doc.owner||data.me.email)+select('Reviewer','reviewer',people,doc.reviewer||data.me.email)+select('Business relationship','referenceKind',[{id:'',label:'None'},{id:'supplier',label:'Supplier'},{id:'customer',label:'Customer'},{id:'project',label:'Project'}],doc.reference?.kind,false)+field('Relationship name','referenceName',doc.reference?.name||'','text',false)+field('Next review','reviewDate',doc.reviewDate||'','date',false)+field('Expiry','expiryDate',doc.expiryDate||'','date',false)}</div>${typedFields(data.schemas,doc)}`}
export const bytes=(n:number)=>n<1024?`${n} bytes`:n<1048576?`${(n/1024).toFixed(1)} KB`:n<1073741824?`${(n/1048576).toFixed(1)} MB`:`${(n/1073741824).toFixed(1).replace(/\.0$/,'')} GB`
