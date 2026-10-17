// Word, Excel and PowerPoint files (and their OpenDocument equivalents) are zip archives of XML; their text is read in
// the Worker so search finds the words inside. Formatting, comments and embedded pictures are not read.
const MAX_ENTRY = 40_000_000
type Entry = { name: string; method: number; size: number; offset: number; compressed: number }
function entries(bytes: Uint8Array): Entry[] | null {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 if (bytes.length < 22 || v.getUint32(0, true) !== 0x04034b50) return null
 let end = -1
 for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break }
 if (end < 0) return null
 const count = v.getUint16(end + 10, true), list: Entry[] = []
 let at = v.getUint32(end + 16, true)
 for (let n = 0; n < count && at + 46 <= bytes.length && v.getUint32(at, true) === 0x02014b50; n++) {
  const nameLength = v.getUint16(at + 28, true), extra = v.getUint16(at + 30, true), comment = v.getUint16(at + 32, true)
  list.push({ name: new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)), method: v.getUint16(at + 10, true), compressed: v.getUint32(at + 20, true), size: v.getUint32(at + 24, true), offset: v.getUint32(at + 42, true) })
  at += 46 + nameLength + extra + comment
 }
 return list
}
async function read(bytes: Uint8Array, e: Entry): Promise<string> {
 if (e.size > MAX_ENTRY) throw new Error('office_entry_too_large')
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true), data = bytes.subarray(start, start + e.compressed)
 if (e.method === 0) return new TextDecoder().decode(data)
 if (e.method !== 8) throw new Error('office_compression')
 return new Response(new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
}
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function text(xml: string) {
 return xml.replace(/<(w:tab|text:tab)\b[^>]*\/>/g, ' ').replace(/<(w:br|a:br|text:line-break)\b[^>]*\/>/g, '\n').replace(/<\/(w:p|a:p|text:p|text:h|si|row|table:table-row)>/g, '\n').replace(/<\/(c|table:table-cell)>/g, '\t')
  .replace(/<[^>]+>/g, '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c: string) => c[0] === '#' ? String.fromCodePoint(parseInt(c.slice(c[1] === 'x' || c[1] === 'X' ? 2 : 1), c[1] === 'x' || c[1] === 'X' ? 16 : 10)) : entities[c] ?? m)
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
const numbered = (prefix: string) => (a: Entry, b: Entry) => Number(a.name.slice(prefix.length).match(/\d+/)?.[0] ?? 0) - Number(b.name.slice(prefix.length).match(/\d+/)?.[0] ?? 0)
// The kind of office file and its text, or null when the bytes are not one.
export async function officeText(bytes: Uint8Array): Promise<{ kind: string; text: string } | null> {
 const list = entries(bytes); if (!list) return null
 const find = (name: string) => list.find(e => e.name === name), many = (prefix: string) => list.filter(e => e.name.startsWith(prefix) && e.name.endsWith('.xml') && !e.name.slice(prefix.length).includes('/')).sort(numbered(prefix))
 const join = async (files: Entry[]) => (await Promise.all(files.map(async e => text(await read(bytes, e))))).filter(Boolean).join('\n\n')
 if (find('word/document.xml')) return { kind: 'Word document', text: await join([find('word/document.xml')!, ...many('word/footnotes'), ...many('word/header'), ...many('word/footer')]) }
 if (find('xl/workbook.xml')) {
  // Shared strings hold the sheets' text; cells hold numbers and inline text.
  const shared = find('xl/sharedStrings.xml') ? text(await read(bytes, find('xl/sharedStrings.xml')!)) : '', sheets = []
  for (const e of many('xl/worksheets/sheet')) sheets.push((await read(bytes, e)).match(/<c\b(?![^>]*t="s")[^>]*>.*?<\/c>/gs)?.map(c => text(c)).filter(Boolean).join('\t') ?? '')
  return { kind: 'Excel workbook', text: [shared, ...sheets].filter(Boolean).join('\n\n') }
 }
 if (find('ppt/presentation.xml')) return { kind: 'PowerPoint presentation', text: await join([...many('ppt/slides/slide'), ...many('ppt/notesSlides/notesSlide')]) }
 const mimetype = find('mimetype') ? (await read(bytes, find('mimetype')!)).trim() : ''
 if (mimetype.startsWith('application/vnd.oasis.opendocument.') && find('content.xml')) return { kind: { text: 'OpenDocument text', spreadsheet: 'OpenDocument spreadsheet', presentation: 'OpenDocument presentation' }[mimetype.split('.').pop()!] ?? 'OpenDocument file', text: text(await read(bytes, find('content.xml')!)) }
 return null
}
