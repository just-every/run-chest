import { card, esc, field, form, hidden, select, stamp } from '../ui-shared'

type Choice = { id: string; label: string }
const back = '/app/filing/rules', endpoint = '/filing/agent'
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const checkbox = (name: string, label: string) => `<label class="field"><span><input type="checkbox" name="${esc(name)}" value="true"> ${esc(label)}</span></label>`
const item = (id: string, label: string) => `<a class="link" href="/app/items/${esc(id)}">${esc(label)}</a>`
const names = (value: unknown) => Array.isArray(value) ? value.map(String).join(' / ') : ''

function suggestionRows(suggestions: any[], files: Choice[]) {
 return suggestions.map(row => {
  const p = row.payload ?? row
  const label = p.sourcePath || files.find(file => file.id === p.item)?.label || p.name || p.item
  const decisions = p.state === 'pending' ? form(endpoint, hidden('action', 'apply') + hidden('suggestion', row.id), 'Apply proposal', back, inline)
   + form(endpoint, hidden('action', 'decline') + hidden('suggestion', row.id), 'Decline', back, inline) : ''
  return `<li><strong>${item(p.item, label)}</strong><p>${esc(p.explanation ?? '')}</p>
   <p class="quiet">${esc(p.state)} · ${stamp(p.at)} · Exact version <span class="mono">${esc(p.version)}</span> · Confidence ${esc(p.confidence)}</p>
   <dl><dt>Proposed destination</dt><dd>${esc(p.destinationPath || 'No destination proposed')}</dd>
   <dt>Proposed classification</dt><dd>${esc(names(p.taxonomy) || 'None proposed')}</dd>
   <dt>Proposed responsible person</dt><dd>${esc(p.responsible || 'None proposed')}</dd>
   <dt>Proposed name</dt><dd>${esc(p.proposedName || 'Keep current name')}</dd>
   <dt>Proposed tags</dt><dd>${esc(Array.isArray(p.tags) && p.tags.length ? p.tags.join(', ') : 'None proposed')}</dd></dl>
   <p class="quiet">Classification and responsible-person suggestions do not grant access or assign authority.</p>
   <p><strong>Exact evidence</strong></p><blockquote><pre class="receipt">${esc(p.quote)}</pre></blockquote>
   ${p.uncertainty ? `<p><strong>Uncertainty:</strong> ${esc(p.uncertainty)}</p>` : ''}
   ${p.problem ? `<p role="status"><strong>Blocked:</strong> ${esc(p.problem)}</p>` : ''}
   ${p.state === 'processing' ? '<p role="status">Processing. A completed filing result has not been recorded yet.</p>' : ''}
   ${decisions}</li>`
 }).join('')
}

function standingGrants(scopes: any[], folders: Choice[]) {
 const folder = (id: string) => item(id, folders.find(choice => choice.id === id)?.label || id)
 const rows = scopes.map(row => {
  const p = row.payload
  const destinations = (p.destinations ?? []).map((id: string) => `<li>${folder(id)}</li>`).join('')
  return `<li><strong>${folder(p.source)}</strong><p class="quiet">${p.enabled ? 'Enabled' : 'Paused'} · Granted by ${esc(p.by)} · ${stamp(p.at)}</p>
   ${p.problem?`<p role="status">Waiting: ${esc(p.problem)}</p>`:''}<p>Allowed destinations:</p><ul class="events">${destinations}</ul>
   <p>Minimum confidence ${esc(p.minimumConfidence)} · Rename ${p.allowRename ? 'allowed' : 'off'} · Tag ${p.allowTag ? 'allowed' : 'off'}</p>
   ${form(endpoint, hidden('action', 'scope-toggle') + hidden('scope', row.id) + hidden('enabled', p.enabled ? 'false' : 'true'), p.enabled ? 'Pause' : 'Turn on', back, inline)}
   ${p.enabled ? form(endpoint, hidden('action', 'sweep') + hidden('scope', row.id), 'Classify current inbox files', back, inline) : ''}</li>`
 }).join('')
 const destinations = folders.map(folder => checkbox(`destination:${folder.id}`, folder.label)).join('')
 const confidence = field('Minimum confidence (0–1)', 'minimumConfidence', '0.9', 'number').replace('type="number"', 'type="number" min="0.5" max="1" step="0.01"')
 const grant = folders.length ? form(endpoint, hidden('action', 'grant') + select('Source inbox folder', 'source', folders)
  + `<fieldset><legend>Allowed destination folders</legend><p class="quiet">Select every folder this grant may file into.</p>${destinations}</fieldset>`
  + confidence + checkbox('allowRename', 'Allow proposed renames') + checkbox('allowTag', 'Allow proposed tags'), 'Grant automatic filing', back)
  : '<p class="quiet">Create an inbox and destination folders you can manage to add a permission.</p>'
 return card('Agent permissions', `<p>Give the agent an explicit source inbox and allowed destinations. High-confidence results may move files only within that grant. Renaming and tagging require the options below. Uncertainty waits for approval.</p>
  <p class="quiet">A permission allows no new sharing or deletion. Original bytes are retained. Classification and responsible-person proposals do not change access or authority.</p>
  ${grant}<h3>Current permissions</h3>${rows ? `<ul class="events">${rows}</ul>` : '<p class="quiet">No agent permissions yet.</p>'}`)
}

export function agentPanel(data: any, files: Choice[], folders: Choice[]): string {
 const unavailable = data.message || data.reader?.unavailable || data.reader?.missing
 const ready = data.available !== false && !data.reader?.unavailable && !data.reader?.missing
 const preview = ready && files.length && folders.length ? form(endpoint, hidden('action', 'preview')
  + select('File to classify', 'item', files)
  + select('Proposed destination', 'destination', [{ id: '', label: 'Let agent choose' }, ...folders],'',false), 'Preview filing', back)
  : `<p class="quiet">${!ready ? 'Configure the installation’s AI connection to classify files.' : !files.length ? 'Upload a file first to preview its classification.' : 'Create an accessible destination folder first.'}</p>`
 const suggestions = suggestionRows(data.suggestions ?? [], files)
 return card('AI filing agent', `<p>${esc(unavailable || 'The agent proposes a destination, classification and responsible person from the exact file version and its evidence. Preview a file before deciding what to apply.')}</p>
  <p><a class="link" href="/app/admin">Manage the installation’s AI connection</a></p>${preview}`)
  + standingGrants(data.scopes ?? [], folders)
  + card('Agent proposals and results', suggestions ? `<ul class="events">${suggestions}</ul>` : '<p class="quiet">No agent proposals yet.</p>')
}
