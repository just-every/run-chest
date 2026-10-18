import type { Bindings } from '../../auth.server'
import { ChestError, insist } from '../model'
import type { Person } from '../model'
import { personName } from '../names'
import { failure } from '../api'
import { fixedTypeFields } from '../ui-fields'
import { metadataView } from './folder-metadata'
import { maybe } from './repo'
import { resolveRequest, submit } from './file-requests'
import { confirmRequest, ensureVisitor, requestVerifyPage, requireVerification, verifyRequest } from './request-identity'
import { beginRequestUpload, completeRequestUpload, receiveRequestPart, statusRequestUpload, unfinishedRequests } from './request-uploads'
import { ownReceipt, ownSubmissions } from './request-submissions'
import { closedRequest, missingRequest, publicPage, receiptPage, requestPage } from './ui-public'
import { esc } from '../ui-shared'
const messages:Record<string,string>={storage_limit_exceeded:'This space has reached its storage limit. Ask the person who sent this request to contact the owner before uploading again.',files_required:'Choose between one and ten files.',type_not_allowed:'That type of file is not accepted here.',content_type_mismatch:'The file content does not match its extension. Send the original in an accepted format.',file_too_large:'A file exceeds the size this request accepts.',invalid_filename:'A file name is not accepted. Rename the file and try again.',checklist_required:'Choose which checklist item this file supplies.',duplicate_submission:'Duplicate content was refused by this request. Your earlier receipt is unchanged.',email_verification_required:'Verify your email before sending files.',replacement_not_available:'This submission has changed and can no longer be replaced through this receipt.',unsafe_content_cannot_release:'Executable or active content cannot be released into the library.'}
async function bounded(request:Request,max:number) { insist(Number(request.headers.get('content-length')||0)<=max,'file_too_large',413);insist(request.body,'files_required');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();insist(false,'file_too_large',413)}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return bytes }
export async function requestResponse(env:Bindings,request:Request,secret:string,sub?:string,key?:string) {
 let limits:{types:string[];maxBytes:number}|null=null
 const json=request.headers.get('accept')?.includes('application/json')||sub==='uploads',base=`/r/${secret}`
 try {
  const found=await resolveRequest(env,secret);if(!found)return missingRequest()
  limits=found.request.payload
  const r=found.request,{visitor,cookie}=await ensureVisitor(env,request,r,base)
  const withCookie=(response:Response)=>{if(cookie)response.headers.set('set-cookie',cookie);return response}
  const result=(value:unknown)=>withCookie(Response.json(value,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}}))
  if(sub==='receipt'&&key&&request.method==='GET')return withCookie(receiptPage(base,await ownReceipt(env,r,visitor,key)))
  if(!found.ctx)return json?Response.json({error:'request_closed',message:'This request is closed or past its deadline.'},{status:410}):closedRequest()
  if(sub==='verify'||sub==='confirm') {
   if(sub==='verify'&&request.method==='GET')return withCookie(confirmRequest(base,new URL(request.url).searchParams.get('token')??''))
   insist(request.method==='POST','method_not_allowed',405)
   return withCookie(await verifyRequest(env,request,r,base,visitor,sub==='confirm'))
  }
  if(r.payload.verification==='email'&&!visitor.payload.email)return withCookie(json?Response.json({error:'email_verification_required'},{status:403}):requestVerifyPage(base))
  if(sub==='uploads') {
   requireVerification(r.payload,visitor)
   if(!key){insist(request.method==='POST','method_not_allowed',405);const input=JSON.parse(new TextDecoder().decode(await bounded(request,64_000)));return result(await beginRequestUpload(env,r,found.ctx,visitor,input))}
   if(request.method==='GET')return result(await statusRequestUpload(env,r,visitor,key))
   insist(request.method==='POST','method_not_allowed',405)
   const part=new URL(request.url).searchParams.get('part')
   return result(part!==null?await receiveRequestPart(env,r,found.ctx,visitor,key,Number(part),request):await completeRequestUpload(env,r,found.ctx,visitor,key))
  }
  insist(!sub,'not_found',404)
  if(request.method==='POST') {
   const form=await new Response(await bounded(request,90_000_000),{headers:{'content-type':request.headers.get('content-type')??''}}).formData(),files:{filename:string;bytes:Uint8Array}[]=[]
   for(const f of form.getAll('files'))if(typeof f!=='string'&&f.size)files.push({filename:f.name,bytes:new Uint8Array(await f.arrayBuffer())})
   const text=(k:string)=>typeof form.get(k)==='string'?String(form.get(k)):''
   return withCookie(receiptPage(base,await submit(env,secret,{name:text('name'),email:text('email'),checklist:text('checklist'),replace:text('replace'),files,filing:Object.fromEntries([...form.entries()].filter(([k,v])=>(k==='schema'||k.startsWith('typed:'))&&typeof v==='string'))},visitor)))
  }
  const metadata=await metadataView(env,found.ctx),asker=personName((await maybe<Person>(env,'person',r.payload.createdBy))?.payload.name,r.payload.createdBy)
  return withCookie(requestPage(base,{...r.payload,asker,verifiedEmail:visitor.payload.email??'',submissions:await ownSubmissions(env,r,visitor),unfinished:await unfinishedRequests(env,r,visitor)},'',200,metadata.schema?fixedTypeFields(metadata.schema):''))
 } catch(e) {
  const response=failure(e),body=await response.json() as {error:string},message=body.error==='type_not_allowed'&&limits?`That type of file is not accepted here. Accepted: ${limits.types.join(', ')}.`:body.error==='file_too_large'&&limits?`A file is larger than this request accepts (${+(limits.maxBytes/1_000_000).toFixed(1)} MB each).`:messages[body.error]??body.error.replaceAll('_',' ')
  if(json)return Response.json({error:body.error,message},{status:response.status,headers:{'cache-control':'no-store'}})
  if(e instanceof ChestError&&['request_closed','request_not_found'].includes(e.code))return closedRequest()
  return publicPage('Files not accepted',`<p role="alert">${esc(message)}</p><p><a href="${esc(base)}">Return to file request</a></p>`,response.status===400?422:response.status)
 }
}
