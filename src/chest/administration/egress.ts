import { canAdmin } from './roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { now } from '../model'
import { commit, maybe } from '../files/repo'
import { viewFilter } from '../audit/privacy'
import { eventCondition, reportScope } from './report-scope'
import { csvCell, eventFilters } from './reports'
import type { CostRates } from './costs'

const basis = 'Original response bytes emitted by instrumented file, device, shared-link and delivery-package doors. Repeated and overlapping ranges count again. Cancellation records the emitted prefix; refused requests emit no original bytes. This is server stream evidence, not proof of client receipt or a provider invoice. Historical requests before metering, rendered previews, archives, signing and provider traffic are not covered. Unknown rates remain unknown. A process crash can lose an unfinished stream receipt; this report does not claim complete billed egress.'
// Snapshot the confirmed quote before streaming so a later rate edit never reprices history.
export async function meterOriginal(env: Bindings, response: Response, item: string, actor: string, door: string) {
 if (!response.ok || !response.body) return response
 const rates = (await maybe<CostRates>(env, 'admin-cost-rates', 'admin-cost-rates'))?.payload ?? null
 const at = now(), reader = response.body.getReader(); let bytes = 0, recorded = false
 async function record(outcome: string) {
  if (recorded) return
  recorded = true
  await commit(env, null, [], { by: actor, audits: [{ action: 'transfer.egress', object: item, detail: {
   startedAt: at, door, bytes, outcome, provider: rates?.provider ?? null, quote: rates?.quote ?? null,
   rateAt: rates?.updatedAt ?? null, usdPerGb: rates?.egressUsdPerGb ?? null,
   usd: rates ? Number((bytes / 1e9 * rates.egressUsdPerGb).toFixed(9)) : null,
  } }] })
 }
 const body = new ReadableStream<Uint8Array>({
  async pull(controller) {
   try { const part = await reader.read(); if (part.done) { await record('complete'); controller.close() }
    else { bytes += part.value.byteLength; controller.enqueue(part.value) }
   } catch (error) { try { await record('failed') } finally { controller.error(error); await reader.cancel(error) } }
  },
  async cancel(reason) { try { await reader.cancel(reason) } finally { await record('cancelled') } },
 })
 return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}
export async function administrativeEgress(env: Bindings, s: Session, params: URLSearchParams) {
 const scope = await reportScope(env, s, params.get('group')), fence = eventCondition(scope)
 const dates = new URLSearchParams(); for (const key of ['from','to']) if (params.get(key)) dates.set(key,params.get(key)!)
 const filter = eventFilters(dates), visible = await viewFilter(env,true,true)
 const result = await env.DB.prepare(`SELECT actor,object_id,at,action,detail FROM chest_audit a WHERE action='transfer.egress' AND ${fence.sql}${filter.conditions.length ? ' AND '+filter.conditions.join(' AND ') : ''} ORDER BY at,id`).bind(...fence.params,...filter.values).all<{actor:string;object_id:string;at:string;action:string;detail:string}>()
 const showCosts = await canAdmin(env,s,'audit-reporting')
 const rows = result.results.filter(r=>visible(r)).map(r=>{const d=JSON.parse(r.detail);return {item:r.object_id,at:r.at,startedAt:d.startedAt,door:d.door,bytes:d.bytes,outcome:d.outcome,provider:showCosts?d.provider:null,quote:showCosts?d.quote:null,rateAt:showCosts?d.rateAt:null,usdPerGb:showCosts?d.usdPerGb:null,usd:showCosts?d.usd:null}})
 const bytes = rows.reduce((n,r)=>n+r.bytes,0), unknownBytes = rows.filter(r=>r.usd===null).reduce((n,r)=>n+r.bytes,0)
 const estimatedUsd = Number(rows.reduce((n,r)=>n+(r.usd??0),0).toFixed(9))
 await commit(env,s,[],{audits:[{action:'admin.egress.read',object:'administration',detail:{count:rows.length}}]})
 return {basis,rows,bytes,unknownBytes,estimatedUsd,groups:scope.groups}
}
export async function administrativeEgressCsv(env: Bindings, s: Session, params: URLSearchParams) {
 const d=await administrativeEgress(env,s,params)
 const rows=d.rows.map(r=>[r.at,r.startedAt,r.item,r.door,r.bytes,r.outcome,r.provider,r.quote,r.rateAt,r.usdPerGb,r.usd])
 return new Response(['Completed at,Started at,Item ID,Door,Emitted bytes,Outcome,Provider,Quote,Rate recorded at,USD per decimal GB,Estimated USD',...rows.map(r=>r.map(csvCell).join(','))].join('\r\n')+'\r\n',{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="chest-egress.csv"','cache-control':'no-store'}})
}
