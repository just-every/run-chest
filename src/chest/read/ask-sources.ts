import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, type Row } from '../model'
import { allowed, context, demand, everything, who } from '../files/access'
import type { FileVersion, Item } from '../files/model'
import { extraction } from './jobs'
import type { AskPassage } from './ask-provider'
export type AskSource = AskPassage & { name: string; method: string; confidence: number | null; checksum: string }
export type Skipped = { name: string; reason: string }
export async function askSources(env: Bindings, s: Session, root: string, history: boolean) {
 const w = await who(env, s), ctx = await context(env, w, root); demand(ctx, 'view')
 const selected = ctx.chain.at(-1)!, entries = await everything(env, w), sources: AskSource[] = [], skipped: Skipped[] = [], fences: Row[] = [...ctx.fences], versions: { item: string; version: string; checksum: string }[] = []
 const inside = (row: Row<Item>) => { const visited = new Set<string>(); for (let r: Row<Item> | undefined = row; r && !visited.has(r.id); r = r.payload.parent ? entries.get(r.payload.parent)?.row : undefined) { if (r.id === root) return true; visited.add(r.id) } return false }
 let restricted = false
 for (const { row } of entries.values()) {
  if (row.payload.type !== 'file' || !inside(row)) continue
  let file
  try { file = await context(env, w, row.id); demand(file, 'download') } catch { restricted = true; continue }
  if (!allowed(file, 'download')) { restricted = true; continue }
  const vs: FileVersion[] = history ? row.payload.versions : row.payload.versions.filter(v => v.id === row.payload.current)
  fences.push(...file.fences, row)
  for (const v of vs) {
   const x = await extraction(env, v.checksum), text = v.text || x?.payload.text || ''
   if (!text.trim()) { skipped.push({ name: row.payload.name, reason: x?.payload.state === 'failed' || x?.payload.state === 'unsupported' || x?.payload.state === 'done' ? 'Unreadable' : 'Not yet extracted' }); continue }
   if (sources.length >= 60) { skipped.push({ name: row.payload.name, reason: 'Run source limit reached' }); continue }
   versions.push({ item: row.id, version: v.id, checksum: v.checksum })
   for (const [i, passage] of text.split('\f').entries()) {
    if (!passage.trim()) continue
    if (sources.length >= 60 || passage.length > 20000 || sources.reduce((n, p) => n + p.text.length, 0) + passage.length > 60000) { skipped.push({ name: row.payload.name, reason: 'Run text limit reached; evidence incomplete' }); continue }
    sources.push({ id: `source-${sources.length + 1}`, item: row.id, version: v.id, page: i + 1, text: passage, name: row.payload.name, method: v.text ? v.parser : x?.payload.model ?? 'Original text layer', confidence: x?.payload.pages[i]?.confidence ?? null, checksum: v.checksum })
   }
   if (x && x.payload.state !== 'done') skipped.push({ name: row.payload.name, reason: 'Extraction incomplete; only available passages included' })
  }
 }
 if (restricted) skipped.push({ name: 'Restricted entries', reason: 'No access to original text; names and counts withheld' })
 insist(selected.payload.type === 'folder' || versions.length > 0, 'file_not_yet_readable', 409)
 return { sources, skipped, versions, fences: [...new Map(fences.map(r => [r.id, r])).values()] }
}
