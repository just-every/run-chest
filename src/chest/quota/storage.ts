import type { Bindings } from '../../auth.server'
import type { Op } from '../files/repo'

// Content-addressed originals are charged once in each space retaining them. All versions and trashed items
// participate; restoring an old version or copying within a space does not allocate another original.
const originals = `SELECT json_extract(v.value,'$.checksum') checksum, MAX(json_extract(v.value,'$.size')) bytes
 FROM chest_records r, json_each(r.payload,'$.versions') v
 WHERE r.kind='item' AND json_extract(r.payload,'$.space')=? GROUP BY checksum`
export async function storage(env: Bindings, space: string) {
 const row = await env.DB.prepare(`SELECT COALESCE(SUM(bytes),0) usedBytes FROM (${originals})`).bind(space).first<{ usedBytes: number }>()
 return { usedBytes: row?.usedBytes ?? 0 }
}
export async function totalStorage(env: Bindings) {
 const row = await env.DB.prepare(`SELECT COALESCE(SUM(bytes),0) usedBytes FROM (
  SELECT json_extract(v.value,'$.checksum') checksum, MAX(json_extract(v.value,'$.size')) bytes
  FROM chest_records r, json_each(r.payload,'$.versions') v WHERE r.kind IN ('item','document') GROUP BY checksum
 )`).first<{ usedBytes: number }>()
 return row?.usedBytes ?? 0
}

// These guards execute inside the same D1 batch as the item changes. Calculate the proposed graph from the
// current SQL rows and this commit's replacements, rather than a cached byte counter or a read-before-write.
// A lowered quota may leave a space over its limit: changes retaining no additional bytes still work.
export function storageGuards(ops: Op[]) {
 const items = ops.filter(o => o.row.kind === 'item')
 if (!items.length) return []
 const changed = JSON.stringify(items.map(o => ({ id: o.row.id, payload: o.remove ? null : o.row.payload })))
 const spaces = new Set(items.filter(o => !o.remove && o.row.payload.versions?.length).map(o => String(o.row.payload.space)))
 return [...spaces].map(space => ({
  sql: `WITH changes AS (SELECT json_extract(value,'$.id') id, json_extract(value,'$.payload') payload FROM json_each(?)),
   retained AS (${originals}),
   proposed AS (
    SELECT r.payload FROM chest_records r WHERE r.kind='item' AND json_extract(r.payload,'$.space')=? AND r.id NOT IN (SELECT id FROM changes)
    UNION ALL SELECT payload FROM changes WHERE payload IS NOT NULL AND json_extract(payload,'$.space')=?
   ), charged AS (
    SELECT json_extract(v.value,'$.checksum') checksum, MAX(json_extract(v.value,'$.size')) bytes FROM proposed p, json_each(p.payload,'$.versions') v GROUP BY checksum
   ), usage AS (SELECT COALESCE((SELECT SUM(bytes) FROM retained),0) beforeBytes, COALESCE((SELECT SUM(bytes) FROM charged),0) afterBytes)
   INSERT INTO chest_storage_assert(ok) SELECT CASE WHEN
    afterBytes<=beforeBytes OR (SELECT json_extract(payload,'$.storageLimitBytes') FROM chest_records WHERE kind='space' AND id=?) IS NULL OR
    afterBytes<=(SELECT json_extract(payload,'$.storageLimitBytes') FROM chest_records WHERE kind='space' AND id=?)
    THEN 1 ELSE 0 END FROM usage`,
  params: [changed, space, space, space, space, space],
 }))
}
