import { DOMParser } from '@xmldom/xmldom'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { assertDomainSession } from '../organisation/domains'
import { requireMfa } from '../security/session'
import { ChestError, insist, now, type Row } from '../model'
import { get, sessionPredicate, snapshot } from '../store'
import { commit, fresh, maybe, next, where, withCommitAttachment } from '../files/repo'
import { allowed, context, demand, who } from '../files/access'
import { admit, bytes } from '../files/items'
import { versionPublication } from '../files/governance'
import { protect } from '../upload-protection/guard'
import { assertContent } from '../content-security/scan'
import { preserveWopiParts, validateWopiReview } from './wopi-review'
import { trackedSource } from './wopi-source'
import { guestIdentityForSession, type GuestSession } from '../files/guest-links'
import { guestAuthorityForIdentity } from '../files/guest-mutations'
import { resolveLinkRecord } from '../files/public-links'
import { randomToken, tokenHash, tokenShape } from '../files/capability'
import type { PublicLink, Item } from '../files/model'
import { digest, SMALL } from '../blobs'
import { esc } from '../ui-shared'
import { publicPage } from '../files/ui-public'
import { policy } from '../ui-shell'
import { failure } from '../api'
type Editor={item:string;email:string;tokenHash:string;expires:number;staff?:{session:string;kind:Session['kind']};guest?:{link:string;session:string;admission?:string}}
type Lock={item:string;lock:string;version:string;expires:number}
const lockKey=(item:string)=>`wopi-lock:${item}`
async function engine(env:Bindings,extension:string){
 insist(env.COLLABORA_URL,'collabora_not_configured',503)
 const origin=new URL(env.COLLABORA_URL),app=new URL(env.AUTH_ORIGIN),local=['localhost','127.0.0.1','[::1]'].includes(origin.hostname)&&['localhost','127.0.0.1','[::1]'].includes(app.hostname)
 insist((origin.protocol==='https:'||local&&origin.protocol==='http:')&&!origin.username&&!origin.password&&!origin.search&&!origin.hash,'collabora_requires_https',503)
 const response=await fetch(new URL('/hosting/discovery',origin).href,{redirect:'manual',signal:AbortSignal.timeout(15000)})
 insist(response.ok,'collabora_unavailable',503);const xml=await response.text();insist(xml.length<=1000000,'invalid_collabora_discovery',503)
 const doc=new DOMParser().parseFromString(xml,'application/xml'),actions=Array.from(doc.getElementsByTagName('action')),action=actions.find(a=>a.getAttribute('ext')===extension&&a.getAttribute('name')==='edit')
 insist(action,'collabora_format_unavailable',415);const target=new URL(action.getAttribute('urlsrc')!.replace(/<[^>]*>/g,''));insist(target.origin===origin.origin,'collabora_origin_mismatch',503);return target
}
export async function openCollabora(env:Bindings,s:Session,item:string){
 const w=await who(env,s),ctx=await context(env,w,item);demand(ctx,'view');demand(ctx,'download');const row=ctx.chain.at(-1)!,current=row.payload.versions.at(-1)
 insist(current&&/\.(docx|xlsx|pptx)$/i.test(current.filename),'collabora_format_unavailable',415)
 const target=await engine(env,current.filename.split('.').at(-1)!.toLowerCase()),token=randomToken('chest_editor_'),guest=(s as any).guestWho as typeof w|undefined
 const payload:Editor={item,email:s.operator.email,tokenHash:await tokenHash(token),expires:Math.min(s.expiresAt,Date.now()+30*60000),...(guest?{guest:{admission:(s as any).guestAdmission,link:guest.guest!.fences.find(r=>r.kind==='public-link')!.id,session:guest.guest!.fences.find(r=>r.kind==='guest-session')!.id}}:{staff:{session:s.id,kind:s.kind}})}
 const session=fresh('editor-session',payload)
 await commit(env,s,[{row:session}],{fences:ctx.fences,audits:[{action:'office.collabora.open',object:item,detail:{session:session.id,version:current.id}}]})
 target.searchParams.set('WOPISrc',`${env.AUTH_ORIGIN}/wopi/files/${item}`)
 return publicPage('Open in Collabora Online',`<section data-collabora data-origin="${esc(target.origin)}" data-restore="${esc(row.payload.versions.findLast(v=>v.arrival==='restore')?.id??'')}" data-state="/wopi/files/${esc(item)}/state"><p>${esc(row.payload.name)} · ${esc(s.operator.email)}</p><p role="status" aria-live="polite" data-collabora-status>Open the editor to begin. Restores are checked while this page is open.</p><form method="post" target="chest-collabora" action="${esc(target.href)}"><input type="hidden" name="access_token" value="${esc(token)}"><input type="hidden" name="access_token_ttl" value="${payload.expires}"><button class="action">Continue to Collabora</button></form><iframe class="office-frame" name="chest-collabora" title="Collabora Online editor" hidden></iframe>${allowed(ctx,'contribute')&&/\.docx$/i.test(current.filename)?'<details><summary>Review suggestions</summary><button type="button" class="action" data-review-decision="accept" disabled>Accept suggestion</button> <button type="button" class="action" data-review-decision="reject" disabled>Reject suggestion</button></details>':''}</section><script src="/chest-collabora.js" defer></script>`,200,{'content-security-policy':policy.replace("form-action 'self'",`form-action 'self' ${target.origin}`).replace("frame-src 'self'",`frame-src 'self' ${target.origin}`),'referrer-policy':'no-referrer'})
}
async function editorAuthority(env:Bindings,request:Request,item:string){
 const url=new URL(request.url),token=url.searchParams.get('access_token')??request.headers.get('authorization')?.replace(/^Bearer /,'')??''
 insist(tokenShape('chest_editor_').test(token),'editor_token_required',401)
 const [row]=await where<Editor>(env,'editor-session','$.tokenHash',await tokenHash(token));insist(row&&row.payload.item===item&&row.payload.expires>Date.now(),'editor_session_expired',401)
 let s:Session
 if(row.payload.guest){
  const link=await maybe<PublicLink>(env,'public-link',row.payload.guest.link);insist(link,'guest_grant_revoked',403);const r=await resolveLinkRecord(env,link);insist(!('refused' in r),'guest_grant_revoked',403)
  const guest=await maybe<GuestSession>(env,'guest-session',row.payload.guest.session),identity=await guestIdentityForSession(env,r,guest??undefined);insist(identity,'guest_pin_required',403)
  const admission=row.payload.guest.admission?await maybe(env,'member-link-session',row.payload.guest.admission):null
  s=(await guestAuthorityForIdentity(env,r,identity,admission)).s
 }else{
  const auth=await env.DB.prepare("SELECT a.id AS session,a.operator_id,a.created_at,a.expires_at,a.kind,o.id,o.email,o.display_name,o.role,o.version,o.status FROM oa_sessions a JOIN oa_operators o ON o.id=a.operator_id WHERE a.id=? AND a.revoked_at IS NULL AND a.expires_at>? AND o.status='active' AND o.version=a.operator_version").bind(row.payload.staff!.session,Date.now()).first<any>();insist(auth&&auth.email===row.payload.email,'editor_identity_revoked',401)
  s={id:auth.session,operatorId:auth.id,kind:auth.kind,createdAt:auth.created_at,expiresAt:auth.expires_at,operator:{id:auth.id,email:auth.email,displayName:auth.display_name,role:auth.role,status:auth.status,version:auth.version}} as Session
  await assertDomainSession(env,s);await requireMfa(env,s)
 }
 const current=sessionPredicate(s),saved=snapshot(row);(s as any).predicate={sql:`(${current.sql}) AND (${saved.sql}) AND (julianday('now')-2440587.5)*86400000<?`,params:[...current.params,...saved.params,row.payload.expires]}
 const w=await who(env,s),ctx=await context(env,w,item);demand(ctx,'view');demand(ctx,'download')
 return {s,w,ctx,row}
}
const conflict=(lock:string)=>new Response(null,{status:409,headers:{'X-WOPI-Lock':lock,'X-WOPI-LockFailureReason':'The current lock or file version changed','cache-control':'no-store'}})
export async function wopiResponse(request:Request,env:Bindings):Promise<Response|null>{
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean);if(parts[0]!=='wopi'||parts[1]!=='files'||!parts[2]||parts.length>4)return null
 const item=parts[2]
 try{
  const a=await editorAuthority(env,request,item),file=a.ctx.chain.at(-1)!,current=file.payload.versions.at(-1);insist(current,'version_not_found',404)
  if(request.method==='GET'&&parts[3]==='state')return Response.json({version:current.id,restore:file.payload.versions.findLast(v=>v.arrival==='restore')?.id??''},{headers:{'cache-control':'no-store'}})
  const lock=await maybe<Lock>(env,'wopi-lock',lockKey(item)),active=lock&&lock.payload.expires>Date.now()?lock:null,provided=request.headers.get('X-WOPI-Lock')??'',override=request.headers.get('X-WOPI-Override')??''
  const commenter=allowed(a.ctx,'comment')&&!allowed(a.ctx,'contribute'),readonly=!allowed(a.ctx,'comment'),document=/\.docx$/i.test(current.filename)
  let editorSize=current.size
  if(request.method==='GET'&&!parts[3]&&commenter&&document){
   await assertContent(env,current.checksum)
   const original=await env.BLOBS.get(`sha256/${current.checksum}`);insist(original,'blob_missing',503)
   const source=new Uint8Array(await original.arrayBuffer());insist(source.length===current.size&&await digest(source)===current.checksum,'blob_integrity',503)
   editorSize=trackedSource(source).length
  }
  if(request.method==='GET'&&!parts[3])return Response.json({PostMessageOrigin:new URL(env.AUTH_ORIGIN).origin,BaseFileName:file.payload.name,OwnerId:file.payload.createdBy,Size:editorSize,UserId:await digest(new TextEncoder().encode(a.s.operator.email)),UserFriendlyName:a.s.operator.displayName||a.s.operator.email,Version:current.id,UserCanWrite:!readonly,ReadOnly:readonly,UserCanOnlyComment:commenter&&!document,...(commenter&&document?{DisableChangeTrackingRecord:false,HideChangeTrackingControls:true}:{}),IsAnonymousUser:false,SupportsLocks:!readonly,SupportsGetLock:true,SupportsUpdate:!readonly,SupportsRename:false,UserCanRename:false,UserCanNotWriteRelative:true,DisableExport:false,DisablePrint:false,LastModifiedTime:current.at},{headers:{'cache-control':'no-store'}})
  if(request.method==='GET'&&parts[3]==='contents'){
   const response=await bytes(env,a.s,a.w,item,current.id,true,null,'office.download')
   if(!commenter||!document)return response
   const content=trackedSource(new Uint8Array(await response.arrayBuffer())),headers=new Headers(response.headers);headers.set('content-length',String(content.length));return new Response(content as BodyInit,{headers})
  }
  if(request.method==='POST'&&!parts[3]){
   if(override==='GET_LOCK')return new Response(null,{status:200,headers:{'X-WOPI-Lock':active?.payload.lock??'','cache-control':'no-store'}})
   demand(a.ctx,'comment')
   insist(['LOCK','REFRESH_LOCK','UNLOCK'].includes(override),'wopi_operation_unsupported',501);insist(provided.length>0&&provided.length<=1024,'invalid_wopi_lock')
   if(active&&active.payload.lock!==provided&&!(override==='LOCK'&&request.headers.get('X-WOPI-OldLock')===active.payload.lock))return conflict(active.payload.lock)
   if(!active&&override!=='LOCK')return conflict('')
   // Refreshing a lock must not adopt an externally restored version on behalf of an editor still holding old bytes.
   if(active&&override!=='UNLOCK'&&active.payload.version!==current.id)return conflict(active.payload.lock)
   const updated=lock?next(lock,{item,lock:provided,version:current.id,expires:Date.now()+30*60000}):fresh<Lock>('wopi-lock',{item,lock:provided,version:current.id,expires:Date.now()+30*60000},lockKey(item))
   await commit(env,a.s,[{row:override==='UNLOCK'?lock!:updated,previous:lock??undefined,...(override==='UNLOCK'?{remove:true}:{})}],{fences:a.ctx.fences});return new Response(null,{status:200})
  }
  if(request.method==='POST'&&parts[3]==='contents'){
   demand(a.ctx,'comment')
   if(!active||active.payload.lock!==provided||active.payload.version!==current.id)return conflict(active?.payload.lock??'')
   insist(Number(request.headers.get('content-length')??0)<=SMALL,'office_file_too_large',413)
   let content:Uint8Array=new Uint8Array(await request.arrayBuffer());insist(content.length>0&&content.length<=SMALL,'office_file_too_large',413)
   if(await digest(content)===current.checksum){await commit(env,a.s,[],{fences:[...a.ctx.fences,active]});return new Response(null,{status:200,headers:{'X-WOPI-ItemVersion':current.id}})}
   await assertContent(env,current.checksum)
   const original=await env.BLOBS.get(`sha256/${current.checksum}`);insist(original,'blob_missing',503)
   const source=new Uint8Array(await original.arrayBuffer());insist(source.length===current.size&&await digest(source)===current.checksum,'blob_integrity',503)
   if(commenter)content=await preserveWopiParts(env,source,content,current)
   let suggestion
   try{suggestion=await validateWopiReview(env,source,content,current,{email:a.s.operator.email,name:a.s.operator.displayName||a.s.operator.email},commenter)}catch(error){
    if(error instanceof ChestError&&['author_mismatch','suggest_only'].includes(error.code))await commit(env,a.s,[],{fences:a.ctx.fences,audits:[{action:'office.collabora.refused',object:item,detail:{reason:error.code,source:current.id,...((error as any).reviewReason?{reviewReason:(error as any).reviewReason,...((error as any).reviewParts?{reviewParts:(error as any).reviewParts}:{})}:{})}}]})
    throw error
   }
   await protect(env,a.s,{item:file,space:file.payload.space,parent:file.payload.parent,name:current.filename},content)
   const version=await admit(env,content,current.filename,a.s.operator.email,'browser edit',{},suggestion?{suggestion}:{}),result=next(file,await versionPublication(env,a.ctx,file.payload,version))
   await commit(env,a.s,[{row:result,previous:file},{row:next(active,{...active.payload,version:version.id,expires:Date.now()+30*60000}),previous:active}],{fences:[...a.ctx.fences,a.row],changes:[{item,space:a.ctx.space.id,kind:'version'}],audits:[{action:suggestion?.decision?'suggestion.decide':suggestion?'suggestion.add':'version.upload',object:item,detail:{version:version.id,arrival:'browser edit',...suggestion}}]})
   return new Response(null,{status:200,headers:{'X-WOPI-ItemVersion':result.payload.versions.at(-1)!.id}})
  }
  insist(false,'method_not_allowed',405)
 }catch(e){if(String(e).includes('CHECK constraint failed'))return conflict('');return failure(e)}
}
