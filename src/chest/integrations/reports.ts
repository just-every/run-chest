import type { Bindings } from '../../auth.server'
import { insist } from '../model'
import { administrativeAudit, csvCell } from '../administration/reports'
import { reportScope } from '../administration/report-scope'
import { action, live, type Authorized } from './auth'

async function reportingAuthority(env: Bindings, auth: Authorized) {
 const current = await live(env, auth) as Authorized
 // Match the browser's staff refusal before considering the additional OAuth capability.
 await reportScope(env, current.session)
 action(current, 'admin-report')
 insist(current.grant.payload.reportGroups?.length, 'oauth_report_groups_required', 403)
 return current
}
export async function activityReport(env: Bindings, auth: Authorized, params: URLSearchParams) {
 const current = await reportingAuthority(env, auth)
 return administrativeAudit(env, current.session, params, true, current.grant.payload.reportGroups)
}
export async function activityReportCsv(env: Bindings, auth: Authorized, params: URLSearchParams) {
 const filter = new URLSearchParams(params)
 filter.delete('cursor')
 if (!filter.has('limit')) filter.set('limit', '300')
 // Validate before HTTP success, then discard the preview: no cached page may outlive its authority.
 const preview = await activityReport(env, auth, filter)
 filter.set('until', preview.until)
 let first = true
 const encoder = new TextEncoder()
 const stream = new ReadableStream<Uint8Array>({
  async pull(controller) {
   // Yield between output pages so queued revocation requests can commit before the next check.
   try {
    await scheduler.wait(0)
    const page = await activityReport(env, auth, filter)
    let text = first ? 'At,Actor,Action,Object ID,Outcome\r\n' : ''
    first = false
    for (const row of page.rows) text += [row.at,row.actor,row.action,row.object_id,row.outcome].map(csvCell).join(',') + '\r\n'
    if (page.next) filter.set('cursor', page.next)
    controller.enqueue(encoder.encode(text))
    if (!page.next) controller.close()
   } catch (error) { controller.error(error) }
  },
 }, { highWaterMark: 0 })
 return new Response(stream, { headers: {
  'content-type': 'text/csv; charset=utf-8',
  'content-disposition': 'attachment; filename="chest-administration.csv"',
  'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
 } })
}
