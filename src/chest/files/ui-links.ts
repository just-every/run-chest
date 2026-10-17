import { esc, form, hidden, icon, day } from '../ui-shared'
// Links: what is shared too widely (with Make private), every link with its expiry and downloads (with Revoke), and
// every file request (with Close). Each action is one button; nothing asks a second time.
const removal = { className: 'form form-inline', buttonClass: 'btn btn-danger btn-sm' }
const small = { className: 'form form-inline', buttonClass: 'btn btn-outline btn-sm' }
const back = '/app/links'
const row = (title: string, href: string, facts: string, actions = '', extra = '', mark: 'link' | 'arrowUp' | 'alert' = 'link') => `<li><div class="row-card person"><div class="row-main"><span class="icon-chip${mark === 'alert' ? ' icon-chip-alert' : ''}">${icon(mark)}</span><div class="row-text"><strong><a href="${href}">${esc(title)}</a></strong><span class="row-sub">${facts}</span>${extra}</div></div>${actions ? `<div class="row-actions">${actions}</div>` : ''}</div></li>`
const list = (rows: string[], none: string) => rows.length ? `<ul class="rows rows-boxed">${rows.join('')}</ul>` : `<p class="quiet empty-note">${esc(none)}</p>`
export function linksPage(d: any) {
 const wide = d.wide.map((w: any) => row(w.name, `/app/items/${w.item}`, esc(w.path), w.manage ? form(`/items/${w.item}/make-private`, '', 'Make private', back, { className: 'form form-inline', buttonClass: 'btn btn-sm' }) : '', `<ul class="events wide-reasons">${w.links.map((l: any) => `<li><span class="row-sub">${l.audience === 'public' ? 'Link for anyone' : 'Organisation link'} · ${esc(l.summary)}</span><p>${esc(l.reasons.join('. '))}.</p></li>`).join('')}</ul>`, 'alert'))
 const pub = d.public.map((l: any) => row(l.name, `/app/items/${l.item}`, `Link for anyone · ${esc(l.summary)} · by ${esc(l.createdBy)}`, l.state === 'revoked' ? '' : form(`/public-links/${l.id}/revoke`, '', 'Revoke', back, removal)))
 const org = d.organisation.map((l: any) => row(l.name, `/app/items/${l.item}`, `Organisation link · ${esc(l.role)} · ${l.discoverable ? 'discoverable' : 'not discoverable'} · by ${esc(l.createdBy)}`, form(`/links/${l.id}`, hidden('remove', 'true'), 'Revoke', back, removal)))
 const req = d.requests.map((r: any) => row(r.title, `/app/items/${r.folder}`, `Into ${esc(r.path)} · ${r.uploads} file${r.uploads === 1 ? '' : 's'} received · ${r.open ? r.deadline ? `open until ${day(r.deadline)}` : 'open' : r.closedAt ? `closed ${day(r.closedAt)}` : 'past its deadline'}`, r.open ? form(`/file-requests/${r.id}/close`, '', 'Close request', back, small) : '', '', 'arrowUp'))
 return `<div class="page-head"><h1>Links</h1><p class="lede">Every link and file request you made or can manage. Revoking ends a link on its next request.</p></div>
 <h2 class="section-title">Shared too widely</h2><p class="quiet">Links anyone can open without signing in, links that stay open for a long time, and links past their expiry or download limit. Make private turns off every link on the item and keeps the people and groups it is shared with.</p>${list(wide, 'Nothing is shared too widely.')}
 <h2 class="section-title">Links for anyone</h2>${list(pub, 'No links for anyone yet. Create one from a file or folder page.')}
 <h2 class="section-title">Organisation links</h2>${list(org, 'No organisation links.')}
 <h2 class="section-title">File requests</h2>${list(req, 'No file requests yet. Create one from a folder page.')}`
}
