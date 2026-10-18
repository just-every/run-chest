import type { FileVersion } from '../files/model'
export type NewKind = 'document' | 'spreadsheet' | 'presentation'
export type NewFormat = 'office' | 'odf'
export type Extension = 'docx' | 'xlsx' | 'pptx' | 'odt' | 'ods' | 'odp'
export type TemplateAudience = { type: 'organisation' } | { type: 'groups'; groups: string[] } | { type: 'space'; space: string }
export type PublishedTemplate = {
 name: string; category: string; thumbnail: string; audience: TemplateAudience; kind: NewKind; extension: Extension
 source: string; version: FileVersion; publishedBy: string; publishedAt: string; unpublishedAt?: string; unpublishedBy?: string
}
export type NewSettings = { format: NewFormat; groups: { group: string; format: NewFormat }[] }
export type CreationReceipt = { actor: string; fingerprint: string; item: string }
export const extensions: Record<NewFormat, Record<NewKind, Extension>> = {
 office: { document: 'docx', spreadsheet: 'xlsx', presentation: 'pptx' },
 odf: { document: 'odt', spreadsheet: 'ods', presentation: 'odp' },
}
export const mediaTypes: Record<Extension, string> = {
 docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
}
export const kindOf = (extension: Extension): NewKind => extension === 'docx' || extension === 'odt' ? 'document' : extension === 'xlsx' || extension === 'ods' ? 'spreadsheet' : 'presentation'
export const extensionOf = (filename: string): Extension | null => {
 const extension = filename.split('.').at(-1)?.toLowerCase()
 return extension && Object.hasOwn(mediaTypes, extension) ? extension as Extension : null
}
