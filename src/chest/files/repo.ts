import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { decode, sessionPredicate, snapshot } from '../store'
import { id, now, type Row } from '../model'
import type { Item } from './model'
// Files share Chest's record table. One commit is one D1 batch: the actor's live session (or device), snapshots of
// every record the decision read, the writes, the sync journal and the audit rows succeed or fail together.
export type Op = { row: Row; previous?: Row; remove?: boolean }
export type Change = { item: string; space: string; kind: string }
export type Audit = { action: string; object: string; detail?: Record<string, unknown> }
export async function maybe<T = any>(env: Bindings, kind: string, key: string): Promise<Row<T> | null> { const r = await env.DB.prepare('SELECT * FROM chest_records WHERE id=? AND kind=?').bind(key, kind).first(); return r ? decode<T>(r) : null }
export async function where<T = any>(env: Bindings, kind: string, path: string, value: string): Promise<Row<T>[]> { return (await env.DB.prepare(`SELECT * FROM chest_records WHERE kind=? AND json_extract(payload,?)=? ORDER BY id`).bind(kind, path, value).all()).results.map(decode<T>) }
export const spaceItems = (env: Bindings, space: string) => where<Item>(env, 'item', '$.space', space)
export async function commit(env: Bindings, actor: Session | null, ops: Op[], { fences = [], changes = [], audits = [], statements = [] }: { fences?: Row[]; changes?: Change[]; audits?: Audit[]; statements?: { sql: string; params: unknown[] }[] } = {}) {
 const statement = (sql: string, params: unknown[] = []) => env.DB.prepare(sql).bind(...params)
 const written = new Set(ops.map(o => o.row.id)), predicates = [...(actor ? [sessionPredicate(actor)] : []), ...fences.filter(f => !written.has(f.id)).map(snapshot), ...ops.map(o => o.previous ? snapshot(o.previous) : { sql: 'NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?)', params: [o.row.id] })]
 const at = now(), who = actor?.operator.email ?? 'chest:system'
 await env.DB.batch([
  ...predicates.map(p => statement(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`, p.params)),
  ...ops.map(o => o.remove ? statement('DELETE FROM chest_records WHERE id=?', [o.row.id]) : o.previous ? statement('UPDATE chest_records SET payload=?,revision=? WHERE id=?', [JSON.stringify(o.row.payload), o.row.revision, o.row.id]) : statement('INSERT INTO chest_records(payload,revision,id,kind) VALUES(?,?,?,?)', [JSON.stringify(o.row.payload), o.row.revision, o.row.id, o.row.kind])),
  ...changes.map(c => statement('INSERT INTO chest_changes(item,space,kind,at) VALUES(?,?,?,?)', [c.item, c.space, c.kind, at])),
  ...audits.map(a => statement('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)', [id(), who, a.action, a.object, JSON.stringify(a.detail ?? {}), at])),
  ...statements.map(x => statement(x.sql, x.params)),
  statement('DELETE FROM chest_assert'),
 ])
}
export const fresh = <T>(kind: string, payload: T, key: string = id()): Row<T> => ({ id: key, kind, payload, revision: id() })
export const next = <T>(row: Row<T>, payload: T): Row<T> => ({ ...row, payload, revision: id() })
