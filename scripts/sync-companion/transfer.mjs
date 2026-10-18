import { createHash } from 'node:crypto';
import { SyncError } from './api.mjs';

export async function verifyRemote(api, item, version) {
  const response = await api.hydrate(item, version.id);
  if (response.status !== 200 || !response.body) throw new SyncError('invalid_download_response');
  const hash = createHash('sha256'); let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > version.size) throw new SyncError('remote_size_mismatch');
      hash.update(chunk);
    }
  } catch (e) { if (e instanceof SyncError) throw e; throw new SyncError('transfer_interrupted'); }
  const checksum = hash.digest('hex');
  if (size !== version.size || checksum !== version.checksum) throw new SyncError('remote_checksum_mismatch');
  return { checksum, size };
}

export async function download(disk, api, record, version, save) {
  let transfer = record.transfer;
  if (!transfer || transfer.version !== version.id || transfer.checksum !== version.checksum) {
    // Old partial or corrupt transfers remain available for human inspection.
    transfer = record.transfer = { path: disk.transferName(), version: version.id, checksum: version.checksum };
    await save();
  }
  const partial = await disk.inspect(transfer.path), offset = partial?.size ?? 0;
  if (offset > version.size) throw new SyncError('invalid_partial_transfer');
  if (await disk.freeBytes() < version.size - offset + 64 * 1024) throw new SyncError('insufficient_cache');
  if (offset === version.size && partial?.checksum === version.checksum) return transfer.path;
  if (offset === version.size) { delete record.transfer; await save(); throw new SyncError('remote_checksum_mismatch'); }
  const response = await api.hydrate(record.item, version.id, offset);
  try { await disk.receive(transfer.path, response, version); }
  catch (error) {
    if (!(error instanceof SyncError) && !error.code) throw new SyncError('transfer_interrupted');
    if (error?.code === 'remote_checksum_mismatch') { delete record.transfer; await save(); }
    throw error;
  }
  return transfer.path;
}
