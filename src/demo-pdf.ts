// A one-page PDF of plain lines (Helvetica, A4), for the demo's sample originals.
// Text is kept to printable ASCII so every byte offset in the cross-reference is exact.
const ascii = (value: string) => value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '')
const literal = (value: string) => `(${ascii(value).replace(/[\\()]/g, match => '\\' + match)})`

export function pdf(title: string, lines: string[]): Uint8Array {
  const text = [`BT /F2 18 Tf 56 770 Td ${literal(title)} Tj ET`, ...lines.map((line, index) => `BT /F1 11 Tf 56 ${736 - index * 18} Td ${literal(line)} Tj ET`)].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ]
  let body = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => { const at = body.length; body += `${index + 1} 0 obj\n${object}\nendobj\n`; return at })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(at => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}
