import { esc, form, hidden, icon, when } from '../ui-shared'
import { agentMark, icons } from '../../ui/icons'
import { size } from './ui-table'
import type { Agent, Conflict } from './folder-view'
// The folder browser's own parts in the picked app look: the heavy title with the open folder in violet, the
// Chest agent strip, the amber sync-conflict banner with both copies side by side, and the empty folder on grid
// paper. The table is ui-table.ts and the details panel ui-panel.ts.
const inline = (cls = 'btn btn-outline btn-sm') => ({ className: 'form form-inline', buttonClass: cls })

// "Vendors / Acme": the path before the open folder is ink and hidden from the heading's name, so the heading
// is the folder's own name; the open folder is violet.
export function folderTitle(path: string[], name: string, base: string, show: string) {
 const filters = [['', 'All files'], ['files', 'Files'], ['folders', 'Folders']]
 const label = filters.find(f => f[0] === show)?.[1] ?? 'All files'
 const menu = `<details class="menu"><summary class="btn btn-outline btn-sm">${esc(label)}${icon('down')}</summary><div class="menu-panel" role="list">${filters.map(([k, l]) => `<a role="listitem" href="${esc(base)}${k ? `?show=${k}` : ''}"${k === show ? ' aria-current="true"' : ''}>${l}</a>`).join('')}</div></details>`
 return `<div class="ftitle"><h1>${path.length ? `<span aria-hidden="true">${esc(path.join(' / '))} / </span>` : ''}<span class="ftitle-open">${esc(name)}</span></h1><div class="ftitle-tools">${menu}<a class="icon-button icon-button-box" href="#contents" aria-label="Jump to the file list">${icons.list}</a></div></div>`
}
// The agent sits above the table as a quiet colleague: what it filed today with Undo, duplicates it found and links
// open outside the team, each with Review. Nothing here acts on its own.
export function agentStrip(a: Agent, returnTo: string) {
 const filed = a.latest ? (() => { const [what, to] = a.latest.message.split(' → '); return `<div class="ag-item"><span class="ag-dot ag-ok">${icons.check}</span><div class="ag-text"><span>${esc(what)}</span><span class="quiet">${to ? `to ${esc(to)}` : ''}${a.latest.undo ? ` <span aria-hidden="true">·</span> ${form(`/filing/moves/${a.latest.undo}/undo`, '', 'Undo', returnTo, { className: 'form ag-form', buttonClass: 'link-button' })}` : ''}</span></div></div>` })() : ''
 const dupes = a.duplicates ? `<div class="ag-item"><span class="ag-dot">${icons.document}</span><div class="ag-text"><span>${a.duplicates.count} duplicate${a.duplicates.count === 1 ? '' : 's'} of ${esc(a.duplicates.name.replace(/\.[^.]+$/, ''))} found <span aria-hidden="true">·</span> <a class="link" href="/app/filing/duplicates">Review</a></span></div></div>` : ''
 const wide = a.external ? `<div class="ag-item"><span class="ag-dot ag-warn">!</span><div class="ag-text"><span>Link on ${esc(a.external.name.replace(/\.[^.]+$/, ''))} shared outside the team <span aria-hidden="true">·</span> <a class="link" href="/app/links">Review</a></span></div></div>` : ''
 const quiet = !filed && !dupes && !wide ? '<div class="ag-item"><p class="quiet ag-text">Nothing to review here. <a class="link" href="/app/filing">Filing agents</a> shows every move it makes.</p></div>' : ''
 return `<section class="agent" aria-label="Chest agent">${agentMark}<div class="ag-intro"><h2>Chest agent</h2><p class="quiet">${a.filedToday} thing${a.filedToday === 1 ? '' : 's'} filed today</p></div>${filed}${dupes}${wide}${quiet}</section>`
}
const deviceIcon = (name: string) => /phone|ipad|android|pixel|galaxy|mobile/i.test(name) ? icons.phone : icons.laptop
const copy = (c: Conflict['original']) => `<div class="cf-copy"><span class="cf-icon">${deviceIcon(c.device)}</span><div><p><strong>${esc(c.device)}</strong></p><p class="quiet">${when(c.at)} <span aria-hidden="true">·</span> ${esc(size(c.size))}</p></div></div>`
// Both copies are kept by the sync service. Keep both renames the copy after its device; Keep (current) moves the
// copy to trash, where it can be restored; the copy itself opens to compare.
export function conflictBanner(c: Conflict, returnTo: string, canManage: boolean, canRename: boolean) {
 const first = (who: string) => esc(who.split(/[\s@]/)[0])
 const keepBoth = canRename ? form(`/items/${c.copy.item}/rename`, hidden('name', c.keepBothName), 'Keep both', returnTo, inline()) : ''
 const keepCurrent = canManage ? form(`/items/${c.copy.item}/trash`, '', `Keep ${first(c.original.by)}’s`, returnTo, inline('btn btn-sm')) : ''
 return `<section class="conflict" aria-label="Sync conflict"><div class="cf-head"><span class="cf-mark" aria-hidden="true">!</span><div><h2>Sync conflict: ${esc(c.original.name)} was edited on two devices</h2><p class="quiet">Choose which version to keep, or keep both.</p></div></div><div class="cf-choices">${copy(c.original)}${copy(c.copy)}<div class="cf-actions">${keepBoth}<a class="btn btn-outline btn-sm" href="/app/items/${esc(c.copy.item)}">Open ${first(c.copy.by)}’s copy</a>${keepCurrent}</div></div></section>`
}
export const emptyFolder = (message: string, contribute: boolean) => `<div class="empty-state empty-grid"><span class="empty-icon">${icons.folder}</span><p class="empty-title">${esc(message)}</p><p class="quiet">${contribute ? 'Drop files here, or use New and Upload above.' : 'Files added here appear in this list.'}</p></div>`
// A folder's or space's own tools (access, sharing, links, file requests, review, members and settings) wait behind
// one disclosure under its details, as the picked look keeps the panel quiet; Share and Manage open it (?manage).
export const manageTools = (what: 'folder' | 'space', hint: string, cards: string, open: boolean) => cards.trim() ? `<details class="manage-folder"${open ? ' open' : ''}><summary><span>Manage this ${what}</span><span class="quiet">${esc(hint)}</span></summary><div class="manage-cards">${cards}</div></details>` : ''
