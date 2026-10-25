import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { snapshot } from '../store'
import { SMALL } from '../blobs'
import { commit, maybe, next } from './repo'
import { allowed, context, demand, type Who } from './access'
import { guestIdentity } from './guest-links'
import { guestPolicy } from './guest-policy'
import { passwordAdmission, admissionUntil } from './capability'
import { addVersion, bytes, createItem, nameVersion, restoreVersion } from './items'
import { type Resolved, reachable, fileThrough } from './public-links'
import { esc, stamp } from '../ui-shared'
import { publicPage } from './ui-public'
export async function guestAuthority(env:Bindings,request:Request,r:Resolved){
 insist(r.link.payload.audience==='guests'&&['viewer','commenter','editor','contributor'].includes(r.link.payload.role??'viewer'),'guest_write_refused',403)
 const identity=await guestIdentity(env,request,r);insist(identity,'guest_pin_required',403)
 const admission=r.link.payload.password?await passwordAdmission(env,request,r.link.id,r.link.payload.password.hash):null
 return guestAuthorityForIdentity(env,r,identity,admission)
}
export async function guestAuthorityForIdentity(env:Bindings,r:Resolved,identity:NonNullable<Awaited<ReturnType<typeof guestIdentity>>>,admission:import('../model').Row|null=null){
 insist(r.link.payload.audience==='guests'&&['viewer','commenter','editor','contributor'].includes(r.link.payload.role??'viewer'),'guest_write_refused',403)
 if(r.link.payload.password){insist(admission&&admission.payload.link===r.link.id&&admission.payload.passwordHash===r.link.payload.password.hash,'password_required',401);identity={...identity,until:Math.min(identity.until,await admissionUntil(env,admission))};insist(identity.until>Date.now(),'password_required',401)}
 const p=await maybe(env,'guest-policy','guest-policy:organization'),predicates=[...r.fences,identity.session,...(admission?[admission]:[]),...(p?[p]:[])].map(snapshot)
 const predicate={sql:predicates.map(p=>`(${p.sql})`).join(' AND ')+` AND (julianday('now')-2440587.5)*86400000<?`+(!p?" AND NOT EXISTS(SELECT 1 FROM chest_records WHERE id='guest-policy:organization')":''),params:[...predicates.flatMap(p=>p.params),identity.until]}
 const w:Who={email:identity.email,principals:[],groups:[],opened:[],guest:{root:r.root.id,role:(r.link.payload.role??'viewer') as 'viewer'|'commenter'|'editor'|'contributor',download:r.link.payload.download!==false,fences:[...r.fences,identity.session,...(admission?[admission]:[]),...(p?[p]:[])]}}
 // A verified guest has no operator row, staff session, seat, group membership or ordinary API authority.
 const s={id:`guest:${identity.session.id}`,kind:'guest',operatorId:`guest:${identity.email}`,operator:{id:`guest:${identity.email}`,email:identity.email,displayName:identity.email,role:'member',status:'active',version:1},createdAt:Date.parse(identity.verifiedAt),expiresAt:identity.until,predicate,guestWho:w,guestAdmission:admission?.id} as unknown as Session
 return {s,w,identity}
}
const form=(base:string,item:string,action:string,body:string,label:string)=>`<form method="post" enctype="multipart/form-data" action="${esc(base)}/guest/${esc(item)}"><input type="hidden" name="action" value="${action}">${body}<button class="action">${esc(label)}</button></form>`
export async function guestTools(env:Bindings,request:Request,r:Resolved,base:string){
 if(r.link.payload.audience!=='guests'||!['viewer','commenter','editor','contributor'].includes(r.link.payload.role??'viewer'))return ''
 const {identity,w}=await guestAuthority(env,request,r),files=await reachable(env,r),ctx=await context(env,w,r.root.id)
 return `<h2>Your guest access</h2><p>Verified as ${esc(identity.email)}. Your current role applies only to files in this grant. Sharing onward and library browsing are unavailable.</p>${r.root.payload.type==='folder'&&allowed(ctx,'contribute')?form(base,r.root.id,'upload','<label for="guest-files">Files</label><input id="guest-files" name="files" type="file" multiple required>','Upload files'):''}<ul>${files.map(f=>`<li><a href="${esc(base)}/guest/${esc(f.row.id)}">Open file and versions: ${esc(f.row.payload.name)}</a></li>`).join('')}</ul>`
}
export async function guestPage(env:Bindings,request:Request,r:Resolved,base:string,key:string){
 const {w,identity}=await guestAuthority(env,request,r),ctx=await context(env,w,key);demand(ctx,'view');const item=ctx.chain.at(-1)!
 insist(item.payload.type==='file','not_a_file')
 return publicPage(item.payload.name,`<p>Verified guest: ${esc(identity.email)} · <a href="${esc(base)}">Back to shared files</a></p><p>Every replacement and restore keeps this file's identity and earlier versions. A governed restore is a new submission, never an approval.</p>${allowed(ctx,'contribute')?form(base,key,'replace','<label for="replacement">Replacement file</label><input id="replacement" name="files" type="file" required>','Upload replacement'):''}${env.COLLABORA_URL&&allowed(ctx,'download')&&/\.(docx|xlsx|pptx)$/i.test(item.payload.name)?`<form method="post" action="${esc(base)}/editor/${esc(key)}"><button class="action">Open in Collabora Online</button></form>`:''}<h2>Version history</h2><ul>${[...item.payload.versions].reverse().map(v=>`<li><strong>${esc(v.name||v.filename)}</strong> · ${esc(v.actor)} · ${stamp(v.at)}${v.restoredFrom?` · restored from ${esc(v.restoredFrom)}`:''}<p class="mono">SHA-256 <span class="request-checksum">${esc(v.checksum)}</span></p>${r.link.payload.download!==false?`<p><a href="${esc(base)}/v/${esc(key)}?version=${esc(v.id)}">Download retained version</a></p>`:''}${allowed(ctx,'contribute')?form(base,key,'name',`<input type="hidden" name="version" value="${esc(v.id)}"><label>Version name<input name="name" value="${esc(v.name)}" maxlength="120" required></label>`,'Name version'):''}${allowed(ctx,'contribute')?form(base,key,'restore',`<input type="hidden" name="version" value="${esc(v.id)}">`,'Restore this version'):''}</li>`).join('')}</ul>`)
}
export async function guestChange(env:Bindings,request:Request,r:Resolved,base:string,key:string){
 const {s,w}=await guestAuthority(env,request,r),ctx=await context(env,w,key);demand(ctx,'contribute');const item=ctx.chain.at(-1)!,input=await request.formData(),action=String(input.get('action')??'')
 if(action==='restore'){demand(ctx,'download');await restoreVersion(env,s,w,key,String(input.get('version')??''))}
 else if(action==='name')await nameVersion(env,s,w,key,String(input.get('version')??''),{name:input.get('name')})
 else if(action==='replace'||action==='upload'){
  insist(action==='upload'?item.payload.type==='folder':item.payload.type==='file','invalid_guest_destination')
  const files=input.getAll('files');insist(files.length>0&&files.length<=10&&(action!=='replace'||files.length===1),'invalid_files')
  for(const f of files){insist(typeof f!=='string'&&f.size>0&&f.size<=SMALL,'guest_file_size',413);const original=new Uint8Array(await f.arrayBuffer())
   if(action==='replace')await addVersion(env,s,w,key,original,{filename:f.name})
   else await createItem(env,s,w,{parent:key,name:f.name,type:'file'},'upload',original)
  }
 }else insist(false,'guest_action_refused',403)
 return new Response(null,{status:303,headers:{location:action==='upload'?base:`${base}/guest/${key}`,'cache-control':'no-store'}})
}
export async function guestVersion(env:Bindings,request:Request,r:Resolved,key:string){
 const {s,w}=await guestAuthority(env,request,r),ctx=await context(env,w,key);demand(ctx,'download')
 const version=new URL(request.url).searchParams.get('version')??'',result=await bytes(env,s,w,key,version,true,request.headers.get('range'))
 await commit(env,s,[{row:next(r.link,{...r.link.payload,downloads:r.link.payload.downloads+1}),previous:r.link}],{fences:ctx.fences,audits:[{action:'link.guest.version.download',object:key,detail:{link:r.link.id,version}}]})
 return result
}
