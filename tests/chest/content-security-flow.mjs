import {request as httpRequest} from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),b64=b=>Buffer.from(b).toString('base64');
// The industry-standard harmless scanner specimen. Never executed, only submitted as original bytes.
const specimen=Buffer.from('WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=','base64');
const cookies=(cookie,url)=>cookie.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url}});
async function bootstrap(h){await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});return owner}
// Optional real processor run: same public-door journey, real ClamAV and service, transport forwarded only at the network edge.
async function processor(){
 if(!process.env.CHEST_CLAMSCAN)return null;
 const dir=await mkdtemp(join(tmpdir(),'chest-clamav-'));
 // A test-only ClamAV signature database proves the engine path without depending on today's signature download.
 // This is not a production signature set; production startup requires maintained ClamAV definitions.
 const signature=createHash('md5').update(specimen).digest('hex')+':'+specimen.length+':Synthetic.Chest.Eicar\n';await writeFile(join(dir,'test.hdb'),signature);
 const child=spawn('python3',['services/content-scan/server.py','--port','0','--clamscan',process.env.CHEST_CLAMSCAN,'--database',dir],{env:{...process.env,CONTENT_SCANNER_TOKEN:'synthetic-chest-1'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);let line='';
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('processor did not start: '+stderr))},20000);child.once('exit',()=>{clearTimeout(timer);reject(Error('processor exited: '+stderr))});child.stdout.on('data',b=>{line+=b;const m=/CHEST_SCANNER_READY (\d+)/.exec(line);if(m){clearTimeout(timer);resolve(Number(m[1]))}})});
 return {url:`http://127.0.0.1:${port}/scan`,async close(){child.kill('SIGTERM');await once(child,'exit');await rm(dir,{recursive:true,force:true})}};
}
export async function contentSecurityFlow(){
 const real=await processor();let offline=false,wrongReceipt=false,browser;
 const h=await harness({bindings:{CONTENT_SCANNER_URL:'https://synthetic-chest-scanner.test/scan',CONTENT_SCANNER_TOKEN:'synthetic-chest-1'},edge:async request=>{
  if(request.url!=='https://synthetic-chest-scanner.test/scan')return;
  assert.equal(request.headers.get('authorization'),'Bearer synthetic-chest-1');const bytes=Buffer.from(await request.arrayBuffer());assert.equal(request.headers.get('x-content-sha256'),sha(bytes));
  if(offline)return new Response('processor unavailable',{status:503});
  let result;
  if(real){result=await new Promise((resolve,reject)=>{const call=httpRequest(real.url,{method:'POST',headers:{authorization:'Bearer synthetic-chest-1','content-length':String(bytes.length),'x-content-sha256':sha(bytes)}},response=>{const chunks=[];response.on('data',b=>chunks.push(b));response.on('end',()=>{try{assert.equal(response.statusCode,200,Buffer.concat(chunks).toString());resolve(JSON.parse(Buffer.concat(chunks)))}catch(e){reject(e)}})});call.on('error',reject);call.end(bytes)})}
  else result={checksum:sha(bytes),size:bytes.length,state:bytes.equals(specimen)?'infected':'clean',sensitive:/Classification: Sensitive/i.test(bytes.toString()),reason:'Synthetic scanner-edge receipt',engine:'synthetic-chest-1'};
  if(wrongReceipt)result.checksum='0'.repeat(64);return Response.json(result);
 }});
 try{
  const owner=await bootstrap(h),space=(await h.api('/files',owner)).personal;
  await h.api('/people',owner,{action:'invite',email:'member@example.test',name:'Jordan Lee'});const member=await h.signIn('member@example.test',true);
  const folder=await h.api('/items',owner,{space,type:'folder',name:'Supplier exchange'}),file=await h.api('/items',owner,{parent:folder.id,name:'Terms.txt',base64:b64('synthetic-chest-2')});
  const link=await h.api(`/items/${folder.id}/links`,owner,{audience:'public'}),base=new URL(link.url).pathname,device=await h.api('/devices',owner,{name:'Synthetic companion',platform:'macos'});
  await h.api('/content-security/policy',member,{enabled:true,sensitiveGroups:[],confirm:true},403);
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:false},400);
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:true});
  // Previously retained, still-unscanned originals fail through every existing read door.
  for(const path of [`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`,`/api/chest/items/${file.id}/bytes/${file.payload.current}`,`/api/chest/items/${file.id}/office-preview/${file.payload.current}`,`/api/chest/items/${file.id}/pages/${file.payload.current}/1`])assert.ok((await h.raw(path,owner)).status>=400,path);
  assert.ok((await h.fetch(`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`,{headers:{cookie:owner,range:'bytes=0-4'}})).status>=400);
  for(const path of [`${base}/f/${file.id}`,`${base}/p/${file.id}`])assert.ok((await h.fetch(path)).status>=400,path);
  assert.ok((await h.fetch(`/api/chest/sync/items/${file.id}/content?version=${file.payload.current}`,{headers:{authorization:`Bearer ${device.token}`}})).status>=400);
  await h.api('/content-security/scan',owner,{item:file.id});
  assert.equal(await (await h.raw(`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`,owner)).text(),'synthetic-chest-2');
  // Malware and failed receipts retain bytes without publishing a new file or replacing the original.
  await h.api(`/items/${file.id}/versions`,owner,{base64:b64(specimen)},423);assert.equal((await h.api(`/items/${file.id}`,owner)).item.current,file.payload.current);
  let review=await h.api('/content-security',owner);const held=review.scans.find(r=>r.payload.checksum===sha(specimen));assert.equal(held.payload.state,'infected');assert.ok(held.payload.engine);
  await h.api('/content-security/release',member,{checksum:sha(specimen),confirm:true,reason:'Reviewed harmless scanner specimen'},403);
  await h.api('/content-security/release',owner,{checksum:sha(specimen),confirm:false,reason:'Reviewed harmless scanner specimen'},400);
  offline=true;await h.api('/items',owner,{parent:folder.id,name:'Pending.txt',base64:b64('synthetic-chest-3')},423);offline=false;
  wrongReceipt=true;await h.api('/items',owner,{parent:folder.id,name:'Bad receipt.txt',base64:b64('synthetic-chest-4')},423);wrongReceipt=false;
  assert.ok(!(await h.api(`/items/${folder.id}`,owner)).children.some(c=>c.name==='Pending.txt'));
  const sensitive=await h.api('/items',owner,{parent:folder.id,name:'Sensitive terms.txt',base64:b64('Classification: Sensitive\nsynthetic-chest-5')});
  await h.api(`/items/${sensitive.id}/shares`,owner,{principal:'member@example.test',role:'viewer'});
  assert.equal((await h.raw(`/api/chest/items/${sensitive.id}`,member)).status,403);
  await h.api(`/items/${sensitive.id}/links`,owner,{audience:'public'},403);
  assert.doesNotMatch(await (await h.fetch(base)).text(),/Sensitive terms/);assert.ok((await h.fetch(`${base}/f/${sensitive.id}`)).status>=400);
  const group=await h.api('/groups',owner,{name:'Approved sensitive readers',members:[]});await h.api(`/groups/${group.id}/members`,owner,{email:'member@example.test',action:'add'});
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[group.id],confirm:true});assert.equal((await h.raw(`/api/chest/items/${sensitive.id}/bytes/${sensitive.payload.current}?download=true`,member)).status,200);
  await h.api(`/groups/${group.id}/members`,owner,{email:'member@example.test',action:'remove'});assert.equal((await h.raw(`/api/chest/items/${sensitive.id}/bytes/${sensitive.payload.current}?download=true`,member)).status,403);
  await h.stop();await h.start();review=await h.api('/content-security',owner);assert.equal(review.scans.find(r=>r.payload.checksum===sha(specimen)).payload.state,'infected','quarantine survives restart');
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(cookies(owner,h.origin));const page=await context.newPage();await page.goto(h.origin+'/app/upload-protection');await page.getByRole('heading',{name:'Content quarantine',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-content-quarantine.png`,fullPage:true});
   if(width===1440){const panel=page.locator('li').filter({has:page.getByText('SHA-256 '+sha(specimen),{exact:true})});await panel.getByLabel('Reason for false-positive release').fill('Reviewed harmless EICAR false positive for this exact retained original');await Promise.all([page.waitForNavigation(),panel.getByRole('button',{name:'Release false positive'}).click()]);await page.getByText(/Released by owner@example.test/).waitFor()}
   await context.close();
  }
  const released=await h.api(`/items/${file.id}/versions`,owner,{base64:b64(specimen)});assert.equal(released.payload.versions.length,2);assert.equal(await (await h.raw(`/api/chest/items/${file.id}/bytes/${released.payload.current}?download=true`,owner)).text(),specimen.toString());
  await h.api('/content-security/policy',owner,{enabled:false,sensitiveGroups:[],confirm:true});assert.equal((await h.raw(`/api/chest/items/${sensitive.id}`,member)).status,403,'disabling processing never expands sensitive access');
  const audit=await h.api('/audit?limit=200',owner);assert.ok(JSON.stringify(audit).includes('security.content.release'));
  console.log('SECURITY-002 content quarantine: real Worker intake, pending/failed/invalid receipts, all read doors, classification, group revocation, owner-only explicit release, retained originals and restart at 1440/390; scanner='+ (real?'real ClamAV with test-only EICAR database':'network-edge fake'));
 }finally{await browser?.close();await h.close();await real?.close()}
}
export async function activitySecurityFlow(){
 const start=Date.now(),h=await harness();let browser;
 try{
  const owner=await bootstrap(h);await h.api('/people',owner,{action:'invite',email:'actor@example.test',name:'Casey Taylor'});const actor=await h.signIn('actor@example.test',true),space=(await h.api('/files',actor)).personal,files=[];
  for(let n=0;n<501;n++){files.push(await h.api('/items',actor,{space,name:`File ${n}.txt`,base64:b64(`synthetic-chest-${n+10}`)}));if(n%100===0)console.log('SECURITY-002 activity fixture '+n+'/501')}
  const download=(f,cookie=actor,headers={})=>h.fetch(`/api/chest/items/${f.id}/bytes/${f.payload.current}?download=true`,{headers:{cookie,...headers}});
  for(const f of files)assert.equal((await download(f)).status,200);
  let review=await h.api('/content-security',owner);assert.ok(review.alerts.some(a=>a.actor==='actor@example.test'&&a.kind==='download'&&a.detail.limit===500));assert.ok(h.mails.some(m=>m.subject==='Chest mass activity alert'));
  for(const f of files.slice(0,199))await h.api(`/items/${f.id}/trash`,actor,{});
  review=await h.api('/content-security',owner);assert.ok(!review.alerts.some(a=>a.kind==='delete'),'199 trash operations do not cross the default');
  const group=await h.api('/groups',owner,{name:'Finance download rule',members:[]});await h.api(`/groups/${group.id}/members`,owner,{email:'actor@example.test',action:'add'});
  await h.api('/content-security/rule',actor,{scope:group.id,files:100,bytes:5*1024**3,deletions:200,pause:true},403);
  await h.api('/content-security/rule',owner,{scope:group.id,files:100,bytes:5*1024**3,deletions:200,pause:true});
  // Age the durable window, without substituting an application clock or fixture answer.
  await h.sql('UPDATE chest_activity_events SET at=at-600001');await h.sql('UPDATE chest_activity_alerts SET at=at-600001');
  const file=files[300];for(let n=0;n<99;n++)assert.equal((await download(file)).status,200);
  const boundary=await Promise.all([download(file),download(file)]);assert.deepEqual(boundary.map(r=>r.status).sort(),[200,423],'parallel 100th/101st admission is atomic');
  review=await h.api('/content-security',owner);assert.ok(review.alerts.some(a=>a.rule===group.id&&a.detail.name==='Finance download rule'));assert.ok(review.pauses.some(p=>p.subject==='account:actor@example.test'));
  const before=(await h.api(`/items/${file.id}`,actor)).versions.length;assert.equal((await download(file)).status,423);assert.equal((await h.api(`/items/${file.id}`,actor)).versions.length,before,'pause destroys no originals');
  const device=await h.api('/devices',actor,{name:'Finance companion',platform:'macos'});assert.equal((await h.fetch(`/api/chest/sync/items/${file.id}/content?version=${file.payload.current}`,{headers:{authorization:`Bearer ${device.token}`}})).status,423);
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
  for(const width of [1440,390]){const c=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await c.addCookies(cookies(owner,h.origin));const p=await c.newPage();await p.goto(h.origin+'/app/upload-protection');await p.getByRole('heading',{name:'Mass activity',exact:true}).waitFor();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`test-results/${width}-content-activity-alert.png`,fullPage:true});await c.close()}
  await h.api('/content-security/resume',actor,{subject:'account:actor@example.test',reason:'Not an authorized security reviewer'},403);
  await h.sql('UPDATE chest_activity_events SET at=at-600001');await h.api('/content-security/resume',owner,{subject:'account:actor@example.test',reason:'Reviewed download activity and expired the test window'});assert.equal((await download(file)).status,200);
  await h.stop();await h.start();assert.ok((await h.api('/content-security',owner)).alerts.length,'retained alert history survives restart');
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();console.log('SECURITY-002 activity receipt '+JSON.stringify({head,files:501,trash:199,groupLimit:100,parallelStatuses:[200,423],elapsedMs:Date.now()-start,run:process.env.CHEST_CONTENT_RUN_ID??'local-content-security'}));
 }finally{await browser?.close();await h.close()}
}
