import type { Bindings } from '../../auth.server'
import type { Op } from '../files/repo'
import type { Row } from '../model'
import type { Space } from '../files/model'
import { effectiveQuota, quotaRules, limitSQL } from './rules'
// Quarantine and rejected arrivals retain original custody and count until erasure, just like versions and trash.
export const versions = (records: string) => `SELECT json_extract(v.value,'$.checksum') checksum,json_extract(v.value,'$.size') bytes FROM ${records} r,json_each(r.payload,'$.versions') v WHERE r.kind IN ('item','document')
 UNION ALL SELECT json_extract(f.value,'$.version.checksum'),json_extract(f.value,'$.version.size') FROM ${records} r,json_each(r.payload,'$.files') f WHERE r.kind='request-submission' AND json_extract(r.payload,'$.status') IN ('quarantined','rejected')`
export const originals = `SELECT checksum,MAX(bytes) bytes FROM (${versions('chest_records')}) WHERE checksum IN (
 SELECT json_extract(v.value,'$.checksum') FROM chest_records r,json_each(r.payload,'$.versions') v WHERE r.kind='item' AND json_extract(r.payload,'$.space')=?
 UNION ALL SELECT json_extract(f.value,'$.version.checksum') FROM chest_records r,json_each(r.payload,'$.files') f WHERE r.kind='request-submission' AND json_extract(r.payload,'$.space')=? AND json_extract(r.payload,'$.status') IN ('quarantined','rejected')) GROUP BY checksum`
export async function storage(env: Bindings, space: string) {
 const row = await env.DB.prepare(`SELECT COALESCE(SUM(bytes),0) usedBytes FROM (${originals})`).bind(space,space).first<{ usedBytes: number }>()
 return { usedBytes: row?.usedBytes ?? 0 }
}
export async function storageBySpace(env: Bindings): Promise<Map<string,number>> {
 const rows = await env.DB.prepare(`WITH originalSizes AS (
  SELECT checksum,MAX(bytes) bytes FROM (${versions('chest_records')}) GROUP BY checksum
 ), refs AS (
  SELECT json_extract(r.payload,'$.space') space,json_extract(v.value,'$.checksum') checksum FROM chest_records r,json_each(r.payload,'$.versions') v WHERE r.kind='item'
  UNION SELECT json_extract(r.payload,'$.space'),json_extract(f.value,'$.version.checksum') FROM chest_records r,json_each(r.payload,'$.files') f WHERE r.kind='request-submission' AND json_extract(r.payload,'$.status') IN ('quarantined','rejected')
 ) SELECT refs.space,COALESCE(SUM(originalSizes.bytes),0) usedBytes FROM refs JOIN originalSizes ON originalSizes.checksum=refs.checksum GROUP BY refs.space`).all<{space:string;usedBytes:number}>()
 return new Map(rows.results.map(row=>[row.space,row.usedBytes]))
}
export async function totalStorage(env: Bindings) {
 const row = await env.DB.prepare(`SELECT COALESCE(SUM(bytes),0) usedBytes FROM (SELECT checksum,MAX(bytes) bytes FROM (${versions('chest_records')}) GROUP BY checksum)`).first<{ usedBytes: number }>()
 return row?.usedBytes ?? 0
}
export async function storageView(env: Bindings, space: Row<Space>, supplied?: Awaited<ReturnType<typeof quotaRules>>) {
 const {rules,groups}=supplied??await quotaRules(env)
 return {id:space.id,...effectiveQuota(space,rules,groups),...await storage(env,space.id)}
}
export function chargedSpaces(ops: Op[]) { return [...new Set(ops.filter(o=>['item','request-submission'].includes(o.row.kind)).flatMap(o=>[o.row.payload.space,o.previous?.payload.space]).filter(Boolean))] as string[] }
// Admission calculates the proposed graph inside the same atomic D1 batch as publication.
export function storageGuards(ops: Op[]) {
 const items = ops.filter(o => ['item','request-submission'].includes(o.row.kind))
 if (!items.length) return []
 const changed = JSON.stringify(items.map(o => ({ id: o.row.id,kind:o.row.kind,payload:o.remove?null:o.row.payload })))
 const spaces = new Set(items.filter(o=>!o.remove&&(o.row.payload.versions?.length||o.row.payload.files?.length)).map(o=>String(o.row.payload.space)))
 return [...spaces].map(space=>({
  sql:`WITH changes AS (SELECT json_extract(value,'$.id') id,json_extract(value,'$.kind') kind,json_extract(value,'$.payload') payload FROM json_each(?)),
   retained AS (${originals}), proposed AS (
    SELECT kind,payload FROM chest_records WHERE kind IN ('item','request-submission') AND json_extract(payload,'$.space')=? AND id NOT IN (SELECT id FROM changes)
    UNION ALL SELECT kind,payload FROM changes WHERE payload IS NOT NULL AND json_extract(payload,'$.space')=?
   ), charged AS (SELECT checksum,MAX(bytes) bytes FROM (${versions('proposed')}) GROUP BY checksum),
   usage AS (SELECT COALESCE((SELECT SUM(bytes) FROM retained),0) beforeBytes,COALESCE((SELECT SUM(bytes) FROM charged),0) afterBytes)
   INSERT INTO chest_storage_assert(ok) SELECT CASE WHEN afterBytes<=beforeBytes OR
    (SELECT ${limitSQL()} FROM chest_records s WHERE kind='space' AND id=?) IS NULL OR
    afterBytes<=(SELECT ${limitSQL()} FROM chest_records s WHERE kind='space' AND id=?) THEN 1 ELSE 0 END FROM usage`,
  params:[changed,space,space,space,space,space,space]
 }))
}
export async function proposedUsage(env: Bindings, ops: Op[], space: string) {
 const changes=JSON.stringify(ops.filter(o=>['item','request-submission'].includes(o.row.kind)).map(o=>({id:o.row.id,kind:o.row.kind,payload:o.remove?null:o.row.payload})))
 const result=await env.DB.prepare(`WITH changes AS (SELECT json_extract(value,'$.id') id,json_extract(value,'$.kind') kind,json_extract(value,'$.payload') payload FROM json_each(?)), proposed AS (
 SELECT kind,payload FROM chest_records WHERE kind IN ('item','request-submission') AND json_extract(payload,'$.space')=? AND id NOT IN (SELECT id FROM changes)
 UNION ALL SELECT kind,payload FROM changes WHERE payload IS NOT NULL AND json_extract(payload,'$.space')=?)
 SELECT COALESCE(SUM(bytes),0) usedBytes FROM (SELECT checksum,MAX(bytes) bytes FROM (${versions('proposed')}) GROUP BY checksum)`).bind(changes,space,space).first<{usedBytes:number}>()
 return result?.usedBytes??0
}
