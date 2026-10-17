import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, id, insist } from '../model'
import { digest } from '../blobs'
import { sessionPredicate } from '../store'
import { allowed, context, demand, who, whoFor } from '../files/access'
import { commit } from '../files/repo'

export type PresenceInput = { mode?: 'viewing' | 'editing'; leave?: boolean }
export type PresentPerson = { email: string; name: string; mode: 'viewing' | 'editing' }
const KIND = 'office-presence', TTL = 45_000
type Active = { email: string; name: string; mode: 'viewing' | 'editing' }
type Candidate = { email: string; fingerprint: string; mode: 'viewing' | 'editing' }
type LiveSession = { id: string; email: string; name: string }
const fingerprint = (session: string) => digest(new TextEncoder().encode(session))

// Presence is an expiring hint, never a grant or a lock. Only the session that owns a heartbeat may replace it;
// names and current access come from live identities and ACLs, not from browser-supplied presence fields.
export async function presence(env: Bindings, actor: Session, itemId: string, input?: PresenceInput) {
 const session = sessionPredicate(actor)
 insist(await env.DB.prepare(`SELECT 1 WHERE (${session.sql})`).bind(...session.params).first(), 'session_required', 401)
 const ctx = await context(env, await who(env, actor), itemId)
 demand(ctx, 'view'); insist(ctx.chain.at(-1)!.payload.type === 'file', 'not_a_file')
 const at = Date.now()
 if (input !== undefined) {
  insist(input && typeof input === 'object' && !Array.isArray(input), 'invalid_presence')
  insist(input.leave === undefined || typeof input.leave === 'boolean', 'invalid_presence')
  insist(input.leave === true || input.mode === 'viewing' || input.mode === 'editing', 'invalid_presence_mode')
  if (!input.leave && input.mode === 'editing') demand(ctx, 'contribute')
  const sessionHash = await fingerprint(actor.id), key = `presence:${JSON.stringify([itemId, sessionHash])}`
  const statements: { sql: string; params: unknown[] }[] = input.leave
   ? [{ sql: 'DELETE FROM chest_records WHERE id=? AND kind=?', params: [key, KIND] }]
   : [{ sql: 'INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision WHERE chest_records.kind=excluded.kind', params: [key, KIND, JSON.stringify({ item: itemId, email: actor.operator.email, session: sessionHash, mode: input.mode, expiresAt: at + TTL }), id()] }]
  statements.push({ sql: "DELETE FROM chest_records WHERE kind=? AND (json_extract(payload,'$.expiresAt')<=? OR json_extract(payload,'$.email') IS NULL)", params: [KIND, at] })
  const chainIds = new Set(ctx.chain.map(row => row.id))
  await commit(env, actor, [], { fences: [...ctx.fences, ...ctx.links.filter(row => chainIds.has(row.payload.item))], statements })
 }
 // Auth IDs never enter portable records. Compare fingerprints to live sessions only inside this request;
 // revocation, expiry and inactive identities take effect even when their last heartbeat is recent.
 const candidates = (await env.DB.prepare(`SELECT json_extract(payload,'$.email') AS email,
  json_extract(payload,'$.session') AS fingerprint,json_extract(payload,'$.mode') AS mode FROM chest_records
  WHERE kind=? AND json_extract(payload,'$.item')=? AND json_extract(payload,'$.expiresAt')>?
  AND json_extract(payload,'$.email')<>? ORDER BY json_extract(payload,'$.expiresAt') DESC LIMIT 200`)
  .bind(KIND, itemId, at, actor.operator.email).all<Candidate>()).results
 const live = candidates.length ? (await env.DB.prepare(`SELECT s.id,o.email,o.display_name AS name
  FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
  WHERE o.email IN (SELECT value FROM json_each(?)) AND s.revoked_at IS NULL AND s.expires_at>?
  AND o.status='active' AND o.version=s.operator_version`)
  .bind(JSON.stringify([...new Set(candidates.map(person => person.email))]), at).all<LiveSession>()).results : []
 const identities = new Map(await Promise.all(live.map(async session => [await fingerprint(session.id), session] as const)))
 const active: Active[] = candidates.flatMap(person => {
  const identity = identities.get(person.fingerprint)
  return identity?.email === person.email ? [{ email: identity.email, name: identity.name, mode: person.mode }] : []
 })
 const emails = [...new Set(active.map(person => person.email))]
 const people = (await Promise.all(emails.map(async email => {
  const current = await (async () => {
   try { return await context(env, await whoFor(env, email), itemId) }
   catch (error) { if (error instanceof ChestError && (error.code === 'access_required' || error.code === 'not_found')) return null; throw error }
  })()
  if (!current) return null
  if (current.state.trash || !allowed(current, 'view')) return null
  const sessions = active.filter(person => person.email === email)
  const mode = allowed(current, 'contribute') && sessions.some(person => person.mode === 'editing') ? 'editing' : 'viewing'
  return { email, name: sessions[0].name, mode } as PresentPerson
 }))).filter((person): person is PresentPerson => person !== null).sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
 return { people, ttlMs: TTL }
}
