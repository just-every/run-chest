import { guestPolicy, guestExpiry } from './guest-policy'
import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { insist, now } from '../model'
import { commit, fresh, maybe, next, where } from './repo'
import { randomToken, tokenHash, tokenShape } from './capability'
import type { PublicLink } from './model'
import type { Resolved } from './public-links'
import { esc } from '../ui-shared'
import { publicPage } from './ui-public'

type Audience = { audience?: 'public'|'guests'|'domain'; guests?: string[]; domain?: string }
type Challenge = { link: string; email: string; tokenHash: string; expires: string; used?: string; pinHash?:string; attempts?:number }
export function externalAudience(input: any): Audience {
 const audience = input.audience ?? 'public'
 insist(['public','guests','domain'].includes(audience),'invalid_audience')
 if(audience==='public')return {audience}
 if(audience==='domain') {
  const domain = String(input.domain ?? '').trim().toLowerCase()
  insist(domain.length<=253 && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain),'invalid_domain')
  return {audience,domain}
 }
 const guests = [...new Set((Array.isArray(input.guests)?input.guests:String(input.guests ?? '').split(/[;,\n]/)).map((v:unknown)=>String(v).trim().toLowerCase()))] as string[]
 insist(guests.length>0 && guests.length<=100 && guests.every(email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254),'invalid_guests')
 return {audience,guests}
}
const admitted = (link: PublicLink, email: string) => link.audience==='guests' ? !!link.guests?.includes(email) : link.audience==='domain' && email.split('@')[1]===link.domain
const encoder = new TextEncoder()
async function signature(env:Bindings,value:string) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('')
}
export type GuestSession={link:string;email:string;tokenHash:string;verifiedAt:string;expiresAt:string;method:'pin'|'email-link'}
export async function guestIdentity(env:Bindings,request:Request,r:Resolved):Promise<{email:string;verifiedAt:string;until:number;session:import('../model').Row<GuestSession>}|null>{
 const value=(request.headers.get('cookie')??'').split(/;\s*/).find(v=>v.startsWith('chest_guest='))?.slice(12)??''
 if(!tokenShape('chest_guest_session_').test(value))return null
 const [row]=await where<GuestSession>(env,'guest-session','$.tokenHash',await tokenHash(value))
 return guestIdentityForSession(env,r,row)
}
export async function guestIdentityForSession(env:Bindings,r:Resolved,row:import('../model').Row<GuestSession>|undefined){
 if(!row||row.payload.link!==r.link.id||(['editor','contributor'].includes(r.link.payload.role??'')&&row.payload.method!=='pin')||!admitted(r.link.payload,row.payload.email))return null
 const policy=await guestPolicy(env),until=Math.min(Date.parse(row.payload.expiresAt),Date.parse(row.payload.verifiedAt)+policy.reverifyDays*86400000,await guestExpiry(env,r.link.payload))
 return until>Date.now()?{email:row.payload.email,verifiedAt:row.payload.verifiedAt,until,session:row}:null
}
export async function guestEmail(env:Bindings,request:Request,r:Resolved):Promise<string|null> {
 if(!r.link.payload.audience||r.link.payload.audience==='public')return 'anyone with the link'
 return (await guestIdentity(env,request,r))?.email??null
}
async function verified(env:Bindings,r:Resolved,base:string,email:string,challenge:any,method:'pin'|'email-link'){
 const token=randomToken('chest_guest_session_'),at=now(),until=Math.min(Date.now()+(await guestPolicy(env)).reverifyDays*86400000,await guestExpiry(env,r.link.payload))
 const session=fresh<GuestSession>('guest-session',{link:r.link.id,email,tokenHash:await tokenHash(token),verifiedAt:at,expiresAt:new Date(until).toISOString(),method})
 await commit(env,null,[{row:next(challenge,{...challenge.payload,used:at}),previous:challenge},{row:session}],{by:email,fences:r.fences,audits:[{action:'link.guest.verified',object:r.root.id,detail:{link:r.link.id,method}}]})
 return new Response(null,{status:303,headers:{location:base,'cache-control':'no-store','set-cookie':`chest_guest=${token}; Path=${base}; Max-Age=${Math.max(0,Math.floor((until-Date.now())/1000))}; HttpOnly; Secure; SameSite=Lax`}})
}
export function verifyPage(base:string,message='',status=200,challenge='',email='') {
 return publicPage('Verify your email',`<p>This link is limited to invited email addresses or the organization named by its owner. Verify your email to open it. This gives access only through this link.</p>${message?`<p role="status">${esc(message)}</p>`:''}<form method="post" action="${esc(base)}/verify"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required><button class="action">Email a verification link</button></form>${challenge?`<form method="post" action="${esc(base)}/pin"><input type="hidden" name="challenge" value="${esc(challenge)}"><input type="hidden" name="email" value="${esc(email)}"><label for="pin">One-time PIN</label><input id="pin" name="pin" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required><button class="action">Verify PIN</button></form>`:''}`,status)
}
export async function guestVerification(env:Bindings,request:Request,r:Resolved,base:string,confirm:boolean,pin=false) {
 const form=await request.formData()
 if(pin){
  const row=await maybe<Challenge>(env,'guest-challenge',String(form.get('challenge')??'')),email=String(form.get('email')??'').trim().toLowerCase(),code=String(form.get('pin')??'')
  if(!row||row.payload.link!==r.link.id||row.payload.email!==email||row.payload.used||!row.payload.pinHash||Date.parse(row.payload.expires)<=Date.now()||(row.payload.attempts??0)>=5||!admitted(r.link.payload,email))return verifyPage(base,'This PIN expired or is not valid. Request a new one.',403)
  const expected=await signature(env,`pin:${row.id}:${email}:${code}`)
  let difference=expected.length^row.payload.pinHash.length;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^(row.payload.pinHash.charCodeAt(i)||0)
  if(!/^\d{6}$/.test(code)||difference!==0){await commit(env,null,[{row:next(row,{...row.payload,attempts:(row.payload.attempts??0)+1}),previous:row}],{fences:r.fences});return verifyPage(base,'That PIN is not correct.',403,row.id,email)}
  return verified(env,r,base,email,row,'pin')
 }
 if(confirm){
  const token=String(form.get('token')??'');if(!tokenShape('chest_guest_').test(token))return verifyPage(base,'This verification link is invalid. Request a new one.',403)
  const [row]=await where<Challenge>(env,'guest-challenge','$.tokenHash',await tokenHash(token))
  if(!row||row.payload.link!==r.link.id||row.payload.used||!(Date.parse(row.payload.expires)>Date.now())||!admitted(r.link.payload,row.payload.email))return verifyPage(base,'This verification link expired or was already used. Request a new one.',403)
  return verified(env,r,base,row.payload.email,row,'email-link')
 }
 const email=String(form.get('email')??'').trim().toLowerCase();insist(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'invalid_email')
 const recent=await env.DB.prepare("SELECT COUNT(*) n FROM chest_audit WHERE action='link.guest.challenge' AND object_id=? AND at>?").bind(r.link.id,new Date(Date.now()-15*60000).toISOString()).first<{n:number}>()
 if((recent?.n??0)>=10)return verifyPage(base,'Too many verification requests. Try again in 15 minutes.',429)
 await commit(env,null,[],{by:'link visitor',audits:[{action:'link.guest.challenge',object:r.link.id,detail:{}}]})
 let challenge=crypto.randomUUID()
 if(admitted(r.link.payload,email)){
  const sender=operatorMail(env);insist(sender&&env.MAIL_FROM,'mail_not_configured',503)
  const token=randomToken('chest_guest_'),pin=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),row=fresh<Challenge>('guest-challenge',{link:r.link.id,email,tokenHash:await tokenHash(token),pinHash:await signature(env,`pin:${challenge}:${email}:${pin}`),attempts:0,expires:new Date(Date.now()+10*60000).toISOString()},challenge)
  await commit(env,null,[{row}],{by:'link visitor',fences:r.fences})
  const url=`${env.AUTH_ORIGIN}${base}/verify?token=${encodeURIComponent(token)}`
  const result=await sender.send({deliveryId:row.id,from:env.MAIL_FROM!,to:[email],subject:'Verify your email to open a Chest link',text:`Your one-time PIN is ${pin}. Enter it on the shared page within 10 minutes, or open this link and confirm your email.\n\n${url}`,html:`<p>Your one-time PIN is ${pin}. Enter it within 10 minutes, or confirm your email:</p><p><a href="${esc(url)}">Verify email</a></p>`,headers:{'Auto-Submitted':'auto-generated'}})
  insist(result.status==='accepted','verification_mail_failed',503)
 }
 return verifyPage(base,'If this email is allowed, a PIN and verification link have been sent. Use one within 10 minutes.',200,challenge,email)
}
export function confirmGuest(base:string,token:string) {
 return publicPage('Confirm your email',`<p>Confirm to open the shared link in this browser.</p><form method="post" action="${esc(base)}/confirm"><input type="hidden" name="token" value="${esc(token)}"><button class="action">Confirm email</button></form>`)
}
