// A 5x7 pixel face for the printing in the demo's pictures (a receipt's lines, a carton's label): each glyph is seven
// rows of five bits. Only the characters those pictures use are drawn; anything else prints as a blank.
const glyphs: Record<string, string> = {
 A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
 D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
 G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
 J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
 M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
 P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
 S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
 V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
 Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
 0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
 3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
 6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
 9: '01110 10001 10001 01111 00001 00010 01100',
 '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000', ':': '00000 01100 01100 00000 01100 01100 00000',
 '-': '00000 00000 00000 11111 00000 00000 00000', $: '00100 01111 10100 01110 00101 11110 00100', '%': '11000 11001 00010 00100 01000 10011 00011',
 '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000', '*': '00000 00100 10101 01110 10101 00100 00000',
 '/': '00001 00001 00010 00100 01000 10000 10000', '#': '01010 01010 11111 01010 11111 01010 01010',
}
const rows = (ch: string) => (glyphs[ch] ?? '00000 00000 00000 00000 00000 00000 00000').split(' ')
export const cellsWide = 6
export const cellsHigh = 7
/** A grid of lit cells (1 or 0) holding `lines` of text, `scale` cells per glyph cell, each line centred, left or right
 * aligned in `columns` characters, with `gap` blank cells between lines. */
export function raster(lines: { text: string; scale?: number; align?: 'left' | 'center' | 'right' }[], columns: number, gap = 4) {
 const width = columns * cellsWide, tall = lines.map(l => cellsHigh * (l.scale ?? 1) + gap), height = tall.reduce((a, b) => a + b, 0)
 const grid = new Uint8Array(width * height)
 let top = 0
 lines.forEach((line, index) => {
  const scale = line.scale ?? 1, text = line.text.toUpperCase(), used = text.length * cellsWide * scale
  const left = line.align === 'right' ? width - used : line.align === 'left' ? 0 : Math.max(0, Math.floor((width - used) / 2))
  for (const [i, ch] of [...text].entries()) rows(ch).forEach((row, y) => [...row].forEach((bit, x) => {
   if (bit !== '1') return
   for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const gx = left + (i * cellsWide + x) * scale + dx, gy = top + y * scale + dy; if (gx < width) grid[gy * width + gx] = 1 }
  }))
  top += tall[index]
 })
 return { grid, width, height }
}
/** Ink at a point of a raster, in cells: the lit cells blended between their centres so edges are soft, not blocks. */
export function ink(r: { grid: Uint8Array; width: number; height: number }, x: number, y: number) {
 const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
 const at = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= r.width || cy >= r.height ? 0 : r.grid[cy * r.width + cx]
 const c = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
 const t = Math.min(1, Math.max(0, (c - 0.3) / 0.4))
 return t * t * (3 - 2 * t)
}
