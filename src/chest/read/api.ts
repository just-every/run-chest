import { meterOriginal } from '../administration/egress'
import { assertContent } from '../content-security/scan'
import { decideItemField } from './item-fields'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { roles } from '../access'
import { get, recordAccess } from '../store'
import { ChestError, insist, type Document } from '../model'
import { allowed, context, demand, who } from '../files/access'
import { maybe } from '../files/repo'
import { decide } from './decide'
import { advance, extraction, kick, pageImageOf, readingId, READABLE, requestReading, requeue, type Extraction, type Reading } from './jobs'
import { readerView, removeReader, saveReader, testReader } from './settings'
// /api/chest routes for reading: progress and text of a version, the page images that boxes are drawn on, decisions
// on read field values, and the owner's AI key card. Access is the same as the original's on every request.
export type Summary = ReturnType<typeof summary>
export function summary(x: Extraction | null, mediaType: string, withText = true) {
 if (!x) return READABLE.includes(mediaType) ? { state: 'queued', pages: [], chars: 0, method: '', problem: null, truncatedAt: null, model: null, excerpt: '' } : null
 const scans = x.pages.filter(p => p.source !== 'text'), texts = x.pages.filter(p => p.source === 'text')
 const method = [texts.length ? (x.format ? `text of the ${x.format}` : 'PDF text layer') : '', scans.some(p => p.state === 'done') ? `read by ${x.model ?? 'the AI model'}` : ''].filter(Boolean).join(' and ')
 return { state: x.state, pages: x.pages.map(p => ({ n: p.n, source: p.source, state: p.state, chars: p.chars, language: p.language ?? null, confidence: p.confidence ?? null, image: !!p.image, width: p.image?.width ?? null, height: p.image?.height ?? null, problem: p.problem ?? null })), chars: x.text.replaceAll('\f', '').length, method, problem: x.problem, truncatedAt: x.truncatedAt, model: x.model, excerpt: withText ? x.text.slice(0, 20_000).replaceAll('\f', '\n\n') : '' }
}
async function pageCopy(env: Bindings, checksum: string, n: number) {
 await assertContent(env,checksum)
 const copy = await pageImageOf(env, checksum, n); if (!copy) throw new ChestError('not_found', 404)
 return new Response(copy.body, { headers: { 'content-type': copy.mediaType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "sandbox; default-src 'none'" } })
}
export async function readingExecute(env: Bindings, s: Session, method: string, parts: string[], input: any, url: URL): Promise<unknown> {
 const [head, key, sub, version, page] = parts, get_ = method === 'GET', post = method === 'POST'
 if (head === 'reading' && key === 'settings') {
  if (get_ && !sub) return readerView(env)
  if (post && !sub) return saveReader(env, s, input)
  if (post && sub === 'test') return testReader(env, s)
  if (post && sub === 'remove') return removeReader(env, s)
 }
 if (head === 'items' && key && ['reading','pages','fields'].includes(sub)) {
  const w = await who(env, s), ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'view')
  if (get_ && sub === 'reading') {
   if (url.searchParams.get('work') === '1') await advance(env)
   const v = item.payload.versions.find(v => v.id === (version || item.payload.current)); insist(v, 'version_not_found', 404)
   return { item: key, version: v.id, reading: summary((await extraction(env, v.checksum))?.payload ?? null, v.mediaType, false), versions: allowed(ctx,'download') ? await itemReadings(env,key,item.payload,false) : [] }
  }
  if (post && sub === 'reading') {
   demand(ctx, 'contribute'); const v = item.payload.versions.find(v => v.id === (version || item.payload.versions.at(-1)?.id)); insist(v, 'version_not_found', 404); await requestReading(env,key,v.id,v.checksum); await requeue(env, v.checksum); kick(env); return { item: key, state: 'queued' }
  }
  if (post && sub === 'fields' && version) return decideItemField(env,s,w,key,version,input)
  if (get_ && sub === 'pages') {
   const v = item.payload.versions.find(v => v.id === version); insist(v, 'version_not_found', 404)
   if (!allowed(ctx, 'download')) demand(ctx, 'download')
   const response = await pageCopy(env, v.checksum, Number(page))
   demand(await context(env, w, key), 'download'); await recordAccess(env, s, item, 'version.preview',v.id)
   return meterOriginal(env,response,key,s.operator.email,'extraction page')
  }
 }
 if (head === 'documents' && key && ['reading', 'pages', 'fields'].includes(sub)) {
  const doc = await get<Document>(env, 'document', key), r = await roles(env, s, doc.payload); if (!r.roles.length) throw new ChestError('not_found', 404)
  if (get_ && sub === 'reading' && !version) {
   if (url.searchParams.get('work') === '1') await advance(env)
   return { document: key, versions: await documentReadings(env, doc.id, doc.payload, false) }
  }
  if (post && sub === 'reading' && version) {
   insist(r.roles.includes('editor'), 'editor_required', 403); const v = doc.payload.versions.find(v => v.id === version); insist(v, 'version_not_found', 404)
   await requestReading(env, doc.id, v.id, v.checksum); kick(env); return { document: key, version, state: 'waiting' }
  }
  if (get_ && sub === 'pages') {
   const v = doc.payload.versions.find(v => v.id === version); insist(v, 'version_not_found', 404)
   const response = await pageCopy(env, v.checksum, Number(page)); await recordAccess(env, s, doc, 'version.preview',v.id); return meterOriginal(env,response,key,s.operator.email,'Library extraction page')
  }
  if (post && sub === 'fields' && version) return decide(env, s, doc, version, input)
 }
 return undefined
}
// Every version of a governed record: what was read from it, and the values proposed from its scan.
// The newest readable version's field reading counts as waiting from upload until the background work creates it.
export async function documentReadings(env: Bindings, id: string, doc: Document, withText = true) {
 return Promise.all(doc.versions.map(async (v, i) => {
  const reading = (await maybe<Reading>(env, 'reading', readingId(id, v.id)))?.payload ?? null, newest = i === doc.versions.length - 1 && !doc.trash && READABLE.includes(v.mediaType)
  return { version: v.id, reading: summary((await extraction(env, v.checksum))?.payload ?? null, v.mediaType, withText), fields: reading ? { state: reading.state, problem: reading.problem, model: reading.model, proposals: reading.proposals, unchanged:reading.unchanged ?? 0 } : newest ? { state: 'waiting', problem: null, model: null, proposals: [] } : null }
 }))
}

// Item readings retain the same version-bound shape as Library records.
export async function itemReadings(env: Bindings, id: string, item: import('../files/model').Item, withText = true) {
 if (!item.filing?.schema) return []
 return documentReadings(env,id,{...item,schema:item.filing.schema} as unknown as Document,withText)
}
