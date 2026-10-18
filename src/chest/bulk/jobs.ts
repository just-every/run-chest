import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, type Row } from '../model'
import { get, list } from '../store'
import { allowed, context, demand, everything, who } from '../files/access'
import { copy, move } from '../files/items'
import { share } from '../files/shares'
import { restore, trash } from '../files/trash'
import type { Item } from '../files/model'
import { commit, fresh, maybe, next, spaceItems, where, withCommitAttachment } from '../files/repo'
import { actions, receiptKey, type BulkEntry, type BulkJob, type BulkReceipt } from './model'

export async function ownedJob(env: Bindings, s: Session, key: string) {
 const job = await get<BulkJob>(env, 'bulk-job', key)
 insist(job.payload.by === s.operator.email, 'not_found', 404); return job
}
export function selection(input: any): string[] {
 let values = input.items ?? input.selection
 if (typeof values === 'string') { try { values = JSON.parse(values) } catch { values = values.split(/[\s,]+/) } }
 insist(Array.isArray(values) && values.length > 0 && values.length <= 1000 && values.every(v => typeof v === 'string' && v.length > 0 && v.length <= 240), 'invalid_selection')
 return [...new Set(values)] as string[]
}
export async function createJob(env: Bindings, s: Session, input: any) {
 insist(actions.includes(input.action), 'invalid_bulk_action')
 const selected = selection(input), w = await who(env, s), entries: BulkEntry[] = [], picked = new Set(selected), included = new Set<string>(), catalog = input.action === 'download' ? await everything(env,w) : null
 // Overlapping folder selections execute once. Unknown IDs still get a generic per-item refusal.
 for (const [root, key] of selected.entries()) {
  const item = await maybe<Item>(env, 'item', key)
  let overlapped = false
  if (item) { let parent = item.payload.parent; const seen = new Set<string>(); while (parent && !seen.has(parent)) { if (picked.has(parent)) { overlapped = true; break }; seen.add(parent); parent = (await maybe<Item>(env, 'item', parent))?.payload.parent ?? null } }
  if (overlapped || included.has(key)) continue
  const add = async (row: Row<Item> | null, key: string) => {
   if (included.has(key)) return; included.add(key)
   const entry: BulkEntry = { item: key, root }
   if (catalog && row) { const e=catalog.get(key); if(e && !e.state.trash && allowed(e,'view')) entry.version=row.payload.current??undefined }
   entries.push(entry); insist(entries.length <= 10000, 'bulk_selection_too_large', 413)
  }
  await add(item, key)
  if (input.action === 'download' && item?.payload.type === 'folder') {
   const all = await spaceItems(env, item.payload.space), queue = [key]
   while (queue.length) { const parent = queue.shift()!; for (const row of all.filter(r => r.payload.parent === parent && !r.payload.trash)) { if (included.has(row.id)) continue; await add(row, row.id); if (row.payload.type === 'folder') queue.push(row.id) } }
  }
 }
 const args: Record<string, unknown> = {}
 for (const key of ['space','parent','principal','role','expires','message','zone','confirmExternal','confirmNonMember']) if (input[key] !== undefined && input[key] !== '') args[key] = input[key]
 // The destination is explicit: a missing parent means the selected space's root.
 if (input.action === 'move' || input.action === 'copy') { insist(typeof input.space === 'string' && input.space, 'invalid_space'); args.parent = input.parent || null }
 const job = fresh<BulkJob>('bulk-job', { by: s.operator.email, at: now(), action: input.action, input: args, entries, state: 'active' })
 await commit(env, s, [{ row: job }], { audits: [{ action: 'bulk.create', object: job.id, detail: { action: input.action, items: entries.length } }] })
 return viewJob(env, s, job)
}
export const receipts = (env: Bindings, key: string) => where<BulkReceipt>(env, 'bulk-result', '$.job', key)
export async function viewJob(env: Bindings, s: Session, job: Row<BulkJob>, catalog?: Awaited<ReturnType<typeof everything>>) {
 const results = new Map((await receipts(env, job.id)).map(r => [r.payload.index, r.payload])); catalog ??= await everything(env,await who(env,s))
 const entries = job.payload.entries.map((e,index) => {
  const current=catalog!.get(e.item), named=current&&allowed(current,'view')&&(!current.state.trash||current.state.manager||current.row.payload.trash?.by===s.operator.email)
  const name=named?current.row.payload.name:null, receipt=results.get(index)
  return { index, item: e.item, name, outcome: receipt?.outcome ?? 'pending', reason: receipt?.reason, result: name ? receipt?.result : undefined }
 })
 const done = entries.filter(e => e.outcome !== 'pending').length, refused = entries.filter(e => e.outcome === 'refused').length
 const state = job.payload.state === 'cancelled' ? 'cancelled' : done < entries.length ? 'pending' : refused ? 'partial' : job.payload.action === 'download' ? 'ready' : 'complete'
 return { id: job.id, action: job.payload.action, at: job.payload.at, state, total: entries.length, done, refused, succeeded: done - refused, entries }
}
export async function runJob(env: Bindings, s: Session, key: string, input: any = {}) {
 const job = await ownedJob(env, s, key); insist(job.payload.state === 'active', 'bulk_cancelled', 409)
 const count = input.limit === undefined || input.limit === '' ? 20 : Number(input.limit); insist(Number.isInteger(count) && count >= 1 && count <= 50, 'invalid_bulk_limit')
 let processed = 0
 for (const [index, entry] of job.payload.entries.entries()) {
  if (await maybe(env, 'bulk-result', receiptKey(key, index))) continue
  if (processed++ >= count) break
  const receipt = fresh<BulkReceipt>('bulk-result', { job: key, index, item: entry.item, at: now(), outcome: job.payload.action === 'download' ? 'ready' : 'succeeded' }, receiptKey(key, index))
  const audit = { action: 'bulk.item', object: entry.item, detail: { job: key, index, action: job.payload.action, outcome: receipt.payload.outcome } }
  // A fresh identity/group calculation per item and SQL snapshots prevent a stale queued grant from acting.
  const w = await who(env, s)
  try {
   if (job.payload.action === 'download') {
    const c = await context(env, w, entry.item); demand(c, 'download')
    const row = c.chain.at(-1)!; if (row.payload.type === 'file') insist(entry.version && row.payload.versions.some(v => v.id === entry.version), 'version_not_found', 404)
    await commit(env, s, [{ row: receipt }], { fences: [job, ...c.fences], audits: [audit] })
   } else {
    const fences: Row[] = [job]
    // Existing tree operations commit all descendants together. A bulk move/copy must not use a permitted
    // parent as a route around a restricted child's source role or no-download policy.
    if (job.payload.action === 'move' || job.payload.action === 'copy') {
     const root = await context(env,w,entry.item); demand(root,'manage'); fences.push(...root.fences)
     if(root.chain.at(-1)!.payload.type==='folder') {
      const rows=await spaceItems(env,root.space.id), queue=[entry.item], seen=new Set(queue)
      while(queue.length) {
       const parent=queue.shift()!
       for(const row of rows.filter(r=>r.payload.parent===parent&&!r.payload.trash)) {
        insist(!seen.has(row.id),'tree_corrupt',503);seen.add(row.id)
        const child=await context(env,w,row.id);demand(child,'manage');if(job.payload.action==='copy')demand(child,'download');fences.push(...child.fences)
        if(row.payload.type==='folder')queue.push(row.id)
       }
      }
     }
    }
    const scoped = withCommitAttachment(s, { fences, audits: [audit], ops: ops => {
     receipt.payload.result = job.payload.action === 'copy' ? ops.find(o => o.row.kind === 'item' && !o.previous)?.row.id : entry.item
     return [{ row: receipt }]
    } })
    const action = { move, copy, share, trash, restore }[job.payload.action]
    await action(env, scoped, w, entry.item, job.payload.input)
   }
  } catch (error) {
   // Read after *every* error. Commit may have succeeded even if its response or subsequent mail failed.
   if (await maybe(env, 'bulk-result', receipt.id)) continue
   if (!(error instanceof ChestError)) break // uncertain: leave pending; the next explicit run reads receipts first
   const refused = { ...receipt, payload: { ...receipt.payload, outcome: 'refused' as const, reason: error.code } }
   try { await commit(env, s, [{ row: refused }], { fences: [job], audits: [{ ...audit, detail: { ...audit.detail, outcome: 'refused', reason: error.code } }] }) }
   catch { if (!await maybe(env, 'bulk-result', receipt.id)) break }
  }
 }
 return viewJob(env, s, await ownedJob(env, s, key))
}
export async function cancelJob(env: Bindings, s: Session, key: string) {
 const job = await ownedJob(env, s, key)
 if (job.payload.state === 'active') await commit(env, s, [{ row: next(job, { ...job.payload, state: 'cancelled' }), previous: job }], { audits: [{ action: 'bulk.cancel', object: key }] })
 return viewJob(env, s, await ownedJob(env, s, key))
}
export async function jobs(env: Bindings, s: Session) {
 const catalog=await everything(env,await who(env,s)), rows=(await list<BulkJob>(env,'bulk-job')).filter(j=>j.payload.by===s.operator.email).sort((a,b)=>b.payload.at.localeCompare(a.payload.at)).slice(0,50)
 return Promise.all(rows.map(j=>viewJob(env,s,j,catalog)))
}
