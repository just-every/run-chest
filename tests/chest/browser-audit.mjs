import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness(),email=name=>[name,'example.test'].join('@'),cookies={};let browser;
const viewZone='America/New_York',displayTime=at=>new Intl.DateTimeFormat('en-US',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:viewZone}).format(new Date(at));
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);
 cookies.owner=cookie;
 await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=await h.api('/spaces',cookie,{name:'Harbor Freight operations'}),file=await h.api('/items',cookie,{space:space.id,type:'file',name:'November delivery plan.txt',base64:Buffer.from('Confirm delivery dates with Acme Supply before Friday.').toString('base64')});
 await h.api(`/items/${file.id}/rename`,cookie,{name:'November delivery plan — approved dates.txt'});
 await h.api(`/items/${file.id}/comments`,cookie,{message:'The loading dock is reserved for the 12 November delivery.'});
 browser=await chromium.launch({headless:true,...(process.env.CHEST_CHROMIUM_PATH?{executablePath:process.env.CHEST_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});await ctx.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const page=await ctx.newPage();
  await page.goto(h.origin+'/app/audit');await page.getByLabel('Search history',{exact:true}).fill('item.rename');await page.getByRole('button',{name:'Search history',exact:true}).click();await page.waitForURL('**/app/audit?**');await page.getByRole('heading',{name:'Audit trail',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-audit-history.png`,fullPage:true});
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export all matching history'}).click();assert.equal((await download).suggestedFilename(),'chest-audit.ndjson');
  await page.getByRole('button',{name:'Hide my views',exact:true}).click();await page.getByRole('button',{name:'Show my views',exact:true}).waitFor();
  await page.getByLabel('Record of views shown to collaborators').selectOption('false');await page.getByRole('button',{name:'Save view history',exact:true}).click();assert.equal((await h.api('/audit/privacy',cookie)).policy.enabled,false);
  await page.screenshot({path:`test-results/${width}-audit-privacy.png`,fullPage:true});
  await page.getByLabel('Record of views shown to collaborators').selectOption('true');await page.getByRole('button',{name:'Save view history',exact:true}).click();await page.getByRole('button',{name:'Show my views',exact:true}).click();
  await page.goto(h.origin+`/app/items/${file.id}`);await page.getByRole('heading',{name:'Activity',exact:true}).waitFor();assert.ok(await page.getByRole('link',{name:"Search or export this file's history"}).count());await page.screenshot({path:`test-results/${width}-audit-file.png`,fullPage:true});
  await page.getByRole('link',{name:"Search or export this file's history"}).click();await page.getByRole('heading',{name:'Audit trail',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('object'),file.id);
  await ctx.close();
 }
 // Two ordinary colleagues open the file, then a contributor and viewer inspect its real Activity panel.
 for(const [name,role] of [['jordan','contributor'],['casey','viewer'],['morgan','contributor']]){
  await h.api('/people',cookie,{action:'invite',email:email(name),name});cookies[name]=await h.signIn(email(name),true);
 }
 await h.api(`/spaces/${space.id}/members`,cookie,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:email('jordan'),role:'contributor'},{principal:email('casey'),role:'viewer'},{principal:email('morgan'),role:'contributor'}]});
 const contexts=[];
 const as=async name=>{
  const context=await browser.newContext({ignoreHTTPSErrors:true,timezoneId:viewZone,viewport:{width:1440,height:1000}});contexts.push(context);
  await context.addCookies(cookies[name].split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));
  return context.newPage();
 };
 try{
  const jordan=await as('jordan'),casey=await as('casey'),contributor=await as('morgan');
  for(const page of [jordan,casey]){await page.goto(h.origin+`/app/items/${file.id}`);await page.getByRole('heading',{name:'Activity',exact:true}).waitFor()}
  const views=(await h.api(`/audit?paginate=true&action=item.read&object=${file.id}`,cookie)).rows;
  const recorded=['jordan','casey'].map(name=>{const event=views.find(r=>r.actor===email(name));assert.ok(event&&Number.isFinite(Date.parse(event.at)),'each colleague has a timestamped public view event');return event});
  await Promise.all([jordan.waitForNavigation(),jordan.locator('[data-upload] input[data-pick]').first().setInputFiles({name:'November delivery plan.txt',mimeType:'text/plain',buffer:Buffer.from('Revised delivery: confirm the loading dock before 12 November.')})]);
  const changed=await h.api(`/items/${file.id}`,cookies.jordan),version=changed.item.current;
  assert.equal(changed.versions.length,2,'the browser edit retains the original and publishes a real new version');
  const edit=(await h.api(`/audit?paginate=true&action=version.upload&object=${file.id}`,cookie)).rows.find(r=>r.actor===email('jordan')&&JSON.parse(r.detail).version===version);assert.ok(edit,'the edit is publicly recorded against the new version');
  await contributor.goto(h.origin+`/app/items/${file.id}`);
  const events=contributor.locator('ol.events > li');
  for(const event of recorded){
   const row=events.filter({hasText:event.actor}).filter({hasText:'opened it'}).filter({has:contributor.locator(`time[datetime="${event.at}"]`)});
   await row.waitFor();assert.equal(await row.locator('time').getAttribute('datetime'),event.at,'the displayed view time matches its public event');assert.equal(await row.locator('time').innerText(),displayTime(event.at),'the visible local time matches the public view record');
  }
  const proof=async(page,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`test-results/${width}-audit-${name}.png`,fullPage:true})}await page.setViewportSize({width:1440,height:1000})};
  await proof(contributor,'contributor-activity');
  await casey.reload();const viewerEvents=casey.locator('ol.events > li'),editRow=viewerEvents.filter({hasText:email('jordan')}).filter({hasText:'uploaded a new version'});
  await editRow.waitFor();assert.equal(await editRow.locator('time').getAttribute('datetime'),edit.at,'a viewer sees the actual edit timestamp');assert.equal(await editRow.locator('time').innerText(),displayTime(edit.at),'the viewer sees the edit on their own clock');
  assert.equal(await editRow.locator('p.quiet').innerText(),await casey.locator('.ver-current h3 > span').innerText(),'Activity labels the replacement with the same version number as Version history');
  assert.equal(await viewerEvents.filter({hasText:'opened it'}).count(),0,'a viewer sees no view-history rows');
  assert.equal(await viewerEvents.filter({hasText:email('casey')}).count(),0,'the viewer identity does not leak through view history');
  await proof(casey,'viewer-activity');
  await h.api('/audit/privacy',cookies.jordan,{hidden:true});await contributor.reload();
  assert.equal(await contributor.locator('ol.events > li').filter({hasText:email('jordan')}).filter({hasText:'opened it'}).count(),0,'hiding views removes the colleague from the browser list');
  assert.ok(await contributor.locator('ol.events > li').filter({hasText:email('casey')}).filter({hasText:'opened it'}).count(),'the other colleague retains recorded opens');
  const group=await h.api('/groups',cookie,{name:'Private viewers',members:[email('casey')]});
  await h.api('/audit/privacy',cookie,{scope:'organization',enabled:true,groups:[group.id]});await contributor.reload();
  assert.equal(await contributor.locator('ol.events > li').filter({hasText:email('casey')}).filter({hasText:'opened it'}).count(),0,'group suppression removes retained views');
 }finally{for(const context of contexts)await context.close()}
 console.log('AUDIT-001 and AUDIT-002 browser passed: two colleague identities and public times, viewer edits without view history, hiding and group suppression; screens at 1440 and 390');
}finally{await browser?.close();await h.close()}
