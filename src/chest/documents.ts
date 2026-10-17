import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { access,isOwner,roles } from './access'
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
 const doc=structuredClone(row.payload)
 // Editors trash records and restore what they trashed while they still hold editor access; the owner restores any.
 if(input.action==='trash'||input.action==='restore'){const r=await roles(env,s,{...doc,trash:false});insist(r.roles.length,'not_found',404);insist(doc.trash===(input.action==='restore'),input.action==='trash'?'document_trashed':'not_in_trash',409);insist(isOwner(s)||(r.roles.includes('editor')&&(input.action==='trash'||doc.trashedBy===s.operator.email)),'trash_refused',403);doc.trash=input.action==='trash';if(doc.trash)doc.trashedBy=s.operator.email;return write(env,s,changed(row,doc),`document.${input.action}`,row,r.fences)}
 const fences=await access(env,s,row.payload,'editor')
 if(input.action==='complete'){insist(['review','expiry'].includes(input.kind),'invalid_work_kind');const date=input.kind==='review'?doc.reviewDate:doc.expiryDate;insist(date,'no_scheduled_work');doc.completions.push({actor:s.operator.email,at:now(),evidence:text(input.evidence,'evidence',4000),kind:input.kind,date})}
 else insist(false,'invalid_action')
 return write(env,s,changed(row,doc),`document.${input.action}`,row,fences)
}
// Restoring an earlier version of a governed record submits its bytes as a new version for review; the approved
// pointer moves only by approval (VERSION-001, CHEST-07).
export async function restoreVersion(env:Bindings,s:Session,row:Row<Document>,versionId:string){
 insist(!row.payload.trash,'document_trashed',409);const fences=await access(env,s,row.payload,'editor');const doc=structuredClone(row.payload),source=doc.versions.find(v=>v.id===versionId);insist(source,'version_not_found',404)
 insist(await env.BLOBS.head(`sha256/${source.checksum}`),'blob_missing',503)
 doc.versions.push({...source,id:id(),at:now(),actor:s.operator.email,reviewer:doc.reviewer,state:'submitted',events:[],name:'',restoredFrom:source.id})
 return write(env,s,changed(row,doc),'version.restore',row,fences)
}
export async function nameVersion(env:Bindings,s:Session,row:Row<Document>,versionId:string,input:any){
 const fences=await access(env,s,row.payload,'editor');const doc=structuredClone(row.payload),v=doc.versions.find(v=>v.id===versionId);insist(v,'version_not_found',404)
 insist(typeof input.name==='string'&&input.name.length<=120&&!/[\x00-\x1f]/.test(input.name),'invalid_version_name');v.name=input.name.trim()
 return write(env,s,changed(row,doc),'version.name',row,fences)
}
