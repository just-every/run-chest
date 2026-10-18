import { requireAdmin } from '../administration/roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, type Group } from '../model'
import { list } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { digest } from '../blobs'
export const viewActions = new Set(['item.read','document.read','version.download','version.preview','sync.hydrate','link.view','link.preview','link.download','link.password.refused','link.guest.verified'])
const viewAction = (action: string) => viewActions.has(action) || action.startsWith('public.') || /^get\.(items|documents)\./.test(action)
export type ViewPolicy = { enabled: boolean; groups: string[] }
export async function privacy(env: Bindings, email: string) {
 return { policy: (await maybe<ViewPolicy>(env, 'audit-policy', 'audit:policy'))?.payload ?? { enabled: true, groups: [] }, hidden: !!(await maybe<{ hidden: boolean }>(env, 'audit-prefs', `audit:prefs:${email}`))?.payload.hidden }
}
export async function savePrivacy(env: Bindings, s: Session, input: any) {
 const organization = input.scope === 'organization', key = organization ? 'audit:policy' : `audit:prefs:${s.operator.email}`, kind = organization ? 'audit-policy' : 'audit-prefs'
 if (organization) await requireAdmin(env,s,'sharing-security')
 const bool = (v: any) => v === true || v === 'true'
 const old = await maybe(env, kind, key)
 const groups = Array.isArray(input.groups) ? input.groups : typeof input.groups === 'string' ? input.groups.split(',').map((v: string) => v.trim()).filter(Boolean) : []
 if (organization) { const known = new Set((await list(env, 'group')).map(g => g.id)); insist(groups.every((v: any) => typeof v === 'string' && known.has(v)), 'invalid_group') }
 const payload = organization ? { enabled: bool(input.enabled), groups: [...new Set(groups)] } : { hidden: bool(input.hidden) }
 const row = old ? next(old, payload) : fresh(kind, payload, key)
 await commit(env, s, [{ row, ...(old ? { previous: old } : {}) }], { audits: [{ action: 'audit.privacy', object: organization ? 'organization' : s.operator.email, detail: { before: old?.payload ?? null, after: payload } }] })
 return privacy(env, s.operator.email)
}
export async function viewFilter(env: Bindings, editor: boolean, manager: boolean) {
 const policy = (await privacy(env, '')).policy, hidden = new Set((await list<{ hidden: boolean }>(env, 'audit-prefs')).filter(r => r.payload.hidden).map(r => r.id.slice('audit:prefs:'.length)))
 for (const g of await list<Group>(env, 'group')) if (policy.groups.includes(g.id)) for (const member of g.payload.members) hidden.add(member)
 return (r: any) => {
  if (!viewAction(r.action)) return r
  if (!editor || !policy.enabled || hidden.has(r.actor)) return null
  if (!manager && (r.action.startsWith('link.') || /via file request$/.test(r.actor))) return { ...r, actor: 'Link visitor' }
  return r
 }
}
export async function eraseAuditIdentity(env: Bindings, s: Session, input: any) {
 insist(s.operator.role === 'owner', 'owner_required', 403)
 const email = String(input.email ?? '').trim().toLowerCase(); insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && input.confirm === email, 'confirm_identity')
 const hash = await digest(new TextEncoder().encode(email)), alias = `Erased person ${hash.slice(0, 12)}`
 const key = `audit:erased:${hash}`
 if (!await maybe(env, 'audit-erased', key)) await commit(env, s, [{ row: fresh('audit-erased', { alias }, key) }], { audits: [{ action: 'audit.identity.erase', object: alias, detail: { outcome: 'anonymized' } }] })
 // All retained actions remain. Keep a one-way tombstone to anonymize later events from the same identity too.
 const redact=await identityRedactor(env)
 for(const event of (await env.DB.prepare('SELECT id,actor,object_id,detail FROM chest_audit').all()).results as any[]) {
  const actor=await redact(event.actor),object=await redact(event.object_id),detail=await redact(event.detail)
  if(actor!==event.actor||object!==event.object_id||detail!==event.detail)await env.DB.prepare('UPDATE chest_audit SET actor=?,object_id=?,detail=? WHERE id=?').bind(actor,object,detail,event.id).run()
 }
 return { anonymized: true, alias }
}
export async function identityRedactor(env: Bindings) {
 const tombstones = new Map((await list<{ alias: string }>(env, 'audit-erased')).map(r => [r.id.slice('audit:erased:'.length), r.payload.alias]))
 const cache = new Map<string, string>()
 return async (value: string) => {
  const emails = [...new Set(value.match(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])]
  for (const email of emails) {
   if (!cache.has(email)) cache.set(email, tombstones.get(await digest(new TextEncoder().encode(email.toLowerCase()))) ?? email)
   value = value.split(email).join(cache.get(email)!)
  }
  return value
 }
}
