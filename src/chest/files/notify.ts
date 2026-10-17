import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { operatorMail } from '../../mail.server.mjs'
import { now, type Row } from '../model'
import { commit, fresh, next } from './repo'
import type { Notice } from './model'
// In-app notices are records; each is also emailed through the installation's mail provider. The notice keeps the
// provider's real outcome: accepted, suppressed (local runs), not configured, or the failure code.
export const notice = (to: string, type: string, item: string | null, from: string, message: string, request?: string) => fresh<Notice>('notice', { to, type, item, from, message, at: now(), read: false, email: 'queued', ...(request ? { request } : {}) })
function compose(env: Bindings, n: Notice) {
 const base = env.AUTH_ORIGIN, open = n.item ? `${base}/app/items/${n.item}` : `${base}/app/files`
 if (n.type === 'share') return { subject: `${n.from} shared a file with you`, text: `${n.message}\n\nOpen it in Chest: ${open}\nFind everything shared with you: ${base}/app/shared` }
 if (n.type === 'request') return { subject: `${n.from} asked for access`, text: `${n.message}\n\nApprove or decline: ${base}/app/requests/${n.request}` }
 if (n.type === 'request.decision' || n.type === 'request.expired') return { subject: 'Your access request', text: `${n.message}\n\n${open}` }
 if (n.type === 'file-request.upload') return { subject: 'New files from your file request', text: `${n.message}\n\nOpen them in Chest: ${open}` }
 if (n.type === 'share.expiring') return { subject: 'Access expires tomorrow', text: `${n.message}\n\nOpen the item to extend access: ${open}` }
 return { subject: 'Chest notice', text: `${n.message}\n\n${open}` }
}
export async function deliver(env: Bindings, actor: Session | null, rows: Row<Notice>[]) {
 const sender = operatorMail(env), updated: { row: Row<Notice>; previous: Row<Notice> }[] = []
 for (const row of rows) {
  let outcome = 'not_configured'
  if (sender && env.MAIL_FROM) {
   try { const message = compose(env, row.payload), result = await sender.send({ deliveryId: row.id, from: env.MAIL_FROM, to: [row.payload.to], subject: message.subject, text: message.text, html: `<p>${message.text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`).replace(/\n/g, '<br>')}</p>`, headers: { 'Auto-Submitted': 'auto-generated' } }); outcome = result.status === 'development' ? 'suppressed' : `${result.status}${result.providerMessageId ? ':' + result.providerMessageId : ''}` }
   catch (e: any) { outcome = `failed:${typeof e?.code === 'string' ? e.code : 'send_error'}` }
  }
  updated.push({ row: next(row, { ...row.payload, email: outcome }), previous: row })
 }
 if (updated.length) await commit(env, actor, updated)
}
