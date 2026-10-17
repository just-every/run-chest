import { card, esc, field, form } from '../ui-shared'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { quotas } from './api'
import { totalStorage } from './storage'

export function storagePanel(d: { id: string; usedBytes: number; limitBytes: number | null }, owner = false, returnTo = `/app/spaces/${d.id}`) {
 const usage = `${d.usedBytes.toLocaleString('en-US')} bytes used${d.limitBytes === null ? ' · no storage limit' : ` of ${d.limitBytes.toLocaleString('en-US')} bytes`}`
 return card('Space storage', `<p>${esc(usage)}</p><p class="quiet">Earlier versions and trash count. Identical originals count once in this space.</p>${d.limitBytes !== null && d.usedBytes > d.limitBytes ? '<p role="status">This space is over its limit. Remove retained files permanently or ask the owner to raise the limit before adding new bytes.</p>' : ''}${owner ? form(`/spaces/${d.id}/quota`, field('Storage limit in bytes (leave blank for no limit)', 'storageLimitBytes', d.limitBytes === null ? '' : String(d.limitBytes), 'number', false), 'Save storage limit', returnTo, { buttonClass: 'btn btn-outline btn-block' }) : ''}`, 'side-card')
}
export function quotaPage(d: any) {
 return `<div class="page-head"><h1>${esc(d.name)} storage</h1><p class="lede">The owner sets the space's retained storage limit. A limit below current usage prevents growth and keeps existing originals.</p></div>${storagePanel(d, true, `/app/spaces/${d.id}/quota`)}<p><a class="link" href="/app/storage">All space storage</a></p>`
}
export function quotasPage(rows: any[]) {
 return `<div class="page-head"><h1>Space storage</h1><p class="lede">Set storage limits for team spaces and personal areas.</p></div><ul class="rows">${rows.map(d => `<li class="row-tabbed"><span class="tab tab-plain" aria-hidden="true"></span><div class="row-card person"><div class="person-facts"><strong><a href="/app/spaces/${esc(d.id)}/quota">${esc(d.name)}${d.kind === 'personal' ? ` · ${esc(d.owner)}` : ''}</a></strong><span class="mono">${esc(d.usedBytes.toLocaleString('en-US'))} bytes used · ${d.limitBytes === null ? 'no limit' : `${esc(d.limitBytes.toLocaleString('en-US'))} bytes limit`}</span></div></div></li>`).join('')}</ul>`
}
export async function quotaAdminCard(env: Bindings, s: Session) {
 const [rows, total] = await Promise.all([quotas(env, s), totalStorage(env)])
 return card('Space storage', `<p>${esc(total.toLocaleString('en-US'))} retained bytes across all spaces. Earlier versions and trash count; identical originals count once in this total and once in each space retaining them.</p><ul class="events">${rows.map(d => `<li><a class="link" href="/app/spaces/${esc(d.id)}/quota">${esc(d.name)}${d.kind === 'personal' ? ` · ${esc(d.owner)}` : ''}</a> · ${esc(d.usedBytes.toLocaleString('en-US'))} bytes${d.limitBytes === null ? ' · no limit' : ` of ${esc(d.limitBytes.toLocaleString('en-US'))}`}</li>`).join('')}</ul><p><a class="btn btn-outline" href="/app/storage">Manage space storage</a></p>`)
}
