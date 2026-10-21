// Explicit held-account journey; not part of push Verify. Credentials come only
// from _od08-env.py. Every resource is created here and removed in finally.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {r2} from '../../scripts/hosted/r2.mjs';
import {s3} from '../../scripts/hosted/s3.mjs';

const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(account!=='b20c0ca9cab0c2b70e13d7cf724b89bd'||!token)throw Error('Run only through _od08-env.py with the RunEditRun held stage credential.');
const environment='sx-c6-'+randomUUID().slice(0,8),recovery=environment+'r';
const buckets=[`chest-${environment}-blobs`,`chest-${environment}-independent`,`chest-${recovery}-blobs`];
const databases=[],createdBuckets=[],directory=await mkdtemp(join(tmpdir(),'chest-live-backup-'));
await chmod(directory,0o700);
let archives,live,target,passed=false,cleanupFailed=false;
async function api(method,path,body){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json();if(!response.ok||!data.success)throw Error(`Sandbox provider refused ${method} (${response.status}).`);return data.result;
}
const sql=(id,query)=>api('POST',`/d1/database/${id}/query`,{sql:query});
async function cli(entry,args,{refuse=false}={}){
 const child=spawn(process.execPath,[`scripts/backup/${entry}.mjs`,...args],{env:{...process.env,...backupEnv},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.resume();
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 assert.equal(code,refuse?1:0,'live public backup command succeeds or refuses unsafe recovery');
 return refuse?null:JSON.parse(output);
}
let backupEnv;
console.log('Live sandbox group: '+environment);
try{
 const parent=await api('GET','/tokens/verify');
 for(const name of buckets){await api('POST','/r2/buckets',{name});createdBuckets.push(name)}
 for(const name of [environment,recovery])databases.push(await api('POST','/d1/database',{name:`chest-${name}-db`}));
 const migrations=(await readdir('migrations/core')).filter(name=>name.endsWith('.sql')).sort();
 for(const db of databases){
  await sql(db.uuid,'CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT);');
  for(let index=0;index<migrations.length;index++)await sql(db.uuid,(await readFile(join('migrations/core',migrations[index]),'utf8'))+`\nINSERT INTO d1_migrations VALUES(${index},'${migrations[index]}');`);
 }
 const bytes=Buffer.from('synthetic-chest-1: retained original and review history\n'),hash=createHash('sha256').update(bytes).digest('hex'),original=join(directory,'original');await writeFile(original,bytes,{mode:0o600});
 const records=[
  ['synthetic-chest-1','item',{space:'synthetic-chest-2',parent:null,type:'file',name:'Harbor contract.txt',versions:[{id:'synthetic-chest-3',checksum:hash,size:bytes.length}],current:'synthetic-chest-3',grants:[],trash:null}],
  ['synthetic-chest-2','space',{name:'Harbor vendor agreements',kind:'team',owner:'owner@example.test',members:[],settings:{noDownload:false}}],
  ['synthetic-chest-4','comment',{item:'synthetic-chest-1',version:'synthetic-chest-3',message:'Retain this approved original'}],
  ['synthetic-chest-5','migration-source-map',{sourceId:'synthetic-chest-6',targetId:'synthetic-chest-1'}],
  ['synthetic-chest-7','public-link',{item:'synthetic-chest-1',tokenHash:'synthetic-chest-8'}],
  ['synthetic-chest-9','send-job',{item:'synthetic-chest-1',state:'queued',token:'synthetic-chest-10'}],
  ['backup-settings:independent','backup-settings',{bucket:buckets[1],enabled:true,everyHours:24,retentionDays:30,requestedAt:null}]
 ];
 const literal=value=>"'"+value.replaceAll("'","''")+"'";
 for(const [id,kind,payload] of records)await sql(databases[0].uuid,`INSERT INTO chest_records VALUES(${literal(id)},${literal(kind)},${literal(JSON.stringify(payload))},'synthetic-chest-11')`);
 await sql(databases[0].uuid,"INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('synthetic-chest-12','owner@example.test','Harbor owner','owner','active',1,1)");
 await sql(databases[0].uuid,"INSERT INTO chest_integration_secrets(id,value,email) VALUES('synthetic-chest-13','synthetic-chest-14','owner@example.test')");
 live=await r2({account,token},buckets[0]);target=await r2({account,token},buckets[2]);await live.upload('sha256/'+hash,original);
 const temporary=await api('POST','/r2/temp-access-credentials',{bucket:buckets[1],parentAccessKeyId:parent.id,permission:'object-read-write',ttlSeconds:900});
 assert.ok(temporary.accessKeyId&&temporary.secretAccessKey&&temporary.sessionToken,'provider issued separate destination credentials');
 const endpoint=`https://${account}.r2.cloudflarestorage.com`;
 archives=s3({endpoint,region:'auto',...temporary},buckets[1]);
 let refused=false;try{for await(const object of s3({endpoint,region:'auto',...temporary},buckets[0]).list(''))void object}catch{refused=true}assert.ok(refused,'independent destination credentials cannot read live originals');
 backupEnv={CHEST_BACKUP_PROVIDER:'s3',CHEST_BACKUP_S3_ENDPOINT:endpoint,CHEST_BACKUP_S3_REGION:'auto',CHEST_BACKUP_S3_ACCESS_KEY_ID:temporary.accessKeyId,CHEST_BACKUP_S3_SECRET_ACCESS_KEY:temporary.secretAccessKey,CHEST_BACKUP_S3_SESSION_TOKEN:temporary.sessionToken,CHEST_BACKUP_BUCKET:buckets[1],CHEST_BACKUP_KEY:randomBytes(32).toString('hex')};
 const receipt=await cli('cli',['backup','--environment',environment,'--retention-days','30']);assert.equal(receipt.objects,1);
 assert.equal((await cli('cli',['verify','--environment',environment,'--key',receipt.key])).verified,true);
 const archive=join(directory,'private.chestenc');await archives.download(receipt.key,archive);
 assert.ok(!(await readFile(archive)).includes(bytes),'remote backup contains only encrypted originals');
 const old=receipt.key.replace(/\/\d{4}-\d\d-\d\dT/,'/2000-01-01T');await archives.upload(old,archive);
 assert.ok((await cli('cli',['list','--environment',environment])).some(row=>row.key===old));
 assert.deepEqual(await cli('cli',['prune','--environment',environment,'--retention-days','1']),[old]);
 assert.equal((await cli('schedule',['--environment',environment])).state,'complete','real schedule records authenticated success');
 // Destroy the live bytes. Recovery must use the independently authenticated copy.
 await writeFile(original,'corrupt live bytes');await live.upload('sha256/'+hash,original);
 await cli('cli',['backup','--environment',environment],{refuse:true});
 const restored=await cli('cli',['restore','--environment',recovery,'--input',archive,'--acknowledge-offline-erasures']);assert.equal(restored.restored,true);assert.equal(restored.providersNeedAuthorization,true);
 const rows=(await sql(databases[1].uuid,'SELECT id,kind,payload FROM chest_records'))[0].results;
 for(const [id,kind,payload] of records.slice(0,4))assert.deepEqual(JSON.parse(rows.find(row=>row.id===id).payload),payload,'live clean-target graph reconciles');
 assert.ok(JSON.parse(rows.find(row=>row.kind==='public-link').payload).revokedAt);
 assert.equal(JSON.parse(rows.find(row=>row.kind==='send-job').payload).state,'cancelled');
 assert.equal(JSON.parse(rows.find(row=>row.kind==='backup-settings').payload).enabled,false);
 assert.equal((await sql(databases[1].uuid,'SELECT COUNT(*) AS n FROM chest_integration_secrets'))[0].results[0].n,0);
 const recovered=join(directory,'recovered');await target.download('sha256/'+hash,recovered);assert.deepEqual(await readFile(recovered),bytes);
 await cli('cli',['restore','--environment',recovery,'--input',archive,'--acknowledge-offline-erasures'],{refuse:true});
 passed=true;
}finally{
 for(const bucket of createdBuckets){
  try{const store=await r2({account,token},bucket);for await(const object of store.list(''))await store.delete(object.key);await api('DELETE',`/r2/buckets/${bucket}`)}catch{cleanupFailed=true}
 }
 for(const database of databases)try{await api('DELETE',`/d1/database/${database.uuid}`)}catch{cleanupFailed=true}
 await rm(directory,{recursive:true,force:true});
 if(cleanupFailed)throw Error('Sandbox cleanup incomplete; inspect only this journey’s named resources.');
}
assert.ok(passed);
console.log(JSON.stringify({journey:'Live S3-compatible independent backup and recovery',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),provider:'R2 S3 API with separate temporary bucket credentials',checks:['backup','authenticated readback','retention','scheduled success','corrupt-live refusal','empty-target graph and hash recovery','inert authority','populated-target refusal'],resourcesRemoved:true}));
