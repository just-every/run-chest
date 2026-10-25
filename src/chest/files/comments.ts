import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, text } from '../model'
import { commit, fresh, where } from './repo'
import { allowed, context, demand, whoFor, type Who } from './access'
import { deliver, notice } from './notify'
import { personLine } from '../names'
// Comments on a file, bound to the exact version they were made on. Commenters and above may post; posting grants
// nothing to anyone.
export type Comment = { item: string; version: string | null; author: string; message: string; at: string; mentions?:string[]; assignee?:string }
export async function comment(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'comment')
 const version = input.version ?? item.payload.current; insist(version === null || item.payload.versions.some(v => v.id === version), 'version_not_found', 404)
 const mentions=typeof input.mentions==='string'?input.mentions.split(',').map((v:string)=>v.trim().toLowerCase()).filter(Boolean):input.mentions??[]
 insist(Array.isArray(mentions)&&mentions.length<=20&&mentions.every(v=>typeof v==='string'),'invalid_mentions')
 const assignee=typeof input.assignee==='string'?input.assignee.trim().toLowerCase():''
 const recipients=[...new Set<string>([...mentions,...assignee?[assignee]:[]])]
 const recipientContexts=[]
 for(const email of recipients){const active=await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first();insist(active,'comment_recipient_unavailable',403);const recipient=await context(env,await whoFor(env,email),key);insist(!recipient.state.trash&&allowed(recipient,'view'),'comment_recipient_unavailable',403);recipientContexts.push(recipient)}
 const row = fresh<Comment>('comment', { item: key, version, author: s.operator.email, message: text(input.message, 'comment', 4000), at: now(), mentions, ...(assignee?{assignee}:{}) })
 const owner = ctx.space.payload.kind === 'personal' ? ctx.space.payload.owner : item.payload.createdBy
 const active = await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(owner).first()
 const ownerContext = active ? await context(env, await whoFor(env, owner), key) : null
 const notes = ownerContext && !ownerContext.state.trash && allowed(ownerContext, 'view')
  ? [notice(owner, 'comment', key, s.operator.email, `${personLine(s.operator.displayName, s.operator.email)} commented on "${item.payload.name}":\n\n${row.payload.message}`)] : []
 for(const email of recipients)if(email!==s.operator.email&&!notes.some(n=>n.payload.to===email))notes.push(notice(email,assignee===email?'comment.assignment':'comment.mention',key,s.operator.email,`${personLine(s.operator.displayName,s.operator.email)} ${assignee===email?'assigned a comment to':'mentioned'} you on "${item.payload.name}":\n\n${row.payload.message}`))
 await commit(env, s, [{ row }, ...notes.map(row => ({ row }))], { fences: [...ctx.fences, ...(ownerContext?.fences ?? []),...recipientContexts.flatMap(c=>c.fences)], audits: [{ action: 'comment.add', object: key, detail: { comment: row.id, version } }] })
 const delivered = await deliver(env, s, notes)
 return { ...row, email: delivered[0]?.payload.email ?? null }
}
export const comments = (env: Bindings, key: string) => where<Comment>(env, 'comment', '$.item', key)
