import type { Item } from '../files/model'
import { attempt } from '../audit/journal'
import { waitUntil } from 'cloudflare:workers'
import type { Bindings } from '../../auth.server'
import { now, type Document, type Schema } from '../model'
import { maybe } from '../files/repo'
import { heic } from './heic'
import { officeText } from './office'
import { pageImage, pdfText, PdfProblem } from './pdf'
import { imageCopy, jpeg, type PageImage } from './raster'
import { readFields, ReaderError, transcribe, type Proposal, type ReaderConfig, type Usage } from './provider'
import { readerState } from './settings'
// Reading runs in the background, one small unit at a time: open a file and read its PDF text layer, then read one
// scanned page or photo with the AI model, then the next. Each unit saves its progress, so a page that is interrupted
// (a Worker stopped, a provider timeout) is picked up again by the next unit; uploads never wait for any of it.
// Units run after any signed-in request (waitUntil) and while a file page that shows progress is open.
// Unknown binaries are looked at too: Word, Excel, PowerPoint and OpenDocument files are recognised from their contents.
export const READABLE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/octet-stream']
export type Page = { n: number; source: 'text' | 'scan' | 'photo'; state: 'done' | 'waiting' | 'failed' | 'empty' | 'skipped'; chars: number; language?: string; confidence?: number; image?: { mediaType: string; width: number; height: number }; problem?: string; attempts?: number }
export type ExtractState = 'queued' | 'reading' | 'done' | 'partial' | 'failed' | 'unsupported' | 'needs_key' | 'unavailable'
// The record's ID is `extract:<SHA-256>`: identical bytes are read once. The payload never repeats the hash, so it
// never counts as a reference to the original when a file is erased.
export type Extraction = { mediaType: string; size: number; state: ExtractState; format?: string; pages: Page[]; text: string; truncatedAt: number | null; model: string | null; problem: string | null; lease: string | null; usage: { input: number; output: number }; createdAt: string; updatedAt: string }
export type ReadingState = 'waiting' | 'reading' | 'done' | 'failed' | 'not_scan' | 'no_fields' | 'needs_key' | 'unavailable'
export type Decision = { status: 'accepted' | 'corrected' | 'rejected'; value: unknown; by: string; at: string }
export type Reading = { schema?: string; schemaRevision?: string; unchanged?: number; document: string; version: string; checksum: string; state: ReadingState; proposals: (Proposal & { decision?: Decision })[]; model: string | null; problem: string | null; lease: string | null; attempts: number; usage: { input: number; output: number }; createdAt: string; updatedAt: string }
// Per file: at most this many scanned pages are read, and this much text is kept (any cut is shown with its offset).
export const MAX_SCAN_PAGES = 60, MAX_TEXT = 900_000, MAX_FIELD_PAGES = 5, MAX_BYTES = 50_000_000
const LEASE = 45_000, ATTEMPTS = 3, SEP = '\f'
type Row<T> = { id: string; kind: string; payload: T; revision: string }
const decode = <T>(r: any): Row<T> => ({ ...r, payload: JSON.parse(r.payload) })
export const extractId = (checksum: string) => `extract:${checksum}`
export const readingId = (doc: string, version: string) => `reading:${doc}:${version}`
export const copyKey = (checksum: string, n: number) => `reading/${checksum}/${n}`
const added = (a: { input: number; output: number }, u: Usage) => ({ input: a.input + (u.input ?? 0), output: a.output + (u.output ?? 0) })

