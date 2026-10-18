import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {getPlatformProxy} from 'wrangler';
import {createRedaction,credentialValues} from '@runeditrun/rer/redaction';
import {localVariables} from '@runeditrun/rer/local/environment';
const require=createRequire(import.meta.url),runtime=dirname(require.resolve('@runeditrun/rer/package.json'));
const loader=fileURLToPath(new URL('./upgrade-runtime-loader.mjs',import.meta.url));
export const currentRer=join(runtime,'global/rer.mjs');
export function runtimeEnvironment(home,compatible=false) {return {...process.env,HOME:home,PATH:dirname(process.execPath)+':'+process.env.PATH,CI:'true',WRANGLER_SEND_METRICS:'false',NODE_OPTIONS:`${process.env.NODE_OPTIONS??''}${compatible?' --experimental-loader='+loader:''}`}}
async function diagnostic(root,env,output) {
 const redact=createRedaction();redact.addSecrets(credentialValues(env));
 for(const file of ['.dev.vars','.rer/local/dev-key.env'])try{redact.addSecrets(localVariables(await readFile(join(root,file),'utf8')))}catch{}
 return redact.redact(output).replace(/https?:\/\/[^\s<>"'`]+/g,'[URL omitted]').replace(/\/(?:auth|__dev)\/[^\s<>"'`]+/g,'[identity path omitted]').slice(-6000);
}
export async function command(root,argv,env) {
 const p=spawn(argv[0],argv.slice(1),{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='';
 for(const stream of [p.stdout,p.stderr])stream.on('data',c=>output+=c);
 const code=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',resolve)});
 if(code!==0){
  const safe=await diagnostic(root,env,output);
  assert.fail(`${argv[0].split('/').at(-1)} ${argv.slice(1).find(v=>!v.includes('/'))??'command'} failed: ${safe}`);
 }
 return output;
}
export async function serve(root,port,env,legacy=false) {
 const entry=legacy?join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'):currentRer;
 const p=spawn(process.execPath,[entry,'dev',...legacy?[]:['--foreground'],'--port',String(port),'--json'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='',pending='',ready=false,failed=false;
 const closed=new Promise(r=>p.once('close',r));
 p.on('error',()=>{failed=true});p.stderr.on('data',c=>output+=c);p.stdout.on('data',c=>{output+=c;pending+=c;let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);try{const event=JSON.parse(line);if(event.verb==='dev'&&event.event==='ready')ready=true;if(event.event==='error')failed=true}catch{}}});
 const stop=async()=>{if(p.exitCode===null&&p.signalCode===null)p.kill('SIGTERM');await closed};
 try{
  const deadline=Date.now()+240_000;
  while(!ready){if(failed||p.exitCode!==null||p.signalCode!==null)throw Error('Upgrade dev startup failed: '+await diagnostic(root,env,output));if(Date.now()>deadline)throw Error('Upgrade dev startup timed out');await new Promise(r=>setTimeout(r,200))}
  return {stop};
 }catch(e){await stop();throw e}
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const normalize=value=>typeof value==='bigint'?{integer:value.toString()}:value instanceof Uint8Array?{blob:Buffer.from(value).toString('base64')}:value;
async function database(root) {
 const directory=join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
 for(const name of await readdir(directory))if(name.endsWith('.sqlite')){
  const path=join(directory,name),db=new DatabaseSync(path,{readOnly:true});
  try{if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='chest_records'").get())return path}finally{db.close()}
 }
 throw Error('Upgrade application database missing');
}
export async function snapshot(root) {
 // Every application/auth/import table and row, including the migration ledger.
 // sqlite_* and _cf_* belong to the SQLite/D1 engine, whose transaction counters
 // necessarily advance during a migration. They are not application records.
 const objects=[],proxy=await getPlatformProxy({configPath:join(root,'wrangler.jsonc'),persist:{path:join(root,'.wrangler/state/v3')},remoteBindings:false});
 try{let cursor;do{const batch=await proxy.env.BLOBS.list({cursor});for(const o of batch.objects){const full=await proxy.env.BLOBS.get(o.key);assert.ok(full);objects.push({key:o.key,size:o.size,sha256:sha(new Uint8Array(await full.arrayBuffer())),httpMetadata:full.httpMetadata,customMetadata:full.customMetadata})}cursor=batch.truncated?batch.cursor:undefined}while(cursor)}finally{await proxy.dispose()}
 const db=new DatabaseSync(await database(root),{readOnly:true}),tables={};
 try{
  for(const t of db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()) {
   const rows=db.prepare(`SELECT * FROM ${quote(t.name)}`).all().map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).map(([key,value])=>[key,normalize(value)])))).sort();
   tables[t.name]={schema:t.sql,rows};
  }
 }finally{db.close()}
 return {tables,objects:objects.sort((a,b)=>a.key.localeCompare(b.key))};
}
export function preserved(before,after) {
 for(const [table,old] of Object.entries(before.tables)) {
  assert.ok(after.tables[table],`prior table ${table} survives`);assert.equal(after.tables[table].schema,old.schema,`prior schema ${table} is unchanged`);
  const counts=new Map();for(const row of after.tables[table].rows)counts.set(row,(counts.get(row)??0)+1);
  for(const row of old.rows){assert.ok(counts.get(row)>0,`an earlier row changed in ${table}`);counts.set(row,counts.get(row)-1)}
 }
 assert.deepEqual(after.objects,before.objects,'every original and its metadata remains unchanged');
}
