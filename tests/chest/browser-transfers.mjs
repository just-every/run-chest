// SHARE-003 browser public doors with stored data and provider mail edge only.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
async function shot(p,width,state){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${state} fits ${width}`);await p.screenshot({path:`test-results/${width}-delivery-${state}.png`,fullPage:true,mask:[p.locator('pre.receipt')]})}
const press=(p,name)=>Promise.all([p.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()]);
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=(await h.api('/files',cookie)).personal;
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const owner=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true,acceptDownloads:true});await owner.addCookies(cookie.split('; ').map(v=>{const at=v.indexOf('=');return {name:v.slice(0,at),value:v.slice(at+1),url:h.origin}}));const p=await owner.newPage(),guest=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true,acceptDownloads:true}),g=await guest.newPage();
  const file=await h.api('/items',cookie,{space,name:`Harbor Freight delivery ${width}.txt`,base64:Buffer.from('Approved procurement handover\nSupplier: Acme Supply\nPayment terms: Net 30').toString('base64')});
  await p.goto(h.origin+'/app/items/'+file.id);await p.getByLabel('Package title',{exact:true}).fill('Harbor Freight — approved handover');await p.getByLabel('Download sessions allowed').fill('2');await p.getByLabel('Ask recipients to confirm receipt').selectOption('true');await shot(p,width,'create');await press(p,'Create delivery package');await shot(p,width,'created');
  const url=await p.locator('pre.receipt').innerText();assert.ok(url.startsWith(h.origin+'/l/'));await g.goto(url);await shot(g,width,'recipient');await press(g,'Start download session');await shot(g,width,'session');
  const download=g.waitForEvent('download');await g.getByRole('link',{name:`Download Harbor Freight delivery ${width}.txt`,exact:true}).click();await(await download).path();await g.reload();await g.getByLabel('I received the exact file versions in this package').check();await press(g,'Confirm receipt');await shot(g,width,'confirmed');
  await p.getByRole('link',{name:'Return',exact:true}).click();await shot(p,width,'evidence');assert.ok(await p.getByText('Complete file bytes served',{exact:true}).isVisible());assert.ok(await p.getByText('Recipient explicitly confirmed',{exact:true}).isVisible());await press(p,'Revoke package');await shot(p,width,'revoked');assert.equal((await g.goto(url)).status(),410);await shot(g,width,'recipient-revoked');await p.goto(h.origin+'/app/transfers');await shot(p,width,'list');
  await owner.close();await guest.close();
 }
 console.log('SHARE-003 product browser creation, download, receipt, evidence and revocation at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
