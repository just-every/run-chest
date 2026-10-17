import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { allowed, context, demand, type Ctx, type Entry, type Who } from '../files/access'
import type { Item } from '../files/model'
import { list } from '../store'
import { maybe } from '../files/repo'
import { ChestError, type Row } from '../model'
import { fileBrief, stateId, type DuplicateState, type LineageVersion, type Merge } from './duplicate-model'

export async function visibleContext(env: Bindings, w: Who, key: string): Promise<Ctx | null> {
 try { const ctx = await context(env, w, key); return !ctx.state.trash && allowed(ctx, 'view') ? ctx : null }
 catch (e) { if (e instanceof ChestError && (e.status === 403 || e.status === 404)) return null; throw e }
}
export function mergeBrief(s: Session, row: Row<Merge>, keep: Ctx, duplicate: Ctx) {
 const p = row.payload
 return { id: row.id, keep: fileBrief(keep.chain.at(-1)!), duplicate: fileBrief(duplicate.chain.at(-1)!), reason: p.reason, similarity: p.similarity,
  at: p.at, by: p.by, undone: p.undone, canUndo: !p.undone && s.operator.role === 'owner' && allowed(keep, 'manage') && allowed(duplicate, 'manage') }
}
// The caller must keep each version's sourceItem in its preview/download URL. A canonical URL does not confer
// access to a source's bytes, and the ordinary bytes endpoint continues to check that source's live ACL.
export async function mergeView(env: Bindings, s: Session, w: Who, item: Row<Item>) {
 const ctx = await context(env, w, item.id); demand(ctx, 'view')
 const fresh = ctx.chain.at(-1)!, p = (await maybe<DuplicateState>(env, 'duplicate_state', stateId(fresh.id)))?.payload
 const versions: LineageVersion[] = fresh.payload.versions.map(v => ({ ...v, sourceItem: fresh.id }))
 let mergedInto: { id: string; name: string; merge: string } | null = null
 if (p?.duplicateMerge) {
  const receipt = await maybe<Merge>(env, 'duplicate_merge', p.duplicateMerge.merge)
  const keep = receipt && !receipt.payload.undone && receipt.payload.duplicate === fresh.id && receipt.payload.keep === p.duplicateMerge.keep ? await visibleContext(env, w, p.duplicateMerge.keep) : null
  if (keep) mergedInto = { id: receipt!.payload.keep, name: keep.chain.at(-1)!.payload.name, merge: receipt!.id }
 }
 const merges: ReturnType<typeof mergeBrief>[] = []
 for (const key of p?.duplicateMerges ?? []) {
  const receipt = await maybe<Merge>(env, 'duplicate_merge', key)
  if (!receipt || receipt.payload.undone || receipt.payload.keep !== fresh.id) continue
  const duplicate = await visibleContext(env, w, receipt.payload.duplicate)
  if (!duplicate) continue
  const source = duplicate.chain.at(-1)!
  const membership = await maybe<DuplicateState>(env, 'duplicate_state', stateId(source.id))
  if (membership?.payload.duplicateMerge?.merge !== receipt.id) continue
  versions.push(...source.payload.versions.map(v => ({ ...v, sourceItem: source.id })))
  merges.push(mergeBrief(s, receipt, ctx, duplicate))
 }
 return { versions: versions.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)), mergedInto, merges }
}
// An alias disappears from ordinary listings only for a person who can also open its canonical file. A person
// with source-only rights retains the original entry and learns nothing about the canonical file's identity.
export async function hiddenMerged(env: Bindings, w: Who, entries: Entry[]): Promise<Set<string>> {
 const hidden = new Set<string>(), states=new Map((await list<DuplicateState>(env,'duplicate_state')).map(r=>[r.payload.item,r.payload]))
 for (const entry of entries) {
  if (entry.state.trash || !allowed(entry, 'view')) continue
  const p = states.get(entry.row.id)
  if (!p?.duplicateMerge) continue
  const receipt = await maybe<Merge>(env, 'duplicate_merge', p.duplicateMerge.merge)
  if (receipt && !receipt.payload.undone && receipt.payload.duplicate === entry.row.id && receipt.payload.keep === p.duplicateMerge.keep && await visibleContext(env, w, p.duplicateMerge.keep)) hidden.add(entry.row.id)
 }
 return hidden
}
