import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text, type Row } from '../model'
import { get, list } from '../store'
import { context, demand, who, type Who } from '../files/access'
import { place } from '../files/items'
import type { Item } from '../files/model'
import { commit, fresh, maybe, next, spaceItems } from '../files/repo'
import { managed, readerState, readerView, saveReader } from '../read/settings'
import type { Extraction } from '../read/jobs'
import { classify, type Classification } from './provider'
import { moveFile } from './shared'
export type FilingSuggestion = Classification & { item: string; name: string; space: string; version: string; itemRevision: string; destinationRevision: string | null; by: string; at: string; state: 'pending'|'applied'|'declined'; model: string; destinationPath: string }
const unavailable = { available: false, message: 'Not available yet on RER Managed hosting.' }
async function preview(env: Bindings, s: Session, w: Who, input: any) {
 if (managed(env)) return unavailable
 const state = await readerState(env)
 if (!('config' in state)) return { available: false, message: 'missing' in state ? state.missing : state.unavailable }
 const ctx = await context(env, w, text(input.item, 'item')); demand(ctx, 'manage')
 const item = ctx.chain.at(-1)!, v = item.payload.versions.find(v => v.id === item.payload.current)
 insist(item.payload.type === 'file' && v, 'not_a_file')
 const folders: { id: string; path: string; revision: string; fences: Row[] }[] = []
 for (const folder of await spaceItems(env, item.payload.space)) {
  if (folder.payload.type !== 'folder' || folder.payload.trash || folder.id === item.payload.parent || (input.destination && folder.id !== input.destination)) continue
  try {
   const dest = await place(env, w, item.payload.space, folder.id)
   folders.push({ id: folder.id, path: [dest.space.payload.name, ...dest.chain.map(r => r.payload.name)].join(' / '), revision: folder.revision, fences: dest.fences })
  } catch (e) { if (!(e instanceof Error && 'code' in e)) throw e }
  if (folders.length >= 80) break
 }
 insist(folders.length, 'filing_no_destinations')
 const extracted = await maybe<Extraction>(env, 'extract', `extract:${v.checksum}`)
 const source = [v.text, extracted?.payload.text ?? ''].filter(Boolean).join('\n').slice(0, 24_000)
 // The provider sees only files and folder paths that this live actor may read; no tools accompany the request.
 await commit(env, s, [], { fences: [...ctx.fences, ...folders.flatMap(f => f.fences), ...extracted ? [extracted] : []], audits: [{ action: 'filing.agent.read', object: item.id, detail: { version: v.id, model: state.config.model } }] })
 const answer = await classify(state.config, { name: item.payload.name, text: source, version: v.id, destinations: folders.map(({ id, path }) => ({ id, path })) })
 const live = await context(env, await who(env, s), item.id); demand(live, 'manage')
 insist(live.chain.at(-1)!.revision === item.revision, 'filing_stale', 409)
 const destination = folders.find(f => f.id === answer.destination)
 const row = fresh<FilingSuggestion>('filing_suggestion', { ...answer, item: item.id, name: item.payload.name, space: item.payload.space, version: v.id, itemRevision: item.revision, destinationRevision: destination?.revision ?? null, destinationPath: destination?.path ?? '', by: s.operator.email, at: now(), state: 'pending', model: state.config.model })
 await commit(env, s, [{ row }], { fences: [...ctx.fences, ...destination?.fences ?? []], audits: [{ action: 'filing.agent.suggest', object: item.id, detail: { suggestion: row.id, version: v.id } }] })
 return { available: true, suggestion: row }
}
async function apply(env: Bindings, s: Session, w: Who, input: any) {
 const suggestion = await get<FilingSuggestion>(env, 'filing_suggestion', text(input.suggestion, 'suggestion'))
 const ctx = await context(env, w, suggestion.payload.item); demand(ctx, 'manage')
 insist(suggestion.payload.state === 'pending', 'filing_suggestion_closed', 409)
 if (input.action === 'decline') {
  const row = next(suggestion, { ...suggestion.payload, state: 'declined' as const })
  await commit(env, s, [{ row, previous: suggestion }], { fences: ctx.fences, audits: [{ action: 'filing.agent.decline', object: suggestion.payload.item }] })
  return { suggestion: row }
 }
 const item = ctx.chain.at(-1)!
 insist(item.revision === suggestion.payload.itemRevision && item.payload.current === suggestion.payload.version, 'filing_stale', 409)
 insist(suggestion.payload.destination, 'filing_uncertain_requires_destination', 409)
 const destination = await get<Item>(env, 'item', suggestion.payload.destination)
 insist(destination.revision === suggestion.payload.destinationRevision, 'filing_destination_stale', 409)
 const updated = next(suggestion, { ...suggestion.payload, state: 'applied' as const })
 return moveFile(env, s, w, item, destination.id, { by: s.operator.email, explanation: suggestion.payload.explanation, evidence: `Version ${suggestion.payload.version}: “${suggestion.payload.quote}”; confidence ${suggestion.payload.confidence}; ${suggestion.payload.uncertainty}` }, `filing-agent:${suggestion.id}`, { ops: [{ row: updated, previous: suggestion }] })
}
export async function agentExecute(env: Bindings, s: Session, w: Who, method: string, input: any, url: URL): Promise<unknown> {
 if (method === 'GET') {
  if (managed(env)) return unavailable
  const suggestions: Row<FilingSuggestion>[] = []
  for (const row of await list<FilingSuggestion>(env, 'filing_suggestion')) {
   if (url.searchParams.get('space') && row.payload.space !== url.searchParams.get('space')) continue
   try { const ctx = await context(env, w, row.payload.item); demand(ctx, 'manage'); suggestions.push(row) } catch {}
  }
  return { available: true, reader: await readerView(env), suggestions }
 }
 if (method === 'POST') {
  if (managed(env)) return unavailable
  if (input.action === 'configure') return saveReader(env, s, input)
  if (input.action === 'apply' || input.action === 'decline') return apply(env, s, w, input)
  if (input.action === 'preview' || input.action === 'run') return preview(env, s, w, input)
 }
 insist(false, 'not_found', 404)
}
