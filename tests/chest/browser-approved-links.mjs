import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const press=async(p,name)=>{const page=p.page?p.page():p;await Promise.all([page.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()])};
const fit=async(p,name,width,locator)=>{await p.waitForLoadState('load');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await(locator??p).screenshot({path:`test-results/${width}-approved-${name}.png`,...(locator?{}:{fullPage:true,...(name==='created'?{mask:[p.locator('pre.receipt')]}:{})})})};
try {
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const p=await context.newPage(),guest=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true}),g=await guest.newPage(),go=(page,path)=>page.goto(h.origin+path);
  const space=await h.api('/spaces',owner,{name:'Harbor Operations'}),folder=await h.api('/items',owner,{space:space.id,type:'folder',name:'Signed supplier agreements'});await h.api(`/items/${folder.id}/governance`,owner,{reviewer:h.vars.OWNER_EMAIL});
  const original='Harbor Freight supplier agreement. Payment due within thirty days after delivery.',draft='DRAFT: Payment due within sixty days. Awaiting legal approval.',name=`Harbor payment terms ${width}.txt`,item=await h.api('/items',owner,{parent:folder.id,name,base64:Buffer.from(original).toString('base64')}),a=item.payload.current;
  await h.api(`/items/${item.id}/versions/${a}/review`,owner,{action:'approve'});await go(p,`/app/items/${item.id}`);const form=p.locator('form').filter({has:p.getByRole('button',{name:'Create link',exact:true})});await form.getByLabel('Audience').selectOption('public');await form.getByLabel('Version for links for anyone').selectOption('approved');await fit(p,'form',width,p.locator('.side-card').filter({has:p.getByRole('heading',{name:'Create link',exact:true})}));await press(form,'Create link');await fit(p,'created',width);const path=new URL((await p.locator('pre.receipt').innerText()).trim()).pathname;
  await go(g,path);await fit(g,'landing-a',width);await g.getByRole('link',{name:'Preview',exact:true}).click();assert.equal(await g.locator('pre.receipt').innerText(),original);await fit(g,'preview-a',width);
  const b=(await h.api(`/items/${item.id}/versions`,owner,{base64:Buffer.from(draft).toString('base64')})).payload.versions.at(-1).id;await go(g,path);const [download]=await Promise.all([g.waitForEvent('download'),g.getByRole('link',{name:'Download',exact:true}).click()]);assert.equal((await readFile(await download.path())).toString(),original);await g.getByRole('link',{name:'Preview',exact:true}).click();assert.equal(await g.locator('pre.receipt').innerText(),original);await fit(g,'pending-stays-a',width);
  await h.api(`/items/${item.id}/versions/${b}/review`,owner,{action:'approve'});await go(g,path);await g.getByRole('link',{name:'Preview',exact:true}).click();assert.equal(await g.locator('pre.receipt').innerText(),draft);await fit(g,'approved-b',width);
  await go(p,'/app/links');const row=p.locator('li').filter({hasText:name}).filter({hasText:/approved versions only/i}).filter({has:p.getByRole('button',{name:'Revoke',exact:true})});assert.equal(await row.count(),1);await fit(p,'list',width);await press(row,'Revoke');assert.equal((await go(g,path)).status(),410);await fit(g,'revoked',width);await context.close();await guest.close();
 }
 console.log('SHARE-001 approved-only links at 1440 and 390 passed');
} finally {await browser?.close();await h.close()}
