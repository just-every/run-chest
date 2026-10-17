import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, text, type Row } from '../model'
import { get, list } from '../store'
import { context, demand, who, whoFor, type Who } from '../files/access'
import { place } from '../files/items'
import type { Item, Space } from '../files/model'
import { start } from '../files/access'
import { commit, fresh, maybe, next, where } from '../files/repo'
import { agentExecute } from './agent'
import { liveActor, moveFile, spaceManager, undoMove, visibleMove, type FilingMove } from './shared'
export type { FilingMove } from './shared'
export type ArrivalRule = { space: string; name: string; source: string | null; destination: string | null; enabled: boolean; match: { type?: string; sender?: string; content?: string }; createdBy: string; createdAt: string; updatedAt: string }
const folder = (v: unknown): string | null => { insist(v === null || v === '' || typeof v === 'string', 'invalid_folder'); return v || null }
function matcher(input: any): ArrivalRule['match'] {
 insist(input && typeof input === 'object' && !Array.isArray(input), 'invalid_match')
 insist(Object.keys(input).every(k => ['type', 'sender', 'content'].includes(k)), 'invalid_match')
 const result: ArrivalRule['match'] = {}
 for (const key of ['type', 'sender', 'content'] as const) if (input[key]) result[key] = text(input[key], key, 300).toLowerCase()
 if (result.type && !result.type.includes('/') && !result.type.startsWith('.')) result.type = `.${result.type}`
 insist(Object.keys(result).length, 'match_required')
 return result
}
export function ruleMatches(rule: ArrivalRule, item: Item, sender?: string) {
 const v = item.versions.find(v => v.id === item.current)
 if (!v || item.type !== 'file' || item.trash || rule.space !== item.space || rule.source !== item.parent) return false
 const { type, content, sender: expected } = rule.match
 return (!type || (type.startsWith('.') ? item.name.toLowerCase().endsWith(type) : v.mediaType.toLowerCase() === type)) && (!expected || sender?.toLowerCase() === expected) && (!content || v.text.toLowerCase().includes(content))
}
async function saveRule(env: Bindings, s: Session, w: Who, input: any) {
 const space = await spaceManager(env, w, text(input.space, 'space'))
 const old = input.id ? await get<ArrivalRule>(env, 'filing_rule', text(input.id, 'id')) : null
 insist(!old || old.payload.space === space.id, 'filing_same_space_required')
 const source = folder(input.source ?? null), destination = folder(input.destination ?? null)
 insist(source !== destination, 'filing_same_folder')
 const sourceCtx = await place(env, w, space.id, source), destCtx = await place(env, w, space.id, destination)
 insist(sourceCtx.space.id === space.id && destCtx.space.id === space.id, 'filing_same_space_required')
 demand(sourceCtx, 'manage')
 insist(input.enabled === undefined || typeof input.enabled === 'boolean', 'invalid_enabled')
 const at = now(), payload: ArrivalRule = { space: space.id, source, destination, name: text(input.name, 'name'), enabled: input.enabled ?? true, match: matcher(input.match), createdBy: s.operator.email, createdAt: old?.payload.createdAt ?? at, updatedAt: at }
 const row = old ? next(old, payload) : fresh('filing_rule', payload)
 await commit(env, s, [{ row, ...(old ? { previous: old } : {}) }], { fences: [space, ...sourceCtx.fences, ...destCtx.fences], audits: [{ action: 'filing.rule.save', object: row.id, detail: { space: space.id, enabled: row.payload.enabled } }] })
 return row
}
// Each original arrival gets one durable outcome. Replays and Undo never start a second filing.
export async function runArrival(env: Bindings, s: Session, _w: Who, supplied: Row<Item>, sender?: string): Promise<{ item: Row<Item>; move: Row<FilingMove> | null }> {
 const item = await get<Item>(env, 'item', supplied.id)
 if (item.payload.type !== 'file' || !item.payload.current || item.payload.trash) return { item, move: null }
 const key = `filing-arrival:${item.id}:${item.payload.current}`, known = await maybe<FilingMove>(env, 'filing_move', key)
 if (known) return { item, move: known }
 const rules = (await where<ArrivalRule>(env, 'filing_rule', '$.space', item.payload.space)).filter(r => r.payload.enabled && ruleMatches(r.payload, item.payload, sender)).sort((a, b) => a.payload.createdAt.localeCompare(b.payload.createdAt) || a.id.localeCompare(b.id))
 const rule = rules[0]; if (!rule) return { item, move: null }
 const evidence = `Version ${item.payload.current}; ${Object.entries(rule.payload.match).map(([k, v]) => `${k}: ${v}`).join('; ')}`
 try {
  const actor = await liveActor(env, rule.payload.createdBy), w = await whoFor(env, rule.payload.createdBy), space = await spaceManager(env, w, item.payload.space)
  return await moveFile(env, s, w, item, rule.payload.destination, { by: rule.payload.createdBy, explanation: `Matched arrival rule “${rule.payload.name}”.`, evidence, rule: rule.id, ruleRevision: rule.revision }, key, { fences: [rule, space], statements: [actor] })
 } catch (error) {
  const conflict = String((error as Error)?.message).includes('CHECK constraint failed')
  if (!(error instanceof ChestError) && !conflict) throw error
  const replay = await maybe<FilingMove>(env, 'filing_move', key)
  if (replay) return { item: await get<Item>(env, 'item', item.id), move: replay }
  const current = await get<Item>(env, 'item', item.id), currentRule = await get<ArrivalRule>(env, 'filing_rule', rule.id)
  const reason = error instanceof ChestError ? error.code : 'filing_changed_during_execution'
  const blocked = fresh<FilingMove>('filing_move', { space: current.payload.space, item: item.id, version: item.payload.current, name: current.payload.name, source: item.payload.parent, destination: rule.payload.destination, destinationPath: '', explanation: `Arrival rule “${rule.payload.name}” stopped.`, evidence, by: rule.payload.createdBy, at: now(), status: 'blocked', reason, rule: rule.id, ruleRevision: rule.revision }, key)
  await commit(env, s, [{ row: blocked }], { fences: [current, currentRule], audits: [{ action: 'filing.blocked', object: item.id, detail: { rule: rule.id, reason } }] })
  return { item: current, move: blocked }
 }
}
export async function rulesExecute(env: Bindings, s: Session, method: string, parts: string[], input: any, url: URL): Promise<unknown> {
 if (parts[0] !== 'filing' || !['rules', 'moves', 'agent'].includes(parts[1])) return undefined
 const w = await who(env, s), [, head, key, action] = parts
 if (head === 'agent') return agentExecute(env, s, w, method, input, url)
 if (head === 'rules' && method === 'POST' && !key) return saveRule(env, s, w, input)
 if (head === 'rules' && method === 'GET' && !key) {
  const requested = url.searchParams.get('space')
  if (requested) { const space = await spaceManager(env, w, requested); return { rules: await where<ArrivalRule>(env, 'filing_rule', '$.space', space.id) } }
  const spaces = (await list<Space>(env, 'space')).filter(r => start(r.payload, w).manager), ids = new Set(spaces.map(r => r.id))
  return { rules: (await list<ArrivalRule>(env, 'filing_rule')).filter(r => ids.has(r.payload.space)), spaces }
 }
 if (head === 'moves' && method === 'GET' && !key) {
  const moves: Row<FilingMove>[] = []
  for (const row of await list<FilingMove>(env, 'filing_move')) if ((!url.searchParams.get('space') || row.payload.space === url.searchParams.get('space')) && await visibleMove(env, w, row)) moves.push(row)
  moves.sort((a, b) => b.payload.at.localeCompare(a.payload.at))
  const monday = new Date(); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  return { moves, filedThisWeek: moves.filter(r => r.payload.status !== 'blocked' && Date.parse(r.payload.at) >= monday.getTime()).length }
 }
 if (head === 'moves' && method === 'POST' && key && action === 'undo') return undoMove(env, s, w, key)
 insist(false, 'not_found', 404)
}
