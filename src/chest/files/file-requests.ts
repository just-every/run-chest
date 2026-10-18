import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { ChestError, insist, now, type Row } from '../model'
import { operatorMail } from '../../mail.server.mjs'
import { commit, fresh, next, where } from './repo'
import { context, demand, isAdmin, stillSharing, type Who } from './access'
import { randomToken, tokenHash, tokenShape } from './capability'
import { admit } from './items'
import { linkDate } from './public-links'
import { name } from './model'
import { sharePolicy } from './sharing-policy'
import { externalReason } from './sharing-policy'
import { creatorLinkPolicy } from './link-policy'
import { policy, requestSize, optional, inspectRequestContent, validateFile, type RequestPolicy as FileRequest, type Visitor } from './request-model'
import { ownerSubmissions, publishSubmission } from './request-submissions'
// File requests (SHARE-002): someone who may share a folder asks anyone, with no account, to upload into it. The
// uploader sees only the request's title and message, never the folder's contents or name; each file lands as a new
// item in that folder, attributed to the submitter, and the person who asked gets a notice and an email.
export const requestPrefix = 'chest_req_'
function typesOf(value: unknown) {
 const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : []
 const types = [...new Set(list.map(t => String(t).trim().toLowerCase().replace(/^\./, '')).filter(Boolean))]
 insist(types.length <= 20 && types.every(t => /^[a-z0-9]{1,10}$/.test(t)), 'invalid_types'); return types
}
export async function createFileRequest(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), folder = ctx.chain.at(-1)!; demand(ctx, 'share'); insist(folder.payload.type === 'folder', 'not_a_folder')
 const sharing=await sharePolicy(env,w,ctx,[],input,'request')
 const secret = randomToken(requestPrefix), row = fresh<FileRequest>('file-request', { folder: key, title: optional(input.title, 'title', 200) || `Files for ${folder.payload.name}`, message: optional(input.message, 'message', 2000), types: typesOf(input.types), maxBytes: requestSize(input.maxMegabytes), ...policy(input), deadline: linkDate(input.deadline, input.zone), tokenHash: await tokenHash(secret), createdBy: s.operator.email, at: now(), uploads: 0 })
 insist(row.payload.verification!=='email'||!!(operatorMail(env)&&env.MAIL_FROM),'mail_not_configured',503)
 await commit(env, s, [{ row }], { fences: [...ctx.fences,...sharing.fences], audits: [{ action: 'file-request.create', object: key, detail: { request: row.id, types: row.payload.types, maxBytes: row.payload.maxBytes, deadline: row.payload.deadline } }] })
 return { request: describeRequest(row), url: `${env.AUTH_ORIGIN}/r/${secret}`, email: operatorMail(env) && env.MAIL_FROM ? 'available' : 'not_available' }
}
export async function closeFileRequest(env: Bindings, s: Session, w: Who, id: string) {
 const request = await get<FileRequest>(env, 'file-request', id)
 if (request.payload.createdBy !== s.operator.email && !isAdmin(s)) { const ctx = await context(env, w, request.payload.folder); demand({ ...ctx, state: { ...ctx.state, trash: null } }, 'share') }
 if (request.payload.closedAt) return { request: describeRequest(request) }
 const row = next(request, { ...request.payload, closedAt: now(), closedBy: s.operator.email })
 await commit(env, s, [{ row, previous: request }], { audits: [{ action: 'file-request.close', object: request.payload.folder, detail: { request: id } }] })
 return { request: describeRequest(row) }
}
export const requestOpen = (r: FileRequest, at = Date.now()) => !r.closedAt && (!r.deadline || Date.parse(r.deadline) > at)
export const describeRequest = (row: Row<FileRequest>) => ({ id: row.id, folder: row.payload.folder, title: row.payload.title, message: row.payload.message, types: row.payload.types, maxBytes: row.payload.maxBytes, deadline: row.payload.deadline, uploads: row.payload.uploads, createdBy: row.payload.createdBy, at: row.payload.at, closedAt: row.payload.closedAt ?? null, open: requestOpen(row.payload), checklist:row.payload.checklist??[], verification:row.payload.verification??'none', allowReplacement:!!row.payload.allowReplacement, late:row.payload.late??'reject', duplicates:row.payload.duplicates??'keep' })
export const requestsOn = async (env: Bindings, key: string) => Promise.all((await where<FileRequest>(env, 'file-request', '$.folder', key)).map(async row=>({...describeRequest(row),submissions:await ownerSubmissions(env,row.id)})))
// The public door: an open request whose current custodian may still share the folder.
export async function resolveRequest(env: Bindings, secret: string) {
 if (!tokenShape(requestPrefix).test(secret)) return null
 const [request] = await where<FileRequest>(env, 'file-request', '$.tokenHash', await tokenHash(secret)); if (!request) return null
 if (request.payload.closedAt || (!requestOpen(request.payload) && request.payload.late !== 'quarantine')) return { request, ctx: null }
 const ctx = await stillSharing(env, request.payload.custodian ?? request.payload.createdBy, request.payload.folder)
 const sharing=ctx?await creatorLinkPolicy(env,request.payload.custodian??request.payload.createdBy,ctx.space.id):null
 return { request, ctx: ctx && sharing && !externalReason(sharing.rules,'request') && sharing.rules.allowNonMembers && ctx.chain.at(-1)!.payload.type === 'folder' ? {...ctx,fences:[...ctx.fences,...sharing.fences]} : null }
}
export type Submission = { filing?: Record<string,unknown>; name: string; email: string; checklist?:string; replace?:string; files: { filename: string; bytes: Uint8Array }[] }
export async function submit(env: Bindings, secret: string, input: Submission, visitor: Row<Visitor>) {
 const resolved=await resolveRequest(env,secret);if(!resolved?.ctx)throw new ChestError(resolved?'request_closed':'request_not_found',404)
 const {request,ctx}=resolved
 insist(request.payload.verification!=='email'||!!visitor.payload.email,'email_verification_required',403)
 insist(input.files.length>=1&&input.files.length<=10,'files_required')
 const files=[]
 for(const f of input.files) {
  const filename=name(f.filename,'filename');validateFile(request.payload,filename,f.bytes.length)
  const reasons=inspectRequestContent(filename,f.bytes),version=await admit(env,f.bytes,filename,`${visitor.payload.email||input.email||'anonymous'} via file request`,'upload')
  files.push({version,reasons})
 }
 return publishSubmission(env,request,ctx,visitor,input,files)
}
