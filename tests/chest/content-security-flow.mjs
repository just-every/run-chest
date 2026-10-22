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
import {docx} from './office-fixtures.mjs';
import {pdf} from './fixtures.mjs';
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
 const database=process.env.CHEST_CLAMAV_DATABASE??dir;
 const child=spawn('python3',['services/content-scan/server.py','--port','0','--clamscan',process.env.CHEST_CLAMSCAN,'--database',database],{env:{...process.env,CONTENT_SCANNER_TOKEN:'synthetic-chest-1'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);let line='';
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('processor did not start: '+stderr))},20000);child.once('exit',()=>{clearTimeout(timer);reject(Error('processor exited: '+stderr))});child.stdout.on('data',b=>{line+=b;const m=/CHEST_SCANNER_READY (\d+)/.exec(line);if(m){clearTimeout(timer);resolve(Number(m[1]))}})});
 return {url:`http://127.0.0.1:${port}/scan`,maintained:!!process.env.CHEST_CLAMAV_DATABASE,async close(){child.kill('SIGTERM');await once(child,'exit');await rm(dir,{recursive:true,force:true})}};
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
  const office=await h.api('/items',owner,{space,name:'Editor original.docx',base64:b64(docx())}),officePath=`/api/chest/items/${office.id}/office-preview/${office.payload.current}`;assert.equal((await h.raw(officePath,owner)).status,200,'the Office preview route works before quarantine');
  const pack=await h.api('/transfers',owner,{item:file.id,title:'Retained terms'}),transfer=new URL(pack.url).pathname,started=await h.fetch(transfer+'/start',{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:''}),transferCookie=started.headers.getSetCookie()[0].split(';')[0];assert.equal(started.status,303);assert.equal((await h.fetch(transfer+'/f/'+file.id,{headers:{cookie:transferCookie,range:'bytes=0-4'}})).status,206);
  const source=await h.api('/items',owner,{space,name:'Signature original.pdf',base64:b64(pdf())}),request=await h.api('/signatures',owner,{item:source.id});await h.api(`/signatures/${request.id}/send`,owner,{signers:[{email:'signer@outside.test',name:'External signer'}],mode:'sequential',expiresDays:7,reminderDays:1,fields:[{signer:'signer@outside.test',type:'signature',page:1,x:.1,y:.1,w:.3,h:.05},{signer:'signer@outside.test',type:'date',page:1,x:.5,y:.1,w:.2,h:.05}]});const signPath=new URL(h.mails.findLast(m=>[m.to].flat().includes('signer@outside.test')).text.match(/https?:\/\/[^\s]+\/sign\/[^\s]+/)[0]).pathname;assert.equal((await h.fetch(signPath)).status,200);
  assert.equal((await h.fetch(`${base}/f/${file.id}`)).status,200);assert.equal((await h.fetch(`${base}/p/${file.id}`)).status,200);assert.equal((await h.fetch(`/api/chest/sync/items/${file.id}/content?version=${file.payload.current}`,{headers:{authorization:`Bearer ${device.token}`}})).status,200);
  await h.api('/content-security/policy',member,{enabled:true,sensitiveGroups:[],confirm:true},403);
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:false},400);
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:true});
  // Previously retained, still-unscanned originals fail through every existing read door.
  for(const path of [`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`,`/api/chest/items/${file.id}/bytes/${file.payload.current}`,`/api/chest/items/${file.id}/office-preview/${file.payload.current}`,`/api/chest/items/${file.id}/pages/${file.payload.current}/1`])assert.ok((await h.raw(path,owner)).status===403,path);
  assert.ok((await h.fetch(`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`,{headers:{cookie:owner,range:'bytes=0-4'}})).status>=400);
  for(const path of [`${base}/f/${file.id}`,`${base}/p/${file.id}`])assert.equal((await h.fetch(path)).status,404,'quarantine hides an original and preview that were readable before');
  assert.ok((await h.fetch(`/api/chest/sync/items/${file.id}/content?version=${file.payload.current}`,{headers:{authorization:`Bearer ${device.token}`}})).status>=400);
  assert.equal((await h.raw(officePath,owner)).status,403,'an existing valid Office preview is quarantined');assert.equal((await h.fetch(signPath)).status,423,'an existing signing link cannot bypass quarantine');assert.equal((await h.fetch(transfer+'/f/'+file.id,{headers:{cookie:transferCookie,range:'bytes=0-4'}})).status,404,'quarantine conceals the previously readable transfer original');
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
  console.log('SECURITY-002 content quarantine: real Worker intake, pending/failed/invalid receipts, all read doors, classification, group revocation, owner-only explicit release, retained originals and restart at 1440/390; scanner='+ (real?(real.maintained?'real ClamAV with maintained vendor definitions':'real ClamAV with test-only EICAR database'):'network-edge fake'));
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
  const tree=await h.api('/items',actor,{space,type:'folder',name:'Three affected items'});for(let n=0;n<2;n++)await h.api('/items',actor,{parent:tree.id,name:`Nested ${n}.txt`,base64:b64(`synthetic-chest-nested-${n}`)});await h.api(`/items/${tree.id}/trash`,actor,{});assert.ok((await h.api('/content-security',owner)).alerts.some(a=>a.kind==='delete'),'folder trash counts its live descendants');
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
  await h.api('/content-security/rule',owner,{scope:group.id,files:1,bytes:5*1024**3,deletions:200,pause:true});await h.sql('UPDATE chest_activity_events SET at=at-600001');
  const hydrate=()=>h.fetch(`/api/chest/sync/items/${file.id}/content?version=${file.payload.current}`,{headers:{authorization:`Bearer ${device.token}`}});assert.equal((await hydrate()).status,200);assert.equal((await hydrate()).status,423);assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${device.token}`}})).status,423,'paused device cannot continue through metadata or upload doors');assert.equal((await h.fetch(`/api/chest/sync/items/${file.id}/content`,{method:'PUT',headers:{authorization:`Bearer ${device.token}`,'if-match':file.payload.current},body:'synthetic-chest-paused'})).status,423);
  const otherDevice=await h.api('/devices',actor,{name:'Independent device',platform:'macos'});assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${otherDevice.token}`}})).status,200);assert.equal((await h.raw('/api/chest/files',actor)).status,200);
  await h.stop();await h.start();assert.ok((await h.api('/content-security',owner)).alerts.length,'retained alert history survives restart');
  assert.equal((await h.api('/content-security',owner)).rules.find(r=>r.id==='organization').bytes,5_000_000_000,'the stated 5 GB default uses decimal bytes');await h.sql('UPDATE chest_activity_events SET at=at-600001');await h.sql('UPDATE chest_activity_alerts SET at=at-600001');await h.api('/content-security/resume',owner,{subject:'account:actor@example.test',reason:'Reviewed device incident before testing a separate byte window'});await h.api('/content-security/rule',owner,{scope:group.id,files:1000,bytes:10,deletions:200,pause:true});const byteStatuses=[];for(let n=0;n<3;n++){const r=await download(file,actor,{range:'bytes=0-4'});byteStatuses.push(r.status);if(r.status===206)assert.equal((await r.arrayBuffer()).byteLength,5)}assert.deepEqual(byteStatuses,[206,206,423],'ranges charge their actual interval; exactly ten bytes are admitted, the next five refused');assert.ok((await h.api('/content-security',owner)).alerts.some(a=>a.rule===group.id&&a.detail.byteLimit===10),'byte alert names the matched rule and byte bound');
  for(const width of [1440,390]){const c=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await c.addCookies(cookies(owner,h.origin));const page=await c.newPage();await page.goto(h.origin+'/app/upload-protection');assert.match(await page.locator('body').innerText(),/or 10 bytes in 10 minutes/);await page.screenshot({path:`test-results/${width}-content-byte-alert.png`,fullPage:true});await c.close()}
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();console.log('SECURITY-002 activity receipt '+JSON.stringify({head,files:501,trash:199,groupLimit:100,folderAffected:3,devicePause:true,parallelStatuses:[200,423],byteStatuses,byteLimit:10,elapsedMs:Date.now()-start,run:process.env.CHEST_CONTENT_RUN_ID??'local-content-security'}));
 }finally{await browser?.close();await h.close()}
}
