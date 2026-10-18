// QUOTA-001 through the built product. Only outbound email is replaced at its provider edge.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const b64=s=>Buffer.from(s).toString('base64');
const go=(p,path)=>p.goto(h.origin+path);
async function submit(form,name){const page=form.page();await Promise.all([page.waitForNavigation(),form.getByRole('button',{name,exact:true}).click()])}
async function fit(page,name,width){await page.waitForLoadState('load');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fits ${width}`);await page.screenshot({path:`test-results/${width}-quota-${name}.png`,fullPage:true})}
const formFor=(p,name)=>p.locator('form').filter({has:p.getByRole('button',{name,exact:true})});
async function savePolicy(page,button,value,target){await go(page,'/app/storage');const form=formFor(page,button);if(target)await form.locator('[name="target"]').selectOption(target);await form.getByLabel('Storage limit in bytes (blank means unlimited)',{exact:true}).fill(String(value));await submit(form,button)}
async function refuseUpload(page,file,width,name){const response=page.waitForResponse(r=>r.url().includes('/api/chest/uploads')&&r.status()===413);await page.locator('[data-upload] input[data-pick]').first().setInputFiles({name:file,mimeType:'text/plain',buffer:Buffer.from(`Held bytes for ${width} ${name}`)});const error=await (await response).json();assert.equal(error.error,'storage_limit_exceeded');assert.ok(error.scope==='user'||error.scope==='space');assert.equal(error.limitBytes,80);assert.equal(error.usedBytes,100);await page.locator('[data-state="failed"]').waitFor();assert.ok(await page.locator('[data-upload] [role="alert"]').filter({hasText:/limit/i}).count());await fit(page,name,width)}
try{
 await mkdir('test-results',{recursive:true});
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const email=`jordan-${width}@example.test`;await h.api('/people',owner,{action:'invite',email,name:`Jordan Lee ${width}`});const member=await h.signIn(email,true),personal=(await h.api('/files',member)).personal;
  const operations=await h.api('/groups',owner,{name:`Operations ${width}`,members:[email]}),leads=await h.api('/groups',owner,{name:`Team leads ${width}`,members:[email]});
  const original=`Approved supplier terms ${width}:`.padEnd(100,'.'),folder=await h.api('/items',member,{space:personal,type:'folder',name:`Supplier documents ${width}`}),file=await h.api('/items',member,{parent:folder.id,type:'file',name:'Supplier terms.txt',base64:b64(original)});
  const team=await h.api('/spaces',member,{name:`Operations library ${width}`}),teamFolder=await h.api('/items',member,{space:team.id,type:'folder',name:'Shared supplier records'}),teamFile=await h.api('/items',member,{parent:teamFolder.id,type:'file',name:'Shared terms.txt',base64:b64(original)});
  const contexts=[];async function page(cookie){const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});contexts.push(context);await context.addCookies(cookie.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));return context.newPage()}
  const admin=await page(owner),user=await page(member);
  await savePolicy(admin,'Save personal default',1000);await savePolicy(admin,'Save space default',1000);
  await savePolicy(admin,'Save group limit',300,operations.id);await savePolicy(admin,'Save group limit',500,leads.id);
  let effective=await h.api(`/spaces/${personal}/quota`,owner);assert.equal(effective.limitBytes,500);assert.match(effective.rule,new RegExp(`Team leads ${width}`));await fit(admin,'group-precedence',width);await go(admin,`/app/spaces/${personal}/quota`);await fit(admin,'individual-quota',width);await go(admin,'/app/admin');await fit(admin,'owner-storage-card',width);
  await savePolicy(admin,'Save group limit',60,operations.id);await savePolicy(admin,'Save group limit',110,leads.id);
  await go(user,`/app/items/${file.id}`);await user.getByRole('status').filter({hasText:/90%/}).waitFor();await fit(user,'ninety-percent-file-warning',width);
  await go(user,'/app/notices');assert.ok(await user.getByText(/storage/i).count());await fit(user,'storage-notice',width);
  assert.ok(h.mails.some(m=>[m.to].flat().includes(email)&&/storage/i.test(`${m.subject} ${m.text}`)),'storage warning reaches the mail provider');
  await savePolicy(admin,'Save group limit',80,leads.id);assert.equal(new URL(admin.url()).pathname,'/app/action');
  assert.ok(await admin.getByText(email,{exact:false}).count());assert.ok(await admin.getByText(/100 bytes/).count());assert.equal((await h.api(`/spaces/${personal}/quota`,owner)).limitBytes,110,'confirmation has not saved the lower limit');await fit(admin,'confirm-lower-group-limit',width);
  await submit(formFor(admin,'Confirm storage limit'),'Confirm storage limit');effective=await h.api(`/spaces/${personal}/quota`,owner);assert.equal(effective.limitBytes,80);await fit(admin,'effective-over-limit',width);
  await go(user,`/app/items/${folder.id}`);await refuseUpload(user,'Held folder upload.txt',width,'personal-folder-refusal');
  await go(user,`/app/items/${file.id}`);await refuseUpload(user,'Held new version.txt',width,'personal-file-refusal');
  const detail=await h.api(`/items/${file.id}`,member),download=await h.raw(`/api/chest/items/${file.id}/bytes/${detail.item.current}?download=true`,member);assert.equal(download.status,200);assert.equal(await download.text(),original);assert.equal(detail.versions.length,1,'refused replacement preserves the original');
  await savePolicy(admin,'Save user limit',1000,email);effective=await h.api(`/spaces/${personal}/quota`,owner);assert.equal(effective.limitBytes,1000);assert.match(effective.rule,/user/i);await fit(admin,'user-override',width);
  await go(user,`/app/items/${folder.id}`);await user.locator('[data-upload] input[data-pick]').first().setInputFiles({name:'Held folder upload.txt',mimeType:'text/plain',buffer:Buffer.from(`Held bytes for ${width} personal-folder-refusal`)});await user.waitForURL(/\/app\/items\//);await user.getByRole('heading',{name:'Held folder upload.txt',exact:true}).waitFor();await fit(user,'writes-resumed',width);
  await savePolicy(admin,'Save space limit',80,team.id);assert.ok(await admin.getByText(team.payload.name,{exact:false}).count());assert.equal((await h.api(`/spaces/${team.id}/quota`,owner)).limitBytes,1000);await fit(admin,'confirm-lower-space-limit',width);await submit(formFor(admin,'Confirm storage limit'),'Confirm storage limit');
  await go(user,`/app/items/${teamFolder.id}`);await refuseUpload(user,'Shared held upload.txt',width,'team-folder-refusal');
  await h.api(`/items/${teamFile.id}/trash`,member,{});assert.equal((await h.api(`/spaces/${team.id}/quota`,owner)).usedBytes,100,'trash still counts');
  await savePolicy(admin,'Save space limit',1000,team.id);await go(user,`/app/items/${teamFolder.id}`);await user.locator('[data-upload] input[data-pick]').first().setInputFiles({name:'Shared held upload.txt',mimeType:'text/plain',buffer:Buffer.from(`Shared resumed ${width}`)});await user.getByRole('heading',{name:'Shared held upload.txt',exact:true}).waitFor();await fit(user,'team-writes-resumed',width);
  for(const context of contexts)await context.close();
 }
 console.log('QUOTA-001 browser policy precedence, lowering confirmation, warnings, retained originals, upload refusal and resumed writes at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
