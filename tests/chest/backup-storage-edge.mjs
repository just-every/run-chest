// Provider network edge for the public backup CLI journey.
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir,readdir,stat,rm} from 'node:fs/promises';
import {join,dirname,relative} from 'node:path';
const home=process.env.CHEST_BACKUP_TEST_HOME;let exportStarted=false,exportNoSchema=false,importBytes,importAccount;
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=join(dir,entry.name);if(entry.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
globalThis.fetch=async(input,init={})=>{
 const url=new URL(input),method=init.method??'GET';
 const json=result=>Response.json({success:true,result});
 if(url.hostname==='synthetic-chest-import.test'){
  importBytes=Buffer.from(init.body);return new Response('',{headers:{etag:'"'+createHash('md5').update(importBytes).digest('hex')+'"'}});
 }
 if(url.hostname==='synthetic-chest-database.test'){
  const result=spawnSync('sqlite3',[join(home,'source.sqlite'),'.dump'],{maxBuffer:64*1024*1024});assert.equal(result.status,0);return new Response(exportNoSchema?result.stdout.toString('utf8').split('\n').filter(line=>line.startsWith('INSERT INTO')).join('\n'):result.stdout);
 }
 if(url.hostname==='api.cloudflare.com'){
  if(url.pathname.endsWith('/tokens/verify'))return json({id:'test-access-key'});
  const account=url.pathname.split('/')[4],file=join(home,account==='recovery-account'?'target.sqlite':'source.sqlite');
  assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+(account==='recovery-account'?'synthetic-chest-7':'synthetic-chest-1'),'provider requires the newly supplied target credential');
  if(url.pathname.endsWith('/d1/database'))return json([{name:url.searchParams.get('name'),uuid:'database'}]);
  if(url.pathname.endsWith('/import')){
   const body=JSON.parse(init.body);
   if(body.action==='init'){importAccount=account;return json({upload_url:'https://synthetic-chest-import.test/upload',filename:'synthetic-chest-8'});}
   assert.equal(body.action,'ingest');assert.equal(importAccount,account);assert.equal(body.etag,createHash('md5').update(importBytes).digest('hex'));
   const db=new DatabaseSync(file);try{db.exec('BEGIN;');db.exec(importBytes.toString('utf8'));db.exec('COMMIT;');}finally{db.close();}return json({success:true,status:'complete'});
  }
  if(url.pathname.endsWith('/export')){const body=JSON.parse(init.body);exportNoSchema=body.dump_options.no_schema;assert.deepEqual(body,{output_format:'polling',dump_options:{no_schema:exportNoSchema,no_data:false,tables:[]},...(exportStarted?{current_bookmark:'synthetic-chest-bookmark'}:{})});if(!exportStarted){exportStarted=true;return json({success:true,status:'active',at_bookmark:'synthetic-chest-bookmark'});}return json({success:true,status:'complete',result:{signed_url:process.env.CHEST_BACKUP_TEST_UNSAFE_EXPORT==='yes'?'http://synthetic-chest-database.test/download':'https://synthetic-chest-database.test/download'}});}
  if(url.pathname.endsWith('/query')){const db=new DatabaseSync(file);try{return json([{results:db.prepare(JSON.parse(init.body).sql).all()}]);}finally{db.close();}}
 }
 if(url.hostname.endsWith('.r2.cloudflarestorage.com')||url.hostname==='backup.example.test'||url.hostname==='s3.us-east-1.amazonaws.com'){
  const headers=new Headers(init.headers),auth=headers.get('authorization'),s3=!url.hostname.endsWith('.r2.cloudflarestorage.com');
  const fields=/^AWS4-HMAC-SHA256 Credential=([^/]+)\/([^,]+), SignedHeaders=([^,]+), Signature=([a-f0-9]+)$/.exec(auth);
  assert.ok(fields,'provider requires a signed request');
  const region=s3?(url.hostname==='backup.example.test'?'eu-west-2':'us-east-1'):'auto';
  assert.equal(fields[1],s3?'synthetic-chest-3':'test-access-key');
  const stamp=headers.get('x-amz-date'),day=stamp.slice(0,8),scope=day+'/'+region+'/s3/aws4_request';assert.equal(fields[2],scope);
  const secret=s3?'synthetic-chest-4':createHash('sha256').update(url.hostname.startsWith('live-account.')?'synthetic-chest-1':url.hostname.startsWith('recovery-account.')?'synthetic-chest-7':'synthetic-chest-2').digest('hex');
  if(s3)assert.equal(headers.get('x-amz-security-token'),'synthetic-chest-5');
  const digest=value=>createHash('sha256').update(value).digest('hex'),mac=(key,value)=>createHmac('sha256',key).update(value).digest();
  const canonical=[method,url.pathname,url.search.slice(1),fields[3].split(';').map(k=>k+':'+headers.get(k).trim()+'\n').join(''),fields[3],headers.get('x-amz-content-sha256')].join('\n');
  let signing=mac('AWS4'+secret,day);for(const field of [region,'s3','aws4_request'])signing=mac(signing,field);
  assert.equal(fields[4],createHmac('sha256',signing).update(['AWS4-HMAC-SHA256',stamp,scope,digest(canonical)].join('\n')).digest('hex'),'provider validates region, path, query, session token and signature');
  if(process.env.CHEST_BACKUP_TEST_FAIL==='yes'&&method==='PUT')throw Error('Independent provider refused write');
  const account=s3?'s3-owner':url.hostname.split('.')[0],parts=url.pathname.slice(1).split('/').map(decodeURIComponent),bucket=join(home,'edge',account,parts.shift()),key=parts.join('/'),file=join(bucket,key);
  if(method==='GET'&&url.searchParams.has('list-type')){const prefix=url.searchParams.get('prefix')??'',all=await files(bucket);const entries=(await Promise.all(all.map(async p=>({key:relative(bucket,p),size:(await stat(p)).size})))).filter(o=>o.key.startsWith(prefix));const later=url.searchParams.has('continuation-token');if(later)assert.equal(url.searchParams.get('continuation-token'),'next&after+first');const truncated=s3&&entries.length>1&&!later,selected=truncated?entries.slice(0,1):s3&&later?entries.slice(1):entries;return new Response('<ListBucketResult><IsTruncated>'+truncated+'</IsTruncated>'+(truncated?'<NextContinuationToken>next&amp;after+first</NextContinuationToken>':'')+selected.map(o=>'<Contents><Key>'+o.key+'</Key><Size>'+o.size+'</Size></Contents>').join('')+'</ListBucketResult>');}
  const partsDirectory=join(home,'parts',account),uploadId='synthetic-chest-6';
  if(method==='POST'&&url.searchParams.has('uploads')){await mkdir(partsDirectory,{recursive:true});return new Response('<InitiateMultipartUploadResult><UploadId>'+uploadId+'</UploadId></InitiateMultipartUploadResult>');}
  if(url.searchParams.has('uploadId')){
   assert.equal(url.searchParams.get('uploadId'),uploadId);
   if(method==='PUT'){await writeFile(join(partsDirectory,url.searchParams.get('partNumber')),init.body);return new Response('',{headers:{etag:'"synthetic-chest-'+url.searchParams.get('partNumber')+'"'}});}
   if(method==='DELETE'){await rm(partsDirectory,{recursive:true,force:true});return new Response(null,{status:204});}
   if(method==='POST'){if(process.env.CHEST_BACKUP_TEST_COMPLETE_FAIL==='yes')return new Response('<Error><Code>InternalError</Code></Error>');const parts=await readdir(partsDirectory);assert.equal([...String(init.body).matchAll(/<Part>/g)].length,parts.length);await mkdir(dirname(file),{recursive:true});await writeFile(file,Buffer.concat(await Promise.all(parts.sort((a,b)=>Number(a)-Number(b)).map(p=>readFile(join(partsDirectory,p))))));await rm(partsDirectory,{recursive:true,force:true});return new Response('<CompleteMultipartUploadResult><ETag>complete</ETag></CompleteMultipartUploadResult>');}
  }
  if(method==='DELETE'){await rm(file,{force:true});return new Response(null,{status:204});}
  if(method==='GET')return new Response(await readFile(file));
  if(method==='PUT'){await mkdir(dirname(file),{recursive:true});await writeFile(file,init.body);return new Response('',{headers:{etag:'test-etag'}});}
 }
 throw new Error('Unexpected provider edge request');
};