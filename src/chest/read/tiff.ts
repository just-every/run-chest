import * as UTIF from 'utif2'
import { dimensions, fit, type Raster } from './raster'

export class TiffProblem extends Error {}
type Tags = Record<string, number[]>
const bad = () => new TiffProblem('This TIFF could not be opened; its page directory or image data may be damaged.')
const MAX_DIRECTORIES = 1000, MAX_VALUES = 65_536, MEMORY = 88_000_000
// Only image tags reach the decoder; nested camera, EXIF and GPS directories are irrelevant to a scan.
const IMAGE_TAGS = new Set([256, 257, 258, 259, 262, 266, 273, 274, 277, 278, 279, 284, 292, 293, 317, 320, 322, 323, 324, 325, 338, 339, 347, 530])

function directory(bytes: Uint8Array, page?: number) {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 const within = (offset: number, size: number) => { if (offset < 0 || size < 0 || offset + size > bytes.length) throw bad() }
 within(0, 8)
 const le = bytes[0] === 73 && bytes[1] === 73
 if (!le && !(bytes[0] === 77 && bytes[1] === 77)) throw bad()
 if (v.getUint16(2, le) === 43) throw new TiffProblem('BigTIFF images are not read yet.')
 if (v.getUint16(2, le) !== 42) throw bad()
 let offset = v.getUint32(4, le), count = 0
 const seen = new Set<number>()
 while (offset) {
  if (seen.has(offset)) throw bad()
  if (++count > MAX_DIRECTORIES) throw new TiffProblem(`TIFF files with more than ${MAX_DIRECTORIES} pages are not read yet.`)
  seen.add(offset); within(offset, 2)
  const entries = v.getUint16(offset, le)
  if (entries > 256) throw bad()
  within(offset, 2 + entries * 12 + 4)
  if (page === count) {
   const tags: Tags = {}; let total = 0
   for (let i = 0; i < entries; i++) {
    const at = offset + 2 + i * 12, tag = v.getUint16(at, le)
    if (!IMAGE_TAGS.has(tag)) continue
    const kind = v.getUint16(at + 2, le), n = v.getUint32(at + 4, le), unit = kind === 3 ? 2 : kind === 4 ? 4 : [1, 7].includes(kind) ? 1 : 0
    if (!unit || !n || (total += n) > MAX_VALUES || tags[`t${tag}`]) throw bad()
    const start = n * unit <= 4 ? at + 8 : v.getUint32(at + 8, le)
    within(start, n * unit)
    tags[`t${tag}`] = Array.from({ length: n }, (_, j) => unit === 1 ? v.getUint8(start + j) : unit === 2 ? v.getUint16(start + j * 2, le) : v.getUint32(start + j * 4, le))
   }
   return { count, tags }
  }
  offset = v.getUint32(offset + 2 + entries * 12, le)
 }
 if (!count || page !== undefined) throw bad()
 return { count, tags: {} as Tags }
}

export const tiffPages = (bytes: Uint8Array) => directory(bytes).count

// Check Deflate output before the library inflates it, so its allocation cannot exceed the admitted strip size.
async function checkDeflate(bytes: Uint8Array, maximum: number) {
 const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.enqueue(bytes as Uint8Array<ArrayBuffer>); controller.close() } }).pipeThrough(new DecompressionStream('deflate')).getReader()
 let size = 0
 try {
  for (;;) {
   const next = await stream.read()
   if (next.done) break
   size += next.value.byteLength
   if (size > maximum) throw bad()
  }
  if (size !== maximum) throw bad()
 } finally { await stream.cancel().catch(() => {}) }
}

