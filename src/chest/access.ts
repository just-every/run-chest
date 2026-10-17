import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { get,list } from './store'
import { insist, type Collection, type Document, type Group, type Row } from './model'
export const isOwner=(s:Session)=>s.operator.role==='owner'
export function owner(s:Session){insist(isOwner(s),'owner_required',403)}
export async function roles(env:Bindings,s:Session,doc:Document):Promise<{roles:string[]; fences:Row[]}> {
 if(doc.trash&&!isOwner(s))return {roles:[],fences:[]}
 if(isOwner(s))return {roles:['reader','editor','reviewer'],fences:[]}
 const collection=await get<Collection>(env,'collection',doc.collection),groups=await list<Group>(env,'group')
 const principals=[s.operator.email,...groups.filter(g=>g.payload.members.includes(s.operator.email)).map(g=>g.id)]
 const grants=[...doc.grants,...(doc.private?[]:collection.payload.grants)]
 return {roles:grants.filter(g=>principals.includes(g.principal)).map(g=>g.role),fences:[collection,...groups]}
}
export async function access(env:Bindings,s:Session,doc:Document,role='reader') {
 const r=await roles(env,s,doc); insist(r.roles.includes(role)||(role==='reader'&&r.roles.length>0),'not_found',404);return r.fences
}
// A person's trash holds the records they trashed while they still hold editor access; the owner's holds every one.
export async function documents(env:Bindings,s:Session,trash=false) { const rows=await list<Document>(env,'document');const result:Row<Document>[]=[];for(const row of rows){if(row.payload.trash!==trash)continue;if(trash&&!isOwner(s)){if(row.payload.trashedBy===s.operator.email&&(await roles(env,s,{...row.payload,trash:false})).roles.includes('editor'))result.push(row)}else if((await roles(env,s,row.payload)).roles.length)result.push(row)}return result }
export async function validPerson(env:Bindings,email:unknown) { insist(typeof email==='string','invalid_person');const p=await get(env,'person',email.toLowerCase());insist(p.payload.status!=='inactive','inactive_person');return p.id }
