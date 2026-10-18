import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { esc } from '../ui-shared'
import { commit, fresh, next, where } from './repo'
import { randomToken, tokenHash, tokenShape } from './capability'
import type { RequestPolicy, Visitor } from './request-model'
import { publicPage } from './ui-public'
type Challenge = { request: string; visitor: string; email: string; tokenHash: string; expires: string; used?: string }
const cookieName='chest_request'
export async function requestVisitor(env: Bindings, request: Request, r: Row<RequestPolicy>) {
 const cookie=(request.headers.get('cookie')??'').split(/;\s*/).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)??''
 const [token,mac]=cookie.split('.')
 if(!tokenShape('chest_submitter_').test(token)||!mac||!await validMac(env,token,mac))return null
 const [row]=await where<Visitor>(env,'request-visitor','$.tokenHash',await tokenHash(token))
 return row && row.payload.request===r.id && Date.parse(row.payload.expires)>Date.now() ? row : null
}
export async function ensureVisitor(env: Bindings, request: Request, r: Row<RequestPolicy>, base: string) {
 const existing=await requestVisitor(env,request,r);if(existing)return {visitor:existing,cookie:''}
 const token=randomToken('chest_submitter_'),visitor=fresh<Visitor>('request-visitor',{request:r.id,tokenHash:await tokenHash(token),expires:new Date(Date.now()+6*86400000).toISOString()})
 await commit(env,null,[{row:visitor}],{fences:[r]})
 return {visitor,cookie:`${cookieName}=${token}.${await cookieMac(env,token)}; Path=${base}; Max-Age=518400; HttpOnly; SameSite=Lax${env.AUTH_ORIGIN.startsWith('https:')?'; Secure':''}`}
}
export function requireVerification(r: RequestPolicy, visitor: Row<Visitor>|null) { if(!visitor)throw new ChestError('submitter_session_required',401);insist(r.verification!=='email'||!!visitor.payload.email,'email_verification_required',403);return visitor }
export function requestVerifyPage(base:string,message='',status=200) { return publicPage('Verify your email',`<p>Verify your email before sending files. You do not need a Chest account. Verification gives upload access only to this request.</p>${message?`<p role="status">${esc(message)}</p>`:''}<form method="post" action="${esc(base)}/verify"><label for="email">Your email</label><input id="email" name="email" type="email" autocomplete="email" required><button class="action">Email a verification link</button></form>`,status) }
export async function verifyRequest(env: Bindings, request: Request, r: Row<RequestPolicy>, base: string, visitor: Row<Visitor>, confirm: boolean) {
 const form=await request.formData()
 if(confirm) {
  const token=String(form.get('token')??'');insist(tokenShape('chest_verify_').test(token),'invalid_verification',403)
  const [challenge]=await where<Challenge>(env,'request-challenge','$.tokenHash',await tokenHash(token))
  insist(challenge && challenge.payload.request===r.id && challenge.payload.visitor===visitor.id && !challenge.payload.used && Date.parse(challenge.payload.expires)>Date.now(),'invalid_verification',403)
  await commit(env,null,[{row:next(challenge,{...challenge.payload,used:now()}),previous:challenge},{row:next(visitor,{...visitor.payload,email:challenge.payload.email}),previous:visitor}],{fences:[r],by:challenge.payload.email,audits:[{action:'file-request.verified',object:r.payload.folder,detail:{request:r.id}}]})
  return new Response(null,{status:303,headers:{location:base,'cache-control':'no-store'}})
 }
 const email=String(form.get('email')??'').trim().toLowerCase();insist(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'invalid_email')
 const recent=await env.DB.prepare("SELECT COUNT(*) n FROM chest_audit WHERE action='file-request.challenge' AND object_id=? AND at>?").bind(r.id,new Date(Date.now()-15*60000).toISOString()).first<{n:number}>();insist((recent?.n??0)<10,'too_many_verifications',429)
 const sender=operatorMail(env);insist(sender&&env.MAIL_FROM,'mail_not_configured',503)
 const token=randomToken('chest_verify_'),row=fresh<Challenge>('request-challenge',{request:r.id,visitor:visitor.id,email,tokenHash:await tokenHash(token),expires:new Date(Date.now()+15*60000).toISOString()})
 await commit(env,null,[{row}],{fences:[r,visitor],by:'request visitor',audits:[{action:'file-request.challenge',object:r.id}]})
 const url=`${env.AUTH_ORIGIN}${base}/verify?token=${encodeURIComponent(token)}`
 const sent=await sender.send({deliveryId:row.id,from:env.MAIL_FROM,to:[email],subject:'Verify your email for a Chest file request',text:`Confirm your email in the browser where you opened the request. This link expires in 15 minutes.\n\n${url}`,html:`<p><a href="${esc(url)}">Confirm email for your file request</a></p>`,headers:{'Auto-Submitted':'auto-generated'}})
 insist(sent.status==='accepted','verification_mail_failed',503)
 return requestVerifyPage(base,'A verification link has been sent. Open it in this browser within 15 minutes.')
}
export function confirmRequest(base:string,token:string) { return publicPage('Confirm your email',`<p>Confirm your email in the browser where you opened the file request.</p><form method="post" action="${esc(base)}/confirm"><input type="hidden" name="token" value="${esc(token)}"><button class="action">Confirm email</button></form>`) }

async function cookieMac(env:Bindings,value:string) { const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('') }
async function validMac(env:Bindings,value:string,mac:string) { const expected=await cookieMac(env,value);if(mac.length!==expected.length)return false;let diff=0;for(let i=0;i<mac.length;i++)diff|=mac.charCodeAt(i)^expected.charCodeAt(i);return diff===0 }
