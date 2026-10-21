import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { commit, fresh, type Audit, type Op } from '../files/repo'
import { deliver, notice } from '../files/notify'
import { principalCanAdmin } from '../administration/roles'
import type { Alert } from './model'
// Alerts go to the owner, super admins and admins whose security scope covers the account involved, in Chest and
// by email. They name the rule, never a file name: an admin role alone opens no content.
export async function securityAdmins(env: Bindings, email: string | null) {
 const operators = (await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active' ORDER BY email").all<{ email: string }>()).results, out: string[] = []
 for (const p of operators) if (await principalCanAdmin(env, p.email, 'sharing-security', email ?? undefined)) out.push(p.email)
 return out
}
const subjectText = (a: Alert) => !a.subject ? '' : a.subject.type === 'account' ? a.subject.email : `${a.subject.type} ${a.subject.id} of ${a.subject.email}`
export const alertText = (a: Alert) => a.kind === 'malware' ? `Malware found in an original uploaded by ${a.subject?.email ?? 'an unknown sender'}: ${a.detail}. The original is quarantined; no door serves it until an authorized reviewer releases it.`
 : a.kind === 'classification' ? `A file labelled ${a.detail} arrived from ${a.subject?.email ?? 'an unknown sender'}. ${a.action === 'restrict' ? 'Sharing outside the organization is refused for it.' : 'It is recorded as sensitive.'}`
 : `${a.rule} was exceeded by ${subjectText(a)}: ${a.count} ${a.kind === 'downloads' ? 'files' : 'items'}${a.kind === 'downloads' ? ` (${a.bytes} bytes)` : ''} since ${a.windowStart}.${a.paused ? ` ${a.subject?.type === 'account' ? 'Their downloads and deletions are' : 'The ' + a.subject?.type + ' is'} paused until an admin resumes them.` : ''}`
export async function raise(env: Bindings, s: Session | null, alert: Alert, more: { ops?: Op[]; audits?: Audit[]; notify?: string[] } = {}) {
 const row = fresh<Alert>('threat-alert', alert), to = [...new Set([...await securityAdmins(env, alert.subject?.email ?? null), ...more.notify ?? []])]
 const notices = to.map(email => notice(email, 'security.threat', null, s?.operator.email ?? 'chest:threats', alertText(alert)))
 await commit(env, s, [{ row }, ...more.ops ?? [], ...notices.map(n => ({ row: n }))], { audits: [{ action: 'threats.alert', object: row.id, detail: { kind: alert.kind, rule: alert.rule, subject: alert.subject, count: alert.count ?? null, bytes: alert.bytes ?? null, action: alert.action, paused: alert.paused } }, ...more.audits ?? []], by: 'chest:threats' })
 await deliver(env, s, notices)
 return row
}
