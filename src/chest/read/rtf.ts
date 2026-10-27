import { Buffer } from 'node:buffer'
import { getDecoder, encodingExists } from 'iconv-lite'
// Native RTF text reading never executes fields, links, pictures or embedded objects.
// Offsets in failures refer to original bytes; truncation refers to decoded UTF-16 characters.
export const RTF_PARSER = 'chest:rtf-text:1'
export const isRtf = (bytes: Uint8Array) => /^\{\\rtf(?=\d|[^a-z]|$)/.test(String.fromCharCode(...bytes.subarray(0, 32)))
export class RtfProblem extends Error {
 constructor(message: string, public offset: number) { super(`${message} At byte ${offset}.`) }
}
type State = { skip: boolean; hidden: boolean; uc: number; encoding: string; font: number; table: boolean; definition: number; starred: boolean; upr: number }
const destinations = new Set('fonttbl colortbl stylesheet info pict object objdata objclass objname datastore datafield filetbl listtable listoverridetable rsidtbl generator xmlnstbl colorschememapping latentstyles themedata headerfooter htmltag mhtmltag fldinst pn fontemb fontfile annotation atnauthor atndate'.split(' '))
const charsets: Record<number, string> = { 77: 'macintosh', 128: 'shift_jis', 129: 'euc-kr', 134: 'gbk', 136: 'big5', 161: 'windows-1253', 162: 'windows-1254', 163: 'windows-1258', 177: 'windows-1255', 178: 'windows-1256', 186: 'windows-1257', 204: 'windows-1251', 222: 'windows-874', 238: 'windows-1250', 255: 'ibm866' }
const codePage = (n: number) => ({ 65001: 'utf-8', 10000: 'macintosh', 437: 'cp437', 850: 'cp850', 932: 'shift_jis', 936: 'gbk', 949: 'euc-kr', 950: 'big5' } as Record<number, string>)[n] || `windows-${n}`
const symbols: Record<string, string> = { par: '\n', line: '\n', tab: '\t', cell: '\t', row: '\n', page: '\n', sect: '\n', emdash: '—', endash: '–', bullet: '•', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', enspace: ' ', emspace: ' ', qmspace: ' ' }
export function rtfText(bytes: Uint8Array, limit: number) {
 if (!isRtf(bytes)) throw new RtfProblem('This is not an RTF document.', 0)
 const stack: State[] = [], fonts = new Map<number, string>(), parts: string[] = []
 let decoder: ReturnType<typeof getDecoder> | TextDecoder | null = null
 let s: State = { skip: false, hidden: false, uc: 1, encoding: 'windows-1252', font: 0, table: false, definition: 0, starred: false, upr: 0 }, at = 0, count = 0, kept = 0, fallback = 0, pending: number[] = [], pendingAt = 0, rootClosed = false, defaultFont = 0
 const fail = (message: string, offset = at): never => { throw new RtfProblem(message, offset) }
 const emit = (text: string) => {
  if (s.skip || s.hidden) return
  count += text.length
  if (kept < limit) { const part = text.slice(0, limit - kept); parts.push(part); kept += part.length }
 }
 const flush = (final = true) => {
  if (!pending.length && !decoder) return
  if (!s.skip && !s.hidden) {
   const encoding = fonts.get(s.font) || s.encoding
   try {
    if (!decoder) {
     if (!encodingExists(encoding)) fail('The RTF character encoding is unsupported.', pendingAt)
     decoder = encoding === 'utf-8' ? new TextDecoder(encoding, { fatal: true }) : getDecoder(encoding)
    }
    let text: string
    if (decoder instanceof TextDecoder) text = decoder.decode(new Uint8Array(pending), { stream: !final })
    else {
     text = decoder.write(Buffer.from(pending)) + (final ? decoder.end() || '' : '')
     if (text.includes('\ufffd')) fail('The RTF character sequence is invalid.', pendingAt)
    }
    emit(text)
   } catch { fail('The RTF character encoding is unsupported or invalid.', pendingAt) }
  }
  pending = []
  if (final) decoder = null
 }
 const byte = (value: number, offset: number) => {
  if (fallback) { fallback--; return }
  if (!pending.length) pendingAt = offset
  pending.push(value)
  // Streaming decoders retain split multibyte sequences across bounded batches.
  if (pending.length >= 4096) flush(false)
 }
 const character = (value: string) => { if (fallback) fallback--; else emit(value) }
 while (at < bytes.length) {
  const start = at, c = bytes[at++]
  if (rootClosed) { if (![9, 10, 13, 32].includes(c)) fail('Unexpected data after the RTF document.', start); continue }
  if (c === 123) {
   flush(); fallback = 0
   if (stack.length >= 256) fail('RTF groups are nested too deeply.', start)
   if (s.upr) s.upr++
   stack.push(s); s = { ...s, starred: false, upr: 0, skip: s.skip || s.upr === 2 }; continue
  }
  if (c === 125) {
   flush(); fallback = 0
   const parent = stack.pop(); if (!parent) fail('Unexpected closing RTF group.', start)
   s = parent!; if (!stack.length) rootClosed = true
   continue
  }
  if (!stack.length) fail('The RTF root group is missing.', start)
  if (c === 10 || c === 13) continue
  if (c !== 92) { if (c < 32 && c !== 9) fail('Invalid control byte in RTF.', start); byte(c, start); continue }
  const next = bytes[at++]
  if (next === undefined) fail('The RTF escape is incomplete.', start)
  if (next === 39) {
   const hex = String.fromCharCode(...bytes.subarray(at, at + 2))
   if (!/^[0-9a-f]{2}$/i.test(hex)) fail('The RTF hexadecimal escape is invalid.', start)
   at += 2; byte(parseInt(hex, 16), start); continue
  }
  flush()
  if (next === 92 || next === 123 || next === 125) { character(String.fromCharCode(next)); continue }
  if (next === 42) { s.starred = true; continue }
  if (next === 126) { character('\u00a0'); continue }
  if (next === 95) { character('\u2011'); continue }
  if (next === 45) { character('\u00ad'); continue }
  if (next === 10 || next === 13) { character('\n'); continue }
  if (!(next >= 65 && next <= 90 || next >= 97 && next <= 122)) fail('The RTF control symbol is unsupported.', start)
  let word = String.fromCharCode(next)
  while (at < bytes.length && /[a-z]/i.test(String.fromCharCode(bytes[at]))) { word += String.fromCharCode(bytes[at++]); if (word.length > 64) fail('The RTF control word is too long.', start) }
  let number = ''
  if (bytes[at] === 45) number += String.fromCharCode(bytes[at++])
  while (at < bytes.length && bytes[at] >= 48 && bytes[at] <= 57) { number += String.fromCharCode(bytes[at++]); if (number.length > 12) fail('The RTF parameter is too large.', start) }
  if (number === '-') fail('The RTF parameter is invalid.', start)
  const n = number ? Number(number) : null
  if (bytes[at] === 32) at++
  if (s.starred) { if (word !== 'ud') s.skip = true; s.starred = false }
  if (destinations.has(word)) s.skip = true
  if (word === 'fonttbl') s.table = true
  if (word === 'bin') {
   if (n === null || n < 0 || n > bytes.length - at) fail('The RTF binary payload is incomplete.', start)
   at += n!; if (fallback) fallback--; continue
  }
  if (word === 'rtf' && n !== 1) fail('This RTF version is unsupported.', start)
  if (word === 'upr') s.upr = 1
  if (word === 'ansicpg') { if (n === null || n <= 0) fail('The RTF code page is invalid.', start); s.encoding = codePage(n!) }
  if (word === 'mac') s.encoding = 'macintosh'
  if (word === 'pc') s.encoding = 'cp437'
  if (word === 'pca') s.encoding = 'cp850'
  if (word === 'deff' && n !== null) { defaultFont = n; s.font = n }
  if (word === 'f' && n !== null) { if (s.table) s.definition = n; else s.font = n }
  if (word === 'fcharset' && n !== null && s.table) [0, 1].includes(n) ? fonts.delete(s.definition) : fonts.set(s.definition, charsets[n] || `unsupported-charset-${n}`)
  if (word === 'cpg' && n !== null && s.table) fonts.set(s.definition, codePage(n))
  if (word === 'v') s.hidden = n !== 0
  if (word === 'plain') { s.hidden = false; s.font = defaultFont }
  if (word === 'uc') { if (n === null || n < 0 || n > 255) fail('The RTF Unicode fallback length is invalid.', start); s.uc = n! }
  if (word === 'u') {
   if (n === null || n < -32768 || n > 65535) fail('The RTF Unicode escape is invalid.', start)
   emit(String.fromCharCode(n! < 0 ? n! + 65536 : n!)); fallback = s.uc
  } else if (word in symbols) character(symbols[word])
 }
 flush()
 if (!rootClosed || stack.length) fail('The RTF document has an unclosed group.', bytes.length)
 return { text: parts.join(''), chars: count, truncatedAt: count > limit ? limit : null }
}
