import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { requireAdmin } from '../administration/roles'
import { decode, sessionPredicate } from '../store'
import { insist, now, id, type Row } from '../model'
import { commit, next } from '../files/repo'
import { seal, unseal } from '../seal'
import { raise } from './alerts'
import type { Scan } from './model'
// Malware scanning runs in a separately deployed service (docs/threats.md: a ClamAV daemon behind a small HTTP adapter
// is the reference). Chest posts each new original to its address with a bearer token and the SHA-256, and expects
// {"verdict":"clean"|"infected","signature","engine","definitions"}. The token is sealed at rest and never sent back.
const PURPOSE = 'malware-scanner-token'
type Saved = { endpoint: string; tokenSealed: string; tokenHint: string; updatedBy: string; updatedAt: string }
const saved = async (env: Bindings): Promise<Saved | null> => { const r: any = await env.DB.prepare('SELECT * FROM chest_scanner WHERE id=1').first(); return r ? { endpoint: r.endpoint, tokenSealed: r.token_sealed, tokenHint: r.token_hint, updatedBy: r.updated_by, updatedAt: r.updated_at } : null }
export async function scannerConfig(env: Bindings) { const row = await saved(env); if (!row) return null; const token = await unseal(env.SESSION_SECRET, PURPOSE, row.tokenSealed); return token ? { endpoint: row.endpoint, token } : null }
async function asAdmin(env: Bindings, s: Session, statement: D1PreparedStatement, action: string) {
 const p = sessionPredicate(s)
 await env.DB.batch([env.DB.prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`).bind(...p.params), statement, env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(id(), s.operator.email, action, 'scanner', '{}', now()), env.DB.prepare('DELETE FROM chest_assert')])
}
export async function scannerView(env: Bindings) {
 const row = await saved(env), counts = (await env.DB.prepare("SELECT json_extract(payload,'$.state') state, COUNT(*) n FROM chest_records WHERE kind='scan' GROUP BY 1").all<{ state: string; n: number }>()).results
 return { connected: !!row, saved: row ? (({ tokenSealed, ...rest }) => rest)(row) : null, counts: Object.fromEntries(counts.map(c => [c.state, c.n])) }
}
export async function saveScanner(env: Bindings, s: Session, input: any) {
 await requireAdmin(env, s, 'service-settings')
 const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : ''; insist(/^https:\/\/[^\s/]+\/\S*$/.test(endpoint) && endpoint.length <= 300, 'invalid_endpoint')
 const row = await saved(env), entered = typeof input.token === 'string' ? input.token.trim() : ''
 insist(entered || row, 'token_required'); insist(entered.length <= 400 && !/[\x00-\x1f\s]/.test(entered), 'invalid_token')
 const sealed = entered ? await seal(env.SESSION_SECRET, PURPOSE, entered) : row!.tokenSealed, hint = entered ? `…${entered.slice(-4)}` : row!.tokenHint
 await asAdmin(env, s, env.DB.prepare('INSERT INTO chest_scanner(id,endpoint,token_sealed,token_hint,updated_by,updated_at) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint,token_sealed=excluded.token_sealed,token_hint=excluded.token_hint,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(endpoint, sealed, hint, s.operator.email, now()), 'scanner.save')
 return scannerView(env)
}
// Disconnecting stops new scans; existing verdicts, including quarantines, stay in force.
export async function removeScanner(env: Bindings, s: Session) {
 await requireAdmin(env, s, 'service-settings'); insist(await saved(env), 'not_found', 404)
 await asAdmin(env, s, env.DB.prepare('DELETE FROM chest_scanner WHERE id=1'), 'scanner.remove')
 return scannerView(env)
}
export type Verdict = { verdict: 'clean' | 'infected'; signature: string; engine: string; definitions: string }
export async function scanBytes(config: { endpoint: string; token: string }, body: ReadableStream | Uint8Array, size: number, checksum: string): Promise<Verdict> {
 const r = await fetch(config.endpoint, { method: 'POST', headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/octet-stream', 'content-length': String(size), 'x-chest-sha256': checksum }, body: body as unknown as BodyInit, signal: AbortSignal.timeout(120_000) })
 if (!r.ok) throw new Error(`The scanner answered HTTP ${r.status}.`)
 const data: any = await r.json().catch(() => null)
 if (!data || !['clean', 'infected'].includes(data.verdict) || typeof data.engine !== 'string' || !data.engine) throw new Error('The scanner answered without a verdict and engine.')
 const short = (v: unknown) => typeof v === 'string' ? v.slice(0, 200) : ''
 if (data.verdict === 'infected' && !short(data.signature)) throw new Error('The scanner reported an infection without naming it.')
 return { verdict: data.verdict, signature: short(data.signature), engine: short(data.engine), definitions: short(data.definitions) }
}
// The industry's harmless test file, assembled at run time so this source is never itself detected.
export const testSpecimen = () => new TextEncoder().encode(['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS', '-TEST-FILE!$H+H*'].join(''))
export async function testScanner(env: Bindings, s: Session) {
 await requireAdmin(env, s, 'service-settings'); const config = await scannerConfig(env)
 if (!config) return { ok: false, message: 'No scanner is connected, or its saved token cannot be opened on this installation.' }
 try {
  const specimen = testSpecimen(), checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', specimen)), b => b.toString(16).padStart(2, '0')).join('')
  const v = await scanBytes(config, specimen, specimen.length, checksum)
  return v.verdict === 'infected' ? { ok: true, message: `Working: ${v.engine} detected the standard test file as ${v.signature}.` } : { ok: false, message: `${v.engine} answered, but did not detect the standard test file.` }
 } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'The scanner could not be reached.' } }
}
const due = (p: Scan) => !p.lastAttemptAt || Date.now() - Date.parse(p.lastAttemptAt) >= Math.min(3600, 15 * 2 ** p.attempts) * 1000
// Pending originals are scanned oldest first. A failed attempt keeps the original quarantined and retries later; no
// timeout, outage or malformed answer ever releases it.
export async function sweepScans(env: Bindings, limit = 10) {
 const config = await scannerConfig(env); if (!config) return
 const rows = (await env.DB.prepare("SELECT * FROM chest_records WHERE kind='scan' AND json_extract(payload,'$.state')='pending' ORDER BY json_extract(payload,'$.createdAt') LIMIT ?").bind(limit * 3).all()).results.map(decode<Scan>).filter(r => due(r.payload)).slice(0, limit)
 for (const row of rows) {
  try { await scanOne(env, config, row) }
  catch (e) { await commit(env, null, [{ row: next(row, { ...row.payload, attempts: row.payload.attempts + 1, lastAttemptAt: now(), error: e instanceof Error ? e.message.slice(0, 200) : 'Scan failed.' }), previous: row }], { by: 'chest:scanner' }).catch(() => {}) }
 }
}
async function scanOne(env: Bindings, config: { endpoint: string; token: string }, row: Row<Scan>) {
 const p = row.payload, blob = await env.BLOBS.get(`sha256/${p.checksum}`); if (!blob) throw new Error('The original is missing from storage.')
 const v = await scanBytes(config, blob.body, blob.size, p.checksum), at = now()
 const updated = next(row, { ...p, state: v.verdict, signature: v.signature || undefined, engine: v.engine, definitions: v.definitions || undefined, scannedAt: at, attempts: p.attempts + 1, lastAttemptAt: at, error: undefined })
 const detail = { checksum: p.checksum, verdict: v.verdict, signature: v.signature, engine: v.engine, definitions: v.definitions }
 if (v.verdict === 'clean') { await commit(env, null, [{ row: updated, previous: row }], { by: 'chest:scanner', audits: [{ action: 'threats.scan.clean', object: row.id, detail }] }); return }
 const uploader = p.actor.includes('@') && await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(p.actor).first() ? p.actor : null
 await raise(env, null, { kind: 'malware', rule: 'Malware scanner verdict', subject: uploader ? { type: 'account', id: uploader, email: uploader } : null, action: 'quarantine', paused: false, checksum: p.checksum, detail: `${v.signature} (${v.engine}${v.definitions ? `, definitions ${v.definitions}` : ''})`, at }, { ops: [{ row: updated, previous: row }], audits: [{ action: 'threats.malware.detected', object: row.id, detail }], notify: uploader ? [uploader] : [] })
}
