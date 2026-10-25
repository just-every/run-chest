#!/usr/bin/env node
import { configuration, hostedEdge, createBackup, recoverBackup, listBackups, pruneBackups } from './hosted.mjs';
import { ErasureFenceError, restoreConsent } from '../erasure/journal.mjs';

const usage = 'node scripts/backup/cli.mjs backup|list|verify|restore|prune --environment NAME [--env-file FILE] [--key ARCHIVE_KEY | --input FILE] [--retention-days DAYS] [--erasure-journal FILE | --acknowledge-offline-erasures]\nSecrets come only from environment or an owner-only env file: CHEST_BACKUP_KEY (32 random bytes as hex), CHEST_BACKUP_ACCOUNT_ID, CHEST_BACKUP_API_TOKEN, CHEST_BACKUP_BUCKET; or CHEST_BACKUP_PROVIDER=s3 with CHEST_BACKUP_S3_REGION, CHEST_BACKUP_S3_ACCESS_KEY_ID, CHEST_BACKUP_S3_SECRET_ACCESS_KEY and optional CHEST_BACKUP_S3_ENDPOINT / CHEST_BACKUP_S3_SESSION_TOKEN; plus the live CLOUDFLARE credentials. Restore writes only into a clean same-schema target. Offline archives cannot reveal later erasures: restore requires the source journal or explicit acknowledgment.';
export async function main(argv) {
  const [command,...rest] = argv, options = {}, mapped = { '--environment':'environment','--env-file':'envFile','--backup-bucket':'backupBucket','--key':'archive','--input':'input','--retention-days':'retentionDays','--erasure-journal':'erasureJournal' };
  if (command === '--help' || command === '-h') { console.log(usage); return; }
  if (!['backup','list','verify','restore','prune'].includes(command)) throw new Error(usage);
  for (let i=0;i<rest.length;i++) { if(rest[i]==='--acknowledge-offline-erasures'){options.acknowledgeOfflineErasures=true;continue;} const key=mapped[rest[i]]; if (!key || !rest[i+1] || rest[i+1].startsWith('--')) throw new Error(usage); options[key]=rest[++i]; }
  if (command==='restore') await restoreConsent(options);
  if (options.retentionDays !== undefined && !/^\d+$/.test(options.retentionDays)) throw new Error('Retention days must be a positive integer.');
  const config=configuration(options), edge=await hostedEdge(config), retentionDays=options.retentionDays === undefined ? undefined : Number(options.retentionDays);
  edge.enableAccounting?.();
  let result;
  try {
  if (command==='backup') result=await createBackup(config,edge,{retentionDays});
  if (command==='list') result=await listBackups(config,edge);
  if (command==='prune') result=await pruneBackups(config,edge,{retentionDays});
  if (command==='verify'||command==='restore') result=await recoverBackup(config,edge,{key:options.archive,input:options.input,apply:command==='restore',erasureJournal:options.erasureJournal,acknowledgeOfflineErasures:options.acknowledgeOfflineErasures});
  await edge.flushAccounting?.();
  console.log(JSON.stringify(result));
  } finally { if(command!=='restore')await edge.flushAccounting?.();edge.closeAccounting?.(); }
}
try { await main(process.argv.slice(2)); }
catch (error) { console.error(error instanceof ErasureFenceError ? error.message : 'Backup operation failed. Check archive integrity, the clean same-schema target and private backup configuration. Provider output and secrets were withheld.'); process.exitCode=1; }
