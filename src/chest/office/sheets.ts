import type { OfficeArchive } from './archive'
import { attr, children, descendants, elements, escape, fieldKey, first, OutputBudget, parseXml, related, relationships, type Document, type Element, type OfficeField, type OfficePreview } from './xml'

export function workbookSheets(archive: OfficeArchive, part: string) {
  const document = parseXml(archive.get(part)), links = relationships(archive, part)
  const sheets = descendants(document.documentElement, 'sheet').map(sheet => {
    const link = links.find(item => item.id === attr(sheet, 'id') && item.type === 'worksheet')
    if (!link) throw new Error('Missing Office worksheet relationship')
    return { name: attr(sheet, 'name'), part: link.target, hidden: attr(sheet, 'state') === 'hidden' || attr(sheet, 'state') === 'veryHidden' }
  })
  if (sheets.length > 256) throw new Error('Office workbook exceeds the 256-sheet limit')
  return { document, sheets }
}
export function sharedStrings(archive: OfficeArchive, part: string): string[] {
  const path = related(archive, part, 'sharedStrings')
  if (!path) return []
  const document = parseXml(archive.get(path))
  return children(document.documentElement, 'si').map(item => descendants(item, 't').filter(node => node.parentNode?.localName !== 'rPh').map(node => node.textContent ?? '').join(''))
}
export function cellValue(cell: Element, shared: string[]): string {
  const type = attr(cell, 't'), value = first(cell, 'v')?.textContent ?? ''
  if (type === 's') {
    const index = Number(value)
    if (!/^\d+$/.test(value) || index >= shared.length) throw new Error('Invalid Office shared-string reference')
    return shared[index]
  }
  if (type === 'inlineStr') return descendants(first(cell, 'is') ?? cell, 't').filter(node => node.parentNode?.localName !== 'rPh').map(node => node.textContent ?? '').join('')
  if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE'
  return value
}
function columnIndex(address: string): number {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(address)
  if (!match || Number(match[2]) > 1048576) throw new Error('Invalid Office cell address')
  let column = 0
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64
  if (column > 16384) throw new Error('Invalid Office cell column')
  return column
}
function columnLabel(column: number): string {
  let label = ''
  while (column) { column--; label = String.fromCharCode(65 + column % 26) + label; column = Math.floor(column / 26) }
  return label
}

export function sheetsPreview(archive: OfficeArchive, part: string): OfficePreview {
  const { sheets } = workbookSheets(archive, part), shared = sharedStrings(archive, part)
  const fields: OfficeField[] = [], text: string[] = [], budget = new OutputBudget()
  let cellCount = 0
  const html = sheets.map(sheet => {
    const document = parseXml(archive.get(sheet.part))
    const data = first(document.documentElement, 'sheetData')
    if (!data) throw new Error('Office worksheet has no cell data')
    const seen = new Set<string>()
    const rows = children(data, 'row').map(row => {
      const rowNumber = Number(attr(row, 'r'))
      if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 1048576) throw new Error('Invalid Office row number')
      const cells = children(row, 'c').map(cell => {
        if (++cellCount > 50000) throw new Error('Office workbook exceeds the 50,000-cell preview limit')
        const address = attr(cell, 'r'), column = columnIndex(address)
        if (Number(address.replace(/^[A-Z]+/, '')) !== rowNumber || seen.has(address)) throw new Error('Conflicting Office cell address')
        seen.add(address)
        const value = cellValue(cell, shared), formula = !!first(cell, 'f')
        if (!formula && attr(cell, 't') !== 'e') fields.push({ key: fieldKey(sheet.part, cell), label: `${sheet.name}!${address}`, value, multiline: true })
        return { column, address, value, formula }
      }).sort((a, b) => a.column - b.column)
      return { rowNumber, cells }
    }).sort((a, b) => a.rowNumber - b.rowNumber)
    const rowNumbers = new Set<number>()
    let maxColumn = 0
    for (const row of rows) {
      if (rowNumbers.has(row.rowNumber)) throw new Error('Duplicate Office worksheet row')
      rowNumbers.add(row.rowNumber)
      maxColumn = Math.max(maxColumn, ...row.cells.map(cell => cell.column))
    }
    text.push(sheet.name)
    const head = Array.from({ length: maxColumn }, (_, index) => `<th scope="col">${columnLabel(index + 1)}</th>`).join('')
    const body = rows.map(row => {
      let previous = 0
      text.push(row.cells.map(cell => `${cell.address}: ${cell.value}`).join('\t'))
      const cells = row.cells.map(cell => {
        const gap = cell.column - previous - 1
        previous = cell.column
        return `${gap > 0 ? `<td colspan="${gap}"></td>` : ''}<td title="${cell.address}${cell.formula ? ' · cached formula value' : ''}" style="border:1px solid #bbb;padding:4px 8px;white-space:pre-wrap">${budget.add(escape(cell.value))}</td>`
      }).join('')
      return `<tr><th scope="row">${row.rowNumber}</th>${cells}</tr>`
    }).join('')
    return budget.add(`<section class="office-sheet"><h2>${escape(sheet.name)}${sheet.hidden ? ' (hidden sheet)' : ''}</h2><div style="overflow:auto"><table style="border-collapse:collapse"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`)
  }).join('')
  return { kind: 'xlsx', html, fields, text: text.join('\n') }
}

export function editCell(cell: Element, value: string): void {
  const document = cell.ownerDocument!, namespace = cell.namespaceURI, prefix = cell.prefix ? `${cell.prefix}:` : ''
  const type = attr(cell, 't')
  // Preserve cell styles and extension metadata; shared-string records may be
  // referenced elsewhere, so this cell receives its own inline string.
  for (const child of elements(cell)) if (['v', 'is', 'f'].includes(child.localName ?? '')) cell.removeChild(child)
  const numeric = (type === '' || type === 'n') && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value) && Number.isFinite(Number(value))
  const boolean = type === 'b' && /^(?:TRUE|FALSE)$/i.test(value)
  if (numeric || boolean) {
    if (boolean) cell.setAttribute('t', 'b'); else cell.removeAttribute('t')
    const item = document.createElementNS(namespace, `${prefix}v`)
    item.textContent = boolean ? (value.toUpperCase() === 'TRUE' ? '1' : '0') : value
    cell.insertBefore(item, first(cell, 'extLst') ?? null)
  } else {
    cell.setAttribute('t', 'inlineStr')
    const inline = document.createElementNS(namespace, `${prefix}is`), item = document.createElementNS(namespace, `${prefix}t`)
    item.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    item.textContent = value
    inline.appendChild(item)
    cell.insertBefore(inline, first(cell, 'extLst') ?? null)
  }
}

export function requestRecalculation(document: Document) {
  const root = document.documentElement!
  let calculation = first(root, 'calcPr')
  if (!calculation) {
    calculation = document.createElementNS(root.namespaceURI, `${root.prefix ? `${root.prefix}:` : ''}calcPr`)
    const later = new Set(['oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'])
    root.insertBefore(calculation, elements(root).find(child => later.has(child.localName ?? '')) ?? null)
  }
  calculation.setAttribute('fullCalcOnLoad', '1')
  calculation.setAttribute('forceFullCalc', '1')
}
