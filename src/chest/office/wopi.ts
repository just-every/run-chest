import { DOMParser } from '@xmldom/xmldom'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { assertDomainSession } from '../organisation/domains'
import { requireMfa } from '../security/session'
import { ChestError, insist, now, type Row } from '../model'
import { get, sessionPredicate, snapshot } from '../store'
import { commit, fresh, maybe, next, where, withCommitAttachment } from '../files/repo'
import { context, demand, who } from '../files/access'
import { addVersion, bytes } from '../files/items'
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
type Editor={item:string;email:string;tokenHash:string;expires:number;staff?:{session:string;kind:Session['kind']};guest?:{link:string;session:string}}
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
 const w=await who(env,s),ctx=await context(env,w,item);demand(ctx,'contribute');demand(ctx,'download');const row=ctx.chain.at(-1)!,current=row.payload.versions.at(-1)
 insist(current&&/\.(docx|xlsx|pptx)$/i.test(current.filename),'collabora_format_unavailable',415)
 const target=await engine(env,current.filename.split('.').at(-1)!.toLowerCase()),token=randomToken('chest_editor_'),guest=(s as any).guestWho as typeof w|undefined
 const payload:Editor={item,email:s.operator.email,tokenHash:await tokenHash(token),expires:Math.min(s.expiresAt,Date.now()+30*60000),...(guest?{guest:{link:guest.guest!.fences.find(r=>r.kind==='public-link')!.id,session:guest.guest!.fences.find(r=>r.kind==='guest-session')!.id}}:{staff:{session:s.id,kind:s.kind}})}
 const session=fresh('editor-session',payload)
 await commit(env,s,[{row:session}],{fences:ctx.fences,audits:[{action:'office.collabora.open',object:item,detail:{session:session.id,version:current.id}}]})
 target.searchParams.set('WOPISrc',`${env.AUTH_ORIGIN}/wopi/files/${item}`)
 return publicPage('Open in Collabora Online',`<p>${esc(row.payload.name)} · ${esc(s.operator.email)}</p><p>This editor uses your current file role. Revocation, guest expiry and re-verification are checked again on every read and save. Your original and every successful save stay in Chest.</p><form method="post" action="${esc(target.href)}"><input type="hidden" name="access_token" value="${esc(token)}"><input type="hidden" name="access_token_ttl" value="${payload.expires}"><button class="action">Continue to Collabora</button></form>`,200,{'content-security-policy':policy.replace("form-action 'self'",`form-action 'self' ${target.origin}`)})
}
async function editorAuthority(env:Bindings,request:Request,item:string){
 const url=new URL(request.url),token=url.searchParams.get('access_token')??request.headers.get('authorization')?.replace(/^Bearer /,'')??''
 insist(tokenShape('chest_editor_').test(token),'editor_token_required',401)
 const [row]=await where<Editor>(env,'editor-session','$.tokenHash',await tokenHash(token));insist(row&&row.payload.item===item&&row.payload.expires>Date.now(),'editor_session_expired',401)
 let s:Session
 if(row.payload.guest){
  const link=await maybe<PublicLink>(env,'public-link',row.payload.guest.link);insist(link,'guest_grant_revoked',403);const r=await resolveLinkRecord(env,link);insist(!('refused' in r),'guest_grant_revoked',403)
  const guest=await maybe<GuestSession>(env,'guest-session',row.payload.guest.session),identity=await guestIdentityForSession(env,r,guest??undefined);insist(identity,'guest_pin_required',403)
  s=(await guestAuthorityForIdentity(env,r,identity)).s
 }else{
  const auth=await env.DB.prepare("SELECT a.id AS session,a.operator_id,a.created_at,a.expires_at,a.kind,o.id,o.email,o.display_name,o.role,o.version,o.status FROM oa_sessions a JOIN oa_operators o ON o.id=a.operator_id WHERE a.id=? AND a.revoked_at IS NULL AND a.expires_at>? AND o.status='active' AND o.version=a.operator_version").bind(row.payload.staff!.session,Date.now()).first<any>();insist(auth&&auth.email===row.payload.email,'editor_identity_revoked',401)
  s={id:auth.session,operatorId:auth.id,kind:auth.kind,createdAt:auth.created_at,expiresAt:auth.expires_at,operator:{id:auth.id,email:auth.email,displayName:auth.display_name,role:auth.role,status:auth.status,version:auth.version}} as Session
  await assertDomainSession(env,s);await requireMfa(env,s)
 }
 const current=sessionPredicate(s),saved=snapshot(row);(s as any).predicate={sql:`(${current.sql}) AND (${saved.sql}) AND (julianday('now')-2440587.5)*86400000<?`,params:[...current.params,...saved.params,row.payload.expires]}
 const w=await who(env,s),ctx=await context(env,w,item);demand(ctx,'contribute');demand(ctx,'download')
 return {s,w,ctx,row}
}
const conflict=(lock:string)=>new Response(null,{status:409,headers:{'X-WOPI-Lock':lock,'X-WOPI-LockFailureReason':'The current lock or file version changed','cache-control':'no-store'}})
export async function wopiResponse(request:Request,env:Bindings):Promise<Response|null>{
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean);if(parts[0]!=='wopi'||parts[1]!=='files'||!parts[2]||parts.length>4)return null
 const item=parts[2]
 try{
  const a=await editorAuthority(env,request,item),file=a.ctx.chain.at(-1)!,current=file.payload.versions.at(-1);insist(current,'version_not_found',404)
  const lock=await maybe<Lock>(env,'wopi-lock',lockKey(item)),active=lock&&lock.payload.expires>Date.now()?lock:null,provided=request.headers.get('X-WOPI-Lock')??'',override=request.headers.get('X-WOPI-Override')??''
  if(request.method==='GET'&&!parts[3])return Response.json({BaseFileName:file.payload.name,OwnerId:file.payload.createdBy,Size:current.size,UserId:await digest(new TextEncoder().encode(a.s.operator.email)),UserFriendlyName:a.s.operator.displayName||a.s.operator.email,Version:current.id,UserCanWrite:true,ReadOnly:false,IsAnonymousUser:false,SupportsLocks:true,SupportsGetLock:true,SupportsUpdate:true,SupportsRename:false,UserCanRename:false,UserCanNotWriteRelative:true,DisableExport:false,DisablePrint:true,LastModifiedTime:current.at},{headers:{'cache-control':'no-store'}})
  if(request.method==='GET'&&parts[3]==='contents')return await bytes(env,a.s,a.w,item,current.id,true,null,'office.download')
  if(request.method==='POST'&&!parts[3]){
   if(override==='GET_LOCK')return new Response(null,{status:200,headers:{'X-WOPI-Lock':active?.payload.lock??'','cache-control':'no-store'}})
   insist(['LOCK','REFRESH_LOCK','UNLOCK'].includes(override),'wopi_operation_unsupported',501);insist(provided.length>0&&provided.length<=1024,'invalid_wopi_lock')
   if(active&&active.payload.lock!==provided&&!(override==='LOCK'&&request.headers.get('X-WOPI-OldLock')===active.payload.lock))return conflict(active.payload.lock)
   if(!active&&override!=='LOCK')return conflict('')
   const updated=lock?next(lock,{item,lock:provided,version:current.id,expires:Date.now()+30*60000}):fresh<Lock>('wopi-lock',{item,lock:provided,version:current.id,expires:Date.now()+30*60000},lockKey(item))
   await commit(env,a.s,[{row:override==='UNLOCK'?lock!:updated,previous:lock??undefined,...(override==='UNLOCK'?{remove:true}:{})}],{fences:a.ctx.fences});return new Response(null,{status:200})
  }
  if(request.method==='POST'&&parts[3]==='contents'){
   if(!active||active.payload.lock!==provided||active.payload.version!==current.id)return conflict(active?.payload.lock??'')
   insist(Number(request.headers.get('content-length')??0)<=SMALL,'office_file_too_large',413)
   const content=new Uint8Array(await request.arrayBuffer());insist(content.length>0&&content.length<=SMALL,'office_file_too_large',413)
   if(await digest(content)===current.checksum){await commit(env,a.s,[],{fences:[...a.ctx.fences,active]});return new Response(null,{status:200,headers:{'X-WOPI-ItemVersion':current.id}})}
   const result=await addVersion(env,a.s,a.w,item,content,{filename:current.filename},'browser edit',{ops:made=>[{row:next(active,{...active.payload,version:made.payload.versions.at(-1)!.id,expires:Date.now()+30*60000}),previous:active}]})
   return new Response(null,{status:200,headers:{'X-WOPI-ItemVersion':result.payload.versions.at(-1)!.id}})
  }
  insist(false,'method_not_allowed',405)
 }catch(e){if(String(e).includes('CHECK constraint failed'))return conflict('');return failure(e)}
}
