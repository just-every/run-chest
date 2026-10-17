import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text } from '../model'
import { commit, fresh, where } from './repo'
import { allowed, context, demand, whoFor, type Who } from './access'
import { deliver, notice } from './notify'
// Comments on a file, bound to the exact version they were made on. Commenters and above may post; posting grants
// nothing to anyone.
export type Comment = { item: string; version: string | null; author: string; message: string; at: string }
export async function comment(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'comment')
 const version = input.version ?? item.payload.current; insist(version === null || item.payload.versions.some(v => v.id === version), 'version_not_found', 404)
 const row = fresh<Comment>('comment', { item: key, version, author: s.operator.email, message: text(input.message, 'comment', 4000), at: now() })
 const owner = ctx.space.payload.kind === 'personal' ? ctx.space.payload.owner : item.payload.createdBy
 const active = await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(owner).first()
 const ownerContext = active ? await context(env, await whoFor(env, owner), key) : null
 const notes = ownerContext && !ownerContext.state.trash && allowed(ownerContext, 'view')
  ? [notice(owner, 'comment', key, s.operator.email, `${s.operator.displayName} (${s.operator.email}) commented on "${item.payload.name}":\n\n${row.payload.message}`)] : []
 await commit(env, s, [{ row }, ...notes.map(row => ({ row }))], { fences: [...ctx.fences, ...(ownerContext?.fences ?? [])], audits: [{ action: 'comment.add', object: key, detail: { comment: row.id, version } }] })
 const delivered = await deliver(env, s, notes)
 return { ...row, email: delivered[0]?.payload.email ?? null }
}
export const comments = (env: Bindings, key: string) => where<Comment>(env, 'comment', '$.item', key)
