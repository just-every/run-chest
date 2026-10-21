import { esc } from '../ui-shared'
// A readable stand-in for the PDF page: its text laid out where the PDF puts it, with the fields over it. The same
// sheet places fields for the requester and shows each signer exactly where they sign. It is SVG in page points, so
// positions need no inline style (the pages' CSP allows none) and scale with the width.
export type Span = { t: string; x: number; y: number; w: number; h: number }
export function sheets(pages: { w: number; h: number }[], text: Span[][], overlay: (page: number, size: { w: number; h: number }) => string, attrs = '') {
 return `<link rel="stylesheet" href="/chest-sign.css"><div class="sign-pages" ${attrs}>${pages.map((p, i) => `<div class="sheet-box"><p class="sheet-label">Page ${i + 1} of ${pages.length}</p><svg class="sheet" data-sheet="${i + 1}" data-width="${p.w}" data-height="${p.h}" viewBox="0 0 ${p.w} ${p.h}" role="img" aria-label="Page ${i + 1} text and signature fields"><rect class="sheet-paper" width="${p.w}" height="${p.h}"/>${(text[i] ?? []).map(s => `<text class="sheet-text" x="${(s.x * p.w).toFixed(1)}" y="${((s.y + s.h) * p.h).toFixed(1)}" font-size="${Math.max(3, s.h * p.h).toFixed(1)}">${esc(s.t)}</text>`).join('')}${overlay(i + 1, p)}</svg></div>`).join('')}</div>`
}
export const box = (f: { id: string; x: number; y: number; w: number; h: number }, label: string, cls: string, size: { w: number; h: number }) => `<g class="sfield ${cls}" data-field="${esc(f.id)}"><rect x="${(f.x * size.w).toFixed(1)}" y="${(f.y * size.h).toFixed(1)}" width="${(f.w * size.w).toFixed(1)}" height="${(f.h * size.h).toFixed(1)}"/><text x="${((f.x + f.w / 2) * size.w).toFixed(1)}" y="${((f.y + f.h / 2) * size.h).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="9">${esc(label)}</text></g>`
