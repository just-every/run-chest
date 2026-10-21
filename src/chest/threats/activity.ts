import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { decode, get } from '../store'
import { ChestError, id, insist, now, text } from '../model'
import { digest } from '../blobs'
import { commit, fresh, maybe, next } from '../files/repo'
import type { Who } from '../files/access'
import { canAdmin, requireAdmin } from '../administration/roles'
import { raise } from './alerts'
import { effective, ruleText, threatPolicy } from './policy'
import type { Alert, Pause, Subject } from './model'
// Mass downloads and deletions are counted per account and, separately, per device or token, over the policy window.
// Crossing a rule alerts security admins once per window; with pause chosen, the request that crosses it is refused,
// and the device or token (checked first) or the account's downloads and deletions stay paused until an admin resumes
// them. A resume starts a fresh count. Pausing deletes nothing: files, versions, audit and alerts all stay as evidence.
export class Paused extends ChestError { constructor(public rule: string) { super('activity_paused', 423) } }
export function subjects(s: Session): Subject[] {
 const account: Subject = { type: 'account', id: s.operator.email, email: s.operator.email }, device = (s as any).device as string | undefined
 if (device) return [{ type: 'device', id: device, email: s.operator.email }, account]
 if (String(s.kind) === 'integration') return [{ type: 'token', id: s.id.slice('integration:'.length), email: s.operator.email }, account]
 return [account]
}
const source = (x: Subject) => x.type === 'account' ? 'account' : `${x.type}:${x.id}`
export const pauseKey = async (x: Subject) => `threat-pause:${x.type}:${await digest(new TextEncoder().encode(x.id))}`
async function pauseOf(env: Bindings, x: Subject) { return maybe<Pause>(env, 'threat-pause', await pauseKey(x)) }
async function activePause(env: Bindings, x: Subject) { const p = await pauseOf(env, x); return p && !p.payload.resumedAt ? p : null }
// Devices and tokens check on every request; accounts on every download and deletion.
export async function assertActive(env: Bindings, s: Session, kinds: 'source' | 'activity') {
 for (const x of subjects(s)) { if (kinds === 'source' && x.type === 'account') continue; const p = await activePause(env, x); if (p) throw new Paused(p.payload.rule) }
}
type Kind = 'downloads' | 'deletions'
async function tally(env: Bindings, x: Subject, kind: Kind, since: number, item: string) {
 const by = x.type === 'account' ? ['actor', x.email] : ['source', source(x)]
 return (await env.DB.prepare(`SELECT COUNT(DISTINCT item) n, COALESCE(SUM(bytes),0) bytes, COALESCE(MAX(item=?),0) seen FROM chest_activity WHERE ${by[0]}=? AND kind=? AND at>?`).bind(item, by[1], kind, since).first<{ n: number; bytes: number; seen: number }>())!
}
async function alerted(env: Bindings, x: Subject, kind: Kind, since: string) {
 return !!await env.DB.prepare("SELECT 1 FROM chest_records WHERE kind='threat-alert' AND json_extract(payload,'$.kind')=? AND json_extract(payload,'$.subject.type')=? AND json_extract(payload,'$.subject.id')=? AND json_extract(payload,'$.at')>=?").bind(kind, x.type, x.id, since).first()
}
async function note(env: Bindings, s: Session, w: Who, kind: Kind, item: string, size: number) {
 await assertActive(env, s, 'activity')
 const policy = await threatPolicy(env), rules = effective(policy, w.groups), minutes = rules.windowMinutes, window = Date.now() - minutes * 60_000
 const rule = kind === 'downloads' ? rules.downloads : rules.deletions, label = ruleText(kind, rule, minutes)
 for (const x of subjects(s)) {
  const existing = await pauseOf(env, x), since = Math.max(window, existing?.payload.resumedAt ? Date.parse(existing.payload.resumedAt) : 0), windowStart = new Date(since).toISOString()
  const t = await tally(env, x, kind, since, item), count = t.n + (t.seen ? 0 : 1), bytes = t.bytes + size
  const crossed = kind === 'downloads' ? count > rules.downloads.files || bytes > rules.downloads.bytes : count > rules.deletions.items
  if (!crossed) continue
  const pause = rule.action === 'pause'
  if (!await alerted(env, x, kind, windowStart)) {
   const alert: Alert = { kind, rule: label, subject: x, count, bytes: kind === 'downloads' ? bytes : undefined, windowStart, action: rule.action, paused: pause, at: now() }
   const pauseRow = pause ? fresh<Pause>('threat-pause', { subject: x, rule: label, alert: null, by: 'chest:threats', at: now(), reason: 'Threshold reached' }, await pauseKey(x)) : null
   await raise(env, s, alert, { ops: pauseRow ? [existing ? { row: next(existing, pauseRow.payload), previous: existing } : { row: pauseRow }] : [], audits: pause ? [{ action: 'threats.pause', object: pauseRow!.id, detail: { subject: x, rule: label } }] : [] })
  }
  if (pause) throw new Paused(label)
 }
 await env.DB.prepare('INSERT INTO chest_activity(id,actor,source,kind,item,bytes,at) VALUES(?,?,?,?,?,?,?)').bind(id(), s.operator.email, source(subjects(s)[0]), kind, item, size, Date.now()).run()
}
export const noteDownload = (env: Bindings, s: Session, w: Who, item: string, size: number) => note(env, s, w, 'downloads', item, size)
export const noteDeletion = (env: Bindings, s: Session, w: Who, item: string) => note(env, s, w, 'deletions', item, 0)
export async function pruneActivity(env: Bindings) { await env.DB.prepare('DELETE FROM chest_activity WHERE at<?').bind(Date.now() - 86_400_000).run() }
// An admin pauses a device or token by hand (for example while investigating), or resumes any pause.
export async function pauseSubject(env: Bindings, s: Session, input: any) {
 insist(['device', 'token', 'account'].includes(input.type), 'invalid_subject'); const subjectId = text(input.id, 'subject', 200)
 let email = subjectId
 if (input.type === 'device') email = (await get<any>(env, 'device', subjectId)).payload.owner
 if (input.type === 'token') email = (await get<any>(env, 'integration-grant', subjectId)).payload.user
 await requireAdmin(env, s, 'sharing-security', email)
 const x: Subject = { type: input.type, id: subjectId, email }, key = await pauseKey(x), existing = await maybe<Pause>(env, 'threat-pause', key)
 insist(!existing || existing.payload.resumedAt, 'already_paused', 409)
 const payload: Pause = { subject: x, rule: 'Paused by an admin', alert: null, by: s.operator.email, at: now(), reason: text(input.reason, 'reason', 500) }
 await commit(env, s, [existing ? { row: next(existing, payload), previous: existing } : { row: fresh<Pause>('threat-pause', payload, key) }], { audits: [{ action: 'threats.pause', object: key, detail: { subject: x, reason: payload.reason } }] })
 return { paused: key }
}
export async function resumeSubject(env: Bindings, s: Session, key: string) {
 const row = await get<Pause>(env, 'threat-pause', key); insist(!row.payload.resumedAt, 'not_paused', 409)
 await requireAdmin(env, s, 'sharing-security', row.payload.subject.email)
 await commit(env, s, [{ row: next(row, { ...row.payload, resumedAt: now(), resumedBy: s.operator.email }), previous: row }], { audits: [{ action: 'threats.resume', object: key, detail: { subject: row.payload.subject, rule: row.payload.rule } }] })
 return { resumed: key }
}
export async function historyView(env: Bindings, s: Session) {
 const alerts = (await env.DB.prepare("SELECT * FROM chest_records WHERE kind='threat-alert' ORDER BY json_extract(payload,'$.at') DESC LIMIT 300").all()).results.map(decode<Alert>)
 const pauses = (await env.DB.prepare("SELECT * FROM chest_records WHERE kind='threat-pause' ORDER BY json_extract(payload,'$.at') DESC").all()).results.map(decode<Pause>)
 const visible = async (email: string | null | undefined) => canAdmin(env, s, 'sharing-security', email ?? undefined)
 const out = { alerts: [] as (Alert & { id: string })[], pauses: [] as (Pause & { id: string })[] }
 for (const a of alerts) if (await visible(a.payload.subject?.email)) out.alerts.push({ id: a.id, ...a.payload })
 for (const p of pauses) if (await visible(p.payload.subject.email)) out.pauses.push({ id: p.id, ...p.payload })
 return out
}
