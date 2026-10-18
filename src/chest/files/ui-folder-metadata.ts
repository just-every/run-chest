import { card, details, esc, fieldWarnings, form, select } from '../ui-shared'
import { typedFields } from '../ui-fields'

export function folderMetadataPanel(d: any, people: any[], returnTo: string) {
 const metadata = d.metadata
 if (!metadata?.schema || d.item.type !== 'file') return ''
 const filing = metadata.filing, schema = metadata.schema
 const saved = Object.entries(filing?.fields ?? {}).map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(typeof value === 'string' ? value : JSON.stringify(value))}</dd></div>`).join('')
 const owner = filing?.owner ? `<p>Accountable person: <span class="mono">${esc(filing.owner)}</span></p>` : ''
 const editing = d.can.manage ? details('Edit typed filing', form(`/items/${d.id}/filing`, typedFields([schema], { schema: schema.id, fields: filing?.fields ?? {} }) + select('Responsible owner', 'owner', people.filter(p => p.payload.status !== 'inactive').map(p => ({ id: p.id, label: `${p.payload.name} · ${p.id}` })), filing?.owner ?? d.me), 'Save typed filing', returnTo)) : ''
 return card('Typed filing', `<p>${esc(schema.payload.name)}</p>${owner}${saved ? `<dl class="doc-typed">${saved}</dl>` : '<p class="quiet">No values saved yet.</p>'}${editing}`, 'side-card') + fieldWarnings(metadata.issues)
}

// Place in any upload or create form targeting a typed folder; ordinary folders need no fields.
export function folderFilingInputs(metadata: any, people: any[], actor: string) {
 if (!metadata?.schema) return ''
 return typedFields([metadata.schema], { schema: metadata.schema.id }) + select('Responsible owner', 'owner', people.filter(p => p.payload.status !== 'inactive').map(p => ({ id: p.id, label: `${p.payload.name} · ${p.id}` })), actor)
}
