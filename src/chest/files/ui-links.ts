import { linkRepairsPanel } from '../filing/ui-link-repairs'
import { esc, form, hidden, stamp } from '../ui-shared'
import { linkPolicyPanel } from './ui-link-policy'
import { filesLinks } from './ui-pages'
// Links: what is shared too widely (with Make private), every link with its expiry and downloads (with Revoke), and
// every file request (with Close). Each action is one button; nothing asks a second time.
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const back = '/app/links'
const row = (title: string, href: string, facts: string, actions = '', extra = '') => `<li class="row-tabbed"><span class="tab tab-plain" aria-hidden="true"></span><div class="row-card person"><div class="person-facts"><strong><a class="link" href="${href}">${esc(title)}</a></strong><span class="mono">${facts}</span>${extra}</div>${actions ? `<div class="row-actions">${actions}</div>` : ''}</div></li>`
// A link for anyone in words, its dates on the viewer's clock: "Expires 30 Nov 2026, 10:00 GMT+10 · 3 of 10 downloads".
export function linkFacts(l: any) {
 const when = l.state === 'revoked' ? `Revoked ${stamp(l.revokedAt)}` : l.state === 'expired' ? `Expired ${stamp(l.expires)}` : l.expires ? `Expires ${stamp(l.expires)}` : 'No expiry'
 return [when, l.limit === null ? `${l.downloads} download${l.downloads === 1 ? '' : 's'}` : `${l.downloads} of ${l.limit} downloads`, ...(l.password ? ['password'] : []), ...(l.unavailable?['item removed']:[]), ...(l.policyBlocked?['blocked by link policy']:[]), ...(l.versionMode==='pinned'?[l.snapshot?'pinned folder snapshot':'pinned version']:l.versionMode==='approved'?['approved versions only']:[]), ...(l.download===false?['preview only']:[])].join(' · ')
}
const list = (rows: string[], none: string) => rows.length ? `<ul class="rows rows-wide">${rows.join('')}</ul>` : `<p class="quiet">${esc(none)}</p>`
export function linksPage(d: any) {
 const wide = d.wide.map((w: any) => row(w.name, `/app/items/${w.item}`, esc(w.path), w.manage ? form(`/items/${w.item}/make-private`, '', 'Make private', back, inline) : '', `<ul class="events">${w.links.map((l: any) => `<li><span class="mono">${l.audience === 'public' ? 'Link for anyone' : l.audience === 'organisation' ? 'Organization link' : 'Verified external link'} · ${l.link ? linkFacts(l.link) : esc(l.summary)}</span><p>${esc(l.reasons.join('. '))}.</p></li>`).join('')}</ul>`))
 const pub = d.public.map((l: any) => row(l.name, `/app/items/${l.item}`, `${l.audience==='guests'?'Named guests':l.audience==='domain'?`Verified domain · ${esc(l.domain)}`:'Link for anyone'} · ${esc(l.role??'viewer')} · ${linkFacts(l)} · by ${esc(l.createdBy)}`, l.state === 'revoked' ? '' : form(`/public-links/${l.id}/revoke`, '', 'Revoke', back, inline)))
 const org = d.organisation.map((l: any) => row(l.name, `/app/items/${l.item}`, `${l.audience==='restricted'?'Restricted link':'Organization link'} · ${esc(l.role)} · ${l.discoverable ? 'discoverable' : 'not discoverable'}${l.expires?` · expires ${stamp(l.expires)}`:''}${l.policyBlocked?' · blocked by link policy':''}${l.unavailable?' · item removed':''}${l.state==='expired'?' · expired':''} · by ${esc(l.createdBy)}`, form(`/links/${l.id}`, hidden('remove', 'true'), 'Revoke', back, inline)))
 const req = d.requests.map((r: any) => row(r.title, `/app/items/${r.folder}`, `Into ${esc(r.path)} · ${r.uploads} file${r.uploads === 1 ? '' : 's'} received · ${r.verification==='email'?'verified email':'any submitter'} · duplicates ${esc(r.duplicates??'keep')} · late ${esc(r.late??'reject')} · ${r.open ? r.deadline ? `open until ${stamp(r.deadline)}` : 'open' : r.closedAt ? `closed ${stamp(r.closedAt)}` : 'past its deadline'}`, r.open ? form(`/file-requests/${r.id}/close`, '', 'Close request', back, inline) : ''))
 return `<div class="page-head"><h1>Links</h1><p class="lede">Every link and file request you made or can manage. Revoking ends a link on its next request.</p></div><div class="lib-tools">${filesLinks()}${linkPolicyPanel(d.policy,d.policyScope)}</div>
 ${linkRepairsPanel(d.repairs,[...new Map([...d.public,...d.organisation].filter((l:any)=>l.manage).map((l:any)=>[l.item,{id:l.item,label:l.name}])).values()] as {id:string;label:string}[])}<h2 class="section-title">Shared too widely</h2><p class="quiet">Links anyone can open without signing in, links that stay open for a long time, and links past their expiry or download limit. Make private turns off every link on the item and keeps the people and groups it is shared with.</p>${list(wide, 'Nothing is shared too widely.')}
 <h2 class="section-title">External links</h2>${list(pub, 'No external links yet. Create one from a file or folder page.')}
 <h2 class="section-title">Organization and restricted links</h2>${list(org, 'No organization links.')}
 <h2 class="section-title">File requests</h2>${list(req, 'No file requests yet. Create one from a folder page.')}`
}
