import { fileGlyphs, lineSvg, type FileKind, type LineName } from '../ui/icons'
import { typedFields } from './ui-fields'
export const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const json=(v:unknown)=>esc(JSON.stringify(v,null,2))
export const icon=(name:LineName)=>`<span class="icon" aria-hidden="true">${lineSvg(name)}</span>`
// A file-type tile; the kind comes from the item's type, media type and name.
export const tile=(kind:FileKind,extra='')=>`<span class="tile tile-${kind}${extra?' '+extra:''}" aria-hidden="true">${fileGlyphs[kind]}</span>`
export function kindOf(e:{type?:string,name?:string,mediaType?:string|null}):FileKind{
 if(e.type==='folder')return 'folder'
 const ext=(e.name??'').toLowerCase().split('.').pop()??'',media=e.mediaType??''
 if(media==='application/pdf'||ext==='pdf')return 'pdf'
 if(media.startsWith('image/')||['jpg','jpeg','png','gif','webp','heic','heif','tif','tiff'].includes(ext))return 'image'
 if(['xlsx','xls','csv','ods','numbers','tsv'].includes(ext))return 'sheet'
 if(['pptx','ppt','key','odp'].includes(ext))return 'slides'
 if(['docx','doc','odt','rtf','pages'].includes(ext))return 'word'
 return 'doc'
}
// Times are stored in UTC; pages show them the US way, saying so: "Oct 14, 2026" and "Oct 14, 2026, 09:24 UTC".
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const day=(at:unknown)=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(at??''));return m?`${months[+m[2]-1]} ${+m[3]}, ${m[1]}`:esc(at)}
// In tables: the day, with the full UTC time on hover.
export const onDay=(at:unknown)=>{const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(at??''));return m?`<time datetime="${esc(at)}" title="${day(m[1])}, ${m[2]} UTC">${day(m[1])}</time>`:esc(at)}
export const when=(at:unknown)=>{const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(at??''));return m?`<time class="nowrap" datetime="${esc(at)}" title="${esc(at)}">${day(m[1])}, ${m[2]} UTC</time>`:esc(at)}
// Initials on a tint chosen from the name, so each person keeps one colour.
export const avatar=(name:string)=>{const words=String(name||'?').replace(/@.*/,'').split(/[\s._-]+/).filter(Boolean),letters=(words.length>1?words[0][0]+words[1][0]:words[0]?.slice(0,2)??'?').toUpperCase(),tone=[...String(name)].reduce((n,c)=>n+c.charCodeAt(0),0)%5;return `<span class="avatar" data-tone="${tone}" aria-hidden="true">${esc(letters)}</span>`}
// Form controls: the label text sits above its control, both inside the label so it names the control.
export const field=(label:string,name:string,value='',type='text',required=true)=>`<label class="field"><span class="field-label">${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required?'required':''}></label>`
export const area=(label:string,name:string,value:unknown,required=true)=>`<label class="field"><span class="field-label">${esc(label)}</span><textarea name="${esc(name)}"${typeof value==='string'?'':' class="json"'} ${required?'required':''}>${typeof value==='string'?esc(value):json(value)}</textarea></label>`
export const select=(label:string,name:string,rows:{id:string,label:string}[],selected='',required=true)=>`<label class="field"><span class="field-label">${esc(label)}</span><select name="${name}" ${required?'required':''}>${rows.map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label>`
export const form=(path:string,body:string,button:string,returnTo='/app',{className='form',buttonClass='btn'}:{className?:string,buttonClass?:string}={})=>`<form class="${className}" method="post" action="/app/action" enctype="multipart/form-data"><input type="hidden" name="path" value="${esc(path)}"><input type="hidden" name="returnTo" value="${esc(returnTo)}">${body}<button class="${buttonClass}">${esc(button)}</button></form>`
export const hidden=(name:string,value:string)=>`<input type="hidden" name="${name}" value="${esc(value)}">`
// A disclosure: the summary looks like a button (ink by default) and opens its form in a card below it.
export const details=(title:string,body:string,summaryClass='btn')=>`<details class="disclosure"><summary class="${summaryClass}">${esc(title)}</summary><div class="disclosure-panel">${body}</div></details>`
export const card=(title:string,body:string,className='',lead:LineName|''='')=>`<section class="card ${className}"><h2>${lead?`<span class="icon-chip">${icon(lead)}</span>`:''}${esc(title)}</h2>${body}</section>`
export const kindLabel=(kind?:string)=>kind?kind[0].toUpperCase()+kind.slice(1):''
export function fieldWarnings(issues:{field:string;message:string}[]=[]){return issues.length?`<section class="card card-issue" aria-label="Current document type issues"><h2>Fields need attention</h2><p>Saved values are retained. Edit filing to meet the current document type before submitting a replacement.</p><ul>${issues.map(issue=>`<li><strong>${esc(issue.field)}</strong>: ${esc(issue.message)}</li>`).join('')}</ul></section>`:''}
export function filingFields(data:any,doc:any={}){const people=data.people.filter((p:any)=>p.payload.status!=='inactive').map((p:any)=>({id:p.id,label:p.payload.name+' · '+p.id}));return `<div class="form-grid">${field('Title','title',doc.title||'')+select('Collection','collection',data.collections.map((r:any)=>({id:r.id,label:r.payload.name})),doc.collection)+select('Responsible owner','owner',people,doc.owner||data.me.email)+select('Reviewer','reviewer',people,doc.reviewer||data.me.email)+select('Business relationship','referenceKind',[{id:'',label:'None'},{id:'supplier',label:'Supplier'},{id:'customer',label:'Customer'},{id:'project',label:'Project'}],doc.reference?.kind,false)+field('Relationship name','referenceName',doc.reference?.name||'','text',false)+field('Next review','reviewDate',doc.reviewDate||'','date',false)+field('Expiry','expiryDate',doc.expiryDate||'','date',false)}</div>${typedFields(data.schemas,doc)}`}
