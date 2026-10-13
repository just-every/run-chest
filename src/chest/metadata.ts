import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { owner,validPerson,access } from './access'
import { get,write,changed } from './store'
import { insist,id,text,date,type Document,type Schema,type Collection,type Row } from './model'
import { schemaDefinition,validateFields } from './fields'
export async function createMetadata(env:Bindings,s:Session,kind:string,input:any) {
 owner(s);let payload:any
 if(kind==='collection')payload={name:text(input.name,'name'),grants:[]}
 else if(kind==='schema') payload=schemaDefinition(input)
 else if(kind==='group'){insist(Array.isArray(input.members),'invalid_members');for(const p of input.members)await validPerson(env,p);payload={name:text(input.name,'name'),members:input.members}}
 else throw new Error('invalid_metadata_kind')
 return write(env,s,{id:id(),kind,payload,revision:id()},`${kind}.create`)
}
export async function updateSchema(env:Bindings,s:Session,key:string,input:any) {
 owner(s);const row=await get<Schema>(env,'schema',key)
 return write(env,s,changed(row,schemaDefinition(input)),'schema.update',row)
}
export async function filing(env:Bindings,input:any,fences:Row[]=[]):Promise<Pick<Document,'title'|'schema'|'fields'|'owner'|'reviewer'|'reference'|'reviewDate'|'expiryDate'>> {
 const schema=await get<Schema>(env,'schema',input.schema);const reference=input.reference||null
 fences.push(schema)
 if(reference)insist(['supplier','customer','project'].includes(reference.kind)&&text(reference.name,'reference'),'invalid_reference')
 return {title:text(input.title,'title'),schema:schema.id,fields:validateFields(schema.payload,input.fields??{}),owner:await validPerson(env,input.owner),reviewer:await validPerson(env,input.reviewer),reference,reviewDate:date(input.reviewDate),expiryDate:date(input.expiryDate)}
}
export async function updateFiling(env:Bindings,s:Session,row:Row<Document>,input:any) {
 const fences=await access(env,s,row.payload,'editor')
 const collection=await get<Collection>(env,'collection',input.collection)
 if(collection.id!==row.payload.collection){
  // Document grants cannot authorize filing into someone else's collection.
  fences.push(...await access(env,s,{...row.payload,collection:collection.id,private:false,grants:[]},'editor'))
 }
 fences.push(collection)
 const values=await filing(env,input,fences)
 return write(env,s,changed(row,{...row.payload,...values,collection:collection.id}),'document.file',row,fences)
}
export async function grants(env:Bindings,s:Session,kind:string,key:string,input:any){
 owner(s);insist(['collection','document'].includes(kind),'invalid_scope');const row=await get<Collection|Document>(env,kind,key)
 insist(Array.isArray(input.grants)&&input.grants.length<=100,'invalid_grants')
 for(const g of input.grants){insist(g&&typeof g==='object','invalid_grants');insist(['reader','editor','reviewer'].includes(g.role),'invalid_role');if(g.principal.includes('@'))await validPerson(env,g.principal);else await get(env,'group',g.principal)}
 insist(input.private===undefined||typeof input.private==='boolean','invalid_private')
 const payload={...row.payload,grants:input.grants,...(kind==='document'?{private:input.private===undefined?(row.payload as Document).private:input.private}:{})}
 return write(env,s,changed(row,payload),'access.change',row)
}

export async function updateGroup(env:Bindings,s:Session,key:string,input:any){owner(s);const row=await get(env,'group',key);insist(Array.isArray(input.members),'invalid_members');for(const p of input.members)await validPerson(env,p);return write(env,s,changed(row,{name:text(input.name,'name'),members:input.members}),'group.update',row)}
