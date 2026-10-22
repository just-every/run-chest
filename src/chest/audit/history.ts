import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { documents } from '../access'
import { allowed, everything, who } from '../files/access'
import { interrupted, safeDetail } from './journal'
import { identityRedactor, viewFilter } from './privacy'
export type Event = { id: string; actor: string; action: string; object_id: string; detail: string; at: string }
export async function history(env: Bindings, s: Session, params: URLSearchParams, forcedLimit?: number) {
 await interrupted(env)
 const limit = forcedLimit ?? Number(params.get('limit') || 50); insist(Number.isInteger(limit) && limit > 0 && limit <= 300, 'invalid_limit')
 const entries = await everything(env, await who(env, s)), visibleDocs = new Set((await documents(env, s)).map(r => r.id)), redact = await identityRedactor(env)
 const filters = new Map<string, Awaited<ReturnType<typeof viewFilter>>>()
 // Admin audit follows personal view-hiding too; collaborator exports have exactly the panel's current-access scope.
 const transform = async (row: Event) => {
  const item = entries.get(row.object_id), owner = s.operator.role === 'owner'
  if (!owner && !(item?.state.role && !item.state.trash) && !visibleDocs.has(row.object_id)) return null
  const editor = owner || !!item && allowed(item, 'contribute'), manager = owner || !!item && allowed(item, 'administer'), key = `${editor}:${manager}`
  if (!filters.has(key)) filters.set(key, await viewFilter(env, editor, manager))
  const filtered = filters.get(key)!(row); if (!filtered) return null
  let detail: any; try { detail = safeDetail(JSON.parse(filtered.detail)) } catch { detail = {} }
  // A version-scoped organization viewer cannot learn about excluded replacements through the audit/export door.
  if(!owner&&item&&!item.directState?.role&&detail.version&&!item.row.payload.versions.some(v=>v.id===detail.version))return null
  return JSON.parse(await redact(JSON.stringify({ ...filtered, detail: JSON.stringify(detail) }))) as Event
 }
 let cursor: { at: string; id: string } | null = null
 if (params.get('cursor')) { try { cursor = JSON.parse(atob(params.get('cursor')!)); insist(cursor && typeof cursor.at === 'string' && typeof cursor.id === 'string', 'invalid_cursor') } catch { insist(false, 'invalid_cursor') } }
 const rows: Event[] = []; let more = false
 while (!more) {
  const conditions: string[] = [], values: unknown[] = []
  if (cursor) { conditions.push('(at<? OR (at=? AND id<?))'); values.push(cursor.at, cursor.at, cursor.id) }
  for (const [name, column] of [['actor','actor'],['action','action'],['object','object_id']] as const) if (params.get(name)) { conditions.push(`${column}=?`); values.push(params.get(name)) }
  for (const [name, op] of [['from','>='],['to','<=']] as const) if (params.get(name)) { insist(Number.isFinite(Date.parse(params.get(name)!)), 'invalid_date'); conditions.push(`at${op}?`); values.push(new Date(params.get(name)!).toISOString()) }
  if (params.get('q')) { conditions.push("instr(lower(actor||' '||action||' '||object_id||' '||detail),?)>0"); values.push(params.get('q')!.toLowerCase()) }
  if (params.get('outcome')) { conditions.push("coalesce(json_extract(detail,'$.outcome'),'succeeded')=?"); values.push(params.get('outcome')) }
  const batch = (await env.DB.prepare(`SELECT * FROM chest_audit${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''} ORDER BY at DESC,id DESC LIMIT 100`).bind(...values).all()).results as Event[]
  if (!batch.length) break
  for (const row of batch) {
   const event = await transform(row)
   if (event && rows.length === limit) { more = true; break }
   cursor = { at: row.at, id: row.id }
   if (event) rows.push(event)
  }
  if (more || batch.length < 100) break
 }
 return { rows, next: more && cursor ? btoa(JSON.stringify(cursor)) : null }
}
export function exportHistory(env: Bindings, s: Session, params: URLSearchParams) {
 const filter = new URLSearchParams(params); filter.delete('cursor'); filter.set('limit','100')
 const stream = new ReadableStream({ async start(controller) {
  try {
   do { const page = await history(env, s, filter); for (const row of page.rows) controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...row, detail: JSON.parse(row.detail) }) + '\n')); if (!page.next) break; filter.set('cursor', page.next) } while (true)
   controller.close()
  } catch (error) { controller.error(error) }
 } })
 return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'content-disposition': 'attachment; filename="chest-audit.ndjson"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
}
