import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('CHEST-BACKUP-2\n'), MAX_FRAME = 8 * 1024 * 1024;
export function archiveKey(value) {
  if (!/^[a-fA-F0-9]{64}$/.test(value ?? '')) throw new Error('CHEST_BACKUP_KEY must hold a separately retained random 32-byte hex key.');
  return Buffer.from(value, 'hex');
}
export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const nonce = index => { const n = Buffer.alloc(12); n.writeBigUInt64BE(BigInt(index), 4); return n; };
const aad = (header, index, length) => { const b = Buffer.alloc(12); b.writeBigUInt64BE(BigInt(index)); b.writeUInt32BE(length, 8); return Buffer.concat([header, b]); };
async function exact(fd, size) {
  const bytes = Buffer.alloc(size); let offset = 0;
  while (offset < size) { const { bytesRead } = await fd.read(bytes, offset, size - offset); if (!bytesRead) throw new Error('Truncated encrypted backup.'); offset += bytesRead; }
  return bytes;
}

// Each bounded frame has its own AES-256-GCM tag, sequence-bound AAD and nonce.
// A per-archive HKDF key and mandatory authenticated final frame prevent nonce
// reuse across backups, reordering, truncation and appending, at any archive size.
export async function encrypt(source, output, key) {
  const header = Buffer.concat([MAGIC, randomBytes(32)]), derived = hkdfSync('sha256', key, header.subarray(MAGIC.length), MAGIC, 32);
  async function* frames() {
    yield header; let index = 0;
    const frame = bytes => {
      const cipher = createCipheriv('aes-256-gcm', derived, nonce(index)); cipher.setAAD(aad(header, index++, bytes.length));
      const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length);
      return Buffer.concat([size, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
    };
    for await (const chunk of source) for (let at = 0; at < chunk.length; at += MAX_FRAME) yield frame(chunk.subarray(at, at + MAX_FRAME));
    yield frame(Buffer.alloc(0));
  }
  await pipeline(Readable.from(frames()), createWriteStream(output, { flags: 'wx', mode: 0o600 }));
}
export async function decrypt(input, output, key) {
  const fd = await open(input, 'r');
  async function* frames() {
    const header = await exact(fd, MAGIC.length + 32);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unsupported encrypted backup.');
    const derived = hkdfSync('sha256', key, header.subarray(MAGIC.length), MAGIC, 32); let index = 0;
    while (true) {
      const length = (await exact(fd, 4)).readUInt32BE();
      if (length > MAX_FRAME) throw new Error('Invalid encrypted backup frame.');
      const bytes = await exact(fd, length), tag = await exact(fd, 16);
      const cipher = createDecipheriv('aes-256-gcm', derived, nonce(index)); cipher.setAAD(aad(header, index++, length)); cipher.setAuthTag(tag);
      // Authenticate before any plaintext from this frame leaves the decoder.
      const clear = Buffer.concat([cipher.update(bytes), cipher.final()]);
      if (!length) { if ((await fd.read(Buffer.alloc(1), 0, 1)).bytesRead) throw new Error('Unexpected data after backup.'); return; }
      yield clear;
    }
  }
  try { await pipeline(Readable.from(frames()), createWriteStream(output, { flags: 'wx', mode: 0o600 })); }
  finally { await fd.close(); }
}
export async function describe(path, file) { return { path, size: (await stat(file)).size, sha256: await sha256(file) }; }
