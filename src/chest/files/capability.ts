import type { Bindings } from '../../auth.server'
import { digest } from '../blobs'
import { insist } from '../model'
// Secrets behind links for anyone and file requests. Chest stores only the SHA-256 of a link token and a salted
// PBKDF2 hash of a link password; neither the token nor the password is logged, exported or shown twice.
const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
export const randomToken = (prefix: string) => prefix + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const tokenHash = (secret: string) => digest(encoder.encode(secret))
export const tokenShape = (prefix: string) => new RegExp(`^${prefix}[A-Za-z0-9_-]{43}$`)
function same(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0 }
async function pbkdf2(password: string, salt: string, iterations: number) {
 const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
 return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256))
}
export async function hashPassword(password: unknown) {
 insist(typeof password === 'string' && password.length >= 8 && password.length <= 200, 'invalid_password')
 const salt = hex(crypto.getRandomValues(new Uint8Array(16))), iterations = 100_000
 return { salt, iterations, hash: await pbkdf2(password, salt, iterations) }
}
export async function passwordMatches(stored: { salt: string; hash: string; iterations: number }, password: unknown) {
 return typeof password === 'string' && password.length <= 200 && same(await pbkdf2(password, stored.salt, stored.iterations), stored.hash)
}
// Password admissions are revocable, link-scoped records. Only token hashes are stored.
export async function unlockCookie(env: Bindings, path: string, link: string, passwordHash: string) {
 const {mfaPolicy}=await import('../security/policy'),{commit,fresh}=await import('./repo')
 const at=Date.now(),hours=Math.min(12,(await mfaPolicy(env)).sessionHours),token=randomToken('chest_unlock_'),secure=env.AUTH_ORIGIN.startsWith('https:')?'; Secure':''
 await commit(env,null,[{row:fresh('member-link-session',{link,passwordHash,tokenHash:await tokenHash(token),at,expires:at+hours*3600000})}])
 return `chest_unlock=${token}; Path=${path}; Max-Age=${hours*3600}; HttpOnly; SameSite=Lax${secure}`
}
export async function passwordAdmission(env: Bindings, request: Request, link: string, passwordHash: string) {
 const value=(request.headers.get('cookie')??'').split(/;\s*/).find(c=>c.startsWith('chest_unlock='))?.slice('chest_unlock='.length)??''
 if(!tokenShape('chest_unlock_').test(value))return null
 const {where}=await import('./repo'),[row]=await where(env,'member-link-session','$.tokenHash',await tokenHash(value))
 return row&&row.payload.link===link&&row.payload.passwordHash===passwordHash&&await admissionUntil(env,row)>Date.now()?row:null
}
export async function admissionUntil(env:Bindings,row:import('../model').Row){const {mfaPolicy}=await import('../security/policy');return Math.min(row.payload.expires,row.payload.at+Math.min(12,(await mfaPolicy(env)).sessionHours)*3600000)}
export async function unlocked(env: Bindings, request: Request, link: string, passwordHash: string) {return !!await passwordAdmission(env,request,link,passwordHash)}
export async function signOutLink(env:Bindings,request:Request,link:string,path:string){
 const {where,commit}=await import('./repo'),ops=[]
 for(const [name,prefix,kind] of [['chest_unlock','chest_unlock_','member-link-session'],['chest_guest','chest_guest_session_','guest-session']]){
  const value=(request.headers.get('cookie')??'').split(/;\s*/).find(c=>c.startsWith(name+'='))?.slice(name.length+1)??''
  if(!tokenShape(prefix).test(value))continue
  for(const row of await where(env,kind,'$.tokenHash',await tokenHash(value)))if(row.payload.link===link)ops.push({row,previous:row,remove:true})
 }
 await commit(env,null,ops)
 const headers=new Headers({location:path,'cache-control':'no-store'})
 for(const name of ['chest_unlock','chest_guest'])headers.append('set-cookie',`${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`)
 return new Response(null,{status:303,headers})
}
