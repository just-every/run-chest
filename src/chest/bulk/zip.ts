// Streaming, uncompressed ZIP64. Only central-directory metadata is retained; file chunks pass straight through.
const encoder = new TextEncoder()
const table = new Uint32Array(256)
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 }
function checksum(crc: number, bytes: Uint8Array) { for (const b of bytes) crc = table[(crc ^ b) & 255] ^ (crc >>> 8); return crc >>> 0 }
function record(size: number, fill: (v: DataView) => void) { const bytes = new Uint8Array(size); fill(new DataView(bytes.buffer)); return bytes }
const u64 = (v: DataView, at: number, n: bigint) => v.setBigUint64(at, n, true)
export type ZipEntry = { path: string; chunks: AsyncIterable<Uint8Array>; original?: string }
export async function* zip64(entries: AsyncIterable<ZipEntry>, observe?: (entry:ZipEntry, start:number, end:number, complete:boolean)=>void): AsyncGenerator<Uint8Array> {
 let offset = 0n
 const directory: Uint8Array[] = []
 for await (const entry of entries) {
  const name = encoder.encode(entry.path), localOffset = offset
  if (name.length > 65535 || /[\x00\\]/.test(entry.path) || entry.path.startsWith('/') || entry.path.split('/').some(p => p === '..' || p === '.')) throw new Error('unsafe_archive_path')
  const header = record(30, v => { v.setUint32(0, 0x04034b50, true); v.setUint16(4,45,true); v.setUint16(6,0x0808,true); v.setUint16(12,0x21,true); v.setUint32(18,0xffffffff,true); v.setUint32(22,0xffffffff,true); v.setUint16(26,name.length,true); v.setUint16(28,20,true) })
  const extra = record(20, v => { v.setUint16(0,1,true); v.setUint16(2,16,true) })
  for (const chunk of [header,name,extra]) { offset += BigInt(chunk.length); yield chunk }
  let crc = 0xffffffff, size = 0n
  for await (const chunk of entry.chunks) { crc = checksum(crc,chunk); size += BigInt(chunk.length); const start=Number(offset); offset += BigInt(chunk.length); observe?.(entry,start,Number(offset),false); yield chunk }
  observe?.(entry,Number(offset),Number(offset),true)
  crc = (crc ^ 0xffffffff) >>> 0
  const descriptor = record(24, v => { v.setUint32(0,0x08074b50,true); v.setUint32(4,crc,true); u64(v,8,size); u64(v,16,size) }); offset += 24n; yield descriptor
  const central = record(46 + name.length + 28, v => { v.setUint32(0,0x02014b50,true); v.setUint16(4,45,true); v.setUint16(6,45,true); v.setUint16(8,0x0808,true); v.setUint16(14,0x21,true); v.setUint32(16,crc,true); v.setUint32(20,0xffffffff,true); v.setUint32(24,0xffffffff,true); v.setUint16(28,name.length,true); v.setUint16(30,28,true); v.setUint32(42,0xffffffff,true); const at=46+name.length; v.setUint16(at,1,true); v.setUint16(at+2,24,true); u64(v,at+4,size); u64(v,at+12,size); u64(v,at+20,localOffset) }); central.set(name,46); directory.push(central)
 }
 const start = offset
 for (const row of directory) { offset += BigInt(row.length); yield row }
 const end = offset, count = BigInt(directory.length)
 yield record(56,v=>{v.setUint32(0,0x06064b50,true);u64(v,4,44n);v.setUint16(12,45,true);v.setUint16(14,45,true);u64(v,24,count);u64(v,32,count);u64(v,40,end-start);u64(v,48,start)})
 yield record(20,v=>{v.setUint32(0,0x07064b50,true);u64(v,8,end);v.setUint32(16,1,true)})
 yield record(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,65535,true);v.setUint16(10,65535,true);v.setUint32(12,0xffffffff,true);v.setUint32(16,0xffffffff,true)})
}
export function streaming(iterator: AsyncGenerator<Uint8Array>) {
 return new ReadableStream<Uint8Array>({ async pull(controller) { try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(next.value) } catch(error) { controller.error(error); await iterator.return(undefined) } }, async cancel() { await iterator.return(undefined) } })
}
export async function* one(bytes: Uint8Array) { yield bytes }
