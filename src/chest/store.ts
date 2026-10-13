import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { id, now, insist, type Row } from './model'
export const decode = <T=any>(row: any): Row<T> => ({...row,payload:JSON.parse(row.payload)})
export async function list<T=any>(env: Bindings, kind: string): Promise<Row<T>[]> { return (await env.DB.prepare('SELECT * FROM chest_records WHERE kind=? ORDER BY id').bind(kind).all()).results.map(decode<T>) }
export async function get<T=any>(env: Bindings, kind: string, key: string): Promise<Row<T>> { const r=await env.DB.prepare('SELECT * FROM chest_records WHERE id=? AND kind=?').bind(key,kind).first(); insist(r,'not_found',404); return decode<T>(r) }
export function sessionPredicate(session: Session) { return { sql: "EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND o.status='active' AND o.version=s.operator_version)", params:[session.id,session.operator.id,Date.now()] } }
export function ownerPredicate(session: Session) { const p=sessionPredicate(session); return {sql:`(${p.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,params:[...p.params,session.operator.id]} }
export function snapshot(row: Row) { return {sql:'EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind=? AND payload=? AND revision=?)',params:[row.id,row.kind,JSON.stringify(row.payload),row.revision]} }
export async function write(env: Bindings, session: Session, row: Row, action: string, previous?: Row, fences: Row[] = []) {
 const predicates=[sessionPredicate(session),...fences.map(snapshot),...(previous?[snapshot(previous)]:[{sql:'NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?)',params:[row.id]}])]
 const statement=(sql:string,params:unknown[]=[])=>env.DB.prepare(sql).bind(...params)
 const guards=predicates.map(p=>statement(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`,p.params))
 const sql=previous?'UPDATE chest_records SET payload=?,revision=? WHERE id=?':'INSERT INTO chest_records(payload,revision,id,kind) VALUES(?,?,?,?)'
 const params=previous?[JSON.stringify(row.payload),row.revision,row.id]:[JSON.stringify(row.payload),row.revision,row.id,row.kind]
 await env.DB.batch([...guards,statement(sql,params),statement('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)',[id(),session.operator.email,action,row.id,JSON.stringify({revision:row.revision}),now()]),statement('DELETE FROM chest_assert')])
 return row
}
export function changed<T>(row:Row<T>,payload:T):Row<T>{return {...row,payload,revision:id()}}
export async function recordAccess(env:Bindings,session:Session,row:Row,action:string){
 const p=sessionPredicate(session)
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`).bind(...p.params),
  env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(id(),session.operator.email,action,row.id,JSON.stringify({revision:row.revision}),now()),
  env.DB.prepare('DELETE FROM chest_assert')
 ])
}
