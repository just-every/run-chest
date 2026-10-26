import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { digest } from '../blobs'
import { insist, now } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
export type AskPolicy = { enabled: boolean; maxUsd: number; maxOutput: number; providerRetention: string; residency: string; provider: string; endpointHash: string; model: string; workspace: string; readerRevision: string; consentAt: string; by: string }
const key = 'ask-policy'
export const askPolicy = (env: Bindings) => maybe<AskPolicy>(env, key, key)
export async function saveAskPolicy(env: Bindings, s: Session, input: any) {
 owner(s)
 insist(input.confirm === true || input.confirm === 'true', 'explicit_ai_policy_consent_required')
 const previous = await askPolicy(env)
 if ((input.enabled === false || input.enabled === 'false') && previous) {
  const row = next(previous, { ...previous.payload, enabled: false, consentAt: now(), by: s.operator.email })
  await commit(env, s, [{row,previous}], {audits:[{action:'ask.policy',object:key,detail:{...row.payload,revision:row.revision}}]})
  return { ...row.payload, revision: row.revision }
 }
 const maxUsd = Number(input.maxUsd), maxOutput = Number(input.maxOutput)
 insist(Number.isFinite(maxUsd) && maxUsd > 0 && maxUsd <= 1, 'invalid_run_budget')
 insist(Number.isInteger(maxOutput) && maxOutput >= 128 && maxOutput <= 4096, 'invalid_output_budget')
 const plain = (v: unknown) => { insist(typeof v === 'string' && v.trim().length > 0 && v.length <= 300 && !/[<>\x00-\x1f]/.test(v), 'provider_data_policy_required'); return v.trim() }
 const reader = await env.DB.prepare('SELECT provider,endpoint,model,workspace,updated_at AS readerRevision FROM chest_reader WHERE id=1').first<{provider:string;endpoint:string;model:string;workspace:string;readerRevision:string}>()
 insist(reader, 'reader_key_required', 409)
 const payload: AskPolicy = { enabled: input.enabled === true || input.enabled === 'true', maxUsd, maxOutput, providerRetention: plain(input.providerRetention), residency: plain(input.residency), provider: reader.provider, endpointHash: await digest(new TextEncoder().encode(reader.endpoint)), model: reader.model, workspace: reader.workspace, readerRevision: reader.readerRevision, consentAt: now(), by: s.operator.email }
 const row = previous ? next(previous, payload) : fresh(key, payload, key)
 await commit(env, s, [{ row, previous: previous ?? undefined }], { preconditions: [{sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_reader WHERE id=1 AND provider=? AND endpoint=? AND model=? AND workspace=? AND updated_at=?) THEN 1 ELSE 0 END',params:[reader.provider,reader.endpoint,reader.model,reader.workspace,reader.readerRevision]}], audits: [{ action: 'ask.policy', object: key, detail: { ...payload, revision: row.revision } }] })
 return { ...payload, revision: row.revision }
}
