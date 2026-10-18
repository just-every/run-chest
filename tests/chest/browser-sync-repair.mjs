// AGENT-003: real file-backed queue, interrupted hydration, scoped resume, independent hashes and retained conflicts.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {runCompanion} from '../../scripts/sync-companion/run.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),h=await harness(),roots=[];
let browser;
try {
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});
 const owner=await h.signIn(h.vars.OWNER_EMAIL),email='dana@example.test';
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 await h.api('/people',owner,{action:'invite',email,name:'Dana Chen'});const member=await h.signIn(email,true);
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:950},ignoreHTTPSErrors:true});
  await context.addCookies(member.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));
  const page=await context.newPage(),shot=async(name,mask=[])=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${name} fits`);await page.screenshot({path:`test-results/${width}-sync-repair-${name}.png`,fullPage:true,mask})};
  await page.goto(h.origin+'/app/devices');await page.getByText('Connect the command-line companion',{exact:true}).click();
  const enrollment=page.locator('form').filter({has:page.getByRole('button',{name:'Create companion key',exact:true})});await enrollment.getByLabel('Device name',{exact:true}).fill(`Dana workstation ${width}`);await shot('connect');
  await Promise.all([page.waitForNavigation(),enrollment.getByRole('button',{name:'Create companion key',exact:true}).click()]);
  await page.getByRole('heading',{name:'Companion key created',exact:true}).waitFor();
  const token=await page.locator('.receipt').textContent();await shot('key',[page.locator('.receipt')]);
  const registered=(await h.api('/devices',member)).find(d=>d.name===`Dana workstation ${width}`),enrolled={device:registered,token};assert.ok(token.startsWith('chest_dev_'));
  const space=await h.api('/spaces',owner,{name:`Harbor project ${width}`});
  await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:email,role:'contributor'}]});
  const folder=await h.api('/items',owner,{space:space.id,type:'folder',name:'Project records'}),files={};
  const contents={'Plan.txt':'Harbor work plan.\n'.repeat(8000),'Budget.txt':'Approved budget: 25000 USD','Private.txt':'Private project notes'};
  for(const [name,content] of Object.entries(contents))files[name]=await h.api('/items',owner,{parent:folder.id,name,base64:Buffer.from(content).toString('base64')});
  const root=await mkdtemp(join(tmpdir(),'chest-repair-'));roots.push(root);
  let interrupted=false,resumed=false;
  const transport=async(url,init={})=>{const u=new URL(url);if(init.headers?.range==='bytes=500-')resumed=true;return h.fetch(u.pathname+u.search,init)};
  const lossy=async(url,init)=>{
   const response=await transport(url,init);
   if(!interrupted&&new URL(url).pathname===`/api/chest/sync/items/${files['Plan.txt'].id}/content`){
    interrupted=true;const bytes=new Uint8Array(await response.arrayBuffer());let sent=false;
    return new Response(new ReadableStream({pull(c){if(!sent){sent=true;c.enqueue(bytes.slice(0,500))}else c.error(Error('test network interruption'))}}),{status:response.status,headers:response.headers});
   }
   return response;
  };
  const options={origin:h.origin,folder:folder.id,root,token:enrolled.token,fetch:transport};
  await runCompanion({...options,fetch:lossy});assert.ok(interrupted);
  await assert.rejects(readFile(join(root,'Plan.txt')),'interrupted hydration is not published as a complete file');
  await h.stop();await h.start();await runCompanion(options);assert.ok(resumed,'the interrupted file resumes its saved byte range');
  for(const [name,content] of Object.entries(contents))assert.equal(hash(await readFile(join(root,name))),hash(content));
  let report=(await h.api('/sync-repair',member)).find(r=>r.device===enrolled.device.id);assert.equal(report.state,'verified');
  assert.ok(report.files.every(f=>f.state==='verified'));
  await writeFile(join(root,'Plan.txt'),'Locally revised Harbor plan');
  await writeFile(join(root,'Budget.txt'),'Offline budget: 27000 USD');
  await writeFile(join(root,'Private.txt'),'Private local edit retained');
  await h.api(`/items/${files['Budget.txt'].id}/versions`,owner,{base64:Buffer.from('Remote budget: 29000 USD').toString('base64')});
  await h.api(`/items/${files['Private.txt'].id}/settings`,owner,{restricted:true});
  await runCompanion({...options,pause:true});
  report=(await h.api('/sync-repair',member)).find(r=>r.device===enrolled.device.id);assert.equal(report.state,'waiting');
  assert.ok(report.files.some(f=>f.state==='conflicted'));assert.ok(report.files.some(f=>f.state==='denied'));
  assert.ok(!JSON.stringify(report).includes('Private.txt'),'a revoked file has no name or hashes in diagnosis');
  await h.api('/sync-repair/resume',owner,{device:enrolled.device.id,folder:folder.id,revision:report.revision},403);
  await page.goto(h.origin+'/app/devices');await page.getByRole('heading',{name:'Sync repair',exact:true}).waitFor();await shot('paused');
  const resume=page.getByRole('button',{name:'Authorize this paused queue to resume',exact:true}).last();
  await Promise.all([page.waitForNavigation(),resume.click()]);await shot('authorized');
  await h.stop();await h.start();await runCompanion(options);
  await page.reload();await shot('repaired');
  report=(await h.api('/sync-repair',member)).find(r=>r.device===enrolled.device.id);
  const plan=report.files.find(f=>f.path==='Plan.txt');assert.equal(plan.state,'verified');assert.equal(plan.localChecksum,hash('Locally revised Harbor plan'));assert.equal(plan.localChecksum,plan.remoteChecksum);
  const budget=report.files.find(f=>f.path==='Budget.txt');assert.equal(budget.state,'conflicted');assert.ok(budget.conflictItem);
  assert.equal(await readFile(join(root,'Budget.txt'),'utf8'),'Offline budget: 27000 USD');
  const remote=await h.fetch(`/api/chest/sync/items/${files['Budget.txt'].id}/content`,{headers:{authorization:`Bearer ${enrolled.token}`}});assert.equal(await remote.text(),'Remote budget: 29000 USD');
  const preserved=await h.api(`/items/${budget.conflictItem}`,member);assert.equal(preserved.versions[0].checksum,hash('Offline budget: 27000 USD'));
  assert.equal(await readFile(join(root,'Private.txt'),'utf8'),'Private local edit retained');
  assert.equal((await h.api('/sync-repair',owner)).length,0,'a different user gets no local queue telemetry');
  await h.api('/sync-repair/resume',member,{device:enrolled.device.id,folder:folder.id,revision:'outdated'},409);
  await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});await page.reload();await shot('denied');
  report=(await h.api('/sync-repair',member)).find(r=>r.device===enrolled.device.id);assert.ok(report.files.every(f=>f.state==='denied'));assert.equal(report.canResume,false);
  await h.api('/sync-repair/resume',member,{device:enrolled.device.id,folder:folder.id,revision:report.revision},403);
  await context.close();
 }
 console.log('AGENT-003 real interrupted download/restart, durable paused queue, scoped browser authorization, verified hashes, divergent originals and revocation passed at 1440/390');
}finally{await browser?.close();await h.close();for(const root of roots)await rm(root,{recursive:true,force:true})}
