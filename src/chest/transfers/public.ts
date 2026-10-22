import { assertContent } from '../content-security/scan'
import { activity } from '../content-security/activity'
import type { Bindings } from '../../auth.server'
import { insist, now } from '../model'
import { commit, fresh, maybe, next, where } from '../files/repo'
import { guestEmail, verifyPage } from '../files/guest-links'
import { randomToken, tokenHash, unlocked } from '../files/capability'
import { fileThrough, reachable, resolveLink, type Resolved } from '../files/public-links'
import { publicVersion } from '../files/link-snapshots'
import { passwordPage, publicPage, refusedLink } from '../files/ui-public'
import { esc, stamp } from '../ui-shared'
import { event, mergeRanges, record, type Package, type Ticket } from './model'
const prefix='chest_delivery_'
async function ticket(env:Bindings,request:Request,pkg:string,actor:string) {
 const token=(request.headers.get('cookie')??'').split(/;\s*/).find(c=>c.startsWith('chest_delivery='))?.slice(15)??''
 const [row]=await where<Ticket>(env,'transfer-session','$.tokenHash',await tokenHash(token))
 return row?.payload.transfer===pkg&&row.payload.actor===actor?row:null
}
function rangeOf(header:string|null,size:number):[number,number]|null {
 if(!header)return [0,size-1]
 const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||!m[1]&&!m[2])return null
 if(!m[1]){const n=Number(m[2]);return Number.isSafeInteger(n)&&n>0?[Math.max(0,size-n),size-1]:null}
 const start=Number(m[1]),end=m[2]?Math.min(size-1,Number(m[2])):size-1
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?[start,end]:null
}
async function open(env:Bindings,request:Request,r:Resolved,pkg:any,base:string,actor:string) {
 const active=await ticket(env,request,pkg.id,actor),files=await reachable(env,r)
 if(request.method==='GET')await record(env,pkg.id,actor,/bot|scanner|preview|proofpoint|mimecast|safelinks/i.test(request.headers.get('user-agent')??'')?'scanner_view':'view')
 const rows=files.flatMap(({row,path})=>{const v=publicVersion(row,r.link.payload);return v?[`<li><strong>${esc(path+row.payload.name)}</strong><p class="mono receipt">${v.size} bytes · Version ${esc(v.id)}<br>SHA-256 ${esc(v.checksum)}</p>${active?`<a class="action" href="${base}/f/${row.id}" download>Download ${esc(row.payload.name)}</a>${active.payload.completed[row.id]===v.id?'<p>Complete bytes served in this session.</p>':''}`:''}</li>`]:[]}).join('')
 return publicPage(pkg.payload.title,`<p>These exact versions were pinned when the sender created this package.</p>${r.link.payload.expires?`<p>Expires ${stamp(r.link.payload.expires)}</p>`:''}<p>${pkg.payload.started}${pkg.payload.limit?` of ${pkg.payload.limit}`:''} download sessions started. An existing session can resume until expiry or revocation.</p><ul class="events">${rows}</ul>${active?'':`<form method="post" action="${base}/start"><button class="action">Start download session</button></form>`}${active&&pkg.payload.receipt?active.payload.confirmed?'<p role="status">Your explicit receipt confirmation is recorded.</p>':`<form method="post" action="${base}/received"><label><input type="checkbox" name="received" value="yes" required> I received the exact file versions in this package</label><button class="action">Confirm receipt</button></form>`:''}<p class="quiet">A page view or email delivery is not a receipt. Complete bytes served does not prove that a person saved the file.</p>`)
}
async function start(env:Bindings,request:Request,r:Resolved,pkg:any,base:string,actor:string) {
 const existing=await ticket(env,request,pkg.id,actor)
 if(existing)return new Response(null,{status:303,headers:{location:base}})
 const p=pkg.payload as Package;insist(p.limit===null||p.started<p.limit,'transfer_limit_reached',410)
 const token=randomToken(prefix),row=fresh<Ticket>('transfer-session',{transfer:pkg.id,tokenHash:await tokenHash(token),actor,at:now(),ranges:{},completed:{}})
 await commit(env,null,[{row},{row:next(pkg,{...p,started:p.started+1}),previous:pkg},{row:event(pkg.id,actor,'started',{session:row.id})}],{by:actor,fences:r.fences})
 return new Response(null,{status:303,headers:{location:base,'cache-control':'no-store','set-cookie':`chest_delivery=${token}; Path=${base}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`}})
}
async function received(env:Bindings,request:Request,r:Resolved,pkg:any,base:string,actor:string) {
 insist(pkg.payload.receipt,'receipt_not_requested',403)
 const session=await ticket(env,request,pkg.id,actor);insist(session,'download_session_required',403)
 insist((await request.formData()).get('received')==='yes','explicit_confirmation_required')
 if(!session.payload.confirmed){
  const files=await reachable(env,r),events=[]
  for(const {row} of files){const v=publicVersion(row,r.link.payload);if(v){const live=await fileThrough(env,r,row.id);insist(live,'file_unavailable',410);events.push({row:event(pkg.id,actor,'confirmed',{session:session.id,item:row.id,version:v.id})})}}
  insist(events.length,'package_empty',410)
  await commit(env,null,[{row:next(session,{...session.payload,confirmed:now()}),previous:session},...events],{by:actor,fences:r.fences})
 }
 return new Response(null,{status:303,headers:{location:base}})
}
// Record only fully consumed response intervals; a cancelled response never claims bytes completed.
async function completed(env:Bindings,r:Resolved,pkg:string,sessionId:string,actor:string,item:string,version:string,size:number,range:[number,number]) {
 const session=await maybe<Ticket>(env,'transfer-session',sessionId);if(!session)return
 const intervals=mergeRanges(session.payload.ranges[item]??[],range),done=intervals.length===1&&intervals[0][0]===0&&intervals[0][1]===size-1
 const first=done&&session.payload.completed[item]!==version
 const payload={...session.payload,ranges:{...session.payload.ranges,[item]:intervals},completed:{...session.payload.completed,...(done?{[item]:version}:{})}}
 await commit(env,null,[{row:next(session,payload),previous:session},...(first?[{row:event(pkg,actor,'bytes_completed',{session:session.id,item,version,bytes:size})}]:[])],{by:actor,fences:r.fences})
}
async function bytes(env:Bindings,request:Request,r:Resolved,pkg:any,actor:string,key:string) {
 const session=await ticket(env,request,pkg.id,actor);insist(session,'download_session_required',403)
 const file=await fileThrough(env,r,key);insist(file,'download_refused',403)
 const v=publicVersion(file.row,r.link.payload);insist(v,'version_not_found',404)
 const rangeHeader=request.headers.get('range'),range=rangeOf(rangeHeader,v.size)
 if(!range)return new Response(null,{status:416,headers:{'content-range':`bytes */${v.size}`,'cache-control':'no-store'}})
 const etag=`"${v.checksum}"`;if(request.headers.has('if-range')&&request.headers.get('if-range')!==etag)return new Response(null,{status:412,headers:{etag}})
 await assertContent(env,v.checksum)
 await activity(env,null,'download',range[1]-range[0]+1,{actor,source:`link:${r.link.id}`,fences:file.fences})
 const blob=await env.BLOBS.get(`sha256/${v.checksum}`,{range:{offset:range[0],length:range[1]-range[0]+1}});insist(blob,'blob_missing',503)
 const reader=blob.body.getReader();let sent=0
 const body=new ReadableStream<Uint8Array>({async pull(controller){try{const part=await reader.read();if(part.done){insist(sent===range[1]-range[0]+1,'incomplete_transfer',503);await completed(env,r,pkg.id,session.id,actor,key,v.id,v.size,range);controller.close()}else {sent+=part.value.length;controller.enqueue(part.value)}}catch(e){controller.error(e);await reader.cancel(e)}},async cancel(reason){await reader.cancel(reason)}})
 return new Response(body,{status:rangeHeader?206:200,headers:{'content-type':'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.row.payload.name)}`,'content-length':String(range[1]-range[0]+1),'accept-ranges':'bytes',etag,'cache-control':'private, no-store','x-content-type-options':'nosniff',...(rangeHeader?{'content-range':`bytes ${range[0]}-${range[1]}/${v.size}`}:{})}})
}
export async function transferPublic(env:Bindings,request:Request,secret:string,sub?:string,key?:string):Promise<Response|null> {
 // Verification/password posts remain owned by the existing verified-link doors.
 if(sub==='verify'||sub==='confirm'||!sub&&request.method==='POST')return null
 const resolved=await resolveLink(env,secret);if('refused' in resolved)return null
 const [pkg]=await where<Package>(env,'transfer-package','$.link',resolved.link.id);if(!pkg)return null
 const actor=await guestEmail(env,request,resolved),base=`/l/${secret}`
 if(!actor)return verifyPage(base)
 if(resolved.link.payload.password&&!await unlocked(env,request,resolved.link.id,resolved.link.payload.password.hash))return passwordPage(base)
 if(!sub&&(request.method==='GET'||request.method==='HEAD'))return open(env,request,resolved,pkg,base,actor)
 if(sub==='start'&&request.method==='POST')return start(env,request,resolved,pkg,base,actor)
 if(sub==='received'&&request.method==='POST')return received(env,request,resolved,pkg,base,actor)
 if(sub==='f'&&key&&request.method==='GET')return bytes(env,request,resolved,pkg,actor,key)
 return null
}
