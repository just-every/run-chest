import { isRtf } from './read/rtf'
import { scanUpload, assertContent } from './content-security/scan'
import type { Bindings } from '../auth.server'
import { insist, id, now, type Version } from './model'
export async function digest(bytes:Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('') }
export function fromBase64(value:unknown) { insist(typeof value==='string'&&value.length<=12_000_000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'invalid_base64'); return Uint8Array.from(atob(value),c=>c.charCodeAt(0)) }
export const SMALL=8_000_000
// Byte signatures decide the media type and preview; active formats are never rendered as HTML/SVG.
export function signature(bytes:Uint8Array):{mediaType:string,preview:string}|null {
 if(isRtf(bytes))return {mediaType:'application/rtf',preview:'unsupported'}
 const prefix=new TextDecoder().decode(bytes.slice(0,1024))
 if(prefix.startsWith('%PDF-'))return {mediaType:'application/pdf',preview:'pdf'}
 if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')return {mediaType:'image/png',preview:'image'}
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mediaType:'image/jpeg',preview:'image'}
 if(prefix.startsWith('GIF87a')||prefix.startsWith('GIF89a'))return {mediaType:'image/gif',preview:'image'}
 if(prefix.slice(0,4)==='RIFF'&&prefix.slice(8,12)==='WEBP')return {mediaType:'image/webp',preview:'image'}
 if(bytes.slice(0,4).join(',')==='73,73,42,0'||bytes.slice(0,4).join(',')==='77,77,0,42')return {mediaType:'image/tiff',preview:'unsupported'}
 // HEIC/HEIF photos are read (src/chest/read) but most browsers cannot show them, so the original is a download.
 if(prefix.slice(4,8)==='ftyp'&&['heic','heix','heim','heis','mif1','msf1'].includes(prefix.slice(8,12)))return {mediaType:'image/heic',preview:'unsupported'}
 return null
}
export async function inspect(bytes:Uint8Array,filename:string,actor:string,reviewer:string):Promise<Version> {
 insist(bytes.length>0&&bytes.length<=SMALL,'file_size');insist(filename.length>0&&filename.length<=240&&!/[\x00-\x1f\/\\]/.test(filename),'invalid_filename')
 let {mediaType,preview}=signature(bytes)??{mediaType:'application/octet-stream',preview:'unsupported'},text=''
 if(preview==='unsupported'&&mediaType!=='application/rtf'){let decoded='';try {decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{};if(decoded&&!/[\x00-\x08\x0e-\x1f]/.test(decoded)){insist(bytes.length<=500_000,'text_file_too_large');text=decoded;mediaType='text/plain';preview='text'}}
 return {id:id(),filename,checksum:await digest(bytes),size:bytes.length,mediaType,preview,text,parser:text?'chest:utf8-text:1':'chest:signature-only:1',at:now(),actor,reviewer,state:'submitted',events:[]}
}
export async function retain(env:Bindings,bytes:Uint8Array,v:Version) { await env.BLOBS.put(`sha256/${v.checksum}`,bytes,{httpMetadata:{contentType:v.mediaType}});const stored=await env.BLOBS.get(`sha256/${v.checksum}`);insist(stored&&stored.size===v.size&&await digest(new Uint8Array(await stored.arrayBuffer()))===v.checksum,'storage_verification_failed',503);await scanUpload(env,v) }
// Large originals (above the in-memory bound) are staged by resumable multipart upload. Their SHA-256 is computed by
// streaming the staged bytes; R2 checks that digest again when it writes the content-addressed copy.
// The DOM library's Crypto type hides the Workers runtime's streaming digest.
const digester=()=>new (crypto as unknown as {DigestStream:typeof DigestStream}).DigestStream('SHA-256')
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')
export async function streamDigest(env:Bindings,key:string) {
 const blob=await env.BLOBS.get(key);insist(blob,'blob_missing',503)
 const hash=digester();await blob.body.pipeTo(hash)
 return {checksum:hex(await hash.digest),size:blob.size}
}
export async function custody(env:Bindings,staging:string,checksum:string,size:number,mediaType:string,source:{filename:string;actor:string}) {
 if(!await env.BLOBS.head(`sha256/${checksum}`)){
  const blob=await env.BLOBS.get(staging);insist(blob&&blob.size===size,'storage_verification_failed',503)
  const fixed=new FixedLengthStream(size);await Promise.all([blob.body.pipeTo(fixed.writable),env.BLOBS.put(`sha256/${checksum}`,fixed.readable,{sha256:checksum,httpMetadata:{contentType:mediaType}})])
 }
 const stored=await env.BLOBS.head(`sha256/${checksum}`);insist(stored&&stored.size===size,'storage_verification_failed',503)
 await scanUpload(env,{checksum,size,...source})
}
const served=(v:Version,download:boolean)=>({'content-type':v.mediaType,'content-disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(v.filename)}`,'content-security-policy':"sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'",'x-content-type-options':'nosniff','cache-control':'no-store'})
export async function serve(env:Bindings,v:Version,download:boolean) {
 await assertContent(env,v.checksum)
 const blob=await env.BLOBS.get(`sha256/${v.checksum}`);insist(blob,'blob_missing',503)
 if(!download&&v.preview==='unsupported')return Response.json({error:'preview_unavailable',message:'This format is available as an original download only.'},{status:415})
 if(v.size>SMALL){
  // Too large to hold in memory: the digest is recomputed while the bytes stream, and a mismatch fails the transfer.
  // Hash each chunk at the consumer's pace without a second stream consumer.
  insist(blob.size===v.size,'blob_integrity',503);const hash=digester(),writer=hash.getWriter()
  const verified=new TransformStream<Uint8Array,Uint8Array>({
   async transform(value,controller){await writer.write(value);controller.enqueue(value)},
   async flush(){await writer.close();insist(hex(await hash.digest)===v.checksum,'blob_integrity',503)},
  })
  return new Response(blob.body.pipeThrough(verified),{headers:{...served(v,download),'content-length':String(v.size)}})
 }
 const bytes=new Uint8Array(await blob.arrayBuffer());insist(bytes.length===v.size&&await digest(bytes)===v.checksum,'blob_integrity',503)
 return new Response(bytes,{headers:served(v,download)})
}
