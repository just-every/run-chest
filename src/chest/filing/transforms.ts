import { Unzip, UnzipInflate, strFromU8 } from 'fflate/browser'
import { ChestError, insist } from '../model'
import { officePreview } from '../office/codec'
import { officeText } from '../read/office'
import { parseXml } from '../office/xml'

type Output = { path: string; bytes: Uint8Array }
type Entry = { path: string; directory: boolean; size: number; compressed: number; crc: number; offset: number; end: number }
const MAX_INPUT = 16 * 1024 * 1024, MAX_EXPANDED = 32 * 1024 * 1024
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
 for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1
 return value >>> 0
})
function crc32(bytes: Uint8Array) {
 let value = 0xffffffff
 for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8
 return (value ^ 0xffffffff) >>> 0
}
function safePath(path: string) {
 insist(path.length > 0 && path.length <= 2048 && !/[\\:\x00-\x1f\x7f-\x9f]/.test(path) && !path.startsWith('/'), 'archive_unsafe_path')
 const directory = path.endsWith('/'), parts = (directory ? path.slice(0, -1) : path).split('/')
 insist(parts.length <= 100 && parts.every(part => part && part !== '.' && part !== '..' && part.length <= 240 && !/[. ]$/.test(part)), 'archive_unsafe_path')
 return { directory, key: parts.map(part => part.normalize('NFC').toLowerCase()).join('/') }
}
// Inspect the complete directory before starting any inflater. Unknown local sizes,
// encryption, ZIP64 and descriptors are refused rather than guessed from the stream.
function inspect(bytes: Uint8Array): Entry[] {
 insist(bytes.length >= 22 && bytes.length <= MAX_INPUT, 'archive_input_limit')
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 const u16 = (at: number) => view.getUint16(at, true), u32 = (at: number) => view.getUint32(at, true)
 let end = bytes.length - 22
 for (; end >= Math.max(0, bytes.length - 65557); end--) if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
 insist(end >= Math.max(0, bytes.length - 65557), 'archive_invalid')
 const count = u16(end + 10), start = u32(end + 16)
 insist(!u16(end + 4) && !u16(end + 6) && u16(end + 8) === count && count !== 65535 && start !== 0xffffffff && start + u32(end + 12) === end, 'archive_format_unsupported')
 insist(count > 0 && count <= 100, 'archive_entry_limit')
 const result: Entry[] = [], names = new Map<string, boolean>(), spellings = new Map<string, string>()
 let at = start, expanded = 0, compressedTotal = 0
 for (let index = 0; index < count; index++) {
  insist(at + 46 <= end && u32(at) === 0x02014b50, 'archive_invalid')
  const flags = u16(at + 8), method = u16(at + 10), compressed = u32(at + 20), size = u32(at + 24), offset = u32(at + 42)
  const nameSize = u16(at + 28), extraSize = u16(at + 30), next = at + 46 + nameSize + extraSize + u16(at + 32)
  insist(next <= end && !(flags & ~0x0806) && !(flags & 8) && [0, 8].includes(method) && !u16(at + 34), 'archive_format_unsupported')
  // Refuse symbolic links and other Unix special files; extraction returns originals only.
  const unixType = u32(at + 38) >>> 16 & 0xf000
  insist(!unixType || unixType === 0x8000 || unixType === 0x4000, 'archive_special_file')
  const path = strFromU8(bytes.subarray(at + 46, at + 46 + nameSize), !(flags & 2048)), safe = safePath(path)
  insist(!names.has(safe.key), 'archive_duplicate_path')
  names.set(safe.key, safe.directory)
  const components = (safe.directory ? path.slice(0, -1) : path).split('/')
  for (let length = 1; length <= components.length; length++) {
   const spelling = components.slice(0, length).join('/'), key = spelling.normalize('NFC').toLowerCase()
   insist(!spellings.has(key) || spellings.get(key) === spelling, 'archive_duplicate_path')
   spellings.set(key, spelling)
  }
  insist(size <= MAX_EXPANDED && compressed <= MAX_INPUT && (size === 0 || compressed > 0 && size <= compressed * 100), 'archive_expansion_limit')
  expanded += size; compressedTotal += compressed
  insist(expanded <= MAX_EXPANDED && expanded <= compressedTotal * 100, 'archive_expansion_limit')
  insist(!safe.directory || size === 0, 'archive_invalid_directory')
  for (let extra = at + 46 + nameSize; extra < at + 46 + nameSize + extraSize;) {
   insist(extra + 4 <= at + 46 + nameSize + extraSize && u16(extra) !== 1, 'archive_format_unsupported')
   extra += 4 + u16(extra + 2)
   insist(extra <= at + 46 + nameSize + extraSize, 'archive_invalid')
  }
  insist(offset + 30 <= start && u32(offset) === 0x04034b50, 'archive_invalid')
  insist(u16(offset + 6) === flags && u16(offset + 8) === method && u32(offset + 14) === u32(at + 16) && u32(offset + 18) === compressed && u32(offset + 22) === size && u16(offset + 26) === nameSize, 'archive_conflicting_header')
  const data = offset + 30 + nameSize + u16(offset + 28)
  insist(data + compressed <= start && bytes.subarray(offset + 30, offset + 30 + nameSize).every((byte, i) => byte === bytes[at + 46 + i]), 'archive_conflicting_header')
  insist(method !== 0 || compressed === size, 'archive_invalid')
  result.push({ path, directory: safe.directory, size, compressed, crc: u32(at + 16), offset, end: data + compressed })
  at = next
 }
 insist(at === end, 'archive_invalid')
 for (const [path] of names) {
  const parts = path.split('/')
  for (let index = 1; index < parts.length; index++) insist(names.get(parts.slice(0, index).join('/')) !== false, 'archive_path_conflict')
 }
 result.sort((a, b) => a.offset - b.offset)
 insist(result[0].offset === 0, 'archive_invalid')
 for (let index = 0; index < result.length; index++) insist(result[index].end === (result[index + 1]?.offset ?? start), 'archive_invalid')
 return result
}
function unpack(bytes: Uint8Array): Output[] {
 const entries = inspect(bytes), outputs: Output[] = []
 let seen = 0, completed = 0, expanded = 0
 const unzip = new Unzip(file => {
  const entry = entries[seen++]
  insist(entry && file.name === entry.path && file.originalSize === entry.size && file.size === entry.compressed, 'archive_conflicting_header')
  // originalSize is checked before allocation and before starting decompression.
  insist(file.originalSize <= MAX_EXPANDED, 'archive_expansion_limit')
  const content = new Uint8Array(file.originalSize)
  let written = 0
  file.ondata = (error, chunk, final) => {
   if (error) throw new ChestError('archive_decompression_failed')
   written += chunk.length; expanded += chunk.length
   insist(written <= entry.size && expanded <= MAX_EXPANDED && expanded <= bytes.length * 100, 'archive_expansion_limit')
   content.set(chunk, written - chunk.length)
   if (final) {
    insist(written === entry.size && crc32(content) === entry.crc, 'archive_integrity_failed')
    completed++
    if (!entry.directory) outputs.push({ path: entry.path, bytes: content })
   }
  }
  file.start()
 })
 unzip.register(UnzipInflate)
 // Small pushes also bound dishonest deflate streams before their next size check.
 for (let at = 0; at < bytes.length; at += 1024) unzip.push(bytes.subarray(at, at + 1024), at + 1024 >= bytes.length)
 insist(seen === entries.length && completed === entries.length, 'archive_incomplete')
 return outputs
}

