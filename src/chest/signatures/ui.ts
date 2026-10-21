import { card, esc, form, hidden, stamp } from '../ui-shared'
import { sheets, type Span } from './ui-sheet'
import { fieldTypes, type SignRequest } from './model'
// Staff screens: the Signatures card on a file page, the compose page (fidelity report, signers, placed fields,
// expiry and reminders) and a request's status with its event log.
type View = SignRequest & { id: string }
const chip = (s: string) => `<span class="chip">${esc(s)}</span>`
const states: Record<string, string> = { draft: 'Draft', pending: 'Waiting for signatures', completed: 'Completed', declined: 'Declined', voided: 'Voided', expired: 'Expired' }
const nameOf = (r: View) => (id: string) => r.signers.find(s => s.id === id)?.email ?? ''
export function signaturePanel(d: any, returnTo: string) {
 if (!d.can?.contribute || !d.can?.download || d.item.type !== 'file' || !d.signable) return ''
 const rows = (d.signatures as View[]).map(r => `<li><a class="link" href="/app/signatures/${esc(r.id)}">${esc(states[r.status])}</a> <span class="mono">${esc(r.signers.map(s => `${s.email} ${s.state}`).join(' · ') || 'no signers yet')} · started ${stamp(r.createdAt)}</span></li>`).join('')
 return card('Signatures', `<p class="quiet">Ask people to sign this exact version of the PDF or Word file. Signers need no Chest or Google/Microsoft account.</p>${form('/signatures', hidden('item', d.id) + (d.versions.find((v: any) => v.id === d.item.current) ? hidden('version', d.item.current) : ''), 'Request signatures', returnTo, { buttonClass: 'btn btn-outline btn-block' })}${rows ? `<ul class="events">${rows}</ul>` : ''}`, 'side-card')
}
export function versionBadge(v: any, number: (id: string) => number) {
 return v.signature ? `<p class="mono">${v.signature.role === 'signed' ? 'Signed copy' : 'Audit certificate'} of version ${number(v.signature.sourceVersion)}</p>` : ''
}
const times = [['3', '3 days'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['90', '90 days']], cadence = [['', 'No reminders'], ['1', 'Every day'], ['2', 'Every 2 days'], ['3', 'Every 3 days'], ['7', 'Every week']]
const options = (rows: string[][], chosen: string) => rows.map(([v, l]) => `<option value="${v}"${v === chosen ? ' selected' : ''}>${esc(l)}</option>`).join('')
export function composePage(r: View, text: Span[][]) {
 const report = r.rendition ? `<section class="card" aria-label="Fidelity report"><h2>Fidelity report</h2><p>${esc(r.rendition.fidelity.summary)}</p><p class="quiet">Signers see and sign a PDF that Chest rendered from version ${esc(r.version.slice(0, 8))} of ${esc(r.name)}. It records that source version.</p>${r.rendition.fidelity.items.length ? `<ul>${r.rendition.fidelity.items.map(i => `<li class="${i.level}">${esc(i.text)}</li>`).join('')}</ul>` : ''}</section>` : `<section class="card"><p>The PDF is signed as uploaded: version ${esc(r.version.slice(0, 8))} of ${esc(r.name)}.</p></section>`
 const warn = r.warnings.length ? `<section class="card card-issue" role="alert"><h2>Excluded categories</h2>${r.warnings.map(w => `<p>${esc(w)}</p>`).join('')}<label class="check"><input type="checkbox" name="acknowledgeWarnings" value="true" form="sign-compose" required> I understand and want to send anyway.</label></section>` : ''
 const signer = (n: number) => `<li class="signer-row"><label>Email<input name="signerEmail:${n}" type="email" autocomplete="off"${n === 1 ? ' required' : ''}></label><label>Name<input name="signerName:${n}" autocomplete="off"></label></li>`
 return `<div class="page-head"><h1>Request signatures</h1><p class="lede">${esc(r.name)}</p></div>${report}${warn}
<form id="sign-compose" method="post" action="/app/action" data-sign-compose><input type="hidden" name="path" value="/signatures/${esc(r.id)}/send"><input type="hidden" name="returnTo" value="/app/signatures/${esc(r.id)}"><input type="hidden" name="fieldsJson" value="[]" data-fields-json>
<section class="card"><h2>Signers</h2><ol class="signers" data-signers>${signer(1)}${signer(2)}</ol><button type="button" class="btn btn-outline" data-add-signer>Add signer</button>
<label>Signing order<select name="mode"><option value="sequential">One after another, in this order</option><option value="parallel">Everyone at once</option></select></label>
<label>Expires after<select name="expiresDays">${options(times, '14')}</select></label><label>Remind signers<select name="reminderDays">${options(cadence, '3')}</select></label></section>
<section class="card"><h2>Fields</h2><p class="quiet">Choose a signer and a field type, then click the page where it goes. Every signer needs a signature field.</p>
<div class="field-tools"><label>Signer<select data-field-signer></select></label><label>Field<select data-field-type>${fieldTypes.map(t => `<option value="${t}">${t === 'date' ? 'Date signed' : t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label><label>Page<input type="number" min="1" max="${r.document.pages.length}" value="1" data-field-page></label><button type="button" class="btn btn-outline" data-add-field>Add field to page</button></div>
<ul class="events" data-field-list aria-label="Placed fields"></ul></section>
${sheets(r.document.pages.slice(0, text.length), text, () => '', `data-compose data-pages="${r.document.pages.length}"`)}
<button class="btn">Send for signature</button></form><script src="/chest-sign.js" defer></script>`
}
export function statusPage(r: View, can: { void: boolean; resend: boolean }, checks: { version: string; label: string }[]) {
 const who = nameOf(r), back = `/app/signatures/${r.id}`
 const signers = r.signers.map(s => `<li><span class="mono">${s.order}. ${esc(s.name)} &lt;${esc(s.email)}&gt; · ${s.staff ? 'staff' : 'external'} · ${esc(s.state)}${s.verified ? ` · verified by ${s.verified.method === 'pin' ? 'PIN' : 'sign-in'}` : ''}${s.signedAt ? ` · signed ${stamp(s.signedAt)}` : ''}${s.mail ? ` · mail ${esc(s.mail)}` : ''}</span>${can.resend && r.status === 'pending' && (s.state === 'invited' || s.state === 'viewed') ? form(`/signatures/${r.id}/remind`, hidden('signer', s.id), 'Send a fresh link', back, { className: 'form form-inline', buttonClass: 'btn btn-outline' }) : ''}</li>`).join('')
 const events = r.events.map(e => `<li><span class="mono">${stamp(e.at)} · ${esc(e.type)}${e.email ? ` · ${esc(e.email)}` : ''}${e.method ? ` · ${esc(e.method)}` : ''} · ${esc(e.ip)}${e.detail ? ` · ${esc(e.detail)}` : ''}</span></li>`).join('')
 const filed = r.status === 'completed' ? `<p>Filed as new versions of <a class="link" href="/app/items/${esc(r.item)}">${esc(r.name)}</a>: the signed PDF and the audit certificate, linked to the source version.</p>${r.signed ? `<p class="mono hash">Signed PDF SHA-256 ${esc(r.signed.checksum)}</p>` : ''}${checks.map(c => form('/signatures/validate', hidden('item', r.item) + hidden('version', c.version), `Check seal: ${c.label}`, back, { className: 'form form-inline', buttonClass: 'btn btn-outline' })).join('')}` : r.status === 'draft' ? '' : '<p>The source version is unchanged and unsigned. No signed version was filed.</p>'
 return `<div class="page-head"><h1>${esc(states[r.status])}</h1><p class="lede">${esc(r.name)}${r.outcome?.reason ? ` · ${esc(r.outcome.reason)}` : ''}</p></div><section class="card"><h2>Signers</h2><ul class="events">${signers}</ul>${r.status === 'pending' && can.void ? form(`/signatures/${r.id}/void`, '<label>Reason (optional)<input name="reason" maxlength="300"></label>', 'Void this request', back, { buttonClass: 'btn btn-outline' }) : ''}</section><section class="card">${filed}</section><section class="card"><h2>Events</h2><ul class="events">${events}</ul><p class="quiet">Reminders ${r.reminderDays ? `every ${r.reminderDays} day${r.reminderDays === 1 ? '' : 's'}` : 'off'}${r.expires ? ` · expires ${stamp(r.expires)}` : ''} · order: ${r.mode === 'parallel' ? 'everyone at once' : 'one after another'}.</p></section>`
}
export function checkPage(result: any) {
 return `<div class="page-head"><h1>${result.valid ? 'The seal is intact' : 'The seal is broken'}</h1></div><section class="card"><p>${result.valid ? `The PAdES signature validates and covers the whole file${result.issuedByThisInstallation ? '. It was made with this installation’s signing key' : ''}.` : `The PDF's signature does not validate (${esc(result.reason ?? 'unknown')}). The file was changed after it was signed.`}</p>${result.certificate ? `<p class="mono hash">Certificate SHA-256 ${esc(result.certificate)}</p>` : ''}</section>`
}
export function signatureInput(input: any) {
 if (/^\/signatures\/[^/]+\/send$/.test(input.path)) {
  input.signers = [...Object.keys(input).filter(k => k.startsWith('signerEmail:'))].sort((a, b) => Number(a.slice(12)) - Number(b.slice(12))).flatMap(k => input[k].trim() ? [{ email: input[k], name: input['signerName:' + k.slice(12)] ?? '' }] : [])
  try { input.fields = JSON.parse(input.fieldsJson || '[]') } catch { input.fields = [] }
  input.acknowledgeWarnings = input.acknowledgeWarnings === 'true'
 }
 return input
}
