import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, stat, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { makePart, canonicalJson, sha256 } from '@runeditrun/rer/modules/portability';

const root=resolve(import.meta.dirname,'../..'), temp=await mkdtemp(join(tmpdir(),'chest-erasure-evidence-'));
const entry={id:'later-erasure',at:'2026-10-19T00:00:00.000Z',items:['erased-file'],documents:[],identities:[],checksums:[]};
async function archive(file,entries=[]) {
  const rows=entries.map(entry=>({id:'erasure-journal:'+entry.id,kind:'erasure-journal',payload:JSON.stringify(entry),revision:'rev'}));
  const table={name:'chest_records',sql:'CREATE TABLE chest_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL,revision TEXT NOT NULL)',columns:['id','kind','payload','revision'].map(name=>({name,type:'TEXT',notnull:1,hidden:0})),dependencies:[],count:rows.length};
  const schema=await sha256(canonicalJson([{name:table.name,sql:table.sql}]));
  const part=rows.length?await makePart(0,rows.map((row,index)=>({kind:'row',table:'chest_records',index,row}))):null;
  const manifest={kind:'manifest',format:'runeditrun-portability',version:2,product:'chest',sourceIdentity:'source-installation',exportedAt:'2026-10-19T01:00:00.000Z',schema,tables:[table],objects:[],payloads:[],excludedTables:[],excludedColumns:{},requiredConfiguration:[],partCount:part?1:0,epoch:entries.length,journal:[]};
  const contentHash=await sha256(canonicalJson({objects:[],payloads:[],requiredConfiguration:[],schema,tables:[{name:table.name,rows}]}));
  const archiveHash=await sha256(canonicalJson({manifest,parts:part?[part.sha256]:[]}));
  await writeFile(file,[manifest,...(part?[part]:[]),{kind:'closing',partCount:manifest.partCount,contentHash,archiveHash}].map(v=>JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
}
async function cli(script,args,expected=0) {
  const child=spawn(process.execPath,[join(root,'scripts',script),...args],{cwd:root,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  const code=await new Promise((ok,no)=>{child.once('error',no);child.once('exit',ok)});
  assert.equal(code,expected,stderr);return {stdout,stderr};
}
try {
  const old=join(temp,'old.rer'), latest=join(temp,'latest.chest'),journal=join(temp,'journal.json');
  await archive(old);await archive(latest,[entry]);
  await writeFile(journal,JSON.stringify({format:'chest-erasure-journal-1',source:'source-installation',entries:[entry]}),{mode:0o600});
  const before=await readFile(old);
  assert.match((await cli('erasure/restore.mjs',['--input',old,'--verify-only'],1)).stderr,/cannot reveal erasures/);
  assert.match((await cli('erasure/restore.mjs',['--input',old,'--erasure-journal',journal,'--yes'],1)).stderr,/later erasures absent/);
  assert.deepEqual(await readFile(old),before);
  const verified=await cli('erasure/restore.mjs',['--input',latest,'--erasure-journal',journal,'--verify-only']);
  assert.equal(JSON.parse(verified.stdout).verified,true);
  await cli('erasure/restore.mjs',['--input',old,'--acknowledge-offline-erasures','--verify-only']);
  await writeFile(journal,JSON.stringify({format:'chest-erasure-journal-1',source:'another-source',entries:[entry]}));
  assert.match((await cli('erasure/restore.mjs',['--input',latest,'--erasure-journal',journal,'--verify-only'],1)).stderr,/source does not match/);
  assert.match((await cli('backup/cli.mjs',['restore','--input',old],1)).stderr,/cannot reveal erasures/);
  assert.match((await cli('hosted-restore.mjs',['--input',temp],2)).stderr,/cannot reveal erasures/);

  const registry=join(temp,'copies.json'),receipt=join(temp,'deletion.json'),held=join(temp,'held.rer');
  await archive(held);
  await writeFile(registry,JSON.stringify({format:'chest-erasure-backups-1',backups:[{id:'reachable',locator:old},{id:'offline',locator:join(temp,'not-mounted.rer')},{id:'retained',locator:held,held:true,retention:'Legal hold'}]}),{mode:0o600});
  const removed=await cli('erasure/backups.mjs',['--registry',registry,'--backup','reachable','--backup','offline','--backup','retained','--erasure',entry.id,'--receipt',receipt,'--yes'],2);
  const result=JSON.parse(removed.stdout);
  assert.deepEqual(result.targets.map(t=>t.status),['complete','pending','held']);
  assert.equal(result.targets[0].verified,true);
  assert.equal(result.targets[0].sha256,createHash('sha256').update(before).digest('hex'));
  assert.equal(result.targets[1].verified,false);
  await assert.rejects(access(old));await access(held);
  assert.deepEqual(JSON.parse(await readFile(receipt,'utf8')),result);
  assert.equal((await stat(receipt)).mode&0o077,0);
  console.log('Erasure archive CLI passed: explicit offline disclosure, verified older-archive refusal, source mismatch, post-erasure archive acceptance, and durable real-copy deletion with pending/held outcomes.');
} finally { await rm(temp,{recursive:true,force:true}); }
