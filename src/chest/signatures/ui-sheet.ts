import { esc } from '../ui-shared'
// A readable stand-in for the PDF page: its text laid out where the PDF puts it, with the fields over it. The same
// sheet places fields for the requester and shows each signer exactly where they sign.
export type Span = { t: string; x: number; y: number; w: number; h: number }
export function sheets(pages: { w: number; h: number }[], text: Span[][], overlay: (page: number) => string, attrs = '') {
 return `<link rel="stylesheet" href="/chest-sign.css"><div class="sign-pages" ${attrs}>${pages.map((p, i) => `<div class="sheet-box"><p class="sheet-label">Page ${i + 1} of ${pages.length}</p><div class="sheet-frame"><div class="sheet" data-sheet="${i + 1}" data-width="${p.w}" data-height="${p.h}" style="--w:${p.w};aspect-ratio:${p.w}/${p.h}">${(text[i] ?? []).map(s => `<span class="sheet-text" style="left:${(s.x * 100).toFixed(2)}%;top:${(s.y * 100).toFixed(2)}%;font-size:calc(var(--s)*${(s.h * p.h * .9).toFixed(1)})">${esc(s.t)}</span>`).join('')}${overlay(i + 1)}</div></div></div>`).join('')}</div>`
}
export const box = (f: { id: string; x: number; y: number; w: number; h: number }, label: string, cls = '') => `<div class="sfield ${cls}" data-field="${esc(f.id)}" style="left:${(f.x * 100).toFixed(2)}%;top:${(f.y * 100).toFixed(2)}%;width:${(f.w * 100).toFixed(2)}%;height:${(f.h * 100).toFixed(2)}%"><span>${esc(label)}</span></div>`
