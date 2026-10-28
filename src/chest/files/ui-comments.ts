import { threadNavigation } from './comments'
import { esc, field, area, select, form, hidden, details, stamp } from '../ui-shared'

const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const recipientFields = () => field('Mention people (email addresses, comma separated)', 'mentions', '', 'text', false) + field('Assign comment (email address)', 'assignee', '', 'email', false)
const versionNumber = (d: any, id: string) => d.versions.length - d.versions.findIndex((v: any) => v.id === id)
const percent = (n: number) => Math.round(n * 10000) / 100
function coordinate(label: string, name: string, value: number, max = 100) {
 return field(label, name, String(value), 'number').replace(' required', ` min="0" max="${max}" step="0.1" required`)
}
function annotationForm(d: any, returnTo: string) {
 const pdfs = d.versions.filter((v: any) => v.mediaType === 'application/pdf' && (!v.sourceItem || v.sourceItem === d.id))
 if (!pdfs.length || !d.can.comment) return ''
 const versions = pdfs.map((v: any) => ({ id: v.id, label: `Version ${versionNumber(d, v.id)} · ${v.name || v.filename}${v.id === d.item.current ? ' · current' : ''}` }))
 const fields = hidden('anchorType', 'pdf') + select('PDF version', 'version', versions, d.item.current)
  + field('PDF page', 'page', '1', 'number').replace(' required', ' min="1" step="1" required')
  + '<p class="quiet">Mark the region as percentages from the page’s top left.</p><div class="form-grid">'
  + coordinate('Left (%)', 'left', 10) + coordinate('Top (%)', 'top', 10) + coordinate('Right (%)', 'right', 90) + coordinate('Bottom (%)', 'bottom', 30) + '</div>'
  + area('Annotation', 'message', '') + recipientFields()
 return details('Annotate a PDF', form(`/items/${d.id}/comments`, fields, 'Post annotation', returnTo, { buttonClass: 'btn btn-outline' }), 'btn btn-outline')
}
function carryForm(d: any, c: any, returnTo: string) {
 const pdfs = d.versions.filter((v: any) => v.id !== c.version && v.mediaType === 'application/pdf' && (!v.sourceItem || v.sourceItem === d.id))
 if (!c.anchor || !pdfs.length || !d.can.comment) return ''
 const fields = hidden('key', crypto.randomUUID()) + hidden('expectedCurrent', d.item.current) + hidden('anchorType', 'pdf')
  + '<p>Start a new thread with the same text, mentions and assignee. Choose its page and region. The original discussion stays unchanged.</p>'
  + select('Destination PDF version', 'version', [{ id: '', label: 'Choose a version' }, ...pdfs.map((v: any) => ({ id: v.id, label: `Version ${versionNumber(d, v.id)}${v.id === d.item.current ? ' · current' : ''}` }))])
  + field('Destination PDF page', 'page', '1', 'number').replace(' required', ' min="1" step="1" required')
  + '<p class="quiet">Region percentages from the destination page’s top left.</p><div class="form-grid">'
  + coordinate('Left (%)', 'left', 10) + coordinate('Top (%)', 'top', 10) + coordinate('Right (%)', 'right', 90) + coordinate('Bottom (%)', 'bottom', 30) + '</div>'
 return details('Carry thread forward', form(`/items/${d.id}/comments/${c.id}/carry`, fields, 'Create linked thread', returnTo, { buttonClass: 'btn btn-outline' }), 'btn btn-outline')
}
function navigation(d: any, returnTo: string) {
 const n = d.annotationNavigation
 if (!n) return ''
 const link = (id: string, label: string) => `<a class="btn btn-outline" href="${esc(returnTo)}?thread=${esc(id)}#comment-${esc(id)}">${label}</a>`
 return `<nav aria-label="Unresolved PDF threads"><p>${n.threads.length ? `Unresolved PDF thread ${n.position} of ${n.threads.length}` : 'No unresolved PDF threads.'}</p><div class="doc-actions">${n.previous ? link(n.previous, 'Previous unresolved') : ''}${n.selected ? link(n.selected, 'Open selected thread') : ''}${n.next ? link(n.next, 'Next unresolved') : ''}</div></nav>`
}
function allNavigation(d: any, returnTo: string) {
 const rows = d.comments.filter((c: any) => !c.resolved)
 if (!rows.some((c: any) => !c.anchor)) return ''
 const selected = rows.some((c: any) => c.id === d.focusComment) ? d.focusComment : null
 const n = threadNavigation<{ id: string }>(rows, selected)
 const link = (id: string, label: string) => `<a class="btn btn-outline" href="${esc(returnTo)}?comment=${esc(id)}#comment-${esc(id)}">${label}</a>`
 return `<nav aria-label="All unresolved comments"><p>Open comment ${n.position} of ${rows.length}</p><div class="doc-actions">${n.previous ? link(n.previous, 'Previous comment') : ''}${n.selected ? link(n.selected, 'Open comment') : ''}${n.next ? link(n.next, 'Next comment') : ''}</div></nav>`
}
function original(d: any, c: any) {
 if (!c.version) return ''
 const v = d.versions.find((v: any) => v.id === c.version), label = `Version ${versionNumber(d, c.version)}`, old = c.version !== d.item.current
 const base = `/api/chest/items/${d.id}`
 const href = c.anchor ? d.can.download ? `${base}/bytes/${c.version}#page=${c.anchor.page}` : `${base}/rendered-preview/${c.version}?page=${c.anchor.page}` : v?.mediaType?.includes('officedocument') ? d.can.download ? `${base}/office-preview/${c.version}` : `${base}/rendered-preview/${c.version}` : d.can.download ? `${base}/bytes/${c.version}` : ''
 const link = href ? `<a class="link" href="${esc(href)}" target="_blank" rel="noopener">${c.anchor ? 'Open original page' : 'Open original version'}</a>` : ''
 const location = c.anchor ? ` · Page ${c.anchor.page} · Region ${c.anchor.region.map((n: number) => percent(n) + '%').join(', ')}` : ''
 return `<p class="mono">${esc(label)}${old ? ' · earlier version' : ''}${esc(location)}${link ? ` · ${link}` : ''}</p>`
}
function thread(d: any, c: any, returnTo: string) {
 const path = `/items/${d.id}/comments/${c.id}`
 const replies = (c.replies ?? []).map((r: any) => `<li><span class="mono">${esc(r.author)} · ${stamp(r.at)}</span><p>${esc(r.message)}</p>${r.mentions?.length ? `<p>Mentioned: ${r.mentions.map(esc).join(', ')}</p>` : ''}</li>`).join('')
 const provenance = c.imported ? `<p class="mono">Migrated from ${esc(c.imported.provider)} · Source file ${esc(c.imported.file)} · Source thread ${esc(c.imported.id)}</p>${c.imported.anchorMissing ? `<p>Anchor not found</p><blockquote>${esc(c.imported.quotedText)}</blockquote>` : ''}${c.assignmentGap ? `<p>${esc(c.assignmentGap)}</p>` : ''}` : ''
 const state = c.resolved ? `<p class="quiet">Resolved by ${esc(c.resolved.by)} · ${stamp(c.resolved.at)}</p>` : ''
 const controls = d.can.comment ? `<div class="doc-actions">${form(`${path}/resolve`, hidden('decision', c.resolved ? 'reopen' : 'resolve'), c.resolved ? 'Reopen thread' : 'Resolve thread', returnTo, inline)}${!c.resolved ? details('Reply', form(`${path}/reply`, area('Reply', 'message', ''), 'Post reply', returnTo, { buttonClass: 'btn btn-outline' }), 'btn btn-outline') : ''}</div>` : ''
 const lineage = c.carriedFrom ? `<p>Carried forward by ${esc(c.carriedFrom.by)} from <a class="link" href="${esc(returnTo)}?comment=${esc(c.carriedFrom.thread)}#comment-${esc(c.carriedFrom.thread)}">original thread · Version ${versionNumber(d, c.carriedFrom.version)} · Page ${c.carriedFrom.anchor.page}</a></p>` : ''
 return `<li id="comment-${esc(c.id)}" data-comment="${esc(c.id)}"><span class="mono">${esc(c.author)} · <span class="nowrap">${stamp(c.at)}</span></span>${original(d, c)}${provenance}${lineage}<p>${esc(c.message)}</p>${c.assignee ? `<p>Assigned to ${esc(c.assignee)}</p>` : ''}${c.taskCustodians?.length ? `<p>Task custodians: ${c.taskCustodians.map(esc).join(', ')}</p>` : ''}${c.mentions?.length ? `<p>Mentioned: ${c.mentions.map(esc).join(', ')}</p>` : ''}${state}${replies ? `<ol class="events" aria-label="Replies">${replies}</ol>` : ''}${controls}${carryForm(d, c, returnTo)}</li>`
}
export function commentsPanel(d: any, returnTo: string) {
 const open = d.comments.filter((c: any) => !c.resolved), resolved = d.comments.filter((c: any) => c.resolved)
 const list = (rows: any[]) => `<ol class="events">${rows.map(c => thread(d, c, returnTo)).join('')}</ol>`
 const body = open.length ? list(open) : `<p class="quiet">${resolved.length ? 'No open comments.' : 'No comments yet.'}</p>`
 const closed = resolved.length ? details(`Resolved threads (${resolved.length})`, list(resolved), 'btn btn-outline').replace('<details ', resolved.some((c: any) => c.id === d.focusComment) ? '<details open ' : '<details ') : ''
 const composer = d.can.comment ? form(`/items/${d.id}/comments`, (d.item.type === 'file' ? hidden('version', d.item.current) : '') + area('Comment', 'message', '') + recipientFields(), 'Post comment', returnTo, { buttonClass: 'btn btn-outline' }) : ''
 return `<section aria-label="Comments"><h2 class="section-title">Comments</h2><p><a class="link" href="/app/notices#tasks">Your assigned comments</a>${d.ownerRole && d.item.type === 'file' && d.can.contribute ? ` · <a class="link" href="${returnTo}/import-comments">Import review threads</a>` : ''}</p>${navigation(d, returnTo)}${allNavigation(d, returnTo)}${body}${closed}${composer}${annotationForm(d, returnTo)}</section>`
}
