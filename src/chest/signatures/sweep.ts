import type { Bindings } from '../../auth.server'
import { personName } from '../names'
import { now, type Person } from '../model'
import { maybe } from '../files/repo'
import { cancelled, reminder, tell } from './messages'
import { event, getRequest, mutate, SYSTEM } from './store'
import { KIND } from './store'
import type { SignRequest } from './model'
const day = 86_400_000
// An expired request is closed on the next read or sweep: the source version stays as it was, nothing is filed.
export async function settle(env: Bindings, key: string) {
 const row = await getRequest(env, key)
 if (row.payload.status !== 'pending' || !row.payload.expires || Date.parse(row.payload.expires) > Date.now()) return row
 const waiting = row.payload.signers.filter(s => s.state === 'invited' || s.state === 'viewed' || s.state === 'waiting')
 const closed = await mutate(env, key, async r => r.payload.status !== 'pending' ? null : { payload: { ...r.payload, status: 'expired', outcome: { at: now(), status: 'expired' }, events: [...r.payload.events, event('expired', SYSTEM, { detail: `expired ${r.payload.expires}` })] }, audits: [{ action: 'signature.expire', object: r.payload.item, detail: { request: key } }], by: 'chest:signing' })
 if (closed.payload.status === 'expired' && row.payload.status === 'pending') { await tell(env, closed.payload, key, 'expired'); for (const s of waiting) await cancelled(env, closed.payload, key, s, 'expired') }
 return closed
}
// Due reminders: one per invited signer per cadence; completed, declined, voided and expired requests send none.
export async function sweepSignatures(env: Bindings) {
 const ids = (await env.DB.prepare("SELECT id FROM chest_records WHERE kind=? AND json_extract(payload,'$.status')='pending'").bind(KIND).all()).results.map((r: any) => String(r.id))
 for (const key of ids) {
  const row = await settle(env, key), p = row.payload
  if (p.status !== 'pending' || !p.reminderDays) continue
  const due = p.signers.filter(s => (s.state === 'invited' || s.state === 'viewed') && Date.parse(s.remindedAt ?? s.invitedAt ?? p.sentAt ?? p.createdAt) + p.reminderDays! * day <= Date.now())
  if (!due.length) continue
  const requester = personName((await maybe<Person>(env, 'person', p.createdBy))?.payload.name, p.createdBy)
  for (const signer of due) {
   // Claim the reminder in the record first; a second sweep sees remindedAt and sends nothing.
   const claimed = await mutate(env, key, async r => { const s = r.payload.signers.find(x => x.id === signer.id); return r.payload.status !== 'pending' || !s || !(s.state === 'invited' || s.state === 'viewed') || Date.parse(s.remindedAt ?? s.invitedAt ?? r.payload.sentAt ?? r.payload.createdAt) + p.reminderDays! * day > Date.now() ? null : { payload: { ...r.payload, signers: r.payload.signers.map(x => x.id === signer.id ? { ...x, remindedAt: now() } : x), events: [...r.payload.events, event('reminder', SYSTEM, { signer: signer.id, email: signer.email })] }, by: 'chest:signing' } })
   if (claimed.payload.signers.find(x => x.id === signer.id)?.remindedAt === signer.remindedAt) continue
   const mail = await reminder(env, claimed.payload, key, claimed.payload.signers.find(x => x.id === signer.id)!, requester)
   await mutate(env, key, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(x => x.id === signer.id ? { ...x, mail } : x) } }))
  }
 }
}
