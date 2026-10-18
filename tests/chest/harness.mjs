import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {unstable_getMiniflareWorkerOptions:workerOptions,unstable_splitSqlQuery:splitSql}=require('wrangler');
const {Miniflare,convertV4MiniflareOptions}=createRequire(require.resolve('wrangler'))('miniflare');
// The built Worker runs as deployed (production mail, https origin). Its network
// edges are the mail provider, where the test receives each message, and, when a
// test passes `edge`, that test's fake of a paid provider (an AI model).
export async function harness({edge,bindings={},hostname='127.0.0.1'}={}){
 let port=0,origin=`https://${hostname}`;
 const directory=await mkdtemp(join(tmpdir(),'chest-http-')),secret=()=>randomBytes(32).toString('base64url'),mails=[];
 const vars={AUTH_LOCAL:'false',AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret(),SETUP_TOKEN:secret(),MAIL_PROVIDER:'resend',MAIL_API_KEY:'test-only-mail-provider-key',MAIL_FROM:'Chest <auth@example.test>',...bindings};
 const {compatibilityDate,compatibilityFlags,assets,d1Databases,r2Buckets}=workerOptions('dist/server/wrangler.json').workerOptions,root=join(process.cwd(),'dist/server');
 const modules=['index.js',...(await readdir(join(root,'assets'))).map(f=>`assets/${f}`)].map(f=>({type:f.endsWith('.wasm')?'CompiledWasm':'ESModule',path:join(root,f)}));
 const options={modulesRoot:root,modules,compatibilityDate,compatibilityFlags,assets,d1Databases,r2Buckets};
 const outboundService=async request=>{
  const answer=await edge?.(request);if(answer)return answer;
  assert.equal(request.url,'https://api.resend.com/emails','the Worker reaches only the mail provider');
  mails.push(await request.json());return Response.json({id:`test-receipt-${mails.length}`});
 };
 let worker,migrated=false;
 // The numbered migrations, in order, once; a restart keeps the persisted data.
 async function migrate(){const db=await worker.getD1Database('DB'),folder='migrations/core';for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())for(const statement of splitSql(await readFile(join(folder,file),'utf8')))await db.prepare(statement).run();migrated=true}
 async function start(){
  const initial=port===0,requestedPort=port,config=()=>({...convertV4MiniflareOptions({host:hostname,port:requestedPort,https:true,...options,bindings:vars,outboundService,unsafeTriggerHandlers:true}),resourcePersistencePath:directory});
  worker=new Miniflare(config());const ready=await worker.ready;
  // Let Workerd bind port zero itself. Selecting then releasing an ephemeral port races its loopback sockets.
  if(initial){port=Number(ready.port);origin=`https://${hostname}:${port}`;vars.AUTH_ORIGIN=origin;await worker.setOptions(config())}
  // A restart keeps the public origin so existing browser pages, links and device addresses remain valid.
  if(!migrated)await migrate()
 }
 async function stop(){if(!worker)return;await worker.dispose();worker=null}
 // Miniflare's fetch has its own undici: send a form as its encoded multipart bytes.
 async function fetch(path,init={}){
  if(!(init.body instanceof FormData))return worker.dispatchFetch(origin+path,{redirect:'manual',...init,headers:{host:new URL(origin).host,...init.headers}});
  const encoded=new Response(init.body);return worker.dispatchFetch(origin+path,{redirect:'manual',...init,headers:{host:new URL(origin).host,...init.headers,'content-type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()});
 }
 const raw=(path,cookie,body)=>fetch(path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 async function api(path,cookie,body,status=200){const r=await raw('/api/chest'+path,cookie,body);assert.equal(r.status,status,`${path}: ${r.status===status?'':await r.text()}`);return r.json()}
 // The newest message to this address carries the ordinary sign-in or invitation link.
 async function signIn(email,invite=false){
  if(!invite)assert.equal((await raw('/auth/magic-link',null,{email,returnTo:'/app'})).status,202);
  const message=mails.findLast(m=>[m.to].flat().includes(email));assert.ok(message,'the provider received the sign-in message');
  const link=new URL(message.text.match(/https?:\/\/[^\s]+/)[0]);assert.equal(link.origin,origin);
  const response=await raw('/auth/confirm',null,{token:link.searchParams.get('token')});assert.equal(response.status,303,'ordinary link confirmation');return response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
 }
 try{await start()}catch(e){await stop();await rm(directory,{recursive:true,force:true});throw e}// Time passing for expiry journeys: tests age stored timestamps; the Worker's clock is never faked.
 const sql=async(query,...params)=>(await worker.getD1Database('DB')).prepare(query).bind(...params).run();
 return {email:async(from,to,raw)=>{const response=await worker.dispatchFetch(origin+'/cdn-cgi/local/email?'+new URLSearchParams({from,to,format:'json'}),{method:'POST',body:raw});assert.equal(response.status,200,await response.clone().text());return response.json()},get origin(){return origin},vars,mails,fetch,raw,api,signIn,start,stop,directory,sql,async close(){await stop();await rm(directory,{recursive:true,force:true})}};
}
