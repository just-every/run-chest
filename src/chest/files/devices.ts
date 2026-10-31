import { requireMfa, stampMfa } from '../security/session'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { digest } from '../blobs'
import { ChestError, insist, now, text } from '../model'
import { commit, fresh, next } from './repo'
import { isAdmin } from './access'
// Sync devices (the server side of SYNC-001/003). A signed-in person enrols a device and receives its credential once;
// only the hash is stored, in a table that exports never carry. Every device request re-checks that the credential is
// unrevoked and its person still active, and every device write carries that check into its D1 batch.
export type Device = { owner: string; name: string; platform: string; createdAt: string; revokedAt: string | null; revokedBy: string | null }
const secret = () => 'chest_dev_' + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const credential = "EXISTS(SELECT 1 FROM chest_device_credentials c JOIN oa_operators o ON o.email=c.email WHERE c.token_hash=? AND c.revoked_at IS NULL AND o.status='active' AND NOT EXISTS(SELECT 1 FROM chest_activity_pauses WHERE subject='device:'||c.device))"
export async function enrol(env: Bindings, s: Session, input: any) {
 insist(!(s as any).device, 'device_cannot_enrol', 403)
 const platform = text(input.platform, 'platform', 40); insist(['macos', 'windows', 'ios', 'android', 'linux', 'other'].includes(platform), 'invalid_platform')
 const token = secret(), at = now(), row = fresh<Device>('device', { owner: s.operator.email, name: text(input.name, 'name', 120), platform, createdAt: at, revokedAt: null, revokedBy: null })
 await commit(env, s, [{ row }], { audits: [{ action: 'device.enrol', object: row.id, detail: { platform } }], statements: [{ sql: 'INSERT INTO chest_device_credentials(token_hash,device,email,created_at) VALUES(?,?,?,?)', params: [await digest(new TextEncoder().encode(token)), row.id, s.operator.email, at] }] })
 const proof=await env.DB.prepare('SELECT method FROM chest_mfa_verified WHERE session_id=?').bind(s.id).first<{method:string}>();await stampMfa(env,{...s,id:`device:${row.id}`},proof?.method??'none')
 return { device: { id: row.id, ...row.payload }, token }
}
export async function devices(env: Bindings, s: Session, ownOnly = false) {
 const seen = new Map(((await env.DB.prepare('SELECT device,last_seen FROM chest_device_credentials').all()).results as any[]).map(r => [r.device, r.last_seen]))
 return (await list<Device>(env, 'device')).filter(d => !ownOnly && isAdmin(s) || d.payload.owner === s.operator.email).map(d => ({ id: d.id, ...d.payload, lastSeen: seen.get(d.id) ?? null }))
}
export async function revoke(env: Bindings, s: Session, key: string) {
 const d = await get<Device>(env, 'device', key); insist(d.payload.owner === s.operator.email || isAdmin(s), 'not_found', 404); insist(!d.payload.revokedAt, 'device_revoked', 409)
 const at = now()
 await commit(env, s, [{ row: next(d, { ...d.payload, revokedAt: at, revokedBy: s.operator.email }), previous: d }], { audits: [{ action: 'device.revoke', object: key, detail: { owner: d.payload.owner } }], statements: [{ sql: 'UPDATE chest_device_credentials SET revoked_at=? WHERE device=?', params: [at, key] }] })
 return { revoked: true }
}
export async function deviceSession(env: Bindings, request: Request): Promise<Session> {
 const m = /^Bearer (chest_dev_[A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization') ?? ''); if (!m) throw new ChestError('authentication_required', 401)
 const hash = await digest(new TextEncoder().encode(m[1]))
 const r: any = await env.DB.prepare("SELECT c.device, c.created_at AS device_created, o.id, o.email, o.display_name, o.role, o.version, o.created_at FROM chest_device_credentials c JOIN oa_operators o ON o.email=c.email WHERE c.token_hash=? AND c.revoked_at IS NULL AND o.status='active'").bind(hash).first()
 if (!r) throw new ChestError('authentication_required', 401)
 insist(!await env.DB.prepare('SELECT 1 FROM chest_activity_pauses WHERE subject=?').bind(`device:${r.device}`).first(),'activity_device_paused',423)
 await env.DB.prepare('UPDATE chest_device_credentials SET last_seen=? WHERE token_hash=?').bind(now(), hash).run()
 const session={ id: `device:${r.device}`, kind: 'device', operatorId: r.id, operator: { id: r.id, email: r.email, displayName: r.display_name, role: r.role, status: 'active', version: r.version, createdAt: r.created_at }, createdAt: Date.parse(r.device_created), expiresAt: 0, predicate: { sql: credential, params: [hash] }, device: r.device } as unknown as Session
 await requireMfa(env,session);return session
}
