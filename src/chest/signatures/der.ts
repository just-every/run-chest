// Minimal ASN.1 DER writer and reader, enough for X.509 certificates and CMS SignedData (RFC 5652, RFC 5280).
export type Node = { tag: number; start: number; header: number; end: number; bytes: Uint8Array }
const concat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length } return out }
const length = (n: number) => n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, n >> 8 & 255, n & 255]
export const tlv = (tag: number, ...parts: Uint8Array[]) => { const body = concat(parts); return concat([Uint8Array.from([tag, ...length(body.length)]), body]) }
export const seq = (...parts: Uint8Array[]) => tlv(0x30, ...parts)
export const set = (...parts: Uint8Array[]) => tlv(0x31, ...parts)
export const octets = (bytes: Uint8Array) => tlv(0x04, bytes)
export const explicit = (n: number, ...parts: Uint8Array[]) => tlv(0xa0 + n, ...parts)
export const nul = () => Uint8Array.from([5, 0])
export function integer(value: Uint8Array | number) {
 let bytes = typeof value === 'number' ? Uint8Array.from(value.toString(16).padStart(Math.ceil(value.toString(16).length / 2) * 2, '0').match(/../g)!.map(h => parseInt(h, 16))) : value
 let start = 0; while (start < bytes.length - 1 && bytes[start] === 0) start++
 bytes = bytes.slice(start)
 return tlv(2, bytes[0] & 128 ? concat([Uint8Array.of(0), bytes]) : bytes)
}
export function oid(dotted: string) {
 const parts = dotted.split('.').map(Number), body = [parts[0] * 40 + parts[1]]
 for (const part of parts.slice(2)) { const piece = [part & 127]; for (let rest = part >> 7; rest; rest >>= 7) piece.unshift(rest & 127 | 128); body.push(...piece) }
 return tlv(6, Uint8Array.from(body))
}
export const utf8 = (text: string) => tlv(0x0c, new TextEncoder().encode(text))
export const time = (at: Date) => { const p = (n: number) => String(n).padStart(2, '0'), y = at.getUTCFullYear(), body = `${p(y % 100)}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}Z`; return tlv(y < 2050 ? 0x17 : 0x18, new TextEncoder().encode(y < 2050 ? body : `${y}${body.slice(2)}`)) }
export const bits = (bytes: Uint8Array) => tlv(3, Uint8Array.of(0), bytes)
export const bool = (v: boolean) => tlv(1, Uint8Array.of(v ? 255 : 0))
// DER SET OF members sort by their encodings.
export const setOf = (members: Uint8Array[]) => set(...[...members].sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length }))
export function read(bytes: Uint8Array, at = 0, limit = bytes.length): Node {
 if (at + 2 > limit) throw new Error('der_truncated')
 const tag = bytes[at]; let n = bytes[at + 1], header = 2
 if (n & 128) { const count = n & 127; if (!count || count > 3 || at + 2 + count > limit) throw new Error('der_length'); n = 0; for (let i = 0; i < count; i++) n = n * 256 + bytes[at + 2 + i]; header = 2 + count }
 if (at + header + n > limit) throw new Error('der_truncated')
 return { tag, start: at, header, end: at + header + n, bytes: bytes.subarray(at, at + header + n) }
}
export const body = (node: Node) => node.bytes.subarray(node.header)
export function kids(node: Node): Node[] { const out: Node[] = [], inner = body(node); for (let at = 0; at < inner.length;) { const child = read(inner, at); out.push({ ...child, start: node.start + node.header + child.start, end: node.start + node.header + child.end }); at = child.end } return out }
export function dotted(node: Node) { const b = body(node), parts = [Math.floor(b[0] / 40), b[0] % 40]; for (let i = 1, v = 0; i < b.length; i++) { v = v * 128 + (b[i] & 127); if (!(b[i] & 128)) { parts.push(v); v = 0 } } return parts.join('.') }
export const joined = concat
