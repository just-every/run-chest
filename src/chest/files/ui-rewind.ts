import { esc, form, hidden } from '../ui-shared'
import { utc } from './ui-list'
// Restoring a folder or space to a date: the preview of every change (nothing happens until it is applied), the
// receipt with Undo, and the receipt of an undo.
const effect = (c: any) => c.kinds.map((k: string) => ({ 'earlier version': `back to the version from ${utc(c.versionAt ?? '')}`, name: `renamed back to “${c.renameTo}”`, place: 'moved back to where it was', 'trashed then': 'goes back to trash, where it was then', 'not trashed then': 'brought back from trash', 'added since': 'added since then: moves to trash, where it can still be restored' } as Record<string, string>)[k] ?? k).join('; ')
export function rewindPage(input: any, plan: any) {
 const rows = plan.changes.map((c: any) => `<li class="choice"><label><input type="checkbox" name="item:${esc(c.id)}" value="true" checked><span><strong>${esc(c.name)}</strong> <span class="quiet">${esc(effect(c))}</span></span></label></li>`).join('')
 const removed = plan.sharing.removedSince.map((e: any) => `<li><span class="mono">${esc(e.action)} · ${esc(utc(e.at))}</span></li>`).join('')
 const scope = (input.folder ? hidden('folder', input.folder) : hidden('space', input.space)) + hidden('at', plan.at) + hidden('fingerprint', plan.fingerprint)
 return `<div class="page-head"><h1>Restore preview</h1><p class="lede">Returning to ${esc(utc(plan.at))} changes ${plan.changes.length} item(s). Nothing has changed yet. Each change becomes a new state; later versions and items added since stay recoverable, and you can undo the restore.</p></div><section class="card stack">${rows ? form('/rewind/apply', `<ul class="choices">${rows}</ul>` + scope, 'Restore selected items', input.returnTo || '/app/files') : '<p class="quiet">Nothing changed since then.</p>'}<h2 class="section-title">Sharing</h2><p class="quiet">Sharing is not restored. Access removed since then stays removed.</p>${removed ? `<ul class="events">${removed}</ul>` : ''}<p class="card-foot"><a class="link" href="${esc(input.returnTo || '/app/files')}">Back without restoring</a></p></section>`
}
export function rewindDonePage(input: any, result: any) {
 const back = input.returnTo || '/app/files'
 return `<div class="page-head"><h1>Restored to ${esc(utc(result.at))}</h1><p class="lede">${result.applied.length} item(s) changed. Every later version stays in each file's history.</p></div><section class="card">${form(`/rewind/${result.id}/undo`, '', 'Undo this restore', back, { className: 'form form-inline', buttonClass: 'btn btn-outline' })}<p class="card-foot"><a class="link" href="${esc(back)}">Open the folder</a></p></section>`
}
export function rewindUndonePage(input: any, result: any) {
 const back = input.returnTo || '/app/files'
 return `<div class="page-head"><h1>Restore undone</h1><p class="lede">${result.restored.length} item(s) are back as they were just before the restore.${result.skipped.length ? ` ${result.skipped.length} item(s) changed again after the restore and were left as they are.` : ''}</p></div><section class="card"><p class="card-foot"><a class="link" href="${esc(back)}">Open the folder</a></p></section>`
}
