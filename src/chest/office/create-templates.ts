import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { context, demand, isAdmin, start, type Who } from '../files/access'
import type { Space } from '../files/model'
import { place } from '../files/items'
import { commit, fresh, next } from '../files/repo'
import { insist, now, text, type Group, type Row } from '../model'
import { get, list } from '../store'
import { OfficeArchive } from './archive'
import { children, parseXml, related } from './xml'
import { builtins, builtinId, thumbnail } from './create-gallery'
import { extensions, extensionOf, kindOf, mediaTypes, type PublishedTemplate, type TemplateAudience } from './create-model'
import { effectiveSettings } from './create-settings'
import { digest } from '../blobs'
export async function templateAudience(env: Bindings, w: Who, audience: TemplateAudience): Promise<{ visible: boolean; fences: Row[] }> {
 if (audience.type === 'organisation') return { visible: true, fences: [] }
 if (audience.type === 'groups') return { visible: audience.groups.some(id => w.groups.some(g => g.id === id)), fences: w.groups }
 const space = await get<Space>(env, 'space', audience.space)
 return { visible: !space.payload.formerOwner && !!start(space.payload, w).role, fences: [space, ...w.groups] }
}
export const galleryTemplate = (row: Row<PublishedTemplate>, canUnpublish = false) => ({ id: row.id, name: row.payload.name, category: row.payload.category, thumbnail: row.payload.thumbnail, kind: row.payload.kind, extension: row.payload.extension, version: row.payload.version.id, audience: row.payload.audience, builtin: false, canUnpublish })
export async function listTemplates(env: Bindings, s: Session, w: Who, input: any = {}) {
 const { effectiveFormat } = await effectiveSettings(env, w), templates: any[] = []
 let canPublish = isAdmin(s)
 if (input.space || input.parent) { const p = await place(env, w, input.space, input.parent); canPublish ||= p.state.manager && p.space.payload.kind === 'team' }
 else if (!canPublish) canPublish = (await list<Space>(env, 'space')).some(space => space.payload.kind === 'team' && start(space.payload, w).manager)
 if (input.kind) insist(['document', 'spreadsheet', 'presentation'].includes(input.kind), 'invalid_new_kind')
 for (const template of builtins) if (!input.kind || input.kind === template.kind) templates.push({ id: builtinId(template.id), name: template.name, category: template.category, thumbnail: thumbnail(template.name, template.color), kind: template.kind, extension: extensions[effectiveFormat][template.kind], version: '1', builtin: true })
 for (const row of await list<PublishedTemplate>(env, 'office-template')) {
  if (row.payload.unpublishedAt || input.kind && row.payload.kind !== input.kind) continue
  const audience = await templateAudience(env, w, row.payload.audience)
  if (audience.visible) templates.push(galleryTemplate(row, isAdmin(s) || row.payload.audience.type === 'space' && audience.fences.some(space => space.kind === 'space' && start(space.payload as Space, w).manager)))
 }
 return { templates, format: effectiveFormat, canPublish }
}
// The published version has independent custody. Audience members receive a safe gallery description,
// never the source item ID, its grants, its prior versions, or a source download URL.
export async function templateBytes(env: Bindings, version: { checksum: string; size: number }) {
 insist(version.size <= 8_000_000, 'template_too_large', 413)
 const blob = await env.BLOBS.get(`sha256/${version.checksum}`); insist(blob, 'blob_missing', 503)
 const bytes = new Uint8Array(await blob.arrayBuffer())
 insist(bytes.length === version.size && await digest(bytes) === version.checksum, 'blob_integrity', 503)
 return bytes
}
export function validateTemplate(bytes: Uint8Array, extension: string) {
 const archive = new OfficeArchive(bytes), odf = extension.startsWith('od'), part = odf ? 'content.xml' : related(archive, '', 'officeDocument')
 insist(part && archive.has(part), 'invalid_template_format', 415)
 const document = parseXml(archive.get(part)), names: Record<string, string> = { docx: 'document', xlsx: 'workbook', pptx: 'presentation', odt: 'document-content', ods: 'document-content', odp: 'document-content' }
 insist(document.documentElement.localName === names[extension], 'invalid_template_format', 415)
 if (odf) {
  insist(document.documentElement.namespaceURI === 'urn:oasis:names:tc:opendocument:xmlns:office:1.0' && archive.has('mimetype') && new TextDecoder().decode(archive.get('mimetype')) === mediaTypes[extension as keyof typeof mediaTypes], 'invalid_template_format', 415)
  const body = children(document.documentElement, 'body')[0], expected = ({ odt: 'text', ods: 'spreadsheet', odp: 'presentation' } as Record<string, string>)[extension]
  insist(body && children(body, expected).length === 1, 'invalid_template_format', 415)
 } else insist(document.documentElement.namespaceURI === `http://schemas.openxmlformats.org/${({ docx: 'wordprocessingml', xlsx: 'spreadsheetml', pptx: 'presentationml' } as Record<string, string>)[extension]}/2006/main`, 'invalid_template_format', 415)
 return archive
}
async function publishingAuthority(env: Bindings, s: Session, w: Who, audience: TemplateAudience) {
 const fences: Row[] = []
 if (audience.type === 'space') {
  const space = await get<Space>(env, 'space', audience.space); fences.push(space, ...w.groups)
  insist(space.payload.kind === 'team' && (isAdmin(s) || start(space.payload, w).manager), 'template_publish_refused', 403)
 } else insist(isAdmin(s), 'service_settings_refused', 403)
 return fences
}
export async function publishTemplate(env: Bindings, s: Session, w: Who, input: any) {
 insist(typeof input.source === 'string', 'invalid_template_source')
 const a = input.audience; insist(a && ['organisation', 'groups', 'space'].includes(a.type), 'invalid_template_audience')
 let audience: TemplateAudience
 if (a.type === 'groups') { insist(Array.isArray(a.groups) && a.groups.length > 0 && a.groups.length <= 100 && a.groups.every((g: unknown) => typeof g === 'string') && new Set(a.groups).size === a.groups.length, 'invalid_template_audience'); audience = { type: 'groups', groups: a.groups } }
 else if (a.type === 'space') { insist(typeof a.space === 'string', 'invalid_template_audience'); audience = { type: 'space', space: a.space } }
 else audience = { type: 'organisation' }
 const fences = await publishingAuthority(env, s, w, audience)
 if (audience.type === 'groups') for (const key of audience.groups) fences.push(await get<Group>(env, 'group', key))
 const ctx = await context(env, w, input.source); demand(ctx, 'view'); demand(ctx, 'download')
 const item = ctx.chain.at(-1)!, version = item.payload.versions.find(v => v.id === item.payload.current), extension = extensionOf(item.payload.name)
 insist(item.payload.type === 'file' && version && extension, 'template_format_unsupported', 415)
 const name = text(input.name, 'template_name', 120), category = text(input.category, 'template_category', 80)
 const bytes = await templateBytes(env, version)
 try { validateTemplate(bytes, extension) } catch { insist(false, 'invalid_template_format', 415) }
 // Only inert raster thumbnails are accepted from callers. Built-in thumbnails are generated locally.
 insist(input.thumbnail === undefined || typeof input.thumbnail === 'string' && input.thumbnail.length <= 300_000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.thumbnail), 'invalid_template_thumbnail')
 const row = fresh<PublishedTemplate>('office-template', { name, category, thumbnail: input.thumbnail ?? thumbnail(name), audience, kind: kindOf(extension), extension, source: item.id, version: { ...version }, publishedBy: s.operator.email, publishedAt: now() })
 await commit(env, s, [{ row }], { fences: [...fences, ...ctx.fences], audits: [{ action: 'template.publish', object: row.id, detail: { name, source: item.id, sourceVersion: version.id, audience } }] })
 return galleryTemplate(row, true)
}
export async function unpublishTemplate(env: Bindings, s: Session, w: Who, key: string) {
 const previous = await get<PublishedTemplate>(env, 'office-template', key), fences = await publishingAuthority(env, s, w, previous.payload.audience)
 if (previous.payload.unpublishedAt) return { id: key, unpublishedAt: previous.payload.unpublishedAt }
 const at = now(), row = next(previous, { ...previous.payload, unpublishedAt: at, unpublishedBy: s.operator.email })
 await commit(env, s, [{ row, previous }], { fences, audits: [{ action: 'template.unpublish', object: key, detail: { name: row.payload.name, audience: row.payload.audience } }] })
 return { id: key, unpublishedAt: at }
}
