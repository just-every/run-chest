// Personal ownership handoff through the built product; only mail is replaced at its network edge.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness(),cookies={};let browser;
const b64=s=>Buffer.from(s).toString('base64');
const go=(p,path)=>p.goto(h.origin+path);
const press=async(p,name)=>Promise.all([p.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()]);
const follow=async(p,link)=>Promise.all([p.waitForNavigation(),link.click()]);
async function fit(p,name,width){await p.evaluate(()=>scrollTo(0,0));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fits ${width}`);await p.screenshot({path:`test-results/${width}-ownership-${name}.png`,fullPage:true})}
try{
 await mkdir('test-results',{recursive:true});
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'})).status,303);cookies.owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:cookies.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const n of ['jordan','casey']){await h.api('/people',cookies.owner,{action:'invite',email:`${n}@example.test`,name:n==='jordan'?'Jordan Lee':'Casey Rivera'});cookies[n]=await h.signIn(`${n}@example.test`,true)}
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const pages={};for(const n of ['owner','jordan']){const c=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await c.addCookies(cookies[n].split('; ').map(v=>{const at=v.indexOf('=');return {name:v.slice(0,at),value:v.slice(at+1),url:h.origin}}));pages[n]=await c.newPage()}
  const a=pages.owner,b=pages.jordan,space=(await h.api('/files',cookies.owner)).personal;
  const folder=await h.api('/items',cookies.owner,{space,type:'folder',name:`Harbor Freight — handover ${width}`});
  const file=await h.api('/items',cookies.owner,{parent:folder.id,type:'file',name:'Operations handover.txt',base64:b64('Supplier contacts and Q4 delivery schedule')});
  await go(a,`/app/items/${folder.id}?manage`);await a.getByText('Transfer ownership',{exact:true}).click();await a.getByLabel('New owner').selectOption('jordan@example.test');await fit(a,'offer',width);await press(a,'Send ownership request');await fit(a,'sent',width);
  assert.equal((await h.api(`/items/${file.id}`,cookies.owner)).role,'owner');
  await go(b,'/app/notices');await fit(b,'notice',width);await follow(b,b.locator('li').filter({hasText:folder.payload.name}).getByRole('link',{name:'Open request'}));assert.ok(b.url().includes('/app/ownership/'));await go(b,'/app/ownership');await fit(b,'inbox',width);await follow(b,b.getByRole('link',{name:folder.payload.name,exact:true}));await fit(b,'decision',width);await press(b,'Accept ownership');await fit(b,'accepted',width);await follow(b,b.getByRole('link',{name:'Open transferred item',exact:true}));assert.equal((await h.api(`/items/${file.id}`,cookies.jordan)).role,'owner');await fit(b,'received-folder',width);
  await go(a,`/app/items/${file.id}`);assert.equal((await h.api(`/items/${file.id}`,cookies.owner)).role,'editor');await fit(a,'sender-editor',width);
  const single=await h.api('/items',cookies.owner,{space,type:'file',name:`Declined transfer ${width}.txt`,base64:b64('Keep the original owner')});const offer=await h.api(`/items/${single.id}/ownership`,cookies.owner,{recipient:'jordan@example.test'});
  await go(b,`/app/ownership/${offer.id}`);await press(b,'Decline ownership');await fit(b,'declined',width);assert.equal((await h.api(`/items/${single.id}`,cookies.owner)).role,'owner');
  const pending=await h.api(`/items/${single.id}/ownership`,cookies.owner,{recipient:'jordan@example.test'});await go(a,`/app/ownership/${pending.id}`);await press(a,'Cancel request');await fit(a,'cancelled',width);
  for(const p of Object.values(pages))await p.context().close();
 }
 console.log('SPACE-001 ownership browser at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
