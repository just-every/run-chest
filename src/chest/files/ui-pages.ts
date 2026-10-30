import { selectionControls } from '../bulk/ui'
import { searchFilters } from './ui-search'
import { repairPanel } from '../sync-repair/ui'
import type { Diagnosis } from '../sync-repair/model'
import { esc, field, select, form, hidden, card, details, personPicker, stamp, count } from '../ui-shared'
import { noticeWords } from '../ui-words'
import { addHere, listing, restores, rewindForm } from './ui-item'
import { folderTable } from './ui-table'
import { agentStrip, conflictBanner, emptyFolder, folderTitle, manageTools } from './ui-folder'
import { detailsPanel } from './ui-panel'
import { fileTile, icons } from '../../ui/icons'
import { storagePanel } from '../quota/ui'
import { spaceCreationPanel, spaceSettingsCard } from './ui-space-policy'
// Files pages: the files home, a space, Shared with me, trash, notices, access requests and sync devices.
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const head = (title: string, lede = '') => `<div class="page-head"><h1>${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`
// Every Files page is reached from the rail (src/chest/ui-rail.ts); this row is the place each page's own tools sit.
const tools = (body = '') => body ? `<div class="lib-tools">${body}</div>` : ''
// The Files tools beyond the rail: the pages for collecting, delivering, protecting and filing files.
const toolLinks: [string, string, string][] = [['/app/collection', 'Collection checklists', 'Ask people for the files a job needs'], ['/app/transfers', 'Deliveries', 'Pinned packages and their delivery evidence'], ['/app/upload-protection', 'Upload protection', 'Uploads held before publication'], ['/app/bulk', 'Selected item jobs', 'Move, copy, share or download a selection'], ['/app/templates', 'Templates', 'Start new files from a shared template'], ['/app/ownership', 'Ownership requests', 'Hand files to a new owner'], ['/app/filing', 'Filing agents', 'Rules, the agent and every move it made'], ['/app/devices', 'Sync devices', 'Companion keys and sync repair']]
export const filesTools = () => `<section class="tool-grid" aria-label="Files tools">${toolLinks.map(([href, label, note]) => `<a class="tool" href="${href}"><strong>${label}</strong><span class="quiet">${note}</span></a>`).join('')}</section>`
// The Files home: My files and the team spaces as cards, then Shortcuts, Starred and Recent in the file table.
export function homePage(d: any) {
 const tile = (href: string, name: string, meta: string) => `<li class="space-card">${fileTile('folder')}<span><a href="${href}">${esc(name)}</a><span class="quiet">${esc(meta)}</span></span></li>`
 const spaces = [tile(`/app/spaces/${d.personal}`, 'My files', 'Your personal area'), ...d.spaces.map((s: any) => tile(`/app/spaces/${s.id}`, s.name, s.kind === 'personal' ? 'personal area' : `Team space · ${String(s.role).replace('_', ' ')}`))].join('')
 return head('Files') + `<ul class="space-grid" aria-label="Spaces">${spaces}</ul>${d.spaces.length ? '' : '<p class="quiet">You are not a member of a team space yet.</p>'}<section class="card new-space" id="new-space"><h2>New team space</h2>${spaceCreationPanel(d)}</section><h2 class="section-title">Tools</h2>${filesTools()}
 ${d.shortcuts.length ? `<h2 class="section-title">Shortcuts in My files</h2>${listing(d.shortcuts, '')}` : ''}`
}
// Starred and Recent are pages of their own, reached from the menu.
export const starredPage = (d: any) => head('Starred') + listing(d.starred, 'Star a file or folder from its page to keep it here.')
export const recentPage = (d: any) => head('Recent') + listing(d.recent, 'Files you open appear here.')
export const newSpacePage = (d: any) => head('New team space') + `<section class="card new-space">${spaceCreationPanel(d)}</section>`
const roleLabel = (r: string) => ({ viewer: 'Viewer', commenter: 'Commenter', contributor: 'Contributor', content_manager: 'Content manager', manager: 'Manager' } as Record<string, string>)[r] ?? r
const spaceRoleRows = ['viewer', 'commenter', 'contributor', 'content_manager', 'manager'].map(id => ({ id, label: roleLabel(id) }))
// The Members card: everyone with their role; a manager changes a role or removes someone on their row, and adds a
// person by email or a group with a role. Roles add up: viewers open and download, commenters also comment,
// contributors also add files, content managers also share, move and trash, managers also change members and settings.
function memberRows(d: any, people: any[], groups: any[], manager: boolean, returnTo: string) {
 const who = (principal: string) => { const g = groups.find((g: any) => g.id === principal), p = people.find((p: any) => p.id === principal); return g ? `Group · ${esc(g.payload.name)}` : p ? `${esc(p.payload.name)} <span class="mono">${esc(p.id)}</span>${p.payload.status === 'invited' ? ' <span class="quiet">(invited)</span>' : ''}` : `<span class="mono">${esc(principal)}</span>` }
 const row = (m: any) => `<li class="member"><span>${who(m.principal)} · <strong>${esc(roleLabel(m.role))}</strong></span>${manager ? `<div class="member-actions">${form(`/spaces/${d.id}/member`, hidden('action', 'role') + hidden('principal', m.principal) + select(`Role for ${m.principal}`, 'role', spaceRoleRows, m.role), 'Change role', returnTo, inline)}${form(`/spaces/${d.id}/member`, hidden('action', 'remove') + hidden('principal', m.principal), 'Remove', returnTo, inline)}</div>` : ''}</li>`
 const others = groups.filter((g: any) => !d.members.some((m: any) => m.principal === g.id))
 const add = manager ? details('Add a person', form(`/spaces/${d.id}/member`, hidden('action', 'add') + personPicker('Email', 'principal', people.filter((p: any) => !d.members.some((m: any) => m.principal === p.id)), `people-${d.id}`) + select('Role', 'role', spaceRoleRows, 'viewer') + field('Name (only for someone new)', 'name', '', 'text', false) + '<p class="quiet">Someone not yet in this Chest is invited by email when the owner adds them.</p>', 'Add to space', returnTo), 'btn btn-outline')
  + (others.length ? details('Add a group', form(`/spaces/${d.id}/member`, hidden('action', 'add') + select('Group', 'principal', others.map((g: any) => ({ id: g.id, label: g.payload.name }))) + select('Role', 'role', spaceRoleRows, 'viewer'), 'Add group', returnTo), 'btn btn-outline') : '') : ''
 return `<ul class="events members">${d.members.map(row).join('')}</ul>${add}<p class="quiet">Viewers open and download. Commenters also comment. Contributors also add files. Content managers also share, move and trash. Managers also change members and settings.</p>`
}
// A space opens as its folder browser: the heavy title, the agent strip, any sync conflict, the file table and the
// details panel; with nothing selected the panel is the space itself and its storage, with members and settings
// under Manage this space.
export function spacePage(d: any, people: any[], groups: any[]) {
 const returnTo = `/app/spaces/${d.id}`, manager = d.kind === 'team' && d.can.administer, f = d.folder, sel = f.selected
 const named = (email: string) => people.find((p: any) => p.id === email)?.payload.name ?? email
 const members = d.kind === 'team' ? card('Members', memberRows(d, people, groups, manager, `${returnTo}?manage`), 'side-card') : ''
 const settings = manager ? spaceSettingsCard(d) : ''
 const rows = f.show === 'files' ? f.rows.filter((r: any) => r.type === 'file') : f.show === 'folders' ? f.rows.filter((r: any) => r.type === 'folder') : f.rows
 const table = rows.length ? folderTable(rows, returnTo, sel?.id ?? null, returnTo) : emptyFolder(f.rows.length ? 'Nothing of this kind here.' : 'Nothing here yet.', d.can.contribute)
 const add = d.can.contribute ? `<div id="new" class="add-bar">${addHere({ space: d.id }, returnTo, d.uploads, d.can.administer || d.kind === 'personal' ? rewindForm({ space: d.id }, returnTo) : '', d.creation, '', false)}</div>` : ''
 const lede = d.kind === 'team' ? `<p class="lede ftitle-lede">Team space · your role: ${esc(String(d.role).replace('_', ' '))}</p>` : ''
 const main = folderTitle([], d.name, returnTo, f.show) + lede + agentStrip(f.agent, returnTo) + f.conflicts.map((c: any) => conflictBanner(c, returnTo, d.can.manage, d.can.contribute)).join('') + `<div>${table}</div>` + add + restores(d.rewinds, returnTo)
 const own = `<aside class="panel" aria-label="Details of ${esc(d.name)}"><div class="panel-head">${fileTile('folder')}<div><h2>${esc(d.name)}</h2><p class="quiet">${d.kind === 'team' ? `Team space · ${d.members.length} member${d.members.length === 1 ? '' : 's'}` : 'Personal area'} · ${f.rows.length} item${f.rows.length === 1 ? '' : 's'}</p></div></div></aside>`
 const side = sel ? detailsPanel(sel, named, { close: returnTo, returnTo: `${returnTo}?file=${sel.id}`, uploads: d.uploads }) : own + storagePanel(d.storage, d.quotaOwner) + manageTools('space', manager ? 'Members, roles and space settings' : 'Members and their roles', members + settings, d.manage)
 return `<div class="browse"><div class="browse-main">${main}</div><div class="browse-side doc-side">${side}</div></div>`
}
// Words in scans and photos are searchable only once they are read; without a working AI key the page says why.
export function searchPage(q: string, r: any, scansUnread: string | null = null, people: any[] = []) { return head('Search files', count(r.count, 'result')) + `<div class="lib-tools">${searchFilters(r, people)}</div>${scansUnread ? `<p class="quiet">Words in scanned images and photos are not searchable yet. ${esc(scansUnread)}</p>` : ''}${listing(r.results, 'No accessible file matches.',true)}` }
export function sharedPage(rows: any[], q: URLSearchParams) {
 const filter = `<form class="form form-inline" method="get" action="/app/shared">${field('Shared by (email)', 'sharer', q.get('sharer') || '', 'text', false)}${field('From', 'from', q.get('from') || '', 'date', false)}${field('To', 'to', q.get('to') || '', 'date', false)}<button class="btn btn-outline">Filter</button></form>`
 return head('Shared with me', 'Files and folders colleagues shared with you, newest first.') + `<div class="lib-tools">${filter}</div>${listing(rows.map(r => ({ ...r, space: { name: `Shared by ${r.sharer}` }, sharedAt: r.at, until: r.expires })), 'Nothing has been shared with you.')}`
}
export function trashPage(rows: any[]) {
 const item = (t: any) => `<li class="row-tabbed"><div class="row-card person"><div class="person-facts"><strong>${esc(t.name ?? `Item in ${t.space.name}`)}</strong><span class="mono">${esc(t.type)} · ${esc(t.space.name)} · trashed by ${esc(t.trashedBy)} ${stamp(t.trashedAt)}</span></div><div class="row-actions">${form(`/items/${t.id}/restore`, '', 'Restore', '/app/files/trash', inline)}${t.erasable ? form(`/items/${t.id}/erase`, '', 'Erase permanently', '/app/files/trash', inline) : ''}</div></div></li>`
 return head('Trash', 'Items you trashed, and every trashed item in spaces you manage. Trash keeps originals and history until a manager erases them.') + `${selectionControls(rows)}${rows.length ? `<ul class="rows rows-wide">${rows.map(item).join('')}</ul>` : '<div class="empty-state empty-grid"><span class="empty-icon">' + icons.trash + '</span><p class="empty-title">Trash is empty.</p><p class="quiet">Anything you move to trash stays here, with its versions, until a manager erases it.</p></div>'}`
}
export function noticesPage(rows: any[], tasks: any[] = []) {
 const assigned = `<section id="tasks" aria-label="Assigned comments"><h2 class="section-title">Assigned comments</h2>${tasks.length ? `<ol class="events">${tasks.map(t => `<li data-task="${esc(t.id)}"><a class="link" href="/app/items/${esc(t.item)}?comment=${esc(t.id)}#comment-${esc(t.id)}">${esc(t.name)}</a><p>${esc(t.message)}</p><p class="mono">Assigned since ${stamp(t.at)}</p></li>`).join('')}</ol>` : '<p>No open assigned comments.</p>'}</section>`
 return head('Notices') + assigned + `<div class="lib-tools">${form('/notices/read', '', 'Mark all read', '/app/notices', inline)}</div>${rows.length ? `<ol class="events">${rows.map(n => `<li><span>${n.payload.read ? '<strong>New</strong> · ' : ''}${esc(noticeWords(n.payload.type))} · ${stamp(n.payload.at)}</span><p>${esc(n.payload.message)}</p>${n.canUndo?form('/filing/moves/'+n.payload.undo+'/undo','','Undo','/app/notices',inline):''}${n.payload.request ? `<a class="link" href="/app/${n.payload.type.startsWith('ownership') ? 'ownership' : 'requests'}/${n.payload.request}">Open request</a>` : n.payload.item ? `<a class="link" href="/app/items/${n.payload.item}">Open</a>` : ''}</li>`).join('')}</ol>` : '<p class="quiet">No notices.</p>'}`
}
export function requestsPage(d: any) {
 const decide = d.decide.map((r: any) => `<li><span>${esc(r.requester)} asks for ${esc(r.role)} access to ${r.itemName ? `<a class="link" href="/app/items/${esc(r.item)}">${esc(r.itemName)}</a>` : 'an item that is gone'} · ${stamp(r.at)}</span> <a class="link" href="/app/requests/${r.id}">Decide</a></li>`).join('')
 const mine = d.mine.map((r: any) => `<li><span>${esc(r.role)} access to <a class="link" href="/app/items/${esc(r.item)}">${r.itemName ? esc(r.itemName) : 'the item you asked for'}</a>${r.itemName ? '' : ' (its name shows once you have access)'} · ${esc(r.status)}${r.grantedRole ? ` as ${esc(r.grantedRole)}` : ''} · ${stamp(r.at)}</span></li>`).join('')
 return head('Access requests') + `${card('Waiting for your decision', decide ? `<ul class="events">${decide}</ul>` : '<p class="quiet">None.</p>')}${card('Your requests', mine ? `<ul class="events">${mine}</ul>` : '<p class="quiet">None.</p>')}`
}
export function requestPage(r: any) {
 const open = r.status === 'pending' && r.approvers
 const roles = ['viewer', 'commenter', 'editor'].slice(0, ['viewer', 'commenter', 'editor'].indexOf(r.role) + 1).map(x => ({ id: x, label: x }))
 return head('Access request', `${esc(r.requester)} asked for ${esc(r.role)} access${r.itemName ? ` to <a class="link" href="/app/items/${r.item}">${esc(r.itemName)}</a>` : ''}. Status: ${esc(r.status)}.`) + `<section class="card">${r.message ? `<p>${esc(r.message)}</p>` : ''}${open ? form(`/requests/${r.id}`, hidden('decision', 'approve') + select('Grant role', 'role', roles, r.role), 'Approve', `/app/requests/${r.id}`, inline) + form(`/requests/${r.id}`, hidden('decision', 'decline'), 'Decline', `/app/requests/${r.id}`, inline) : ''}</section>`
}
// Sync devices: no desktop or phone sync app ships yet, so the page says so and points to what works today. Keys made
// for a client stay listed until revoked; the command-line companion can enroll separately.
export function devicesPage(rows: any[], reports: Diagnosis[] = []) {
 const device = (d: any) => `<li class="row-tabbed"><div class="row-card person"><div class="person-facts"><strong>${esc(d.name)}</strong><span class="mono">${esc(d.platform)} · ${esc(d.owner)} · last contact ${d.lastSeen ? stamp(d.lastSeen) : 'never'}${d.revokedAt ? ` · revoked ${stamp(d.revokedAt)}` : ''}</span></div>${d.revokedAt ? '' : `<div class="row-actions">${form(`/devices/${d.id}/revoke`, '', 'Revoke device', '/app/devices', inline)}</div>`}</div></li>`
 const meanwhile = `<ul class="plain-list"><li><strong>On a computer:</strong> open a folder in <a class="link" href="/app/files">Files</a> and drag files onto the page, or use Choose files. Big files show their progress and carry on after a dropped connection.</li><li><strong>On a phone:</strong> open this Chest in the phone's browser. Upload offers the camera and your photo library.</li><li><strong>A whole folder or another service:</strong> <a class="link" href="/app/move-in">Move in</a> brings a folder from your computer, or a Google Drive, Dropbox or Box download, with its folders.</li><li><strong>Taking files with you:</strong> download any file from its page. Every earlier version stays in Chest.</li></ul>`
 return head('Sync devices', 'Signed desktop and phone sync apps are not available yet. The command-line companion can check and repair a selected folder.') + `${card('Use these meanwhile', meanwhile)}${repairPanel(reports)}${rows.length ? `<h2 class="section-title">Device keys</h2><p class="quiet">Revoking a key stops it on its next request.</p><ul class="rows rows-wide">${rows.map(device).join('')}</ul>` : ''}`
}
export function secretPage(title: string, value: string, note: string, back: string) { return head(title, note) + `<section class="card"><pre class="receipt">${esc(value)}</pre><p class="card-foot"><a class="link" href="${esc(back)}">Return</a></p></section>` }
