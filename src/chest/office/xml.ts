import { DOMParser, XMLSerializer, type Document, type Element, type Node } from '@xmldom/xmldom'
import type { OfficeArchive } from './archive'

export type { Document, Element, Node }
export type OfficeField = { key: string; label: string; value: string; multiline?: boolean }
export type OfficePreview = { kind: 'docx' | 'xlsx' | 'pptx'; html: string; fields: OfficeField[]; text: string }
export const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
export const elements = (node: Node): Element[] => Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1)
export const children = (node: Node, name: string) => elements(node).filter(child => child.localName === name)
export const first = (node: Node, name: string) => children(node, name)[0]
export function descendants(node: Node, name: string): Element[] {
  const found: Element[] = [], pending = [...elements(node)].reverse()
  while (pending.length) {
    const child = pending.pop()!
    if (child.localName === name) found.push(child)
    pending.push(...elements(child).reverse())
  }
  return found
}
export const attr = (node: Element | undefined, name: string): string => {
  if (!node) return ''
  for (const attribute of Array.from(node.attributes)) if (attribute.localName === name) return attribute.value
  return ''
}
export function parseXml(bytes: Uint8Array): Document & { documentElement: Element } {
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Office XML part exceeds the 8 MB limit')
  let source: string
  try {
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0x3c && bytes[1] === 0 ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 0x3c ? 'utf-16be' : 'utf-8'
    source = new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch { throw new Error('Invalid Office XML encoding') }
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(source)) throw new Error('Office XML document types and entities are forbidden')
  if ((source.match(/</g)?.length ?? 0) > 200000) throw new Error('Office XML exceeds the markup limit')
  let invalid = false
  let document: Document
  try { document = new DOMParser({ onError: () => { invalid = true } }).parseFromString(source, 'application/xml') } catch { throw new Error('Malformed Office XML') }
  if (invalid || !document.documentElement) throw new Error('Malformed Office XML')
  const pending: { node: Node; depth: number }[] = [{ node: document, depth: 0 }]
  let count = 0
  while (pending.length) {
    const { node, depth } = pending.pop()!
    if (++count > 200000 || depth > 128) throw new Error('Office XML exceeds the structure limit')
    for (const child of Array.from(node.childNodes)) pending.push({ node: child, depth: depth + 1 })
  }
  return document as Document & { documentElement: Element }
}
export function serializeXml(document: Document): Uint8Array {
  // A formerly UTF-16 part is now UTF-8, including its declaration.
  const xml = new XMLSerializer().serializeToString(document).replace(/^(\s*<\?xml\b[^?]*encoding\s*=\s*)["'][^"']+["']/i, '$1"UTF-8"')
  return new TextEncoder().encode(xml)
}
const childIndices = new WeakMap<Node, WeakMap<Node, number>>()
export function fieldKey(part: string, element: Element): string {
  const indices: number[] = []
  let node: Node = element
  while (node.parentNode) {
    let siblings = childIndices.get(node.parentNode)
    if (!siblings) {
      siblings = new WeakMap(elements(node.parentNode).map((child, index) => [child, index]))
      childIndices.set(node.parentNode, siblings)
    }
    const index = siblings.get(node)
    if (index === undefined) throw new Error('Office field is outside its XML document')
    indices.push(index)
    node = node.parentNode
  }
  return `${part}#${indices.reverse().join('/')}`
}
export function validateValue(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 100000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/u.test(value) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new Error('Office edit contains invalid or oversized text')
}
export type Relationship = { id: string; type: string; target: string }
export function resolvePart(part: string, target: string): string {
  if (/[\\\x00-\x20?#]/.test(target) || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) throw new Error('Unsafe Office relationship target')
  let decoded: string
  try { decoded = decodeURIComponent(target) } catch { throw new Error('Malformed Office relationship target') }
  if (/[\\\x00-\x1f?#]/.test(decoded)) throw new Error('Unsafe Office relationship target')
  const result: string[] = target.startsWith('/') ? [] : part.split('/').slice(0, -1)
  for (const piece of decoded.split('/')) {
    if (piece === '..') { if (!result.length) throw new Error('Office relationship leaves its archive'); result.pop() }
    else if (piece && piece !== '.') result.push(piece)
  }
  return result.join('/')
}
export function relationships(archive: OfficeArchive, part: string): Relationship[] {
  const pieces = part.split('/'), file = pieces.pop()!
  const path = [...pieces, '_rels', `${file}.rels`].join('/')
  if (!archive.has(path)) return []
  const document = parseXml(archive.get(path))
  const seen = new Set<string>()
  return children(document.documentElement, 'Relationship').filter(node => attr(node, 'TargetMode').toLowerCase() !== 'external').map(node => {
    const id = attr(node, 'Id')
    if (!id || seen.has(id)) throw new Error('Duplicate Office relationship identifier')
    seen.add(id)
    return { id, type: attr(node, 'Type').split('/').pop()!, target: resolvePart(part, attr(node, 'Target')) }
  })
}
export function related(archive: OfficeArchive, part: string, type: string) {
  return relationships(archive, part).find(item => item.type === type)?.target
}
export class OutputBudget {
  private count = 0
  add(html: string): string {
    this.count += html.length
    if (this.count > 12 * 1024 * 1024) throw new Error('Office preview exceeds the 12 MB rendering limit')
    return html
  }
}
