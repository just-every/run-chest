import { client, CLIENT_VERSION, SyncError, reasonFor } from './api.mjs';
import { openDisk } from './disk.mjs';
import { folderFiles, versionOf } from './tree.mjs';
import { measure, newRecord, readState, reportFiles, status } from './state.mjs';
import { download, verifyRemote } from './transfer.mjs';
import { enumerateTree } from './enumeration.mjs';

export { CLIENT_VERSION } from './api.mjs';

// No background process is installed. Each run inspects actual files and current
// authorization, records the queue, performs permitted work and reports receipts.
export async function runCompanion(options) {
  if (!options || typeof options.folder !== 'string' || !options.folder || options.pause && options.resume) throw new SyncError('invalid_sync_options');
  const api = client(options), disk = await openDisk(options.root), unlock = await disk.lock();
  let state;
  try {
    state = readState(await disk.load(), api.origin, options.folder);
    const save = () => disk.save(state);
    const remoteFiles = async () => {
      const files = folderFiles(await enumerateTree(api), state.folder);
      if (new Set([...state.files.map(file => file.item), ...files.map(file => file.id)]).size > 500) {
        throw new SyncError('folder_exceeds_companion_limit');
      }
      return files;
    };
    const report = async () => {
      await save();
      const result = await api.report({ folder: state.folder, clientVersion: CLIENT_VERSION,
        cache: { freeBytes: await disk.freeBytes() }, files: reportFiles(state) });
      if (result?.accepted !== true) throw new SyncError('report_not_accepted');
    };
    if (options.pause) { state.paused = true; await save(); }
    const policy = await api.policy(state.folder);
    if (typeof policy?.paused !== 'boolean' || !(policy.grant === null || typeof policy.grant?.resume === 'boolean')) throw new SyncError('invalid_repair_policy');
    if (options.pause) state.paused = true;
    else if (options.resume || policy.grant?.resume) state.paused = false;
    else if (policy.paused) state.paused = true;

    let remote;
    try { remote = await remoteFiles(); }
    catch (error) {
      for (const record of state.files) {
        try { await measure(disk, record); } catch { /* Preserve previous observation on unsafe paths. */ }
        status(record, 'failed', reasonFor(error));
      }
      await report(); return { paused: state.paused, files: reportFiles(state), error: reasonFor(error) };
    }
    const byId = new Map(remote.map(file => [file.id, file]));
    const existing = new Map(state.files.map(file => [file.item, file]));
    for (const item of remote) if (!existing.has(item.id)) { const record = newRecord(item); state.files.push(record); existing.set(item.id, record); }
    const occupied = new Map(), collisions = new Set();
    for (const record of state.files) {
      const path = record.path.normalize('NFC').toLowerCase();
      if (occupied.has(path)) { collisions.add(record.item); collisions.add(occupied.get(path)); }
      occupied.set(path, record.item);
    }

    // Publish the actual interrupted/offline queue before performing any content PUT.
    for (const record of state.files) {
      const item = byId.get(record.item);
      try {
        await measure(disk, record);
        if (!item) status(record, 'failed', 'access_or_scope_changed');
        else if (collisions.has(record.item)) status(record, 'failed', 'local_path_collision');
        else if (item.problem) status(record, 'failed', item.problem);
        else if (item.path !== record.path) status(record, 'failed', 'remote_path_changed');
        else if (!item.download) status(record, 'failed', 'download_denied');
        else if (record.conflictItem || record.state === 'conflicted') status(record, 'conflicted', record.reason);
        else if (record.inflight) status(record, 'conflicted', 'upload_outcome_uncertain');
        else if (state.paused) status(record, 'paused', 'queue_paused');
        else status(record, 'queued', record.localChecksum !== record.baseChecksum && record.baseVersion ? 'local_change' : 'verify_remote_bytes');
      } catch (error) { status(record, 'failed', reasonFor(error)); }
    }
    await report();
    if (state.paused) return { paused: true, files: reportFiles(state) };

    for (const record of state.files) {
      if (record.state !== 'queued') continue;
      try {
        // Refresh current access/version immediately before each transfer. Earlier
        // tree snapshots and cached authorization never grant a later operation.
        const current = (await remoteFiles()).find(item => item.id === record.item);
        if (!current || !current.download) throw new SyncError('access_or_scope_changed', 403);
        if (current.problem || current.path !== record.path) throw new SyncError(current.problem ?? 'remote_path_changed');
        await synchronize(disk, api, record, current, save, remoteFiles);
      } catch (error) {
        if (record.inflight) status(record, 'conflicted', 'upload_outcome_uncertain');
        else status(record, 'failed', reasonFor(error));
      }
      await save();
    }
    // A local editor or remote collaborator may have changed a file while another
    // transfer ran. Only receipts still matching both current ends survive.
    let finalTree;
    try { finalTree = new Map((await remoteFiles()).map(file => [file.id, file])); }
    catch (error) {
      for (const record of state.files) if (record.state === 'up-to-date') status(record, 'failed', reasonFor(error));
      await report();
      return { paused: false, files: reportFiles(state), error: reasonFor(error) };
    }
    for (const record of state.files) {
      if (record.state !== 'up-to-date') continue;
      try {
        const local = await measure(disk, record), remote = finalTree.get(record.item);
        if (!remote || !remote.download) throw new SyncError('access_or_scope_changed', 403);
        const version = versionOf(remote);
        if (!local || local.checksum !== record.receipt.localChecksum || local.size !== record.receipt.size || version.id !== record.receipt.version || version.checksum !== local.checksum || remote.path !== record.path) status(record, 'queued', 'changed_after_verification');
      } catch (error) { status(record, 'failed', reasonFor(error)); }
    }
    await report();
    return { paused: false, files: reportFiles(state) };
  } finally { await unlock(); }
}

