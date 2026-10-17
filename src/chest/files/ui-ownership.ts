import { card, details, esc, field, form, hidden, select, stamp } from '../ui-shared'

type Offer = { id: string; item: string; itemName: string; itemType: string; sender: string; recipient: string; retainEditor: boolean; at: string; status: string; mine: boolean; canAccept: boolean; stale: boolean }
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const nav = '<p class="lib-links"><a class="link" href="/app/files">Files</a> · <a class="link" href="/app/ownership">Ownership requests</a></p>'
const pending = (r: Offer) => r.status === 'pending'
export function ownershipForm(d: any, people: any[], offers: Offer[] = []) {
 if (d.space?.kind !== 'personal' || d.role !== 'owner') return ''
 const waiting = offers.find(r => r.item === d.id && r.mine && pending(r))
 if (waiting) return card('Ownership', `<p>You offered this ${esc(d.item?.type || 'item')} to ${esc(waiting.recipient)}. You stay owner until they accept.</p><p><a class="link" href="/app/ownership/${esc(waiting.id)}">Review ownership request</a></p>${form(`/ownership/${waiting.id}/cancel`, '', 'Cancel request', `/app/items/${d.id}`, inline)}`, 'side-card')
 const colleagues = people.filter(p => p.id !== d.me && p.payload.status === 'active').map(p => ({ id: p.id, label: `${p.payload.name} · ${p.id}` }))
 if (!colleagues.length) return card('Ownership', '<p class="quiet">An active colleague can accept ownership of this item. Invite a colleague in People &amp; settings first.</p>', 'side-card')
 return card('Ownership', `<p>Offer this item to a colleague. You stay owner until they accept. It then moves to their My files with its versions, links and sharing.</p>${details('Transfer ownership', form(`/items/${d.id}/ownership`, select('New owner', 'recipient', colleagues) + select('Your access after acceptance', 'retainEditor', [{ id: 'true', label: 'Keep me as editor' }, { id: 'false', label: 'Remove my direct access' }], 'true') + '<p class="quiet">Group access and existing links keep their current settings.</p>', 'Send ownership request', '/app/ownership'), 'btn btn-outline')}`, 'side-card')
}
export function ownershipPage(r: Offer) {
 const returnTo = `/app/ownership/${r.id}`
 const stale = pending(r) && r.stale ? '<p role="status">This request is out of date because the item or a participant changed. The owner must cancel it and send a new request.</p>' : ''
 const explanation = pending(r) ? `<p>${esc(r.sender)} stays owner until ${esc(r.recipient)} accepts. Acceptance moves the ${esc(r.itemType)} to the recipient’s My files, keeping the same item, versions, links and sharing. ${r.retainEditor ? 'The sender stays an editor.' : 'The sender’s direct grants are removed; group access and existing links keep their settings.'}</p>` : `<p>Request ${esc(r.status)}.${r.status === 'accepted' ? ' Ownership has transferred.' : ' Ownership did not change.'}</p>`
 const accept = r.canAccept ? form(`/ownership/${r.id}`, hidden('decision', 'accept') + field('Name in My files', 'name', r.itemName) + '<p class="quiet">If My files already has this name, choose another name here before accepting.</p>', 'Accept ownership', returnTo) : ''
 const decline = pending(r) && !r.mine ? form(`/ownership/${r.id}`, hidden('decision', 'decline'), 'Decline ownership', returnTo, inline) : ''
 const cancel = pending(r) && r.mine ? form(`/ownership/${r.id}/cancel`, '', 'Cancel request', returnTo, inline) : ''
 return `<div class="page-head"><h1>Ownership request</h1><p class="lede">${esc(r.itemName)}</p></div>${nav}${card('Transfer details', `<p>${esc(r.sender)} → ${esc(r.recipient)} · ${stamp(r.at)}</p>${explanation}${stale}${accept}${decline}${cancel}${r.status === 'accepted' ? `<p><a class="link" href="/app/items/${esc(r.item)}">Open transferred item</a></p>` : ''}`)}`
}
export function ownershipInboxPage(rows: Offer[]) {
 const group = (title: string, subset: Offer[], empty: string) => card(title, subset.length ? `<ul class="events">${subset.map(r => `<li><strong><a class="link" href="/app/ownership/${esc(r.id)}">${esc(r.itemName)}</a></strong><p>${r.mine ? `To ${esc(r.recipient)}` : `From ${esc(r.sender)}`} · ${esc(r.status)}${r.stale && pending(r) ? ' · out of date' : ''} · ${stamp(r.at)}</p></li>`).join('')}</ul>` : `<p class="quiet">${empty}</p>`)
 return '<div class="page-head"><h1>Ownership requests</h1><p class="lede">Accept or decline personal files and folders offered to you. Ownership stays with the sender until acceptance.</p></div>' + nav + group('Waiting for your decision', rows.filter(r => !r.mine && pending(r)), 'No ownership requests waiting.') + group('Sent requests', rows.filter(r => r.mine && pending(r)), 'No sent requests waiting.') + group('Past requests', rows.filter(r => !pending(r)), 'No past requests.')
}
