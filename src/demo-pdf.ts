// A one-page PDF of plain lines (Helvetica, US Letter), for the demo's sample originals. With `scan`, the page is
// that JPEG (a scanned paper) with the lines over it as its text layer, as a scanner's searchable PDF keeps them.
// Text is kept to printable ASCII so every byte offset in the cross-reference is exact.
const ascii = (value: string) => value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '')
const literal = (value: string) => `(${ascii(value).replace(/[\\()]/g, match => '\\' + match)})`
const jpegSize = (bytes: Uint8Array) => { for (let i = 2; i < bytes.length;) { const marker = bytes[i + 1], length = bytes[i + 2] << 8 | bytes[i + 3]; if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes[i + 5] << 8 | bytes[i + 6], width: bytes[i + 7] << 8 | bytes[i + 8] }; i += 2 + length } throw new Error('not a JPEG') }

export function pdf(title: string, lines: string[], scan?: Uint8Array): Uint8Array {
 const text = [...(scan ? ['q 612 0 0 792 0 0 cm /Scan Do Q'] : []), `BT /F2 18 Tf 56 740 Td ${literal(title)} Tj ET`, ...lines.map((line, index) => `BT /F1 11 Tf 56 ${706 - index * 18} Td ${literal(line)} Tj ET`)].join('\n')
 const image = scan ? jpegSize(scan) : null
 const objects: (string | [string, Uint8Array])[] = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${image ? ' /XObject << /Scan 7 0 R >>' : ''} >> /Contents 6 0 R >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ...(image && scan ? [[`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${scan.length} >>\nstream\n`, scan] as [string, Uint8Array]] : []),
 ]
 const chunks: Uint8Array[] = [], encoder = new TextEncoder(), offsets: number[] = []
 let length = 0
 const put = (part: string | Uint8Array) => { const bytes = typeof part === 'string' ? encoder.encode(part) : part; chunks.push(bytes); length += bytes.length }
 put('%PDF-1.4\n')
 objects.forEach((object, index) => { offsets.push(length); put(`${index + 1} 0 obj\n`); if (typeof object === 'string') put(object); else { put(object[0]); put(object[1]); put('\nendstream') } put('\nendobj\n') })
 const xref = length
 put(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(at => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`)
 put(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
 const body = new Uint8Array(length)
 chunks.reduce((at, bytes) => (body.set(bytes, at), at + bytes.length), 0)
 return body
}
