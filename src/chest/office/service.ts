import { assertContent } from '../content-security/scan'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { digest } from '../blobs'
import { insist, now } from '../model'
import { allowed, context, demand, type Who } from '../files/access'
import { admit } from '../files/items'
import { commit, next } from '../files/repo'
import { officeEdit, officePreview, officeSuggest, officeDecide } from './codec'
import { versionPublication } from '../files/governance'

export const isOffice = (name: string) => /\.(docx|xlsx|pptx)$/i.test(name)
async function original(env: Bindings, version: { size: number; checksum: string }) {
 await assertContent(env,version.checksum)
 insist(version.size <= 8_000_000, 'office_file_too_large', 413)
 const blob = await env.BLOBS.get(`sha256/${version.checksum}`); insist(blob, 'blob_missing', 503)
 const bytes = new Uint8Array(await blob.arrayBuffer())
 insist(bytes.length === version.size && await digest(bytes) === version.checksum, 'blob_integrity', 503)
 return bytes
}
export async function readOffice(env: Bindings, w: Who, key: string, versionId?: string, edit = false, suggest = false) {
 const ctx = await context(env, w, key); demand(ctx, 'view')
 const item = ctx.chain.at(-1)!, v = item.payload.versions.find(v => v.id === (versionId || item.payload.current))
 insist(item.payload.type === 'file' && v, 'version_not_found', 404)
 const preview = await officePreview(await original(env, v)); insist(preview, 'office_format_unsupported', 415)
 if (edit) insist(preview.kind !== 'pptx', 'office_edit_unsupported', 415)
 demand(await context(env, w, key), 'view')
 return { ...preview, version: v.id, filename: v.filename, mode: suggest && allowed(ctx,'comment') && preview.kind==='docx' ? 'suggest' : allowed(ctx,'contribute') ? 'edit' : allowed(ctx,'comment') && preview.kind==='docx' ? 'suggest' : 'readonly', suggestion: v.suggestion }
}
// Changes name individual parts of the document. Independent edits can be merged onto the latest version;
// a field changed by both people is refused rather than overwriting the other person's work.
export async function saveOffice(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key); if(allowed(ctx,'comment')&&!allowed(ctx,'contribute'))insist(false,'suggest_only',403); demand(ctx, 'contribute')
 const item = ctx.chain.at(-1)!, current = item.payload.versions.find(v => v.id === item.payload.current)
 insist(typeof input.version === 'string', 'office_version_required')
 const base = item.payload.versions.find(v => v.id === input.version)
 insist(current && base, 'version_not_found', 404)
 insist(!current.suggestion || current.suggestion.decision, 'suggestion_decision_required',409)
 const changes = input.changes
 insist(changes && typeof changes === 'object' && !Array.isArray(changes) && Object.keys(changes).length <= 5000 && Object.values(changes).every(v => typeof v === 'string' && v.length <= 100_000), 'invalid_office_changes')
 const currentBytes = await original(env, current), latest = await officePreview(currentBytes)
 insist(latest && latest.kind !== 'pptx', 'office_edit_unsupported', 415)
 const before = base.id === current.id ? latest : await officePreview(await original(env, base)); insist(before, 'office_format_unsupported', 415)
 if (base.id !== current.id) insist(before.fields.length === latest.fields.length && before.fields.every((f, i) => f.key === latest.fields[i].key), 'office_edit_conflict', 409)
 const fields = new Map(latest.fields.map(f => [f.key, f.value])), earlier = new Map(before.fields.map(f => [f.key, f.value]))
 const changed: Record<string, string> = {}
 for (const [key, value] of Object.entries(changes)) {
  insist(typeof value === 'string' && earlier.has(key) && fields.has(key), 'invalid_office_field')
  if (value === earlier.get(key)) continue
  insist(fields.get(key) === earlier.get(key) || fields.get(key) === value, 'office_edit_conflict', 409)
  if (value !== fields.get(key)) changed[key] = value
 }
 insist(Object.keys(changed).length, 'office_no_changes', 409)
 const bytes = await officeEdit(currentBytes, changed), rendered = await officePreview(bytes); insist(rendered, 'office_format_unsupported', 415)
 const v = await admit(env, bytes, current.filename, s.operator.email, 'browser edit', {}, { text: rendered.text, parser: 'chest:office:1' })
 const row = next(item, await versionPublication(env, ctx, item.payload, v, input))
 try {
  await commit(env, s, [{ row, previous: item }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'version' }], audits: [{ action: 'version.edit', object: key, detail: { version: v.id, base: base.id, previous: current.id } }] })
 } catch (error) {
  if (String((error as Error)?.message).includes('CHECK constraint failed')) insist(false, 'office_edit_conflict', 409)
  throw error
 }
 return { id: key, version: v.id }
}
export function officeDocument(html: string) {
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/chest-office.css"><title>Office preview</title></head><body class="office-body">${html}</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "sandbox; default-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" } })
}

export async function suggestOffice(env:Bindings,s:Session,w:Who,key:string,input:any,deciding=false){
 const ctx=await context(env,w,key);demand(ctx,deciding?'contribute':'comment')
 const item=ctx.chain.at(-1)!,current=item.payload.versions.find(v=>v.id===item.payload.current)
 insist(current && current.id===input.version,'office_edit_conflict',409)
 insist(/\.docx$/i.test(current.filename),'suggestions_require_docx',415)
 const pending=current.suggestion&&!current.suggestion.decision
 insist(deciding?pending:!pending,deciding?'suggestion_not_pending':'suggestion_decision_required',409)
 const originalBytes=await original(env,current)
 let bytes:Uint8Array, suggestion:NonNullable<typeof current.suggestion>
 if(deciding){insist(input.decision==='accept'||input.decision==='reject','invalid_suggestion_decision');bytes=await officeDecide(originalBytes,input.decision);suggestion={...current.suggestion!,decision:input.decision,decidedBy:s.operator.email,decidedAt:now(),sourceVersion:current.id}}
 else {
  const changes=input.changes,preview=await officePreview(originalBytes);insist(preview,'office_format_unsupported',415)
  insist(changes&&typeof changes==='object'&&!Array.isArray(changes)&&Object.keys(changes).length<=5000&&Object.values(changes).every(v=>typeof v==='string'&&v.length<=100000),'invalid_office_changes')
  const fields=new Map(preview.fields.map(f=>[f.key,f.value]));insist(Object.keys(changes).every(k=>fields.has(k)),'invalid_office_field');insist(Object.entries(changes).some(([k,v])=>fields.get(k)!==v),'office_no_changes',409)
  suggestion={author:s.operator.email,at:now(),sourceVersion:current.id};bytes=await officeSuggest(originalBytes,changes,suggestion.author,suggestion.at)
 }
 const preview=await officePreview(bytes);insist(preview,'office_format_unsupported',415)
 const v={...await admit(env,bytes,current.filename,s.operator.email,'browser edit',{}, {text:preview.text,parser:'chest:office:1'}),suggestion}
 const row=next(item,await versionPublication(env,ctx,item.payload,v,input))
 await commit(env,s,[{row,previous:item}],{fences:ctx.fences,changes:[{item:key,space:ctx.space.id,kind:'version'}],audits:[{action:deciding?'suggestion.decide':'suggestion.add',object:key,detail:{version:v.id,source:current.id,...suggestion}}]})
 return {id:key,version:v.id}
}
