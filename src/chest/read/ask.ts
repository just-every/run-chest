import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, id } from '../model'
import { commit, maybe } from '../files/repo'
import type { CostRates } from '../administration/costs'
import { endpointHash } from './provider-authority'
import { askPolicy, saveAskPolicy } from './ask-policy'
import { readerState } from './settings'
import { askSources } from './ask-sources'
import { askProvider } from './ask-provider'
export async function askExecute(env: Bindings, s: Session, method: string, parts: string[], input: any) {
 if (parts[0] === 'ask' && parts[1] === 'policy') return method === 'GET' ? await policyView(env) : saveAskPolicy(env, s, input)
 if (!['items', 'documents'].includes(parts[0]) || !parts[1] || parts[2] !== 'ask') return undefined
 const key = parts[1], kind = parts[0] as 'items' | 'documents'
 if (method === 'GET') { const data = await askSources(env, s, key, false, kind); return { policy: await policyView(env), sources: data.sources.map(({ text, ...p }) => p), skipped: data.skipped } }
 if (method !== 'POST') return undefined
 insist(input.approve === true, 'explicit_send_approval_required')
 insist(!input.tools && !input.actions, 'ask_tools_forbidden', 403)
 const question = input.question
 insist(typeof question === 'string' && question.trim().length > 0 && question.length <= 2000, 'invalid_question')
 const fields = input.fields ?? []
 insist(Array.isArray(fields) && fields.length <= 12 && new Set(fields).size === fields.length && fields.every((f: unknown) => typeof f === 'string' && f.length > 0 && f.length <= 80), 'invalid_extraction_fields')
 const policy = await askPolicy(env); insist(policy?.payload.enabled, 'ask_disabled_by_owner', 409)
 insist(input.policyAt === policy.revision, 'ask_policy_changed_review_again', 409)
 const state = await readerState(env); insist('config' in state, 'ask_provider_unavailable', 409)
 insist(policy.payload.provider === state.config.provider && policy.payload.model === state.config.model && policy.payload.workspace === state.config.workspace && policy.payload.readerRevision === state.config.readerRevision && policy.payload.endpointHash === await endpointHash(state.config.endpoint), 'ask_provider_policy_review_required', 409)
 const rates = await maybe<CostRates>(env, 'admin-cost-rates', 'admin-cost-rates')
 insist(rates && rates.payload.aiProvider === state.config.provider && rates.payload.aiModel === state.config.model && !rates.payload.aiServiceTier && rates.payload.aiInputUsdPerMillion !== undefined && rates.payload.aiOutputUsdPerMillion !== undefined, 'matching_provider_quote_required', 409)
 const data = await askSources(env, s, key, input.includeHistory === true, kind)
 insist(data.sources.length, 'no_readable_evidence', 409)
 const budget = Number(input.budgetUsd); insist(Number.isFinite(budget) && budget > 0 && budget <= policy.payload.maxUsd, 'run_budget_exceeds_policy')
 // UTF-8 bytes bound text token input conservatively; the fixed allowance covers the request schema and instructions.
 const maxInput = new TextEncoder().encode(JSON.stringify([question, fields, data.sources])).length + 16384
 const reserve = maxInput / 1e6 * rates.payload.aiInputUsdPerMillion! + policy.payload.maxOutput / 1e6 * rates.payload.aiOutputUsdPerMillion! + (rates.payload.aiRequestUsd ?? 0)
 insist(reserve <= budget, 'run_budget_too_small', 409)
 const run = `ask:${id()}`, model = state.config.model, policyUsed = { ...policy.payload, provider: state.config.provider, model, tools: 'none', localRetention: 'Questions and answers are not stored', quote: rates.payload.quote, rateAt: rates.payload.updatedAt }
 const fences = [...data.fences, policy, rates]
 const providerFence = { sql: 'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_reader WHERE id=1 AND provider=? AND endpoint=? AND model=? AND workspace=? AND updated_at=? AND key_sealed=?) THEN 1 ELSE 0 END', params: [state.config.provider, state.config.endpoint, model, state.config.workspace, state.config.readerRevision ?? null, state.config.authority ?? null] }
 await commit(env, s, [], { fences, preconditions: [providerFence], audits: [{ action: 'ask.approved', object: key, detail: { run, versions: data.versions, budgetUsd: budget, reservedUsd: reserve, policy: policyUsed } }] })
 const accounting = { env, actor: s.operator.email, object: run }
 let result
 try { result = await askProvider({ ...state.config, accounting }, question, data.sources, fields, policy.payload.maxOutput) }
 catch { return { run, state: 'failed', answer: '', claims: [], fields: [], uncertainty: 'The provider failed or returned unverifiable evidence. No answer was accepted. This attempt may still be billed.', cost: await receipt(env, run), reservedUsd: reserve, policy: policyUsed } }
 const providerNow = await readerState(env)
 if (!('config' in providerNow) || providerNow.config.key !== state.config.key || providerNow.config.endpoint !== state.config.endpoint || providerNow.config.model !== model || providerNow.config.workspace !== state.config.workspace || providerNow.config.readerRevision !== state.config.readerRevision) return { run, state: 'policy_changed', answer: '', claims: [], fields: [], uncertainty: 'The provider configuration changed. The answer was withheld.', cost: await receipt(env, run), reservedUsd: reserve, policy: policyUsed }
 const current = await askSources(env, s, key, input.includeHistory === true, kind)
 const same = data.versions.every(v => current.versions.some(c => c.item === v.item && c.version === v.version && c.checksum === v.checksum))
 if (!same) return { run, state: 'access_changed', answer: '', claims: [], fields: [], uncertainty: 'Access or evidence changed during the request. The answer was withheld.', cost: await receipt(env, run), reservedUsd: reserve, policy: policyUsed }
 await commit(env, s, [], { fences, preconditions: [providerFence], audits: [{ action: 'ask.completed', object: key, detail: { run, citations: result.output.claims.reduce((n, c) => n + c.citations.length, 0), policy: policyUsed } }] })
 return { run, state: 'done', ...result.output, sources: data.sources.map(({ text, ...p }) => ({ ...p, href: `/api/chest/${p.kind}/${p.item}/bytes/${p.version}#page=${p.page}` })), skipped: data.skipped, usage: result.usage, cost: await receipt(env, run), reservedUsd: reserve, policy: policyUsed }
}
async function receipt(env: Bindings, run: string) {
 const row = await env.DB.prepare("SELECT detail FROM chest_audit WHERE action='provider.usage' AND object_id=? ORDER BY at DESC LIMIT 1").bind(run).first<{ detail: string }>()
 if (!row) return { usd: null, outcome: 'unknown', input: null, output: null }
 const r = JSON.parse(row.detail); return { usd: r.usd, outcome: r.outcome, status: r.status, input: r.input, output: r.output, provider: r.provider, model: r.model, quote: r.quote }
}

async function policyView(env: Bindings) { const row = await askPolicy(env); return row ? { ...row.payload, revision: row.revision } : null }
