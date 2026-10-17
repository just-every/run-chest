import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js'
// Page images for reading: every scan or photo is reduced to one JPEG whose long edge is at most LONG pixels. That
// copy is what the AI model reads and what the file page draws boxes on, so a box always lands on the image it was
// read from. Originals are never changed.
export type Raster = { width: number; height: number; channels: number; stride?: number; data: Uint8Array | Uint8ClampedArray }
export type PageImage = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; bytes: Uint8Array; width: number; height: number }
// Anthropic reads images up to 1568 pixels on the long edge without resizing them, so a box the model reports in
// pixels is in the same frame as the copy Chest shows.
export const LONG = 1568
// The largest image a provider takes as-is (Anthropic accepts 5 MB per image).
const DIRECT = 4_500_000

// Box-average reduction straight into RGBA, reading any stride and channel count (1 grey, 3 RGB, 4 RGBA).
export function fit(r: Raster, long = LONG): Raster {
 const scale = Math.min(1, long / Math.max(r.width, r.height)), width = Math.max(1, Math.round(r.width * scale)), height = Math.max(1, Math.round(r.height * scale))
 const out = new Uint8Array(width * height * 4), stride = r.stride ?? r.width * r.channels, c = r.channels
 for (let y = 0; y < height; y++) {
  const y0 = Math.floor(y / scale), y1 = Math.max(y0 + 1, Math.min(r.height, Math.floor((y + 1) / scale)))
  for (let x = 0; x < width; x++) {
   const x0 = Math.floor(x / scale), x1 = Math.max(x0 + 1, Math.min(r.width, Math.floor((x + 1) / scale)))
   let red = 0, green = 0, blue = 0, n = 0
   for (let yy = y0; yy < y1; yy++) for (let xx = x0, i = yy * stride + x0 * c; xx < x1; xx++, i += c) { if (c < 3) { red += r.data[i]; green += r.data[i]; blue += r.data[i] } else { red += r.data[i]; green += r.data[i + 1]; blue += r.data[i + 2] } n++ }
   const o = (y * width + x) * 4; out[o] = red / n; out[o + 1] = green / n; out[o + 2] = blue / n; out[o + 3] = 255
  }
 }
 return { width, height, channels: 4, data: out }
}
export function jpeg(r: Raster, quality = 82): PageImage {
 const small = r.channels === 4 && Math.max(r.width, r.height) <= LONG && !r.stride ? r : fit(r)
 const encoded = encodeJpeg({ data: small.data as Uint8Array, width: small.width, height: small.height }, quality)
 return { mediaType: 'image/jpeg', bytes: new Uint8Array(encoded.data), width: small.width, height: small.height }
}
// Dimensions from the header alone: PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X, GIF screen.
export function dimensions(bytes: Uint8Array, mediaType: string): { width: number; height: number } | null {
 const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 if (mediaType === 'image/png' && bytes.length > 24) return { width: v.getUint32(16), height: v.getUint32(20) }
 if (mediaType === 'image/gif' && bytes.length > 10) return { width: v.getUint16(6, true), height: v.getUint16(8, true) }
 if (mediaType === 'image/webp' && bytes.length > 30) {
  const kind = String.fromCharCode(...bytes.slice(12, 16))
  if (kind === 'VP8X') return { width: 1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16), height: 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16) }
  if (kind === 'VP8L') { const b = v.getUint32(21, true); return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) } }
  if (kind === 'VP8 ') return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff }
 }
 if (mediaType === 'image/jpeg') for (let i = 2; i + 9 < bytes.length;) {
  if (bytes[i] !== 0xff) { i++; continue }
  const marker = bytes[i + 1], length = v.getUint16(i + 2)
  if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: v.getUint16(i + 7), height: v.getUint16(i + 5) }
  i += 2 + length
 }
 return null
}
// An image file's reading copy: small enough images go as they are; a large JPEG is reduced. Large PNG, WebP and GIF
// files cannot be reduced here and are reported as too large to read.
export function imageCopy(bytes: Uint8Array, mediaType: string): PageImage | { problem: string } {
 const size = dimensions(bytes, mediaType)
 if (!size) return { problem: 'The image header could not be read.' }
 if (bytes.length <= DIRECT && Math.max(size.width, size.height) <= 8000 && mediaType !== 'image/jpeg') return { mediaType: mediaType as PageImage['mediaType'], bytes, ...size }
 if (mediaType === 'image/jpeg') {
  if (bytes.length <= DIRECT && Math.max(size.width, size.height) <= LONG) return { mediaType: 'image/jpeg', bytes, ...size }
  const r = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 96 })
  return jpeg({ width: r.width, height: r.height, channels: 4, data: r.data })
 }
 return { problem: `This ${mediaType.slice(6).toUpperCase()} image is too large to read (${Math.round(bytes.length / 1e6)} MB, ${size.width}×${size.height}). PNG, WebP and GIF images up to 4.5 MB and 8000 pixels are read.` }
}
