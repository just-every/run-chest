import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { access,isOwner,validPerson } from './access'
import { write,changed } from './store'
import { insist,text,now,type Document,type Row } from './model'
export async function review(env:Bindings,s:Session,row:Row<Document>,versionId:string,input:any){
 insist(!row.payload.trash,'document_trashed',409);const doc=structuredClone(row.payload),v=doc.versions.find(v=>v.id===versionId);insist(v,'version_not_found',404)
 let fences=await access(env,s,doc)
 const action=input.action
 if(action==='assign'){fences=await access(env,s,doc,'editor');insist(v.state!=='approved','version_already_approved',409);v.reviewer=await validPerson(env,input.reviewer)}
 else if(action==='comment')text(input.message,'comment',4000)
 else {insist(action==='approve'||action==='changes','invalid_action');fences=await access(env,s,doc,'reviewer');insist(v.reviewer===s.operator.email,'assigned_reviewer_required',403);insist(v.state==='submitted','version_not_submitted',409)
  if(action==='approve'){v.state='approved';doc.approved=v.id}else {text(input.message,'reason',4000);v.state='changes'}
 }
 v.events.push({action,actor:s.operator.email,at:now(),message:typeof input.message==='string'?input.message.slice(0,4000):''})
 return write(env,s,changed(row,doc),`review.${action}`,row,fences)
}
