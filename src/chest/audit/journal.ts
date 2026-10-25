import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, id, now } from '../model'
export type Outcome = 'running' | 'succeeded' | 'refused' | 'failed' | 'uncertain'
export function safeDetail(value: unknown): any {
 if (Array.isArray(value)) return value.map(safeDetail)
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|secret|token|authorization|cookie|base64|api.?key|credential|archive)/i.test(key)).map(([key, v]) => [key, safeDetail(v)]))
 if (typeof value === 'string') return value.replace(/https?:\/\/[^\s"<>]+/g, '[URL omitted]').replace(/chest_(?:dev|link)_[A-Za-z0-9_-]+/g, '[credential omitted]')
 return value
}
export function facts(detail: Record<string, unknown> = {}, authority = 'system') {
 return safeDetail({ outcome: 'succeeded', authority, ...detail })
}
export async function attempt(env: Bindings, actor: string, action: string, object: string, detail: Record<string, unknown>, run: () => Promise<any>) {
 const redact=(await import('./privacy')).identityRedactor
 const anonymize=await redact(env);actor=await anonymize(actor);object=await anonymize(object)
 const key = id(), at = now(), started = { ...facts(detail), outcome: 'running' }
 // Written before work starts. A killed Worker leaves this record, never a fabricated success.
 await env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(key, actor, action, object, await anonymize(JSON.stringify(started)), at).run()
 try {
  const result = await run(), status = result instanceof Response ? result.status : 200
  const state = result?.payload?.state, providerOutcome = typeof result?.status === 'string' ? result.status : null, outcome: Outcome = providerOutcome === 'uncertain' ? 'uncertain' : providerOutcome === 'rejected' ? 'refused' : providerOutcome === 'rate_limited' ? 'failed' : status >= 500 || state === 'failed' || result?.move?.payload?.status === 'blocked' ? 'failed' : status >= 400 ? 'refused' : 'succeeded'
  await finish(outcome, { status, ...(providerOutcome ? { providerOutcome, code: result.code ?? null } : {}) })
  return result
 } catch (error) {
  const known = error instanceof ChestError, code = known ? error.code : 'execution_failed'
  await finish(known && error.status < 500 ? 'refused' : 'failed', { code })
  throw error
 }
 async function finish(outcome: Outcome, extra: Record<string, unknown>) {
  await env.DB.prepare('UPDATE chest_audit SET detail=? WHERE id=?').bind(await anonymize(JSON.stringify({ ...started, ...extra, outcome, finishedAt: now() })), key).run()
 }
}
export async function operation(env: Bindings, s: Session, method: string, path: string, run: () => Promise<any>) {
 if (path.startsWith('/audit')) return run()
 const parts = path.split('/').filter(Boolean), key = parts[1] ?? parts[0]
 const row = await env.DB.prepare('SELECT kind,payload FROM chest_records WHERE id=?').bind(key).first<{ kind: string; payload: string }>()
 const payload = row ? JSON.parse(row.payload) : null
 const version = parts[2] === 'bytes' ? parts[3] : payload?.current ?? (Array.isArray(payload?.versions)?payload.versions.at(-1)?.id:null) ?? null
 return attempt(env, s.operator.email, `${method.toLowerCase()}.${parts[0]}.${parts[2] ?? (parts[1] ? 'open' : 'create')}`, key, { authority: `${s.kind}:${s.operator.role}`, version }, run)
}
// Old unfinished work is explicitly uncertain. It stays uncertain after restart and is never changed to success by time.
export async function interrupted(env: Bindings) {
 await env.DB.prepare("UPDATE chest_audit SET detail=json_set(detail,'$.outcome','uncertain','$.reason','Execution ended without a recorded outcome') WHERE json_extract(detail,'$.outcome')='running' AND coalesce(json_extract(detail,'$.checkpointAt'),at)<?").bind(new Date(Date.now() - 5 * 60_000).toISOString()).run()
}
