import type { Bindings } from '../../auth.server'
import type { FileVersion } from '../files/model'
import { insist, now } from '../model'
import { SMALL } from '../blobs'
import { packageSignature, projectReview, protectedPartsEqual, reviewRecords } from './review-package'

async function normalized(env:Bindings,bytes:Uint8Array,extension:string){
 const form=new FormData();form.set('data',new Blob([bytes as BlobPart]),`review.${extension}`)
 const response=await fetch(new URL(`/cool/convert-to/${extension}`,env.COLLABORA_URL!),{method:'POST',body:form,redirect:'manual',signal:AbortSignal.timeout(30000)})
 insist(response.ok,'collabora_review_validation_unavailable',503)
 const result=new Uint8Array(await response.arrayBuffer());insist(result.length>0&&result.length<=SMALL,'collabora_review_validation_invalid',503)
 return packageSignature(projectReview(result))
}
async function same(env:Bindings,a:Uint8Array,b:Uint8Array,extension:string){
 const signatures=await Promise.all([normalized(env,a,extension),normalized(env,b,extension)])
 return signatures[0]===signatures[1]
}
export async function validateWopiReview(env:Bindings,source:Uint8Array,content:Uint8Array,current:FileVersion,actor:{email:string;name:string},commenter:boolean):Promise<FileVersion['suggestion']>{
 const extension=current.filename.split('.').at(-1)!.toLowerCase(),before=reviewRecords(source),after=reviewRecords(content),previous=new Map(before.map(r=>[r.key,r])),allowedAuthors=new Set([actor.email,actor.name])
 for(const record of after){const prior=previous.get(record.key);if(!prior||prior.value!==record.value)insist(allowedAuthors.has(record.author),'author_mismatch',403)}
 if(commenter){
  insist(protectedPartsEqual(source,content),'suggest_only',403)
  for(const record of before)if(!allowedAuthors.has(record.author))insist(after.some(r=>r.key===record.key&&r.value===record.value),'suggest_only',403)
  const removed=before.filter(r=>r.kind!=='comment'&&!after.some(next=>next.key===r.key));insist(!removed.length,'suggest_only',403)
  insist(await same(env,projectReview(source,new Map(),true),projectReview(content,new Map(),true),extension),'suggest_only',403)
  const added=after.find(r=>r.kind!=='comment'&&(!previous.has(r.key)||previous.get(r.key)!.value!==r.value))
  return added?{author:actor.email,at:now(),sourceVersion:current.id}:current.suggestion&&!current.suggestion.decision?current.suggestion:undefined
 }
 const removed=before.filter(r=>r.kind!=='comment'&&!after.some(next=>next.key===r.key))
 if(removed.length){
  insist(removed.length===1,'save_each_suggestion_decision',409)
  const record=removed[0]
  for(const decision of ['accept','reject'] as const)if(await same(env,projectReview(source,new Map([[record.key,decision]])),projectReview(content),extension))return {author:record.author,at:current.suggestion?.at??current.at,sourceVersion:current.id,decision,decidedBy:actor.email,decidedAt:now()}
  insist(false,'suggestion_decision_conflict',409)
 }
 const added=after.find(r=>r.kind!=='comment'&&!previous.has(r.key))
 return added?{author:actor.email,at:now(),sourceVersion:current.id}:current.suggestion&&!current.suggestion.decision?current.suggestion:undefined
}
