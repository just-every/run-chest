import { encode, once } from './demo-media'
import { ink, raster } from './demo-font'
// The demo's photographs, drawn so they read as photographs: a receipt photographed on a desk, and three product
// pictures on a studio floor. Every pixel is a function of its place and a seeded generator, so a seed always makes
// the same bytes. Light, shadow and a little sensor grain do the work; there is no field of colour noise.
type Rgb = [number, number, number]
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const shade = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k]
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/** Signed distance to a rounded box centred on (cx, cy), negative inside. */
const box = (x: number, y: number, cx: number, cy: number, hw: number, hh: number, r = 0) => { const dx = Math.abs(x - cx) - hw + r, dy = Math.abs(y - cy) - hh + r; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r }
const clamp = (v: number) => Math.min(255, Math.max(0, v))
const coverage = (d: number) => 1 - smooth(-1, 1, d)

const wide = 30
const split = (left: string, right: string) => ({ text: left + ' '.repeat(wide - left.length - right.length) + right, align: 'left' as const })
const rule = { text: '-'.repeat(wide) }
const receiptLines = [
 { text: 'ACME SUPPLY CO.', scale: 2 }, { text: '1200 DOCK ST, TACOMA WA' }, { text: '(253) 555-0142' }, { text: '' },
 split('OCT 14 2026', '10:42 AM'), split('ORDER 4471', 'CASHIER 03'), rule,
 split('STRETCH FILM 18 IN', ''), split('  2 X 24.50', '49.00'), split('THERMAL LABELS 4X6', ''), split('  1 X 38.00', '38.00'),
 split('CORNER BOARDS', ''), split('  4 X 15.75', '63.00'), split('PACKING TAPE 2 IN', ''), split('  6 X 4.25', '25.50'), rule,
 split('SUBTOTAL', '175.50'), split('TAX 10.25%', '17.99'), split('TOTAL', '$193.49'), rule,
 split('VISA ****4417', ''), split('AUTH 081532', 'APPROVED'), { text: '' },
 { text: 'THANK YOU FOR SHOPPING' }, { text: 'WITH ACME SUPPLY' },
]
/** A receipt on a wooden desk: warm light from the upper left, the paper a little turned, torn at both ends, with a soft shadow. */
export const receiptPhoto = (seed: number, width: number, height: number) => once(`receipt ${seed} ${width}x${height}`, () => {
 const text = raster(receiptLines, wide), cell = width / 380, angle = -0.04, cos = Math.cos(angle), sin = Math.sin(angle)
 const halfW = width * 0.27, halfH = height * 0.4, cx = width * 0.5, cy = height * 0.5
 const textLeft = -text.width * cell / 2, textTop = -text.height * cell / 2 - cell * 6
 return encode(width, height, 84, (x, y, r) => {
  const grain = (r() - 0.5) * 5
  // The desk: dark oak with long grain, lit from the upper left, darker toward the corners.
  const grainLine = Math.sin(y / 11 + Math.sin(x / 210) * 3 + Math.sin(x / 37) * 0.4) * 0.5 + Math.sin(y / 3.7 + x / 400) * 0.25
  const light = 1.08 - 0.5 * Math.hypot((x - width * 0.3) / width, (y - height * 0.25) / height)
  let color = shade([104 + grainLine * 9, 80 + grainLine * 7, 58 + grainLine * 5], light)
  // The paper, in its own coordinates.
  const dx = x - cx, dy = y - cy, u = dx * cos + dy * sin, v = -dx * sin + dy * cos
  const tear = Math.sin(u / 9) * 5 + Math.sin(u / 3.3 + seed) * 2.5
  const outside = Math.max(Math.abs(u) - halfW, Math.abs(v) - halfH + (v < 0 ? tear : -tear))
  const shadow = Math.exp(-Math.max(0, Math.max(Math.abs(u - 26) - halfW, Math.abs(v - 34) - halfH)) / 26) * 0.55
  color = shade(color, 1 - shadow * (outside > 0 ? 1 : 0))
  if (outside < 1) {
   const curl = 1 - 0.07 * Math.pow(Math.abs(u) / halfW, 3) - 0.05 * Math.sin(v / 230 + 1.2)
   let paper: Rgb = shade([246, 243, 235], curl * (1.04 - 0.1 * (y / height)))
   const px = (u - textLeft) / cell, py = (v - textTop) / cell
   const strength = ink(text, px, py) * 0.86
   paper = mix(paper, [34, 33, 40], strength)
   color = mix(color, paper, coverage(outside))
  }
  return [clamp(color[0] + grain), clamp(color[1] + grain), clamp(color[2] + grain)]
 }, seed)
})

