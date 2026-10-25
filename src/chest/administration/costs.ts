import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
import { canAdmin, requireAdmin } from './roles'

export type CostRates = {
 aiProvider?: string
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
 const rates: CostRates = {
  ...(input.aiProvider?{aiProvider:plain(input.aiProvider,'ai_provider',120),aiModel:plain(input.aiModel||'request','ai_model',120),aiInputUsdPerMillion:rate(input.aiInputUsdPerMillion,'ai_input_rate'),aiOutputUsdPerMillion:rate(input.aiOutputUsdPerMillion,'ai_output_rate'),aiRequestUsd:rate(input.aiRequestUsd??0,'ai_request_rate')}:{}),
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
