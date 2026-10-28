import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { owner } from '../access'
import { digest } from '../blobs'
import { insist, now, text, type Row, type Group } from '../model'
import { context, demand, whoFor, allowed, type Who } from './access'
import { commit, fresh, maybe } from './repo'
import { anchorOf, type Comment, type Reply } from './comments'
import { live } from './model'

type Source = { provider: string; file: string; id: string; authorId: string; authorName: string }
export type ImportedSource = Source & { fingerprint: string; by: string; at: string; anchorMissing?: boolean; quotedText?: string; mappingEvidence?: string }
const hash = (v: unknown) => digest(new TextEncoder().encode(JSON.stringify(v)))
function timestamp(v: unknown) {
 insist(typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v)), 'invalid_source_time')
 return new Date(v).toISOString()
}
function archiveOf(input: any) {
 let archive = input.archive
 if (typeof archive === 'string') { insist(archive.length <= 512_000, 'comment_import_too_large', 413); try { archive = JSON.parse(archive) } catch { insist(false, 'invalid_comment_archive') } }
 insist(JSON.stringify(archive ?? null).length <= 512_000, 'comment_import_too_large', 413)
 if (archive?.format === 'google-drive-comments-1') {
  insist(Array.isArray(archive.comments) && !archive.nextPageToken, 'complete_comment_export_required')
  archive = { format: 'chest-review-1', provider: 'Google Drive', file: archive.file, mappings: archive.mappings,
   threads: archive.comments.filter((c: any) => !c.deleted).map((c: any) => ({
    id: c.id, author: { id: `comment:${c.id}`, name: c.author?.displayName }, at: c.createdTime,
    message: c.content, resolved: c.resolved, resolvedAt: c.modifiedTime,
    anchor: archive.anchors?.[c.id], quotedText: c.quotedFileContent?.value,
    anchorMissing: !!c.anchor && !archive.anchors?.[c.id],
    ...(c.assigneeEmailAddress ? { assignee: `assignee:${c.id}` } : {}),
    mentions: (c.mentionedEmailAddresses ?? []).map((email: string) => `mention:${email}`),
    replies: (c.replies ?? []).filter((r: any) => !r.deleted).map((r: any) => ({ id: r.id,
     author: { id: `reply:${c.id}:${r.id}`, name: r.author?.displayName }, at: r.createdTime,
     message: r.content || (r.action === 'resolve' ? 'Resolved in source.' : r.action === 'reopen' ? 'Reopened in source.' : '') }))
   })) }
 }
 insist(archive?.format === 'chest-review-1' && ['Google Drive', 'Dropbox', 'Box'].includes(archive.provider), 'invalid_comment_archive')
 insist(Array.isArray(archive.threads) && archive.threads.length > 0 && archive.threads.length <= 100, 'invalid_comment_threads')
 insist(JSON.stringify(archive).length <= 512_000, 'comment_import_too_large', 413)
 return archive
}

