import { OfficeArchive } from './archive'
import { insist } from '../model'
import { sheetsPreview, editCell, requestRecalculation } from './sheets'
import { slidesPreview } from './slides'
import { wordPreview, editWordParagraph } from './word'
import { relationships, descendants, fieldKey, parseXml, related, serializeXml, validateValue, type Document, type Element, type OfficePreview } from './xml'

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

// Tracked replacements stay in the original DOCX until an authorized contributor decides.
export async function officeSuggest(bytes: Uint8Array, changes: Record<string,string>, author: string, at: string) {
 const opened = open(bytes)
 if (!opened || opened.kind !== 'docx') throw new Error('Suggestions require a DOCX document')
 const {archive,part}=opened, preview=wordPreview(archive,part), documents=new Map<string,Document>()
 for(const path of [part,...relatedParts(archive,part)]){const doc=parseXml(archive.get(path));insist(!descendants(doc,'ins').length&&!descendants(doc,'del').length,'existing_tracked_changes_require_source_editor',409)}
 if(Object.values(changes).reduce((size,value)=>size+value.length,0)>4*1024*1024)throw new Error('Office suggestions exceed the 4 MB text limit')
 let serial=0
 for(const field of preview.fields) {
  if(!(field.key in changes)||changes[field.key]===field.value)continue
  validateValue(changes[field.key])
  const path=field.key.slice(0,field.key.lastIndexOf('#'))
  if(!documents.has(path))documents.set(path,parseXml(archive.get(path)))
  const doc=documents.get(path)!, paragraph=descendants(doc,'p').find(node=>fieldKey(path,node)===field.key)!
  const ns=paragraph.namespaceURI!, prefix=paragraph.prefix||'w'
  const tracked=(kind:string)=>{const node=doc.createElementNS(ns,`${prefix}:${kind}`);for(const [key,value] of Object.entries({id:String(++serial),author,date:at}))node.setAttributeNS(ns,`${prefix}:${key}`,value);return node}
  const removed=tracked('del'), inserted=tracked('ins')
  for(const child of Array.from(paragraph.childNodes))if(child.nodeType!==1||(child as Element).localName!=='pPr')removed.appendChild(child)
  for(const text of descendants(removed,'t')){const replacement=doc.createElementNS(ns,`${prefix}:delText`);replacement.textContent=text.textContent;replacement.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');text.parentNode!.replaceChild(replacement,text)}
  const replacement=doc.createElementNS(ns,`${prefix}:p`);editWordParagraph(replacement,changes[field.key]);while(replacement.firstChild)inserted.appendChild(replacement.firstChild);paragraph.appendChild(removed);paragraph.appendChild(inserted)
 }
 return archive.replace(new Map([...documents].map(([path,doc])=>[path,serializeXml(doc)])))
}
export async function officeDecide(bytes:Uint8Array, decision:'accept'|'reject') {
 const opened=open(bytes)
 if(!opened||opened.kind!=='docx')throw new Error('Suggestions require a DOCX document')
 const {archive,part}=opened, paths=[...new Set([part,...relatedParts(archive,part)])], replacements=new Map<string,Uint8Array>()
 for(const path of paths){const doc=parseXml(archive.get(path));if(!descendants(doc,'ins').length&&!descendants(doc,'del').length)continue;for(const kind of ['del','ins'])for(const node of descendants(doc,kind)){
  if((kind==='ins')===(decision==='accept')){for(const text of descendants(node,'delText')){const replacement=doc.createElementNS(text.namespaceURI,`${text.prefix||'w'}:t`);replacement.textContent=text.textContent;replacement.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');text.parentNode!.replaceChild(replacement,text)}while(node.firstChild)node.parentNode!.insertBefore(node.firstChild,node)}
  node.parentNode!.removeChild(node)
 }replacements.set(path,serializeXml(doc))}
 return archive.replace(replacements)
}
function relatedParts(archive:OfficeArchive,part:string){return relationships(archive,part).filter(r=>r.type==='header'||r.type==='footer').map(r=>r.target)}
