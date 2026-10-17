import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text } from '../model'
import { commit, fresh, where } from './repo'
import { context, demand, type Who } from './access'
// Comments on a file, bound to the exact version they were made on. Commenters and above may post; posting grants
// nothing to anyone.
export type Comment = { item: string; version: string | null; author: string; message: string; at: string }
export async function comment(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'comment')
 const version = input.version ?? item.payload.current; insist(version === null || item.payload.versions.some(v => v.id === version), 'version_not_found', 404)
 const row = fresh<Comment>('comment', { item: key, version, author: s.operator.email, message: text(input.message, 'comment', 4000), at: now() })
 await commit(env, s, [{ row }], { fences: ctx.fences, audits: [{ action: 'comment.add', object: key, detail: { comment: row.id, version } }] })
 return row
}
export const comments = (env: Bindings, key: string) => where<Comment>(env, 'comment', '$.item', key)
