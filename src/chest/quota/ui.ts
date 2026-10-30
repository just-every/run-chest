import { canAdmin } from '../administration/roles'
import { bytes, card, esc, field, form, gigabytes, hidden, select } from '../ui-shared'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { quotas } from './api'
import { totalStorage } from './storage'

type Storage = { id: string; usedBytes: number; limitBytes: number | null; scope?: 'user' | 'space'; rule?: string }
const limitField = (value: number | null, label = 'Storage limit in GB (blank means unlimited)') => field(label, 'limitGb', gigabytes(value), 'number', false).replace('type="number"', 'type="number" min="0" step="any"')
const retained = 'Current files, retained versions and trash count. Shared files count in their owning area, never against recipients.'
const exactBytes = (n: number) => bytes(n)
const ruleText = (d: Storage) => d.rule ? `<p class="quiet">Effective rule: ${esc(d.rule)}</p>` : ''
export function storagePanel(d: Storage, owner = false, returnTo = `/app/spaces/${d.id}`) {
 const scope = d.scope === 'user' ? 'personal area' : 'space', title = d.scope === 'user' ? 'Personal storage' : 'Space storage'
 const usage = `${exactBytes(d.usedBytes)} used${d.limitBytes === null ? ' · no storage limit' : ` of ${exactBytes(d.limitBytes)}`}`
 const full = d.limitBytes !== null && d.usedBytes >= d.limitBytes
 const warning = full ? `<p role="status">This ${scope} has reached its storage limit. New uploads, versions, copies, incoming moves, editor saves and restores that add bytes are refused. ${esc(exactBytes(d.usedBytes))} used; ${esc(exactBytes(d.limitBytes!))} limit. Ask a service-settings admin to raise the limit or permanently erase retained files. Trashing alone does not free storage. Existing files can still be viewed, downloaded, shared and commented on.</p>` : d.limitBytes !== null && d.usedBytes >= d.limitBytes * .9 ? `<p role="status">This ${scope} is at ${Math.floor(d.usedBytes / d.limitBytes * 100)}% of its storage limit. Plan to free retained storage or ask an admin to raise the limit.</p>` : ''
 const settings = owner ? form(`/spaces/${d.id}/quota`, field('Storage limit in GB (leave blank for no limit)', 'storageLimitGb', gigabytes(d.limitBytes), 'number', false).replace('type="number"', 'type="number" min="0" step="any"') + `<p class="quiet">Before a new or lower limit is saved, review and confirm any areas already over it. ${d.scope === 'user' ? 'Leave blank to give this person unlimited storage.' : 'Leave blank for an explicit unlimited override.'}</p>`, 'Save storage limit', returnTo, { buttonClass: 'btn btn-outline btn-block' }) : ''
 return card(title, `<p>${esc(usage)}</p>${ruleText(d)}<p class="quiet">${retained}</p>${warning}${settings}`, 'side-card')
}
export function quotaPage(d: any) {
 return `<div class="page-head"><h1>${esc(d.name)} storage</h1><p class="lede">Service-settings admins set retained storage limits. A limit below current usage preserves existing originals and refuses writes that add bytes.</p></div>${storagePanel(d, true, `/app/spaces/${d.id}/quota`)}<p><a class="link" href="/app/storage">All storage policies</a></p>`
}
export function quotasPage(d: { rows: any[]; rules: any[]; groups: any[]; people: any[]; organizationAllowed?: boolean }) {
 const rules = d.rules.map(r => r.payload)
 const current = (scope: string) => rules.find(r => r.scope === scope)?.limitBytes ?? null
 const policyForm = (scope: string, body: string, button: string, value: number | null = null) => form('/quota-policy', hidden('scope', scope) + body + limitField(value), button, '/app/storage', {buttonClass:'btn btn-outline btn-block'})
 const defaultForms = card('Personal-area default', policyForm('personal-default', '<p class="quiet">Applies when no limited group or per-user override takes precedence.</p>', 'Save personal default', current('personal-default')))
 + card('Space default', policyForm('space-default', '<p class="quiet">Inherited by spaces without a per-space override. Space creation settings can set a different starting limit for new spaces.</p>', 'Save space default', current('space-default')))
 const groupForm = card('Group user limits', '<p class="quiet">A group limit overrides the personal-area default. For people in several limited groups, the largest group limit wins. Blank removes this group limit.</p>' + (d.groups.length ? policyForm('group', select('Group', 'target', d.groups.map(g => ({id:g.id,label:g.payload.name}))), 'Save group limit') : '<p class="quiet">Create a group in People &amp; settings first.</p>'))
 const userForm = card('Per-user override', '<p class="quiet">A user override takes precedence over group limits and the personal-area default. Blank explicitly gives this person unlimited storage.</p>' + (d.people.length ? policyForm('user', select('Person', 'target', d.people.map(p => ({id:p.id,label:`${p.payload.name} · ${p.id}`}))), 'Save user limit') : '<p class="quiet">No people available in your admin scope.</p>'))
 const spaces = d.rows.filter(r => r.scope === 'space')
 const spaceForm = card('Per-space override', '<p class="quiet">A space override takes precedence over the space default. Blank removes the override.</p>' + (spaces.length ? policyForm('space', select('Space', 'target', spaces.map(r => ({id:r.id,label:r.name}))), 'Save space limit') : '<p class="quiet">No team spaces available in your admin scope.</p>'))
 const names = new Map([...d.groups, ...d.people].map(r => [r.id, r.payload.name]))
 const saved = rules.length ? `<ul class="events">${rules.map(r => `<li><strong>${esc(({'personal-default':'Personal default','space-default':'Space default',group:'Group limit',user:'User override'} as Record<string,string>)[r.scope]??r.scope)}${r.target ? ` · ${esc(names.get(r.target) ?? d.rows.find(v => v.id === r.target)?.name ?? r.target)}` : ''}</strong><p>${r.limitBytes === null ? 'Unlimited' : esc(exactBytes(r.limitBytes))}</p></li>`).join('')}</ul>` : '<p class="quiet">No storage policies have been set.</p>'
 const usage = d.rows.length ? `<ul class="rows">${d.rows.map(r => `<li class="row-tabbed"><div class="row-card person"><div class="person-facts"><strong><a class="link" href="/app/spaces/${esc(r.id)}/quota">${esc(r.name)}${r.scope === 'user' ? ` · ${esc(r.owner)}` : ''}</a></strong><span class="mono">${esc(exactBytes(r.usedBytes))} used · ${r.limitBytes === null ? 'no limit' : `${esc(exactBytes(r.limitBytes))} limit`}</span><p class="quiet">${r.scope === 'user' ? 'Personal area' : 'Team space'} · Effective rule: ${esc(r.rule)}</p>${r.limitBytes !== null && r.usedBytes >= r.limitBytes ? '<p role="status">Storage limit reached. Writes that add bytes are refused.</p>' : ''}</div></div></li>`).join('')}</ul>` : '<p class="quiet">No storage areas available in your admin scope.</p>'
 return `<div class="page-head"><h1>Storage limits</h1><p class="lede">Set limits for personal areas and team spaces. ${retained}</p></div><section class="card"><h2>Before saving</h2><p>A new or lower limit lists every affected user or space already over it, with current usage. Review and confirm before it takes effect. No originals are deleted. At 90%, the user or space managers receive an in-app and email warning.</p></section><div class="form-grid card-wide">${d.organizationAllowed === false ? '' : defaultForms}${groupForm}${userForm}${spaceForm}</div>${card('Saved policies', saved, 'card-wide')}<h2 class="section-title">Effective storage limits</h2>${usage}`
}
export async function quotaAdminCard(env: Bindings, s: Session) {
 const rows=await quotas(env,s),total=await canAdmin(env,s,'service-settings')?await totalStorage(env):rows.reduce((n,r)=>n+r.usedBytes,0)
 return card('Space storage', `<p>${esc(bytes(total))} kept across all spaces. Earlier versions and trash count; identical originals count once in this total and once in each area retaining them.</p><ul class="events">${rows.map(d => `<li><a class="link" href="/app/spaces/${esc(d.id)}/quota">${esc(d.name)}${d.kind === 'personal' ? ` · ${esc(d.owner)}` : ''}</a> · ${esc(bytes(d.usedBytes))}${d.limitBytes === null ? ' · no limit' : ` of ${esc(bytes(d.limitBytes))}`}${'rule' in d ? ` · ${esc(d.rule)}` : ''}</li>`).join('')}</ul><p><a class="btn btn-outline" href="/app/storage">Manage storage limits</a></p>`)
}
