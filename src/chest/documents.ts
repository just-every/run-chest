import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { access,isOwner } from './access'
import { get,write,changed } from './store'
import { filing } from './metadata'
import { validateFields } from './fields'
import { fromBase64,inspect,retain } from './blobs'
import { insist,id,now,text,type Collection,type Document,type Schema,type Row } from './model'
export async function upload(env:Bindings,s:Session,input:any,existing?:Row<Document>){
 let fences:Row[]=[];let doc:Document
 if(existing){insist(!existing.payload.trash,'document_trashed',409);fences=await access(env,s,existing.payload,'editor');doc=structuredClone(existing.payload);const schema=await get<Schema>(env,'schema',doc.schema);validateFields(schema.payload,doc.fields);fences.push(schema)}
 else {const collection=await get<Collection>(env,'collection',input.collection);const values=await filing(env,input,fences);doc={...values,collection:collection.id,approved:null,versions:[],private:false,grants:[],trash:false,completions:[]};fences.push(collection,...await access(env,s,doc,'editor'))}
 const bytes=fromBase64(input.base64),v=await inspect(bytes,text(input.filename,'filename',240),s.operator.email,doc.reviewer)
 insist(!input.checksum||input.checksum===v.checksum,'checksum_mismatch');insist(input.size===undefined||input.size===v.size,'size_mismatch')
 // All metadata/authority/bytes are validated before custody; D1 publication is last.
 await retain(env,bytes,v);doc.versions.push(v)
 const row={id:existing?.id||id(),kind:'document',payload:doc,revision:id()};return write(env,s,row,existing?'version.submit':'document.upload',existing,fences)
}
export async function lifecycle(env:Bindings,s:Session,row:Row<Document>,input:any){
 const fences=await access(env,s,row.payload,'editor');const doc=structuredClone(row.payload)
 if(input.action==='trash'||input.action==='restore'){insist(isOwner(s),'owner_required',403);doc.trash=input.action==='trash'}
 else if(input.action==='complete'){insist(['review','expiry'].includes(input.kind),'invalid_work_kind');const date=input.kind==='review'?doc.reviewDate:doc.expiryDate;insist(date,'no_scheduled_work');doc.completions.push({actor:s.operator.email,at:now(),evidence:text(input.evidence,'evidence',4000),kind:input.kind,date})}
 else insist(false,'invalid_action')
 return write(env,s,changed(row,doc),`document.${input.action}`,row,fences)
}
