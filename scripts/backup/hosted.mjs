import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { credentials, names, databaseId, query } from '../hosted/account.mjs';
import { r2 } from '../hosted/r2.mjs';
import { s3 } from '../hosted/s3.mjs';
import { archiveKey, sha256 } from './crypto.mjs';
import { sealArchive, openArchive } from './archive.mjs';
import { sanitizeExport, inspectDatabase, reconcileOriginals, sameSchema, restorePlan, ident } from './database.mjs';
import { restoreConsent } from '../erasure/journal.mjs';
import { checkDatabaseJournal } from '../erasure/database.mjs';

const prefixFor = environment => `chest-independent/${environment}/`;
const archivePattern = /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-[a-f0-9-]{36}\.chestenc$/;
async function scratch(run) {
  const path = await mkdtemp(join(tmpdir(), 'chest-independent-')); await chmod(path, 0o700);
  try { return await run(path); } finally { await rm(path, { recursive: true, force: true }); }
}
export async function runWrangler(creds, argv) {
  // Wrangler export output contains a presigned database URL: never relay it.
  const child = spawn('npx', ['--no-install', 'wrangler', ...argv], { stdio: ['ignore','ignore','ignore'], env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: creds.account, CLOUDFLARE_API_TOKEN: creds.token, WRANGLER_SEND_METRICS: 'false' } });
  await new Promise((ok, no) => { child.once('error', () => no(new Error('Could not launch installed Wrangler.'))); child.once('exit', code => code === 0 ? ok() : no(new Error('Wrangler operation failed; provider output was withheld to protect credentials.'))); });
}
export function configuration({ environment = 'production', envFile, backupBucket, key } = {}) {
  const live = credentials(envFile), resources = names(environment), env = live.env;
  const provider = env.CHEST_BACKUP_PROVIDER ?? 'r2', bucket = backupBucket ?? env.CHEST_BACKUP_BUCKET;
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new Error('Set CHEST_BACKUP_BUCKET to a separately provisioned owner bucket.');
  let destination;
  if (provider === 'r2') {
    destination = { account: env.CHEST_BACKUP_ACCOUNT_ID, token: env.CHEST_BACKUP_API_TOKEN };
    if (!destination.account || !destination.token) throw new Error('Set the independent R2 account and API token.');
    if (destination.token === live.token || destination.account === live.account && bucket === resources.bucket) throw new Error('Backup requires separate credentials and a bucket outside the live store.');
  } else if (provider === 's3') {
    const region = env.CHEST_BACKUP_S3_REGION;
    if (!/^[a-z0-9-]+$/.test(region ?? '')) throw new Error('Set the independent S3 region.');
    const endpoint = new URL(env.CHEST_BACKUP_S3_ENDPOINT ?? `https://s3.${region}.amazonaws.com`);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new Error('S3 endpoint must be an HTTPS origin.');
    destination = { endpoint: endpoint.origin, region, accessKeyId: env.CHEST_BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: env.CHEST_BACKUP_S3_SECRET_ACCESS_KEY, sessionToken: env.CHEST_BACKUP_S3_SESSION_TOKEN };
    if (!destination.accessKeyId || !destination.secretAccessKey || [destination.accessKeyId,destination.secretAccessKey,destination.sessionToken].includes(live.token)) throw new Error('Set independent S3 credentials, outside the live store authority.');
    if (endpoint.hostname === `${live.account}.r2.cloudflarestorage.com` && bucket === resources.bucket) throw new Error('Backup bucket must differ from the live store.');
  } else throw new Error('CHEST_BACKUP_PROVIDER must be r2 or s3.');
  return { environment, live, provider, destination, bucket, resources, key: archiveKey(key ?? env.CHEST_BACKUP_KEY) };
}
export async function hostedEdge(config) {
  const { live, destination, resources, bucket } = config;
  const id = await databaseId(live, resources.database);
  // Authenticate object stores only inside the claimed run so a revoked backup credential
  // becomes a durable failed attempt, rather than a runner disappearing before reporting.
  const lazy = (creds, name) => {
    let client;
    const open = () => client ??= name === bucket && creds === destination && config.provider === 's3' ? Promise.resolve(s3(creds, name)) : r2(creds, name);
    return {
      async *list(prefix) { yield* (await open()).list(prefix); },
      async delete(key) { return (await open()).delete(key); },
      async download(key, file) { return (await open()).download(key, file); },
      async upload(key, file) { return (await open()).upload(key, file); },
    };
  };
  const originals=lazy(live,resources.bucket),archives=lazy(destination,bucket);
  return {
    originals, archives,
    exportDatabase: output => runWrangler(live, ['d1','export',resources.database,'--remote','--output',output]),
    executeDatabase: file => runWrangler(live, ['d1','execute',resources.database,'--remote','--file',file,'--yes']),
    query: sql => query(live,id,sql),
    deleteArchive: key => archives.delete(key),
  };
}
export async function listBackups(config, edge) {
  const prefix = prefixFor(config.environment), results = [];
  for await (const entry of edge.archives.list(prefix)) if (archivePattern.test(entry.key.slice(prefix.length))) results.push({ ...entry, at: entry.key.slice(prefix.length, prefix.length + 24).replace(/T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z$/, 'T$1:$2:$3.$4Z') });
  return results.sort((a,b) => b.key.localeCompare(a.key));
}
export async function pruneBackups(config, edge, { retentionDays, now = new Date() }) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500) throw new Error('Retention days must be between 1 and 36500.');
  const backups = await listBackups(config, edge), removed = [];
  // Always retain the newest archive, even if a scheduled run has been failing.
  for (const backup of backups.slice(1)) if (Date.parse(backup.at) < now.getTime() - retentionDays * 86400000) { await edge.deleteArchive(backup.key); removed.push(backup.key); }
  return removed;
}
export async function createBackup(config, edge, { retentionDays } = {}) {
  if (retentionDays !== undefined && (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500)) throw new Error('Retention days must be between 1 and 36500.');
  return scratch(async directory => {
    await mkdir(join(directory,'objects'), { mode: 0o700 });
    const sql = join(directory,'source.sql'); await edge.exportDatabase(sql); await chmod(sql, 0o600);
    const database = await sanitizeExport({ sql, scratch: join(directory,'source.sqlite'), output: join(directory,'database.sqlite') });
    // Remove plaintext authority as soon as sanitization succeeds.
    await Promise.all([rm(sql),rm(join(directory,'source.sqlite'))]);
    const paths = ['database.sqlite'];
    for await (const object of edge.originals.list('sha256/')) {
      if (!/^sha256\/[a-f0-9]{64}$/.test(object.key)) throw new Error('Live original has an invalid content-addressed key.');
      const path = `objects/${object.key.slice(7)}`, file = join(directory,path);
      await edge.originals.download(object.key,file);
      if ((await stat(file)).size !== object.size || await sha256(file) !== object.key.slice(7)) throw new Error('Live original failed its recorded hash or size.');
      paths.push(path);
    }
    const at = new Date().toISOString(), key = prefixFor(config.environment) + at.replace(/[:.]/g,'-') + '-' + randomUUID() + '.chestenc';
    const output = join(directory,'backup.chestenc');
    const manifest = await sealArchive({ directory, output, key: config.key, paths, metadata: { at, environment: config.environment, migrations: database.migrations, authorityPolicy: 'installation-authority-excluded-v2' } });
    reconcileOriginals(database,manifest.entries);
    try {
      await edge.archives.upload(key,output);
      // Success requires reading the independent copy, not merely a PUT receipt.
      const readback = join(directory,'readback.chestenc'); await edge.archives.download(key,readback);
      if (await sha256(readback) !== manifest.archiveSha256) throw new Error('Independent backup readback failed.');
    } catch (error) {
      // A failed readback must not look like a successful retained archive.
      // Only the new, random key from this attempt is eligible for cleanup.
      await edge.deleteArchive(key).catch(()=>{});
      throw error;
    }
    const removed = retentionDays === undefined ? [] : await pruneBackups(config,edge,{retentionDays});
    return { key, at, sha256: manifest.archiveSha256, bytes: manifest.archiveBytes, objects: paths.length - 1, removed };
  });
}
function archiveObject(config, key) {
  const prefix = prefixFor(config.environment);
  if (typeof key !== 'string' || !key.startsWith(prefix) || !archivePattern.test(key.slice(prefix.length))) throw new Error('Choose a backup key listed for this environment.');
  return key;
}
export async function recoverBackup(config, edge, { key, input, apply = false, erasureJournal, acknowledgeOfflineErasures = false } = {}) {
  if (!!key === !!input) throw new Error('Choose one archive key or private input file.');
  const journal = apply ? await restoreConsent({ erasureJournal, acknowledgeOfflineErasures }) : erasureJournal ? await restoreConsent({ erasureJournal }) : null;
  return scratch(async directory => {
    const archive = input ? resolve(input) : join(directory,'download.chestenc');
    if (key) await edge.archives.download(archiveObject(config,key),archive);
    const extracted = join(directory,'verified'); await mkdir(extracted,{mode:0o700});
    const manifest = await openArchive({ input:archive, directory:extracted, key:config.key });
    if (manifest.authorityPolicy !== 'installation-authority-excluded-v2') throw new Error('Unsupported archive authority policy.');
    const database = inspectDatabase(join(extracted,'database.sqlite')); reconcileOriginals(database,manifest.entries);
    checkDatabaseJournal(join(extracted,'database.sqlite'), journal);
    if (JSON.stringify(database.migrations) !== JSON.stringify(manifest.migrations)) throw new Error('Archive migration ledger differs from manifest.');
    if (!apply) return { verified:true, at:manifest.at, objects:manifest.entries.length-1, migrations:database.migrations };
    const schema = await edge.query("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'");
    if (!sameSchema(database.schema,schema)) throw new Error('Deploy the same schema before restoring. Nothing was changed.');
    const migrations = await edge.query('SELECT name FROM d1_migrations ORDER BY id');
    if (JSON.stringify(migrations.map(r=>r.name)) !== JSON.stringify(database.migrations)) throw new Error('Target migrations differ. Nothing was changed.');
    // Clean means no semantic data, audit or migration/import execution history.
    for (const {name} of schema.filter(t => /^(chest_|ik_)/.test(t.name))) {
      if ((await edge.query(`SELECT COUNT(*) AS n FROM ${ident(name)}`))[0].n) throw new Error('Restore requires an empty product database. Nothing was changed.');
    }
    for await (const object of edge.originals.list('')) { void object; throw new Error('Restore requires an empty original bucket. Nothing was changed.'); }
    const triggers = await edge.query("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND sql IS NOT NULL");
    const plan = join(directory,'restore.sql'); await restorePlan({ database:join(extracted,'database.sqlite'), output:plan, targetSchema:schema, triggers });
    for (const entry of manifest.entries.filter(e=>e.path.startsWith('objects/'))) {
      const objectKey = `sha256/${entry.sha256}`, check = join(directory,'check-original');
      await edge.originals.upload(objectKey,join(extracted,entry.path)); await edge.originals.download(objectKey,check);
      if (await sha256(check) !== entry.sha256) throw new Error('Restored original readback failed; database was not published.');
      await rm(check);
    }
    await edge.executeDatabase(plan);
    return { restored:true, at:manifest.at, objects:manifest.entries.length-1, providersNeedAuthorization:true };
  });
}
