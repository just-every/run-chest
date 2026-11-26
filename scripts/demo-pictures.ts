import jpeg from 'jpeg-js'
import { zipSync, strToU8 } from 'fflate'
import type { Plugin } from 'vite'
// Real pictures for the demo's originals, so their sizes read like a working folder's: a page scanned at 100 dpi
// (paper grain and lines of type), a phone or product photo, and the preview picture Office saves inside a file.
// Every pixel comes from a seeded generator, so a seed always makes the same bytes.
const random = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296

function encode(width: number, height: number, quality: number, pixel: (x: number, y: number, r: () => number) => [number, number, number], seed: number) {
 const r = random(seed), data = new Uint8Array(width * height * 4)
 for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [red, green, blue] = pixel(x, y, r); data.set([red, green, blue, 255], (y * width + x) * 4) }
 return new Uint8Array(jpeg.encode({ data, width, height }, quality).data)
}
/** A scanned letter-size page: off-white paper with grain, and with `type` rows of dark type between the margins (a
 * PDF draws its own text over a blank scan). */
const scan = (seed: number, width = 850, height = 1100, type = false) => encode(width, height, 72, (x, y, r) => {
 const margin = width / 12, line = type && y % 22 < 9 && y > height / 12 && y < height - height / 9 && x > margin && x < width - margin && ((x >> 4) + (y >> 5) + seed) % 9 !== 0
 const v = 236 + (x * 7 + y * 3) % 5 + r() * 14 - 7 - (line ? (r() < 0.45 ? 120 : 20) : 0)
 return [v + 2, v + 1, v - 4]
}, seed)
/** A photo: soft light across the frame with sensor noise. */
const photo = (seed: number, width: number, height: number) => encode(width, height, 82, (x, y, r) => {
 const n = r() * 30 - 15
 return [150 + 70 * Math.sin(x / 90 + seed) + n, 140 + 55 * Math.cos(y / 70 + seed / 2) + n, 125 + 45 * Math.sin((x + y) / 120) + n]
}, seed)

const fileName = 'chest-demo-pictures.zip'

function packPictures() {
 const files: Record<string, Uint8Array> = {}
 for (const seed of [4, 6, 7, 8, 9, 11, 12, 13, 20, 30, 31, 32, 33]) files[`scan-${seed}.jpg`] = scan(seed)
 for (const seed of [1, 2, 3]) files[`thumbnail-${seed}.jpg`] = scan(seed, 256, 331, true)
 files['receipt.jpg'] = photo(3, 1512, 2016)
 // Pin ZIP metadata so the same inputs give the same sample original on every build.
 const mtime = new Date(2026, 0, 1)
 files['product-photos.zip'] = zipSync({
  'Q4 photos/stretch-film.jpg': photo(7, 2016, 1512),
  'Q4 photos/labels.jpg': photo(11, 2016, 1512),
  'Q4 photos/corner-boards.jpg': photo(13, 2016, 1512),
  'Q4 photos/README.txt': strToU8('Acme Supply product photos for the Q4 catalog.\n'),
 }, { mtime })
 return zipSync(files, { level: 0, mtime })
}

export function demoPictures(): Plugin {
 let pictures: Uint8Array | undefined
 return {
  name: 'chest-demo-pictures',
  configureServer(server) {
   server.middlewares.use('/' + fileName, (_request, response) => {
    response.setHeader('content-type', 'application/zip')
    response.end(pictures ??= packPictures())
   })
  },
  generateBundle() {
   if (this.environment.name === 'client') this.emitFile({ type: 'asset', fileName, source: packPictures() })
  },
 }
}
