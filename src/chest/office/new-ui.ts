import { card, details, esc, field, form, hidden, select } from '../ui-shared'

const kinds = [{ id: 'document', label: 'Document' }, { id: 'spreadsheet', label: 'Spreadsheet' }, { id: 'presentation', label: 'Presentation' }]
const where = (target: { space?: string; parent?: string }) => target.parent ? hidden('parent', target.parent) : hidden('space', target.space!)

export function newFileMenu(target: { space?: string; parent?: string }, returnTo: string, gallery: any) {
 if (!gallery) return ''
 const forms = kinds.map(kind => {
  const templates = gallery.templates.filter((t: any) => t.kind === kind.id)
  return form('/new-files', where(target) + hidden('kind', kind.id) + hidden('key', crypto.randomUUID()) + field(`New ${kind.id} name (optional)`, 'name', '', 'text', false) + select(`${kind.label} template`, 'template', [{ id: '', label: 'Blank' }, ...templates.map((t: any) => ({ id: t.id, label: `${t.name} · ${t.category}` }))], '', false), `Create ${kind.id}`, returnTo)
 }).join('')
 return details('New', `<p class="quiet">Create an independent ${gallery.format === 'odf' ? 'OpenDocument' : 'Office'} file here. Documents and spreadsheets in Office format open in Chest’s text and cell editor. Presentations and OpenDocument files can be downloaded for editing.</p>${forms}`, 'btn')
}

export function templatePublisher(d: any, people: any[], groups: any[], returnTo: string) {
 if (d.item.type !== 'file' || !(d.can.administer || d.ownerRole) || !/\.(docx|xlsx|pptx|odt|ods|odp)$/i.test(d.item.name)) return ''
 const audiences = [...(d.ownerRole ? [{ id: 'organisation', label: 'Everyone in this Chest' }, ...groups.map(g => ({ id: `group:${g.id}`, label: `Group · ${g.payload.name}` }))] : []), ...(d.space.kind === 'team' ? [{ id: `space:${d.space.id}`, label: `This space · ${d.space.name}` }] : [])]
 if (!audiences.length) return ''
 return card('Publish a template', `<p class="quiet">Publish a snapshot of this file’s current version. People in the selected audience can create independent files from it without access to this source. Later source edits do not change the published template.</p>${form('/templates', hidden('source', d.id) + field('Template name', 'name', d.item.name.replace(/\.[^.]+$/, '')) + field('Category', 'category') + select('Template audience', 'templateAudience', audiences), 'Publish template', returnTo, { buttonClass: 'btn btn-outline btn-block' })}`, 'side-card')
}

export function templatesPage(gallery: any, settings: any, groups: any[], admin: boolean) {
 const formats = [{ id: 'office', label: 'Office · DOCX, XLSX, PPTX' }, { id: 'odf', label: 'OpenDocument · ODT, ODS, ODP' }]
 const preferences = admin ? card('New file format', `<p class="quiet">This applies to new blank files and built-in templates. Published templates keep their original format. Existing files stay as they are. Group overrides apply to members of that group.</p>${form('/creation-settings', select('Organization default', 'format', formats, settings.format) + groups.map(g => select(`Format for ${g.payload.name}`, `format:${g.id}`, [{ id: '', label: 'Use organization default' }, ...formats], settings.groups.find((r: any) => r.group === g.id)?.format ?? '', false)).join(''), 'Save creation settings', '/app/templates')}`) : ''
 const rows = gallery.templates.map((t: any) => `<li><img src="${esc(t.thumbnail)}" width="96" height="64" alt=""><strong>${esc(t.name)}</strong> · ${esc(t.kind)} · ${esc(t.category)}${t.extension ? ` · ${esc(t.extension.toUpperCase())}` : ''}${!t.builtin && t.canUnpublish ? form(`/templates/${t.id}/unpublish`, '', 'Unpublish', '/app/templates', { buttonClass: 'btn btn-outline' }) : ''}</li>`).join('')
 return `<div class="page-head"><h1>Templates &amp; new files</h1><p class="lede">Open any folder and choose New to create a blank file or use a template. Publish organization or space templates from an Office or OpenDocument file’s page.</p></div><p><a class="link" href="/app/files">Back to Files</a></p>${preferences}${card('Available templates', `<ul class="events">${rows}</ul>`)}`
}
