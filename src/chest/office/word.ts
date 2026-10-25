import type { OfficeArchive } from './archive'
import { imageRenderer } from './images'
import { attr, children, elements, escape, fieldKey, first, OutputBudget, parseXml, relationships, type Element, type OfficeField, type OfficePreview } from './xml'

function paragraphTokens(paragraph: Element): Element[] {
  const tokens: Element[] = []
  const visit = (node: Element) => {
    if (['del', 'moveFrom', 'instrText', 'pPr', 'rPr', 'drawing', 'pict'].includes(node.localName ?? '')) return
    if (['t', 'tab', 'br', 'cr'].includes(node.localName ?? '')) tokens.push(node)
    else for (const child of elements(node)) visit(child)
  }
  for (const child of elements(paragraph)) visit(child)
  return tokens
}
function paragraphValue(paragraph: Element) {
  return paragraphTokens(paragraph).map(node => node.localName === 't' ? node.textContent ?? '' : node.localName === 'tab' ? '\t' : '\n').join('')
}

function runStyle(run: Element): string {
  const properties = first(run, 'rPr')
  if (!properties) return ''
  const enabled = (name: string) => { const node = first(properties, name); return !!node && !['0', 'false', 'off', 'none'].includes(attr(node, 'val')) }
  const styles: string[] = []
  if (enabled('b')) styles.push('font-weight:bold')
  if (enabled('i')) styles.push('font-style:italic')
  if (enabled('u')) styles.push('text-decoration:underline')
  if (enabled('strike')) styles.push('text-decoration:line-through')
  const color = attr(first(properties, 'color'), 'val')
  if (/^[\da-f]{6}$/i.test(color)) styles.push(`color:#${color}`)
  const size = Number(attr(first(properties, 'sz'), 'val'))
  if (size >= 8 && size <= 192) styles.push(`font-size:${size / 2}pt`)
  return styles.join(';')
}

export function wordPreview(archive: OfficeArchive, part: string): OfficePreview {
  const fields: OfficeField[] = [], text: string[] = [], budget = new OutputBudget()
  let paragraph = 0
  const renderPart = (path: string): string => {
    const document = parseXml(archive.get(path)), images = imageRenderer(archive, path)
    const inline = (node: Element): string => {
      switch (node.localName) {
        case 'del': return `<del title="${escape(attr(node,'author'))}">${elements(node).map(inline).join('')}</del>`
        case 'ins': return `<ins title="${escape(attr(node,'author'))}">${elements(node).map(inline).join('')}</ins>`
        case 'delText': return budget.add(escape(node.textContent??''))
        case 'moveFrom': case 'instrText': case 'pPr': case 'rPr': return ''
        case 't': {
          const value = node.textContent ?? ''
          return budget.add(escape(value))
        }
        case 'tab': return '\t'
        case 'br': case 'cr': return '<br>'
        case 'drawing': case 'pict': return budget.add(images(node))
        case 'r': return `<span style="${runStyle(node)}">${elements(node).map(inline).join('')}</span>`
        default: return elements(node).map(inline).join('')
      }
    }
    const blocks = (node: Element): string => {
      if (node.localName === 'p') {
        paragraph++
        const value = paragraphValue(node)
        fields.push({ key: fieldKey(path, node), label: `Paragraph ${paragraph}`, value, multiline: true })
        text.push(value)
        const properties = first(node, 'pPr'), align = attr(properties && first(properties, 'jc'), 'val')
        const style = `white-space:pre-wrap;min-height:1em;${['left', 'right', 'center', 'justify'].includes(align) ? `text-align:${align}` : ''}`
        return budget.add(`<p style="${style}">${elements(node).map(inline).join('')}</p>`)
      }
      if (node.localName === 'tbl') return budget.add(`<table style="border-collapse:collapse;max-width:100%"><tbody>${children(node, 'tr').map(row => `<tr>${children(row, 'tc').map(cell => {
        const properties = first(cell, 'tcPr'), span = Number(attr(properties && first(properties, 'gridSpan'), 'val'))
        return `<td${Number.isInteger(span) && span > 1 && span <= 100 ? ` colspan="${span}"` : ''} style="border:1px solid #999;padding:6px;vertical-align:top">${elements(cell).map(blocks).join('')}</td>`
      }).join('')}</tr>`).join('')}</tbody></table>`)
      if (['pPr', 'rPr', 'tblPr', 'tblGrid', 'tcPr', 'sectPr', 'del', 'moveFrom'].includes(node.localName ?? '')) return ''
      return elements(node).map(blocks).join('')
    }
    return blocks(document.documentElement)
  }
  const links = relationships(archive, part)
  const section = (type: string) => [...new Set(links.filter(item => item.type === type).map(item => item.target))].map(path => `<section aria-label="${type}">${renderPart(path)}</section>`).join('')
  const header = section('header'), body = renderPart(part), footer = section('footer')
  return { kind: 'docx', html: `<article class="office-document">${header}${body}${footer}</article>`, fields, text: text.join('\n') }
}

function replaceText(node: Element, value: string): void {
  // Keep the existing run, properties, drawings, bookmarks and sibling text.
  // OOXML uses explicit breaks/tabs; literal newlines in w:t are not enough.
  const parent = node.parentNode!
  const document = node.ownerDocument!
  const prefix = node.prefix ? `${node.prefix}:` : ''
  const fragments = value.replace(/\r\n?/g, '\n').split(/([\n\t])/)
  node.textContent = fragments[0]
  node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
  const after = node.nextSibling
  for (let index = 1; index < fragments.length; index++) {
    const fragment = fragments[index]
    const element = document.createElementNS(node.namespaceURI, `${prefix}${fragment === '\n' ? 'br' : fragment === '\t' ? 'tab' : 't'}`)
    if (fragment !== '\n' && fragment !== '\t') {
      element.textContent = fragment
      element.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    }
    parent.insertBefore(element, after)
  }
}

export function editWordParagraph(paragraph: Element, value: string): void {
  const tokens = paragraphTokens(paragraph)
  let texts = tokens.filter(node => node.localName === 't')
  for (const node of tokens) if (node.localName !== 't') node.parentNode!.removeChild(node)
  if (!texts.length) {
    const document = paragraph.ownerDocument!, prefix = paragraph.prefix ? `${paragraph.prefix}:` : ''
    const run = document.createElementNS(paragraph.namespaceURI, `${prefix}r`), text = document.createElementNS(paragraph.namespaceURI, `${prefix}t`)
    run.appendChild(text)
    paragraph.appendChild(run)
    texts = [text]
  }
  // Retain run formatting by distributing replacement text through the existing
  // runs. Paragraph-level keys stay stable even when line breaks add run nodes.
  let offset = 0
  texts.forEach((node, index) => {
    const length = index === texts.length - 1 ? value.length - offset : Math.min(node.textContent?.length ?? 0, value.length - offset)
    let end = offset + length
    if (end > offset && /[\uD800-\uDBFF]/u.test(value[end - 1]) && end < value.length) end++
    replaceText(node, value.slice(offset, end))
    offset = end
  })
}
