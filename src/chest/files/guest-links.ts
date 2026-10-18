import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { insist, now } from '../model'
import { commit, fresh, next, where } from './repo'
import { randomToken, tokenHash, tokenShape } from './capability'
import type { PublicLink } from './model'
import type { Resolved } from './public-links'
import { esc } from '../ui-shared'
import { publicPage } from './ui-public'

type Audience = { audience?: 'public'|'guests'|'domain'; guests?: string[]; domain?: string }
type Challenge = { link: string; email: string; tokenHash: string; expires: string; used?: string }
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
export async function guestEmail(env:Bindings,request:Request,r:Resolved):Promise<string|null> {
 if(!r.link.payload.audience || r.link.payload.audience==='public')return 'anyone with the link'
 const value=(request.headers.get('cookie')??'').split(/;\s*/).find(v=>v.startsWith('chest_guest='))?.slice(12)??'', [email64,until,mac]=value.split('.')
 if(!email64 || !mac || !(Number(until)>Date.now()))return null
 let email:string;try{email=atob(email64)}catch{return null}
 const expected=await signature(env,`${r.link.id}:${email64}:${until}`)
 let difference=mac.length^expected.length;for(let i=0;i<expected.length;i++)difference|=(mac.charCodeAt(i)||0)^expected.charCodeAt(i)
 return difference===0 && admitted(r.link.payload,email)?email:null
}
export function verifyPage(base:string,message='',status=200) {
 return publicPage('Verify your email',`<p>This link is limited to invited email addresses or the organization named by its owner. Verify your email to open it. This gives access only through this link.</p>${message?`<p role="status">${esc(message)}</p>`:''}<form method="post" action="${esc(base)}/verify"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required><button class="action">Email a verification link</button></form>`,status)
}
export async function guestVerification(env:Bindings,request:Request,r:Resolved,base:string,confirm:boolean) {
 const form=await request.formData()
 if(confirm){
  const token=String(form.get('token')??'');if(!tokenShape('chest_guest_').test(token))return verifyPage(base,'This verification link is invalid. Request a new one.',403)
  const [row]=await where<Challenge>(env,'guest-challenge','$.tokenHash',await tokenHash(token))
  if(!row || row.payload.link!==r.link.id || row.payload.used || !(Date.parse(row.payload.expires)>Date.now()) || !admitted(r.link.payload,row.payload.email))return verifyPage(base,'This verification link expired or was already used. Request a new one.',403)
  await commit(env,null,[{row:next(row,{...row.payload,used:now()}),previous:row}],{by:row.payload.email,fences:r.fences,audits:[{action:'link.guest.verified',object:r.root.id,detail:{link:r.link.id}}]})
  const email64=btoa(row.payload.email),until=Date.now()+12*3600000,value=`${email64}.${until}.${await signature(env,`${r.link.id}:${email64}:${until}`)}`
  return new Response(null,{status:303,headers:{location:base,'cache-control':'no-store','set-cookie':`chest_guest=${value}; Path=${base}; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`}})
 }
 const email=String(form.get('email')??'').trim().toLowerCase();insist(email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'invalid_email')
 const recent=await env.DB.prepare("SELECT COUNT(*) n FROM chest_audit WHERE action='link.guest.challenge' AND object_id=? AND at>?").bind(r.link.id,new Date(Date.now()-15*60000).toISOString()).first<{n:number}>()
 if((recent?.n??0)>=10)return verifyPage(base,'Too many verification requests. Try again in 15 minutes.',429)
 await commit(env,null,[],{by:'link visitor',audits:[{action:'link.guest.challenge',object:r.link.id,detail:{}}]})
 if(admitted(r.link.payload,email)){
  const sender=operatorMail(env);insist(sender && env.MAIL_FROM,'mail_not_configured',503)
  const token=randomToken('chest_guest_'),row=fresh<Challenge>('guest-challenge',{link:r.link.id,email,tokenHash:await tokenHash(token),expires:new Date(Date.now()+15*60000).toISOString()})
  await commit(env,null,[{row}],{by:'link visitor',fences:r.fences})
  const url=`${env.AUTH_ORIGIN}${base}/verify?token=${encodeURIComponent(token)}`
  const result=await sender.send({deliveryId:row.id,from:env.MAIL_FROM,to:[email],subject:'Verify your email to open a Chest link',text:`Open this link, then confirm your email. It expires in 15 minutes.\n\n${url}`,html:`<p>Open this link, then confirm your email. It expires in 15 minutes.</p><p><a href="${esc(url)}">Verify email</a></p>`,headers:{'Auto-Submitted':'auto-generated'}})
  insist(result.status==='accepted','verification_mail_failed',503)
 }
 return verifyPage(base,'If this email is allowed, a verification link has been sent. Open it within 15 minutes.')
}
export function confirmGuest(base:string,token:string) {
 return publicPage('Confirm your email',`<p>Confirm to open the shared link in this browser.</p><form method="post" action="${esc(base)}/confirm"><input type="hidden" name="token" value="${esc(token)}"><button class="action">Confirm email</button></form>`)
}
