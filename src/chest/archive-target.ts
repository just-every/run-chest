import { erasurePublication } from './erasure/publication'
import type { D1TargetAdapter,TargetRow } from '../modules/import-kit/src/d1/index'
const row=(r:any):TargetRow=>({destination:'library',targetKind:r.kind,targetId:r.id,value:JSON.parse(r.payload),revision:r.revision})
export const chestTargets:D1TargetAdapter={
 async read(db,destination,kind,id){const r=await db.prepare('SELECT * FROM chest_records WHERE id=? AND kind=?').bind(id,kind).first();return r?row(r):undefined},
 matches(r,destination,kind,id){return r?{sql:'EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind=? AND payload=? AND revision=?)',params:[id,kind,JSON.stringify(r.value),r.revision]}:{sql:'NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?)',params:[id]}},
 write(r){return [...erasurePublication({id:r.targetId,kind:r.targetKind,payload:r.value,revision:r.revision}),{sql:'INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,revision=excluded.revision',params:[r.targetId,r.targetKind,JSON.stringify(r.value),r.revision]}]},
 remove(destination,kind,id){return [{sql:'DELETE FROM chest_records WHERE id=? AND kind=?',params:[id,kind]}]},
 async list(db){return (await db.prepare("SELECT * FROM chest_records WHERE kind='document' ORDER BY id").all()).results.map(row)},
 matchesCount(count){return {sql:"(SELECT COUNT(*) FROM chest_records WHERE kind='document')=?",params:[count]}}
}
