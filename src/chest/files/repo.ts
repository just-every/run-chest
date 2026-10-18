import { integrationEventOps, integrationEventStatements } from '../integrations/events'
import { erasurePublication } from '../erasure/publication'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { decode, sessionPredicate, snapshot } from '../store'
import { ChestError, id, now, type Row } from '../model'
import type { Item } from './model'
import { storageGuards, chargedSpaces, storageView, proposedUsage } from '../quota/storage'
import { warningPublication } from '../quota/warnings'
import { StorageRefusal } from '../quota/errors'
import { facts } from '../audit/journal'
// Files share Chest's record table. One commit is one D1 batch: the actor's live session (or device), snapshots of
// every record the decision read, the writes, the sync journal and the audit rows succeed or fail together.
export type Op = { row: Row; previous?: Row; remove?: boolean }
export type Change = { item: string; space: string; kind: string }
export type Audit = { action: string; object: string; detail?: Record<string, unknown> }
// A cloned session scopes a receipt to one mutation. The receipt and the mutation share the same
// SQL transaction; an uncertain response can therefore be resolved by reading the receipt.
type Attachment = { accept?: (ops:Op[]) => boolean; ops: (mutation: Op[]) => Op[]; fences?: Row[]; audits?: Audit[] }
const attachments = new WeakMap<Session, Attachment>()
export function withCommitAttachment(session: Session, attachment: Attachment): Session {
 const scoped = { ...session }; attachments.set(scoped, attachment); return scoped
}
export async function maybe<T = any>(env: Bindings, kind: string, key: string): Promise<Row<T> | null> { const r = await env.DB.prepare('SELECT * FROM chest_records WHERE id=? AND kind=?').bind(key, kind).first(); return r ? decode<T>(r) : null }
export async function where<T = any>(env: Bindings, kind: string, path: string, value: string): Promise<Row<T>[]> { return (await env.DB.prepare(`SELECT * FROM chest_records WHERE kind=? AND json_extract(payload,?)=? ORDER BY id`).bind(kind, path, value).all()).results.map(decode<T>) }
export const spaceItems = (env: Bindings, space: string) => where<Item>(env, 'item', '$.space', space)
// Without a session (a public link or file request) `by` names the audit actor.
export async function commit(env: Bindings, actor: Session | null, ops: Op[], { fences = [], changes = [], audits = [], preconditions = [], statements = [], by = 'chest:system' }: { fences?: Row[]; changes?: Change[]; audits?: Audit[]; preconditions?: { sql: string; params: unknown[] }[]; statements?: { sql: string; params: unknown[] }[]; by?: string } = {}) {
 const attachment = actor && attachments.get(actor)
 if (attachment && (!attachment.accept || attachment.accept(ops))) {
  attachments.delete(actor)
  ops = [...ops, ...attachment.ops(ops)]; fences = [...fences, ...attachment.fences ?? []]; audits = [...audits, ...attachment.audits ?? []]
 }
 const events=integrationEventOps(ops,changes,audits)
 ops=[...ops,...events];statements=[...statements,...integrationEventStatements(events)]
 const statement = (sql: string, params: unknown[] = []) => env.DB.prepare(sql).bind(...params)
 const written = new Set(ops.map(o => o.row.id)), predicates = [...(actor ? [sessionPredicate(actor)] : []), ...fences.filter(f => !written.has(f.id)).map(snapshot), ...ops.map(o => o.previous ? snapshot(o.previous) : { sql: 'NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?)', params: [o.row.id] })]
 const redact=await (await import('../audit/privacy')).identityRedactor(env)
 const at = now(), who = await redact(actor?.operator.email ?? by)
 const auditRows=await Promise.all(audits.map(async a=>({...a,detail:await redact(JSON.stringify(facts({version:ops.find(o=>o.row.id===a.object)?.row.payload?.current??null,...a.detail},actor?`${actor.kind}:${actor.operator.role}`:by)))})))
 const quotas = storageGuards(ops), warnings = await warningPublication(env,ops)
 try { await env.DB.batch([
  ...predicates.map(p => statement(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`, p.params)),
  ...ops.filter(o=>!o.remove).flatMap(o=>erasurePublication(o.row,o.previous)).map(p=>statement(p.sql,p.params)),
  ...quotas.map(p => statement(p.sql, p.params)),
  ...preconditions.map(p=>statement(p.sql,p.params)),
  ...ops.map(o => o.remove ? statement('DELETE FROM chest_records WHERE id=?', [o.row.id]) : o.previous ? statement('UPDATE chest_records SET payload=?,revision=? WHERE id=?', [JSON.stringify(o.row.payload), o.row.revision, o.row.id]) : statement('INSERT INTO chest_records(payload,revision,id,kind) VALUES(?,?,?,?)', [JSON.stringify(o.row.payload), o.row.revision, o.row.id, o.row.kind])),
  ...changes.map(c => statement('INSERT INTO chest_changes(item,space,kind,at) VALUES(?,?,?,?)', [c.item, c.space, c.kind, at])),
  ...auditRows.map(a => statement('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)', [id(), who, a.action, a.object, a.detail, at])),
  ...statements.map(x => statement(x.sql, x.params)),
  ...warnings.statements.map(x => statement(x.sql,x.params)),
  statement('DELETE FROM chest_assert'),
  ...(quotas.length ? [statement('DELETE FROM chest_storage_assert')] : []),
 ]) } catch (error) {
  if (String(error).includes('storage_limit_exceeded')) {
   for(const key of chargedSpaces(ops)){const space=await maybe(env,'space',key);if(!space)continue;const q=await storageView(env,space);if(q.limitBytes!==null&&await proposedUsage(env,ops,key)>Math.max(q.limitBytes,q.usedBytes))throw new StorageRefusal(q.scope,q.limitBytes,q.usedBytes,key)}
   throw new ChestError('storage_limit_exceeded',413)
  }
  throw error
 }
 await warnings.deliver()
}
export const fresh = <T>(kind: string, payload: T, key: string = id()): Row<T> => ({ id: key, kind, payload, revision: id() })
export const next = <T>(row: Row<T>, payload: T): Row<T> => ({ ...row, payload, revision: id() })
