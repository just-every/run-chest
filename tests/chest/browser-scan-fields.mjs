import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {scanHarness,scanPeople,scannedItem,settledFields} from './scan-fields.mjs';
const h=await scanHarness();let browser;
try{
 await mkdir('test-results',{recursive:true});const {owner,viewer,space}=await scanPeople(h);
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await ctx.addCookies(owner.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const p=await ctx.newPage();
  let {item,folder}=await scannedItem(h,owner,space,{name:`Harbor NDA ${width}.png`,fields:{Term:3},required:true});await settledFields(h,item.id,owner);
  const snap=async(name)=>{await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.getByRole('region',{name:'Fields read from this scan'}).screenshot({path:`test-results/${width}-scan-panel-${name}.png`});await p.screenshot({path:`test-results/${width}-scan-fields-${name}.png`,fullPage:true})};
  await p.goto(h.origin+`/app/items/${folder.id}?manage`);await p.getByLabel('Read required fields after scan upload',{exact:false}).selectOption('true');await Promise.all([p.waitForNavigation(),p.getByRole('button',{name:'Require version review',exact:true}).click()]);await p.locator('section.card').filter({has:p.getByRole('heading',{name:'Version review',exact:true})}).screenshot({path:`test-results/${width}-scan-intake-settings.png`});assert.equal((await h.api(`/items/${folder.id}`,owner)).item.governance.scanIntake,true);
  await p.locator('[data-upload]').getByLabel('Term',{exact:false}).fill('3');await p.locator('input[data-pick]').first().setInputFiles({name:`New Harbor NDA ${width}.png`,mimeType:'image/png',buffer:await readFile('tests/chest/scan-nda.png')});await p.locator('[data-state=done]').waitFor();item=(await h.api(`/items/${folder.id}`,owner)).children.find(i=>i.name===`New Harbor NDA ${width}.png`);await settledFields(h,item.id,owner);
  await p.goto(h.origin+`/app/items/${item.id}`);const readings=p.getByRole('region',{name:'Fields read from this scan'});await readings.locator('.read-mark').first().waitFor();await snap('proposals');
  const party=readings.locator('.read-item').filter({has:p.locator('.read-field').filter({hasText:'Party'})});await party.getByRole('button',{name:'Accept',exact:true}).click();await p.getByText('Accepted by',{exact:false}).waitFor();
  const date=readings.locator('.read-item').filter({has:p.locator('.read-field').filter({hasText:'Effective date'})});await date.getByText('Correct',{exact:true}).click();await date.getByLabel('Correct value',{exact:false}).fill('2026-03-05');await date.getByRole('button',{name:'Save value',exact:true}).click();await p.getByText('Corrected to 2026-03-05',{exact:false}).waitFor();await snap('confirmed');
  const check=await h.api(`/items/${item.id}`,owner);assert.equal(check.metadata.filing.fields['Effective date'],'2026-03-05');
  // The same original's viewer can inspect the boxes but cannot decide a proposal.
  await ctx.clearCookies();await ctx.addCookies(viewer.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));await p.reload();assert.equal(await p.getByRole('button',{name:'Accept',exact:true}).count(),0);await snap('viewer');await ctx.close();
 }
 console.log('SEARCH-002 boxed folder scans, correction and read-only viewer at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
