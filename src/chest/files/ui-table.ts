import { esc, hidden, icon, avatar, when, day } from '../ui-shared'
import { fileKind, fileTile, type FileKind } from '../../ui/icons'
import type { Row as FolderRow, Sync } from './folder-view'
// The dense file table of the picked app look: a checkbox (the selection for Selected items), the name with its
// file-type tile, then the facts. A folder shows Modified, By, Size and one Status line (H16): only what is not the
// default (a sync problem, a version in review, a link, the file's own sharing and its version), the first tag and
// "+n" for the rest. Other lists (search, Shared with me, Recent, Starred) show where each file lives, when it
// changed and its size, and "Your access" only where it is less than the manager's. Clicking a row outside its links
// opens it in the details panel; the name opens the file or folder itself.
export const size = (n: number | null) => n === null || n === undefined ? '' : n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1).replace(/\.0$/, '')} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(1).replace(/\.0$/, '')} GB`
export const kindLabels: Record<FileKind, string> = { word: 'Word document', sheet: 'Excel workbook', slides: 'PowerPoint presentation', pdf: 'PDF document', image: 'Image', archive: 'ZIP archive', text: 'Text file', file: 'File', folder: 'Folder' }
export const kindOf = (name: string, type = 'file') => kindLabels[fileKind(name, type)]
// Only a state worth reading is shown: a file in step with its devices, or held by none, has no tag.
const syncWords: Record<Sync, [string, 'cloud' | 'sync' | 'warn' | 'cloudOff'] | null> = { synced: null, syncing: ['Syncing', 'sync'], conflict: ['Conflict', 'warn'], paused: ['Paused', 'cloudOff'], failed: ['Needs repair', 'warn'], cloud: null }
export const syncCell = (s: Sync, note: string) => { const w = syncWords[s]; return w ? `<span class="sync sync-${s}" title="${esc(note)}">${icon(w[1])}<span>${w[0]}</span></span>` : '' }
export function people(list: { email: string; name: string }[], max = 2) {
 if (!list.length) return ''
 return `<span class="faces" title="${esc(list.map(p => p.name).join(', '))}">${list.slice(0, max).map(p => avatar(p)).join('')}${list.length > max ? `<span class="avatar avatar-more" aria-hidden="true">+${list.length - max}</span>` : ''}<span class="sr-only">Shared with ${list.length} ${list.length === 1 ? 'person' : 'people'}</span></span>`
}
const linkTag = (r: FolderRow) => r.sharing.link ? `<span class="ft-link" title="A link for anyone${r.sharing.link.expires ? `, expires ${day(r.sharing.link.expires)}` : ', no expiry'}">Link${r.sharing.link.expires ? `, expires ${day(r.sharing.link.expires)}` : ''}</span>` : ''
const state = (approval: FolderRow['approval']) => approval === 'approved' ? '<span class="chip chip-ok">approved</span>' : approval ? '<span class="chip chip-warn">in review</span>' : ''
const reviewTag = (r: FolderRow) => r.type === 'folder' || !(r.approval || r.pending) ? '' : `<span class="ft-vers"><span class="vchip">v${r.version}</span>${state(r.approval)}${r.pending ? `<span class="vchip">v${r.pending}</span>${state('in review')}` : ''}</span>`
const versionTag = (r: FolderRow) => r.type === 'folder' || r.version < 2 ? '' : `<span class="vchip">v${r.version}</span>`
// One quiet Status line: the first tag in order of need, then "+n" (its title names the rest).
const status = (r: FolderRow) => {
 const tags = [r.type === 'file' ? syncCell(r.sync, r.syncNote) : '', reviewTag(r), linkTag(r), people(r.sharing.people), versionTag(r)].filter(Boolean)
 return tags.length ? `${tags[0]}${tags.length > 1 ? `<span class="chip chip-more" title="${tags.length - 1} more: ${esc(tags.slice(1).map(t => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).join('; '))}">+${tags.length - 1}</span>` : ''}` : ''
}
const check = (id: string, name: string) => `<label class="ft-check"><input type="checkbox" name="items" value="${esc(id)}"><span class="sr-only">Select ${esc(name)}</span></label>`
const nameCell = (r: { id: string; name: string; type: string }, extra = '') => `<span class="ft-name">${fileTile(fileKind(r.name, r.type))}<span class="ft-title"><a href="/app/items/${esc(r.id)}" title="${esc(r.name)}">${esc(r.name)}</a>${extra}</span></span>`
// The selection form wraps the table so its checkboxes, count and buttons are one form (chest-bulk.js keeps the
// selection across folders and search in this tab).
function selection(body: string, returnTo: string) {
 return `<form method="get" action="/app/bulk" class="bulk-selection" aria-label="Select files and folders">${hidden('returnTo', returnTo)}${body}<div class="ft-foot" hidden><p data-selection-count aria-live="polite"></p><button class="btn btn-outline btn-sm">Actions for selected items</button><button type="button" class="btn btn-quiet btn-sm" data-clear-selection>Clear selection</button></div></form>`
}
export function folderTable(rows: FolderRow[], base: string, selected: string | null, returnTo: string) {
 const head = `<li class="ft-head"><label class="ft-check"><input type="checkbox" data-select-all><span class="sr-only">Select every item in this list</span></label><span>Name ${icon('up')}</span><span>Modified</span><span>By</span><span>Size</span><span>Status</span></li>`
 const row = (r: FolderRow) => `<li class="ft-row${r.id === selected ? ' is-selected' : ''}">${check(r.id, r.name)}${nameCell(r)}<span class="ft-mod">${when(r.updatedAt)}</span><span class="ft-by">${r.by ? `${avatar(r.by)}<span>${esc(r.by.name)}</span>` : ''}</span><span class="ft-size">${esc(r.size !== null && r.size < 1024 ? `${r.size} B` : size(r.size))}</span><span class="ft-status">${status(r)}</span>${r.type === 'file' ? `<a class="ft-pick" href="${esc(base)}?file=${esc(r.id)}" tabindex="-1" aria-hidden="true"></a>` : ''}</li>`
 return selection(`<ul class="ftable ftable-folder" aria-label="Contents">${head}${rows.map(row).join('')}</ul>`, returnTo)
}
// Lists outside a folder: search results (with the matching words), Shared with me, Recent and Starred.
// "Your access" is a fact only when it is less than a manager's, so the column appears when some row has one.
const limited = (e: any) => ['owner', 'manager'].includes(e.role) ? '' : String(e.role ?? '').replace('_', ' ')
export function listTable(rows: any[], none: string, selectable = false, returnTo = '/app/files') {
 if (!rows.length) return `<div class="empty-state"><p>${esc(none)}</p></div>`
 const access = rows.some(limited)
 const head = `<li class="ft-head">${selectable ? '<label class="ft-check"><input type="checkbox" data-select-all><span class="sr-only">Select every item in this list</span></label>' : ''}<span>Name</span><span>Location</span><span>Modified</span><span>Size</span>${access ? '<span>Your access</span>' : ''}</li>`
 const row = (e: any) => {
  const match = `${e.versionLabel ? `<span class="ft-sub">${esc(e.versionLabel)}</span>` : ''}${e.snippet ? `<span class="ft-sub ft-snippet">${esc(e.snippet)}</span>` : ''}${e.until ? `<span class="ft-sub">Until ${when(e.until)}</span>` : ''}`
  return `<li class="ft-row">${selectable ? check(e.id, e.name) : ''}${nameCell(e, match)}<span class="ft-place">${esc(e.space?.name ?? '')}</span><span class="ft-mod">${when(e.sharedAt ?? e.updatedAt ?? '')}</span><span class="ft-size">${esc(size(e.size ?? null))}</span>${access ? `<span class="ft-role">${esc(limited(e))}</span>` : ''}</li>`
 }
 const table = `<ul class="ftable ftable-list${selectable ? '' : ' no-check'}${access ? '' : ' no-access'}" aria-label="Contents">${head}${rows.map(row).join('')}</ul>`
 return selectable ? selection(table, returnTo) : table
}
