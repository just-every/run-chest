import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, id, now } from '../model'
import { ownerPredicate } from '../store'
import { randomToken, tokenHash } from '../files/capability'
import { BASE, check, string, sql, transact, type Predicate } from './scim-common'

const live = "EXISTS(SELECT 1 FROM chest_scim_tokens t JOIN oa_operators o ON o.id=t.owner_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND o.role='owner' AND o.status='active' AND o.version=t.owner_version)"
function ownerRequest(env: Bindings, request: Request, s: Session) {
 if (s.operator.role !== 'owner') throw new ChestError('owner_required', 403)
 if (request.headers.get('origin') !== env.AUTH_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site') throw new ChestError('invalid_origin', 403)
}
export async function scimView(env: Bindings) {
 const { results } = await env.DB.prepare("SELECT t.id,t.name,t.created_at AS createdAt,t.created_by AS createdBy,t.revoked_at AS revokedAt,t.revoked_by AS revokedBy,CASE WHEN t.revoked_at IS NOT NULL THEN 'revoked' WHEN o.role='owner' AND o.status='active' AND o.version=t.owner_version THEN 'active' ELSE 'invalidated' END AS status FROM chest_scim_tokens t JOIN oa_operators o ON o.id=t.owner_id ORDER BY t.created_at DESC LIMIT 100").all()
 return { basePath: BASE, tokens: results }
}
export async function issueScimToken(env: Bindings, request: Request, s: Session, input: any) {
 ownerRequest(env, request, s)
 const name = string(input?.name, 'token name', 100), token = randomToken('chest_scim_'), key = id(), at = now()
 const p = ownerPredicate(s)
 await transact(env, p, [
  sql("INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_scim_tokens WHERE revoked_at IS NULL)<100 THEN 1 ELSE 0 END"),
  sql('INSERT INTO chest_scim_tokens(id,token_hash,name,owner_id,owner_version,created_by,created_at) SELECT ?,?,?,id,version,?,? FROM oa_operators WHERE id=?', key, await tokenHash(token), name, s.operator.email, at, s.operator.id)
 ], 'scim.token.issue', key, s.operator.email)
 return { token, credential: { id: key, name, createdAt: at, createdBy: s.operator.email, revokedAt: null, revokedBy: null, status: 'active' } }
}
export async function revokeScimToken(env: Bindings, request: Request, s: Session, key: string) {
 ownerRequest(env, request, s)
 const exists = await env.DB.prepare('SELECT id FROM chest_scim_tokens WHERE id=?').bind(key).first()
 if (!exists) throw new ChestError('not_found', 404)
 await transact(env, ownerPredicate(s), [sql('UPDATE chest_scim_tokens SET revoked_at=COALESCE(revoked_at,?),revoked_by=COALESCE(revoked_by,?) WHERE id=?', now(), s.operator.email, key)], 'scim.token.revoke', key, s.operator.email)
 return scimView(env)
}
export async function scimAuthority(env: Bindings, request: Request): Promise<{ predicate: Predicate; actor: string }> {
 const match = /^Bearer\s+(chest_scim_[A-Za-z0-9_-]{43})$/i.exec(request.headers.get('authorization') ?? '')
 check(match, 'A valid provisioning bearer token is required.', 401)
 const hash = await tokenHash(match[1]), predicate = { sql: live, params: [hash] }
 const row: any = await env.DB.prepare(`SELECT id FROM chest_scim_tokens WHERE token_hash=? AND (${live})`).bind(hash, hash).first()
 check(row, 'A valid provisioning bearer token is required.', 401)
 return { predicate, actor: `scim:${row.id}` }
}
