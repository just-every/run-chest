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
// After the right password, the browser holds a 12-hour unlock for that one link: an HMAC over the link and its
// password hash, so changing or revoking the link invalidates it.
async function sign(env: Bindings, value: string) {
 const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
 return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}
export async function unlockCookie(env: Bindings, path: string, link: string, passwordHash: string) {
 const until = Date.now() + 12 * 3_600_000, secure = env.AUTH_ORIGIN.startsWith('https:') ? '; Secure' : ''
 return `chest_unlock=${until}.${await sign(env, `${link}:${passwordHash}:${until}`)}; Path=${path}; Max-Age=43200; HttpOnly; SameSite=Lax${secure}`
}
export async function unlocked(env: Bindings, request: Request, link: string, passwordHash: string) {
 const value = (request.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith('chest_unlock='))?.slice('chest_unlock='.length) ?? ''
 const [until, mac] = value.split('.')
 return !!mac && Number(until) > Date.now() && same(await sign(env, `${link}:${passwordHash}:${until}`), mac)
}
