import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { roles } from '../access'
import { get } from '../store'
import { ChestError, date, insist, now, type Document, type Row, type Schema } from '../model'
import { commit, maybe, next } from '../files/repo'
import { readingId, type Reading } from './jobs'
// A value read from a scan is a proposal until an editor of the record says yes. Accepting (as read or corrected)
// writes it into the record's typed fields with the version, page, region and reader in the audit; rejecting stores
// nothing. A value a person already saved is never overwritten: the reading is shown beside it instead.
function coerce(type: string, value: unknown) {
 if (type === 'number') { const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, '')); insist(String(value).trim() !== '' && Number.isFinite(n), 'invalid_field_value'); return n }
 if (type === 'boolean') { insist(value === true || value === false || value === 'true' || value === 'false', 'invalid_field_value'); return value === true || value === 'true' }
 if (type === 'date') { insist(typeof value === 'string' && value !== '', 'invalid_field_value'); return date(value) }
 insist(typeof value === 'string' && value.trim() && value.length <= 4000, 'invalid_field_value'); return (value as string).trim()
}
const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
export async function decide(env: Bindings, s: Session, doc: Row<Document>, versionId: string, input: any) {
 const r = await roles(env, s, doc.payload); if (!r.roles.length) throw new ChestError('not_found', 404)
 insist(r.roles.includes('editor'), 'editor_required', 403); insist(!doc.payload.trash, 'document_trashed', 409)
 const reading = await maybe<Reading>(env, 'reading', readingId(doc.id, versionId)); insist(reading && reading.payload.state === 'done', 'reading_not_found', 404)
 const proposal = reading.payload.proposals.find(p => p.field === input.field); insist(proposal, 'field_not_found', 404); insist(!proposal.decision, 'already_decided', 409)
 const schema = await get<Schema>(env, 'schema', doc.payload.schema), field = schema.payload.fields.find(f => f.name === proposal.field); insist(field, 'field_not_in_type', 409)
 const decision = input.decision, at = now(), detail = { version: versionId, field: field.name, page: proposal.page, box: proposal.box, reader: reading.payload.model, confidence: proposal.confidence }
 insist(decision === 'accept' || decision === 'reject', 'invalid_decision')
 if (decision === 'reject') {
  const done = next(reading, { ...reading.payload, proposals: reading.payload.proposals.map(p => p.field === field.name ? { ...p, decision: { status: 'rejected' as const, value: null, by: s.operator.email, at } } : p), updatedAt: at })
  await commit(env, s, [{ row: done, previous: reading }], { fences: [doc, ...r.fences], audits: [{ action: 'field.reject', object: doc.id, detail }] })
  return { field: field.name, status: 'rejected' }
 }
 insist(empty(doc.payload.fields[field.name]), 'field_has_value', 409)
 insist(proposal.found || !empty(input.value), 'nothing_to_accept', 409)
 const corrected = !empty(input.value) && String(input.value).trim() !== String(proposal.value ?? ''), value = coerce(field.type, corrected ? input.value : proposal.value)
 const status = corrected ? 'corrected' as const : 'accepted' as const
 const record = next(doc, { ...doc.payload, fields: { ...doc.payload.fields, [field.name]: value } })
 const done = next(reading, { ...reading.payload, proposals: reading.payload.proposals.map(p => p.field === field.name ? { ...p, decision: { status, value, by: s.operator.email, at } } : p), updatedAt: at })
 await commit(env, s, [{ row: record, previous: doc }, { row: done, previous: reading }], { fences: r.fences, audits: [{ action: corrected ? 'field.correct' : 'field.accept', object: doc.id, detail: { ...detail, value } }] })
 return { field: field.name, status, value }
}
