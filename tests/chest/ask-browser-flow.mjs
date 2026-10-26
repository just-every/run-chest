import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {askHarness,askSetup} from './ask-flow.mjs';
import {tooltips} from './tooltip-proof.mjs';
export async function askBrowserFlow(){
 const h=await askHarness();let browser;
 try{
  const {owner,viewer,folder,pdfFile,record}=await askSetup(h);await mkdir('test-results',{recursive:true});
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
  for(const width of [1440,390]){
   const ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true}),p=await ctx.newPage();
   const login=async cookie=>{await ctx.clearCookies();await ctx.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}))};
   const shot=async label=>{await tooltips(p,width,'ask-'+label);await p.locator('[data-ask]').scrollIntoViewIfNeeded().catch(()=>{});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Ask has no horizontal overflow');await p.screenshot({path:`test-results/${width}-ask-${label}.png`,fullPage:true})};
   await login(owner);await p.goto(h.origin+'/app/admin#ask-policy');await expect(p.getByRole('heading',{name:'Ask data policy',exact:true})).toBeVisible();await shot('policy');await p.locator('#ask-policy').screenshot({path:`test-results/${width}-ask-policy-card.png`});
   await login(viewer);await p.goto(h.origin+`/app/items/${folder.id}`);await p.locator('[data-ask] > summary').click();await expect(p.locator('[data-ask-policy]')).toContainText('Provider terms');await p.getByLabel('Include retained versions',{exact:true}).check();await p.getByLabel('Approve sending this question',{exact:false}).check();
   await p.getByRole('button',{name:'Ask with approval',exact:true}).click();await expect(p.getByRole('heading',{name:'Evidence answer',exact:true})).toBeVisible();await expect(p.locator('[data-ask-result]')).toContainText('2026-04-09');await expect(p.locator('[data-ask-result]')).toContainText('No access to original text');await expect(p.locator('[data-ask-result]')).toContainText('Unreadable');await shot('folder');
   h.askMode('failure');await p.getByRole('button',{name:'Ask with approval',exact:true}).click();await expect(p.getByRole('heading',{name:'No answer accepted',exact:true})).toBeVisible();await expect(p.locator('[data-ask-result]')).toContainText('unknown');await shot('failure');h.askMode('answer');
   await p.goto(h.origin+`/app/items/${pdfFile.id}`);await p.locator('[data-ask] > summary').click();await expect(p.locator('[data-ask-policy]')).toContainText('Provider terms');await p.getByLabel('Approve sending this question',{exact:false}).check();await p.getByRole('button',{name:'Ask with approval',exact:true}).click();await expect(p.getByRole('heading',{name:'Evidence answer',exact:true})).toBeVisible();const citation=p.locator('[data-ask-result] a').first();assert.ok((await citation.getAttribute('href')).includes(`/bytes/${pdfFile.payload.current}`));await expect(citation).toContainText('page 1');const original=await h.raw((await citation.getAttribute('href')).split('#')[0],viewer);assert.equal(original.status,200);assert.ok(Buffer.from(await original.arrayBuffer()).equals(Buffer.from((await import('./fixtures.mjs')).pdf())));await shot('pdf');
   await p.goto(h.origin+`/app/documents/${record.id}`);await p.locator('[data-ask] > summary').click();await expect(p.locator('[data-ask-policy]')).toContainText('Provider terms');await p.getByLabel('Approve sending this question',{exact:false}).check();await p.getByRole('button',{name:'Ask with approval',exact:true}).click();await expect(p.getByRole('heading',{name:'Evidence answer',exact:true})).toBeVisible();assert.ok((await p.locator('[data-ask-result] a').first().getAttribute('href')).includes(`/documents/${record.id}/bytes/`));await shot('record');
   await ctx.close();
  }
  console.log('AGENT-007 browser Ask policy, folder summary, skipped reasons, provider failure, exact PDF citation and tooltips at 1440 and 390 passed');
 }finally{await browser?.close();await h.close()}
}
