import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list, ownerPredicate } from '../store'
import { insist } from '../model'
import { commit, next } from '../files/repo'
import type { Space } from '../files/model'
import { storage } from './storage'

function owner(s: Session) { insist(s.operator.role === 'owner', 'owner_required', 403) }
export async function quotaView(env: Bindings, s: Session, key: string) {
 owner(s)
 const row = await get<Space>(env, 'space', key)
 return { id: row.id, name: row.payload.name, kind: row.payload.kind, owner: row.payload.owner, limitBytes: row.payload.storageLimitBytes ?? null, ...await storage(env, key) }
}
export async function quotas(env: Bindings, s: Session) {
 owner(s)
 return Promise.all((await list<Space>(env, 'space')).map(row => quotaView(env, s, row.id)))
}
export async function setQuota(env: Bindings, s: Session, key: string, input: any) {
 owner(s)
 const limit = input.storageLimitBytes
 insist(limit === null || (Number.isSafeInteger(limit) && limit >= 0), 'invalid_storage_limit')
 const space = await get<Space>(env, 'space', key), liveOwner = ownerPredicate(s)
 await commit(env, s, [{ row: next(space, { ...space.payload, storageLimitBytes: limit }), previous: space }], {
  statements: [{ sql: `INSERT INTO chest_assert(ok) SELECT CASE WHEN (${liveOwner.sql}) THEN 1 ELSE 0 END`, params: liveOwner.params }],
  audits: [{ action: 'space.quota', object: key, detail: { before: space.payload.storageLimitBytes ?? null, after: limit } }],
 })
 return quotaView(env, s, key)
}