type Scene = (x: number, y: number, width: number, height: number) => Rgb
// A studio floor: a pale wall and floor meeting a little below the middle, lit from the left.
const studio = (x: number, y: number, width: number, height: number): Rgb => {
 const horizon = height * 0.66, wall = mix([226, 228, 230], [200, 204, 208], y / horizon), floor = mix([188, 186, 182], [150, 148, 144], (y - horizon) / (height - horizon))
 const base = mix(wall, floor, smooth(-3, 3, y - horizon))
 return shade(base, 1.06 - 0.38 * Math.hypot((x - width * 0.3) / width, (y - height * 0.3) / height))
}
const cylinderShade = (n: number) => 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - n * n)) + 0.18 * Math.exp(-Math.pow((n + 0.45) / 0.14, 2))
/** Three rolls of stretch film: clear wrap with a cardboard core showing in the top. */
const films: Scene = (x, y, width, height) => {
 let color = studio(x, y, width, height)
 const rolls = [[0.3, 0.7, 0.13, 0.36], [0.55, 0.72, 0.15, 0.42], [0.8, 0.69, 0.12, 0.3]]
 for (const [fx, fy, fr, fh] of rolls) {
  const cx = fx * width, bottom = fy * height, r = fr * width, h = fh * height, top = bottom - h, rim = r * 0.3
  color = shade(color, 1 - 0.5 * Math.exp(-Math.max(0, Math.hypot((x - cx - r * 0.5) / (r * 1.5), (y - bottom) / (rim * 1.2)) - 0.9) * 3) * (y > bottom - rim ? 1 : 0))
  const inBody = Math.abs(x - cx) < r && y > top && y < bottom + rim * Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / r, 2)))
  if (inBody) { const n = (x - cx) / r, wrap = 1 + Math.sin(y / 3 + n * 6) * 0.015; color = mix(color, shade([214, 229, 238], cylinderShade(n) * wrap), 0.93) }
  const ellipse = Math.pow((x - cx) / r, 2) + Math.pow((y - top) / rim, 2)
  if (ellipse < 1) { color = shade([226, 238, 244], 0.92 + 0.08 * (x - cx) / r); if (Math.pow((x - cx) / (r * 0.34), 2) + Math.pow((y - top) / (rim * 0.34), 2) < 1) color = shade([158, 120, 82], 0.8 + 0.2 * (y - top) / rim) }
 }
 return color
}
/** Cartons of labels, kraft board with a white label and a barcode on each, stacked two over one. */
const cartons: Scene = (x, y, width, height) => {
 let color = studio(x, y, width, height)
 const kraft: Rgb = [196, 156, 108]
 const carton = (cx: number, bottom: number, w: number, h: number) => {
  const left = cx - w / 2, depth = w * 0.22, topY = bottom - h
  color = shade(color, 1 - 0.45 * Math.exp(-Math.max(0, Math.hypot((x - cx - w * 0.15) / (w * 0.75), (y - bottom) / (h * 0.12)) - 1) * 3) * (y > bottom - 4 ? 1 : 0))
  if (x > left && x < left + w && y > topY && y < bottom) {
   color = shade(kraft, 0.97 - 0.09 * (x - left) / w + Math.sin(y / 2.6) * 0.012)
   const lw = w * 0.5, lh = h * 0.42
   if (Math.abs(x - cx) < lw / 2 && Math.abs(y - (topY + h * 0.5)) < lh / 2) {
    const bx = (x - (cx - lw / 2)) / lw, by = (y - (topY + h * 0.5 - lh / 2)) / lh
    color = [244, 244, 240]
    if (by > 0.5 && by < 0.88 && bx > 0.1 && bx < 0.9 && Math.sin(Math.floor(bx * 70) * 12.9898) > -0.15 && Math.floor(bx * 70) % 3 !== 0) color = [26, 26, 30]
    if ((by > 0.12 && by < 0.22 && bx > 0.1 && bx < 0.8) || (by > 0.28 && by < 0.34 && bx > 0.1 && bx < 0.55)) color = [60, 62, 74]
   }
   if (Math.abs(y - (topY + h * 0.07)) < 1.5) color = shade(color, 0.85)
  } else if (y <= topY && y > topY - depth && x > left + (topY - y) * 0.8 && x < left + w + (topY - y) * 0.8) color = shade(kraft, 1.1 - 0.12 * (topY - y) / depth)
  else if (x >= left + w && x < left + w + (bottom - y) * 0 + depth * 0.8 && y > topY - depth * (1 - (x - left - w) / (depth * 0.8)) && y < bottom - depth * ((x - left - w) / (depth * 0.8)) * 0) color = shade(kraft, 0.72)
 }
 carton(width * 0.34, height * 0.74, width * 0.3, height * 0.26)
 carton(width * 0.66, height * 0.74, width * 0.3, height * 0.26)
 carton(width * 0.5, height * 0.74 - height * 0.26 - height * 0.01, width * 0.3, height * 0.26)
 return color
}
/** A bundle of corner boards (folded cardboard strips) held with two blue straps. */
const boards: Scene = (x, y, width, height) => {
 let color = studio(x, y, width, height)
 const cx = width * 0.5, cy = height * 0.55, hw = width * 0.34, hh = height * 0.14
 color = shade(color, 1 - 0.5 * Math.exp(-Math.max(0, box(x, y, cx + 20, cy + hh + 12, hw, 14, 8)) / 24))
 const d = box(x, y, cx, cy, hw, hh, 6)
 if (d < 1) {
  const row = (y - (cy - hh)) / (hh * 2), strip = Math.floor(row * 9), local = row * 9 - strip
  let kraft = shade([190, 150, 104], 0.85 + 0.15 * Math.sin(strip * 2.3 + 1) * 0.5 + 0.15 * (1 - local) - 0.06 * (x - cx) / hw)
  if (local < 0.08) kraft = shade(kraft, 0.62)
  for (const strapX of [cx - hw * 0.5, cx + hw * 0.5]) if (Math.abs(x - strapX) < 14) kraft = mix(shade([36, 82, 160], 0.85 + 0.15 * Math.cos((x - strapX) / 14 * 1.4)), kraft, 0)
  color = mix(color, kraft, coverage(d))
 }
 return color
}
export const scenes = { films, cartons, boards }
export const productPhoto = (scene: keyof typeof scenes, seed: number, width: number, height: number) => once(`product ${scene} ${seed} ${width}x${height}`, () => {
 const draw = scenes[scene]
 return encode(width, height, 84, (x, y, r) => { const [red, green, blue] = draw(x, y, width, height), grain = (r() - 0.5) * 5; return [clamp(red + grain), clamp(green + grain), clamp(blue + grain)] }, seed)
})
