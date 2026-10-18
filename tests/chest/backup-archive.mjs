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
const key=randomBytes(32).toString('hex'), bytes=Buffer.alloc(9*1024*1024,87), hash=createHash('sha256').update(bytes).digest('hex');
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
  db.prepare('INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,?,?,?,?,?,?)').run('owner','owner@example.test','Owner','owner','active',1,1);
  db.prepare('INSERT INTO oa_bootstrap VALUES(1,?,1)').run('old-bootstrap-authority');
  db.prepare("INSERT INTO oa_tokens VALUES('old-token','OLD_MAGIC_HASH','magic','owner',1,NULL,NULL,'/',1,9999999999999,NULL,NULL)").run();
  db.prepare("INSERT INTO oa_sessions VALUES('old-session','OLD_SESSION_HASH','owner',1,'native','old-token',1,9999999999999,NULL)").run();
  db.prepare("INSERT INTO chest_device_credentials VALUES('OLD_DEVICE_HASH','device','owner@example.test',?,NULL,NULL)").run(at);
  db.prepare("INSERT INTO chest_reader VALUES(1,'openai','https://example.test','model','workspace','OLD_READER_SECRET','hint','owner@example.test',?)").run(at);
  db.prepare("INSERT INTO chest_sso_config VALUES(1,?, 'revision',NULL,0)").run(JSON.stringify({clientSecret:'OLD_SSO_SECRET'}));
  db.prepare("INSERT INTO rer_dependency_keys VALUES('provider','OLD_PRIVATE_KEY')").run();
  const records=[
    ['item','item',{space:'space',parent:null,type:'file',name:'Retained.txt',versions:[{id:'v1',checksum:hash,size:bytes.length}],current:'v1',grants:[],trash:null}],
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
  ];
  for(const [id,kind,payload] of records) db.prepare('INSERT INTO chest_records VALUES(?,?,?,?)').run(id,kind,JSON.stringify(payload),'revision-'+id);
  db.close();
  const bucketPath=(account,bucket)=>join(edge,account,bucket);
  const liveBucket=bucketPath('live-account','chest-production-blobs'); await mkdir(join(liveBucket,'sha256'),{recursive:true}); await writeFile(join(liveBucket,'sha256',hash),bytes);
  await mkdir(bucketPath('owner-account','owner-backups'),{recursive:true});
  await mkdir(bucketPath('recovery-account','chest-recovery-blobs'),{recursive:true});
  const preload=join(temp,'cloudflare-edge.mjs');
  await writeFile(preload,`import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir,readdir,stat,rm} from 'node:fs/promises';
import {join,dirname,relative} from 'node:path';
const home=process.env.CHEST_BACKUP_TEST_HOME;
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=join(dir,entry.name);if(entry.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
globalThis.fetch=async(input,init={})=>{
 const url=new URL(input),method=init.method??'GET';
 const json=result=>Response.json({success:true,result});
 if(url.hostname==='api.cloudflare.com'){
  if(url.pathname.endsWith('/tokens/verify'))return json({id:'test-access-key'});
  const account=url.pathname.split('/')[4],file=join(home,account==='recovery-account'?'target.sqlite':'source.sqlite');
  if(url.pathname.endsWith('/d1/database'))return json([{name:url.searchParams.get('name'),uuid:'database'}]);
  if(url.pathname.endsWith('/query')){const db=new DatabaseSync(file);try{return json([{results:db.prepare(JSON.parse(init.body).sql).all()}]);}finally{db.close();}}
 }
 if(url.hostname.endsWith('.r2.cloudflarestorage.com')){
  if(process.env.CHEST_BACKUP_TEST_FAIL==='yes'&&method==='PUT')throw Error('Independent provider refused write');
  const account=url.hostname.split('.')[0],parts=url.pathname.slice(1).split('/').map(decodeURIComponent),bucket=join(home,'edge',account,parts.shift()),key=parts.join('/'),file=join(bucket,key);
  if(method==='GET'&&url.searchParams.has('list-type')){const prefix=url.searchParams.get('prefix')??'',all=await files(bucket);return new Response('<ListBucketResult><IsTruncated>false</IsTruncated>'+ (await Promise.all(all.map(async p=>({key:relative(bucket,p),size:(await stat(p)).size})))).filter(o=>o.key.startsWith(prefix)).map(o=>'<Contents><Key>'+o.key+'</Key><Size>'+o.size+'</Size></Contents>').join('')+'</ListBucketResult>');}
  if(method==='GET')return new Response(await readFile(file));
  if(method==='PUT'){await mkdir(dirname(file),{recursive:true});await writeFile(file,init.body);return new Response('',{headers:{etag:'test-etag'}});}
 }
 throw new Error('Unexpected provider edge request');
};`);
  await writeFile(join(bin,'npx'),`#!/usr/bin/env node
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const args=process.argv.slice(2),home=process.env.CHEST_BACKUP_TEST_HOME,file=join(home,process.env.CLOUDFLARE_ACCOUNT_ID==='recovery-account'?'target.sqlite':'source.sqlite');
if(args.includes('export')){const result=spawnSync('/usr/bin/sqlite3',[file,'.dump'],{maxBuffer:32*1024*1024});if(result.status!==0)process.exit(1);await writeFile(args[args.indexOf('--output')+1],result.stdout);}
else if(args.includes('execute')){const db=new DatabaseSync(file);try{db.exec(await readFile(args[args.indexOf('--file')+1],'utf8'));}finally{db.close();}}
else if(args.includes('delete')){const object=args[args.indexOf('delete')+1];await rm(join(home,'edge',process.env.CLOUDFLARE_ACCOUNT_ID,object));}
else process.exit(1);
`); await chmod(join(bin,'npx'),0o700);
  const env={...process.env,PATH:bin+':'+process.env.PATH,CHEST_BACKUP_TEST_HOME:temp,CLOUDFLARE_ACCOUNT_ID:'live-account',CLOUDFLARE_API_TOKEN:'fake-live-edge',CHEST_BACKUP_ACCOUNT_ID:'owner-account',CHEST_BACKUP_API_TOKEN:'fake-owner-edge',CHEST_BACKUP_BUCKET:'owner-backups',CHEST_BACKUP_KEY:key};
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
  for(const secret of ['OLD_MAGIC_HASH','OLD_SESSION_HASH','OLD_DEVICE_HASH','OLD_READER_SECRET','OLD_SSO_SECRET','OLD_PRIVATE_KEY','OLD_LINK_HASH','OLD_PASSWORD_HASH','OLD_REQUEST_HASH','OLD_TICKET_HASH','OLD_JOB_TOKEN'])assert.ok(!sanitized.includes(Buffer.from(secret)),'Authority bytes are absent, including free pages');
  assert.equal((await cli(['list','--environment','production'])).length,1);
  assert.equal((await cli(['verify','--environment','production','--key',receipt.key])).verified,true);
  const corrupt=join(temp,'corrupt.chestenc'),changed=Buffer.from(encrypted);changed[Math.floor(changed.length/2)]^=1;await writeFile(corrupt,changed);
  const before=await readFile(target),originalTarget=bucketPath('recovery-account','chest-recovery-blobs');
  for(const variant of [changed,encrypted.subarray(0,encrypted.length-20),Buffer.concat([encrypted,Buffer.from('appended')])]) {
    await writeFile(corrupt,variant);await cli(['restore','--environment','recovery','--input',corrupt],{account:'recovery-account',refuse:true});
    assert.deepEqual(await readFile(target),before);assert.deepEqual(await readdir(originalTarget),[]);
  }
  // Even an authenticated archive is refused if its semantic graph refers to
  // missing original bytes. Authentication alone does not establish completeness.
  const missing=join(temp,'missing.chestenc'),{entries,...metadata}=manifest;
  await sealArchive({directory:extracted,output:missing,key:archiveKey(key),metadata,paths:['database.sqlite']});
  await cli(['restore','--environment','recovery','--input',missing],{account:'recovery-account',refuse:true});
  assert.deepEqual(await readFile(target),before);assert.deepEqual(await readdir(originalTarget),[]);
  assert.equal((await cli(['restore','--environment','recovery','--input',stored],{account:'recovery-account'})).restored,true);
  const restored=new DatabaseSync(target);
  for(const [id,kind,payload] of records.filter(r=>['item','space','comment','mapping','future'].includes(r[0])))assert.deepEqual(JSON.parse(restored.prepare('SELECT payload FROM chest_records WHERE id=?').get(id).payload),payload);
  assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM oa_sessions').get().n,0);
  assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM chest_device_credentials').get().n,0);
  assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM chest_records WHERE kind IN ('device','transfer-session')").get().n,0);
  const record=id=>JSON.parse(restored.prepare('SELECT payload FROM chest_records WHERE id=?').get(id).payload);
  assert.equal(record('link').tokenHash,'');assert.ok(record('link').revokedAt);assert.equal(record('job').state,'cancelled');assert.equal(record('notice').email,'suppressed:restored_archive');assert.equal(record('checklist').sendReminders,false);
  assert.equal(record('schedule').enabled,false);assert.equal(record('schedule').requestedAt,null);assert.equal(record('backup-execution').state,'interrupted');
  assert.notEqual(restored.prepare('SELECT claim_id FROM oa_bootstrap').get().claim_id,'old-bootstrap-authority');restored.close();
  assert.deepEqual(await readFile(join(originalTarget,'sha256',hash)),bytes);
  const after=await readFile(target);await cli(['restore','--environment','recovery','--input',stored],{account:'recovery-account',refuse:true});assert.deepEqual(await readFile(target),after);
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
  console.log('Scheduled CLI passed: durable claims, completed authenticated copy, cadence, no replay and recorded independent-provider failure.');
  console.log('Independent backup CLI passed: complete schema/graph/original roundtrip, credential exclusion, inert links/jobs, encrypted tamper/truncation/append refusal before target writes, empty-target refusal and scoped retention.');
} finally { await rm(temp,{recursive:true,force:true}); }
