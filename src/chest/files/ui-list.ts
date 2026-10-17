import { esc, field, form, hidden, details, icon, tile, kindOf, onDay } from '../ui-shared'
// The file browser's shared parts: a folder's contents as a file table, the upload drop area with per-file progress,
// the toolbar that adds files and folders, and a folder's recent restores. Every action is a form posted through the
// same API functions; /chest-upload.js adds uploads with progress, resuming and drag-and-drop on top of the plain form.
export const size = (n: number | null) => n === null ? '' : n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`
export const roleName = (role: unknown) => String(role ?? '').replace('_', ' ')
// One row: the file-type tile, the name (its link) and where it lives, then access, updated and size, and a chevron.
export function entryRow(e: any) {
 const href = `/app/items/${e.id}`, sized = e.size !== null && e.size !== undefined
 return `<article class="rec file-row"><div class="file-name">${tile(kindOf(e))}<div class="row-text"><h2 class="file-title"><a href="${href}">${esc(e.name)}</a></h2>${e.space?.name || e.snippet ? `<p class="row-sub">${esc(e.space?.name ?? '')}${e.snippet ? ` <span aria-hidden="true">·</span> <span class="file-snippet">${esc(e.snippet)}</span>` : ''}</p>` : ''}</div></div>
 <dl class="file-facts"><div><dt class="sr-only">Your access:</dt><dd><span class="chip chip-violet">${esc(roleName(e.role))}</span></dd></div><div><dt class="sr-only">Updated:</dt><dd>${onDay(e.updatedAt)}</dd></div><div><dt class="sr-only">Size:</dt><dd>${sized ? esc(size(e.size)) : '<span class="quiet" aria-label="No size">—</span>'}</dd></div></dl><a class="rec-open" href="${href}" tabindex="-1" aria-hidden="true">${icon('chevronRight')}</a></article>`
}
// A list of entries as one table card. Empty: the line says so; beside a working upload area (fallback) the line is
// the no-script copy, and the drop area says it with the chest instead.
export function listing(rows: any[], none: string, { label = 'Contents', fallback = false, plain = false } = {}) {
 if (rows.length) return `<section class="records file-table" aria-label="${esc(label)}"><div class="file-head" aria-hidden="true"><span>Name</span><span>Your access</span><span>Updated</span><span>Size</span></div>${rows.map(entryRow).join('')}</section>`
 if (fallback) return `<p class="quiet empty-note" data-upload-fallback>${esc(none)}</p>`
 return plain ? `<p class="quiet empty-note">${esc(none)}</p>` : `<div class="card empty empty-sm"><span class="empty-mark" aria-hidden="true"><img src="/brand/mark.svg" alt="" width="64" height="64"></span><p>${esc(none)}</p></div>`
}
// Restore a folder (or a space) to a date: this opens the preview; nothing changes until it is applied, and an applied
// restore can be undone from its receipt or from the folder page.
export const utc = (at: string) => `${at.slice(0, 16).replace('T', ' ')} UTC`
export const rewindForm = (target: { space?: string; folder?: string }, returnTo: string) => details('Restore to a date', form('/rewind/preview', (target.folder ? hidden('folder', target.folder) : hidden('space', target.space!)) + field('Date and time (UTC)', 'at', '', 'datetime-local') + '<p class="quiet">You see every change before anything happens.</p>', 'Preview restore', returnTo), 'btn btn-outline')
// The latest restores of this folder or space, each with Undo until it is undone.
export const restores = (rows: any[], returnTo: string) => rows.length ? `<section class="card restores" aria-label="Recent restores"><h2><span class="icon-chip">${icon('history')}</span>Recent restores</h2><ul class="rows">${rows.map(r => `<li><div class="row-card"><p class="row-main row-sub">Restored to ${esc(utc(r.at))} by ${esc(r.by)} · ${r.items.length} item(s)${r.undone ? ` · undone by ${esc(r.undone.by)}` : ''}</p>${r.undone ? '' : form(`/rewind/${r.id}/undo`, '', 'Undo', returnTo, { className: 'form form-inline', buttonClass: 'btn btn-outline btn-sm' })}</div></li>`).join('')}</ul></section>` : ''
// Uploads: the plain form works everywhere; with the script it gives way to the drop area with progress and resume.
// In an empty folder the drop area carries the empty state: the chest, open and waiting.
export function uploader(target: { space?: string; parent?: string; item?: string }, waiting: any[], returnTo: string, empty = '') {
 const data = target.item ? `data-item="${esc(target.item)}"` : target.parent ? `data-parent="${esc(target.parent)}"` : `data-space="${esc(target.space!)}"`
 const open = waiting.map(u => `<li><span class="mono">${esc(u.name)} · ${Math.floor(u.received * 100 / u.size)}% of ${esc(size(u.size))} received</span>${form(`/uploads/${u.id}/cancel`, '', 'Cancel upload', returnTo, { className: 'form form-inline', buttonClass: 'upload-button' })}</li>`).join('')
 const mascot = empty ? `<span class="empty-mark" aria-hidden="true"><img src="/brand/mark.svg" alt="" width="112" height="112"></span><h2 class="empty-title">${esc(empty)}</h2>` : `<span class="upload-icon" aria-hidden="true">${icon('cloudUp')}</span>`
 return `<section class="upload${empty ? ' upload-empty' : ''}" data-upload ${data} hidden aria-label="${target.item ? 'Upload a new version' : 'Upload files'}"><div class="upload-drop">${mascot}<p class="upload-hint"><strong>${target.item ? 'Drop the new version here' : 'Drop files here'}</strong> <span class="quiet">or</span></p><div class="upload-picks"><label class="btn">${icon('upload')}${target.item ? 'Choose file' : 'Choose files'}<input class="upload-input" type="file" ${target.item ? '' : 'multiple'} data-pick></label><label class="btn btn-outline upload-camera">Take a photo<input class="upload-input" type="file" accept="image/*" capture="environment" data-pick></label></div><p class="quiet upload-note">Large files go up in parts. If the connection drops they pick up where they stopped.</p></div>${open ? `<div class="upload-waiting"><h3>Unfinished uploads</h3><p class="quiet">Choose or drop the same file again to continue from where it stopped.</p><ul class="events">${open}</ul></div>` : ''}<ol class="upload-list" data-list aria-live="polite"></ol><button type="button" class="btn btn-outline" data-refresh hidden>Show the new files</button></section>`
}
export function addHere(target: { space?: string; parent?: string }, returnTo: string, waiting: any[] = [], more = '', empty = '') {
 const where = target.parent ? hidden('parent', target.parent) : hidden('space', target.space!)
 return `<div class="doc-actions">${details('Upload a file', form('/items', where + hidden('type', 'file') + field('File', 'file', '', 'file'), 'Upload file', returnTo), 'btn').replace('<details class="disclosure">', '<details class="disclosure" data-upload-fallback>')}${details('New folder', form('/items', where + hidden('type', 'folder') + field('Folder name', 'name'), 'Create folder', returnTo), 'btn btn-outline')}${more}</div>${uploader(target, waiting, returnTo, empty)}`
}
