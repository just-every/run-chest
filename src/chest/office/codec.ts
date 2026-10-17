import { OfficeArchive } from './archive'
import { sheetsPreview, editCell, requestRecalculation } from './sheets'
import { slidesPreview } from './slides'
import { wordPreview, editWordParagraph } from './word'
import { descendants, fieldKey, parseXml, related, serializeXml, validateValue, type Document, type Element, type OfficePreview } from './xml'

export type { OfficePreview, OfficeField } from './xml'

function open(bytes: Uint8Array): { archive: OfficeArchive; kind: OfficePreview['kind']; part: string } | null {
  if (bytes.length < 4 || bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4) return null
  const archive = new OfficeArchive(bytes)
  const main = related(archive, '', 'officeDocument')
  if (!main) return null
  const root = parseXml(archive.get(main)).documentElement
  if (root.localName === 'document' && /\/wordprocessingml\//.test(root.namespaceURI ?? '')) return { archive, kind: 'docx', part: main }
  if (root.localName === 'workbook' && /\/spreadsheetml\//.test(root.namespaceURI ?? '')) return { archive, kind: 'xlsx', part: main }
  if (root.localName === 'presentation' && /\/presentationml\//.test(root.namespaceURI ?? '')) return { archive, kind: 'pptx', part: main }
  return null
}

export async function officePreview(bytes: Uint8Array): Promise<OfficePreview | null> {
  const opened = open(bytes)
  if (!opened) return null
  const { archive, kind, part } = opened
  const preview = kind === 'docx' ? wordPreview(archive, part) : kind === 'xlsx' ? sheetsPreview(archive, part) : slidesPreview(archive, part)
  if (preview.html.length > 12 * 1024 * 1024 || preview.fields.length > 50000 || preview.text.length > 4 * 1024 * 1024) throw new Error('Office preview exceeds the rendering limit')
  return preview
}

export async function officeEdit(bytes: Uint8Array, changes: Record<string, string>): Promise<Uint8Array> {
  const opened = open(bytes)
  if (!opened) throw new Error('This file is not an editable Office document')
  const { archive, kind, part } = opened
  if (kind === 'pptx') throw new Error('PowerPoint editing is unsupported')
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Office edits must be a field-value object')
  const entries = Object.entries(changes)
  if (entries.length > 10000) throw new Error('Office edit exceeds the 10,000-field limit')
  let textSize = 0
  for (const [, value] of entries) { validateValue(value); textSize += value.length }
  if (textSize > 4 * 1024 * 1024) throw new Error('Office edits exceed the 4 MB text limit')
  const preview = kind === 'docx' ? wordPreview(archive, part) : sheetsPreview(archive, part)
  const allowed = new Map(preview.fields.map(field => [field.key, field]))
  const documents = new Map<string, Document>(), targets: { node: Element; value: string }[] = []
  const nodes = new Map<string, Element>()
  for (const [key, value] of entries) {
    const field = allowed.get(key)
    if (!field) throw new Error('Unknown or read-only Office edit field')
    if (field.value === value) continue
    const path = key.slice(0, key.lastIndexOf('#'))
    if (!documents.has(path)) {
      const document = parseXml(archive.get(path))
      documents.set(path, document)
      for (const node of descendants(document, kind === 'docx' ? 'p' : 'c')) nodes.set(fieldKey(path, node), node)
    }
    const node = nodes.get(key)
    if (!node) throw new Error('Office edit field no longer exists')
    targets.push({ node, value })
  }
  // Resolve every stable XML path before mutations can shift sibling indices.
  for (const target of targets) {
    if (kind === 'docx') editWordParagraph(target.node, target.value)
    else editCell(target.node, target.value)
  }
  if (kind === 'xlsx' && targets.length) {
    const document = parseXml(archive.get(part))
    requestRecalculation(document)
    documents.set(part, document)
  }
  return archive.replace(new Map([...documents].map(([path, document]) => [path, serializeXml(document)])))
}
