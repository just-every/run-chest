// ERASE-001 owner product path at desktop and phone sizes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Morgan, operations owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=(await h.api('/files',owner)).personal;
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
 for(const width of [1440,390]){
  const f=await h.api('/items',owner,{space,type:'file',name:`Harbor Freight expired supplier agreement ${width}.txt`,base64:Buffer.from('Retained legal agreement.').toString('base64')});await h.api(`/items/${f.id}/trash`,owner,{});
  const ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await ctx.addCookies(owner.split('; ').map(x=>{const i=x.indexOf('=');return{name:x.slice(0,i),value:x.slice(i+1),url:h.origin}}));const page=await ctx.newPage();page.setDefaultTimeout(15000);
  await page.goto(h.origin+'/app/administration');await page.screenshot({path:`test-results/${width}-erasure-administration.png`,fullPage:true});await page.getByRole('link',{name:'Permanent erasure',exact:true}).click();await page.getByRole('heading',{name:'Permanent erasure',exact:true}).waitFor();
  const backups=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Known backup copies',exact:true})});await backups.getByLabel('Backup name',{exact:true}).fill(`Offline encrypted archive ${width}`);await backups.getByLabel('Private location reference (no credentials or URL)',{exact:true}).fill(`/private/backups/harbor-${width}.rer`);await backups.getByLabel('Provider retention or deletion restriction',{exact:true}).fill('Offline disk unavailable. Removal must be verified.');await Promise.all([page.waitForNavigation(),backups.getByRole('button',{name:'Register backup copy',exact:true}).click()]);
  assert.match(await page.locator('body').innerText(),/Preservation instructions/);const held=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Preservation instructions',exact:true})});await held.getByLabel('Scope').selectOption('item');await held.getByLabel('Subject ID or email',{exact:true}).fill(f.id);await held.getByLabel('Reason and provider restriction',{exact:true}).fill('Preserve for counsel until contract dispute closes');await Promise.all([page.waitForNavigation(),held.getByRole('button',{name:'Record preservation hold',exact:true}).click()]);
  await page.getByLabel('Trashed item').selectOption(f.id);await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Permanently erase selected item',exact:true}).click()]);await page.getByRole('heading',{name:'files · held',exact:true}).last().waitFor();
  assert.equal((await h.api('/erasure',owner)).receipts[0].state,'held');await page.screenshot({path:`test-results/${width}-erasure-held.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Release this hold',exact:true}).last().click()]);await page.getByLabel('Trashed item').selectOption(f.id);await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Permanently erase selected item',exact:true}).click()]);await page.getByRole('heading',{name:'files · pending',exact:true}).last().waitFor();
  assert.equal((await h.raw(`/api/chest/items/${f.id}`,owner)).status,404);await page.screenshot({path:`test-results/${width}-erasure-pending-backup.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await ctx.close();
 }
 console.log('ERASE-001 browser passed at 1440/390: owner hold refusal, release, permanent erasure and pending private backup');
}finally{await browser?.close();await h.close()}
