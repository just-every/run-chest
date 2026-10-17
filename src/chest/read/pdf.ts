import { extractImages, extractText, getDocumentProxy } from 'unpdf'
import type { Raster } from './raster'
// PDFs are read in the Worker with pdf.js (through unpdf's serverless build): the text layer of every page, and for a
// page with no text layer (a scan) the largest picture on it, which becomes that page's reading copy.
export class PdfProblem extends Error {}
const open = async (bytes: Uint8Array) => {
 try { return await getDocumentProxy(bytes.slice(), { verbosity: 0 }) }
 catch (e: any) { throw new PdfProblem(e?.name === 'PasswordException' ? 'This PDF is encrypted, so its text cannot be read. Remove the password and upload it again.' : 'This PDF could not be opened; it may be damaged.') }
}
// A page whose text layer holds fewer than this many letters and digits is treated as a scan.
const SCANNED = 20
export async function pdfText(bytes: Uint8Array) {
 const pdf = await open(bytes)
 try {
  const { totalPages, text } = await extractText(pdf, { mergePages: false })
  return { pages: totalPages, text: text.map(t => t.replace(/[ \t]+\n/g, '\n').trim()), scanned: text.flatMap((t, i) => t.replace(/[^\p{L}\p{N}]/gu, '').length < SCANNED ? [i + 1] : []) }
 } finally { await pdf.loadingTask.destroy() }
}
export async function pageImage(bytes: Uint8Array, page: number): Promise<Raster | null> {
 const pdf = await open(bytes)
 try {
  const images = await extractImages(pdf, page)
  const largest = images.sort((a, b) => b.width * b.height - a.width * a.height)[0]
  return largest && largest.width >= 300 && largest.height >= 300 ? { width: largest.width, height: largest.height, channels: largest.channels, data: largest.data } : null
 } finally { await pdf.loadingTask.destroy() }
}
