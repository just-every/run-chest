import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { requireAdmin } from '../administration/roles'
import { commit, fresh, maybe, next } from '../files/repo'
import { insist } from '../model'
import { boundedForm } from './body'
import { ssoSettings } from './settings'

export type DomainPolicy = { allowedDomains: string[]; requiredDomains: string[] }
const key = 'organisation:domains', kind = 'organisation-domain-policy'
const initial: DomainPolicy = { allowedDomains: [], requiredDomains: [] }
const domainOf = (email: string) => { const value = email.trim().toLowerCase(); return value.slice(value.lastIndexOf('@') + 1) }
function domains(value: unknown): string[] {
 const values = typeof value === 'string' ? value.split(/[\s,]+/).filter(Boolean) : value
 insist(Array.isArray(values) && values.length <= 100, 'invalid_domains')
 const normalized = values.map(value => {
  insist(typeof value === 'string', 'invalid_domain')
  const domain = value.trim().toLowerCase()
  insist(domain.length <= 253 && domain.includes('.') && domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) && !/^\d+(?:\.\d+)+$/.test(domain), 'invalid_domain')
  return domain
 })
 return [...new Set(normalized)].sort()
}
export async function domainView(env: Bindings): Promise<DomainPolicy> { return (await maybe<DomainPolicy>(env, kind, key))?.payload ?? initial }
export async function assertCompanyDomain(env: Bindings, email: string) {
 const policy = await domainView(env)
 insist(!policy.allowedDomains.length || policy.allowedDomains.includes(domainOf(email)), 'company_signin_domain_refused', 403)
}
export async function assertLocalDomain(env: Bindings, email: string) {
 const policy = await domainView(env)
 insist(!policy.requiredDomains.includes(domainOf(email)), 'organisation_sso_required', 403)
}
// Only the installed owner's recovery link bypasses a required-provider rule. Normal owner email links do not.
export async function assertDomainSession(env: Bindings, s: Session) {
 if (s.kind === 'dev') return
 if (s.kind === 'oidc') return assertCompanyDomain(env, s.operator.email)
 if (s.operator.role === 'owner' && await env.DB.prepare("SELECT 1 FROM oa_step_up_challenges WHERE session_id=? AND operator_id=? AND action='owner:signin-link' AND consumed_at IS NOT NULL").bind(s.id, s.operator.id).first()) return
 await assertLocalDomain(env, s.operator.email)
}
export async function saveDomainPolicy(env: Bindings, s: Session, input: any) {
 await requireAdmin(env, s, 'service-settings')
 const previous = await maybe<DomainPolicy>(env, kind, key), payload = {
  allowedDomains: domains(input.allowedDomains ?? []), requiredDomains: domains(input.requiredDomains ?? []),
 }
 const provider = payload.requiredDomains.length ? await ssoSettings(env) : null
 insist(!payload.requiredDomains.length || provider?.tested_at, 'test_company_signin_first', 409)
 insist(payload.requiredDomains.every(domain => !payload.allowedDomains.length || payload.allowedDomains.includes(domain)), 'required_domain_not_allowed')
 const at = Date.now(), required = JSON.stringify(payload.requiredDomains), allowed = JSON.stringify(payload.allowedDomains)
 const domain = "lower(substr(o.email,instr(o.email,'@')+1))"
 await commit(env, s, [{ row: previous ? next(previous, payload) : fresh(kind, payload, key), previous: previous ?? undefined }], {
  audits: [{ action: 'organisation.domains.configure', object: key, detail: { before: previous?.payload ?? initial, after: payload } }],
  preconditions: provider ? [{ sql: 'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_sso_config WHERE singleton=1 AND revision=? AND tested_at IS NOT NULL) THEN 1 ELSE 0 END', params: [provider.revision] }] : [],
  statements: [
   { sql: `UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE id IN (SELECT a.id FROM oa_sessions a JOIN oa_operators o ON o.id=a.operator_id WHERE (a.kind='oidc' AND json_array_length(?)>0 AND ${domain} NOT IN (SELECT value FROM json_each(?))) OR (a.kind NOT IN ('oidc','dev') AND ${domain} IN (SELECT value FROM json_each(?)) AND NOT (o.role='owner' AND EXISTS(SELECT 1 FROM oa_step_up_challenges c WHERE c.session_id=a.id AND c.operator_id=o.id AND c.action='owner:signin-link' AND c.consumed_at IS NOT NULL))))`, params: [at, allowed, allowed, required] },
   { sql: `UPDATE oa_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE kind='magic' AND consumed_at IS NULL AND operator_id IN (SELECT o.id FROM oa_operators o WHERE ${domain} IN (SELECT value FROM json_each(?)))`, params: [at, required] },
   // Advance the provider admission generation without expiring already admitted, permitted sessions.
   { sql: 'UPDATE oa_provider_sessions SET generation=generation+1 WHERE generation=(SELECT generation FROM oa_auth_settings WHERE singleton=1)', params: [] },
   { sql: 'UPDATE oa_auth_settings SET generation=generation+1 WHERE singleton=1', params: [] },
   { sql: 'DELETE FROM chest_sso_transactions', params: [] },
  ],
 })
 return payload
}

async function input(request: Request): Promise<Record<string, unknown>> {
 if ((request.headers.get('content-type') ?? '').startsWith('application/x-www-form-urlencoded')) return Object.fromEntries(await boundedForm(request.clone() as Request, 10_000))
 const reader = request.clone().body?.getReader(), chunks: Uint8Array[] = []; let size = 0
 if (reader) try { for (;;) { const result = await reader.read(); if (result.done) break; size += result.value.length; insist(size <= 10_000, 'request_too_large', 413); chunks.push(result.value) } } finally { void reader.cancel() }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
 let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes)) } catch { insist(false, 'invalid_input') }
 insist(value && typeof value === 'object' && !Array.isArray(value), 'invalid_input')
 return value as Record<string, unknown>
}
// Inspect a clone: the native authentication handler retains the original request and its origin checks.
export async function enforceLocalDomain(env: Bindings, request: Request) {
 const url = new URL(request.url), path = url.pathname
 if (path === '/auth/magic-link' && request.method === 'POST') {
  const value = await input(request)
  if (typeof value.email === 'string') await assertLocalDomain(env, value.email)
 }
 if (path !== '/auth/confirm') return
 const token = ['GET', 'HEAD'].includes(request.method) ? url.searchParams.get('token') : (await input(request)).token
 if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return
 const encoder = new TextEncoder(), secret = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
 const signature = new Uint8Array(await crypto.subtle.sign('HMAC', secret, encoder.encode(`link\0${token}`)))
 const digest = Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('')
 const person = await env.DB.prepare('SELECT o.email FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id WHERE t.token_hash=?').bind(digest).first<{ email: string }>()
 if (person) await assertLocalDomain(env, person.email)
}
