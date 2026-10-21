import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib'
import { pades, sha256, verifyPades, type Validation } from './cms'
import { read } from './der'
// PAdES sealing: the PDF is saved with a signature dictionary whose /Contents and /ByteRange are fixed-width
// placeholders; the signed ranges are hashed, the CMS is built over that digest and written into the placeholder.
// Nothing else in the file moves, so any later byte change falls inside a signed range or the signature itself.
const CONTENTS_BYTES = 6144
const RANGE = '/**********'
const latin1 = (bytes: Uint8Array, from = 0, to = bytes.length) => { let text = ''; for (let i = from; i < to; i += 8192) text += String.fromCharCode(...bytes.subarray(i, Math.min(to, i + 8192))); return text }
export async function addPlaceholder(pdf: PDFDocument, reason: string, name: string, at: Date) {
 const context = pdf.context, page = pdf.getPages()[0]
 const signature = context.register(context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'ETSI.CAdES.detached', ByteRange: [0, PDFName.of(RANGE.slice(1)), PDFName.of(RANGE.slice(1)), PDFName.of(RANGE.slice(1))], Contents: PDFHexString.of('0'.repeat(CONTENTS_BYTES * 2)), Reason: PDFString.of(reason), Name: PDFString.of(name), M: PDFString.fromDate(at) }))
 const widget = context.register(context.obj({ Type: 'Annot', Subtype: 'Widget', FT: 'Sig', Rect: [0, 0, 0, 0], V: signature, T: PDFString.of('ChestSeal'), F: 132, P: page.ref }))
 const annotations = page.node.lookup(PDFName.of('Annots'))
 if (annotations instanceof PDFArray) annotations.push(widget); else page.node.set(PDFName.of('Annots'), context.obj([widget]))
 const existing = pdf.catalog.lookup(PDFName.of('AcroForm'))
 if (existing instanceof PDFDict) {
  const fields = existing.lookup(PDFName.of('Fields'))
  if (fields instanceof PDFArray) fields.push(widget); else existing.set(PDFName.of('Fields'), context.obj([widget]))
  existing.set(PDFName.of('SigFlags'), PDFNumber.of(3))
 } else pdf.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: [widget], SigFlags: 3 }))
}
export async function seal(pdf: PDFDocument, key: { privateKey: Uint8Array; certificate: Uint8Array }, reason: string, name: string, at = new Date()) {
 await addPlaceholder(pdf, reason, name, at)
 const saved = await pdf.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false })
 const text = latin1(saved), marker = `/ByteRange [ 0 ${RANGE} ${RANGE} ${RANGE} ]`, at0 = text.indexOf(marker)
 const contentsAt = text.indexOf('/Contents <', at0), open = contentsAt + '/Contents <'.length, close = text.indexOf('>', open)
 if (at0 < 0 || contentsAt < 0 || close - open !== CONTENTS_BYTES * 2) throw new Error('seal_placeholder_missing')
 const range = [0, open - 1, close + 1, saved.length - close - 1], written = `/ByteRange [ ${range.join(' ')} ]`.padEnd(marker.length, ' ')
 if (written.length !== marker.length) throw new Error('seal_range_overflow')
 saved.set(new TextEncoder().encode(written), at0)
 const digest = await sha256(joined(saved, range))
 const cms = await pades(digest, key.privateKey, key.certificate, at)
 if (cms.length > CONTENTS_BYTES) throw new Error('seal_signature_too_large')
 saved.set(new TextEncoder().encode(Array.from(cms, b => b.toString(16).padStart(2, '0')).join('').padEnd(CONTENTS_BYTES * 2, '0')), open)
 return saved
}
const joined = (bytes: Uint8Array, [a, b, c, d]: number[]) => { const out = new Uint8Array(b + d); out.set(bytes.subarray(a, a + b)); out.set(bytes.subarray(c, c + d), b); return out }
// Validation parses only what the sealer wrote: one signature, covering the file except its own contents.
export async function validateSeal(bytes: Uint8Array): Promise<Validation & { coversWholeFile?: boolean }> {
 const text = latin1(bytes), found = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)]
 const last = found.at(-1)
 if (!last) return { valid: false, reason: 'no_signature' }
 const range = last.slice(1).map(Number)
 if (range[0] !== 0 || range[1] + range[3] + 2 > bytes.length || range[2] + range[3] !== bytes.length || range[1] >= range[2]) return { valid: false, reason: 'range_invalid', coversWholeFile: false }
 if (bytes[range[1]] !== 60 || bytes[range[2] - 1] !== 62) return { valid: false, reason: 'range_invalid', coversWholeFile: false }
 const hexText = latin1(bytes, range[1] + 1, range[2] - 1)
 if (!/^[0-9a-fA-F]+$/.test(hexText) || hexText.length % 2) return { valid: false, reason: 'contents_invalid', coversWholeFile: true }
 const all = Uint8Array.from(hexText.match(/../g) ?? [], h => parseInt(h, 16))
 let cms: Uint8Array; try { cms = all.subarray(0, read(all).end) } catch { return { valid: false, reason: 'cms_unreadable', coversWholeFile: true } }
 const result = await verifyPades(cms, await sha256(joined(bytes, range)))
 return { ...result, coversWholeFile: true }
}
