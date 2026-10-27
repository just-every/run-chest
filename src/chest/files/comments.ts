import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, text, type Row } from '../model'
import { assertContent } from '../content-security/scan'
import { commit, fresh, maybe, next, where } from './repo'
import { allowed, context, demand, whoFor, type Ctx, type Who } from './access'
import { deliver, notice } from './notify'
import { personLine } from '../names'
import { digest } from '../blobs'

export type PdfAnchor = { kind: 'pdf'; page: number; region: [number, number, number, number] }
export type Reply = { id: string; author: string; message: string; at: string; mentions?: string[] }
export type Comment = {
 item: string; version: string | null; author: string; message: string; at: string
 mentions?: string[]; assignee?: string; anchor?: PdfAnchor; replies?: Reply[]
 carriedFrom?: { thread: string; version: string; anchor: PdfAnchor; by: string; at: string }
 resolved?: { by: string; at: string } | null
}
const activePerson = (env: Bindings, email: string) => env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first()
const activeGuard = (email: string) => ({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND status='active') THEN 1 ELSE 0 END", params: [email] })
function mentionsOf(input: any): string[] {
 const values = typeof input.mentions === 'string' ? input.mentions.split(',') : input.mentions ?? []
 insist(Array.isArray(values) && values.length <= 20 && values.every(v => typeof v === 'string'), 'invalid_mentions')
 return [...new Set<string>(values.map((v: string) => v.trim().toLowerCase()).filter(Boolean))]
}
async function recipient(env: Bindings, key: string, email: string, required: boolean) {
 const active = await activePerson(env, email)
 const ctx = active ? await context(env, await whoFor(env, email), key) : null
 const available = ctx && !ctx.state.trash && allowed(ctx, 'view')
 if (required) insist(available, 'comment_recipient_unavailable', 403)
 return available ? ctx : null
}
// Coordinates are fractions of the visible page, measured from its top left. The page is checked against
// the retained PDF itself, so replacing the file cannot retarget an annotation.
async function anchorOf(env: Bindings, ctx: Ctx, version: string | null, input: any): Promise<PdfAnchor | undefined> {
 const raw = input.anchor ?? (input.anchorType === 'pdf' ? { kind: 'pdf', page: Number(input.page), region: [input.left, input.top, input.right, input.bottom].map(v => v === '' || v === undefined ? NaN : Number(v) / 100) } : undefined)
 if (raw === undefined) return undefined
 insist(raw && raw.kind === 'pdf' && Number.isSafeInteger(raw.page) && raw.page > 0, 'invalid_annotation_page')
 const region = raw.region
 insist(Array.isArray(region) && region.length === 4 && region.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) && region[0] < region[2] && region[1] < region[3], 'invalid_annotation_region')
 const v = ctx.chain.at(-1)!.payload.versions.find(v => v.id === version)
 insist(v?.mediaType === 'application/pdf', 'annotation_requires_pdf')
 await assertContent(env, v.checksum)
 const blob = await env.BLOBS.get(`sha256/${v.checksum}`); insist(blob, 'blob_missing', 503)
 const { PDFDocument } = await import('pdf-lib')
 let pdf
 try { pdf = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false }) } catch { throw new ChestError('annotation_pdf_unreadable', 422) }
 insist(raw.page <= pdf.getPageCount(), 'annotation_page_not_found')
 return { kind: 'pdf', page: raw.page, region: [...region] as PdfAnchor['region'] }
}
function versionOf(ctx: Ctx, input: any) {
 const item = ctx.chain.at(-1)!.payload, version = input.version === undefined ? item.current : input.version
 if (item.type === 'folder') { insist(version === null, 'folder_comment_has_no_version'); return null }
 insist(typeof version === 'string' && item.versions.some(v => v.id === version), 'version_not_found', 404)
 return version
}
async function publish(env: Bindings, s: Session, ctx: Ctx, row: Row<Comment>, previous: Row<Comment> | undefined, action: string, emails: Map<string, { ctx: Ctx; type: string }>, message: string) {
 const notes = [...emails].filter(([email]) => email !== s.operator.email).map(([email, info]) => notice(email, info.type, row.payload.item, s.operator.email, message))
 await commit(env, s, [{ row, ...(previous ? { previous } : {}) }, ...notes.map(row => ({ row }))], {
  fences: [...ctx.fences, ...[...emails.values()].flatMap(r => r.ctx.fences)],
  preconditions: [...emails.keys()].map(activeGuard),
  audits: [{ action, object: row.payload.item, detail: { comment: row.id, version: row.payload.version, ...(row.payload.anchor ? { anchor: row.payload.anchor } : {}) } }],
 })
 const delivered = await deliver(env, s, notes)
 return { ...row, email: delivered[0]?.payload.email ?? null }
}
export async function comment(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'comment')
 const version = versionOf(ctx, input), mentions = mentionsOf(input)
 const assignee = typeof input.assignee === 'string' ? input.assignee.trim().toLowerCase() : ''
 const recipients = new Map<string, { ctx: Ctx; type: string }>()
 for (const email of new Set([...mentions, ...(assignee ? [assignee] : [])])) recipients.set(email, { ctx: (await recipient(env, key, email, true))!, type: assignee === email ? 'comment.assignment' : 'comment.mention' })
 const owner = ctx.space.payload.kind === 'personal' ? ctx.space.payload.owner : item.payload.createdBy
 if (!recipients.has(owner)) { const ownerCtx = await recipient(env, key, owner, false); if (ownerCtx) recipients.set(owner, { ctx: ownerCtx, type: 'comment' }) }
 const anchor = await anchorOf(env, ctx, version, input)
 const row = fresh<Comment>('comment', { item: key, version, author: s.operator.email, message: text(input.message, 'comment', 4000), at: now(), mentions, ...(assignee ? { assignee } : {}), ...(anchor ? { anchor } : {}) })
 const label = personLine(s.operator.displayName, s.operator.email)
 // Keep recipient-specific wording while every recipient is checked before publication.
 const notes = [...recipients].filter(([email]) => email !== s.operator.email).map(([email, info]) => notice(email, info.type, key, s.operator.email, `${label} ${info.type === 'comment.assignment' ? 'assigned a comment to you' : info.type === 'comment.mention' ? 'mentioned you' : 'commented'} on "${item.payload.name}":\n\n${row.payload.message}`))
 await commit(env, s, [{ row }, ...notes.map(row => ({ row }))], {
  fences: [...ctx.fences, ...[...recipients.values()].flatMap(r => r.ctx.fences)], preconditions: [...recipients.keys()].map(activeGuard),
  audits: [{ action: 'comment.add', object: key, detail: { comment: row.id, version, ...(anchor ? { anchor } : {}) } }],
 })
 const delivered = await deliver(env, s, notes)
 return { ...row, email: delivered[0]?.payload.email ?? null }
}
async function thread(env: Bindings, w: Who, key: string, id: string) {
 const ctx = await context(env, w, key); demand(ctx, 'comment')
 const row = await maybe<Comment>(env, 'comment', id); insist(row?.payload.item === key, 'comment_not_found', 404)
 versionOf(ctx, { version: row.payload.version })
 return { ctx, row }
}
async function participants(env: Bindings, key: string, row: Row<Comment>, explicit: string[] = []) {
 const people = new Map<string, { ctx: Ctx; type: string }>()
 for (const email of new Set([row.payload.author, ...(row.payload.mentions ?? []), ...(row.payload.assignee ? [row.payload.assignee] : []), ...(row.payload.replies?.map(r => r.author) ?? []), ...explicit])) {
  const ctx = await recipient(env, key, email, explicit.includes(email))
  if (ctx) people.set(email, { ctx, type: explicit.includes(email) ? 'comment.mention' : 'comment.reply' })
 }
 return people
}
export async function replyComment(env: Bindings, s: Session, w: Who, key: string, id: string, input: any) {
 const { ctx, row } = await thread(env, w, key, id)
 insist(!row.payload.resolved, 'comment_resolved', 409)
 insist(input.version === undefined || input.version === row.payload.version, 'comment_version_mismatch', 409)
 insist(input.anchor === undefined && input.anchorType === undefined, 'comment_anchor_immutable')
 const mentions = mentionsOf(input), recipients = await participants(env, key, row, mentions)
 const reply: Reply = { id: crypto.randomUUID(), author: s.operator.email, message: text(input.message, 'reply', 4000), at: now(), mentions }
 const updated = next(row, { ...row.payload, replies: [...(row.payload.replies ?? []), reply] })
 return publish(env, s, ctx, updated, row, 'comment.reply', recipients, `${personLine(s.operator.displayName, s.operator.email)} replied on "${ctx.chain.at(-1)!.payload.name}":\n\n${reply.message}`)
}
export async function resolveComment(env: Bindings, s: Session, w: Who, key: string, id: string, input: any) {
 const { ctx, row } = await thread(env, w, key, id)
 insist(input.decision === 'resolve' || input.decision === 'reopen', 'invalid_comment_decision')
 const resolved = input.decision === 'resolve'; insist(Boolean(row.payload.resolved) !== resolved, 'comment_state_unchanged', 409)
 const updated = next(row, { ...row.payload, resolved: resolved ? { by: s.operator.email, at: now() } : null })
 return publish(env, s, ctx, updated, row, resolved ? 'comment.resolve' : 'comment.reopen', await participants(env, key, row), `${personLine(s.operator.displayName, s.operator.email)} ${resolved ? 'resolved' : 'reopened'} a comment on "${ctx.chain.at(-1)!.payload.name}".`)
}
export const comments = (env: Bindings, key: string) => where<Comment>(env, 'comment', '$.item', key)

