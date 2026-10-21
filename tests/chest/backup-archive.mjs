// Public CLI recovery journey. Only Cloudflare's network and Wrangler's remote
// boundary are faked; schema, SQLite, sanitization, encryption and IO are real.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm, chmod, copyFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { openArchive, sealArchive } from '../../scripts/backup/archive.mjs';
import { archiveKey } from '../../scripts/backup/crypto.mjs';
import { inspectDatabase } from '../../scripts/backup/database.mjs';

const root=resolve(import.meta.dirname,'../..'), temp=await mkdtemp(join(tmpdir(),'chest-backup-test-'));
const key=randomBytes(32).toString('hex'), bytes=Buffer.alloc(65*1024*1024,87), hash=createHash('sha256').update(bytes).digest('hex');
const source=join(temp,'source.sqlite'), target=join(temp,'target.sqlite'), bin=join(temp,'bin'), edge=join(temp,'edge');
await chmod(temp,0o700);
try {
  await Promise.all([mkdir(bin),mkdir(edge)]);
  const migrations=(await readdir(join(root,'migrations/core'))).filter(f=>f.endsWith('.sql')).sort();
  for(const file of [source,target]) {
    const db=new DatabaseSync(file); db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT);');
    for(let i=0;i<migrations.length;i++){db.exec(await readFile(join(root,'migrations/core',migrations[i]),'utf8'));db.prepare('INSERT INTO d1_migrations VALUES(?,?)').run(i,migrations[i]);}
    db.close();
  }
  const db=new DatabaseSync(source), at='2026-10-19T00:00:00.000Z';
  db.prepare('INSERT INTO rer_portability_state(id,source_identity,epoch,import_job,applying) VALUES(1,?,0,?,1)').run('independent-source','active-transfer-does-not-travel');
  db.prepare('INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,?,?,?,?,?,?)').run('owner','owner@example.test','Owner','owner','active',1,1);
  db.prepare('INSERT INTO oa_bootstrap VALUES(1,?,1)').run('old-bootstrap-authority');
  db.prepare("INSERT INTO oa_tokens VALUES('old-token','OLD_MAGIC_HASH','magic','owner',1,NULL,NULL,'/',1,9999999999999,NULL,NULL)").run();
  db.prepare("INSERT INTO oa_sessions VALUES('old-session','OLD_SESSION_HASH','owner',1,'native','old-token',1,9999999999999,NULL)").run();
  db.prepare("INSERT INTO chest_integration_secrets(id,value,email) VALUES('old-oauth-token','OLD_OAUTH_AUTHORITY','staff@example.test')").run();
  db.prepare("INSERT INTO chest_device_credentials VALUES('OLD_DEVICE_HASH','device','owner@example.test',?,NULL,NULL)").run(at);
  db.prepare("INSERT INTO chest_reader VALUES(1,'openai','https://example.test','model','workspace','OLD_READER_SECRET','hint','owner@example.test',?)").run(at);
  db.prepare("INSERT INTO chest_sso_config VALUES(1,?, 'revision',NULL,0)").run(JSON.stringify({clientSecret:'OLD_SSO_SECRET'}));
  db.prepare("INSERT INTO rer_dependency_keys VALUES('provider','OLD_PRIVATE_KEY')").run();
  const records=[
    ['item','item',{space:'space',parent:null,type:'file',name:'Retained.txt',versions:[{id:'v1',checksum:hash,size:bytes.length,text:'{"token":"contract reference in the original"}'}],current:'v1',filing:{schema:'case-type',owner:'owner@example.test',fields:{token:'customer reference',secret:'case description'}},grants:[],trash:null}],
    ['space','space',{name:'Independent',kind:'team',owner:'owner@example.test',members:[],settings:{noDownload:false}}],
    ['comment','comment',{item:'item',version:'v1',message:'Keep the complete graph',at}],
    ['mapping','migration-source-map',{sourceId:'remote:42',targetId:'item',revision:'v1'}],
    ['link','public-link',{item:'item',tokenHash:'OLD_LINK_HASH',password:{hash:'OLD_PASSWORD_HASH',salt:'old'},expires:null,at}],
    ['request','file-request',{folder:'folder',tokenHash:'OLD_REQUEST_HASH',title:'Retain definition',at}],
    ['device','device',{owner:'owner@example.test',name:'Must not transfer'}],
    ['ticket','transfer-session',{transfer:'package',tokenHash:'OLD_TICKET_HASH'}],
    ['notice','notice',{item:'item',message:'History retained',email:'queued'}],
    ['job','send-job',{item:'item',state:'queued',token:'OLD_JOB_TOKEN'}],
    ['checklist','collection-checklist',{title:'Retain rules',sendReminders:true,enabled:true,requirements:[{item:'item',version:'v1'}]}],
    ['future','new-product-record',{id:'future',comments:['comment'],versions:['v1'],rules:{keep:true}}],
    ['schedule','backup-settings',{enabled:true,everyHours:24,retentionDays:30,bucket:'owner-backups',requestedAt:at,lastClaim:at}],
    ['backup-execution','backup-run',{state:'running',at}],
    ['filing-authority','filing_scope',{source:'folder',enabled:true}],
    ['link-authority','link-scope',{item:'item',automatic:true}],
    ['expired-job','expiry',{item:'item',expires:at}],
    ['unfinished','upload',{state:'open',multipart:'OLD_MULTIPART_AUTHORITY',key:'old-staging'}],
  ];
  for(const [id,kind,payload] of records) db.prepare('INSERT INTO chest_records VALUES(?,?,?,?)').run(id,kind,JSON.stringify(payload),'revision-'+id);
  db.close();
  const bucketPath=(account,bucket)=>join(edge,account,bucket);
  const liveBucket=bucketPath('live-account','chest-production-blobs'); await mkdir(join(liveBucket,'sha256'),{recursive:true}); await writeFile(join(liveBucket,'sha256',hash),bytes);
  await mkdir(bucketPath('owner-account','owner-backups'),{recursive:true});
  await mkdir(bucketPath('recovery-account','chest-recovery-blobs'),{recursive:true});
  const preload=join(temp,'cloudflare-edge.mjs');
  await copyFile(join(root,'tests/chest/backup-storage-edge.mjs'),preload);
  await writeFile(join(bin,'npx'),`#!/usr/bin/env node
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const args=process.argv.slice(2),home=process.env.CHEST_BACKUP_TEST_HOME,file=join(home,process.env.CLOUDFLARE_ACCOUNT_ID==='recovery-account'?'target.sqlite':'source.sqlite');
if(args.includes('export')){const result=spawnSync('/usr/bin/sqlite3',[file,'.dump'],{maxBuffer:32*1024*1024});if(result.status!==0)process.exit(1);await writeFile(args[args.indexOf('--output')+1],result.stdout);}
else if(args.includes('execute')){const db=new DatabaseSync(file);try{db.exec(await readFile(args[args.indexOf('--file')+1],'utf8'));}finally{db.close();}}
else process.exit(1);
`); await chmod(join(bin,'npx'),0o700);
  const env={...process.env,PATH:bin+':'+process.env.PATH,CHEST_BACKUP_TEST_HOME:temp,CLOUDFLARE_ACCOUNT_ID:'live-account',CLOUDFLARE_API_TOKEN:'synthetic-chest-1',CHEST_BACKUP_ACCOUNT_ID:'owner-account',CHEST_BACKUP_API_TOKEN:'synthetic-chest-2',CHEST_BACKUP_BUCKET:'owner-backups',CHEST_BACKUP_KEY:key};
  async function cli(args,{account='live-account',refuse=false,entry='cli',extra={}}={}) {
    const child=spawn(process.execPath,['--import',preload,join(root,'scripts/backup/'+entry+'.mjs'),...args],{cwd:root,env:{...env,...extra,CLOUDFLARE_ACCOUNT_ID:account},stdio:['ignore','pipe','pipe']});
    let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);
    const code=await new Promise(r=>child.on('exit',r));
    assert.equal(code,refuse?1:0,refuse?'Unsafe recovery was refused':'CLI operation succeeded: '+err);
    return refuse?null:JSON.parse(out);
  }
  const receipt=await cli(['backup','--environment','production','--retention-days','30']);
  assert.equal(receipt.objects,1); const stored=join(bucketPath('owner-account','owner-backups'),receipt.key);
  const encrypted=await readFile(stored); assert.ok(!encrypted.includes(Buffer.from('Keep the complete graph')));
  const extracted=join(temp,'inspection');await mkdir(extracted,{mode:0o700});
  const manifest=await openArchive({input:stored,directory:extracted,key:archiveKey(key)});
  inspectDatabase(join(extracted,'database.sqlite'));
  const sanitized=await readFile(join(extracted,'database.sqlite'));
  for(const secret of ['OLD_MAGIC_HASH','OLD_SESSION_HASH','OLD_DEVICE_HASH','OLD_READER_SECRET','OLD_SSO_SECRET','OLD_PRIVATE_KEY','OLD_LINK_HASH','OLD_PASSWORD_HASH','OLD_REQUEST_HASH','OLD_TICKET_HASH','OLD_JOB_TOKEN','OLD_MULTIPART_AUTHORITY'])assert.ok(!sanitized.includes(Buffer.from(secret)),'Authority bytes are absent, including free pages');
  assert.equal((await cli(['list','--environment','production'])).length,1);
  assert.equal((await cli(['verify','--environment','production','--key',receipt.key])).verified,true);
  const corrupt=join(temp,'corrupt.chestenc'),changed=Buffer.from(encrypted);changed[Math.floor(changed.length/2)]^=1;await writeFile(corrupt,changed);
  const before=await readFile(target),originalTarget=bucketPath('recovery-account','chest-recovery-blobs');
  for(const variant of [changed,encrypted.subarray(0,encrypted.length-20),Buffer.concat([encrypted,Buffer.from('appended')])]) {
    await writeFile(corrupt,variant);await cli(['restore','--environment','recovery','--input',corrupt,'--acknowledge-offline-erasures'],{account:'recovery-account',refuse:true});
    assert.deepEqual(await readFile(target),before);assert.deepEqual(await readdir(originalTarget),[]);
  }
  // Even an authenticated archive is refused if its semantic graph refers to
  // missing original bytes. Authentication alone does not establish completeness.
  const missing=join(temp,'missing.chestenc'),{entries,...metadata}=manifest;
  await sealArchive({directory:extracted,output:missing,key:archiveKey(key),metadata,paths:['database.sqlite']});
  await cli(['restore','--environment','recovery','--input',missing,'--acknowledge-offline-erasures'],{account:'recovery-account',refuse:true});
  assert.deepEqual(await readFile(target),before);assert.deepEqual(await readdir(originalTarget),[]);
  const laterJournal=join(temp,'later-source-journal.json');
  for(const source of ['independent-source','unrelated-source']) {
    await writeFile(laterJournal,JSON.stringify({format:'chest-erasure-journal-1',source,entries:[{id:'later-erasure',at,items:['item'],documents:[],identities:[],checksums:[hash]}]}),{mode:0o600});
    await cli(['restore','--environment','recovery','--input',stored,'--erasure-journal',laterJournal],{account:'recovery-account',refuse:true});
    assert.deepEqual(await readFile(target),before);assert.deepEqual(await readdir(originalTarget),[]);
  }
  assert.equal((await cli(['restore','--environment','recovery','--input',stored,'--acknowledge-offline-erasures'],{account:'recovery-account'})).restored,true);
  const restored=new DatabaseSync(target);
  assert.deepEqual({...restored.prepare('SELECT source_identity,import_job,applying FROM rer_portability_state WHERE id=1').get()},{source_identity:'independent-source',import_job:null,applying:0});
  for(const [id,kind,payload] of records.filter(r=>['item','space','comment','mapping','future'].includes(r[0])))assert.deepEqual(JSON.parse(restored.prepare('SELECT payload FROM chest_records WHERE id=?').get(id).payload),payload);
  assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM oa_sessions').get().n,0);
  assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM chest_device_credentials').get().n,0);
  assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM chest_records WHERE kind IN ('device','transfer-session')").get().n,0);
  const record=id=>JSON.parse(restored.prepare('SELECT payload FROM chest_records WHERE id=?').get(id).payload);
  assert.equal(record('link').tokenHash,'');assert.ok(record('link').revokedAt);assert.equal(record('job').state,'cancelled');assert.equal(record('notice').email,'suppressed:restored_archive');assert.equal(record('checklist').sendReminders,false);
  assert.equal(record('schedule').enabled,false);assert.equal(record('schedule').requestedAt,null);assert.equal(record('backup-execution').state,'interrupted');assert.ok(record('backup-execution').notifiedAt);assert.equal(record('filing-authority').enabled,false);assert.equal(record('link-authority').automatic,false);assert.ok(record('expired-job').expiredAt);assert.equal(record('unfinished').state,'interrupted');
  assert.notEqual(restored.prepare('SELECT claim_id FROM oa_bootstrap').get().claim_id,'old-bootstrap-authority');restored.close();
  assert.deepEqual(await readFile(join(originalTarget,'sha256',hash)),bytes);
  const after=await readFile(target);await cli(['restore','--environment','recovery','--input',stored,'--acknowledge-offline-erasures'],{account:'recovery-account',refuse:true});assert.deepEqual(await readFile(target),after);
  // Retention touches only the exact archive namespace and preserves newest.
  const oldKey=receipt.key.replace(/\/\d{4}-\d\d-\d\dT/,'/2000-01-01T');await copyFile(stored,join(bucketPath('owner-account','owner-backups'),oldKey));
  assert.equal((await cli(['prune','--environment','production','--retention-days','1'])).length,1);assert.equal((await stat(stored)).size,receipt.bytes);
  assert.equal(manifest.entries.length,2);
  const scheduled=new DatabaseSync(source),scheduleId='backup-settings:independent';
  scheduled.prepare('INSERT INTO chest_records VALUES(?,?,?,?)').run(scheduleId,'backup-settings',JSON.stringify({enabled:true,everyHours:24,retentionDays:30,bucket:'owner-backups',requestedAt:null}),'scheduled-revision');scheduled.close();
  assert.equal((await cli(['--environment','production'],{entry:'schedule'})).state,'running_requires_inspection');
  const cleared=new DatabaseSync(source);cleared.prepare("UPDATE chest_records SET payload=json_set(payload,'$.state','interrupted','$.at','2000-01-01T00:00:00Z') WHERE id='backup-execution'").run();cleared.close();
  const scheduledReceipt=await cli(['--environment','production'],{entry:'schedule'});assert.equal(scheduledReceipt.state,'complete');assert.ok(scheduledReceipt.checkedAt);
  assert.equal((await cli(['--environment','production'],{entry:'schedule'})).state,'not_due');
  const requested=new DatabaseSync(source);requested.prepare("UPDATE chest_records SET payload=json_set(payload,'$.requestedAt',?),revision='manual-request' WHERE id=?").run(new Date().toISOString(),scheduleId);requested.close();
  await cli(['--environment','production'],{entry:'schedule',extra:{CHEST_BACKUP_TEST_FAIL:'yes'},refuse:true});
  const failed=new DatabaseSync(source);assert.equal(JSON.parse(failed.prepare("SELECT payload FROM chest_records WHERE kind='backup-run' ORDER BY json_extract(payload,'$.at') DESC LIMIT 1").get().payload).state,'failed');failed.close();
  // Each independent destination uses the same encrypted archive, CLI, cadence and recovery path.
  for(const endpoint of ['https://s3.us-east-1.amazonaws.com','https://backup.example.test']) {
    const extra={CHEST_BACKUP_PROVIDER:'s3',CHEST_BACKUP_S3_ENDPOINT:endpoint,CHEST_BACKUP_S3_REGION:endpoint.includes('amazonaws')?'us-east-1':'eu-west-2',CHEST_BACKUP_S3_ACCESS_KEY_ID:'synthetic-chest-3',CHEST_BACKUP_S3_SECRET_ACCESS_KEY:'synthetic-chest-4',CHEST_BACKUP_S3_SESSION_TOKEN:'synthetic-chest-5'};
    await mkdir(bucketPath('s3-owner','owner-backups'),{recursive:true});
    const s3=await cli(['backup','--environment','production'],{extra});
    assert.equal((await cli(['verify','--environment','production','--key',s3.key],{extra})).verified,true);
    const s3Stored=join(bucketPath('s3-owner','owner-backups'),s3.key);
    const oldS3=s3.key.replace(/\/\d{4}-\d\d-\d\dT/,'/2000-01-01T');await copyFile(s3Stored,join(bucketPath('s3-owner','owner-backups'),oldS3));
    assert.ok((await cli(['list','--environment','production'],{extra})).some(b=>b.key===oldS3),'paginated destination lists all archives');
    assert.ok((await cli(['prune','--environment','production','--retention-days','1'],{extra})).includes(oldS3));
    // Recover the S3 copy into an empty real SQLite/original target after corrupting its live source.
    const reset=new DatabaseSync(target);for(const table of reset.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'chest_%' OR name LIKE 'ik_%')").all())reset.exec('DELETE FROM "'+table.name+'"');reset.close();await rm(originalTarget,{recursive:true});await mkdir(originalTarget);
    await writeFile(join(liveBucket,'sha256',hash),'corrupt live original');
    assert.equal((await cli(['restore','--environment','recovery','--input',s3Stored,'--acknowledge-offline-erasures'],{account:'recovery-account',extra})).restored,true);
    assert.deepEqual(await readFile(join(originalTarget,'sha256',hash)),bytes);await writeFile(join(liveBucket,'sha256',hash),bytes);
    const request=new DatabaseSync(source);request.prepare("UPDATE chest_records SET payload=json_set(payload,'$.requestedAt',?),revision=? WHERE id=?").run(new Date(Date.now()+1000).toISOString(),endpoint,scheduleId);request.close();
    assert.equal((await cli(['--environment','production'],{entry:'schedule',extra})).state,'complete');
    await cli(['backup','--environment','production'],{extra:{...extra,CHEST_BACKUP_TEST_COMPLETE_FAIL:'yes'},refuse:true});
    assert.deepEqual(await readdir(join(temp,'parts','s3-owner')).catch(()=>[]),[],'failed multipart completion aborts private staging');
    console.log('S3 destination CLI passed: signed multipart backup, readback, verify, paginated retention, corruption recovery, schedule and failed completion: '+endpoint);
  }
  console.log('Scheduled CLI passed: durable claims, completed authenticated copy, cadence, no replay and recorded independent-provider failure.');
  console.log('Independent backup CLI passed: complete schema/graph/original roundtrip, credential exclusion, inert links/jobs, encrypted tamper/truncation/append refusal before target writes, empty-target refusal and scoped retention.');
} finally { await rm(temp,{recursive:true,force:true}); }