async function convert(bytes: Uint8Array, name: string): Promise<Output[]> {
 insist(/\.(docx|xlsx|pptx|odt|ods|odp)$/i.test(name), 'conversion_unsupported')
 insist(!safePath(name).directory && !name.includes('/'), 'conversion_invalid_name')
 const extension = name.split('.').at(-1)!.toLowerCase(), parts = unpack(bytes)
 let text: string
 if (['docx', 'xlsx', 'pptx'].includes(extension)) {
  const preview = await officePreview(bytes)
  insist(preview && preview.kind === extension, 'conversion_invalid_document')
  text = preview.text
 } else {
  const mimetype = parts.find(part => part.path === 'mimetype'), content = parts.find(part => part.path === 'content.xml')
  const kind = { odt: 'text', ods: 'spreadsheet', odp: 'presentation' }[extension as 'odt'|'ods'|'odp']
  insist(mimetype && content && new TextDecoder().decode(mimetype.bytes).trim() === `application/vnd.oasis.opendocument.${kind}`, 'conversion_invalid_document')
  const document = parseXml(content.bytes)
  insist(document.documentElement.localName === 'document-content' && document.documentElement.namespaceURI === 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'conversion_invalid_document')
  const extracted = await officeText(bytes)
  insist(extracted, 'conversion_invalid_document'); text = extracted.text
 }
 const derivative = new TextEncoder().encode(text)
 insist(derivative.length <= MAX_EXPANDED, 'conversion_output_limit')
 return [{ path: name.replace(/\.[^.]+$/, '.txt'), bytes: derivative }]
}

// The caller retains the source and publishes derivatives with its own current ACL,
// governance and lineage checks. No partial archive output escapes a failed transform.
export async function transform(bytes: Uint8Array, name: string, operation: 'convert'|'unzip'): Promise<Output[]> {
 try {
  insist(bytes.length <= MAX_INPUT, 'transform_input_limit')
  if (operation === 'unzip') return unpack(bytes)
  insist(operation === 'convert', 'transform_unsupported')
  return await convert(bytes, name)
 } catch (error) {
  if (error instanceof ChestError) throw error
  throw new ChestError(operation === 'unzip' ? 'archive_invalid' : 'conversion_invalid_document')
 }
}
