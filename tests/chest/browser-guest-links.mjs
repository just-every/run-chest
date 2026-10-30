import {tooltips} from './tooltip-proof.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const press=async(p,name)=>{const page=p.page?p.page():p;await Promise.all([page.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()])};
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const owner=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await owner.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const p=await owner.newPage(),guest=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true}),g=await guest.newPage();
  const file=await h.api('/items',cookie,{space:(await h.api('/files',cookie)).personal,name:`Acme delivery terms ${width}.txt`,base64:Buffer.from('Acme Supply payment terms: thirty days after delivery.').toString('base64')});
  const fit=async(page,name)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-guest-links-${name}.png`,fullPage:true})};
  for(const audience of ['guests','domain']){
   const opened=await p.goto(h.origin+`/app/items/${file.id}`);await p.screenshot({path:`test-results/${width}-guest-links-start.png`,fullPage:true});assert.equal(opened.status(),200,await p.locator('body').innerText());const form=p.locator('form').filter({has:p.getByRole('button',{name:'Create link',exact:true})});await form.getByLabel('Audience').selectOption(audience);await form.getByLabel('Invited guest emails').fill('vendor@acme.test');await form.getByLabel('Allowed email domain').fill('acme.test');await fit(p,'create-'+audience);await press(form,'Create link');const path=new URL((await p.locator('.flash input').inputValue()).trim()).pathname;await p.goto(h.origin+'/app/links');await tooltips(p,width,'guest-management-'+audience);await fit(p,'management-'+audience);
   await g.goto(h.origin+path);await fit(g,'verify-'+audience);await g.getByLabel('Email',{exact:true}).fill('vendor@other.test');await press(g,'Email a PIN');assert.equal(h.mails.at(-1).to[0]=== 'vendor@other.test',false);
   await g.getByLabel('Email',{exact:true}).fill('vendor@acme.test');await press(g,'Email a PIN');await fit(g,'sent-'+audience);const url=new URL(h.mails.at(-1).text.match(/https?:\/\/[^\s]+/)[0]);await g.goto(url.href);await fit(g,'confirm-'+audience);await press(g,'Confirm email');await fit(g,'opened-'+audience);await Promise.all([g.waitForNavigation(),g.getByRole('link',{name:'Preview',exact:true}).click()]);assert.match(await g.locator('pre').innerText(),/thirty days/);await fit(g,'preview-'+audience);
   const links=(await h.api(`/items/${file.id}`,cookie)).publicLinks,link=links.find(l=>l.audience===audience&&l.state==='active');await p.goto(h.origin+`/app/items/${file.id}`);const revoke=p.locator('li').filter({hasText:audience==='guests'?'Named guests':'Verified domain'}).filter({has:p.getByRole('button',{name:'Revoke',exact:true})});await press(revoke,'Revoke');assert.equal((await g.reload()).status(),410);await fit(g,'revoked-'+audience);
  }
  await guest.close();await owner.close();
 }
 console.log('SHARE-001 verified external audience browser at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}

await (await import('./guest-editing-flow.mjs')).guestEditingFlow({browserProof:true});
