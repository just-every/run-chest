import { esc, hidden, icon, avatar, when, day } from '../ui-shared'
import { fileKind, fileTile, type FileKind } from '../../ui/icons'
import type { Row as FolderRow, Sync } from './folder-view'
// The dense file table of the picked app look: a checkbox (the selection for Selected items), the name with its
// file-type tile, then the facts. A folder shows Sync, Modified, By, Size, Sharing and Version; other lists (search,
// Shared with me, Recent, Starred) show where each file lives, when it changed, its size and your access. Clicking a
// row outside its links opens it in the details panel; the name opens the file or folder itself.
export const size = (n: number | null) => n === null || n === undefined ? '' : n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1).replace(/\.0$/, '')} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(1).replace(/\.0$/, '')} GB`
export const kindLabels: Record<FileKind, string> = { word: 'Word document', sheet: 'Excel workbook', slides: 'PowerPoint presentation', pdf: 'PDF document', image: 'Image', archive: 'ZIP archive', text: 'Text file', file: 'File', folder: 'Folder' }
export const kindOf = (name: string, type = 'file') => kindLabels[fileKind(name, type)]
const syncWords: Record<Sync, [string, 'cloud' | 'sync' | 'warn' | 'cloudOff']> = { synced: ['Synced', 'cloud'], syncing: ['Syncing', 'sync'], conflict: ['Conflict', 'warn'], paused: ['Paused', 'cloudOff'], failed: ['Needs repair', 'warn'], cloud: ['Cloud only', 'cloud'] }
export const syncCell = (s: Sync, note: string) => `<span class="sync sync-${s}" title="${esc(note)}">${icon(syncWords[s][1])}<span>${syncWords[s][0]}</span></span>`
export function people(list: { email: string; name: string }[], max = 2) {
 if (!list.length) return ''
 return `<span class="faces" title="${esc(list.map(p => p.name).join(', '))}">${list.slice(0, max).map(p => avatar(p)).join('')}${list.length > max ? `<span class="avatar avatar-more" aria-hidden="true">+${list.length - max}</span>` : ''}<span class="sr-only">Shared with ${list.length} ${list.length === 1 ? 'person' : 'people'}</span></span>`
}
const sharing = (r: FolderRow) => r.sharing.link ? `<span class="ft-link" title="A link for anyone${r.sharing.link.expires ? `, expires ${day(r.sharing.link.expires)}` : ', no expiry'}">Link${r.sharing.link.expires ? `, expires ${day(r.sharing.link.expires)}` : ''}</span>` : r.sharing.people.length ? people(r.sharing.people) : '<span class="quiet">—</span>'
const state = (approval: FolderRow['approval']) => approval === 'approved' ? '<span class="chip chip-ok">approved</span>' : approval ? '<span class="chip chip-warn">in review</span>' : ''
const version = (r: FolderRow) => r.type === 'folder' ? '' : `<span class="ft-vers"><span><span class="vchip">v${r.version}</span>${state(r.approval)}</span>${r.pending ? `<span class="ft-pending"><span class="vchip">v${r.pending}</span>${state('in review')}</span>` : ''}</span>`
const check = (id: string, name: string) => `<label class="ft-check"><input type="checkbox" name="items" value="${esc(id)}"><span class="sr-only">Select ${esc(name)}</span></label>`
const nameCell = (r: { id: string; name: string; type: string }, extra = '') => `<span class="ft-name">${fileTile(fileKind(r.name, r.type))}<span class="ft-title"><a href="/app/items/${esc(r.id)}" title="${esc(r.name)}">${esc(r.name)}</a>${extra}</span></span>`
// The selection form wraps the table so its checkboxes, count and buttons are one form (chest-bulk.js keeps the
// selection across folders and search in this tab).
function selection(body: string, returnTo: string) {
 return `<form method="get" action="/app/bulk" class="bulk-selection" aria-label="Select files and folders">${hidden('returnTo', returnTo)}${body}<div class="ft-foot"><p data-selection-count aria-live="polite"></p><button class="btn btn-outline btn-sm">Actions for selected items</button><button type="button" class="btn btn-quiet btn-sm" data-clear-selection>Clear selection</button></div></form>`
}
export function folderTable(rows: FolderRow[], base: string, selected: string | null, returnTo: string) {
 const head = `<li class="ft-head"><label class="ft-check"><input type="checkbox" data-select-all><span class="sr-only">Select every item in this list</span></label><span>Name ${icon('up')}</span><span>Sync</span><span>Modified</span><span>By</span><span>Size</span><span>Sharing</span><span>Version</span></li>`
 const row = (r: FolderRow) => `<li class="ft-row${r.id === selected ? ' is-selected' : ''}">${check(r.id, r.name)}${nameCell(r)}<span class="ft-sync" data-label="Sync">${r.type === 'file' ? syncCell(r.sync, r.syncNote) : ''}</span><span class="ft-mod" data-label="Modified">${when(r.updatedAt)}</span><span class="ft-by" data-label="By">${r.by ? `${avatar(r.by)}<span>${esc(r.by.name)}</span>` : ''}</span><span class="ft-size" data-label="Size">${esc(r.size !== null && r.size < 1024 ? `${r.size} B` : size(r.size))}</span><span class="ft-share" data-label="Sharing">${sharing(r)}</span><span class="ft-ver" data-label="Version">${version(r)}</span>${r.type === 'file' ? `<a class="ft-pick" href="${esc(base)}?file=${esc(r.id)}" tabindex="-1" aria-hidden="true"></a>` : ''}</li>`
 return selection(`<ul class="ftable ftable-folder" aria-label="Contents">${head}${rows.map(row).join('')}</ul>`, returnTo)
}
// Lists outside a folder: search results (with the matching words), Shared with me, Recent and Starred.
export function listTable(rows: any[], none: string, selectable = false, returnTo = '/app/files') {
 if (!rows.length) return `<div class="empty-state"><p>${esc(none)}</p></div>`
 const head = `<li class="ft-head">${selectable ? '<label class="ft-check"><input type="checkbox" data-select-all><span class="sr-only">Select every item in this list</span></label>' : ''}<span>Name</span><span>Location</span><span>Modified</span><span>Size</span><span>Your access</span></li>`
 const row = (e: any) => {
  const match = `${e.versionLabel ? `<span class="ft-sub">${esc(e.versionLabel)}</span>` : ''}${e.snippet ? `<span class="ft-sub ft-snippet">${esc(e.snippet)}</span>` : ''}${e.until ? `<span class="ft-sub">Until ${when(e.until)}</span>` : ''}`
  return `<li class="ft-row">${selectable ? check(e.id, e.name) : ''}${nameCell(e, match)}<span class="ft-place" data-label="Location">${esc(e.space?.name ?? '')}</span><span class="ft-mod" data-label="${e.sharedAt ? 'Shared' : 'Modified'}">${when(e.sharedAt ?? e.updatedAt ?? '')}</span><span class="ft-size" data-label="Size">${esc(size(e.size ?? null))}</span><span class="ft-role" data-label="Your access">${esc(String(e.role ?? '').replace('_', ' '))}</span></li>`
 }
 const table = `<ul class="ftable ftable-list${selectable ? '' : ' no-check'}" aria-label="Contents">${head}${rows.map(row).join('')}</ul>`
 return selectable ? selection(table, returnTo) : table
}
