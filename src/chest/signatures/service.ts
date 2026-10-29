import { sessionAgent } from '../agent-attribution'
import { assertContent } from '../content-security/scan'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { guardDownload } from '../upload-protection/guard'
import { inspect, retain } from '../blobs'
import { personName } from '../names'
import { id, insist, now, type Person } from '../model'
import { get } from '../store'
import { context, demand, type Who } from '../files/access'
import { tokenHash } from '../files/capability'
import { commit, fresh, maybe, next } from '../files/repo'
import type { Item } from '../files/model'
import { renderDocx } from './docx-render'
import { clampField, loadPdf, pageSizes, plainText, textMap } from './pdf-tools'
import { validateSeal } from './seal-pdf'
import { currentFingerprint } from './custody'
import { fieldTypes, type Field, type SignRequest, type Signer } from './model'
import { event, getRequest, mutate, origin, redacted, requestsOf, signerToken } from './store'
import { invite, tell } from './messages'
const day = 86_400_000, MAX_PDF = 25_000_000, MAX_DOCX = 8_000_000
const EXCLUDED: [RegExp, string][] = [[/last will and testament|\bcodicil\b|testamentary/i, 'wills, codicils and testamentary trusts'], [/notice of default|notice of foreclosure|notice of eviction|notice to quit|notice of acceleration|repossession/i, 'notices of default, foreclosure, eviction or repossession'], [/summons|subpoena|court order|notice of hearing|\bpleading\b/i, 'court orders, notices and official court documents'], [/cancellation or termination of (?:health|life) insurance|termination of utility service/i, 'cancellation of health or life insurance and utility termination notices'], [/product recall|hazardous materials/i, 'recall and hazardous-material notices'], [/adoption|divorce decree/i, 'adoption and divorce documents']]
// A requester needs contribute-level access (contributor, content manager, manager; editor in a personal area) and download rights.
async function eligible(env: Bindings, s: Session, w: Who, key: string) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!
 demand(ctx, 'contribute'); demand(ctx, 'download')
 insist(item.payload.type === 'file', 'not_a_file')
 await guardDownload(env, s, item)
 return { ctx, item }
}
async function blob(env: Bindings, checksum: string): Promise<Uint8Array> { await assertContent(env,checksum);const o = await env.BLOBS.get(`sha256/${checksum}`); insist(o, 'blob_missing', 503); return new Uint8Array(await o.arrayBuffer()) }
export const documentBytes = (env: Bindings, r: SignRequest) => blob(env, r.document.checksum)
// Step one: render (a DOCX becomes a PDF with a fidelity report) and open a draft; nothing is sent.
export async function draft(env: Bindings, s: Session, w: Who, input: any) {
 insist(typeof input.item === 'string', 'invalid_item')
 const { ctx, item } = await eligible(env, s, w, input.item)
 const version = item.payload.versions.find(v => v.id === (input.version ?? item.payload.current)); insist(version, 'version_not_found', 404)
 const docx = /\.docx$/i.test(version.filename), pdfSource = version.mediaType === 'application/pdf'
 insist(docx || pdfSource, 'signing_needs_pdf_or_docx', 422); insist(version.size <= (docx ? MAX_DOCX : MAX_PDF), 'file_too_large_to_sign', 413)
 const source = await blob(env, version.checksum); let document = source, rendition: SignRequest['rendition']
 if (docx) {
  let rendered; try { rendered = await renderDocx(source) } catch { throw Object.assign(new Error('docx_unrenderable'), { code: 'docx_unrenderable', status: 422 }) }
  const v = await inspect(rendered.pdf, `${version.filename.replace(/\.docx$/i, '')}.pdf`, s.operator.email, ''); await retain(env, rendered.pdf, v)
  document = rendered.pdf; rendition = { checksum: v.checksum, size: v.size, pages: rendered.pages, fidelity: rendered.fidelity }
 }
 const pdf = await loadPdf(document), sizes = await pageSizes(pdf)
 const text = await plainText(document).catch(() => ''), warnings = EXCLUDED.filter(([re]) => re.test(text)).map(([, label]) => `This document appears to be one of the kinds ESIGN and UETA exclude (${label}). Chest makes no claim that an electronic signature is legally sufficient for it. Check with counsel before sending.`)
 const checksum = rendition?.checksum ?? version.checksum, size = rendition?.size ?? version.size
 const row = fresh<SignRequest>('signature', { item: item.id, version: version.id, name: item.payload.name, sourceChecksum: version.checksum, sourceKind: docx ? 'docx' : 'pdf', ...(rendition ? { rendition } : {}), document: { checksum, size, pages: sizes }, mode: 'sequential', signers: [], fields: [], expires: null, reminderDays: null, status: 'draft', createdBy: s.operator.email, createdAt: now(), events: [], warnings })
 await commit(env, s, [{ row }], { fences: ctx.fences, audits: [{ action: 'signature.draft', object: item.id, detail: { request: row.id, version: version.id, rendition: !!rendition } }] })
 return row
}
const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Step two: signers, order, fields, expiry and reminders; the first signers are invited by email.
export async function send(env: Bindings, s: Session, w: Who, key: string, input: any, request: Request) {
 const row = await getRequest(env, key); insist(row.payload.createdBy === s.operator.email, 'access_required', 403); insist(row.payload.status === 'draft', 'signature_already_sent', 409)
 const { ctx, item } = await eligible(env, s, w, row.payload.item); insist(item.payload.versions.some(v => v.id === row.payload.version), 'version_not_found', 404)
 const list: any[] = Array.isArray(input.signers) ? input.signers : []; insist(list.length >= 1 && list.length <= 10, 'invalid_signers', 422)
 const mode = input.mode === 'parallel' ? 'parallel' : 'sequential'
 const emails = list.map(x => String(x.email ?? '').trim().toLowerCase()); insist(emails.every(e => emailShape.test(e) && e.length <= 254) && new Set(emails).size === emails.length, 'invalid_signers', 422)
 const staff = new Set((await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active'").all()).results.map((r: any) => String(r.email).toLowerCase()))
 const signers: Signer[] = await Promise.all(list.map(async (x, i) => { const person = await maybe<Person>(env, 'person', emails[i]), signer = { id: id() }; return { id: signer.id, email: emails[i], name: String(x.name ?? '').trim().slice(0, 100) || personName(person?.payload.name, emails[i]), staff: staff.has(emails[i]), order: mode === 'parallel' ? 1 : i + 1, state: 'waiting' as const, tokenHash: await tokenHash(await signerToken(env, row.id, signer)) } }))
 const given: any[] = Array.isArray(input.fields) ? input.fields : []; insist(given.length >= 1 && given.length <= 200, 'invalid_fields', 422)
 const fields: Field[] = given.map(f => {
  const signer = signers[emails.indexOf(String(f.signer ?? '').trim().toLowerCase())]; insist(signer && fieldTypes.includes(f.type), 'field_invalid', 422)
  return { id: id(), signer: signer.id, type: f.type, ...clampField(f, row.payload.document.pages.length), required: f.required !== false, ...(typeof f.label === 'string' && f.label ? { label: f.label.slice(0, 80) } : {}) }
 })
 for (const signer of signers) insist(fields.some(f => f.signer === signer.id && f.type === 'signature'), 'signature_field_missing', 422)
 const days = input.expiresDays === undefined || input.expiresDays === '' ? 14 : Number(input.expiresDays), expires = typeof input.expires === 'string' && input.expires ? input.expires : new Date(Date.now() + days * day).toISOString()
 insist(Number.isFinite(Date.parse(expires)) && Date.parse(expires) > Date.now() + 60_000 && Date.parse(expires) <= Date.now() + 366 * day, 'invalid_expiry', 422)
 const reminderDays = input.reminderDays === undefined || input.reminderDays === '' || input.reminderDays === null ? null : Number(input.reminderDays); insist(reminderDays === null || Number.isInteger(reminderDays) && reminderDays >= 1 && reminderDays <= 30, 'invalid_reminder', 422)
 insist(!row.payload.warnings.length || input.acknowledgeWarnings === true, 'excluded_category_unacknowledged', 409)
 const from = origin(request), at = now(), first = Math.min(...signers.map(x => x.order))
 for (const signer of signers) if (signer.order === first) signer.state = 'invited'
 const payload: SignRequest = { ...row.payload, mode, signers: signers.map(x => x.order === first ? { ...x, invitedAt: at } : x), fields, expires, reminderDays, status: 'pending', sentAt: at, events: [event('sent', from, { email: s.operator.email, detail: `${signers.length} signer${signers.length === 1 ? '' : 's'}, ${mode}` })] }
 await commit(env, s, [{ row: next(row, payload), previous: row }], { fences: ctx.fences, audits: [{ action: 'signature.send', object: item.id, detail: { request: row.id, version: row.payload.version, signers: emails, mode, expires, reminderDays } }] })
 const requester = sessionAgent(s)?.label??personName((await maybe<Person>(env, 'person', s.operator.email))?.payload.name, s.operator.email)
 const sent = await Promise.all(payload.signers.filter(x => x.state === 'invited').map(async x => ({ x, mail: await invite(env, payload, row.id, x, requester) })))
 await mutate(env, row.id, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(x => ({ ...x, ...(sent.find(m => m.x.id === x.id) ? { mail: sent.find(m => m.x.id === x.id)!.mail } : {}) })), events: [...r.payload.events, ...sent.map(m => event('invited', from, { signer: m.x.id, email: m.x.email, detail: `mail ${m.mail}` }))] } }))
 return { id: row.id, status: 'pending' }
}
async function visible(env: Bindings, s: Session, w: Who, key: string) {
 const row = await getRequest(env, key), { ctx } = await eligible(env, s, w, row.payload.item)
 return { row, ctx }
}
export async function view(env: Bindings, s: Session, w: Who, key: string) {
 const { row } = await visible(env, s, w, key), fresh = await (await import('./sweep')).settle(env, row.id)
 return { id: fresh.id, ...redacted(fresh.payload) }
}
export async function forItem(env: Bindings, s: Session, w: Who, itemKey: string) {
 await eligible(env, s, w, itemKey)
 const rows = await Promise.all((await requestsOf(env, itemKey)).map(r => (import('./sweep')).then(m => m.settle(env, r.id))))
 return rows.sort((a, b) => b.payload.createdAt.localeCompare(a.payload.createdAt)).map(r => ({ id: r.id, ...redacted(r.payload) }))
}
export async function sheet(env: Bindings, s: Session, w: Who, key: string) {
 const { row } = await visible(env, s, w, key)
 return { pages: row.payload.document.pages, text: await textMap(await documentBytes(env, row.payload)) }
}
export async function voidRequest(env: Bindings, s: Session, w: Who, key: string, input: any, request: Request) {
 const { row, ctx } = await visible(env, s, w, key)
 insist(row.payload.createdBy === s.operator.email || ctx.state.manager, 'access_required', 403); insist(row.payload.status === 'pending', 'signature_not_pending', 409)
 const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 300) : '', from = origin(request), at = now()
 const updated = await mutate(env, key, async r => { insist(r.payload.status === 'pending', 'signature_not_pending', 409); return { payload: { ...r.payload, status: 'voided', outcome: { at, status: 'voided', ...(reason ? { reason } : {}) }, events: [...r.payload.events, event('voided', from, { email: s.operator.email, ...(reason ? { detail: reason } : {}) })] }, fences: ctx.fences, audits: [{ action: 'signature.void', object: r.payload.item, detail: { request: key, reason } }], by: s.operator.email } })
 await tell(env, updated.payload, key, 'voided')
 return { id: key, status: 'voided' }
}
// Sends the invitation again to one waiting-or-invited signer under a fresh link; the earlier link stops working.
export async function resend(env: Bindings, s: Session, w: Who, key: string, input: any, request: Request) {
 const { row } = await visible(env, s, w, key); insist(row.payload.createdBy === s.operator.email, 'access_required', 403); insist(row.payload.status === 'pending', 'signature_not_pending', 409)
 const target = row.payload.signers.find(x => x.id === input.signer && (x.state === 'invited' || x.state === 'viewed')); insist(target, 'signer_not_waiting', 409)
 const rotated = { ...target, generation: (target.generation ?? 0) + 1, credential: undefined }, hash = await tokenHash(await signerToken(env, key, rotated)), from = origin(request)
 const requester = sessionAgent(s)?.label??personName((await maybe<Person>(env, 'person', s.operator.email))?.payload.name, s.operator.email)
 await mutate(env, key, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(x => x.id === target.id ? { ...x, tokenHash: hash, generation: rotated.generation, credential: undefined } : x) }, audits: [{ action: 'signature.resend', object: r.payload.item, detail: { request: key, signer: target.email } }], by: s.operator.email }))
 const mail = await invite(env, row.payload, key, rotated as Signer, requester)
 await mutate(env, key, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(x => x.id === target.id ? { ...x, mail } : x), events: [...r.payload.events, event('invited', from, { signer: target.id, email: target.email, detail: `resent, mail ${mail}` })] } }))
 return { id: key, signer: target.id, mail }
}
// Checks a PDF's seal: the stored version of a request's signed copy, or bytes the caller supplies.
export async function validate(env: Bindings, s: Session, w: Who, input: any) {
 let bytes: Uint8Array
 if (typeof input.base64 === 'string') { insist(input.base64.length <= 34_000_000, 'request_too_large', 413); bytes = Uint8Array.from(atob(input.base64), c => c.charCodeAt(0)) }
 else { insist(typeof input.item === 'string' && typeof input.version === 'string', 'invalid_input'); const ctx = await context(env, w, input.item); demand(ctx, 'download'); const v = ctx.chain.at(-1)!.payload.versions.find(v => v.id === input.version); insist(v, 'version_not_found', 404); bytes = await blob(env, v.checksum) }
 const result = await validateSeal(bytes), mine = await currentFingerprint(env)
 return { ...result, issuedByThisInstallation: !!result.certificate && result.certificate === mine }
}
