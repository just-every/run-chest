import type { Bindings } from '../auth.server'
import { insist, id, now, type Version } from './model'
export async function digest(bytes:Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('') }
export function fromBase64(value:unknown) { insist(typeof value==='string'&&value.length<=12_000_000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'invalid_base64'); return Uint8Array.from(atob(value),c=>c.charCodeAt(0)) }
export async function inspect(bytes:Uint8Array,filename:string,actor:string,reviewer:string):Promise<Version> {
 insist(bytes.length>0&&bytes.length<=8_000_000,'file_size');insist(filename.length>0&&filename.length<=240&&!/[\x00-\x1f\/\\]/.test(filename),'invalid_filename')
 let mediaType='application/octet-stream',preview='unsupported',text=''; const prefix=new TextDecoder().decode(bytes.slice(0,1024));
 if(prefix.startsWith('%PDF-')) {mediaType='application/pdf';preview='pdf'}
 else if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'){mediaType='image/png';preview='image'}
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mediaType='image/jpeg';preview='image'}
 else if(prefix.startsWith('GIF87a')||prefix.startsWith('GIF89a')){mediaType='image/gif';preview='image'}
 else if(prefix.slice(0,4)==='RIFF'&&prefix.slice(8,12)==='WEBP'){mediaType='image/webp';preview='image'}
 else {let decoded='';try {decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{};if(decoded&&!/[\x00-\x08\x0e-\x1f]/.test(decoded)){insist(bytes.length<=500_000,'text_file_too_large');text=decoded;mediaType='text/plain';preview='text'}}
 // Active formats are never rendered as HTML/SVG, even when UTF-8 decodable.
 return {id:id(),filename,checksum:await digest(bytes),size:bytes.length,mediaType,preview,text,parser:text?'chest:utf8-text:1':'chest:signature-only:1',at:now(),actor,reviewer,state:'submitted',events:[]}
}
export async function retain(env:Bindings,bytes:Uint8Array,v:Version) { await env.BLOBS.put(`sha256/${v.checksum}`,bytes,{httpMetadata:{contentType:v.mediaType}});const stored=await env.BLOBS.get(`sha256/${v.checksum}`);insist(stored&&stored.size===v.size&&await digest(new Uint8Array(await stored.arrayBuffer()))===v.checksum,'storage_verification_failed',503) }
export async function serve(env:Bindings,v:Version,download:boolean) {
 const blob=await env.BLOBS.get(`sha256/${v.checksum}`);insist(blob,'blob_missing',503)
 const bytes=new Uint8Array(await blob.arrayBuffer());insist(bytes.length===v.size&&await digest(bytes)===v.checksum,'blob_integrity',503)
 if(!download&&v.preview==='unsupported')return Response.json({error:'preview_unavailable',message:'This format is available as an original download only.'},{status:415})
 return new Response(bytes,{headers:{'content-type':v.mediaType,'content-disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(v.filename)}`,'content-security-policy':"sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'",'x-content-type-options':'nosniff','cache-control':'no-store'}})
}