async function synchronize(disk, api, record, remote, save, remoteFiles) {
  let version = versionOf(remote), local = await measure(disk, record);
  if (record.baseVersion && !local) throw new SyncError('local_file_missing');
  const localChanged = record.baseVersion && local.checksum !== record.baseChecksum;
  if (!record.baseVersion && local && (local.checksum !== version.checksum || local.size !== version.size)) {
    status(record, 'conflicted', 'untracked_local_file'); return;
  }
  if (localChanged && (local.checksum !== version.checksum || local.size !== version.size)) {
    // Persist an uncertain-write marker before crossing the HTTP boundary. Without
    // a server idempotency key, an interrupted PUT must not be blindly replayed.
    const upload = await disk.inspect(record.path, true);
    if (upload.checksum !== local.checksum || upload.size !== local.size) throw new SyncError('local_file_changed_during_read');
    record.inflight = { baseVersion: record.baseVersion, checksum: upload.checksum, at: new Date().toISOString() };
    await save();
    let result;
    try { result = await api.upload(record.item, record.baseVersion, upload.bytes); }
    catch (error) {
      // An explicit server rejection does not have an ambiguous commit outcome.
      if (error instanceof SyncError && error.status >= 400 && error.status < 500) delete record.inflight;
      throw error;
    }
    if (result?.conflict === true && typeof result.kept === 'string') {
      record.conflictItem = result.kept; delete record.inflight;
      status(record, 'conflicted', 'divergent_versions_kept'); await save(); return;
    }
    if (result?.conflict !== false || result.item !== record.item) throw new SyncError('invalid_upload_receipt');
    // Learn the actual current version from the server, then verify its original
    // bytes. A successful HTTP status alone is not a recovery receipt.
    remote = (await remoteFiles()).find(item => item.id === record.item);
    if (!remote || !remote.download) throw new SyncError('access_or_scope_changed', 403);
    version = versionOf(remote);
    if (version.checksum !== upload.checksum || version.size !== upload.size) throw new SyncError('upload_superseded_before_verification');
    record.baseVersion = version.id; record.baseChecksum = version.checksum;
    delete record.inflight; await save();
    local = await measure(disk, record);
    if (!local || local.checksum !== version.checksum) { status(record, 'queued', 'local_changed_after_upload'); return; }
  }
  if (!local || local.checksum !== version.checksum || local.size !== version.size) {
    const staging = await download(disk, api, record, version, save);
    local = await disk.install(record.path, staging, local);
    delete record.transfer;
  } else await verifyRemote(api, record.item, version);
  if (!local || local.checksum !== version.checksum || local.size !== version.size) throw new SyncError('local_checksum_mismatch');
  record.baseVersion = version.id; record.baseChecksum = version.checksum;
  record.localChecksum = local.checksum; record.localSize = local.size;
  record.receipt = { version: version.id, localChecksum: local.checksum, remoteChecksum: version.checksum, size: local.size, verifiedAt: new Date().toISOString() };
  status(record, 'up-to-date', 'both_ends_verified');
}

