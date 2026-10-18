import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=await h.api('/spaces',cookie,{name:'Harbor Freight operations'}),file=await h.api('/items',cookie,{space:space.id,type:'file',name:'November delivery plan.txt',base64:Buffer.from('Confirm delivery dates with Acme Supply before Friday.').toString('base64')});
 await h.api(`/items/${file.id}/rename`,cookie,{name:'November delivery plan — approved dates.txt'});
 await h.api(`/items/${file.id}/comments`,cookie,{message:'The loading dock is reserved for the 12 November delivery.'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
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
 console.log('AUDIT-001 browser at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
