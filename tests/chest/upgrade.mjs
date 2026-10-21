// CHEST-24 / RECOVER-002: genuine tagged upgrade and clean prior-revision recovery.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,chmod,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {localVariables} from '@runeditrun/rer/local/environment';
import {command,currentRer,runtimeEnvironment,serve,snapshot,preserved,interruptUpgrade,archiveSnapshot} from './upgrade-local.mjs';
const scratch=await mkdtemp(join(tmpdir(),'chest-upgrade-')),root=join(scratch,'chest'),recovery=join(scratch,'recovery'),home=join(scratch,'installer-home'),env=runtimeEnvironment(home),setupEnv=runtimeEnvironment(home,true),candidate=process.cwd(),answers='.rer/local/upgrade-answers.json';
let server,browser;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try {
 await mkdir(home,{recursive:true});
 await command(scratch,['git','clone','--depth','1','--filter=blob:none','--branch','v0.1.0','https://github.com/just-every/run-chest.git',root],env);
 await command(root,[process.execPath,currentRer,'install'],setupEnv);
 assert.equal((await command(root,['git','status','--porcelain','--untracked-files=no'],env)).trim(),'','install leaves the tagged application source unchanged');
 console.log('Installed genuine tagged application; preparing the owner.');
 await mkdir(join(root,'.rer/local'),{recursive:true,mode:0o700});await writeFile(join(root,answers),JSON.stringify({APP_NAME:'synthetic-chest-1',PRIMARY_COLOR:'#427c73',OWNER_EMAIL:'owner@example.test'}),{mode:0o600});
 await command(root,[process.execPath,currentRer,'setup','--answers',answers],setupEnv);
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const origin=`http://127.0.0.1:${port}`;
 server=await serve(root,port,env,true);console.log('Prior-release application is serving.');
 const key=(await readFile(join(root,'.rer/local/dev-key.env'),'utf8')).trim().split('=')[1];
 const session=async(as,devKey=key)=>{const response=await fetch(origin+'/auth/dev/enter?as='+as,{headers:{'x-rer-dev-key':devKey},redirect:'manual'});assert.equal(response.status,303);return response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
 const owner=await session('owner'),member=await session('member'),legacyAdmin=await session('admin');
 await fetch(origin+'/setup',{method:'POST',headers:{origin,cookie:owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'});
 const api=async(path,body,cookie=owner)=>{const r=await fetch(origin+'/api/chest'+path,{method:body===undefined?'GET':'POST',headers:{cookie,...body===undefined?{}:{origin,'content-type':'application/json'}},...body===undefined?{}:{body:JSON.stringify(body)}});assert.equal(r.status,200,`upgrade public door ${path}: ${r.status}`);return r.json()};
 const screenshots=async(cookie,screens,prefix)=>{
  for(const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:950}});
   try{
    await context.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:origin}}));const page=await context.newPage();
    for(const [name,path] of screens){await page.goto(origin+path);assert.equal(new URL(page.url()).pathname,path);await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-${prefix}-${name}.png`,fullPage:true})}
   }finally{await context.close()}
  }
 };
 const collection=await api('/collections',{name:'Harbor vendor records'}),schema=await api('/schemas',{name:'Vendor agreement',fields:[{name:'reference',type:'text',required:true}]}),documents=[];
 for(const [title,ref] of [['Harbor agreement','HF-2026'],['Acme insurance','AC-2026']]) {
  let document=await api('/documents',{title,collection:collection.id,schema:schema.id,fields:{reference:ref},owner:'owner@example.test',reviewer:'owner@example.test',filename:title+'.txt',base64:Buffer.from(title+' original').toString('base64')});
  document=await api(`/documents/${document.id}/review/${document.payload.versions[0].id}`,{action:'approve'});
  document=await api(`/documents/${document.id}/versions`,{filename:title+'.txt',base64:Buffer.from(title+' replacement').toString('base64')});documents.push(document);
  documents[documents.length-1]=await api(`/documents/${document.id}/review/${document.payload.versions.at(-1).id}`,{action:'comment',message:'synthetic-chest-2'});
 }
 const group=await api('/groups',{name:'synthetic-chest-3',members:['member@dev.localhost']});
 const grantedCollection=await api(`/collections/${collection.id}/grants`,{grants:[{principal:group.id,role:'reader'}]});
 const peopleBefore=(await api('/library')).people;assert.ok(peopleBefore.length>=3);
 await api('/library');
 await server.stop();server=null;
 const settingsBefore=await readFile(join(root,'.dev.vars'),'utf8'),brandingBefore=await readFile(join(root,'src/branding.json'),'utf8');
 await command(root,[process.execPath,currentRer,'export','--output','exports/pre-upgrade.rer'],setupEnv);
 const backupPath=join(root,'exports/pre-upgrade.rer'),backupHash=hash(await readFile(backupPath)),backup=await archiveSnapshot(backupPath);
 assert.ok(((await stat(backupPath)).mode&0o077)===0,'pre-upgrade archive is private');
 const before=await snapshot(root);console.log('Populated prior release and captured every application row and original.');
 await command(root,['git','fetch','--update-shallow',candidate,'HEAD'],env);await command(root,['git','checkout','--detach','FETCH_HEAD'],env);
 await command(root,[process.execPath,currentRer,'install'],env);
 await interruptUpgrade(root,port,env,before);
 assert.ok(await readFile(join(root,'.dev.vars'),'utf8')===settingsBefore,'interrupted upgrade preserves private configuration');
 console.log('Interrupted the genuine upgrade after a committed migration and before readiness; recovering the private pre-upgrade archive.');
 // Follow the documented rollback: leave the changed schema alone, install the
 // previous revision into a fresh target and import its own pre-upgrade backup.
 await command(scratch,['git','clone','--no-local','--depth','1','--branch','v0.1.0',root,recovery],env);
 await command(recovery,[process.execPath,currentRer,'install'],setupEnv);
 await mkdir(join(recovery,'exports'),{mode:0o700});
 await copyFile(backupPath,join(recovery,'exports/pre-upgrade.rer'));await chmod(join(recovery,'exports/pre-upgrade.rer'),0o600);
 await command(recovery,[process.execPath,currentRer,'import','--input','exports/pre-upgrade.rer','--yes'],setupEnv);
 await command(recovery,[process.execPath,currentRer,'export','--output','exports/recovered.rer'],setupEnv);
 assert.deepEqual(await archiveSnapshot(join(recovery,'exports/recovered.rer')),backup,'rollback reconciles every portable cell, table and original byte chunk');
 assert.deepEqual((await snapshot(recovery)).objects,before.objects,'rollback retains original bytes and object metadata');
 await mkdir(join(recovery,'.rer/local'),{recursive:true,mode:0o700});await copyFile(join(root,answers),join(recovery,answers));
 await command(recovery,[process.execPath,currentRer,'setup','--answers',answers,'--port',String(port)],setupEnv);
 const restoredSettings=localVariables(await readFile(join(recovery,'.dev.vars'),'utf8')),priorSettings=localVariables(settingsBefore);
 for(const name of ['OWNER_EMAIL','MAIL_PROVIDER','MAIL_FROM'])assert.equal(restoredSettings[name],priorSettings[name],`rollback preserves configured ${name}`);
 assert.ok(restoredSettings.SESSION_SECRET&&restoredSettings.SESSION_SECRET!==priorSettings.SESSION_SECRET,'rollback regenerates the private session secret');
 assert.equal(await readFile(join(recovery,'src/branding.json'),'utf8'),brandingBefore,'rollback restores owner-selected application settings');
 server=await serve(recovery,port,env,true);
 const recoveryKey=(await readFile(join(recovery,'.rer/local/dev-key.env'),'utf8')).trim().split('=')[1];assert.ok(recoveryKey!==key,'recovery has a fresh dev identity key');
 for(const cookie of [owner,member,legacyAdmin])assert.equal((await fetch(origin+'/api/chest/library',{headers:{cookie,'x-rer-dev-key':recoveryKey}})).status,401,'pre-upgrade credentials cannot open the recovered installation');
 const recoveredOwner=await session('owner',recoveryKey),recoveredMember=await session('member',recoveryKey);await session('admin',recoveryKey);
 const finished=await fetch(origin+'/setup',{method:'POST',headers:{origin,cookie:recoveredOwner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'});assert.equal(finished.status,303,'the recovered owner completes ordinary Finish setup');
 const recoveredLibrary=await api('/library',undefined,recoveredOwner);
 assert.deepEqual(recoveredLibrary.people,peopleBefore,'portable people retain identity and roles after fresh sign-in');
 for(const [kind,expected] of [['collections',grantedCollection],['schemas',schema],['groups',group]])assert.deepEqual(recoveredLibrary[kind].find(row=>row.id===expected.id).payload,expected.payload,`rollback preserves ${kind} settings and rights`);
 for(const document of documents){
  assert.deepEqual((await api(`/documents/${document.id}`,undefined,recoveredMember)).payload,document.payload,'fresh staff identity retains group access, exact approvals and comment history');
  for(const version of document.payload.versions){const response=await fetch(`${origin}/api/chest/documents/${document.id}/bytes/${version.id}?download=true`,{headers:{cookie:recoveredOwner}});assert.equal(response.status,200);const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes.length,version.size);assert.equal(hash(bytes),version.checksum)}
 }
 // Browser process keeps the real HOME; only installer children use the private installer home.
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 await mkdir('test-results',{recursive:true});
 await screenshots(recoveredOwner,[['library','/app/library'],['document',`/app/documents/${documents[0].id}`]],'upgrade-recovered');
 assert.ok(hash(await readFile(backupPath))===backupHash,'the private pre-upgrade archive remains byte-for-byte unchanged');
 await server.stop();server=null;
 console.log('RECOVER-002 upgrade recovery passed: interrupted upgrade recovered into the genuine previous revision; complete portable graph/originals, settings, identities and review history reconciled; old sessions refused.');
 server=await serve(root,port,env);await server.stop();server=null;
 const after=await snapshot(root);preserved(before,after);
 assert.ok(await readFile(join(root,'.dev.vars'),'utf8')===settingsBefore,'successful upgrade preserves private configuration');
 assert.equal(await readFile(join(root,'src/branding.json'),'utf8'),brandingBefore,'successful upgrade preserves owner-selected application settings');
 server=await serve(root,port,env);assert.equal((await fetch(origin+'/api/chest/administration',{headers:{cookie:legacyAdmin}})).status,401,'the legacy administrator must sign in afresh after authority migration');const upgradedOwner=await session('owner'),upgradedAdmin=await session('admin');const adminResponse=await fetch(origin+'/api/chest/administration',{headers:{cookie:upgradedAdmin}});assert.equal(adminResponse.status,200,'the migrated administrator still opens delegated administration after fresh sign-in');
 for(const document of documents)for(const version of document.payload.versions){const r=await fetch(`${origin}/api/chest/documents/${document.id}/bytes/${version.id}?download=true`,{headers:{cookie:upgradedOwner}});assert.equal(r.status,200);assert.equal(hash(new Uint8Array(await r.arrayBuffer())),version.checksum)}
 const post=await fetch(origin+'/api/chest/spaces',{method:'POST',headers:{cookie:upgradedOwner,origin,'content-type':'application/json'},body:JSON.stringify({name:'Harbor upgraded project'})});assert.equal(post.status,200);const space=await post.json();
 await screenshots(upgradedOwner,[['library','/app/library'],['document',`/app/documents/${documents[0].id}`],['files',`/app/spaces/${space.id}`]],'upgrade');
 console.log(`CHEST-24 passed: ${Object.keys(before.tables).length} prior tables, every earlier row and ${before.objects.length} originals preserved; all Library versions download and Files works at 1440/390. The tagged application used the currently supported installer runtime.`);
}finally{await browser?.close();await server?.stop();await rm(scratch,{recursive:true,force:true})}
