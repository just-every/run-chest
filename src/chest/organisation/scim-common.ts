import type { Bindings } from '../../auth.server'
import { id, now } from '../model'

export const CORE = 'urn:ietf:params:scim:schemas:core:2.0:'
export const API = 'urn:ietf:params:scim:api:messages:2.0:'
export const BASE = '/scim/v2'
export class ScimError extends Error {
 constructor(public status: number, message: string, public scimType?: string) { super(message) }
}
export function check(value: unknown, message: string, status = 400, type = 'invalidValue'): asserts value {
 if (!value) throw new ScimError(status, message, type)
}
export function string(value: unknown, name: string, max = 200, optional = false): string {
 if (optional && (value === undefined || value === null || value === '')) return ''
 check(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value), `Invalid ${name}.`)
 return value.trim()
}
export type Predicate = { sql: string; params: unknown[] }
export type Sql = { sql: string; params: unknown[] }
export const sql = (query: string, ...params: unknown[]): Sql => ({ sql: query, params })
export const prepared = (env: Bindings, value: Sql) => env.DB.prepare(value.sql).bind(...value.params)
export const assertion = (p: Predicate) => sql(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`, ...p.params)
export async function transact(env: Bindings, auth: Predicate, statements: Sql[], action: string, object: string, actor: string) {
 await env.DB.batch([
  prepared(env, assertion(auth)), ...statements.map(s => prepared(env, s)),
  prepared(env, sql('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)', id(), actor, action, object, '{}', now())),
  prepared(env, sql('DELETE FROM chest_assert'))
 ])
}
export function reply(value: unknown, status = 200, extra: Record<string, string> = {}) {
 return new Response(value === null ? null : JSON.stringify(value), { status, headers: { 'content-type': 'application/scim+json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } })
}
export function failure(error: unknown) {
 if (error instanceof ScimError) return reply({ schemas: [API + 'Error'], status: String(error.status), detail: error.message, ...(error.scimType ? { scimType: error.scimType } : {}) }, error.status, error.status === 401 ? { 'www-authenticate': 'Bearer' } : {})
 const message = error instanceof Error ? error.message : ''
 // Never expose SQL, internal payloads, or credentials in protocol errors.
 const unique = /UNIQUE constraint failed/i.test(message), conflict = /CHECK constraint failed|FOREIGN KEY constraint failed|last_owner/i.test(message)
 return reply({ schemas: [API + 'Error'], status: unique || conflict ? '409' : '503', detail: unique ? 'The identity already exists.' : conflict ? 'The identity or authority changed. Read the resource again.' : 'Provisioning is temporarily unavailable.', ...(unique ? { scimType: 'uniqueness' } : {}) }, unique || conflict ? 409 : 503)
}
export async function body(request: Request): Promise<Record<string, any>> {
 check(/^(application\/scim\+json|application\/json)(?:\s*;|$)/i.test(request.headers.get('content-type') ?? ''), 'A JSON request body is required.', 415)
 check(Number(request.headers.get('content-length') || 0) <= 65_536, 'The request is too large.', 413)
 check(request.body, 'A JSON request body is required.')
 const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0
 try {
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65_536) { await reader.cancel(); throw new ScimError(413, 'The request is too large.') } chunks.push(value) }
 } finally { reader.releaseLock() }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
 let value: any; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new ScimError(400, 'Invalid JSON.', 'invalidSyntax') }
 check(value && typeof value === 'object' && !Array.isArray(value), 'The body must be an object.')
 return value
}
export function integer(raw: string | null, fallback: number, min: number, max: number) {
 if (raw === null) return fallback
 check(/^\d{1,10}$/.test(raw), 'Invalid pagination parameters.')
 const value = Number(raw); check(value >= min && value <= max, 'Invalid pagination parameters.'); return value
}
export const page = (resources: unknown[], total = resources.length, start = 1) => ({ schemas: [API + 'ListResponse'], totalResults: total, startIndex: start, itemsPerPage: resources.length, Resources: resources })
