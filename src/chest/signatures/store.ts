import type { Bindings } from '../../auth.server'
import { decode, get } from '../store'
import { ChestError, now, type Row } from '../model'
import { commit, maybe, next, where, type Audit, type Change, type Op } from '../files/repo'
import { tokenHash } from '../files/capability'
import type { Signer } from './model'
import type { SignEvent, SignRequest } from './model'
export const KIND = 'signature'
export const getRequest = (env: Bindings, key: string) => get<SignRequest>(env, KIND, key)
export const requestsOf = (env: Bindings, item: string) => where<SignRequest>(env, KIND, '$.item', item)
// The signer's link carries a secret; the record keeps its SHA-256.
export async function byToken(env: Bindings, token: string) {
 const hash = await tokenHash(token)
 const r = await env.DB.prepare("SELECT r.* FROM chest_records r, json_each(r.payload,'$.signers') s WHERE r.kind=? AND json_extract(s.value,'$.tokenHash')=? LIMIT 1").bind(KIND, hash).first()
 if (!r) return null
 const row = decode<SignRequest>(r)
 return { row, signer: row.payload.signers.find(s => s.tokenHash === hash)! }
}
export type Origin = { ip: string; agent: string }
export const origin = (request: Request): Origin => ({ ip: (request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim().slice(0, 64), agent: (request.headers.get('user-agent') ?? 'unknown').slice(0, 200) })
export const event = (type: SignEvent['type'], from: Origin, extra: Partial<SignEvent> = {}): SignEvent => ({ at: now(), type, ip: from.ip, agent: from.agent, ...extra })
export const SYSTEM: Origin = { ip: 'chest', agent: 'Chest scheduler' }
export type Change1 = { payload: SignRequest; ops?: Op[]; fences?: Row[]; audits?: Audit[]; changes?: Change[]; by?: string }
// Reads the record, applies `change` and commits it against the exact snapshot read; a concurrent writer makes it re-read and retry.
export async function mutate(env: Bindings, key: string, change: (row: Row<SignRequest>) => Promise<Change1 | null>) {
 for (let attempt = 0; ; attempt++) {
  const row = await getRequest(env, key), made = await change(row)
  if (!made) return row
  const updated = next(row, made.payload)
  try { await commit(env, null, [{ row: updated, previous: row }, ...made.ops ?? []], { fences: made.fences, audits: made.audits, changes: made.changes, by: made.by }); return updated }
  catch (error) {
   const current = await maybe<SignRequest>(env, KIND, key)
   if (attempt < 3 && current && current.revision !== row.revision) continue
   if (error instanceof ChestError) throw error
   throw error
  }
 }
}
export const redacted = (r: SignRequest) => ({ ...r, signers: r.signers.map(({ tokenHash, credential, ...s }) => s) })
// A signer's link is derived, not stored: HMAC(SESSION_SECRET, request, signer, generation). The record keeps only
// the SHA-256 of it for lookup, so reminders can rebuild the link, a resend rotates it, and a restore into another
// installation (new secret, hashes stripped from archives) leaves every old link inert.
export async function signerToken(env: Bindings, request: string, signer: Pick<Signer, 'id' | 'generation'>) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
 const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`sign:${request}:${signer.id}:${signer.generation ?? 0}`)))
 return 'chest_sign_' + btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export async function mac(env: Bindings, value: string) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
export const same = (a: string, b: string) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0 }
