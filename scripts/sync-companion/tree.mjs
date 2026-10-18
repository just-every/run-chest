import { SyncError } from './api.mjs';

export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value)) throw new SyncError('unsafe_local_path');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /^[a-z]:/i.test(part))) throw new SyncError('unsafe_local_path');
  return parts;
}

// The selected folder itself is represented by the local root. Only chains of visible
// descendants reaching that folder enter the queue; an unrelated visible space does not.
export function folderFiles(tree, folder) {
  if (!Array.isArray(tree?.items)) throw new SyncError('invalid_server_tree');
  const byId = new Map(tree.items.map(item => [item.id, item]));
  const selected = byId.get(folder);
  if (!selected || selected.type !== 'folder') throw new SyncError('folder_access_denied', 403);
  const files = [], used = new Map();
  for (const item of tree.items) {
    if (item.type !== 'file') continue;
    const parts = [item.name], seen = new Set([item.id]);
    let parent = item.parent;
    while (parent && parent !== folder && !seen.has(parent)) {
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor || ancestor.type !== 'folder') break;
      parts.unshift(ancestor.name); parent = ancestor.parent;
    }
    if (parent !== folder) continue;
    let path = '', problem = null;
    try {
      // Validate each name separately: a remote slash cannot manufacture a directory.
      for (const name of parts) if (safeRelative(name).length !== 1) throw new SyncError('unsafe_remote_path');
      path = parts.join('/');
      if (parts[0].toLowerCase() === '.chest-sync') throw new SyncError('reserved_local_path');
    } catch { problem = 'unsafe_remote_path'; path = `unmapped-${item.id.replace(/[^a-z0-9_-]/gi, '_')}`; }
    const entry = { ...item, path, problem };
    const folded = path.normalize('NFC').toLowerCase();
    if (used.has(folded)) { entry.problem = 'local_path_collision'; used.get(folded).problem = 'local_path_collision'; }
    used.set(folded, entry); files.push(entry);
  }
  // A file named "a" and another under folder "a" must not race each other.
  for (const entry of files) {
    const parts = entry.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const parentFile = used.get(parts.slice(0, i).join('/').normalize('NFC').toLowerCase());
      if (parentFile) { entry.problem = 'local_path_collision'; parentFile.problem = 'local_path_collision'; }
    }
  }
  return files;
}

export function versionOf(item) {
  const v = item.version;
  if (!v || typeof v.id !== 'string' || !/^[a-f0-9]{64}$/.test(v.checksum) || !Number.isSafeInteger(v.size) || v.size < 0) throw new SyncError('invalid_remote_version');
  return v;
}
