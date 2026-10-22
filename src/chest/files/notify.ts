import { attempt } from '../audit/journal'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { operatorMail } from '../../mail.server.mjs'
import { now, type Person, type Row } from '../model'
import { commit, fresh, maybe, next } from './repo'
import type { Notice } from './model'
import { personName } from '../names'
// In-app notices are records; each is also emailed through the installation's mail provider. The notice keeps the
// provider's real outcome: accepted, suppressed (local runs), not configured, or the failure code.
export const notice = (to: string, type: string, item: string | null, from: string, message: string, request?: string) => fresh<Notice>('notice', { to, type, item, from, message, at: now(), read: false, email: 'queued', ...(request ? { request } : {}) })
export const MAIL_MANAGED_LINE = 'Not available yet on RER Managed hosting: email notifications need an outbound connection.'
// `from` is the sender's name, or their address before they set one.
function compose(env: Bindings, n: Notice, from: string) {
 const base = env.AUTH_ORIGIN, open = n.item ? `${base}/app/items/${n.item}` : `${base}/app/files`
 if (n.type === 'security.activity') return {subject:'Chest mass activity alert',text:`${n.message}\n\nReview: ${base}/app/upload-protection`}
 if (n.type === 'security.incident') return {subject:'Chest paused suspect uploads',text:`${n.message}\n\nReview: ${base}/app/upload-protection`}
 if (n.type.startsWith('ownership')) return { subject: n.type === 'ownership.request' ? `${from} offered you ownership` : 'Ownership request updated', text: `${n.message}\n\nOpen the ownership request: ${base}/app/ownership/${n.request}` }
 if(n.type==='filing')return {subject:'Chest filed a file',text:`${n.message}\n\nReview the evidence and Undo in Chest: ${base}/app/filing`}
 if (n.type === 'link.repair') return { subject: 'Chest link repair', text: `${n.message}\n\nReview the record and request owner-approved Undo: ${base}/app/links` }
 if (n.type.startsWith('signature.')) return { subject: n.message.slice(0, 120), text: `${n.message}\n\nOpen the request: ${base}/app/items/${n.item}` }
 if (n.type === 'share') return { subject: `${from} shared a file with you`, text: `${n.message}\n\nOpen it in Chest: ${open}\nFind everything shared with you: ${base}/app/shared` }
 if (n.type === 'request') return { subject: `${from} asked for access`, text: `${n.message}\n\nApprove or decline: ${base}/app/requests/${n.request}` }
 if (n.type === 'request.decision' || n.type === 'request.expired') return { subject: 'Your access request', text: `${n.message}\n\n${open}` }
 if (n.type === 'file-request.upload') return { subject: 'New files from your file request', text: `${n.message}\n\nOpen them in Chest: ${open}` }
 if (n.type === 'share.expiring') return { subject: 'Access expires tomorrow', text: `${n.message}\n\nOpen the item to extend access: ${open}` }
 if (n.type === 'comment') return { subject: `${from} commented on your file`, text: `${n.message}\n\nOpen the comment in Chest: ${open}` }
 return { subject: 'Chest notice', text: `${n.message}\n\n${open}` }
}
export async function deliver(env: Bindings, actor: Session | null, rows: Row<Notice>[]) {
 const managed = String(env.MAIL_PROVIDER) === 'rer', sender = managed ? undefined : operatorMail(env), updated: { row: Row<Notice>; previous: Row<Notice> }[] = []
 for (const row of rows) {
  let outcome = managed ? MAIL_MANAGED_LINE : 'not_configured'
  if (sender && env.MAIL_FROM) {
   try { const message = compose(env, row.payload, personName((await maybe<Person>(env, 'person', row.payload.from))?.payload.name, row.payload.from)), result = await attempt(env,actor?.operator.email ?? 'chest:notifications','provider.mail',row.payload.item ?? row.id,{authority:actor?`${actor.kind}:${actor.operator.role}`:'notice delivery',notice:row.id,provider:String(env.MAIL_PROVIDER)},()=>sender.send({ deliveryId: row.id, from: env.MAIL_FROM!, to: [row.payload.to], subject: message.subject, text: message.text, html: `<p>${message.text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`).replace(/\n/g, '<br>')}</p>`, headers: { 'Auto-Submitted': 'auto-generated' } })); outcome = result.status === 'development' ? 'suppressed' : `${result.status}${result.providerMessageId ? ':' + result.providerMessageId : ''}` }
   catch (e: any) { outcome = `failed:${typeof e?.code === 'string' ? e.code : 'send_error'}` }
  }
  updated.push({ row: next(row, { ...row.payload, email: outcome }), previous: row })
 }
 if (updated.length) await commit(env, actor, updated)
 return updated.map(change => change.row)
}
