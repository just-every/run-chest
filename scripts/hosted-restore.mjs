#!/usr/bin/env node
// Restore a hosted Chest backup (scripts/hosted-backup.mjs) into a freshly deployed environment of the same Chest
// version: every original goes back into its R2 bucket, then the database is replaced by the backup's in one
// wrangler d1 execute. Checks before writing anything: the backup's checksums, the same migrations, and a target that
// holds no files or records yet. Steps: docs/hosting.md.
import { readFileSync, readdirSync, writeFileSync, rmSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { args, credentials, names, databaseId, query, wrangler, fail } from './hosted/account.mjs';
import { r2 } from './hosted/r2.mjs';

const usage = 'Usage: rer run hosted-restore --environment NAME --input DIR [--env-file FILE]\nDeploy the environment first (rer deploy --environment NAME --env-file FILE), then restore into it before anyone adds files.';
const opts = args(process.argv.slice(2), usage);
if (!opts.input) fail(usage);
const creds = credentials(opts.envFile), n = names(opts.environment);
const sha = file => new Promise((resolve, reject) => { const h = createHash('sha256'); createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject); });
let manifest;
try { manifest = JSON.parse(readFileSync(join(opts.input, 'manifest.json'), 'utf8')); } catch { fail(`${opts.input} is not a Chest hosted backup folder (no readable manifest.json).`); }
if (manifest.format !== 'chest-hosted-backup-1') fail(`${opts.input} is not a Chest hosted backup.`);

console.log('Checking the backup');
const sql = join(opts.input, 'database.sql');
if (await sha(sql) !== manifest.databaseSha256) fail('database.sql does not match the backup manifest. Nothing was restored.');
const files = readdirSync(join(opts.input, 'objects'));
if (files.length !== manifest.objects) fail(`The backup lists ${manifest.objects} file(s) but holds ${files.length}. Nothing was restored.`);
for (const f of files) if (await sha(join(opts.input, 'objects', f)) !== f) fail(`objects/${f} is damaged. Nothing was restored.`);

const id = await databaseId(creds, n.database);
const migrations = (await query(creds, id, 'SELECT name FROM d1_migrations ORDER BY id')).map(r => r.name);
if (JSON.stringify(migrations) !== JSON.stringify(manifest.migrations)) fail(`${n.worker} runs a different Chest version than the backup (database migrations differ). Deploy the same Chest version the backup came from, then restore. Nothing was restored.`);
const held = (await query(creds, id, 'SELECT COUNT(*) AS n FROM chest_records'))[0].n;
if (held) fail(`${n.worker} already holds ${held} file or record entries. Restore only into a freshly deployed environment. Nothing was restored.`);

console.log(`Putting ${files.length} original file(s) back into ${n.bucket}`);
const bucket = await r2(creds, n.bucket);
let done = 0;
for (const f of files) { await bucket.upload(`sha256/${f}`, join(opts.input, 'objects', f)); process.stdout.write(`\r\x1b[K${++done} of ${files.length}`); }
process.stdout.write('\n');

// Every table is emptied, then filled from the backup, in one file; the migration ledger is kept unless the backup
// carries it (the versions match, so either way it is the same). The database's triggers guard live changes (the last
// owner, import custody), so they are set aside for the replacement and recreated from their own SQL in the same file.
const dump = readFileSync(sql, 'utf8'), has = table => dump.includes(`INSERT INTO "${table}"`) || dump.includes(`INSERT INTO ${table} `);
// SQLite checks ON DELETE RESTRICT at once even with deferred keys, so a table is emptied before the tables it references.
const schema = (await query(creds, id, "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")).filter(t => t.name !== 'd1_migrations' || has(t.name));
const refs = new Map(schema.map(t => [t.name, new Set([...t.sql.matchAll(/REFERENCES\s+["`]?([A-Za-z0-9_]+)/gi)].map(m => m[1]).filter(r => r !== t.name))]));
const tables = [], placed = new Set();
while (tables.length < schema.length) {
  const next = schema.find(t => !placed.has(t.name) && schema.every(c => placed.has(c.name) || c.name === t.name || !refs.get(c.name).has(t.name))) ?? schema.find(t => !placed.has(t.name));
  tables.push(next.name); placed.add(next.name);
}
// Company sign-in is sealed with the deployment's own SESSION_SECRET, which a fresh deployment does not share, and
// its in-flight sign-ins are useless there: those rows are cleared, so everyone signs in by email and the owner enters
// the provider again. SCIM tokens, links and people are hashed without that secret and keep working.
const deploymentBound = ['chest_mfa_factors', 'chest_mfa_challenges', 'chest_mfa_verified', 'chest_mfa_recovery', 'chest_mfa_limits', 'chest_mfa_resets', 'chest_sso_config', 'chest_sso_transactions', 'chest_saml_requests'].filter(t => tables.includes(t));
const plan = join(opts.input, `restore-${Date.now()}.sql`);
const triggers = await query(creds, id, "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND sql IS NOT NULL");
writeFileSync(plan, ['PRAGMA defer_foreign_keys = TRUE;', ...triggers.map(t => `DROP TRIGGER "${t.name}";`), ...tables.map(t => `DELETE FROM "${t}";`), dump, ...deploymentBound.map(t => `DELETE FROM "${t}";`), ...triggers.map(t => `${t.sql};`)].join('\n') + '\n', { mode: 0o600 });
console.log(`Replacing the database of ${n.worker} with the backup`);
try { wrangler(creds, ['d1', 'execute', n.database, '--remote', '--file', plan, '--yes']); } finally { rmSync(plan, { force: true }); }
const restored = (await query(creds, id, 'SELECT COUNT(*) AS n FROM chest_records'))[0].n;
console.log(`Restored ${restored} file and record entries and ${files.length} original file(s) into ${n.worker}. People sign in again by email; if you used company sign-in, enter your provider again under People & settings.`);