// Navigation includes only unresolved annotations on this item's retained PDF originals.
export function pdfThreads(rows: { id: string; version: string | null; anchor?: PdfAnchor; resolved?: Comment['resolved']; at: string }[], versions: { id: string; mediaType: string }[]) {
 return rows.filter(c => !c.resolved && c.anchor?.kind === 'pdf' && versions.some(v => v.id === c.version && v.mediaType === 'application/pdf'))
  .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).map(c => ({ id: c.id, version: c.version, anchor: c.anchor! }))
}
export function pdfNavigation(threads: ReturnType<typeof pdfThreads>, selected: string | null) {
 const index = selected ? threads.findIndex(c => c.id === selected) : 0
 insist(!selected || index >= 0, 'comment_not_found', 404)
 return { threads, selected: threads[index]?.id ?? null, position: threads.length ? index + 1 : 0,
  previous: threads.length > 1 ? threads[(index + threads.length - 1) % threads.length].id : null,
  next: threads.length > 1 ? threads[(index + 1) % threads.length].id : null }
}
export async function unresolvedComments(env: Bindings, w: Who, key: string, selected: string | null) {
 const ctx = await context(env, w, key); demand(ctx, 'view')
 return pdfNavigation(pdfThreads((await comments(env, key)).map(c => ({ id: c.id, ...c.payload })), ctx.chain.at(-1)!.payload.versions), selected)
}
export async function carryComment(env: Bindings, s: Session, w: Who, key: string, id: string, input: any) {
 const { ctx, row: source } = await thread(env, w, key, id), item = ctx.chain.at(-1)!
 insist(source.payload.anchor?.kind === 'pdf' && source.payload.version, 'annotation_requires_pdf')
 insist(typeof input.key === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(input.key), 'caller_key_required')
 insist(typeof input.version === 'string' && input.version !== source.payload.version, 'annotation_destination_required')
 const version = versionOf(ctx, input), anchor = await anchorOf(env, ctx, version, input)
 insist(anchor, 'annotation_destination_required')
 // Never silently transplant an old region. The caller chooses a version and region and binds
 // that choice to the current pointer they saw, even when selecting an earlier retained version.
 const fingerprint = await digest(new TextEncoder().encode(JSON.stringify([key, id, version, anchor, input.expectedCurrent])))
 const receipt = `comment:carry:${await digest(new TextEncoder().encode(JSON.stringify([s.operator.email, input.key])))}`
 const recipients = await participants(env, key, source, [...new Set([...(source.payload.mentions ?? []), ...(source.payload.assignee ? [source.payload.assignee] : [])])])
 const replay = (winner: Row<Comment>) => {
  insist((winner.payload as Comment & { carryFingerprint?: string }).carryFingerprint === fingerprint, 'caller_key_conflict', 409)
  return winner
 }
 const existing = await maybe<Comment>(env, 'comment', receipt); if (existing) return replay(existing)
 insist(input.expectedCurrent === item.payload.current, 'annotation_target_changed', 409)
 const at = now(), row = fresh<Comment & { carryFingerprint: string }>('comment', {
  item: key, version, anchor, author: s.operator.email, message: source.payload.message, at,
  mentions: source.payload.mentions ?? [], ...(source.payload.assignee ? { assignee: source.payload.assignee } : {}),
  carriedFrom: { thread: source.id, version: source.payload.version, anchor: source.payload.anchor, by: s.operator.email, at }, carryFingerprint: fingerprint,
 }, receipt)
 const message = `${personLine(s.operator.displayName, s.operator.email)} carried a PDF thread forward on "${item.payload.name}":\n\n${row.payload.message}`
 const notes = [...recipients].filter(([email]) => email !== s.operator.email).map(([email]) => notice(email, 'comment.carry', key, s.operator.email, message))
 try {
  await commit(env, s, [{ row }, ...notes.map(row => ({ row }))], {
   fences: [...ctx.fences, source, ...[...recipients.values()].flatMap(r => r.ctx.fences)], preconditions: [...recipients.keys()].map(activeGuard),
   audits: [{ action: 'comment.carry', object: key, detail: { comment: row.id, version, anchor, sourceThread: source.id, sourceVersion: source.payload.version, sourceAnchor: source.payload.anchor } }],
  })
 } catch (error) {
  const winner = await maybe<Comment>(env, 'comment', receipt); if (winner) return replay(winner)
  throw error
 }
 await deliver(env, s, notes)
 return row
}
