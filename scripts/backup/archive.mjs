import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { encrypt, decrypt, describe, sha256 } from './crypto.mjs';

const safePath = path => path === 'database.sqlite' || /^objects\/[a-f0-9]{64}$/.test(path);
export async function sealArchive({ directory, output, key, metadata, paths }) {
  const entries = [];
  for (const path of paths) {
    if (!safePath(path) || entries.some(e => e.path === path)) throw new Error('Invalid or duplicate backup entry.');
    entries.push(await describe(path, join(directory, path)));
  }
  const manifest = { format: 'chest-independent-backup-2', ...metadata, entries };
  manifest.format = 'chest-independent-backup-2';
  const encoded = Buffer.from(JSON.stringify(manifest));
  if (encoded.length > 64 * 1024 * 1024) throw new Error('Backup manifest exceeds 64 MiB.');
  const size = Buffer.alloc(4); size.writeUInt32BE(encoded.length);
  async function* contents() {
    yield size; yield encoded;
    for (const entry of entries) yield* createReadStream(join(directory, entry.path));
  }
  await encrypt(Readable.from(contents()), output, key);
  return { ...manifest, archiveSha256: await sha256(output), archiveBytes: (await stat(output)).size };
}

// Call only with a newly created private scratch directory. The complete
// ciphertext is authenticated before extraction; all hashes precede target IO.
export async function openArchive({ input, directory, key }) {
  const clear = join(directory, 'authenticated.payload');
  await decrypt(input, clear, key);
  const fd = await open(clear, 'r'); let manifest, at;
  try {
    const length = Buffer.alloc(4); if ((await fd.read(length, 0, 4, 0)).bytesRead !== 4) throw new Error('Missing backup manifest.');
    const size = length.readUInt32BE();
    if (!size || size > 64 * 1024 * 1024) throw new Error('Invalid backup manifest size.');
    const bytes = Buffer.alloc(size); if ((await fd.read(bytes, 0, size, 4)).bytesRead !== size) throw new Error('Incomplete backup manifest.');
    manifest = JSON.parse(bytes.toString('utf8')); at = 4 + size;
  } finally { await fd.close(); }
  if (manifest.format !== 'chest-independent-backup-2' || !Array.isArray(manifest.entries) || manifest.entries[0]?.path !== 'database.sqlite') throw new Error('Invalid backup manifest.');
  const seen = new Set();
  for (const entry of manifest.entries) {
    if (!safePath(entry.path) || seen.has(entry.path) || !Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Unsafe backup entry.');
    seen.add(entry.path);
    if (entry.path.startsWith('objects/') && entry.path.slice(8) !== entry.sha256) throw new Error('Original name and hash differ.');
    if (!Number.isSafeInteger(at + entry.size)) throw new Error('Backup size overflow.');
    at += entry.size;
  }
  if (at !== (await stat(clear)).size) throw new Error('Backup payload length differs from manifest.');
  await mkdir(join(directory, 'objects'), { mode: 0o700 });
  // Respect the original encoded length, including any JSON whitespace.
  const lengthFd = await open(clear, 'r'); const length = Buffer.alloc(4);
  try { await lengthFd.read(length, 0, 4, 0); at = 4 + length.readUInt32BE(); } finally { await lengthFd.close(); }
  for (const entry of manifest.entries) {
    const file = join(directory, entry.path);
    await pipeline(entry.size ? createReadStream(clear, { start: at, end: at + entry.size - 1 }) : Readable.from([]), createWriteStream(file, { flags: 'wx', mode: 0o600 }));
    if (await sha256(file) !== entry.sha256) throw new Error('Backup entry checksum failed.');
    at += entry.size;
  }
  return manifest;
}
