import type { Bindings } from '../../auth.server'
import { custody, signature, streamDigest } from '../blobs'
import { id, insist, now, type Row } from '../model'
import { commit, fresh, maybe, next, where } from './repo'
import { PART } from './uploads'
import { name, type FileVersion } from './model'
import type { Ctx } from './access'
import { inspectRequestContent, validateFile, type RequestPolicy, type RequestSubmission, type Visitor } from './request-model'
import { ownReceipt, publishSubmission } from './request-submissions'
import { requireVerification } from './request-identity'
type Upload = { request:string;visitor:string;name:string;size:number;lastModified:number;checksum:string|null;key:string;multipart:string;partSize:number;expires:string;state:'open'|'complete';receipt?:string;nameOfSubmitter:string;email:string;checklist:string;replace:string;filing:Record<string,unknown> }
type Part = {upload:string;n:number;etag:string;size:number}
const parts=(env:Bindings,key:string)=>where<Part>(env,'request-upload-part','$.upload',key)
const count=(u:Upload)=>Math.ceil(u.size/u.partSize)
const expected=(u:Upload,n:number)=>n<count(u)?u.partSize:u.size-(count(u)-1)*u.partSize
async function mine(env:Bindings,r:Row<RequestPolicy>,v:Row<Visitor>,key:string) {requireVerification(r.payload,v);const row=await maybe<Upload>(env,'request-upload',key);insist(row&&row.payload.request===r.id&&row.payload.visitor===v.id,'not_found',404);insist(Date.parse(row.payload.expires)>Date.now(),'upload_expired',410);return row}
async function view(env:Bindings,row:Row<Upload>) {const u=row.payload,done=(await parts(env,row.id)).map(p=>p.payload);return {id:row.id,name:u.name,size:u.size,partSize:u.partSize,parts:done.map(p=>p.n).sort((a,b)=>a-b),received:done.reduce((n,p)=>n+p.size,0),state:u.state,receipt:u.receipt??null,expires:u.expires}}
export async function unfinishedRequests(env:Bindings,r:Row<RequestPolicy>,v:Row<Visitor>) { return Promise.all((await where<Upload>(env,'request-upload','$.visitor',v.id)).filter(u=>u.payload.request===r.id&&u.payload.state==='open'&&Date.parse(u.payload.expires)>Date.now()).map(u=>view(env,u))) }
export async function beginRequestUpload(env:Bindings,r:Row<RequestPolicy>,ctx:Ctx,v:Row<Visitor>,input:any) {
 requireVerification(r.payload,v);const filename=name(input.name,'filename'),size=input.size;validateFile(r.payload,filename,size)
 insist(input.checksum===undefined || typeof input.checksum==='string'&&/^[0-9a-f]{64}$/.test(input.checksum),'invalid_checksum')
 const lastModified=Number.isSafeInteger(input.lastModified)?input.lastModified:0,checklist=String(input.checklist??''),replace=String(input.replace??'')
 insist(!r.payload.checklist?.length||r.payload.checklist.includes(checklist),'checklist_required')
 // Destination and item identifiers are never accepted from a visitor; only a receipt they own may be replaced.
 insist(!input.parent&&!input.space&&!input.item,'request_destination_fixed',403)
 const open=(await where<Upload>(env,'request-upload','$.visitor',v.id)).find(row=>{const u=row.payload;return u.request===r.id&&u.state==='open'&&Date.parse(u.expires)>Date.now()&&u.name===filename&&u.size===size&&u.lastModified===lastModified&&u.checklist===checklist&&u.replace===replace&&u.checksum===(input.checksum??null)})
 if(open)return view(env,open)
 if(replace){const receipt=await ownReceipt(env,r,v,replace);insist(receipt.canReplace,'replacement_not_allowed',403)}
 const key=id(),staging=`request-uploads/${key}`,multipart=await env.BLOBS.createMultipartUpload(staging),row=fresh<Upload>('request-upload',{request:r.id,visitor:v.id,name:filename,size,lastModified,checksum:input.checksum??null,key:staging,multipart:multipart.uploadId,partSize:PART,expires:new Date(Date.now()+6*86400000).toISOString(),state:'open',nameOfSubmitter:String(input.submitterName??''),email:String(input.email??''),checklist,replace,filing:input.filing??{}},key)
 await commit(env,null,[{row}],{fences:[r,v,...ctx.fences],by:v.payload.email??'request visitor',audits:[{action:'file-request.upload.begin',object:r.payload.folder,detail:{request:r.id,upload:key,size}}]});return view(env,row)
}
export async function statusRequestUpload(env:Bindings,r:Row<RequestPolicy>,v:Row<Visitor>,key:string) {return view(env,await mine(env,r,v,key))}
export async function receiveRequestPart(env:Bindings,r:Row<RequestPolicy>,ctx:Ctx,v:Row<Visitor>,key:string,n:number,request:Request) {
 const row=await mine(env,r,v,key),u=row.payload;insist(u.state==='open','upload_complete',409);insist(Number.isSafeInteger(n)&&n>=1&&n<=count(u),'invalid_part')
 const length=Number(request.headers.get('content-length')??-1);insist(length===-1||length===expected(u,n),'part_size')
 // Bound reads even for chunked requests, rather than buffering an untrusted unbounded body.
 insist(request.body,'part_size');const reader=request.body.getReader(),chunks:Uint8Array[]= [];let size=0
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>expected(u,n)){await reader.cancel();insist(false,'part_size')}chunks.push(value)}
 insist(size===expected(u,n),'part_size');const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 const sent=await env.BLOBS.resumeMultipartUpload(u.key,u.multipart).uploadPart(n,bytes),previous=await maybe<Part>(env,'request-upload-part',`${key}:${n}`),payload={upload:key,n,etag:sent.etag,size}
 await commit(env,null,[previous?{row:next(previous,payload),previous}:{row:fresh('request-upload-part',payload,`${key}:${n}`)}],{fences:[row,r,v,...ctx.fences]});return view(env,row)
}
export async function completeRequestUpload(env:Bindings,r:Row<RequestPolicy>,ctx:Ctx,v:Row<Visitor>,key:string) {
 const row=await mine(env,r,v,key),u=row.payload;if(u.state==='complete')return ownReceipt(env,r,v,u.receipt!)
 const received=(await parts(env,key)).sort((a,b)=>a.payload.n-b.payload.n);insist(received.length===count(u)&&received.every((p,i)=>p.payload.n===i+1&&p.payload.size===expected(u,i+1)),'upload_incomplete',409)
 if(!await env.BLOBS.head(u.key))await env.BLOBS.resumeMultipartUpload(u.key,u.multipart).complete(received.map(p=>({partNumber:p.payload.n,etag:p.payload.etag})))
 const {checksum,size}=await streamDigest(env,u.key);insist(size===u.size,'size_mismatch');insist(!u.checksum||u.checksum===checksum,'checksum_mismatch')
 const head=await env.BLOBS.get(u.key,{range:{offset:0,length:1024}});insist(head,'blob_missing',503);const bytes=new Uint8Array(await head.arrayBuffer()),reasons=inspectRequestContent(u.name,bytes),kind=signature(bytes)??{mediaType:'application/octet-stream',preview:'unsupported'}
 validateFile(r.payload,u.name,size);await custody(env,u.key,checksum,size,kind.mediaType,`request:${r.id}`)
 const version:FileVersion={id:id(),filename:u.name,checksum,size,...kind,text:'',parser:'chest:signature-only:1',at:now(),actor:'request visitor',arrival:'upload',name:''}
 const result=await publishSubmission(env,r,ctx,v,{name:u.nameOfSubmitter,email:u.email,checklist:u.checklist,replace:u.replace,filing:u.filing},[{version,reasons}],(submission:Row<RequestSubmission>)=>[{row:next(row,{...u,state:'complete',receipt:submission.id}),previous:row},...received.map(p=>({row:p,previous:p,remove:true}))])
 await env.BLOBS.delete(u.key);return result
}
