import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { digest } from '../blobs'
import { context, demand, type Who } from '../files/access'
import { admit, createItem, folderOf, place, siblings } from '../files/items'
import { name, type Item } from '../files/model'
import { fresh, maybe } from '../files/repo'
import { insist, type Row } from '../model'
import { storage } from '../quota/storage'
import { get } from '../store'
import { builtinId, builtinText, builtins } from './create-gallery'
import { extensions, mediaTypes, type CreationReceipt, type Extension, type NewKind, type PublishedTemplate } from './create-model'
import { createOdf } from './create-odf'
import { createOffice } from './create-office'
import { effectiveSettings } from './create-settings'
import { templateAudience, templateBytes } from './create-templates'
import { officePreview } from './codec'

// Public mutations enter through the normal item admission and commit path: quota, live session,
// inherited access, arrival rules, change feed and audit use the same doors as an ordinary upload.
export async function createFile(env: Bindings, s: Session, w: Who, input: any) {
 insist(['document', 'spreadsheet', 'presentation'].includes(input.kind), 'invalid_new_kind')
 insist(typeof input.key === 'string' && input.key.length > 0 && input.key.length <= 200 && !/[\x00-\x1f]/.test(input.key), 'caller_key_required')
 insist(input.template === undefined || typeof input.template === 'string', 'invalid_template')
 if (input.name !== undefined) name(input.name)
 const kind = input.kind as NewKind, destination = await place(env, w, input.space, input.parent), parent = folderOf(destination)
 const fingerprint = await digest(new TextEncoder().encode(JSON.stringify({ space: destination.space.id, parent, kind, name: input.name ?? null, template: input.template ?? null })))
 const key = `office:create:${await digest(new TextEncoder().encode(JSON.stringify([s.operator.email, input.key])))}`
 const replay = async (receipt: Row<CreationReceipt>) => {
  insist(receipt.payload.actor === s.operator.email && receipt.payload.fingerprint === fingerprint, 'caller_key_conflict', 409)
  const ctx = await context(env, w, receipt.payload.item); demand(ctx, 'view')
  return ctx.chain.at(-1)!
 }
 const existing = await maybe<CreationReceipt>(env, 'office-create', key); if (existing) return replay(existing)
 const { row: settings, effectiveFormat } = await effectiveSettings(env, w), fences: Row[] = [...destination.fences, ...(settings ? [settings] : [])]
 let extension: Extension = extensions[effectiveFormat][kind], bytes: Uint8Array, template: { id: string; name: string; version: string; sourceVersion?: string } | undefined, text = ''
 if (input.template && !input.template.startsWith('builtin:')) {
  const row = await get<PublishedTemplate>(env, 'office-template', input.template), audience = await templateAudience(env, w, row.payload.audience)
  insist(!row.payload.unpublishedAt && audience.visible, 'template_not_found', 404)
  insist(row.payload.kind === kind, 'template_kind_mismatch')
  fences.push(row, ...audience.fences); extension = row.payload.extension; bytes = await templateBytes(env, row.payload.version)
  template = { id: row.id, name: row.payload.name, version: row.payload.version.id, sourceVersion: row.payload.version.id }
  text = row.payload.version.text
 } else {
  const builtin = input.template ? builtins.find(t => builtinId(t.id) === input.template) : undefined
  insist(!input.template || builtin, 'template_not_found', 404); insist(!builtin || builtin.kind === kind, 'template_kind_mismatch')
  bytes = effectiveFormat === 'office' ? createOffice(extension, builtin) : createOdf(extension, builtin)
  if (builtin) template = { id: builtinId(builtin.id), name: builtin.name, version: '1' }
  text = builtinText(builtin)
 }
 let filename: string
 const rows = await siblings(env, destination.space.id, parent)
 if (input.name !== undefined) filename = name(input.name).toLowerCase().endsWith(`.${extension}`) ? name(input.name) : name(`${name(input.name)}.${extension}`)
 else {
  const base = `Untitled ${kind}`; filename = `${base}.${extension}`
  for (let suffix = 2; rows.some(r => r.payload.name.toLowerCase() === filename.toLowerCase()); suffix++) filename = `${base} (${suffix}).${extension}`
 }
 const limit = destination.space.payload.storageLimitBytes
 if (limit !== null && limit !== undefined) insist((await storage(env, destination.space.id)).usedBytes <= limit, 'storage_limit_exceeded', 413)
 if (extension === 'docx' || extension === 'xlsx' || extension === 'pptx') text = (await officePreview(bytes))?.text ?? text
 const version = await admit(env, bytes, filename, s.operator.email, 'created', {}, { mediaType: mediaTypes[extension], text, parser: 'chest:new-file:1', ...(template ? { template } : {}) })
 try {
  return await createItem(env, s, w, { space: destination.space.id, parent, name: filename, type: 'file' }, 'created', undefined, {
   version, fences,
   ops: (row: Row<Item>) => [{ row: fresh<CreationReceipt>('office-create', { actor: s.operator.email, fingerprint, item: row.id }, key) }],
  })
 } catch (error) {
  // A second request can win the same caller key while this one admits its bytes. The receipt and
  // item commit together; resolve that exact winner, never create an alternate file or retry admission.
  const winner = await maybe<CreationReceipt>(env, 'office-create', key)
  if (winner) return replay(winner)
  throw error
 }
}