// The receiving door accepts an explicit, owner-reviewed export. Provider extraction and delta
// reconciliation remain adapter duties; no imported identity, mention or task grants access.
export async function previewCommentImport(env: Bindings, s: Session, w: Who, key: string, input: any) {
 owner(s)
 const ctx = await context(env, w, key); demand(ctx, 'contribute')
 const item = ctx.chain.at(-1)!, archive = archiveOf(input), version = item.payload.versions.find(v => v.id === input.version)
 insist(item.payload.type === 'file' && version, 'version_not_found', 404)
 const provider = archive.provider as string, file = text(archive.file, 'source_file', 500)
 const mappings = archive.mappings ?? []
 insist(Array.isArray(mappings) && mappings.length <= 200, 'invalid_author_mappings')
 const mapped = new Map<string, string>(), evidence = new Map<string, string>(), fences = [...ctx.fences]
 for (const mapping of mappings) {
  const id = text(mapping.authorId, 'source_author', 200), email = text(mapping.email, 'mapped_person', 320).toLowerCase()
  evidence.set(id, text(mapping.evidence, 'mapping_evidence', 1000))
  insist(!mapped.has(id), 'duplicate_author_mapping')
  const person = await maybe(env, 'person', email)
  insist(person && person.payload.status !== 'inactive' && await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first(), 'author_mismatch', 409)
  mapped.set(id, email); fences.push(person)
 }
 const ids = new Set<string>(), recipients = new Set<string>(), importedAt = now(), rows: Row<Comment>[] = []
 const author = (value: any, id: string): { author: string; source: Source } => {
  const authorId = text(value?.id, 'source_author', 200), authorName = text(value?.name, 'source_author_name', 200)
  return { author: mapped.get(authorId) ?? `Former collaborator (${authorName})`, source: { provider, file, id, authorId, authorName } }
 }
 for (const t of archive.threads) {
  const sourceId = text(t.id, 'source_comment', 200); insist(!ids.has(sourceId), 'duplicate_source_comment'); ids.add(sourceId)
  const identity = author(t.author, sourceId), at = timestamp(t.at), message = text(t.message, 'comment', 4000)
  insist(typeof t.resolved === 'boolean', 'invalid_source_state')
  insist(Array.isArray(t.replies ?? []) && (t.replies ?? []).length <= 100, 'invalid_source_replies')
  const replyIds = new Set<string>()
  const replies: Reply[] = (t.replies ?? []).map((r: any) => {
   const id = text(r.id, 'source_reply', 200); insist(!replyIds.has(id), 'duplicate_source_reply'); replyIds.add(id)
   const person = author(r.author, id)
   return { id, author: person.author, message: text(r.message, 'reply', 4000), at: timestamp(r.at), imported: person.source }
  }).sort((a: Reply, b: Reply) => a.at.localeCompare(b.at))
  const anchor = t.anchor ? await anchorOf(env, ctx, version.id, { anchor: t.anchor }) : undefined
  const quotedText = t.quotedText ? text(t.quotedText, 'quoted_text', 4000) : undefined
  insist(!t.anchorMissing || anchor || quotedText, 'missing_anchor_quote')
  const mentions = t.mentions ?? []; insist(Array.isArray(mentions) && mentions.length <= 20 && mentions.every((id: any) => typeof id === 'string'), 'invalid_mentions')
  // Imported mentions are mapped, inert history. An unresolved assignment becomes work only for
  // someone who can currently open this exact version; otherwise the owner receives the task.
  const mappedMentions = [...new Set<string>(mentions.map((id: string) => mapped.get(id)).filter((email: string | undefined): email is string => !!email))]
  let assignee = t.assignee ? mapped.get(text(t.assignee, 'source_assignee', 200)) : undefined, assignmentGap: string | undefined
  const taskCustodians: string[] = []
  if (t.assignee && !t.resolved) {
   const target = assignee ? await context(env, await whoFor(env, assignee), key) : null
   if (!target || target.state.trash || !allowed(target, 'view') || !target.chain.at(-1)!.payload.versions.some(v => v.id === version.id)) {
    assignmentGap = `Source assignee ${String(t.assignee)} cannot open the destination version; task routed to the file owner or space managers without granting access.`
    const candidates: string[] = []
    if (ctx.space.payload.kind === 'personal') candidates.push(ctx.space.payload.owner)
    else for (const grant of ctx.space.payload.members.filter(g => g.role === 'manager' && live(g))) {
     const group = await maybe<Group>(env, 'group', grant.principal)
     if (group) { candidates.push(...group.payload.members); fences.push(group) } else candidates.push(grant.principal)
    }
    for (const email of new Set(candidates)) {
     if (!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first()) continue
     const custodian = await context(env, await whoFor(env, email), key)
     if (!custodian.state.trash && allowed(custodian, 'view') && custodian.chain.at(-1)!.payload.versions.some(v => v.id === version.id)) { taskCustodians.push(email); fences.push(...custodian.fences); recipients.add(email) }
    }
    insist(taskCustodians.length, 'source_task_custodian_unavailable', 409)
    assignee = undefined
   } else fences.push(...target.fences)
   if (assignee) recipients.add(assignee)
  }
  const payload = { item: key, version: version.id, author: identity.author, message, at, replies, mentions: mappedMentions,
   ...(assignee ? { assignee } : {}), ...(taskCustodians.length ? { taskCustodians } : {}), ...(anchor ? { anchor } : {}), ...(assignmentGap ? { assignmentGap } : {}),
   resolved: t.resolved ? { by: identity.author, at: timestamp(t.resolvedAt ?? t.at) } : null,
   imported: { ...identity.source, ...(evidence.has(identity.source.authorId) ? { mappingEvidence: evidence.get(identity.source.authorId) } : {}), anchorMissing: !anchor && !!quotedText, ...(quotedText ? { quotedText } : {}) } }
  const fingerprint = await hash(payload), id = `comment:import:${await hash([key, provider, file, sourceId])}`
  const existing = await maybe<Comment>(env, 'comment', id)
  // Replays never overwrite native replies, resolution, redacted identities or source provenance.
  if (existing) insist(existing.payload.imported?.fingerprint === fingerprint, 'source_comment_conflict', 409)
  rows.push(existing ?? fresh<Comment>('comment', { ...payload, imported: { ...payload.imported, fingerprint, by: s.operator.email, at: importedAt } }, id))
 }
 const fingerprint = await hash([key, version.id, item.revision, archive])
 return { fingerprint, version: version.id, rows, fences: [...new Map(fences.map(r => [r.id, r])).values()], recipients: [...new Set([...recipients, ...mapped.values()])], summary: rows.map(r => ({ id: r.id, ...r.payload })) }
}

export async function applyCommentImport(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const plan = await previewCommentImport(env, s, w, key, input)
 insist(input.confirm === true || input.confirm === 'true', 'confirm_comment_import')
 insist(input.fingerprint === plan.fingerprint, 'comment_import_changed', 409)
 const ops = []
 for (const row of plan.rows) if (!await maybe(env, 'comment', row.id)) ops.push({ row })
 if (ops.length) try { await commit(env, s, ops, { fences: plan.fences,
  preconditions: plan.recipients.map(email => ({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND status='active') THEN 1 ELSE 0 END", params: [email] })),
  audits: [{ action: 'comment.import', object: key, detail: { count: ops.length, version: plan.version, fingerprint: plan.fingerprint } }] })
 } catch (error) {
  // A competing, identical publication may have won the atomic batch.
  for (const row of plan.rows) {
   const winner = await maybe<Comment>(env, 'comment', row.id)
   if (!winner || winner.payload.imported?.fingerprint !== row.payload.imported?.fingerprint) throw error
  }
  return { imported: 0, threads: plan.summary }
 }
 return { imported: ops.length, threads: plan.summary }
}
