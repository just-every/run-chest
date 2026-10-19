import jpeg from 'jpeg-js'
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate'
// Real pictures for the demo's originals, so their sizes read like a working folder's: a page scanned at 100 dpi
// (paper grain and lines of type), a phone or product photo, and the preview picture Office saves inside a file.
// Every pixel comes from a seeded generator, so a seed always makes the same bytes.
const random = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
const made = new Map<string, Uint8Array>()
const once = (key: string, draw: () => Uint8Array) => made.get(key) ?? made.set(key, draw()).get(key)!

function encode(width: number, height: number, quality: number, pixel: (x: number, y: number, r: () => number) => [number, number, number], seed: number) {
 const r = random(seed), data = new Uint8Array(width * height * 4)
 for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [red, green, blue] = pixel(x, y, r); data.set([red, green, blue, 255], (y * width + x) * 4) }
 return new Uint8Array(jpeg.encode({ data, width, height }, quality).data)
}
/** A scanned letter-size page: off-white paper with grain, and with `type` rows of dark type between the margins (a
 * PDF draws its own text over a blank scan). */
export const scan = (seed: number, width = 850, height = 1100, type = false) => once(`scan ${seed} ${width} ${type}`, () => encode(width, height, 72, (x, y, r) => {
 const margin = width / 12, line = type && y % 22 < 9 && y > height / 12 && y < height - height / 9 && x > margin && x < width - margin && ((x >> 4) + (y >> 5) + seed) % 9 !== 0
 const v = 236 + (x * 7 + y * 3) % 5 + r() * 14 - 7 - (line ? (r() < 0.45 ? 120 : 20) : 0)
 return [v + 2, v + 1, v - 4]
}, seed))
/** A photo: soft light across the frame with sensor noise. */
export const photo = (seed: number, width: number, height: number) => once(`photo ${seed} ${width}x${height}`, () => encode(width, height, 82, (x, y, r) => {
 const n = r() * 30 - 15
 return [150 + 70 * Math.sin(x / 90 + seed) + n, 140 + 55 * Math.cos(y / 70 + seed / 2) + n, 125 + 45 * Math.sin((x + y) / 120) + n]
}, seed))
/** An Office file with the preview picture Word, Excel and PowerPoint save (docProps/thumbnail.jpeg). */
export function withThumbnail(office: Uint8Array, seed: number) {
 const parts = unzipSync(office), thumbnail = scan(seed, 256, 331, true)
 parts['docProps/thumbnail.jpeg'] = thumbnail
 parts['_rels/.rels'] = strToU8(strFromU8(parts['_rels/.rels']).replace('</Relationships>', '<Relationship Id="rIdThumbnail" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>'))
 const types = strFromU8(parts['[Content_Types].xml'])
 if (!types.includes('Extension="jpeg"')) parts['[Content_Types].xml'] = strToU8(types.replace(/(<Types[^>]*>)/, '$1<Default Extension="jpeg" ContentType="image/jpeg"/>'))
 return zipSync(parts)
}
