import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { access } from '../access'
import { insist, type Document } from '../model'
import { get } from '../store'
import { extraction } from './jobs'
import type { AskSource, Skipped } from './ask-sources'
export async function libraryAskSources(env: Bindings, s: Session, root: string, history: boolean) {
 const doc = await get<Document>(env, 'document', root), fences = [doc, ...await access(env, s, doc.payload)]
 insist(!doc.payload.trash, 'not_found', 404)
 const chosen = doc.payload.approved ?? doc.payload.versions.at(-1)?.id
 const sources: AskSource[] = [], skipped: Skipped[] = [], versions: { item: string; version: string; checksum: string }[] = []
 for (const v of doc.payload.versions.filter(v => history || v.id === chosen)) {
  const x = await extraction(env, v.checksum), text = v.text || x?.payload.text || ''
  if (!text.trim()) { skipped.push({ name: v.filename, reason: x?.payload.state === 'failed' || x?.payload.state === 'unsupported' ? 'Unreadable' : 'Not yet extracted' }); continue }
  versions.push({ item: root, version: v.id, checksum: v.checksum })
  for (const [i, passage] of text.split('\f').entries()) {
   if (!passage.trim()) continue
   if (sources.length >= 60 || passage.length > 20000 || sources.reduce((n, p) => n + p.text.length, 0) + passage.length > 60000) { skipped.push({ name: v.filename, reason: 'Run text limit reached; evidence incomplete' }); continue }
   sources.push({ id: `source-${sources.length + 1}`, kind: 'documents', item: root, version: v.id, page: i + 1, text: passage, name: v.filename, method: v.text ? 'Original text' : x?.payload.model ?? 'Original text layer', confidence: x?.payload.pages[i]?.confidence ?? null, checksum: v.checksum })
  }
 }
 insist(sources.length, 'file_not_yet_readable', 409)
 return { sources, skipped, versions, fences }
}
