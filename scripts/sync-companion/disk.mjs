import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { SyncError } from './api.mjs';
import { safeRelative } from './tree.mjs';

const noFollow = constants.O_NOFOLLOW ?? 0;
const hash = () => createHash('sha256');

export async function openDisk(rootPath) {
  if (typeof rootPath !== 'string' || !rootPath) throw new SyncError('local_root_required');
  const requested = resolve(rootPath);
  await fs.mkdir(requested, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(requested)).isSymbolicLink()) throw new SyncError('unsafe_local_root');
  const root = await fs.realpath(requested), originalRoot = await fs.stat(root);

  async function path(relative, { parents = false } = {}) {
    const parts = safeRelative(relative), rootNow = await fs.lstat(root);
    if (!rootNow.isDirectory() || rootNow.isSymbolicLink() || rootNow.ino !== originalRoot.ino || rootNow.dev !== originalRoot.dev) throw new SyncError('local_root_changed');
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      cursor = join(cursor, parts[i]);
      let stat;
      try { stat = await fs.lstat(cursor); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (i < parts.length - 1 && parents) {
          await fs.mkdir(cursor, { mode: 0o700 }); stat = await fs.lstat(cursor);
        } else if (i < parts.length - 1) return cursor + '/' + parts.slice(i + 1).join('/');
        else return cursor;
      }
      if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw new SyncError('unsafe_local_path');
    }
    return cursor;
  }

  async function directory(relative) {
    const p = await path(relative, { parents: true });
    try { await fs.mkdir(p, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const stat = await fs.lstat(p);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) throw new SyncError('unsafe_cache_directory');
    await fs.chmod(p, 0o700);
  }
  await directory('.chest-sync');
  await directory('.chest-sync/transfers');
  await directory('.chest-sync/retained');

  async function openFile(relative, flags = constants.O_RDONLY) {
    const p = await path(relative);
    const handle = await fs.open(p, flags | noFollow, 0o600);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) { await handle.close(); throw new SyncError('unsafe_local_file'); }
    return handle;
  }

  async function inspect(relative, includeBytes = false) {
    let handle;
    try { handle = await openFile(relative); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    try {
      const before = await handle.stat(), digester = hash(), chunks = [];
      if (includeBytes && before.size >= 20_000_000) throw new SyncError('upload_too_large');
      const buffer = Buffer.alloc(256 * 1024); let size = 0;
      while (true) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        const bytes = buffer.subarray(0, bytesRead); digester.update(bytes); size += bytesRead;
        if (includeBytes) chunks.push(Buffer.from(bytes));
      }
      const after = await handle.stat();
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || size !== after.size) throw new SyncError('local_file_changed_during_read');
      return { checksum: digester.digest('hex'), size, ...(includeBytes ? { bytes: Buffer.concat(chunks) } : {}) };
    } finally { await handle.close(); }
  }

  async function atomic(relative, body) {
    const temp = `.chest-sync/state-${randomUUID()}.tmp`, p = await path(temp);
    const handle = await fs.open(p, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow, 0o600);
    try { await handle.writeFile(body); await handle.sync(); } finally { await handle.close(); }
    const destination = await path(relative);
    try {
      const existing = await fs.lstat(destination);
      if (!existing.isFile() || existing.nlink !== 1) throw new SyncError('unsafe_state_file');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await fs.rename(p, destination);
    const dir = await fs.open(await path('.chest-sync'), constants.O_RDONLY);
    try { await dir.sync(); } finally { await dir.close(); }
  }

  async function lock() {
    const relative = '.chest-sync/run.lock', p = await path(relative);
    async function acquire() {
      const h = await fs.open(p, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow, 0o600);
      try { await h.writeFile(JSON.stringify({ pid: process.pid })); await h.sync(); } finally { await h.close(); }
    }
    try { await acquire(); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const h = await openFile(relative);
      let pid;
      try {
        if ((await h.stat()).size > 100) throw new SyncError('invalid_sync_lock');
        pid = JSON.parse(await h.readFile('utf8')).pid;
      } finally { await h.close(); }
      if (!Number.isSafeInteger(pid) || pid < 1) throw new SyncError('invalid_sync_lock');
      try { process.kill(pid, 0); throw new SyncError('companion_already_running'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      await fs.unlink(await path(relative)); await acquire();
    }
    return async () => { await fs.unlink(await path(relative)); };
  }

  async function load() {
    let h;
    try { h = await openFile('.chest-sync/state.json'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    try {
      if ((await h.stat()).size > 10_000_000) throw new SyncError('invalid_sync_state');
      return JSON.parse(await h.readFile('utf8'));
    } catch { throw new SyncError('invalid_sync_state'); }
    finally { await h.close(); }
  }
  async function freeBytes() {
    const stat = await fs.statfs(root, { bigint: true });
    return Number(stat.bavail * stat.bsize > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : stat.bavail * stat.bsize);
  }
  const transferName = () => `.chest-sync/transfers/${randomUUID()}`;
  function checkTransfer(relative) {
    if (!/^\.chest-sync\/transfers\/[a-f0-9-]{36}$/.test(relative)) throw new SyncError('unsafe_transfer_path');
  }

  // Write and hash response bytes in a private staging file, preserving partial bytes
  // for an immutable-version range request on the next invocation.
  async function receive(relative, response, version) {
    checkTransfer(relative);
    const flags = constants.O_CREAT | constants.O_WRONLY | constants.O_APPEND;
    const h = await openFile(relative, flags);
    try {
      let size = (await h.stat()).size;
      if (size > 0 && (response.status !== 206 || response.headers.get('content-range') !== `bytes ${size}-${version.size - 1}/${version.size}`)) throw new SyncError('invalid_resume_response');
      if (!size && response.status !== 200) throw new SyncError('invalid_download_response');
      if (!response.body) throw new SyncError('empty_download_response');
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > version.size) throw new SyncError('remote_size_mismatch');
        let offset = 0;
        while (offset < chunk.byteLength) { const result = await h.write(chunk, offset, chunk.byteLength - offset); offset += result.bytesWritten; }
      }
      await h.sync();
      if (size !== version.size) throw new SyncError('transfer_interrupted');
    } finally { await h.close(); }
    const actual = await inspect(relative);
    if (actual.checksum !== version.checksum || actual.size !== version.size) throw new SyncError('remote_checksum_mismatch');
    return actual;
  }

  async function install(relative, transfer, expectedLocal) {
    checkTransfer(transfer);
    const destination = await path(relative, { parents: true });
    const current = await inspect(relative);
    if ((current?.checksum ?? null) !== (expectedLocal?.checksum ?? null) || (current?.size ?? null) !== (expectedLocal?.size ?? null)) throw new SyncError('local_changed_during_transfer');
    const staging = await path(transfer);
    if (current) {
      // Retain the previous cached bytes rather than delete them. An external editor
      // racing this operation cannot lose the only copy of its old inode's contents.
      const retained = `.chest-sync/retained/${randomUUID()}`;
      await fs.link(destination, await path(retained));
      await fs.rename(staging, destination);
    } else {
      // link is exclusive: a local file created mid-transfer is never overwritten.
      await fs.link(staging, destination);
      await fs.unlink(staging);
    }
    return inspect(relative);
  }
  return { root, path, inspect, lock, load, freeBytes, transferName, receive, install,
    save: state => atomic('.chest-sync/state.json', JSON.stringify(state, null, 2) + '\n'),
  };
}
