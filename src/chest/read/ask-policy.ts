import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { insist, now } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
export type AskPolicy = { enabled: boolean; maxUsd: number; maxOutput: number; providerRetention: string; residency: string; consentAt: string; by: string }
const key = 'ask-policy'
export const askPolicy = (env: Bindings) => maybe<AskPolicy>(env, key, key)
export async function saveAskPolicy(env: Bindings, s: Session, input: any) {
 owner(s)
 insist(input.confirm === true || input.confirm === 'true', 'explicit_ai_policy_consent_required')
 const maxUsd = Number(input.maxUsd), maxOutput = Number(input.maxOutput)
 insist(Number.isFinite(maxUsd) && maxUsd > 0 && maxUsd <= 1, 'invalid_run_budget')
 insist(Number.isInteger(maxOutput) && maxOutput >= 128 && maxOutput <= 4096, 'invalid_output_budget')
 const plain = (v: unknown) => { insist(typeof v === 'string' && v.trim().length > 0 && v.length <= 300 && !/[<>\x00-\x1f]/.test(v), 'provider_data_policy_required'); return v.trim() }
 const payload: AskPolicy = { enabled: input.enabled === true || input.enabled === 'true', maxUsd, maxOutput, providerRetention: plain(input.providerRetention), residency: plain(input.residency), consentAt: now(), by: s.operator.email }
 const previous = await askPolicy(env), row = previous ? next(previous, payload) : fresh(key, payload, key)
 await commit(env, s, [{ row, previous: previous ?? undefined }], { audits: [{ action: 'ask.policy', object: key, detail: payload }] })
 return payload
}
