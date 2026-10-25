import type { Bindings } from '../../auth.server'
import type { FileVersion } from '../files/model'
import { ChestError, insist, now } from '../model'
import { SMALL } from '../blobs'
import { packageSignature, projectReview, protectedPartsEqual, reviewRecords, retainOmittedParts, trackingEnabled } from './review-package'

async function exported(env:Bindings,bytes:Uint8Array,extension:string){
 const form=new FormData();form.set('data',new Blob([bytes as BlobPart]),`review.${extension}`)
 const response=await fetch(new URL(`/cool/convert-to/${extension}`,env.COLLABORA_URL!),{method:'POST',body:form,redirect:'manual',signal:AbortSignal.timeout(30000)})
 insist(response.ok,'collabora_review_validation_unavailable',503)
 const result=new Uint8Array(await response.arrayBuffer());insist(result.length>0&&result.length<=SMALL,'collabora_review_validation_invalid',503)
 return result
}
async function normalized(env:Bindings,bytes:Uint8Array,extension:string){return packageSignature(projectReview(await exported(env,bytes,extension)))}
export async function preserveWopiParts(env:Bindings,source:Uint8Array,content:Uint8Array,current:FileVersion){
 if(protectedPartsEqual(source,content))return content
 return retainOmittedParts(source,content,await exported(env,source,current.filename.split('.').at(-1)!.toLowerCase()))
}
function suggestOnly(ok:boolean,reason:string){if(!ok)throw Object.assign(new ChestError('suggest_only',403),{reviewReason:reason})}
async function same(env:Bindings,a:Uint8Array,b:Uint8Array,extension:string,report=false){
 const signatures=await Promise.all([normalized(env,a,extension),normalized(env,b,extension)])
 if(report&&signatures[0]!==signatures[1]){const left=new Map(JSON.parse(signatures[0]) as [string,unknown][]),right=new Map(JSON.parse(signatures[1]) as [string,unknown][]);const reviewParts=[...new Set([...left.keys(),...right.keys()])].filter(path=>JSON.stringify(left.get(path))!==JSON.stringify(right.get(path)));throw Object.assign(new ChestError('suggest_only',403),{reviewReason:'base_content_changed',reviewParts})}
 return signatures[0]===signatures[1]
}
export async function validateWopiReview(env:Bindings,source:Uint8Array,content:Uint8Array,current:FileVersion,actor:{email:string;name:string},commenter:boolean):Promise<FileVersion['suggestion']>{
 const extension=current.filename.split('.').at(-1)!.toLowerCase(),before=reviewRecords(source),after=reviewRecords(content),previous=new Map(before.map(r=>[r.key,r])),allowedAuthors=new Set([actor.email,actor.name])
 for(const record of after){const prior=previous.get(record.key);if(!prior||prior.value!==record.value)insist(allowedAuthors.has(record.author),'author_mismatch',403)}
 if(commenter){
  if(extension==='docx')suggestOnly(trackingEnabled(content)!==false,'tracking_disabled')
  else suggestOnly(after.every(record=>record.kind==='comment'),'comment_only')
  suggestOnly(protectedPartsEqual(source,content),'protected_parts_changed')
  for(const record of before)if(!allowedAuthors.has(record.author))suggestOnly(after.some(r=>r.key===record.key&&r.value===record.value),'foreign_review_changed')
  const removed=before.filter(r=>r.kind!=='comment'&&!after.some(next=>next.key===r.key));suggestOnly(!removed.length,'tracked_change_removed')
  suggestOnly(await same(env,projectReview(source,new Map(),true),projectReview(content,new Map(),true),extension,true),'base_content_changed')
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
