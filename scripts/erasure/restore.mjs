#!/usr/bin/env node
import { mkdtemp, chmod, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { restoreConsent, ErasureFenceError } from './journal.mjs';
import { checkPortableJournal } from './portable.mjs';

const usage = 'node scripts/erasure/restore.mjs --input FILE [--erasure-journal FILE | --acknowledge-offline-erasures] [--verify-only | --yes]\nRun in a fresh Chest checkout with the same archive policy. Obtain the latest journal from the source owner at /api/chest/erasure/journal. Offline archives cannot reveal later erasures.';
async function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') { console.log(usage); return; }
    if (['--yes', '--verify-only', '--acknowledge-offline-erasures'].includes(flag)) options[flag] = true;
    else if (['--input', '--erasure-journal'].includes(flag) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[flag] = argv[++i];
    else throw new ErasureFenceError(usage);
  }
  if (!options['--input'] || !options['--verify-only'] && !options['--yes']) throw new ErasureFenceError(usage);
  const journal = await restoreConsent({ erasureJournal: options['--erasure-journal'], acknowledgeOfflineErasures: options['--acknowledge-offline-erasures'] });
  const directory = await mkdtemp(join(tmpdir(), 'chest-erasure-restore-'));
  try {
    await chmod(directory, 0o700);
    const input = join(directory, 'verified.rer');
    await copyFile(resolve(options['--input']), input); await chmod(input, 0o600);
    const checked = await checkPortableJournal(input, journal);
    if (options['--verify-only']) { console.log(JSON.stringify({ verified: true, ...checked })); return; }
    // Import the checked private snapshot, not a path that may have changed
    // after preflight. RER retains its own empty-target and atomic SQL checks.
    const child = spawn('rer', ['import', '--input', input, '--yes'], { stdio: 'inherit' });
    const code = await new Promise((ok, no) => { child.once('error', no); child.once('exit', ok); });
    if (code !== 0) throw new Error('Import failed');
  } finally { await rm(directory, { recursive: true, force: true }); }
}
try { await main(process.argv.slice(2)); }
catch (error) { console.error(error instanceof ErasureFenceError ? error.message : 'Restore failed. Archive integrity or the clean target checks did not pass.'); process.exitCode = 1; }
