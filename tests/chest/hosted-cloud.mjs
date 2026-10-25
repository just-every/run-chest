// Live Cloudflare lifecycle support. Child output and credentials stay in memory.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';

export function deploymentEnvironment(owner) {
 return {...process.env,OWNER_EMAIL:owner,MAIL_PROVIDER:'sendgrid',MAIL_FROM:process.env.SENDGRID_FROM_EMAIL,
  SESSION_SECRET:randomBytes(32).toString('hex'),SETUP_TOKEN:randomBytes(32).toString('hex'),
  CI:'true',WRANGLER_SEND_METRICS:'false'};
}

export async function rer(args,env) {
 const child=spawn('pnpm',['exec','rer',...args],{env,stdio:['ignore','pipe','pipe']});
 let output='';
 const collect=chunk=>{output=(output+chunk.toString()).slice(-2*1024*1024)};
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 const code=await new Promise((resolve,reject)=>{child.once('error',()=>reject(Error('Cannot start the hosted RER command.')));child.once('close',resolve)});
 if(code!==0){
  for(const value of Object.values(env))if(typeof value==='string'&&value.length>6)output=output.replaceAll(value,'[withheld]');
  output=output.replace(/https?:\/\/[^\s"<>]+/g,'[address withheld]');
  throw Error(`rer ${args[0]} failed (${code}): ${output.slice(-2400)}`);
 }
}

export async function cloudResources(environment) {
 const worker=`chest-${environment}`,database=worker+'-db',bucket=worker+'-blobs';
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 assert.equal(account,'b20c0ca9cab0c2b70e13d7cf724b89bd','only the RunEditRun account is permitted');
 assert.ok(token,'the held Cloudflare token is required');
 async function api(path,{method='GET',body,allowMissing=false}={}) {
  let response;
  try {response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{
   method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});}catch{throw Error(`Cloudflare ${method} could not connect.`)}
  if(allowMissing&&response.status===404){await response.body?.cancel();return null}
  const data=await response.json().catch(()=>null);
  assert.ok(response.ok&&data?.success,`Cloudflare ${method} refused (${response.status}).`);
  return data.result;
 }
 async function state(){
  const script=await api(`/workers/scripts/${worker}/settings`,{allowMissing:true});
  const databases=await api(`/d1/database?name=${encodeURIComponent(database)}`);
  const storedBucket=await api(`/r2/buckets/${bucket}`,{allowMissing:true});
  return {worker:script!==null,database:databases.find(row=>row.name===database)?.uuid??null,
   bucket:storedBucket!==null};
 }
 async function absent(){const found=await state();assert.deepEqual(found,{worker:false,database:null,bucket:false},'the named Worker, database and bucket are all absent')}
 await absent();
 let mayExist=false;
 return {worker,database,bucket,absent,
  async deploy(env){
   mayExist=true;
   await rer(['deploy','--environment',environment,'--owner-name','Chest operations test','--non-interactive'],env);
   const record=JSON.parse(await readFile(join('.rer','deploy',environment+'.json'),'utf8'));
   const origin=new URL(record.receipt.origin).origin;
   assert.ok(origin.startsWith(`https://${worker}.`)&&origin.endsWith('.workers.dev'),'the deployed origin belongs to this isolated Worker');
   const found=await state();assert.ok(found.worker&&found.database&&found.bucket,'deploy created all three declared resources');
   return origin;
  },
  async remove(env){
   if(!mayExist)return;
   const found=await state();
   if(!found.worker&&!found.database&&!found.bucket){mayExist=false;return}
   await rer(['deploy','--environment',environment,'--remove','--yes','--non-interactive'],env);
   await absent();mayExist=false;
  }
 };
}
