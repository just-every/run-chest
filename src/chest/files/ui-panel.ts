import { esc, form, icon, when, day } from '../ui-shared'
import { eventWords } from '../ui-words'
import { fileKind, fileTile } from '../../ui/icons'
import { kindOf, people, size } from './ui-table'
// The details panel of the picked app look (340 px at the right of a folder, and beside a file's own page): the
// item's tile and name, a preview on grid paper, the Details / Versions / Sharing / Activity sections, and any
// upload of yours still going up here. Every action in it is the same form its full page posts.
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline btn-sm' }
type Named = (email: string) => string

// A preview from the file's own safe endpoints: images as themselves, Office files and text through their sandboxed
// previews (scaled to a page), anything else as a page drawn on the paper.
function preview(d: any) {
 const v = d.versions.find((v: any) => v.id === d.item.current), kind = fileKind(d.item.name, d.item.type)
 if (!v || d.item.type === 'folder') return `<div class="pv pv-empty">${fileTile(kind)}</div>`
 const bytes = `/api/chest/items/${esc(v.sourceItem || d.id)}/bytes/${esc(v.id)}`
 if (!d.can.download) return `<div class="pv pv-page"><iframe src="/api/chest/items/${esc(v.sourceItem || d.id)}/rendered-preview/${esc(v.id)}" title="Preview of ${esc(d.item.name)}" tabindex="-1" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe></div>`
 if (v.preview === 'image' && d.can.download) return `<div class="pv pv-image"><img src="${bytes}" alt="Preview of ${esc(d.item.name)}"></div>`
 if (/\.(docx|xlsx|pptx)$/i.test(v.filename)) return `<div class="pv pv-page"><iframe src="/api/chest/items/${esc(v.sourceItem || d.id)}/office-preview/${esc(v.id)}" title="Preview of ${esc(d.item.name)}" tabindex="-1" loading="lazy" sandbox></iframe></div>`
 if (v.preview === 'text') return `<div class="pv pv-page"><iframe src="${bytes}" title="Preview of ${esc(d.item.name)}" tabindex="-1" loading="lazy" sandbox></iframe></div>`
 return `<div class="pv pv-page"><div class="pv-sheet" aria-hidden="true"><span class="pv-name">${esc(d.item.name)}</span><i></i><i></i><i></i><i></i><i></i></div></div>`
}
const number = (d: any, id: string) => { const at = d.versions.findIndex((v: any) => v.id === id); return at < 0 ? 0 : d.versions.length - at }
function versions(d: any, name: Named, returnTo: string) {
 const rows = d.versions.slice(0, 3).map((v: any) => {
  const current = v.id === d.item.current, approved = d.item.approved === v.id
  const restore = !current && d.can.contribute && (!v.sourceItem || v.sourceItem === d.id) ? form(`/items/${d.id}/versions/${v.id}/restore`, '', 'Restore', returnTo, { className: 'form pv-restore', buttonClass: 'link-button' }) : ''
  return `<li class="tl${current ? ' tl-current' : ''}"><p class="tl-head"><strong>v${number(d, v.id)}</strong>${approved ? '<span class="chip chip-ok">approved</span>' : v.review?.state === 'submitted' ? '<span class="chip chip-warn">in review</span>' : current ? '<span class="quiet">current</span>' : ''}</p><div class="tl-meta"><span>${when(v.at)} <span aria-hidden="true">·</span> ${esc(name(v.actor))}</span>${restore}</div></li>`
 }).join('')
 return `<section class="ps" id="panel-versions" aria-labelledby="pv-versions"><div class="ps-head"><h3 id="pv-versions">Versions</h3><a class="link-quiet" href="/app/items/${esc(d.id)}#history">See all</a></div><ol class="timeline">${rows}</ol></section>`
}
function sharing(d: any, name: Named, returnTo: string) {
 const live = (d.publicLinks ?? []).filter((l: any) => l.state === 'active')
 const link = (l: any) => `<div class="pl"><span class="pl-icon">${icon('link')}</span><div class="pl-body"><p><strong>${l.audience === 'guests' ? 'Named guests' : l.audience === 'domain' ? `Verified ${esc(l.domain)}` : 'Link'}${l.expires ? `, expires ${day(l.expires)}` : ', no expiry'}</strong></p><p class="quiet">${l.limit === null ? `${l.downloads} download${l.downloads === 1 ? '' : 's'}` : `${l.downloads} of ${l.limit} downloads used`}</p>${l.limit === null ? '' : `<progress max="${l.limit}" value="${l.downloads}">${l.downloads} of ${l.limit}</progress>`}</div>${d.can.share ? form(`/public-links/${l.id}/revoke`, '', 'Revoke', returnTo, inline) : ''}</div>`
 const manage = `/app/items/${esc(d.id)}${d.item.type === 'folder' ? '?manage' : ''}`
 const who = [...new Set([...(d.members ?? []), ...(d.grants ?? []).map((g: any) => g.principal)])].map(email => ({ email, name: name(email) }))
 const shared = who.length ? `<a class="pl-people" href="${manage}">${people(who)}<span>Shared with ${who.length} ${who.length === 1 ? 'person' : 'people'}</span>${icon('chevron')}</a>` : ''
 const body = live.map(link).join('') + shared
 return `<section class="ps" id="panel-sharing" aria-labelledby="pv-sharing"><div class="ps-head"><h3 id="pv-sharing">Sharing</h3>${d.can.share ? `<a class="link-quiet" href="${manage}">Manage</a>` : ''}</div>${body ? `<div class="pcard">${body}</div>` : '<p class="quiet">Only people with access to this space can open it.</p>'}</section>`
}
function activity(d: any, name: Named) {
 const rows = (d.activity ?? []).filter((r: any) => !/^(get|post|put|delete|provider|automation|public)\./.test(r.action)).slice(0, 4)
 return `<section class="ps" id="panel-activity" aria-labelledby="pv-activity"><div class="ps-head"><h3 id="pv-activity">Activity</h3><a class="link-quiet" href="/app/audit?object=${esc(d.id)}">History</a></div>${rows.length ? `<ul class="pact">${rows.map((r: any) => `<li><span>${esc(name(r.actor))} ${esc(eventWords(r.action))}</span><span class="quiet">${when(r.at)}</span></li>`).join('')}</ul>` : '<p class="quiet">No activity yet.</p>'}</section>`
}
// Your uploads still going up into this folder (or as this file's next version), with Cancel.
export function recentUploads(uploads: any[], returnTo: string) {
 if (!uploads?.length) return ''
 return `<section class="ps" aria-labelledby="pv-upload"><div class="ps-head"><h3 id="pv-upload">Recent upload</h3></div>${uploads.slice(0, 2).map(u => { const pct = Math.floor(u.received * 100 / u.size); return `<div class="pcard pu" data-upload-summary="${esc(u.id)}">${fileTile(fileKind(u.name))}<div class="pu-body"><p><strong>${esc(u.name)}</strong></p><p class="quiet">Uploading… ${pct}% of ${esc(size(u.size))}</p><progress max="100" value="${pct}">${pct}%</progress></div>${form(`/uploads/${u.id}/cancel`, '', 'Cancel upload', returnTo, { className: 'form pu-cancel', buttonClass: 'icon-button' }).replace('>Cancel upload</button>', ` data-tooltip="Cancel upload" aria-label="Cancel upload of ${esc(u.name)}">${icon('close')}</button>`)}</div>` }).join('')}</section>`
}
// On the item's own page the page heading names it and the page lists its activity, so the panel starts at the
// preview and leaves Activity to the page (`head: false`).
export function detailsPanel(d: any, name: Named, o: { close?: string; returnTo: string; uploads?: any[]; children?: number; head?: boolean }) {
 const v = d.versions.find((v: any) => v.id === d.item.current), kind = kindOf(d.item.name, d.item.type)
 const where = [d.space.name, ...d.path.map((p: any) => p.name)].join(' / ')
 const facts = [['Type', kind], ...(v ? [['Size', `${size(v.size)} (${v.size.toLocaleString('en-US')} bytes)`]] : [['Contents', `${o.children ?? 0} item${o.children === 1 ? '' : 's'}`]]), ['Location', esc(where)], ...(v ? [['Modified', when(d.item.updatedAt)], ['Modified by', esc(name(v.actor))]] : []), ['Created', when(d.item.createdAt)], ['Created by', esc(name(d.item.createdBy))]]
 const tabs = `<nav class="ptabs" aria-label="Details sections"><a href="#panel-details" class="is-on">Details</a>${d.item.type === 'file' ? '<a href="#panel-versions">Versions</a>' : ''}<a href="#panel-sharing">Sharing</a>${o.head === false ? '' : '<a href="#panel-activity">Activity</a>'}</nav>`
 const head = o.head === false ? '' : `<div class="panel-head">${fileTile(fileKind(d.item.name, d.item.type))}<div><h2>${esc(d.item.name)}</h2><p class="quiet">${v ? `${esc(size(v.size))} <span aria-hidden="true">·</span> ` : ''}${esc(kind)}</p></div>${o.close ? `<a class="icon-button panel-close" href="${esc(o.close)}" aria-label="Close details" data-tooltip="Close details">${icon('close')}</a>` : ''}</div>`
 return `<aside class="panel" aria-label="Details of ${esc(d.item.name)}">${head}
 ${d.item.type === 'file' ? preview(d) : ''}${tabs}<section class="ps" id="panel-details" aria-label="Details"><dl class="pfacts">${facts.map(([k, x]) => `<div><dt>${k}</dt><dd>${x}</dd></div>`).join('')}</dl></section>${d.item.type === 'file' ? versions(d, name, o.returnTo) : ''}${sharing(d, name, o.returnTo)}${recentUploads(o.uploads ?? [], o.returnTo)}${o.head === false ? '' : activity(d, name)}</aside>`
}
