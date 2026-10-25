import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
import { canAdmin, requireAdmin } from './roles'

export type CostRates = {
 objectProvider?: string
 objectOperations?: Record<string, number>
 objectInboundUsdPerGb?: number
 objectOutboundUsdPerGb?: number
 aiProvider?: string
 aiServiceTier?: string
 aiModel?: string
 aiInputUsdPerMillion?: number
 aiOutputUsdPerMillion?: number
 aiRequestUsd?: number
 aiCacheReadUsdPerMillion?: number
 aiCacheWrite5mUsdPerMillion?: number
 aiCacheWrite1hUsdPerMillion?: number
 provider: string
 storageUsdPerGbMonth: number
 egressUsdPerGb: number
 quote: string
 updatedAt: string
 updatedBy: string
}
export type CostSettings = { rates: CostRates | null; notice: string }
const key = 'admin-cost-rates'
const notice = 'Owner-entered provider rates in USD are estimates, not invoices or live prices. Storage estimates show the monthly run rate for current retained originals, including versions and trash, using decimal GB (1 GB = 1,000,000,000 bytes). They exclude derived files, staging, backups and other provider charges. Saving rates does not enable paid work.'

export async function costSettings(env: Bindings, s: Session): Promise<CostSettings> {
 const privilege = await canAdmin(env, s, 'service-settings') ? 'service-settings' : 'audit-reporting'
 await requireAdmin(env, s, privilege)
 return { rates: (await maybe<CostRates>(env, key, key))?.payload ?? null, notice }
}

function plain(value: unknown, name: string, max: number) {
 const result = text(value, name, max)
 insist(!/[<>\p{Cc}\p{Cf}]/u.test(result), `invalid_${name}`)
 return result
}
function rate(value: unknown, name: string) {
 insist(typeof value === 'number' || typeof value === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()), `invalid_${name}`)
 const result = typeof value === 'number' ? value : Number(value.trim())
 insist(Number.isFinite(result) && result >= 0, `invalid_${name}`)
 return result
}

export async function saveCostSettings(env: Bindings, s: Session, input: any): Promise<CostSettings> {
 await requireAdmin(env, s, 'service-settings')
 insist(input?.confirm === true, 'cost_confirmation_required')
 let operations:Record<string,number>|undefined
 if(input.objectProvider){
  let supplied=input.objectOperations??{}
  if(typeof supplied==='string'){try{supplied=JSON.parse(supplied)}catch{insist(false,'invalid_object_operations')}}
  insist(supplied&&typeof supplied==='object'&&!Array.isArray(supplied),'invalid_object_operations')
  const allowed=['list','read','write','delete','multipart-start','multipart-part','multipart-complete','multipart-abort','database-export','database-download','database-import','database-upload','database-query']
  insist(Object.keys(supplied).every(k=>allowed.includes(k)),'invalid_object_operation')
  operations=Object.fromEntries(Object.entries(supplied).map(([k,v])=>[k,rate(v,'object_operation_rate')]))
 }
 const rates: CostRates = {
  ...(input.objectProvider?{objectProvider:plain(input.objectProvider,'object_provider',120),objectOperations:operations,objectInboundUsdPerGb:rate(input.objectInboundUsdPerGb,'object_inbound_rate'),objectOutboundUsdPerGb:rate(input.objectOutboundUsdPerGb,'object_outbound_rate')}:{}),
  ...(input.aiProvider?{aiProvider:plain(input.aiProvider,'ai_provider',120),aiModel:plain(input.aiModel||'request','ai_model',120),aiInputUsdPerMillion:rate(input.aiInputUsdPerMillion,'ai_input_rate'),aiOutputUsdPerMillion:rate(input.aiOutputUsdPerMillion,'ai_output_rate'),aiRequestUsd:rate(input.aiRequestUsd??0,'ai_request_rate')}:{}),
  ...(input.aiServiceTier?{aiServiceTier:plain(input.aiServiceTier,'ai_service_tier',80)}:{}),
  ...Object.fromEntries(['aiCacheReadUsdPerMillion','aiCacheWrite5mUsdPerMillion','aiCacheWrite1hUsdPerMillion'].filter(k=>input[k]!==undefined&&input[k]!=='').map(k=>[k,rate(input[k],k)])),
  provider: plain(input.provider, 'provider', 120),
  quote: plain(input.quote, 'quote', 300),
  storageUsdPerGbMonth: rate(input.storageUsdPerGbMonth, 'storage_rate'),
  egressUsdPerGb: rate(input.egressUsdPerGb, 'egress_rate'),
  updatedAt: now(), updatedBy: s.operator.email,
 }
 const previous = await maybe<CostRates>(env, key, key)
 const row = previous ? next(previous, rates) : fresh(key, rates, key)
 await commit(env, s, [{ row, previous: previous ?? undefined }], {
  audits: [{ action: 'admin.cost-rates.save', object: key, detail: { before: previous?.payload ?? null, after: rates } }],
 })
 return { rates, notice }
}

export function storageEstimate(bytes: number, rates: CostRates | null): { usd: number; unit: 'GB-month'; basis: string } | null {
 if (!rates) return null
 insist(Number.isFinite(bytes) && bytes >= 0, 'invalid_storage_bytes')
 const estimate = bytes / 1e9 * rates.storageUsdPerGbMonth
 insist(Number.isFinite(estimate), 'invalid_cost_estimate')
 return {
  usd: Number(estimate.toFixed(6)), unit: 'GB-month',
  basis: `${bytes} retained-original bytes / 1,000,000,000 × USD ${rates.storageUsdPerGbMonth} per GB-month; current monthly run-rate estimate from ${rates.provider}, quote: ${rates.quote}. Not an invoice or historical spend.`,
 }
}
