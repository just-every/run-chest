import type { Row } from '../model'
// Storage deletion spans D1 and R2. Keep a durable admission fence while bytes are being removed,
// so a concurrently admitted copy can never become visible just before its object is deleted.
export function erasurePublication(row:Row,previous?:Row){
 if(!['item','document'].includes(row.kind))return []
 const old=new Set((previous?.payload?.versions??[]).map((v:any)=>v.id)),added=(row.payload?.versions??[]).filter((v:any)=>!old.has(v.id)).map((v:any)=>v.checksum)
 if(!added.length)return []
 return [{sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM chest_records r,json_each(r.payload,'$.originals.pending') p WHERE r.kind='erasure' AND json_extract(r.payload,'$.state')='pending' AND p.value IN (SELECT value FROM json_each(?))) THEN 1 ELSE 0 END",params:[JSON.stringify(added)]}]
}
