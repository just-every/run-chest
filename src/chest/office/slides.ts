import type { OfficeArchive } from './archive'
import { imageRenderer } from './images'
import { attr, children, descendants, elements, escape, first, OutputBudget, parseXml, relationships, type Element, type OfficePreview } from './xml'

type Transform = { x: number; y: number; sx: number; sy: number }
const number = (node: Element | undefined, name: string, defaultValue = 0) => {
  const value = Number(attr(node, name))
  return Number.isFinite(value) && Math.abs(value) <= 1e12 && attr(node, name) !== '' ? value : defaultValue
}
function color(node: Element | undefined): string {
  const value = node ? attr(first(node, 'srgbClr'), 'val') : ''
  return /^[\da-f]{6}$/i.test(value) ? `#${value}` : ''
}
export function slidesPreview(archive: OfficeArchive, part: string): OfficePreview {
  const presentation = parseXml(archive.get(part)), root = presentation.documentElement
  const size = first(root, 'sldSz'), width = number(size, 'cx', 9144000), height = number(size, 'cy', 6858000)
  if (width <= 0 || height <= 0) throw new Error('Invalid Office slide dimensions')
  const links = relationships(archive, part), ids = first(root, 'sldIdLst')
  const slides = ids ? children(ids, 'sldId') : []
  if (slides.length > 500) throw new Error('Office presentation exceeds the 500-slide limit')
  const text: string[] = [], budget = new OutputBudget()
  const html = slides.map((slide, index) => {
    const link = links.find(item => item.id === attr(slide, 'id') && item.type === 'slide')
    // sldId has both id="256" and r:id="rId1"; select the relationship namespace.
    const relation = links.find(item => item.id === Array.from(slide.attributes).find(item => item.localName === 'id' && !!item.prefix)?.value && item.type === 'slide') ?? link
    if (!relation) throw new Error('Missing Office slide relationship')
    const document = parseXml(archive.get(relation.target)), images = imageRenderer(archive, relation.target)
    const common = first(document.documentElement, 'cSld'), tree = common && first(common, 'spTree')
    if (!tree) throw new Error('Office slide has no shape tree')
    text.push(`Slide ${index + 1}`)
    const paragraph = (node: Element): string => {
      const properties = first(node, 'pPr'), alignment = attr(properties, 'algn')
      const runs = elements(node).map(run => {
        if (run.localName === 'br') return '<br>'
        if (!['r', 'fld'].includes(run.localName ?? '')) return ''
        const properties = first(run, 'rPr'), value = children(run, 't').map(item => item.textContent ?? '').join('')
        const styles: string[] = []
        if (attr(properties, 'b') === '1') styles.push('font-weight:bold')
        if (attr(properties, 'i') === '1') styles.push('font-style:italic')
        if (attr(properties, 'u') && attr(properties, 'u') !== 'none') styles.push('text-decoration:underline')
        const size = number(properties, 'sz')
        if (size >= 100 && size <= 40000) styles.push(`font-size:${size / 100 * 12700 / width * 100}cqw`)
        const fill = color(properties && first(properties, 'solidFill'))
        if (fill) styles.push(`color:${fill}`)
        return `<span style="${styles.join(';')}">${budget.add(escape(value))}</span>`
      }).join('')
      const plain = descendants(node, 't').map(item => item.textContent ?? '').join('')
      text.push(plain)
      return `<p style="margin:0;white-space:pre-wrap;${{ ctr: 'text-align:center', r: 'text-align:right', just: 'text-align:justify' }[alignment as 'ctr' | 'r' | 'just'] ?? ''}">${runs || '<br>'}</p>`
    }
    const renderShape = (shape: Element, transform: Transform): string => {
      const group = shape.localName === 'grpSp'
      const properties = first(shape, group ? 'grpSpPr' : 'spPr')
      const xfrm = (properties && first(properties, 'xfrm')) ?? first(shape, 'xfrm')
      const off = xfrm && first(xfrm, 'off'), ext = xfrm && first(xfrm, 'ext')
      const x = number(off, 'x'), y = number(off, 'y'), cx = number(ext, 'cx'), cy = number(ext, 'cy')
      if (group) {
        const childOff = xfrm && first(xfrm, 'chOff'), childExt = xfrm && first(xfrm, 'chExt')
        const sx = cx / number(childExt, 'cx', cx || 1), sy = cy / number(childExt, 'cy', cy || 1)
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) throw new Error('Invalid Office grouped shape dimensions')
        return elements(shape).filter(child => ['sp', 'pic', 'graphicFrame', 'grpSp', 'cxnSp'].includes(child.localName ?? '')).map(child => renderShape(child, {
          x: transform.x + (x - number(childOff, 'x') * sx) * transform.sx,
          y: transform.y + (y - number(childOff, 'y') * sy) * transform.sy,
          sx: transform.sx * sx, sy: transform.sy * sy,
        })).join('')
      }
      const left = (transform.x + x * transform.sx) / width * 100, top = (transform.y + y * transform.sy) / height * 100
      const w = cx * transform.sx / width * 100, h = cy * transform.sy / height * 100
      const rotation = number(xfrm, 'rot') / 60000
      const fill = color(properties && first(properties, 'solidFill'))
      const style = xfrm && w > 0 && h > 0 ? `position:absolute;left:${left}%;top:${top}%;width:${w}%;height:${h}%;transform:rotate(${rotation}deg);` : 'position:relative;'
      const body = first(shape, 'txBody')
      let content = body ? children(body, 'p').map(paragraph).join('') : ''
      if (shape.localName === 'pic') content += budget.add(images(shape))
      for (const table of descendants(shape, 'tbl')) {
        content += `<table style="border-collapse:collapse;width:100%;height:100%"><tbody>${children(table, 'tr').map(row => `<tr>${children(row, 'tc').map(cell => `<td style="border:1px solid #999;padding:4px">${children(first(cell, 'txBody') ?? cell, 'p').map(paragraph).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      }
      return `<div style="${style}box-sizing:border-box;overflow:hidden;${fill ? `background:${fill};` : ''}">${content}</div>`
    }
    const background = color(common && first(common, 'bg') && first(first(common, 'bg')!, 'bgPr') && first(first(first(common, 'bg')!, 'bgPr')!, 'solidFill')) || '#fff'
    return budget.add(`<section class="office-slide"><h2>Slide ${index + 1}</h2><div style="container-type:inline-size;position:relative;width:960px;max-width:100%;aspect-ratio:${width}/${height};background:${background};color:#111;border:1px solid #bbb;font-size:${18 * 12700 / width * 100}cqw">${elements(tree).filter(child => ['sp', 'pic', 'graphicFrame', 'grpSp', 'cxnSp'].includes(child.localName ?? '')).map(shape => renderShape(shape, { x: 0, y: 0, sx: 1, sy: 1 })).join('')}</div></section>`)
  }).join('')
  return { kind: 'pptx', html, fields: [], text: text.join('\n') }
}
