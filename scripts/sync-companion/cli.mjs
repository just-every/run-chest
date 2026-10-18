#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { runCompanion } from './run.mjs';
import { reasonFor, SyncError } from './api.mjs';

export { runCompanion } from './run.mjs';

const usage = `Chest file sync companion (Node 22 or later)
Usage: node scripts/sync-companion/cli.mjs --origin https://chest.example --folder ID --root PATH [--pause | --resume]

Set CHEST_DEVICE_TOKEN in this process's private environment. Never put it in a command argument.
--pause       Persist a paused queue; send no file uploads or downloads.
--resume      Explicitly resume a paused queue.
--allow-http  Allow HTTP only for literal localhost, 127.0.0.1 or [::1] testing.
--help        Show this help.

Runs once, reports real local bytes and exits. Run it again to inspect changes or resume an interrupted download.
Exit 0: verified or intentionally paused; 2: queued, conflicted or failed work; 1: invocation/transport failure.
`;

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') return { help: true };
    if (['--pause', '--resume', '--allow-http'].includes(arg)) options[arg === '--allow-http' ? 'allowHttp' : arg.slice(2)] = true;
    else if (['--origin', '--folder', '--root'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[arg.slice(2)] = argv[++i];
    else throw new SyncError('invalid_cli_arguments');
  }
  if (!options.origin || !options.folder || !options.root) throw new SyncError('origin_folder_root_required');
  return options;
}

async function main() {
  try {
    const options = parse(process.argv.slice(2));
    if (options.help) { process.stdout.write(usage); return; }
    const result = await runCompanion({ ...options, token: process.env.CHEST_DEVICE_TOKEN });
    // Paths and reason codes come from the durable report, never from credentials.
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.error || result.files.some(file => ['queued', 'failed', 'conflicted'].includes(file.state))) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`Chest sync: ${reasonFor(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
