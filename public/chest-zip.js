// Reading .zip files in the browser for Move in: Google Takeout, Dropbox and Box downloads are ordinary zip archives,
// often several gigabytes, so only the central directory is read whole. Each entry's bytes are streamed from the file
// (inflated when compressed) and checked against the CRC-32 the archive records. Zip64 archives and entries are read.
(() => {
  const u16 = (v, o) => v.getUint16(o, true), u32 = (v, o) => v.getUint32(o, true), u64 = (v, o) => Number(v.getBigUint64(o, true))
  const view = async (file, start, end) => new DataView(await file.slice(start, end).arrayBuffer())
  class ZipProblem extends Error {}
  async function entries(file) {
    const tailStart = Math.max(0, file.size - 65557), tail = await view(file, tailStart, file.size)
    let eocd = -1
    for (let i = tail.byteLength - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break }
    if (eocd < 0) throw new ZipProblem('not_zip')
    let count = u16(tail, eocd + 10), size = u32(tail, eocd + 12), offset = u32(tail, eocd + 16)
    if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
      if (eocd < 20 || u32(tail, eocd - 20) !== 0x07064b50) throw new ZipProblem('not_zip')
      const record = await view(file, u64(tail, eocd - 12), u64(tail, eocd - 12) + 56)
      if (u32(record, 0) !== 0x06064b50) throw new ZipProblem('not_zip')
      count = u64(record, 32); size = u64(record, 40); offset = u64(record, 48)
    }
    const dir = await view(file, offset, offset + size), names = new TextDecoder('utf-8'), list = []
    for (let p = 0, n = 0; n < count; n++) {
      if (u32(dir, p) !== 0x02014b50) throw new ZipProblem('not_zip')
      const flags = u16(dir, p + 8), method = u16(dir, p + 10), time = u16(dir, p + 12), date = u16(dir, p + 14), crc = u32(dir, p + 16)
      let csize = u32(dir, p + 20), usize = u32(dir, p + 24), local = u32(dir, p + 42)
      const nameLength = u16(dir, p + 28), extraLength = u16(dir, p + 30), commentLength = u16(dir, p + 32)
      const name = names.decode(new Uint8Array(dir.buffer, p + 46, nameLength)).replace(/\\/g, '/')
      for (let e = p + 46 + nameLength, end = e + extraLength; e + 4 <= end; e += 4 + u16(dir, e + 2)) {
        if (u16(dir, e) !== 1) continue
        let f = e + 4
        if (usize === 0xffffffff) { usize = u64(dir, f); f += 8 }
        if (csize === 0xffffffff) { csize = u64(dir, f); f += 8 }
        if (local === 0xffffffff) local = u64(dir, f)
      }
      const modified = new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2).getTime()
      list.push({ name, folder: name.endsWith('/'), encrypted: Boolean(flags & 1), method, crc, csize, size: usize, local, modified })
      p += 46 + nameLength + extraLength + commentLength
    }
    return list
  }
  const table = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc32 = (crc, bytes) => { crc = ~crc; for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); return ~crc >>> 0 }
  // The entry's uncompressed bytes as a stream; read it to the end, then call check() to compare the CRC-32.
  async function open(file, entry) {
    if (entry.encrypted) throw new ZipProblem('encrypted')
    if (entry.method !== 0 && entry.method !== 8) throw new ZipProblem('method')
    const head = await view(file, entry.local, entry.local + 30)
    if (u32(head, 0) !== 0x04034b50) throw new ZipProblem('not_zip')
    const start = entry.local + 30 + u16(head, 26) + u16(head, 28), raw = file.slice(start, start + entry.csize).stream()
    let crc = 0
    const counted = new TransformStream({ transform(chunk, c) { crc = crc32(crc, chunk); c.enqueue(chunk) } })
    // Bytes that do not inflate are as damaged as a wrong CRC-32, and are reported the same way.
    const reader = (entry.method === 8 ? raw.pipeThrough(new DecompressionStream('deflate-raw')) : raw).pipeThrough(counted).getReader()
    const stream = new ReadableStream({ async pull(c) { try { const { done, value } = await reader.read(); done ? c.close() : c.enqueue(value) } catch { c.error(new ZipProblem('crc')) } }, cancel: why => reader.cancel(why) })
    return { stream, check: () => { if (crc !== entry.crc) throw new ZipProblem('crc') } }
  }
  window.ChestZip = { entries, open, ZipProblem }
})()