export async function tiff(bytes: Uint8Array, page: number): Promise<Raster> {
 const tags = directory(bytes, page).tags
 const first = (tag: number, otherwise = 0) => tags[`t${tag}`]?.[0] ?? otherwise
 const width = first(256), height = first(257), samples = first(277, 1), bits = first(258, 1), photo = first(262, bits === 1 ? 0 : 2), compression = first(259, 1)
 const rowBytes = Math.ceil(width * samples * bits / 8), rawBytes = rowBytes * height
 const allocation = bytes.length + rawBytes + width * height * 4
 if (!width || !height || width > 16000 || height > 16000 || width * height > 12_000_000 || allocation > MEMORY) throw new TiffProblem('This TIFF page is too large to decode within the reading memory limit.')
 if (first(322) || first(324) || first(284, 1) !== 1) throw new TiffProblem('Tiled TIFF pages and separate colour planes are not read yet.')
 const grey = [0, 1].includes(photo) && samples === 1 && [1, 2, 4, 8, 16].includes(bits) && !(photo === 0 && bits === 2) && !(photo === 1 && bits === 4)
 const rgb = photo === 2 && [3, 4].includes(samples) && [8, 16].includes(bits)
 const palette = photo === 3 && samples === 1 && [1, 2, 4, 8].includes(bits) && tags.t320?.length === 3 * 2 ** bits
 const jpg = compression === 7 && [2, 6].includes(photo) && samples === 3 && bits === 8
 if ((!grey && !rgb && !palette && !jpg) || first(339, 1) !== 1 || tags.t258?.some(n => n !== bits)) throw new TiffProblem('This TIFF page uses a colour or sample format that is not read yet.')
 if (![1, 2, 3, 4, 5, 7, 8, 32946, 32773].includes(compression) || ([2, 3, 4].includes(compression) && (!grey || bits !== 1))) throw new TiffProblem('This TIFF page uses a compression format that is not read yet.')
 if (![1, 2].includes(first(266, 1)) || (first(266, 1) === 2 && ![2, 3, 4].includes(compression)) || ![1, 2].includes(first(317, 1)) || (first(317, 1) === 2 && bits < 8) || (first(292) & 2) || first(293)) throw new TiffProblem('This TIFF page uses scan encoding options that are not read yet.')
 const offsets = tags.t273, lengths = tags.t279, rows = Math.min(first(278, height), height)
 if (!rows || !offsets || !lengths || offsets.length !== Math.ceil(height / rows) || lengths.length !== offsets.length) throw bad()
 for (let i = 0; i < offsets.length; i++) {
  const offset = offsets[i], length = lengths[i], stripRows = Math.min(rows, height - i * rows), expected = stripRows * rowBytes
  if (!length || offset + length > bytes.length) throw bad()
  const strip = bytes.subarray(offset, offset + length)
  if (compression === 1 && length < expected) throw bad()
  if ([8, 32946].includes(compression)) await checkDeflate(strip, expected)
  if (compression === 7) {
   // JPEG has its own dimensions. Check them independently of the enclosing TIFF before allocating its raster.
   const size = dimensions(strip, 'image/jpeg')
   if (!size || size.width !== width || size.height !== stripRows || size.width * size.height > 4_000_000 || allocation + size.width * size.height * 16 + length > MEMORY || length > 8_000_000) throw new TiffProblem('This TIFF JPEG strip is damaged or too large to decode.')
  }
 }
 const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer as ArrayBuffer : bytes.slice().buffer as ArrayBuffer
 try {
  const image = tags as unknown as UTIF.IFD
  UTIF.decodeImage(buffer, image)
  if (!image.data || image.data.length !== rawBytes) throw bad()
  const rgba = UTIF.toRGBA8(image)
  // Flatten transparency onto paper before reducing the image for OCR.
  for (let i = 0; i < rgba.length; i += 4) {
   const a = rgba[i + 3] / 255
   for (let c = 0; c < 3; c++) rgba[i + c] = rgba[i + c] * (first(338) === 1 ? 1 : a) + 255 * (1 - a)
   rgba[i + 3] = 255
  }
  const small = fit({ width, height, channels: 4, data: rgba }), orientation = first(274, 1)
  if (orientation === 1) return small
  if (orientation < 1 || orientation > 8) throw bad()
  const rotated = new Uint8Array(small.data.length), w = small.width, h = small.height, swap = orientation >= 5
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
   const xx = [2, 3, 7, 8].includes(orientation) ? w - 1 - x : x, yy = [3, 4, 6, 7].includes(orientation) ? h - 1 - y : y
   const dest = swap ? (xx * h + yy) * 4 : (yy * w + xx) * 4
   rotated.set(small.data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), dest)
  }
  return { width: swap ? h : w, height: swap ? w : h, channels: 4, data: rotated }
 } catch (e) { throw e instanceof TiffProblem ? e : bad() }
}
