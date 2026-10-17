import { Inflate, zipSync, strFromU8 } from 'fflate/browser'

// Bound inflation before handing any data to the ZIP/XML libraries. ZIP64 and
// encrypted archives are deliberately refused rather than partially displayed.
const MAX_ARCHIVE = 32 * 1024 * 1024
const MAX_TOTAL = 64 * 1024 * 1024
const MAX_PART = 16 * 1024 * 1024
type Entry = { name: string; offset: number; central: Uint8Array; end: number; data: number; compressed: number; length: number; method: number; crc: number }
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ byte >>> 1 : byte >>> 1
  return byte >>> 0
})
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8
  return (crc ^ 0xffffffff) >>> 0
}

export class OfficeArchive {
  private entries: Entry[] = []
  private parts: Record<string, Uint8Array>
  private endRecord: Uint8Array
  constructor(private bytes: Uint8Array) {
    if (bytes.length > MAX_ARCHIVE) throw new Error('Office archive exceeds the 32 MB preview limit')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const u16 = (at: number) => view.getUint16(at, true)
    const u32 = (at: number) => view.getUint32(at, true)
    let end = bytes.length - 22
    for (; end >= Math.max(0, bytes.length - 65557); end--) {
      if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
    }
    if (end < 0 || end < bytes.length - 65557) throw new Error('Malformed Office ZIP directory')
    const count = u16(end + 10), start = u32(end + 16), size = u32(end + 12)
    if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 65535 || start === 0xffffffff || start + size !== end) {
      throw new Error('Multi-volume and ZIP64 Office archives are unsupported')
    }
    if (!count || count > 2000) throw new Error('Office archive exceeds the 2,000-part limit')
    let at = start, total = 0
    const names = new Set<string>()
    for (let index = 0; index < count; index++) {
      if (at + 46 > end || u32(at) !== 0x02014b50) throw new Error('Malformed Office ZIP entry')
      const flags = u16(at + 8), method = u16(at + 10), compressed = u32(at + 20), length = u32(at + 24)
      const nameSize = u16(at + 28), extraSize = u16(at + 30), commentSize = u16(at + 32)
      const next = at + 46 + nameSize + extraSize + commentSize, offset = u32(at + 42)
      if (next > end || flags & 1 || ![0, 8].includes(method) || u16(at + 34) || length > MAX_PART || compressed > MAX_ARCHIVE) throw new Error('Unsupported or oversized Office ZIP entry')
      total += length
      if (total > MAX_TOTAL) throw new Error('Office archive exceeds the 64 MB expanded limit')
      const name = strFromU8(bytes.subarray(at + 46, at + 46 + nameSize), !(flags & 2048))
      if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some(piece => ['..', '.', '__proto__'].includes(piece)) || /[\x00-\x1f]/.test(name) || names.has(name)) throw new Error('Unsafe or duplicate Office ZIP path')
      names.add(name)
      for (let extra = at + 46 + nameSize; extra < at + 46 + nameSize + extraSize;) {
        if (extra + 4 > next || u16(extra) === 1) throw new Error('Unsupported Office ZIP extra field')
        extra += 4 + u16(extra + 2)
        if (extra > at + 46 + nameSize + extraSize) throw new Error('Malformed Office ZIP extra field')
      }
      if (offset + 30 > start || u32(offset) !== 0x04034b50 || u16(offset + 6) !== flags || u16(offset + 8) !== method) throw new Error('Malformed Office ZIP local entry')
      const localName = u16(offset + 26), localExtra = u16(offset + 28)
      if (localName !== nameSize || offset + 30 + localName + localExtra + compressed > start) throw new Error('Malformed Office ZIP entry bounds')
      if (!bytes.subarray(offset + 30, offset + 30 + localName).every((value, i) => value === bytes[at + 46 + i])) throw new Error('Conflicting Office ZIP filenames')
      const data = offset + 30 + localName + localExtra
      this.entries.push({ name, offset, central: bytes.slice(at, next), end: data + compressed, data, compressed, length, method, crc: u32(at + 16) })
      at = next
    }
    if (at !== end) throw new Error('Malformed Office ZIP directory length')
    const ordered = [...this.entries].sort((a, b) => a.offset - b.offset)
    for (let i = 0; i < ordered.length; i++) {
      const entry = ordered[i], next = ordered[i + 1]?.offset ?? start
      if (entry.end > next || (i === 0 && entry.offset !== 0)) throw new Error('Overlapping Office ZIP entries')
      entry.end = next
    }
    this.endRecord = bytes.slice(end)
    this.parts = Object.create(null) as Record<string, Uint8Array>
    for (const entry of this.entries) {
      const compressed = bytes.subarray(entry.data, entry.data + entry.compressed)
      let expanded: Uint8Array
      if (entry.method === 0) {
        if (entry.length !== entry.compressed) throw new Error('Office ZIP stored length mismatch')
        expanded = compressed
      } else {
        expanded = new Uint8Array(entry.length)
        let produced = 0
        const inflater = new Inflate(chunk => {
          if (produced + chunk.length > entry.length) throw new Error('Office ZIP exceeds its declared expanded size')
          expanded.set(chunk, produced)
          produced += chunk.length
        })
        try {
          // Small input chunks bound even dishonestly declared deflate streams.
          for (let cursor = 0; cursor < compressed.length; cursor += 4096) inflater.push(compressed.subarray(cursor, cursor + 4096), cursor + 4096 >= compressed.length)
        } catch { throw new Error('Office ZIP decompression failed or exceeded its declared size') }
        if (produced !== entry.length) throw new Error('Office ZIP expanded length mismatch')
      }
      if (crc32(expanded) !== entry.crc) throw new Error('Office ZIP checksum mismatch')
      this.parts[entry.name] = expanded
    }
  }
  has(name: string) { return Object.hasOwn(this.parts, name) }
  get(name: string) {
    if (!this.has(name)) throw new Error(`Missing Office part: ${name}`)
    return this.parts[name]
  }
  // Untouched local records and central metadata are copied verbatim, including
  // their original compression, timestamps, extra fields and data descriptors.
  replace(changes: Map<string, Uint8Array>): Uint8Array {
    if (!changes.size) return this.bytes.slice()
    for (const name of changes.keys()) if (!this.has(name)) throw new Error('Cannot add an unknown Office part')
    const local: Uint8Array[] = [], directories = new Map<string, Uint8Array>()
    let offset = 0
    for (const entry of [...this.entries].sort((a, b) => a.offset - b.offset)) {
      let record = this.bytes.subarray(entry.offset, entry.end), central = entry.central.slice()
      if (changes.has(entry.name)) {
        const updated = changes.get(entry.name)!
        if (updated.length > MAX_PART) throw new Error('Edited Office part exceeds the 16 MB limit')
        const packed = zipSync({ [entry.name]: updated }, { level: 6 })
        const packedView = new DataView(packed.buffer, packed.byteOffset, packed.byteLength)
        const centralAt = packedView.getUint32(packed.length - 6, true)
        record = packed.subarray(0, centralAt)
        central = packed.slice(centralAt, packed.length - 22)
      }
      new DataView(central.buffer, central.byteOffset, central.byteLength).setUint32(42, offset, true)
      directories.set(entry.name, central)
      local.push(record)
      offset += record.length
    }
    const directory = this.entries.map(entry => directories.get(entry.name)!)
    const directorySize = directory.reduce((sum, item) => sum + item.length, 0)
    const end = this.endRecord.slice(), view = new DataView(end.buffer)
    view.setUint32(12, directorySize, true)
    view.setUint32(16, offset, true)
    const result = new Uint8Array(offset + directorySize + end.length)
    let cursor = 0
    for (const part of [...local, ...directory, end]) { result.set(part, cursor); cursor += part.length }
    if (result.length > MAX_ARCHIVE) throw new Error('Edited Office archive exceeds the 32 MB limit')
    return result
  }
}
