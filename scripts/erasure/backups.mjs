#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { saveReceipt } from './receipt.mjs';
import { eraseBackupFile } from './backup-file.mjs';

const usage = 'node scripts/erasure/backups.mjs --registry FILE --backup ID [--backup ID] --erasure RECEIPT_ID --receipt NEW_PRIVATE_FILE --yes\nRegistry: {format:"chest-erasure-backups-1",backups:[{id,name,locator,retention,held?}]}. Only selected real private local .rer/.chest/.chestenc copies are deleted. Unreachable copies remain pending; held:true preserves a policy-retained copy. CHEST_BACKUP_KEY is required for .chestenc authentication.';
const hash = value => createHash('sha256').update(value).digest('hex');
async function main(argv) {
  const options = { backups: [] };
  for (let i=0;i<argv.length;i++) {
    const flag=argv[i];
    if (flag==='--help'||flag==='-h') { console.log(usage); return; }
    if (flag==='--yes') { options.yes=true; continue; }
    if (!['--registry','--backup','--erasure','--receipt'].includes(flag)||!argv[i+1]||argv[i+1].startsWith('--')) throw new Error(usage);
    const value=argv[++i]; if(flag==='--backup')options.backups.push(value);else options[flag.slice(2)]=value;
  }
  if(!options.yes||!options.registry||!options.erasure||!options.receipt||!options.backups.length)throw new Error(usage);
  const registry=JSON.parse(await readFile(options.registry,'utf8'));
  if(registry.format!=='chest-erasure-backups-1'||!Array.isArray(registry.backups))throw new Error('Invalid backup registry.');
  const entries=registry.backups.map(entry=>entry.payload?{id:entry.id,...entry.payload}:entry), ids=new Set();
  for(const entry of entries){if(!entry||typeof entry.id!=='string'||!entry.id||ids.has(entry.id)||typeof entry.locator!=='string'||!entry.locator)throw new Error('Invalid backup registry.');ids.add(entry.id);}
  if(new Set(options.backups).size!==options.backups.length||options.backups.some(id=>!ids.has(id)))throw new Error('Select distinct registered backup IDs.');
  const selected=options.backups.map(id=>entries.find(entry=>entry.id===id)), receipt={format:'chest-backup-erasure-1',erasure:options.erasure,at:new Date().toISOString(),targets:selected.map(entry=>({backup:entry.id,store:'backup:'+entry.id,status:entry.held?'held':'pending',detail:entry.held?'Policy-retained copy; no deletion attempted.':'Deletion has not been verified.',verified:false,locatorSha256:hash(entry.locator)}))};
  const output=resolve(options.receipt);
  // Persist pending outcomes before deleting anything. An interrupted command
  // leaves an honest receipt rather than a success inferred from missing files.
  await saveReceipt(output,receipt,true);
  for(let i=0;i<selected.length;i++) {
    if(selected[i].held)continue;
    const target=receipt.targets[i];
    try {
      target.sha256=await eraseBackupFile(selected[i].locator); target.status='complete';target.verified=true;
      target.detail='Owner-confirmed deletion: authenticated local archive unlinked and its registered path verified absent. Filesystem snapshots, other copies and provider retention remain outside this result.';
    } catch {
      target.status='pending';target.verified=false;target.detail='Copy unavailable, retained, unsafe or unverifiable; deletion is not confirmed. Inspect this registered location and its retention policy.';
    }
    await saveReceipt(output,receipt);
  }
  console.log(JSON.stringify(receipt));
  if(receipt.targets.some(target=>target.status!=='complete'))process.exitCode=2;
}
try { await main(process.argv.slice(2)); }
catch { console.error('Backup erasure stopped. Check the private registry, selected IDs and new receipt path; no success is inferred. Run --help for usage.');process.exitCode=1; }