// Saves only while this unit still holds the record it read; another holder's newer save wins.
async function save<T extends { updatedAt: string }>(env: Bindings, row: Row<T>, payload: T): Promise<Row<T> | null> {
 const revision = crypto.randomUUID(), fresh = { ...payload, updatedAt: now() }, r = await env.DB.prepare('UPDATE chest_records SET payload=?, revision=? WHERE id=? AND revision=?').bind(JSON.stringify(fresh), revision, row.id, row.revision).run()
 return r.meta.changes === 1 ? { ...row, payload: fresh, revision } : null
}
// Every readable version of a file or record gets its extraction; the newest version of a record whose type has
// fields gets a field reading. Both are created as waiting work.
async function discover(env: Bindings) {
 const at = now(), types = READABLE.map(() => '?').join(',')
 const versions = (await env.DB.prepare(`SELECT DISTINCT json_extract(v.value,'$.checksum') AS checksum, json_extract(v.value,'$.mediaType') AS mediaType, json_extract(v.value,'$.size') AS size FROM chest_records r, json_each(r.payload,'$.versions') v WHERE r.kind IN ('item','document') AND json_extract(v.value,'$.mediaType') IN (${types}) AND NOT EXISTS (SELECT 1 FROM chest_records e WHERE e.id='extract:'||json_extract(v.value,'$.checksum')) LIMIT 25`).bind(...READABLE).all()).results as { checksum: string; mediaType: string; size: number }[]
 const latest = (await env.DB.prepare(`SELECT r.id AS document, json_extract(r.payload,'$.versions[#-1].id') AS version, json_extract(r.payload,'$.versions[#-1].checksum') AS checksum FROM chest_records r WHERE ((r.kind='document' AND json_extract(r.payload,'$.trash')=0) OR (r.kind='item' AND json_extract(r.payload,'$.trash') IS NULL AND json_extract(r.payload,'$.filing.schema') IS NOT NULL)) AND json_extract(r.payload,'$.versions[#-1].mediaType') IN (${types}) AND NOT EXISTS (SELECT 1 FROM chest_records x WHERE x.id='reading:'||r.id||':'||json_extract(r.payload,'$.versions[#-1].id')) LIMIT 25`).bind(...READABLE).all()).results as { document: string; version: string; checksum: string }[]
 const insert = (key: string, kind: string, payload: unknown) => env.DB.prepare('INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(key, kind, JSON.stringify(payload), crypto.randomUUID())
 const statements = [
  ...versions.map(v => insert(extractId(v.checksum), 'extract', { mediaType: v.mediaType, size: v.size, state: 'queued', pages: [], text: '', truncatedAt: null, model: null, problem: null, lease: null, usage: { input: 0, output: 0 }, createdAt: at, updatedAt: at } satisfies Extraction)),
  ...latest.map(r => insert(readingId(r.document, r.version), 'reading', { document: r.document, version: r.version, checksum: r.checksum, state: 'waiting', proposals: [], model: null, problem: null, lease: null, attempts: 0, usage: { input: 0, output: 0 }, createdAt: at, updatedAt: at } satisfies Reading)),
 ]
 if (statements.length) await env.DB.batch(statements)
 return statements.length > 0
}
// The next unit: an extraction with work left, or a field reading whose extraction has finished.
async function nextUnit(env: Bindings): Promise<Row<any> | null> {
 const t = now()
 const extract = await env.DB.prepare(`SELECT * FROM chest_records WHERE kind='extract' AND json_extract(payload,'$.state') IN ('queued','reading') AND coalesce(json_extract(payload,'$.lease'),'')<? ORDER BY json_extract(payload,'$.createdAt') LIMIT 1`).bind(t).first()
 if (extract) return decode(extract)
 const reading = await env.DB.prepare(`SELECT r.* FROM chest_records r WHERE r.kind='reading' AND json_extract(r.payload,'$.state') IN ('waiting','reading') AND coalesce(json_extract(r.payload,'$.lease'),'')<? AND EXISTS (SELECT 1 FROM chest_records e WHERE e.id='extract:'||json_extract(r.payload,'$.checksum') AND json_extract(e.payload,'$.state') NOT IN ('queued','reading')) ORDER BY json_extract(r.payload,'$.createdAt') LIMIT 1`).bind(t).first()
 return reading ? decode(reading) : null
}
async function original(env: Bindings, checksum: string, size: number) {
 if (size > MAX_BYTES) return null
 const blob = await env.BLOBS.get(`sha256/${checksum}`); if (!blob) return null
 return new Uint8Array(await blob.arrayBuffer())
}
const join = (parts: string[]) => { const text = parts.join(SEP); return text.length > MAX_TEXT ? { text: text.slice(0, MAX_TEXT), truncatedAt: MAX_TEXT } : { text, truncatedAt: null } }
const finished = (pages: Page[]): ExtractState => pages.some(p => p.state === 'waiting') ? 'reading' : pages.some(p => p.state === 'failed') ? 'partial' : 'done'

async function analyse(env: Bindings, row: Row<Extraction>) {
 const checksum = row.id.slice('extract:'.length), x = row.payload, bytes = await original(env, checksum, x.size)
 if (!bytes) return save(env, row, { ...x, state: 'unsupported', lease: null, problem: x.size > MAX_BYTES ? `Files over ${MAX_BYTES / 1e6} MB are not read yet.` : 'The original could not be found in storage.' })
 if (x.mediaType === 'application/octet-stream') {
  const office = await officeText(bytes).catch(() => null)
  if (!office) return save(env, row, { ...x, state: 'unsupported', lease: null, problem: 'Chest does not read text from this format yet.' })
  const { text, truncatedAt } = join([office.text.replaceAll(SEP, ' ')])
  return save(env, row, { ...x, format: office.kind, pages: [{ n: 1, source: 'text', state: 'done', chars: office.text.length }], text, truncatedAt, state: 'done', lease: null })
 }
 if (x.mediaType !== 'application/pdf') return save(env, row, { ...x, state: 'reading', lease: null, pages: [{ n: 1, source: 'photo', state: 'waiting', chars: 0 }] })
 try {
  const pdf = await pdfText(bytes), scanned = new Set(pdf.scanned)
  let scans = 0
  const pages: Page[] = pdf.text.map((t, i) => scanned.has(i + 1) ? { n: i + 1, source: 'scan', state: ++scans > MAX_SCAN_PAGES ? 'skipped' : 'waiting', chars: 0 } : { n: i + 1, source: 'text', state: 'done', chars: t.length })
  const { text, truncatedAt } = join(pdf.text.map((t, i) => scanned.has(i + 1) ? '' : t.replaceAll(SEP, ' ')))
  return save(env, row, { ...x, pages, text, truncatedAt, state: finished(pages), lease: null, problem: scans > MAX_SCAN_PAGES ? `${scans - MAX_SCAN_PAGES} scanned pages after page ${pages.filter(p => p.source === 'scan')[MAX_SCAN_PAGES - 1].n} are not read: Chest reads up to ${MAX_SCAN_PAGES} scanned pages per file today.` : null })
 } catch (e) {
  return save(env, row, { ...x, state: e instanceof PdfProblem && /encrypted/.test(e.message) ? 'unsupported' : 'failed', lease: null, problem: e instanceof PdfProblem ? e.message : 'This PDF could not be read.' })
 }
}
// The picture one page is read from: a PDF page's scan, or the photo itself (HEIC decoded here).
async function picture(bytes: Uint8Array, mediaType: string, n: number): Promise<PageImage | { problem: string } | null> {
 if (mediaType === 'application/pdf') { const r = await pageImage(bytes, n); return r ? jpeg(r) : null }
 if (mediaType === 'image/heic') { try { return jpeg(await heic(bytes)) } catch { return { problem: 'This HEIC photo could not be decoded.' } } }
 try { return imageCopy(bytes, mediaType) } catch { return { problem: 'This image could not be decoded.' } }
}
async function readPage(env: Bindings, row: Row<Extraction>, config: ReaderConfig) {
 const checksum = row.id.slice('extract:'.length), x = row.payload, page = x.pages.find(p => p.state === 'waiting')!
 const pages = x.pages.map(p => ({ ...p })), mine = pages.find(p => p.n === page.n)!, texts = x.text.split(SEP)
 while (texts.length < pages.length) texts.push('')
 const bytes = await original(env, checksum, x.size)
 if (!bytes) return save(env, row, { ...x, state: 'failed', lease: null, problem: 'The original could not be found in storage.' })
 const image = await picture(bytes, x.mediaType, page.n)
 if (!image) Object.assign(mine, { state: 'empty', problem: 'This page has no text and no picture.' })
 else if ('problem' in image) Object.assign(mine, { state: 'failed', problem: image.problem })
 else {
  await env.BLOBS.put(copyKey(checksum, page.n), image.bytes, { httpMetadata: { contentType: image.mediaType } })
  try {
   const t = await attempt(env,'chest:reader','provider.ocr',row.id,{authority:'installation reader',provider:config.provider,model:config.model,page:page.n,checksum:row.id.slice(8)},()=>transcribe(config, image, x.mediaType === 'application/pdf' ? `page ${page.n} of ${pages.length} of a scanned PDF` : 'this photo of a document'))
   Object.assign(mine, { state: 'done', chars: t.text.length, language: t.language, confidence: t.confidence, image: { mediaType: image.mediaType, width: image.width, height: image.height }, problem: t.readable ? undefined : 'No legible text on this page.', attempts: undefined })
   texts[page.n - 1] = t.text.replaceAll(SEP, ' ')
   x.usage = added(x.usage, t.usage)
  } catch (e) {
   const message = e instanceof ReaderError ? e.message : 'The AI model gave no usable reading.'
   Object.assign(mine, (mine.attempts ?? 0) >= ATTEMPTS ? { state: 'failed', problem: message } : { problem: message })
  }
 }
 const { text, truncatedAt } = join(texts)
 return save(env, row, { ...x, pages, text, truncatedAt, model: config.model, state: finished(pages), lease: null })
}
async function readDocument(env: Bindings, row: Row<Reading>, config: ReaderConfig | null, blocked: { state: 'needs_key' | 'unavailable'; line: string } | null) {
 const r = row.payload, doc = await maybe<Document>(env, 'document', r.document), item = doc ? null : await maybe<Item>(env, 'item', r.document), extraction = await maybe<Extraction>(env, 'extract', extractId(r.checksum))
 if ((!doc && !item) || !extraction) return save(env, row, { ...r, state: 'failed', lease: null, problem: 'The record or its reading is no longer here.' })
 const schemaId = doc?.payload.schema ?? item?.payload.filing?.schema, schema = schemaId ? await maybe<Schema>(env, 'schema', schemaId) : null, wanted = schema?.payload.fields ?? []
 if (!wanted.length) return save(env, row, { ...r, state: 'no_fields', lease: null })
 const scanned = extraction.payload.pages.filter(p => p.source !== 'text' && p.state === 'done' && p.image).slice(0, MAX_FIELD_PAGES)
 if (!scanned.length) {
  if (['needs_key', 'unavailable'].includes(extraction.payload.state)) return save(env, row, { ...r, state: extraction.payload.state as ReadingState, lease: null, problem: extraction.payload.problem })
  return save(env, row, { ...r, state: 'not_scan', lease: null })
 }
 if (!config) return save(env, row, { ...r, state: blocked!.state, lease: null, problem: blocked!.line })
 const pages: { n: number; image: PageImage }[] = []
 for (const p of scanned) { const copy = await env.BLOBS.get(copyKey(r.checksum, p.n)); if (copy) pages.push({ n: p.n, image: { mediaType: p.image!.mediaType as PageImage['mediaType'], bytes: new Uint8Array(await copy.arrayBuffer()), width: p.image!.width, height: p.image!.height } }) }
 try {
  const { proposals, usage } = await attempt(env,'chest:reader','provider.fields',r.document,{authority:'installation reader',provider:config.provider,model:config.model,version:r.version},()=>readFields(config, pages, wanted, schema!.payload.name))
  const previousRows = (await env.DB.prepare("SELECT payload FROM chest_records WHERE kind='reading' AND json_extract(payload,'$.document')=? AND json_extract(payload,'$.state')='done' ORDER BY json_extract(payload,'$.createdAt') DESC").bind(r.document).all()).results as {payload:string}[]
  const versions = doc?.payload.versions ?? item!.payload.versions, retained = new Set(versions.slice(0,versions.findIndex(v => v.id === r.version)).map(v => v.id))
  const earlier = previousRows.map(x => JSON.parse(x.payload) as Reading).filter(x => retained.has(x.version) && x.schema === schema!.id)
  const changed = proposals.filter((p: Proposal) => !earlier.some(r => r.proposals.some(old => old.field === p.field && old.decision && old.found === p.found && JSON.stringify(old.value) === JSON.stringify(p.value))))
  return save(env, row, { ...r, schema:schema!.id, schemaRevision:schema!.revision, unchanged:proposals.length-changed.length, state: 'done', proposals:changed, model: config.model, usage: added(r.usage, usage), lease: null, problem: null })
 } catch (e) {
  const message = e instanceof ReaderError ? e.message : 'The AI model gave no usable reading.'
  return save(env, row, { ...r, ...(r.attempts >= ATTEMPTS ? { state: 'failed' } : {}), lease: null, problem: message })
 }
}
// One unit of work on one record, under a lease so two Workers never read the same page at once.
async function unit(env: Bindings, found: Row<any>) {
 const lease = new Date(Date.now() + LEASE).toISOString()
 if (found.kind === 'extract') {
  const x = found.payload as Extraction, waiting = x.pages.find(p => p.state === 'waiting')
  const pages = waiting ? x.pages.map(p => p.n === waiting.n ? { ...p, attempts: (p.attempts ?? 0) + 1 } : p) : x.pages
  const row = await save<Extraction>(env, found, { ...x, pages, lease })
  if (!row) return
  if (!x.pages.length) return analyse(env, row)
  if (waiting && (waiting.attempts ?? 0) >= ATTEMPTS) return save(env, row, { ...row.payload, pages: row.payload.pages.map(p => p.n === waiting.n ? { ...p, state: 'failed' as const, problem: p.problem ?? 'Reading this page stopped three times without finishing.' } : p), state: finished(row.payload.pages.map(p => p.n === waiting.n ? { ...p, state: 'failed' as const } : p)), lease: null })
  const reader = await readerState(env)
  if (!('config' in reader)) return save(env, row, { ...row.payload, pages: x.pages, state: 'unavailable' in reader ? 'unavailable' : 'needs_key', problem: 'unavailable' in reader ? reader.unavailable : reader.missing, lease: null })
  return readPage(env, row, reader.config)
 }
 const r = found.payload as Reading, row = await save<Reading>(env, found, { ...r, state: 'reading', attempts: r.attempts + 1, lease })
 if (!row) return
 const reader = await readerState(env)
 return readDocument(env, row, 'config' in reader ? reader.config : null, 'config' in reader ? null : 'unavailable' in reader ? { state: 'unavailable', line: reader.unavailable } : { state: 'needs_key', line: reader.missing })
}
// Units for up to `budget` ms; a unit already started may take up to the provider deadline (25 s), which keeps one
// run inside the 30 s a Worker has after its response.
let running: Promise<void> | null = null, looked = 0
export function advance(env: Bindings, budget = 4000, fresh = false): Promise<void> {
 if (fresh) looked = 0
 if (running) return running
 running = (async () => {
  const end = Date.now() + budget
  try {
   while (Date.now() < end) {
    let found = await nextUnit(env)
    if (!found && Date.now() - looked > 2000) { looked = Date.now(); if (await discover(env)) found = await nextUnit(env) }
    if (!found) break
    await attempt(env,'chest:reader','automation.read',found.payload.document ?? found.id,{authority:'installation reader',version:found.payload.version ?? null,checksum:found.payload.checksum ?? found.id.slice(8)},()=>unit(env, found!))
   }
  } catch (e) { console.error('chest reading', e) }
 })().finally(() => { running = null })
 return running
}
// After any signed-in request, without delaying its answer; a change (any POST) looks for new versions at once.
export function kick(env: Bindings, request?: Request) { try { waitUntil(advance(env, 4000, request?.method === 'POST')) } catch (e) { console.error('chest reading', e) } }
// A saved key restarts files that waited for one, and pages that failed at the provider; "Read again" on one file
// restarts only that file.
export async function requeue(env: Bindings, checksum?: string) {
 const rows = (await env.DB.prepare(`SELECT * FROM chest_records WHERE kind IN ('extract','reading') AND json_extract(payload,'$.state') IN ('needs_key','unavailable','partial','failed')${checksum ? " AND (id=? OR json_extract(payload,'$.checksum')=?)" : ''}`).bind(...(checksum ? [extractId(checksum), checksum] : [])).all()).results.map(decode<any>)
 for (const row of rows) {
  if (row.kind === 'extract') {
   const x = row.payload as Extraction, pages = x.pages.map(p => p.source !== 'text' && (p.state === 'failed' || p.state === 'waiting') ? { ...p, state: 'waiting' as const, attempts: 0, problem: undefined } : p)
   if (x.pages.length && pages.some(p => p.state === 'waiting')) await save(env, row, { ...x, pages, state: 'reading', problem: null, lease: null })
  } else if (['needs_key', 'unavailable', 'failed'].includes(row.payload.state)) await save(env, row, { ...row.payload, state: 'waiting', attempts: 0, problem: null, lease: null })
 }
}
// A person asks for a record's version to be read (an earlier version, or again after a failure). Earlier
// decisions stay on their own version.
export async function requestReading(env: Bindings, doc: string, version: string, checksum: string) {
 const existing = await maybe<Reading>(env, 'reading', readingId(doc, version)), at = now()
 if (existing) { if (['failed', 'needs_key', 'unavailable'].includes(existing.payload.state)) await save(env, existing, { ...existing.payload, state: 'waiting', attempts: 0, problem: null, lease: null }); return }
 await env.DB.prepare('INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(readingId(doc, version), 'reading', JSON.stringify({ document: doc, version, checksum, state: 'waiting', proposals: [], model: null, problem: null, lease: null, attempts: 0, usage: { input: 0, output: 0 }, createdAt: at, updatedAt: at } satisfies Reading), crypto.randomUUID()).run()
}
export const extraction = (env: Bindings, checksum: string) => maybe<Extraction>(env, 'extract', extractId(checksum))
// Text search over extracted text: the hashes whose text holds the query, with a snippet. Callers only ask about
// versions the person can open.
export async function textHits(env: Bindings, q: string): Promise<Map<string, string>> {
 if (!q) return new Map()
 const rows = (await env.DB.prepare(`SELECT id, json_extract(payload,'$.text') AS text FROM chest_records WHERE kind='extract' AND instr(lower(json_extract(payload,'$.text')), ?) > 0`).bind(q.toLowerCase()).all()).results as { id: string; text: string }[]
 // The snippet starts at a word a little before the match, so the match stays in view on a one-line result row.
 const snippet = (text: string) => { const at = text.toLowerCase().indexOf(q.toLowerCase()), from = Math.max(0, at - 24), start = from && text.slice(from, at).search(/\s/) >= 0 ? from + text.slice(from, at).search(/\s/) + 1 : from
  return (start ? '…' : '') + text.slice(start, at + q.length + 80).replaceAll(SEP, ' ').replace(/\s+/g, ' ').trim() }
 return new Map(rows.map(r => [r.id.slice('extract:'.length), snippet(r.text)]))
}
// A page image as read. Archives carry originals only, so after a restore the copy is made again from the original,
// the same way (no AI model involved).
export async function pageImageOf(env: Bindings, checksum: string, n: number): Promise<{ body: ReadableStream | ArrayBuffer; mediaType: string } | null> {
 const x = await extraction(env, checksum), page = x?.payload.pages.find(p => p.n === n && p.image)
 if (!x || !page) return null
 const blob = await env.BLOBS.get(copyKey(checksum, n)); if (blob) return { body: blob.body, mediaType: page.image!.mediaType }
 const bytes = await original(env, checksum, x.payload.size), image = bytes && await picture(bytes, x.payload.mediaType, n)
 if (!image || 'problem' in image) return null
 await env.BLOBS.put(copyKey(checksum, n), image.bytes, { httpMetadata: { contentType: image.mediaType } })
 return { body: image.bytes.slice().buffer as ArrayBuffer, mediaType: image.mediaType }
}
// Erasing an original also erases what was read from it.
export async function eraseReading(env: Bindings, checksum: string) {
 const x = await extraction(env, checksum)
 for (const p of x?.payload.pages ?? []) if (p.image) await env.BLOBS.delete(copyKey(checksum, p.n))
 await env.DB.prepare("DELETE FROM chest_records WHERE (id=? AND kind='extract') OR (kind='reading' AND json_extract(payload,'$.checksum')=?)").bind(extractId(checksum), checksum).run()
}
