import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,statfs} from 'node:fs/promises';
import {loadavg,tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRedaction,credentialValues} from '@runeditrun/rer/redaction';
import {localVariables} from '@runeditrun/rer/local/environment';
export async function command(root,args,{refuse=false}={}){const p=spawn(process.execPath,__rerTestEntryArgs([__rerTestEntry,...args]),{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});let output='';for(const s of [p.stdout,p.stderr])s.on('data',c=>output+=c);const code=await new Promise(r=>p.once('exit',r));if(refuse)assert.notEqual(code,0,`${args[0]} must refuse`);else assert.equal(code,0,`${args[0]} failed (private command output withheld)`);return output}
// Only the CLI's structured, approved error reaches the test log. Never print
// its ready event (which carries a dev key), progress stream or private capture.
async function startupDiagnostic(root,failure){
 const redaction=createRedaction();redaction.addSecrets(credentialValues(process.env));
 let message='Private diagnostic withheld';
 try{
  for(const file of ['.dev.vars','.rer/local/dev-key.env']){
   try{redaction.addSecrets(localVariables(await readFile(join(root,file),'utf8')))}catch(error){if(error.code!=='ENOENT')throw error}
  }
  if(typeof failure?.message==='string')message=redaction.redact(failure.message)
   .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`]+/gi,'[URL withheld]')
   .replace(/\/(?:auth|__dev)\/[^\s<>"'`]+/gi,'[identity path withheld]').slice(0,6000);
 }catch{ /* A private-file read failure must not expose a partial diagnostic. */ }
 const free=async path=>{try{const s=await statfs(path,{bigint:true});return Number(s.bavail*s.bsize)/1024**3}catch{return null}};
 const [checkoutGiB,temporaryGiB]=await Promise.all([free(root),free(tmpdir())]);
 const code=/^[a-z_]{1,80}$/.test(failure?.code??'')?failure.code:'unknown';
 return `${code}: ${message}\nStartup resources: ${JSON.stringify({load1m:loadavg()[0],checkoutFreeGiB:checkoutGiB,temporaryFreeGiB:temporaryGiB})}`;
}
export async function serving(root,verb,port,extra=[]){
 const p=spawn(process.execPath,__rerTestEntryArgs([__rerTestEntry,verb,'--port',String(port),'--json',...extra]),{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 let pending='',ready=false,failure,spawnCode;
 p.stdout.setEncoding('utf8');
 p.stdout.on('data',chunk=>{pending+=chunk;let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);try{const event=JSON.parse(line);if(event.version!==1||event.verb!==verb)continue;if(event.event==='ready')ready=true;if(event.event==='error')failure=event}catch{ /* Non-event output stays private. */ }}});
 p.stderr.resume();p.on('error',error=>{spawnCode=/^[A-Z_]{2,40}$/.test(error.code??'')?error.code:'unknown'});
 const closed=new Promise(resolve=>p.once('close',resolve));
 for(let i=0;i<1200;i++){
  if(p.exitCode!==null||p.signalCode!==null||spawnCode){await closed;throw Error(`${verb} stopped before readiness (exit ${p.exitCode}, signal ${p.signalCode??'none'}, spawn ${spawnCode??'none'})\n${await startupDiagnostic(root,failure)}`)}
  if(ready)return {async stop(){await command(root,[verb,'--stop']);await closed}};
  await new Promise(r=>setTimeout(r,250));
 }
 p.kill('SIGTERM');await closed;throw Error(`${verb} readiness timeout\n${await startupDiagnostic(root,failure)}`);
}
export async function key(root){return (await readFile(root+'/.rer/local/dev-key.env','utf8')).trim().split('=')[1]}
// Local dev identity: the key exchange sets the gate cookie, then the dev
// layer signs this browser in as the owner or a declared persona.
export async function browserSignIn(page,origin,devKey,as='owner'){try{await page.goto(`${origin}/__dev/key#rer-dev=${devKey}&next=${encodeURIComponent(`/auth/dev/enter?as=${as}&returnTo=/app`)}`);await page.waitForURL(/\/(app|setup)(\/|$)/);if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app')}}catch{throw Error('Dev identity browser sign-in failed; credential-bearing navigation details withheld')}}
// The same sign-in for an HTTP client presenting the checkout key.
export async function devSession(origin,devKey,as){const r=await fetch(`${origin}/auth/dev/enter?as=${as}`,{redirect:'manual',headers:{'x-rer-dev-key':devKey}});assert.equal(r.status,303,`dev sign-in as ${as}`);return r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')}
// The static UI forbids browser script connections. API assertions use the same
// browser context's live cookie jar without changing the product's CSP.
export async function json(page,origin,path,body){
 const r=await page.request.fetch(origin+'/api/chest'+path,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{origin,'content-type':'application/json'},data:body})});
 if(!r.ok())throw Error(`Public API refused ${path}: ${r.status()}`);
 return r.json();
}
