import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { OfficeArchive } from '../office/archive'
import { attr, children, descendants, elements, first, parseXml, related, relationships, type Element } from '../office/xml'
import { ansi } from './pdf-tools'
import type { Fidelity } from './model'
// DOCX to PDF for signing. Chest lays out paragraphs, runs (bold, italic, size), alignment, simple lists and tables
// with the PDF standard fonts, and reports everything it cannot reproduce so the requester sees it before sending.
type Face = 'sans' | 'serif' | 'mono'
type Piece = { text: string; bold: boolean; italic: boolean; size: number; face: Face }
const twip = (v: string, fallback: number) => Number.isFinite(Number(v)) && v !== '' ? Number(v) / 20 : fallback
const faceOf = (name: string): Face => /courier|consolas|mono/i.test(name) ? 'mono' : /times|georgia|garamond|cambria|serif|book|palatino/i.test(name) && !/sans/i.test(name) ? 'serif' : 'sans'
const exact = new Set(['arial', 'helvetica', 'times new roman', 'courier new', 'courier'])
export async function renderDocx(bytes: Uint8Array): Promise<{ pdf: Uint8Array; pages: number; fidelity: Fidelity }> {
 const archive = new OfficeArchive(bytes), main = related(archive, '', 'officeDocument')
 if (!main) throw new Error('docx_unreadable')
 const document = parseXml(archive.get(main)).documentElement, body = first(document, 'body')
 if (!body) throw new Error('docx_unreadable')
 const pdf = await PDFDocument.create(), fonts = new Map<string, PDFFont>()
 const font = async (face: Face, bold: boolean, italic: boolean) => { const key = `${face}${bold}${italic}`; if (!fonts.has(key)) fonts.set(key, await pdf.embedFont((StandardFonts as any)[face === 'sans' ? `Helvetica${bold && italic ? 'BoldOblique' : bold ? 'Bold' : italic ? 'Oblique' : ''}` : face === 'serif' ? `Times${bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Roman'}` : `Courier${bold && italic ? 'BoldOblique' : bold ? 'Bold' : italic ? 'Oblique' : ''}`])); return fonts.get(key)! }
 const section = last(descendants(body, 'sectPr')), size = section && first(section, 'pgSz'), margin = section && first(section, 'pgMar')
 const W = twip(attr(size, 'w'), 612), H = twip(attr(size, 'h'), 792), left = twip(attr(margin, 'left'), 72), right = twip(attr(margin, 'right'), 72), top = twip(attr(margin, 'top'), 72), bottom = twip(attr(margin, 'bottom'), 72)
 const seen = new Set<Element>(), used = new Map<string, string>(), notes = { images: 0, replaced: 0, tables: 0, paragraphs: 0, boxes: 0, columns: false, tracked: false }
 let page: PDFPage = pdf.addPage([W, H]), y = H - top
 const newPage = () => { page = pdf.addPage([W, H]); y = H - top }
 const runPieces = (p: Element, base: { bold: boolean; size: number }): Piece[] => {
  const out: Piece[] = [], walk = (node: Element) => {
   const n = node.localName
   if (n === 'del' || n === 'moveFrom') { notes.tracked = true; return }
   if (n === 'ins' || n === 'moveTo') notes.tracked = true
   if (n === 'drawing' || n === 'pict') { if (!seen.has(node)) { seen.add(node); notes.images++; if (descendants(node, 'txbxContent').length) notes.boxes++ } return }
   if (n === 'r') {
    const props = first(node, 'rPr'), on = (name: string) => { const e = props && first(props, name); return !!e && !['0', 'false', 'off', 'none'].includes(attr(e, 'val')) }
    const fontName = attr(props && first(props, 'rFonts'), 'ascii') || attr(props && first(props, 'rFonts'), 'hAnsi'), face = faceOf(fontName), pts = Number(attr(props && first(props, 'sz'), 'val')) / 2
    if (fontName) used.set(fontName, face === 'sans' ? 'Helvetica' : face === 'serif' ? 'Times' : 'Courier')
    const piece = { bold: on('b') || base.bold, italic: on('i'), size: pts >= 4 && pts <= 96 ? pts : base.size, face }
    for (const t of elements(node)) {
     if (t.localName === 't') out.push({ ...piece, text: t.textContent ?? '' })
     else if (t.localName === 'tab') out.push({ ...piece, text: '    ' })
     else if (t.localName === 'br' || t.localName === 'cr') out.push({ ...piece, text: attr(t, 'type') === 'page' ? '\f' : '\n' })
     else if (t.localName === 'drawing' || t.localName === 'pict') walk(t)
    }
    return
   }
   if (['pPr', 'rPr', 'instrText', 'proofErr', 'bookmarkStart', 'bookmarkEnd'].includes(n ?? '')) return
   for (const c of elements(node)) walk(c)
  }
  for (const c of elements(p)) walk(c)
  return out
 }
 // Break pieces into positioned lines no wider than `width`.
 const layout = async (pieces: Piece[], width: number, count = false) => {
  type Word = { text: string; f: PDFFont; size: number; w: number }
  const lines: { words: Word[]; w: number; h: number; hard?: boolean; pageBreak?: boolean }[] = [{ words: [], w: 0, h: 0 }]
  for (const piece of pieces) {
   const f = await font(piece.face, piece.bold, piece.italic)
   for (const token of piece.text.split(/(\n|\f| )/)) {
    const line = lines.at(-1)!
    if (token === '\n' || token === '\f') { line.hard = true; line.pageBreak = token === '\f'; line.h = Math.max(line.h, piece.size * 1.2); lines.push({ words: [], w: 0, h: 0 }); continue }
    if (token === '') continue
    const clean = ansi(token); if (count) notes.replaced += (clean.match(/\?/g)?.length ?? 0) - (token.match(/\?/g)?.length ?? 0)
    let w = f.widthOfTextAtSize(clean.replace(/[^\x20-\xff]/g, '?'), piece.size)
    if (line.w + w > width && line.words.length && token !== ' ') { lines.push({ words: [], w: 0, h: 0 }) }
    const target = lines.at(-1)!
    if (token === ' ' && !target.words.length) continue
    target.words.push({ text: clean, f, size: piece.size, w }); target.w += w; target.h = Math.max(target.h, piece.size * 1.2)
   }
  }
  return lines
 }
 const draw = (line: Awaited<ReturnType<typeof layout>>[number], x: number, width: number, align: string, at: number) => {
  let cursor = x + (align === 'right' ? width - line.w : align === 'center' ? (width - line.w) / 2 : 0)
  for (const word of line.words) { if (word.text.trim()) page.drawText(word.text, { x: cursor, y: at, size: word.size, font: word.f, color: rgb(0, 0, 0) }); cursor += word.w }
 }
 const paragraph = async (p: Element, x: number, width: number, cell = false) => {
  notes.paragraphs++
  const props = first(p, 'pPr'), style = attr(props && first(props, 'pStyle'), 'val'), heading = /^heading(\d)/i.exec(style) || /^title$/i.test(style) && ['1']
  const level = heading ? Number(heading[1] ?? 1) : 0, base = { bold: !!heading, size: heading ? Math.max(12, 20 - level * 2) : 11 }
  const align = attr(props && first(props, 'jc'), 'val'), numbered = !!(props && first(props, 'numPr')), indent = twip(attr(props && first(props, 'ind'), 'left'), 0) + (numbered ? 18 : 0)
  const before = twip(attr(props && first(props, 'spacing'), 'before'), 0) * (cell ? 0 : 1), after = twip(attr(props && first(props, 'spacing'), 'after'), cell ? 0 : 6)
  if (props && first(props, 'pageBreakBefore') && !cell) newPage()
  let pieces = runPieces(p, base); if (numbered && pieces.length) pieces = [{ text: '• ', bold: false, italic: false, size: base.size, face: 'sans' }, ...pieces]
  const lines = await layout(pieces, Math.max(width - indent, 20), true), height = lines.reduce((n, l) => n + (l.h || base.size * 1.2), 0)
  if (!cell) { y -= before; if (y - Math.min(height, H - top - bottom) < bottom && height < H - top - bottom) newPage() }
  let measured = 0
  for (const line of lines) {
   const h = line.h || base.size * 1.2
   if (!cell && y - h < bottom) newPage()
   y -= h; measured += h
   draw(line, x + indent, width - indent, align, y + h * .22)
   if (line.pageBreak && !cell) newPage()
  }
  y -= after
  return measured + after
 }
 const table = async (t: Element, x: number, width: number) => {
  notes.tables++
  const grid = children(first(t, 'tblGrid') ?? t, 'gridCol').map(c => twip(attr(c, 'w'), 100)), total = grid.reduce((a, b) => a + b, 0) || 1
  for (const row of children(t, 'tr')) {
   const cells = children(row, 'tc'), columns = cells.map(c => Math.max(1, Number(attr(first(first(c, 'tcPr') ?? c, 'gridSpan'), 'val')) || 1))
   let index = 0; const boxes = cells.map((c, i) => { const w = (columns[i] === 1 && grid.length ? grid[index] : grid.slice(index, index + columns[i]).reduce((a, b) => a + b, 0) || total / cells.length) / total * width; index += columns[i]; return w })
   // Measure each cell, then draw the row on one page.
   const measured: number[] = []
   for (let i = 0; i < cells.length; i++) { let h = 6; for (const p of children(cells[i], 'p')) { const lines = await layout(runPieces(p, { bold: false, size: 10 }), boxes[i] - 8); h += lines.reduce((n, l) => n + (l.h || 12), 0) } measured.push(h) }
   const height = Math.min(Math.max(...measured, 16), H - top - bottom)
   if (y - height < bottom) newPage()
   let cx = x
   for (let i = 0; i < cells.length; i++) {
    page.drawRectangle({ x: cx, y: y - height, width: boxes[i], height, borderColor: rgb(.45, .45, .45), borderWidth: .5 })
    let cy = y - 4
    for (const p of children(cells[i], 'p')) {
     const lines = await layout(runPieces(p, { bold: false, size: 10 }), boxes[i] - 8, true)
     for (const line of lines) { const h = line.h || 12; if (cy - h < y - height) break; cy -= h; draw(line, cx + 4, boxes[i] - 8, attr(first(p, 'pPr') && first(first(p, 'pPr')!, 'jc'), 'val'), cy + h * .22) }
    }
    cx += boxes[i]
   }
   y -= height
  }
  y -= 8
 }
 const block = async (node: Element) => {
  if (node.localName === 'p') await paragraph(node, left, W - left - right)
  else if (node.localName === 'tbl') await table(node, left, W - left - right)
  else if (node.localName === 'sdt') { const content = first(node, 'sdtContent'); if (content) for (const c of elements(content)) await block(c) }
  else if (node.localName === 'ins') for (const c of elements(node)) await block(c)
 }
 for (const node of elements(body)) await block(node)
 const parts = [...relationships(archive, main)], names = (type: string) => parts.filter(p => p.type === type)
 const textual = (path: string) => { try { return descendants(parseXml(archive.get(path)).documentElement, 't').some(t => (t.textContent ?? '').trim()) } catch { return false } }
 const frames = [...names('header'), ...names('footer')].filter(p => textual(p.target)).length
 notes.columns = !!section && Number(attr(first(section, 'cols'), 'num')) > 1
 const substituted = [...used].filter(([name]) => !exact.has(name.toLowerCase()))
 const items: Fidelity['items'] = []
 if (substituted.length) items.push({ level: 'warning', text: `Fonts are substituted with the PDF standard fonts: ${substituted.map(([from, to]) => `${from} → ${to}`).join(', ')}. Line and page breaks may differ from Word.` })
 if (notes.images) items.push({ level: 'warning', text: `${notes.images} picture${notes.images === 1 ? '' : 's'}, shape${notes.images === 1 ? '' : 's'} or drawing${notes.images === 1 ? '' : 's'} are not reproduced.` })
 if (notes.boxes) items.push({ level: 'warning', text: `${notes.boxes} text box${notes.boxes === 1 ? '' : 'es'} are not reproduced.` })
 if (frames) items.push({ level: 'warning', text: 'Headers and footers are not reproduced.' })
 if (names('footnotes').length || names('endnotes').length) items.push({ level: 'warning', text: 'Footnotes and endnotes are not reproduced.' })
 if (names('comments').length) items.push({ level: 'info', text: 'Comments are not part of the signed copy.' })
 if (notes.columns) items.push({ level: 'warning', text: 'A multi-column layout is flattened to one column.' })
 if (notes.replaced > 0) items.push({ level: 'warning', text: `${notes.replaced} character${notes.replaced === 1 ? '' : 's'} outside the PDF standard fonts are shown as "?".` })
 if (notes.tracked) items.push({ level: 'info', text: 'Tracked changes: insertions appear as final text and deletions are omitted.' })
 const count = pdf.getPageCount()
 return { pdf: await pdf.save({ useObjectStreams: false }), pages: count, fidelity: { summary: `Rendered ${count} page${count === 1 ? '' : 's'} from ${notes.paragraphs} paragraph${notes.paragraphs === 1 ? '' : 's'} and ${notes.tables} table${notes.tables === 1 ? '' : 's'}.${items.some(i => i.level === 'warning') ? ' Review the differences below before sending.' : ' No differences were found in what Chest can compare.'}`, items } }
}
const last = <T>(items: T[]) => items.at(-1)
