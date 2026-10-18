import { SyncError } from './api.mjs';
import { safeRelative } from './tree.mjs';

export const states = ['queued', 'paused', 'conflicted', 'failed', 'up-to-date'];
export function readState(saved, origin, folder) {
  if (!saved) return { format: 1, origin, folder, paused: false, files: [] };
  if (saved.format !== 1 || saved.origin !== origin || saved.folder !== folder || typeof saved.paused !== 'boolean' || !Array.isArray(saved.files)) throw new SyncError('sync_state_scope_mismatch');
  const ids = new Set();
  for (const file of saved.files) {
    safeRelative(file.path);
    if (file.path.split('/')[0].toLowerCase() === '.chest-sync' || typeof file.item !== 'string' || !file.item || ids.has(file.item) ||
        !states.includes(file.state) || typeof file.reason !== 'string' ||
        !(file.baseVersion === null || typeof file.baseVersion === 'string') ||
        !(file.baseChecksum === null || /^[a-f0-9]{64}$/.test(file.baseChecksum)) ||
        (file.baseVersion === null) !== (file.baseChecksum === null) ||
        (file.transfer && (!/^\.chest-sync\/transfers\/[a-f0-9-]{36}$/.test(file.transfer.path) || typeof file.transfer.version !== 'string' || !/^[a-f0-9]{64}$/.test(file.transfer.checksum)))) throw new SyncError('invalid_sync_state');
    ids.add(file.item);
  }
  return saved;
}

export function newRecord(item) {
  return { item: item.id, path: item.path, baseVersion: null, baseChecksum: null, localChecksum: null, localSize: 0, state: 'queued', reason: 'initial_download' };
}

export function status(record, state, reason) {
  record.state = state; record.reason = reason;
  // A previous byte receipt cannot establish current recovery after a new failure.
  if (state !== 'up-to-date') delete record.receipt;
}

export async function measure(disk, record) {
  const actual = await disk.inspect(record.path);
  record.localChecksum = actual?.checksum ?? null; record.localSize = actual?.size ?? 0;
  return actual;
}

export function reportFiles(state) {
  return state.files.map(({ item, path, baseVersion, localChecksum, localSize, state, reason, conflictItem }) =>
    ({ item, path, baseVersion, localChecksum, localSize, state, reason, ...(conflictItem ? { conflictItem } : {}) }));
}
