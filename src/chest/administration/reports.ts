import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { commit } from '../files/repo'
import { interrupted } from '../audit/journal'
import { viewFilter } from '../audit/privacy'
import { eventCondition, reportScope } from './report-scope'

export const reportCategories = ['all','sharing','guests','downloads','sync','transfers','ai','editor'] as const
const categorySql: Record<string, string> = {
 sharing: "(action LIKE '%grant%' OR action LIKE '%share%' OR action LIKE '%link.%' OR action LIKE '%policy%' OR action LIKE '%member%')",
 guests: "(action LIKE 'guest.%' OR action LIKE 'link.%' OR action LIKE '%public-link%' OR action LIKE '%guest%')",
 downloads: "(action LIKE '%download%' OR action LIKE '%bytes%')",
 sync: "(action LIKE 'device.%' OR action LIKE 'sync.%' OR action LIKE '%sync-repair%')",
 transfers: "(action LIKE 'transfer.%' OR action LIKE '%transfer%')",
 ai: "(action LIKE 'provider.%' OR action LIKE 'automation.%' OR action LIKE 'agent.%')",
 editor: "(action LIKE '%office%' OR json_extract(detail,'$.code')='editor_capacity_reached')",
}
type Event = { id: string; actor: string; action: string; object_id: string; at: string; outcome: string }
type Cursor = { at: string; id: string }
function cursor(value: string | null): Cursor | null {
 if (!value) return null
 try { const c = JSON.parse(atob(value)); insist(typeof c.at === 'string' && Number.isFinite(Date.parse(c.at)) && typeof c.id === 'string' && c.id.length <= 200, 'invalid_cursor'); return c } catch { insist(false, 'invalid_cursor') }
}
export function eventFilters(params: URLSearchParams) {
 const conditions: string[] = [], values: unknown[] = []
 let from: number | undefined, to: number | undefined
 for (const [name, op] of [['from','>='],['to','<=']] as const) if (params.get(name)) {
  const time = Date.parse(params.get(name)!); insist(Number.isFinite(time), 'invalid_date')
  if (name === 'from') from = time; else to = time
  conditions.push(`at${op}?`); values.push(new Date(time).toISOString())
 }
 insist(from === undefined || to === undefined || from <= to, 'invalid_date_range')
 for (const [name, column] of [['actor','actor'],['action','action'],['object','object_id'],['outcome',"coalesce(json_extract(detail,'$.outcome'),'succeeded')"]] as const) if (params.get(name)) { conditions.push(`${column}=?`); values.push(params.get(name)) }
 const category = params.get('category') || 'all'; insist(reportCategories.includes(category as any), 'invalid_report_category')
 if (category !== 'all') conditions.push(categorySql[category])
 return { conditions, values }
}
export async function administrativeAudit(env: Bindings, s: Session, params: URLSearchParams, recordRead = true, bounds?: readonly string[]) {
 const scope = await reportScope(env, s, params.get('group'), bounds), filter = eventFilters(params), fence = eventCondition(scope)
 const limit = Number(params.get('limit') || 100); insist(Number.isInteger(limit) && limit > 0 && limit <= 300, 'invalid_limit')
 const after = cursor(params.get('cursor')), until = params.get('until') || new Date().toISOString()
 insist(Number.isFinite(Date.parse(until)), 'invalid_date')
 filter.conditions.push(fence.sql, 'at<=?'); filter.values.push(...fence.params, new Date(until).toISOString())
 await interrupted(env)
 const visible = await viewFilter(env,true,true), rows: Event[] = []
 let scan = after, more = false
 while (!more) {
  const conditions = [...filter.conditions], values = [...filter.values]
  if (scan) { conditions.push('(at<? OR (at=? AND id<?))'); values.push(scan.at,scan.at,scan.id) }
  const batch = (await env.DB.prepare(`SELECT id,actor,action,object_id,at,coalesce(json_extract(detail,'$.outcome'),'succeeded') outcome FROM chest_audit a WHERE ${conditions.join(' AND ')} ORDER BY at DESC,id DESC LIMIT 100`).bind(...values).all<Event>()).results
  if (!batch.length) break
  for (const row of batch) {
   const event = visible(row)
   if (event && rows.length === limit) { more = true; break }
   scan = { at:row.at,id:row.id }
   if (event) rows.push(event)
  }
  if (more || batch.length < 100) break
 }
 const next = more && scan ? btoa(JSON.stringify(scan)) : null
 // Bind the response to the current persisted administrative grant even for an empty report.
 await commit(env, s, [], recordRead ? { audits: [{ action: 'admin.audit.read', object: 'administration', detail: { count: rows.length } }] } : {})
 return { rows, next, until, limited: more, groups: scope.groups }
}
export const csvCell = (value: unknown) => { let text = String(value ?? ''); if (/^[=+\-@\t\r\n]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"','""') + '"' }
export async function administrativeAuditCsv(env: Bindings, s: Session, params: URLSearchParams) {
 const filter = new URLSearchParams(params); filter.delete('cursor'); filter.set('limit','300')
 // Authorize and validate before returning a successful download. Every later page checks live scope again.
 const first = await administrativeAudit(env, s, filter), encoder = new TextEncoder()
 filter.set('until', first.until)
 const stream = new ReadableStream({ async start(controller) {
  try {
   controller.enqueue(encoder.encode('At,Actor,Action,Object ID,Outcome\r\n'))
   let page = first
   while (true) {
    for (const r of page.rows) controller.enqueue(encoder.encode([r.at,r.actor,r.action,r.object_id,r.outcome].map(csvCell).join(',')+'\r\n'))
    if (!page.next) break
    filter.set('cursor',page.next); page = await administrativeAudit(env,s,filter,false)
   }
   controller.close()
  } catch (error) { controller.error(error) }
 } })
 return new Response(stream, { headers: { 'content-type':'text/csv; charset=utf-8', 'content-disposition':'attachment; filename="chest-administration.csv"', 'cache-control':'no-store', 'x-content-type-options':'nosniff' } })
}
