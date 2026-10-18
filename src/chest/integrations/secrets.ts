import type { Bindings } from '../../auth.server'
import { ChestError, insist } from '../model'
const encoder = new TextEncoder()
export const random = (prefix: string) => prefix + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
export const hash = async (value: string) => Buffer.from(await crypto.subtle.digest('SHA-256',encoder.encode(value))).toString('hex')
async function key(env: Bindings) { return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(`chest-integrations\0${env.SESSION_SECRET}`)),'AES-GCM',false,['encrypt','decrypt']) }
export async function seal(env: Bindings, id: string, value: unknown) { const iv=crypto.getRandomValues(new Uint8Array(12));return `${Buffer.from(iv).toString('base64url')}.${Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(id)},await key(env),encoder.encode(JSON.stringify(value)))).toString('base64url')}` }
export async function secret<T>(env: Bindings,id: string): Promise<{ value: T; sealed: string }|null> {
 const row=await env.DB.prepare('SELECT value FROM chest_integration_secrets WHERE id=?').bind(id).first<{value:string}>();if(!row)return null
 try {const [iv,data]=row.value.split('.');return {value:JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64url'),additionalData:encoder.encode(id)},await key(env),Buffer.from(data,'base64url')))),sealed:row.value}}catch{return null}
}
export const insertSecret = (id: string,value: string) => ({sql:'INSERT INTO chest_integration_secrets(id,value) VALUES(?,?)',params:[id,value]})
export function equal(a: string,b: string) {let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
export async function sign(key: string,body: string) {const imported=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await crypto.subtle.sign('HMAC',imported,encoder.encode(body))).toString('hex')}
export function endpoint(value: unknown,local = false) {let u: URL;try{u=new URL(String(value))}catch{throw new ChestError('invalid_endpoint')};const loop=['localhost','127.0.0.1','[::1]'].includes(u.hostname);insist(!u.username&&!u.password&&!u.hash&&(u.protocol==='https:'||local&&loop&&u.protocol==='http:'),'endpoint_requires_https');insist(loop?local:!/(^10\.|^127\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^0\.|\.local$|^\[)/.test(u.hostname),'private_endpoint_refused');return u}
