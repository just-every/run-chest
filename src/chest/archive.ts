import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { planD1Import,createD1ImportJob,applyD1ImportBatches,resumeD1Import,undoD1Import,readD1ImportJob,readD1ImportOriginals,canonicalJson,sha256,type D1ImportContext,type SourceBundle,type Json } from '../modules/import-kit/src/d1/index'
import { chestTargets } from './archive-target'
import { owner } from './access'
import { get,ownerPredicate } from './store'
import { filing } from './metadata'
import { fromBase64,inspect,retain,digest } from './blobs'
import { insist,type Document,type Version } from './model'
const namespace='chest-archive-v1',mappingVersion='chest-archive-v1'
function context(env:Bindings,s:Session):D1ImportContext{return {destination:'library',namespace,mappingVersion,storage:{database:env.DB,targets:chestTargets},authorization:{principalId:s.operator.email,predicate:()=>ownerPredicate(s)},batchSize:10,maxBatches:1}}
export async function previewArchive(env:Bindings,s:Session,input:any){
 owner(s);insist(typeof input.archive==='string'&&input.archive.length<16_000_000,'invalid_archive');let archive:any;try{archive=JSON.parse(input.archive)}catch{insist(false,'archive_json')}
 insist(archive.format==='chest-archive-1'&&typeof archive.source==='string'&&Array.isArray(archive.items)&&archive.items.length<=100,'archive_shape')
 await get(env,'collection',input.collection);const artifactBytes=new TextEncoder().encode(input.archive),artifactHash=await digest(artifactBytes)
 const source:SourceBundle={artifacts:[{name:'archive.json',sha256:artifactHash,size:artifactBytes.length,original:{status:'available',base64:Buffer.from(artifactBytes).toString('base64')}}],records:[],diagnostics:[]}
 const prepared=new Map<string,{doc:Document,bytes:Uint8Array,v:Version}>(),results:any[]=[];const seen=new Set<string>();const hashes=new Set<string>()
 for(let i=0;i<archive.items.length;i++){
  const item=archive.items[i];insist(item&&typeof item.path==='string'&&!item.path.startsWith('/')&&!/^[A-Za-z]:/.test(item.path)&&!item.path.includes('\\')&&!item.path.split('/').some((x:string)=>!x||x==='.'||x==='..')&&!/[\x00-\x1f]/.test(item.path),'unsafe_archive_path')
  const sourceId=`${archive.source}:${item.path}:${i}`,payloadHash=sha256(canonicalJson(item));let rejection='',gaps:string[]=[]
  // Invalid byte custody rejects the complete archive before domain writes.
  const bytes=fromBase64(item.base64),v=await inspect(bytes,item.path.split('/').at(-1),s.operator.email,input.reviewer)
  insist(item.sha256===v.checksum&&item.size===v.size,'archive_byte_mismatch')
  let doc:Document|undefined
  if(seen.has(item.path))rejection='duplicate source path';seen.add(item.path)
  if(item.skip===true)rejection='owner marked skip'
  if(!rejection){try{
    const values=await filing(env,{title:item.title||v.filename,schema:input.schema,fields:item.fields||{},owner:input.owner,reviewer:input.reviewer,reference:item.reference||null,reviewDate:item.reviewDate,expiryDate:item.expiryDate})
    v.id=sha256(`${artifactHash}:${i}:version`);v.at='';v.events=[];v.arrival='migration';v.migration={archive:archive.source,path:item.path,sourceId:typeof item.sourceId==='string'?item.sourceId:null,timestamp:typeof item.timestamp==='string'?item.timestamp:null}
    if(item.principals?.length)gaps.push('Source people and permissions are retained as unresolved history; no access granted.')
    if(item.decisions?.length)gaps.push('Source decisions are retained history; no Chest approval granted.')
    doc={...values,collection:input.collection,approved:null,versions:[v],private:true,grants:[],trash:false,completions:[],source:{archive:archive.source,path:item.path,sourceId:item.sourceId||null,format:item.format||null,timestamp:item.timestamp||null,principals:item.principals||[],decisions:item.decisions||[],gaps}}
    prepared.set(sourceId,{doc,bytes,v})
   }catch(e){rejection=e instanceof Error?e.message:'invalid_metadata'} }
  results.push({path:item.path,size:v.size,checksum:v.checksum,duplicateBytes:hashes.has(v.checksum),preview:v.preview,status:rejection?(item.skip?'skipped':'rejected'):'admitted',reason:rejection,gaps});hashes.add(v.checksum)
  source.records.push({namespace,kind:'document',sourceId,payload:item,payloadHash,artifactHash,location:{artifact:'archive.json',pointer:`/items/${i}`}})
 }
 const plan=await planD1Import(source,{version:mappingVersion,map(record){const p=prepared.get(record.sourceId),r=results[Number(record.location.pointer!.split('/').at(-1))];return p?{effects:[{targetKind:'document',targetId:sha256(`${artifactHash}:${record.sourceId}:${input.collection}`),value:p.doc as unknown as Json}],unmapped:r.gaps.map((reason:string)=>({reason}))}:{effects:[],rejection:r.reason}}},context(env,s))
 return {plan,results,prepared,summary:{fingerprint:plan.fingerprint,counts:plan.counts,bytes:results.reduce((n,r)=>n+r.size,0),items:results}}
}
export async function applyArchive(env:Bindings,s:Session,input:any){const p=await previewArchive(env,s,input);insist(input.fingerprint===p.plan.fingerprint,'reviewed_fingerprint_changed',409)
 for(const item of p.prepared.values())await retain(env,item.bytes,item.v)
 const ctx={...context(env,s),reviewedFingerprint:input.fingerprint};const job=await createD1ImportJob(p.plan,ctx);return applyD1ImportBatches(job.id,ctx)
}
export async function archiveAction(env:Bindings,s:Session,job:string,action:string){owner(s);const ctx=context(env,s);if(action==='undo')return undoD1Import(job,ctx);if(action==='resume')return resumeD1Import(job,ctx);if(action==='originals')return readD1ImportOriginals(job,ctx);return readD1ImportJob(job,ctx)}
