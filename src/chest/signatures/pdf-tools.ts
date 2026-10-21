import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { extractText, getDocumentProxy } from 'unpdf'
import { ChestError, insist } from '../model'
import type { Field, SignRequest } from './model'
export async function loadPdf(bytes: Uint8Array) {
 insist(bytes.length >= 8 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-', 'not_a_pdf', 422)
 insist(!/\/ByteRange\s*\[/.test(new TextDecoder('latin1').decode(bytes)), 'pdf_already_signed', 422)
 try { return await PDFDocument.load(bytes, { updateMetadata: false }) } catch (e: any) { throw new ChestError(/encrypt/i.test(String(e?.message)) ? 'pdf_encrypted' : 'pdf_unreadable', 422) }
}
export async function pageSizes(pdf: PDFDocument) {
 return pdf.getPages().map(page => { insist(page.getRotation().angle % 360 === 0, 'pdf_rotated_pages', 422); const { width, height } = page.getSize(); return { w: width, h: height } })
}
// Where each run of text sits on a page, as fractions, for the placement sheet.
export async function textMap(bytes: Uint8Array, limit = 12) {
 const proxy = await getDocumentProxy(bytes.slice(), { verbosity: 0 }), pages: { t: string; x: number; y: number; w: number; h: number }[][] = []
 try {
  for (let n = 1; n <= Math.min(proxy.numPages, limit); n++) {
   const page = await proxy.getPage(n), view = page.getViewport({ scale: 1 }), content = await page.getTextContent()
   pages.push((content.items as any[]).filter(i => i.str?.trim()).slice(0, 500).map(i => ({ t: String(i.str).slice(0, 120), x: i.transform[4] / view.width, y: 1 - (i.transform[5] + i.height) / view.height, w: Math.min(i.width / view.width, 1), h: Math.max(i.height / view.height, .008) })))
  }
 } finally { await proxy.loadingTask.destroy() }
 return pages
}
export async function plainText(bytes: Uint8Array) {
 const proxy = await getDocumentProxy(bytes.slice(), { verbosity: 0 })
 try { return (await extractText(proxy, { mergePages: true })).text } finally { await proxy.loadingTask.destroy() }
}
const WIN = /[^\x20-\x7e\xa0-\xff‘’“”–—•…€]/g
export const ansi = (text: string) => text.replace(/[\r\n\t]+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/•/g, '*').replace(/…/g, '...').replace(/€/g, 'EUR').replace(WIN, '?')
function fit(font: PDFFont, text: string, width: number, size: number) { let s = size; while (s > 5 && font.widthOfTextAtSize(text, s) > width) s -= .5; return s }
const rect = (page: PDFPage, f: Field) => { const { width, height } = page.getSize(); return { x: f.x * width, y: height - (f.y + f.h) * height, w: f.w * width, h: f.h * height } }
// Draws every signer's completed field into the PDF content itself, so the sealed bytes carry what was signed.
export async function stamp(pdf: PDFDocument, request: SignRequest, signedAt: (signer: string) => string | undefined) {
 const body = await pdf.embedFont(StandardFonts.Helvetica), script = await pdf.embedFont(StandardFonts.TimesRomanItalic), pages = pdf.getPages()
 for (const field of request.fields) {
  const page = pages[field.page - 1], signer = request.signers.find(s => s.id === field.signer)
  insist(page && signer, 'field_invalid', 422)
  const r = rect(page, field), ink = rgb(.08, .12, .45)
  page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, borderColor: rgb(.55, .6, .8), borderWidth: .6, color: rgb(.96, .97, 1) })
  const text = field.type === 'signature' ? signer.adopted?.name : field.type === 'initials' ? signer.adopted?.initials : field.type === 'date' ? (signedAt(signer.id) ?? '').slice(0, 10) : field.type === 'text' ? field.value : field.value === 'true' ? 'X' : ''
  if (!text) continue
  const font = field.type === 'signature' || field.type === 'initials' ? script : body, value = ansi(text), size = fit(font, value, r.w - 6, Math.min(r.h * (field.type === 'signature' ? .55 : .6), 22))
  page.drawText(value, { x: r.x + 3, y: r.y + (r.h - size) / 2 + size * .15, size, font, color: ink })
  if (field.type === 'signature') page.drawText(ansi(`Signed by ${signer.email} ${(signedAt(signer.id) ?? '').slice(0, 10)}`), { x: r.x + 3, y: r.y + 1.5, size: 5, font: body, color: rgb(.35, .38, .55), maxWidth: r.w - 4 })
 }
}
export const clampField = (f: any, pages: number) => {
 const n = (v: unknown) => { const x = Number(v); insist(Number.isFinite(x), 'field_invalid', 422); return x }
 const page = n(f.page), x = n(f.x), y = n(f.y), w = n(f.w), h = n(f.h)
 insist(Number.isInteger(page) && page >= 1 && page <= pages && w >= .01 && h >= .01 && x >= 0 && y >= 0 && x + w <= 1.0001 && y + h <= 1.0001, 'field_invalid', 422)
 return { page, x, y, w, h }
}
