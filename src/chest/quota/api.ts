import { canAdmin,requireAdmin } from '../administration/roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list, sessionPredicate } from '../store'
import { insist } from '../model'
import { commit, next } from '../files/repo'
import type { Space } from '../files/model'
import { storage } from './storage'

export async function quotaView(env: Bindings, s: Session, key: string) {
 const row = await get<Space>(env, 'space', key);await requireAdmin(env,s,'service-settings',row.payload.owner||row.payload.createdBy)
 return { id: row.id, name: s.operator.role==='owner'?row.payload.name:row.id, kind: row.payload.kind, owner: row.payload.owner, limitBytes: row.payload.storageLimitBytes ?? null, ...await storage(env, key) }
}
export async function quotas(env: Bindings, s: Session) {
 const rows=[];for(const row of await list<Space>(env,'space'))if(await canAdmin(env,s,'service-settings',row.payload.owner||row.payload.createdBy))rows.push(await quotaView(env,s,row.id));insist(rows.length||await canAdmin(env,s,'service-settings'),'admin_required',403);return rows
}
export async function setQuota(env: Bindings, s: Session, key: string, input: any) {
 const target=await get<Space>(env,'space',key);await requireAdmin(env,s,'service-settings',target.payload.owner||target.payload.createdBy)
 const limit = input.storageLimitBytes
 insist(limit === null || (Number.isSafeInteger(limit) && limit >= 0), 'invalid_storage_limit')
 const space = await get<Space>(env, 'space', key), liveOwner = sessionPredicate(s)
 await commit(env, s, [{ row: next(space, { ...space.payload, storageLimitBytes: limit }), previous: space }], {
  statements: [{ sql: `INSERT INTO chest_assert(ok) SELECT CASE WHEN (${liveOwner.sql}) THEN 1 ELSE 0 END`, params: liveOwner.params }],
  audits: [{ action: 'space.quota', object: key, detail: { before: space.payload.storageLimitBytes ?? null, after: limit } }],
 })
 return quotaView(env, s, key)
}
