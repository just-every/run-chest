import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { harness } from './harness.mjs';
import { officeRestoreJourney, migrationArrivalJourney } from './office-restore-flow.mjs';
const h=await harness();let browser;
const press=async(p,name)=>{const page=p.page?p.page():p;await Promise.all([page.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()])};
const fit=async(p,name,width,locator)=>{await p.waitForLoadState('load');await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await (locator??p).screenshot({path:`test-results/${width}-new-${name}.png`,...(locator?{}:{fullPage:true})})};
try {
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?['--no-sandbox']:[])]});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const p=await context.newPage(),go=path=>p.goto(h.origin+path);
  const space=await h.api('/spaces',owner,{name:`Harbor operations ${width}`}),folder=await h.api('/items',owner,{space:space.id,type:'folder',name:'Supplier agreements'});
  await go(`/app/spaces/${space.id}`);await p.getByText('New',{exact:true}).click();await fit(p,'space-menu',width);
  await go(`/app/items/${folder.id}`);await p.getByText('New',{exact:true}).click();const newForm=p.locator('form').filter({has:p.getByRole('button',{name:'Create file',exact:true})});await newForm.getByLabel('Name (optional)').fill(`Harbor supplier memo ${width}`);await newForm.getByLabel('Start from').selectOption('document:builtin:memo');await fit(p,'folder-menu',width);await press(newForm,'Create file');
  await p.waitForURL(/\/app\/items\/[^?]+\?edit=1$/);const file=p.url().split('/items/')[1].split('?')[0];await fit(p,'created-editor',width);const editor=p.locator('form').filter({has:p.getByRole('button',{name:'Save new version',exact:true})});await editor.locator('textarea').first().fill('Harbor Freight supplier delivery memo');await press(editor,'Save new version');
  assert.equal((await h.api(`/items/${file}`,owner)).versions.length,2);await fit(p,'saved-file',width);
  const publish=p.locator('form').filter({has:p.getByRole('button',{name:'Publish template',exact:true})});await publish.getByLabel('Template name',{exact:true}).fill(`Harbor supplier memo ${width}`);await publish.getByLabel('Category',{exact:true}).fill('Operations');await fit(p,'publish-template',width,p.locator('.side-card').filter({has:p.getByRole('heading',{name:'Publish a template',exact:true})}));await press(publish,'Publish template');assert.ok((await h.api('/templates',owner)).templates.some(t=>t.name===`Harbor supplier memo ${width}`),'published template appears in the gallery');
  await go('/app/templates');await p.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));assert.ok(await p.locator('img').evaluateAll(images=>images.every(image=>image.naturalWidth>0)),'template thumbnails load');await fit(p,'templates',width);
  await go(`/app/items/${folder.id}?manage`);await fit(p,'folder-review-page',width);const governance=p.locator('form').filter({has:p.getByRole('button',{name:'Require version review',exact:true})});await governance.getByLabel('Reviewer').selectOption(h.vars.OWNER_EMAIL);await fit(p,'folder-review',width,p.locator('.side-card').filter({has:p.getByRole('heading',{name:'Version review',exact:true})}));await press(governance,'Require version review');
  const item=await h.api('/items',owner,{parent:folder.id,name:`Signed payment terms ${width}.txt`,base64:Buffer.from('Payment due thirty days after delivery.').toString('base64')});await go(`/app/items/${item.id}`);await fit(p,'pending-review',width);await press(p,'Approve this version');await fit(p,'approved-review',width);
  await officeRestoreJourney(h,context,owner,width);
  await migrationArrivalJourney(h,context,owner,width);
  await context.close();
 }
 // Service-settings delegation exposes the existing creation and publishing forms, without content elevation.
 await h.api('/people',owner,{action:'invite',email:'template-admin@example.test',name:'Template administrator'});
 const delegated=await h.signIn('template-admin@example.test',true),personal=(await h.api('/files',delegated)).personal;
 const grant=await h.api('/administration/roles',owner,{email:'template-admin@example.test',role:'service-settings',scope:'organization',super:false});
 const source=await h.api('/new-files',delegated,{space:personal,kind:'document',key:'delegated-browser-source'});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(delegated.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const p=await context.newPage();
  await p.goto(`${h.origin}/app/items/${source.id}`);
  const publisher=p.locator('form').filter({has:p.getByRole('button',{name:'Publish template',exact:true})});
  if(width===1440){
   await publisher.getByLabel('Template name',{exact:true}).fill('Delegated project starter');await publisher.getByLabel('Category',{exact:true}).fill('Projects');await publisher.getByLabel('Template audience').selectOption('organisation');await press(publisher,'Publish template');
   assert.ok((await h.api('/templates',delegated)).templates.some(t=>t.name==='Delegated project starter'&&t.canUnpublish));
   await p.goto(`${h.origin}/app/items/${source.id}`);
   // Existing icon controls retain immediate focus and delayed hover labels on the touched screen.
   const control=p.locator('[data-tooltip]').first();await control.focus();assert.equal(await p.getByRole('tooltip').innerText(),await control.getAttribute('data-tooltip'));await control.blur();await control.hover();await p.getByRole('tooltip').waitFor({state:'visible'});
  }
  await fit(p,'delegated-publisher',width,p.locator('.side-card').filter({has:p.getByRole('heading',{name:'Publish a template',exact:true})}));
  await p.goto(`${h.origin}/app/templates`);
  if(width===1440){await p.getByLabel('Organization default').selectOption('odf');await press(p,'Save creation settings');assert.equal((await h.api('/creation-settings',delegated)).format,'odf')}
  await fit(p,'delegated-settings',width);
  if(width===1440){
   await h.api('/administration/roles',owner,{action:'revoke',id:grant.id});await p.reload();assert.equal(await p.getByRole('button',{name:'Save creation settings',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Unpublish',exact:true}).count(),0);
   await p.goto(`${h.origin}/app/items/${source.id}`);assert.equal(await p.getByRole('button',{name:'Publish template',exact:true}).count(),0);
   await h.api('/administration/roles',owner,{email:'template-admin@example.test',role:'service-settings',scope:'organization',super:false});
  }
  await context.close();
 }
 await h.api('/creation-settings',owner,{format:'office',groups:[]});
 console.log('SPACE-001 EDIT-004 browser at 1440 and 390 passed');
} finally { await browser?.close();await h.close() }

await (await import('./wopi-flow.mjs')).wopiFlow({browserProof:true});

await (await import('./role-review-flow.mjs')).roleReviewFlow({browserProof:true});

await (await import('./restriction-flow.mjs')).restrictionFlow({browserProof:true});
