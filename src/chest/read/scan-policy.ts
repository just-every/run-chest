import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { endpointHash } from './provider-authority'
import { insist, now } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
import type { ReaderConfig } from './provider'

export type ScanPolicy = {
 enabled: boolean; maxCalls: number; maxOutput: number
 retention: 'until_original_erased'; providerRetention: string; residency: string
 provider: string; endpointHash: string; model: string; workspace: string; readerRevision: string; consentAt: string; by: string
}
const key = 'scan-policy'
export const scanPolicy = (env: Bindings) => maybe<ScanPolicy>(env, key, key)
export const SCAN_OFF = 'Automatic scan reading is off until the owner approves scan allowances and data retention in Reading scans settings.'
const plain = (v: unknown) => { insist(typeof v === 'string' && v.trim().length > 0 && v.length <= 300 && !/[<>\x00-\x1f]/.test(v), 'verified_provider_data_policy_required'); return v.trim() }
export async function saveScanPolicy(env: Bindings, s: Session, input: any) {
 owner(s)
 insist(input.confirm === true || input.confirm === 'true', 'explicit_scan_policy_consent_required')
 const enabled = input.enabled === true || input.enabled === 'true', previous = await scanPolicy(env)
 // Turning off requires no new provider attestation and cannot release spent allowances.
 if (!enabled && previous) {
  const row = next(previous, { ...previous.payload, enabled: false, consentAt: now(), by: s.operator.email })
  await commit(env, s, [{ row, previous }], { audits: [{ action: 'scan.policy', object: key, detail: row.payload }] })
  return row.payload
 }
 const maxCalls = Number(input.maxCalls), maxOutput = Number(input.maxOutput)
 insist(Number.isInteger(maxCalls) && maxCalls >= 1 && maxCalls <= 1000, 'invalid_scan_call_allowance')
 insist(Number.isInteger(maxOutput) && maxOutput >= 128 && maxOutput <= 16000, 'invalid_scan_output_allowance')
 insist(input.retention === 'until_original_erased', 'explicit_persistent_scan_retention_required')
 insist(input.verified === true || input.verified === 'true', 'verified_provider_terms_required')
 const reader = await env.DB.prepare('SELECT provider,endpoint,model,workspace,updated_at AS readerRevision FROM chest_reader WHERE id=1').first<{ provider: string; endpoint: string; model: string; workspace: string; readerRevision: string }>()
 insist(reader, 'reader_key_required', 409)
 const payload: ScanPolicy = { enabled, maxCalls, maxOutput, retention: 'until_original_erased', providerRetention: plain(input.providerRetention), residency: plain(input.residency), provider:reader.provider, model:reader.model, workspace:reader.workspace, readerRevision:reader.readerRevision, endpointHash:await endpointHash(reader.endpoint), consentAt: now(), by: s.operator.email }
 const row = previous ? next(previous, payload) : fresh(key, payload, key)
 await commit(env, s, [{ row, previous: previous ?? undefined }], {
  preconditions: [{ sql: 'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_reader WHERE id=1 AND provider=? AND endpoint=? AND model=? AND workspace=? AND updated_at=?) THEN 1 ELSE 0 END', params: [reader.provider, reader.endpoint, reader.model, reader.workspace, reader.readerRevision] }],
  audits: [{ action: 'scan.policy', object: key, detail: { ...payload, revision: row.revision } }],
 })
 return payload
}
// The checksum allowance is durable before dispatch, including calls with failed or uncertain outcomes.
// A policy edit never resets this count. Concurrent reservations fail closed; no paid call is retried here.
export async function reserveScan(env: Bindings, checksum: string, config: ReaderConfig, operation: 'ocr' | 'fields'): Promise<{ config: ReaderConfig } | { unavailable: string }> {
 const policy = await scanPolicy(env)
 if (!policy?.payload.enabled) return { unavailable: SCAN_OFF }
 const p = policy.payload
 if (p.provider !== config.provider || p.endpointHash !== await endpointHash(config.endpoint) || p.model !== config.model || p.workspace !== config.workspace || p.readerRevision !== config.readerRevision) return { unavailable: 'The saved reader settings changed. The owner must approve its current data terms in Reading scans settings.' }
 const budgetKey = `scan-allowance:${checksum}`, previous = await maybe<{ calls: number }>(env, 'scan-allowance', budgetKey), calls = previous?.payload.calls ?? 0
 if (calls >= p.maxCalls) return { unavailable: `The scan allowance of ${p.maxCalls} provider calls for these original bytes is exhausted. The original and confirmed values are retained. The owner can raise the allowance in Reading scans settings.` }
 const payload = { calls: calls + 1 }, row = previous ? next(previous, payload) : fresh('scan-allowance', payload, budgetKey)
 try {
  await commit(env, null, [{ row, previous: previous ?? undefined }], {
   fences: [policy], by: 'chest:reader',
   preconditions: [{ sql: 'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_reader WHERE id=1 AND provider=? AND endpoint=? AND model=? AND workspace=? AND updated_at=? AND key_sealed=?) THEN 1 ELSE 0 END', params: [config.provider, config.endpoint, config.model, config.workspace, config.readerRevision ?? null, config.authority ?? null] }],
   audits: [{ action: 'scan.reserve', object: budgetKey, detail: { operation, call: payload.calls, maximum: p.maxCalls, maxOutput: p.maxOutput, policy: { ...p, revision: policy.revision } } }],
  })
 } catch { return { unavailable: 'Scan policy or allowance changed before dispatch. No provider call was made. The owner can approve the current scan policy to resume blocked reading.' } }
 return { config: { ...config, maxOutput: p.maxOutput } }
}
