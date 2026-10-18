import { esc, field, select, form, hidden, details, card, stamp } from '../ui-shared'
import type { Summary } from './api'
import { DEFAULTS } from './provider'
// Reading on the pages: what Chest read from a version (and how far it has got), the values read from a scanned
// record shown boxed on the page they came from, and the owner's card for the AI model key. /chest-read.js polls the
// progress while anything is still being read and reloads the page once it is done.
const inline = { className: 'form form-inline', buttonClass: 'btn btn-outline' }
const busy = (state?: string) => ['queued', 'reading', 'waiting'].includes(state ?? '')
const pct = (n: number | null) => n === null ? '' : `${Math.round(n * 100)}% sure`
export function readingLine(r: NonNullable<Summary>) {
 const read = r.pages.filter(p => ['done', 'empty', 'failed', 'skipped'].includes(p.state)).length, scans = r.pages.filter(p => p.source !== 'text')
 if (r.state === 'queued') return 'Waiting to be read.'
 if (r.state === 'reading') return `Reading: ${read} of ${r.pages.length} page${r.pages.length === 1 ? '' : 's'} done.`
 if (r.state === 'unsupported' || r.state === 'failed') return r.problem ?? 'This file could not be read.'
 const words = `${r.chars.toLocaleString('en-US')} characters searchable${r.method ? `, ${r.method}` : ''}.`
 if (r.state === 'needs_key' || r.state === 'unavailable') return `${r.chars ? words + ' ' : ''}${scans.length} scanned page${scans.length === 1 ? ' is' : 's are'} not read yet. ${r.problem ?? ''}`.trim()
 return `${words}${r.state === 'partial' ? ` ${r.pages.filter(p => p.state === 'failed').length} page(s) could not be read.` : ''}${r.truncatedAt ? ` Partially indexed: the first ${r.truncatedAt.toLocaleString('en-US')} characters.` : ''}${r.problem ? ` ${r.problem}` : ''}`
}
const pageNotes = (r: NonNullable<Summary>) => r.pages.filter(p => p.source !== 'text' || p.problem).map(p => `<li class="mono">Page ${p.n} · ${p.source === 'text' ? 'text layer' : p.source === 'photo' ? 'photo' : 'scan'} · ${p.state === 'done' ? `${p.chars.toLocaleString('en-US')} characters${p.language ? ` · ${esc(p.language)}` : ''}${p.confidence !== null ? ` · ${pct(p.confidence)}` : ''}` : esc(p.state)}${p.problem ? ` · ${esc(p.problem)}` : ''}</li>`).join('')
// "Text inside" on a file page: the reading line, the text, and for photos the page image that was read.
export function textInside(r: Summary | null, base: { poll: string; page: (n: number) => string; retry?: string; returnTo: string; owner: boolean; showPhoto?: boolean }) {
 if (!r) return ''
 const retry = base.retry && ['partial', 'failed', 'needs_key'].includes(r.state) && !(r.state === 'needs_key' && !base.owner) ? form(base.retry, '', 'Read again', base.returnTo, inline) : ''
 const settings = r.state === 'needs_key' && base.owner ? `<p><a class="link" href="/app/admin#reading">Add an AI model key</a></p>` : ''
 const photo = base.showPhoto === false ? undefined : r.pages.find(p => p.image && p.source === 'photo')
 return `<h2 class="section-title">Text inside</h2><section class="card read-card" aria-label="Text inside"${busy(r.state) ? ` data-reading-poll="${esc(base.poll)}"` : ''}><p class="read-line" data-reading-line>${esc(readingLine(r))}</p>${busy(r.state) ? '<p class="read-meter" aria-hidden="true"><span></span></p>' : ''}${settings}
 ${photo ? `<img class="read-photo" src="${esc(base.page(photo.n))}" alt="The photo as Chest read it" width="${photo.width}" height="${photo.height}">` : ''}
 ${r.pages.some(p => p.source !== 'text' || p.problem) ? `<ul class="read-pages">${pageNotes(r)}</ul>` : ''}${r.excerpt ? details('Read the text', `<pre class="receipt">${esc(r.excerpt)}</pre>${r.chars > 20_000 ? '<p class="quiet">The first 20,000 characters are shown; search covers all of the indexed text.</p>' : ''}`, 'link-summary') : ''}${retry}</section>`
}
type Proposal = { field: string; found: boolean; value: unknown; page: number; box: number[] | null; confidence: number; note: string; decision?: { status: string; value: unknown; by: string; at: string } }
const shown = (v: unknown) => v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v)
function correctInput(type: string, value: unknown) {
 if (type === 'boolean') return select('Correct value', 'value', [{ id: 'true', label: 'Yes' }, { id: 'false', label: 'No' }], shown(value))
 return field('Correct value', 'value', shown(value), type === 'date' ? 'date' : 'text')
}
// The values read from one scanned version: each page with numbered boxes around the words each value came from, and
// beside it the list to accept, correct or reject. Saved values are never replaced from here.
export function readFields(doc: { id: string; fields: Record<string, unknown> }, v: { id: string; label?: string }, r: Summary | null, f: { state: string; problem: string | null; model: string | null; proposals: Proposal[]; unchanged?: number } | null, types: Record<string, string>, editor: boolean, owner: boolean, returnTo: string, kind: 'items' | 'documents' = 'documents') {
 const poll = `/api/chest/${kind}/${doc.id}/reading`
 if (!f) return editor && r && r.pages.some(p => p.source !== 'text') ? `<div class="read-fields">${form(`/${kind}/${doc.id}/reading/${v.id}`, '', 'Read fields from this scan', returnTo, inline)}</div>` : ''
 if (busy(f.state) || busy(r?.state)) return `<div class="read-fields" data-reading-poll="${esc(poll)}"><p class="read-line" data-reading-line>Reading fields from this scan…</p><p class="read-meter" aria-hidden="true"><span></span></p></div>`
 if (f.state === 'not_scan' || f.state === 'no_fields') return ''
 if (f.state !== 'done') return `<div class="read-fields"><p class="read-line">${esc(f.problem ?? 'Fields could not be read from this scan.')}</p>${f.state === 'needs_key' && owner ? '<p><a class="link" href="/app/admin#reading">Add an AI model key</a></p>' : ''}${editor && f.state !== 'unavailable' && !(f.state === 'needs_key' && !owner) ? form(`/${kind}/${doc.id}/reading/${v.id}`, '', 'Read again', returnTo, inline) : ''}</div>`
 const numbered = f.proposals.map((p, i) => ({ ...p, n: i + 1 })), pages = [...new Set(numbered.filter(p => p.box).map(p => p.page))].sort((a, b) => a - b)
 const figure = (n: number) => { const page = r?.pages.find(p => p.n === n); if (!page?.width || !page.height) return ''
  const dot = Math.round(page.width! / 52), boxes = numbered.filter(p => p.page === n && p.box).map(p => { const [x0, y0, x1, y1] = p.box!.map((c, i) => Math.round(c * (i % 2 ? page.height! : page.width!))), state = p.decision?.status ?? 'open'
   return `<g class="read-mark read-${state}"><rect x="${x0 - 4}" y="${y0 - 4}" width="${x1 - x0 + 8}" height="${y1 - y0 + 8}" rx="4"></rect><circle cx="${Math.max(dot, x0 - 10 - dot)}" cy="${Math.round((y0 + y1) / 2)}" r="${dot}"></circle><text x="${Math.max(dot, x0 - 10 - dot)}" y="${Math.round((y0 + y1) / 2)}" font-size="${Math.round(dot * 1.2)}" text-anchor="middle" dominant-baseline="central">${p.n}</text></g>` }).join('')
  return `<figure class="read-page"><svg viewBox="0 0 ${page.width} ${page.height}" role="img" aria-label="Page ${n} of the scan with ${numbered.filter(p => p.page === n && p.box).length} read values boxed"><image href="/api/chest/${kind}/${esc(doc.id)}/pages/${esc(v.id)}/${n}" width="${page.width}" height="${page.height}"></image>${boxes}</svg><figcaption class="mono">Page ${n} · <a class="link" href="/api/chest/${kind}/${esc(doc.id)}/pages/${esc(v.id)}/${n}" target="_blank" rel="noopener">Open page image</a></figcaption></figure>` }
 const item = (p: Proposal & { n: number }) => {
  const saved = doc.fields[p.field], has = saved !== undefined && saved !== null && saved !== '', low = p.found && p.confidence < 0.6
  const facts = p.found ? `<p class="mono read-value">${esc(shown(p.value))}</p><p class="quiet">Page ${p.page} · ${pct(p.confidence)}${low ? ' · <strong>low confidence</strong>' : ''}</p>` : '<p class="quiet">Not readable on the scan; left empty.</p>'
  const note = p.note ? `<p class="quiet">${esc(p.note)}</p>` : ''
  const done = p.decision ? `<p class="read-decision mono">${p.decision.status === 'rejected' ? 'Rejected' : p.decision.status === 'corrected' ? `Corrected to ${esc(shown(p.decision.value))}` : 'Accepted'} by ${esc(p.decision.by)} · ${stamp(p.decision.at)}</p>` : ''
  const beside = !p.decision && has ? `<p class="read-decision mono">${shown(saved) === shown(p.value) ? 'Matches the saved value.' : `Saved value kept: ${esc(shown(saved))}`}</p>` : ''
  const path = `/${kind}/${doc.id}/fields/${v.id}`, controls = editor && !p.decision && !has ? `<div class="read-actions">${p.found ? form(path, hidden('field', p.field) + hidden('decision', 'accept'), 'Accept', returnTo, { className: 'form form-inline', buttonClass: 'btn' }) : ''}${details(p.found ? 'Correct' : 'Enter value', form(path, hidden('field', p.field) + hidden('decision', 'accept') + correctInput(types[p.field] ?? 'text', p.value), 'Save value', returnTo), 'btn btn-outline')}${p.found ? form(path, hidden('field', p.field) + hidden('decision', 'reject'), 'Reject', returnTo, inline) : ''}</div>` : ''
  return `<li class="read-item${p.box ? '' : ' read-item-plain'}"><span class="read-num" aria-hidden="true">${p.box ? p.n : '–'}</span><div><p class="read-field">${esc(p.field)}</p>${facts}${note}${done}${beside}${controls}</div></li>`
 }
 return `<section class="read-fields" aria-label="Fields read from this scan"><h4>Fields read from this scan</h4>${v.label ? `<p class="mono">${esc(v.label)}</p>` : ''}<p class="quiet">Read by ${esc(f.model ?? 'the AI model')}. Nothing is saved to the record until ${editor ? 'you accept it' : 'an editor accepts it'}.</p>${f.unchanged ? `<p class="quiet">${f.unchanged} unchanged reading(s) kept with the earlier version.</p>` : ''}<div class="read-grid"><div class="read-pages-col">${pages.map(figure).join('')}</div><ol class="read-list">${numbered.map(item).join('')}</ol></div></section>`
}
// The owner's card: which provider reads scans, with the key sealed and never shown again.
export function readerCard(view: any) {
 const saved = view.saved, providers = [{ id: 'anthropic', label: 'Anthropic' }, { id: 'openai', label: 'OpenAI-compatible' }]
 const pill = view.unavailable ? 'Not available here' : saved && !view.missing ? `Key saved · ${saved.keyHint}` : saved ? 'Key needs adding again' : 'No key yet'
 const intro = '<p class="quiet">Chest reads the text layer of PDFs by itself. Scanned PDFs and photos (JPEG, PNG, WebP, GIF and HEIC) are read by an AI model with this installation\'s own key: each page image is sent to that provider. Values read from a scan are only proposals until a person accepts them.</p>'
 if (view.unavailable) return `<section class="card" id="reading"><h2>Reading scans</h2><p class="read-pill mono">${esc(pill)}</p><p>${esc(view.unavailable)}</p></section>`
 const steps = `<ol class="read-steps"><li>Create an API key with your provider: for Anthropic, open <a class="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com → API keys</a> and choose Create Key. Any provider with an OpenAI-compatible Chat Completions endpoint that reads images also works.</li><li>Paste the key below and choose Save.</li><li>Choose Test the key. Chest sends one made-up line of text, never a file.</li></ol>`
 const fields = select('Provider', 'provider', providers, saved?.provider ?? 'anthropic') + field('Model', 'model', saved?.model ?? DEFAULTS.anthropic.model) + field('API key', 'key', '', 'password', !saved) + (saved ? '<p class="quiet">Leave the key empty to keep the saved one.</p>' : '') + details('More settings', field('Endpoint (OpenAI-compatible providers)', 'endpoint', saved?.endpoint && saved.endpoint !== DEFAULTS.anthropic.endpoint ? saved.endpoint : '', 'url', false) + field('Anthropic workspace ID (optional)', 'workspace', saved?.workspace ?? '', 'text', false), 'link-summary')
 return `<section class="card" id="reading"><h2>Reading scans</h2><p class="read-pill mono">${esc(pill)}${saved ? ` · ${esc(saved.model)}` : ''}</p>${intro}${view.missing && saved ? `<p>${esc(view.missing)}</p>` : ''}${saved ? '' : steps}${form('/reading/settings', fields, saved ? 'Save' : 'Save the key', '/app/admin#reading')}${saved ? `<div class="doc-actions">${form('/reading/settings/test', '', 'Test the key', '/app/admin#reading', inline)}${form('/reading/settings/remove', '', 'Remove the key', '/app/admin#reading', inline)}</div><p class="quiet">Saved by ${esc(saved.updatedBy)} · ${stamp(saved.updatedAt)}</p>` : ''}</section>`
}
export const testReceipt = (result: { ok: boolean; message: string }) => `<div class="page-head"><h1>${result.ok ? 'The key works' : 'The key did not work'}</h1></div>${card('Reading scans', `<p>${esc(result.message)}</p><p class="card-foot"><a class="link" href="/app/admin#reading">Back to People &amp; settings</a></p>`)}`
