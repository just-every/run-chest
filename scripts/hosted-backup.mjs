#!/usr/bin/env node
// Back up a hosted Chest: its whole D1 database (wrangler d1 export --remote) and every original file in its R2
// bucket, into one owner-only folder with a manifest. `rer export` saves only the local copy on this computer.
// Run it as `rer run hosted-backup`, which brings rer's own Node; restore with `rer run hosted-restore`. Steps: docs/hosting.md.
import { mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { args, credentials, names, databaseId, query, fail } from './hosted/account.mjs';
import { accountingJournal } from './backup/accounting-journal.mjs';
import { exportDatabase } from './backup/database-export.mjs';
import { r2 } from './hosted/r2.mjs';

const usage = 'Usage: rer run hosted-backup --environment NAME [--output DIR] [--env-file FILE]\nNeeds CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (the ones that deployed it), in the environment or --env-file.';
const opts = args(process.argv.slice(2), usage), creds = credentials(opts.envFile), n = names(opts.environment);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = opts.output ?? join('exports', `hosted-${opts.environment}-${stamp}`);
if (existsSync(out)) fail(`${out} already exists. Choose a new --output folder.`);
mkdirSync(join(out, 'objects'), { recursive: true, mode: 0o700 }); chmodSync(out, 0o700);
const sha = file => new Promise((resolve, reject) => { const h = createHash('sha256'); createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject); });

const id = await databaseId(creds, n.database);
const accounting=await accountingJournal(sql=>query(creds,id,sql),creds.account+':'+id,'legacy hosted backup');
const migrations = (await query(creds,id,'SELECT name FROM d1_migrations ORDER BY id',accounting.transport('Cloudflare D1'))).map(r => r.name);
console.log(`Backing up ${n.worker}: database ${n.database}, files in ${n.bucket}, into ${out}`);
await exportDatabase(creds,id,join(out,'database.sql'),accounting.transport('Cloudflare D1'),true);
await accounting.flush();
chmodSync(join(out, 'database.sql'), 0o600);

// Originals live at sha256/<checksum>; each one is checked against its name as it lands.
const bucket = await r2(creds, n.bucket,accounting.transport('Cloudflare R2')), objects = [];
let bytes = 0;
for await (const o of bucket.list('sha256/')) {
  const file = join(out, 'objects', o.key.slice(7));
  await bucket.download(o.key, file);
  if (await sha(file) !== o.key.slice(7)) fail(`${o.key} did not match its checksum after download. Run the backup again.`);
  objects.push(o.key); bytes += o.size;
  process.stdout.write(`\r\x1b[K${objects.length} file(s), ${(bytes / 1048576).toFixed(1)} MB`);
}
process.stdout.write('\n');
const manifest = { format: 'chest-hosted-backup-1', environment: opts.environment, worker: n.worker, database: n.database, bucket: n.bucket, at: new Date().toISOString(), migrations, databaseSha256: await sha(join(out, 'database.sql')), objects: objects.length, bytes };
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
const rows = (readFileSync(join(out, 'database.sql'), 'utf8').match(/^INSERT INTO/gm) ?? []).length;
console.log(`Backed up ${rows} database row(s) and ${objects.length} original file(s) (${(bytes / 1048576).toFixed(1)} MB) to ${out}. It holds every file and record, so keep it private.`);

await accounting.flush();accounting.close();
