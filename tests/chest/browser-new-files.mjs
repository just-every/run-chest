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
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const p=await context.newPage(),go=path=>p.goto(h.origin+path);
  const space=await h.api('/spaces',owner,{name:`Harbor operations ${width}`}),folder=await h.api('/items',owner,{space:space.id,type:'folder',name:'Supplier agreements'});
  await go(`/app/spaces/${space.id}`);await p.getByText('New',{exact:true}).click();await fit(p,'space-menu',width);
  await go(`/app/items/${folder.id}`);await p.getByText('New',{exact:true}).click();const newForm=p.locator('form').filter({has:p.getByRole('button',{name:'Create document',exact:true})});await newForm.getByLabel('New document name').fill(`Harbor supplier memo ${width}`);await newForm.getByLabel('Document template').selectOption('builtin:memo');await fit(p,'folder-menu',width);await press(newForm,'Create document');
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
 console.log('SPACE-001 EDIT-004 browser at 1440 and 390 passed');
} finally { await browser?.close();await h.close() }

await (await import('./wopi-flow.mjs')).wopiFlow({browserProof:true});

await (await import('./role-review-flow.mjs')).roleReviewFlow({browserProof:true});
