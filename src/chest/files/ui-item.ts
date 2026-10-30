import { restrictedPreviewPanel } from './ui-restricted-preview'
import { archivePanel } from './archive-preview'
import { commentsPanel } from './ui-comments'
import { signaturePanel, versionBadge } from '../signatures/ui'
import { selectionControls } from '../bulk/ui'
import { storagePanel } from '../quota/ui'
import { transferForm } from '../transfers/ui'
import { requestFields, requestRows } from './request-panel'
import { fileActivity } from '../audit/ui'
import { esc, field, area, select, form, hidden, details, card, stamp } from '../ui-shared'
import { zones } from './zone'
import { eventWords } from '../ui-words'
import { readFields, textInside } from '../read/ui'
import { askPanel } from '../read/ask-ui'
import { officePanel } from '../office/ui'
import { linkForm } from './ui-link-form'
import { ownershipForm } from './ui-ownership'
import { linkFacts } from './ui-links'
import { folderFilingInputs, folderMetadataPanel } from './ui-folder-metadata'
import { governancePanel, versionReview } from './ui-governance'
import { newFileMenu, templatePublisher } from '../office/new-ui'
import { listTable, folderTable, size } from './ui-table'
import { detailsPanel } from './ui-panel'
import { agentStrip, conflictBanner, emptyFolder, folderTitle, manageTools } from './ui-folder'
import { fileKind, fileTile } from '../../ui/icons'
// A date field's day ends on the person's own clock: chest-time.js puts the browser's zone here.
const zoneField = '<input type="hidden" name="zone" value="UTC" data-zone>'
// The file or folder page: its path, contents or version history, comments, and the sharing panel for people allowed
// to share. Every action is a form posted through the same API functions; the one script, /chest-upload.js, adds
// uploads with progress, resuming and drag-and-drop on top of the plain upload form.
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const roles = (list: string[]) => list.map(r => ({ id: r, label: r.replace('_', ' ') }))
export { size } from './ui-table'
export const listing = (rows: any[], none: string, selectable = false) => listTable(rows, none, selectable)
// Restore a folder (or a space) to a date: this opens the preview; nothing changes until it is applied, and an applied
// restore can be undone from its receipt or from the folder page.
const when = stamp
export const rewindForm = (target: { space?: string; folder?: string }, returnTo: string) => details('Restore to a date', form('/rewind/preview', (target.folder ? hidden('folder', target.folder) : hidden('space', target.space!)) + field('Date and time', 'local', '', 'datetime-local') + select('Time zone', 'zone', zones().map(z => ({ id: z, label: z.replace(/_/g, ' ') })), 'UTC').replace('<select ', '<select data-zone ') + '<p class="quiet">You see every change before anything happens.</p>', 'Preview restore', returnTo), 'btn btn-outline')
const effect = (c: any) => c.kinds.map((k: string) => ({ 'earlier version': `back to the version from ${when(c.versionAt ?? '')}`, name: `renamed back to “${esc(c.renameTo)}”`, place: 'moved back to where it was', 'trashed then': 'goes back to trash, where it was then', 'not trashed then': 'brought back from trash', 'added since': 'added since then: moves to trash, where it can still be restored' } as Record<string, string>)[k] ?? k).join('; ')
export function rewindPage(input: any, plan: any) {
 const rows = plan.changes.map((c: any) => `<li class="choice"><label><input type="checkbox" name="item:${esc(c.id)}" value="true" checked><span><strong>${esc(c.name)}</strong> <span class="quiet">${effect(c)}</span></span></label></li>`).join('')
 const removed = plan.sharing.removedSince.map((e: any) => `<li><span>${esc(eventWords(e.action))} · ${when(e.at)}</span></li>`).join('')
 const scope = (input.folder ? hidden('folder', input.folder) : hidden('space', input.space)) + hidden('at', plan.at) + hidden('fingerprint', plan.fingerprint)
 return `<div class="page-head"><h1>Restore preview</h1><p class="lede">Returning to ${(when(plan.at))} changes ${plan.changes.length} item(s). Nothing has changed yet. Each change becomes a new state; later versions and items added since stay recoverable, and you can undo the restore.</p></div><section class="card">${rows ? form('/rewind/apply', `<ul class="choices">${rows}</ul>` + scope, 'Restore selected items', input.returnTo || '/app/files') : '<p class="quiet">Nothing changed since then.</p>'}<h2 class="section-title">Sharing</h2><p class="quiet">Sharing is not restored. Access removed since then stays removed.</p>${removed ? `<ul class="events">${removed}</ul>` : ''}<p class="card-foot"><a class="link" href="${esc(input.returnTo || '/app/files')}">Back without restoring</a></p></section>`
}
export function rewindDonePage(input: any, result: any) {
 const back = input.returnTo || '/app/files'
 return `<div class="page-head"><h1>Restored to ${(when(result.at))}</h1><p class="lede">${result.applied.length} item(s) changed. Every later version stays in each file's history.</p></div><section class="card">${form(`/rewind/${result.id}/undo`, '', 'Undo this restore', back, { className: 'form form-inline', buttonClass: 'btn btn-outline' })}<p class="card-foot"><a class="link" href="${esc(back)}">Open the folder</a></p></section>`
}
export function rewindUndonePage(input: any, result: any) {
 const back = input.returnTo || '/app/files'
 return `<div class="page-head"><h1>Restore undone</h1><p class="lede">${result.restored.length} item(s) are back as they were just before the restore.${result.skipped.length ? ` ${result.skipped.length} item(s) changed again after the restore and were left as they are.` : ''}</p></div><section class="card"><p class="card-foot"><a class="link" href="${esc(back)}">Open the folder</a></p></section>`
}
// The latest restores of this folder or space, each with Undo until it is undone.
export const restores = (rows: any[], returnTo: string) => rows.length ? `<section class="restores" aria-label="Recent restores"><h2 class="section-title">Recent restores</h2><ul class="events">${rows.map(r => `<li><span class="mono">Restored to ${(when(r.at))} by ${esc(r.by)} · ${r.items.length} item(s)${r.undone ? ` · undone by ${esc(r.undone.by)}` : ''}</span>${r.undone ? '' : form(`/rewind/${r.id}/undo`, '', 'Undo', returnTo, { className: 'form form-inline', buttonClass: 'btn btn-outline' })}</li>`).join('')}</ul></section>` : ''
// Uploads: the plain form works everywhere; with the script it gives way to the drop area with progress and resume.
export function uploader(target: { space?: string; parent?: string; item?: string }, waiting: any[], returnTo: string, filing = '') {
 const data = target.item ? `data-item="${esc(target.item)}"` : target.parent ? `data-parent="${esc(target.parent)}"` : `data-space="${esc(target.space!)}"`
 const open = waiting.map(u => `<li data-waiting="${esc(u.id)}"><span class="mono">${esc(u.name)} · ${Math.floor(u.received * 100 / u.size)}% of ${esc(size(u.size))} received</span>${form(`/uploads/${u.id}/cancel`, '', 'Cancel upload', returnTo, { className: 'form form-inline', buttonClass: 'upload-button' })}</li>`).join('')
 return `<section class="upload" id="upload" data-upload ${data} hidden aria-label="${target.item ? 'Upload a new version' : 'Upload files'}">${filing}<div class="upload-drop"><p class="upload-hint"><strong>${target.item ? 'Drop the new version here' : 'Drop files here'}</strong> <span class="quiet">or</span></p><div class="upload-picks"><label class="btn">${target.item ? 'Choose file' : 'Choose files'}<input class="upload-input" type="file" ${target.item ? '' : 'multiple'} data-pick></label><label class="btn btn-outline upload-camera">Take a photo<input class="upload-input" type="file" accept="image/*" capture="environment" data-pick></label></div></div>${open ? `<div class="upload-waiting"><h3>Unfinished uploads</h3><p class="quiet">Choose or drop the same file again to continue from where it stopped.</p><ul class="events">${open}</ul></div>` : ''}<ol class="upload-list" data-list aria-live="polite"></ol><button type="button" class="btn btn-outline" data-refresh hidden>Show the new files</button></section>`
}
export function addHere(target: { space?: string; parent?: string }, returnTo: string, waiting: any[] = [], more = '', creation?: any, filing = '', menu = true) {
 const where = target.parent ? hidden('parent', target.parent) : hidden('space', target.space!)
 return `<div class="doc-actions">${menu ? newFileMenu(target, returnTo, creation, filing) : ''}${details('New folder', form('/items', where + hidden('type', 'folder') + field('Folder name', 'name'), 'Create folder', returnTo), 'btn btn-outline')}${details('Upload a file', form('/items', where + hidden('type', 'file') + filing + field('File', 'file', '', 'file'), 'Upload file', returnTo), 'btn').replace('<details class="disclosure">', '<details class="disclosure" data-upload-fallback>')}${more}</div>${uploader(target, waiting, returnTo, filing)}`
}
// Versions are numbered in the order they arrived, oldest 1, so a number never moves when a newer one is added or
// restored. d.versions lists newest first.
const number = (d: any, id: string) => { const at = d.versions.findIndex((v: any) => v.id === id); return at < 0 ? 0 : d.versions.length - at }
function version(v: any, d: any, returnTo: string, named: (email: string) => string) {
 const current = v.id === d.item.current, base = `/api/chest/items/${v.sourceItem || d.id}/bytes/${v.id}`
 const actions = d.can.contribute && (!v.sourceItem || v.sourceItem===d.id) ? form(`/items/${d.id}/versions/${v.id}/name`, field('Version name', 'name', v.name, 'text', false), 'Save version name', returnTo, inline) + (current ? '' : form(`/items/${d.id}/versions/${v.id}/restore`, '', 'Restore as current version', returnTo, inline)) : ''
 return `<article class="ver${current ? ' ver-current' : ''}">${current ? '<span class="chip chip-action ver-tag">Current version</span>' : ''}<div class="ver-card"><div class="ver-facts">${fileTile(fileKind(v.filename))}<div>
 <h3><span class="mono">Version ${number(d, v.id)}</span> · ${esc(v.name || v.filename)}</h3><p class="mono">${esc(v.filename)} · ${esc(size(v.size))}</p><p class="mono">By ${esc(named(v.actor))} <span class="nowrap">${stamp(v.at)}</span></p>${details('Details', `<p class="mono">${esc(v.mediaType)} · ${esc(v.arrival === 'restore' && v.restoredFrom ? `restore of version ${number(d, v.restoredFrom)}` : v.arrival)}</p><p class="mono hash">SHA-256 ${esc(v.checksum)}</p><p class="mono">Version ID ${esc(v.id)}</p>`, 'link-summary')}${versionBadge(v, id => number(d, id))}
  <p class="ver-links">${d.can.download ? `<a class="link" href="${base}?download=true">Download this version</a>` : '<span class="quiet">Downloads are turned off for your role.</span>'}${d.can.download && /\.(docx|xlsx|pptx)$/i.test(v.filename) ? ` <span aria-hidden="true">·</span> <a class="link" href="/api/chest/items/${v.sourceItem || d.id}/office-preview/${v.id}" target="_blank" rel="noopener">Open Office preview</a>` : ''}${d.can.download && /\.zip$/i.test(v.filename) ? ` <span aria-hidden="true">·</span> <a class="link" href="/api/chest/items/${v.sourceItem || d.id}/archive-preview/${v.id}?format=html" target="_blank" rel="noopener">Open ZIP directory</a>` : ''}${v.preview !== 'unsupported' && d.can.download ? ` <span aria-hidden="true">·</span> <a class="link" href="${base}" target="_blank" rel="noopener">Preview</a>` : ''}${!d.can.download ? ` · <a class="link" href="/api/chest/items/${v.sourceItem || d.id}/rendered-preview/${v.id}" target="_blank" rel="noopener">Open rendered preview</a>` : ''}</p></div></div><div class="ver-decide">${versionReview(v, d, returnTo)}${actions}</div></div></article>`
}
function sharing(d: any, people: any[], groups: any[], returnTo: string) {
 const principals = [...people.filter(p => p.id !== d.me).map(p => ({ id: p.id, label: `${p.payload.name} · ${p.id}` })), ...groups.map(g => ({ id: g.id, label: `Group · ${g.payload.name}` }))]
 const grants = d.grants.map((g: any) => `<li><span class="mono">${esc(g.principal)} · ${esc(g.role)} · by ${esc(g.by)}${g.expires ? ` · expires ${stamp(g.expires)}` : ''}</span>${g.message ? `<p>${esc(g.message)}</p>` : ''}${form(`/items/${d.id}/unshare`, hidden('principal', g.principal), 'Remove access', returnTo, inline)}${g.expires ? form(`/items/${d.id}/extend`, hidden('principal', g.principal) + hidden('from', g.expires), 'Extend by 7 days', returnTo, inline) : ''}</li>`).join('')

 const requests = d.requests.map((r: any) => `<li><span class="mono">${esc(r.requester)} asks for ${esc(r.role)}</span>${r.message ? `<p>${esc(r.message)}</p>` : ''}${form(`/requests/${r.id}`, hidden('decision', 'approve') + select('Grant role', 'role', roles(['viewer', 'commenter', 'editor'].slice(0, ['viewer', 'commenter', 'editor'].indexOf(r.role) + 1)), r.role), 'Approve', returnTo, inline)}${form(`/requests/${r.id}`, hidden('decision', 'decline'), 'Decline', returnTo, inline)}</li>`).join('')
 return card('Share', form(`/items/${d.id}/shares`, select('Person or group', 'principal', principals) + select('Role', 'role', roles(['viewer', 'commenter', 'editor'])) + area('Message (optional)', 'message', '', false) + field('Access expires (optional)', 'expires', '', 'date', false) + zoneField, 'Share', returnTo, { buttonClass: 'btn btn-block' }) + (grants ? `<h3 class="section-title">People with access</h3><ul class="events">${grants}</ul>` : ''), 'side-card')
  + linkForm(d,returnTo)
  + publicLinks(d, returnTo) + (d.item.type === 'folder' ? fileRequests(d, returnTo) : '')
  + (requests ? card('Access requests', `<ul class="events">${requests}</ul>`, 'side-card') : '')
}
// Links for anyone: an optional password, expiry and download limit; each link shows "Expires Nov 30 · 3 of 10
// downloads" and one Revoke. Make private ends every link on the item and keeps named people and groups.
function publicLinks(d: any, returnTo: string) {
 const live = d.publicLinks.filter((l: any) => l.state !== 'revoked'), rows = live.map((l: any) => `<li><span class="mono">${l.audience==='guests'?'Named guests':l.audience==='domain'?`Verified domain · ${esc(l.domain)}`:'Link for anyone'} · ${esc(l.role??'viewer')} · ${linkFacts(l)}</span>${form(`/public-links/${l.id}/revoke`, '', 'Revoke', returnTo, inline)}</li>`).join('')
 const wide = live.length + d.links.length ? form(`/items/${d.id}/make-private`, '', 'Make private', returnTo, inline) : ''
 return rows || wide ? card('External links', `<p class="quiet">Existing links and their current download usage. Revoke ends access on the next request.</p>${rows ? `<ul class="events">${rows}</ul>` : ''}${wide}`, 'side-card') : ''
}
// A folder's file requests: anyone with the request link uploads here and sees nothing else.
function fileRequests(d: any, returnTo: string) {
 const rows=requestRows(d.fileRequests,returnTo)
 return card('File request', `<p class="quiet">Ask anyone to send files into this folder. They cannot see its contents. Large files resume in parts; active content stays in quarantine.</p>${form(`/items/${d.id}/file-requests`,requestFields(),'Create file request',returnTo,{buttonClass:'btn btn-outline btn-block'})}${rows?`<ul class="events">${rows}</ul>`:''}`,'side-card')
}
// The breadcrumb the top bar shows for a file or folder: its space, the folders above it, then the item.
export const itemCrumbs = (d: any) => [d.space.member ? { label: d.space.name, href: `/app/spaces/${d.space.id}` } : { label: 'Shared with me', href: '/app/shared' }, ...d.path.map((p: any) => ({ label: p.name, href: `/app/items/${p.id}` })), { label: d.item.name }]
const name = (people: any[]) => (email: string) => people.find((p: any) => p.id === email)?.payload.name ?? email
// The panel's management cards: everything a person with the right role can change on this item, as before.
function manageCards(d: any, extra: { people: any[]; groups: any[] }, returnTo: string) {
 const mine = card('Your access', `<p>${esc(String(d.role).replace('_', ' '))}${d.can.download ? '' : ' · downloads off'}</p><ul class="events">${(d.accessExplanation ?? []).map((r: string) => `<li>${esc(r)}</li>`).join('')}</ul>${form(`/items/${d.id}/prefs`, hidden('starred', d.starred ? 'false' : 'true'), d.starred ? 'Remove star' : 'Star', returnTo, inline)}${d.space.member ? '' : form(`/items/${d.id}/prefs`, hidden('shortcut', d.shortcut ? 'false' : 'true'), d.shortcut ? 'Remove from My files' : 'Add to My files', returnTo, inline)}`, 'side-card')
 const settings = d.can.administer ? card('Access settings', form(`/items/${d.id}/settings`, select('Restricted (stop inherited access)', 'restricted', [{ id: 'false', label: 'No' }, { id: 'true', label: 'Yes' }], String(d.item.restricted)) + select('No download, print or copy for viewers and commenters', 'noDownload', [{ id: 'false', label: 'Off' }, { id: 'true', label: 'On' }], String(d.item.noDownload)), 'Save access settings', returnTo, { buttonClass: 'btn btn-outline btn-block' }), 'side-card') : ''
 return `${mine}${d.can.share && d.can.download ? transferForm(d.id, d.item.name, returnTo) : ''}${ownershipForm(d, extra.people, d.ownership)}${governancePanel(d, extra.people, returnTo)}${folderMetadataPanel(d, extra.people, returnTo)}${templatePublisher(d, extra.people, extra.groups, returnTo)}${d.can.share ? `<div id="share" class="side-cards">${sharing(d, extra.people, extra.groups, returnTo)}</div>` : ''}${settings}`
}
// The storage card shows on a folder or file page once its space is at 90% of a limit (the warning it carries).
const nearLimit = (q: any) => q.limitBytes !== null && q.usedBytes >= q.limitBytes * .9
const notes = (d: any) => `${d.mergedInto ? `<section class="card"><p>Merged into <a class="link" href="/app/items/${esc(d.mergedInto.id)}">${esc(d.mergedInto.name)}</a>. This original and its links are kept.</p></section>` : ''}${d.merges?.length ? `<section class="card"><p>${d.merges.length} duplicate(s) merged; all versions are shown below. <a class="link" href="/app/filing/duplicates">Review or undo merge</a></p></section>` : ''}`
export function itemPage(d: any, extra: { people: any[]; groups: any[]; destinations: { id: string; label: string }[] }) {
 const returnTo = `/app/items/${d.id}`, parentHref = d.path.length ? `/app/items/${d.path.at(-1).id}` : d.space.member ? `/app/spaces/${d.space.id}` : '/app/shared', named = name(extra.people)
 const current = d.versions.find((v: any) => v.id === d.item.current)
 const manage = d.can.manage ? details('Move', form(`/items/${d.id}/move`, select('Destination', 'destination', extra.destinations.filter(x => x.id !== `folder:${d.id}`)), 'Move here', returnTo) + form(`/items/${d.id}/copy`, select('Copy destination', 'destination', extra.destinations.filter(x => x.id !== `folder:${d.id}`)) + field('Copy name', 'name', d.item.name), 'Copy here', returnTo), 'btn btn-outline') + form(`/items/${d.id}/trash`, '', 'Move to trash', parentHref, { className: 'form form-inline', buttonClass: 'btn btn-outline' }) : ''
 const rename = d.can.contribute ? details('Rename', form(`/items/${d.id}/rename`, field('Name', 'name', d.item.name), 'Save name', returnTo), 'btn btn-outline') : ''
 const custody = rename || manage ? `<div class="doc-custody">${rename}${manage}</div>` : ''
 if (d.item.type === 'folder') {
  const f = d.folder, sel = f.selected
  const rows = f.show === 'files' ? f.rows.filter((r: any) => r.type === 'file') : f.show === 'folders' ? f.rows.filter((r: any) => r.type === 'folder') : f.rows
  const table = rows.length ? folderTable(rows, returnTo, sel?.id ?? null, returnTo) : emptyFolder(f.rows.length ? 'Nothing of this kind here.' : 'This folder is empty.', d.can.contribute)
  // Persisted parts remain visible after reload; choosing the same file resumes them in the uploader.
  // Under the table, one row of the folder's own tools: New folder, Restore to a date, Rename, Move and Move to trash.
  const add = d.can.contribute ? `<div id="new" class="add-bar">${addHere({ parent: d.id }, returnTo, d.uploads, rewindForm({ folder: d.id }, returnTo) + rename + manage, d.creation, folderFilingInputs(d.metadata, extra.people, d.me), false)}</div>` : ''
  const main = folderTitle([d.space.name, ...d.path.map((p: any) => p.name)], d.item.name, returnTo, f.show) + askPanel(d.id, true) + agentStrip(f.agent, returnTo) + f.conflicts.map((c: any) => conflictBanner(c, returnTo, d.can.manage, d.can.contribute)).join('') + notes(d) + (nearLimit(d.storage) ? storagePanel(d.storage, false) : '') + `<div>${table}</div>` + add + restores(d.rewinds, returnTo) + (d.can.contribute ? '' : custody) + commentsPanel(d, returnTo)
  const side = sel ? detailsPanel(sel, named, { close: returnTo, returnTo: `${returnTo}?file=${sel.id}`, uploads: d.uploads }) : detailsPanel(d, named, { returnTo, uploads: d.uploads, children: d.children.length }) + manageTools('folder', 'Access, sharing, links, file requests, review and settings', manageCards(d, extra, `${returnTo}?manage`), d.manage)
  return `<div class="browse"><div class="browse-main">${main}</div><div class="browse-side doc-side">${side}</div></div>`
 }
 const main = `<div class="page-head file-head">${fileTile(fileKind(d.item.name))}<div><h1>${esc(d.item.name)}</h1><p class="lede">File · created by ${esc(named(d.item.createdBy))}</p></div></div>${notes(d)}${nearLimit(d.storage) ? storagePanel(d.storage, false) : ''}
  <div class="doc-actions">${current && d.can.download ? `<a class="btn" href="/api/chest/items/${d.id}/bytes/${current.id}?download=true">Download</a>` : ''}${d.can.contribute ? details('Upload a new version', form(`/items/${d.id}/versions`, field('Replacement file', 'file', '', 'file'), 'Upload new version', returnTo), 'btn btn-outline').replace('<details class="disclosure">', '<details class="disclosure" data-upload-fallback>') : ''}</div>${d.can.contribute ? uploader({ item: d.id }, d.uploads, returnTo) : ''}
   ${askPanel(d.id, false)}${signaturePanel(d, returnTo)}${d.can.download ? archivePanel(d) + officePanel(d) : restrictedPreviewPanel(d)}${d.can.download ? textInside(d.reading, { poll: `/api/chest/items/${d.id}/reading`, page: n => `/api/chest/items/${d.id}/pages/${d.item.current}/${n}`, retry: d.can.contribute ? `/items/${d.id}/reading` : undefined, returnTo, owner: d.ownerRole, showPhoto: !(d.fieldReadings ?? []).some((r: any) => r.version === d.item.current && r.fields?.state === 'done' && r.fields.proposals.some((p: any) => p.box)) }) : ''}
   ${(d.fieldReadings ?? []).slice().reverse().map((r: any) => readFields({id:d.id,fields:d.metadata?.filing?.fields ?? {}},{id:r.version,label:`Version ${d.versions.findIndex((v: any) => v.id === r.version)+1}`},r.reading,r.fields,Object.fromEntries((d.metadata?.schema?.payload.fields ?? []).map((f: any) => [f.name,f.type])),d.can.contribute && r.version === d.versions.at(-1)?.id,d.ownerRole,returnTo,'items')).join('')}<h2 class="section-title" id="history">Version history</h2>${d.versions.filter((v: any) => !v.sourceItem || v.sourceItem === d.id).length > 1 ? `<p><a class="btn btn-outline" href="${returnTo}/compare">Compare versions</a></p>` : ''}<div class="versions">${d.versions.map((v: any) => version(v, d, returnTo, named)).join('')}</div>
   ${fileActivity(d.activity,d.id,d.versions,named)}
   ${commentsPanel(d, returnTo)}${custody}`
 return `<div class="browse browse-file"><div class="browse-main">${main}</div><div class="browse-side doc-side">${detailsPanel(d, named, { returnTo, head: false })}${manageCards(d, extra, returnTo)}</div></div>`
}
export function requestAccessPage(id: string) {
 return `<div class="page-head"><h1>Request access</h1><p class="lede">You do not have access to this item. Ask the people who can share it.</p></div><section class="card">${form(`/items/${id}/access-requests`, select('Access you need', 'role', roles(['viewer', 'commenter', 'editor'])) + area('Message (optional)', 'message', '', false), 'Request access', '/app/requests')}</section>`
}
