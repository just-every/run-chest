// CHEST-24: genuine tagged application, supported installer, same local database and original store.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {command,currentRer,runtimeEnvironment,serve,snapshot,preserved} from './upgrade-local.mjs';
const scratch=await mkdtemp(join(tmpdir(),'chest-upgrade-')),root=join(scratch,'chest'),home=join(scratch,'installer-home'),env=runtimeEnvironment(home),setupEnv=runtimeEnvironment(home,true),candidate=process.cwd();
let server,browser;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try {
 await mkdir(home,{recursive:true});
 await command(scratch,['git','clone','--depth','1','--filter=blob:none','--branch','v0.1.0','https://github.com/just-every/run-chest.git',root],env);
 await command(root,[process.execPath,currentRer,'install'],setupEnv);
 assert.equal((await command(root,['git','status','--porcelain','--untracked-files=no'],env)).trim(),'','install leaves the tagged application source unchanged');
 console.log('Installed genuine tagged application; preparing the owner.');
 await command(root,[process.execPath,currentRer,'setup','--owner-email','owner@example.test'],setupEnv);
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const origin=`http://127.0.0.1:${port}`;
 server=await serve(root,port,env,true);console.log('Prior-release application is serving.');
 const key=(await readFile(join(root,'.rer/local/dev-key.env'),'utf8')).trim().split('=')[1];
 const session=async as=>{const response=await fetch(origin+'/auth/dev/enter?as='+as,{headers:{'x-rer-dev-key':key},redirect:'manual'});assert.equal(response.status,303);return response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
 const owner=await session('owner');await session('member');await session('admin');
 await fetch(origin+'/setup',{method:'POST',headers:{origin,cookie:owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'});
 const api=async(path,body)=>{const r=await fetch(origin+'/api/chest'+path,{method:body===undefined?'GET':'POST',headers:{cookie:owner,...body===undefined?{}:{origin,'content-type':'application/json'}},...body===undefined?{}:{body:JSON.stringify(body)}});assert.equal(r.status,200,`upgrade public door ${path}: ${r.status}`);return r.json()};
 const collection=await api('/collections',{name:'Harbor vendor records'}),schema=await api('/schemas',{name:'Vendor agreement',fields:[{name:'reference',type:'text',required:true}]}),documents=[];
 for(const [title,ref] of [['Harbor agreement','HF-2026'],['Acme insurance','AC-2026']]) {
  let document=await api('/documents',{title,collection:collection.id,schema:schema.id,fields:{reference:ref},owner:'owner@example.test',reviewer:'owner@example.test',filename:title+'.txt',base64:Buffer.from(title+' original').toString('base64')});
  document=await api(`/documents/${document.id}/versions`,{filename:title+'.txt',base64:Buffer.from(title+' replacement').toString('base64')});documents.push(document);
 }
 const peopleBefore=(await api('/library')).people;assert.ok(peopleBefore.length>=3);
 await api('/library');
 await server.stop();server=null;const before=await snapshot(root);console.log('Populated prior release and captured every application row and original.');
 await command(root,['git','fetch','--update-shallow',candidate,'HEAD'],env);await command(root,['git','checkout','--detach','FETCH_HEAD'],env);
 await command(root,[process.execPath,currentRer,'install'],env);
 server=await serve(root,port,env);await server.stop();server=null;
 const after=await snapshot(root);preserved(before,after);
 server=await serve(root,port,env);const upgradedOwner=await session('owner');
 // Browser process keeps the real HOME; only installer children use the private installer home.
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 await mkdir('test-results',{recursive:true});
 for(const document of documents)for(const version of document.payload.versions){const r=await fetch(`${origin}/api/chest/documents/${document.id}/bytes/${version.id}?download=true`,{headers:{cookie:upgradedOwner}});assert.equal(r.status,200);assert.equal(hash(new Uint8Array(await r.arrayBuffer())),version.checksum)}
 const post=await fetch(origin+'/api/chest/spaces',{method:'POST',headers:{cookie:upgradedOwner,origin,'content-type':'application/json'},body:JSON.stringify({name:'Harbor upgraded project'})});assert.equal(post.status,200);const space=await post.json();
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:950}});await context.addCookies(upgradedOwner.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:origin}}));const page=await context.newPage();
  for(const [name,path] of [['library','/app/library'],['document',`/app/documents/${documents[0].id}`],['files',`/app/spaces/${space.id}`]]) {await page.goto(origin+path);assert.equal(new URL(page.url()).pathname,path);await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-upgrade-${name}.png`,fullPage:true})}
  await context.close();
 }
 console.log(`CHEST-24 passed: ${Object.keys(before.tables).length} prior tables, every earlier row and ${before.objects.length} originals preserved; all Library versions download and Files works at 1440/390. The tagged application used the currently supported installer runtime.`);
}finally{await browser?.close();await server?.stop();await rm(scratch,{recursive:true,force:true})}
