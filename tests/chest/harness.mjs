import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function harness(){
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const origin=`http://127.0.0.1:${port}`,directory=await mkdtemp(join(tmpdir(),'chest-http-')),secret=()=>randomBytes(32).toString('base64url');
 const vars={AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret(),SETUP_TOKEN:secret(),MAIL_PROVIDER:'development',MAIL_FROM:'auth@localhost.test',RER_DEV_KEY:secret()};
 await writeFile(join(directory,'local.env'),Object.entries(vars).map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});
 const workerArgs=['node_modules/wrangler/bin/wrangler.js'],env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'true',CLOUDFLARE_INCLUDE_PROCESS_ENV:'false'};
 try { execFileSync(process.execPath,[...workerArgs,'d1','migrations','apply','DB','--local','--persist-to',directory,'--config','dist/server/wrangler.json'],{stdio:'ignore',env}); } catch {await rm(directory,{recursive:true,force:true});throw Error('Local migration failed; inspect numbered schema migrations')}
 let worker;
 async function start(){worker=spawn(process.execPath,[...workerArgs,'dev','--config','dist/server/wrangler.json','--inspector-port','0','--local','--persist-to',directory,'--ip','127.0.0.1','--port',String(port),'--env-file',join(directory,'local.env')],{stdio:['ignore','pipe','pipe'],env});worker.stdout.resume();worker.stderr.resume();for(let n=0;n<240;n++){assert.equal(worker.exitCode,null,'Worker must stay alive');try{if((await fetch(origin+'/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('Worker readiness timeout')}
 async function stop(){if(!worker||worker.exitCode!==null)return;worker.kill('SIGTERM');await new Promise(r=>worker.once('exit',r));worker=null}
 const raw=(path,cookie,body)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 async function api(path,cookie,body,status=200){const r=await raw('/api/chest'+path,cookie,body);assert.equal(r.status,status,`${path}: ${r.status===status?'':await r.text()}`);return r.json()}
 async function signIn(email,invite=false){if(!invite)assert.equal((await raw('/auth/magic-link',null,{email,returnTo:'/app'})).status,202);const listing=await(await fetch(origin+'/__dev/outbox',{headers:{'x-rer-dev-key':vars.RER_DEV_KEY}})).text();const links=[...listing.matchAll(/href="(\/__dev\/outbox\?message=[^"]+)"/g)].map(m=>m[1]);let token;
 for(const path of links){const detail=await(await fetch(origin+path.replaceAll('&amp;','&'),{headers:{'x-rer-dev-key':vars.RER_DEV_KEY}})).text();if(!detail.includes(email))continue;const match=detail.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/);if(match){token=new URL(match[1].replaceAll('&amp;','&'),origin).searchParams.get('token');break}}
 assert.ok(token,'ordinary local outbox link exists');const response=await raw('/auth/confirm',null,{token});assert.equal(response.status,303,'ordinary link confirmation');return response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
 }
 try{await start()}catch(e){await stop();await rm(directory,{recursive:true,force:true});throw e}return {origin,vars,raw,api,signIn,start,stop,directory,async close(){await stop();await rm(directory,{recursive:true,force:true})}};
}
