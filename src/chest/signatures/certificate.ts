import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { ansi } from './pdf-tools'
import type { SignRequest } from './model'
// The audit certificate: a PDF listing every signer, how they verified, each event with its address and browser, the
// timestamps and the SHA-256 of the document before and after signing. Chest seals it with the same key as the signed PDF.
export type Hashes = { source: string; document: string; signed: string }
export async function auditCertificate(request: SignRequest, hashes: Hashes, installation: string) {
 const pdf = await PDFDocument.create(), regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), mono = await pdf.embedFont(StandardFonts.Courier)
 let page: PDFPage = pdf.addPage([612, 792]), y = 740
 const line = (text: string, size = 9, font: PDFFont = regular, indent = 0, gap = 4) => {
  const width = 612 - 112 - indent, words = ansi(text).split(' '), lines: string[] = []; let current = ''
  for (const word of words) { const next = current ? `${current} ${word}` : word; if (font.widthOfTextAtSize(next, size) > width && current) { lines.push(current); current = word } else current = next }
  lines.push(current)
  for (const l of lines) { if (y < 70) { page = pdf.addPage([612, 792]); y = 740 } page.drawText(l, { x: 56 + indent, y, size, font, color: rgb(0, 0, 0) }); y -= size + gap }
 }
 const hash = (label: string, value: string) => { line(label, 8, bold, 0, 1); line(value, 8, mono, 8, 5) }
 line('Certificate of signing', 20, bold, 0, 10)
 line(`${request.name} · request ${request.item}`, 10, regular, 0, 2)
 line(`Issued by ${installation}. Outcome: ${request.outcome?.status ?? request.status}${request.outcome?.at ? ` at ${request.outcome.at}` : ''}.`, 10, regular, 0, 12)
 line('Document', 12, bold, 0, 6)
 hash('SHA-256 of the source version before signing', hashes.source)
 if (hashes.document !== hashes.source) hash('SHA-256 of the PDF rendition that was signed (rendered from the source)', hashes.document)
 hash('SHA-256 of the signed PDF after signing and sealing', hashes.signed)
 line('The signed PDF carries a PAdES digital signature (ETSI.CAdES.detached) made with this installation’s signing key. Any later change to its bytes is detectable.', 8, regular, 0, 10)
 line('Signers', 12, bold, 0, 6)
 for (const s of request.signers) line(`${s.order}. ${s.name} <${s.email}> · ${s.staff ? 'staff' : 'external'} · verified by ${s.verified ? (s.verified.method === 'pin' ? 'one-time PIN sent to the invited address' : 'staff sign-in') : 'not verified'}${s.consentAt ? ` · consented ${s.consentAt}` : ''}${s.signedAt ? ` · signed ${s.signedAt}` : ''}`, 9, regular, 0, 3)
 y -= 6
 line('Events', 12, bold, 0, 6)
 for (const e of request.events) line(`${e.at} · ${e.type}${e.email ? ` · ${e.email}` : ''}${e.method ? ` · ${e.method}` : ''} · IP ${e.ip} · ${e.agent.slice(0, 90)}${e.detail ? ` · ${e.detail}` : ''}`, 8, regular, 0, 3)
 y -= 6
 line('Chest signing is built to the US ESIGN Act and UETA: intent to sign through an explicit adopt-and-sign action, consent to electronic records before signing, the signature associated with the exact record, and retention with accurate reproduction. It makes no claim of legal sufficiency for a particular document.', 8, regular, 0, 3)
 return pdf
}
