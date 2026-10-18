import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {pdf} from './fixtures.mjs';
const h=await harness(),b64=x=>Buffer.from(x).toString('base64');let browser;
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=await h.api('/spaces',cookie,{name:'Harbor operations'}),folder=await h.api('/items',cookie,{space:space.id,type:'folder',name:'Supplier agreements'});
 await h.api('/items',cookie,{parent:folder.id,name:'Acme agreement.txt',base64:b64(pdf())});const file=await h.api('/items',cookie,{parent:folder.id,name:'Harbor delivery notes.md',base64:b64('Cobalt lantern delivery instructions: report to the harbor office.')});await h.api(`/items/${file.id}/versions`,cookie,{base64:b64('Delivery instructions were updated after the safety review.')});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const p=await context.newPage();
  const snap=async(name)=>{await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`test-results/${width}-search-${name}.png`,fullPage:true})};
  await p.goto(h.origin+'/app/files/search');await p.locator('select[name=modified]').selectOption('lastYear');await p.getByRole('button',{name:'Apply filters',exact:true}).click();assert.equal(await p.getByRole('heading',{name:'Acme agreement.txt',exact:true}).count(),0);await p.locator('select[name=modified]').selectOption('today');await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('heading',{name:'Acme agreement.txt',exact:true}).waitFor();await p.locator('select[name=modified]').selectOption('');await p.getByLabel('PDFs',{exact:true}).check();await p.getByLabel('Location',{exact:false}).selectOption(folder.id);await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('heading',{name:'Acme agreement.txt',exact:true}).waitFor();assert.equal(await p.getByRole('heading',{name:'Harbor delivery notes.md',exact:true}).count(),0);await snap('combined');
  await p.getByLabel('PDFs',{exact:true}).uncheck();await p.getByRole('searchbox').fill('Cobalt lantern');await p.getByLabel('Version',{exact:false}).selectOption('any');await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('heading',{name:'Harbor delivery notes.md',exact:true}).waitFor();await p.getByText('Earlier version 1',{exact:false}).waitFor();await snap('earlier-version');
  await context.close();
 }
 console.log('SEARCH-001 browser filters and earlier versions at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
