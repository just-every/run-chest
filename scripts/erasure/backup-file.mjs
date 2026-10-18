import { lstat, realpath, mkdtemp, chmod, rm, unlink, open } from 'node:fs/promises';
import { isAbsolute, resolve, extname, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256, archiveKey } from '../backup/crypto.mjs';
import { openArchive } from '../backup/archive.mjs';
import { checkPortableJournal } from './portable.mjs';

export async function eraseBackupFile(locator) {
  if (!isAbsolute(locator) || !['.rer','.chest','.chestenc'].includes(extname(locator))) throw new Error('Select an absolute local archive path.');
  const selected = resolve(locator), selectedStat = await lstat(selected);
  // macOS's ordinary /var temporary path resolves through /private/var. Bind
  // the selected parent once rather than rejecting those filesystem aliases;
  // the selected archive itself must still be a regular file, never a symlink.
  const file = join(await realpath(dirname(selected)),basename(selected)), before = await lstat(file);
  if (!selectedStat.isFile() || selectedStat.dev !== before.dev || selectedStat.ino !== before.ino || !before.isFile() || before.nlink !== 1 || before.mode & 0o077 || before.uid !== process.getuid()) throw new Error('Select a private owner-held regular single-link file without symlinks.');
  const digest = await sha256(file);
  if (extname(file) === '.chestenc') {
    const directory = await mkdtemp(join(tmpdir(),'chest-erasure-check-')); await chmod(directory,0o700);
    try { await openArchive({input:file,directory,key:archiveKey(process.env.CHEST_BACKUP_KEY)}); }
    finally { await rm(directory,{recursive:true,force:true}); }
  } else await checkPortableJournal(file,null);
  const after = await lstat(file);
  if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.nlink !== 1) throw new Error('Archive changed during verification.');
  const selection = await lstat(selected);
  if (!selection.isFile() || selection.dev !== before.dev || selection.ino !== before.ino) throw new Error('Selected archive path changed during verification.');
  await unlink(file);
  const directory = await open(dirname(file),'r'); try { await directory.sync(); } finally { await directory.close(); }
  for (const path of new Set([file,selected])) {
    try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    throw new Error('Archive path still exists after deletion.');
  }
  return digest;
}
