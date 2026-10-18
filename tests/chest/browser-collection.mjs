import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const press=async(form,name)=>{await Promise.all([form.page().waitForNavigation(),form.getByRole('button',{name,exact:true}).click()])};
const browserCookies=(cookie,origin)=>cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:origin}});
try {
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});
 const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const email='recipient@example.test';await h.api('/people',owner,{action:'invite',email,name:'Dana Recipient'});const recipient=await h.signIn(email,true);
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]) {
  const space=await h.api('/spaces',owner,{name:`Vendor collection ${width}`}),members=[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:email,role:'viewer'}];await h.api(`/spaces/${space.id}/members`,owner,{members});
  const folder=await h.api('/items',owner,{space:space.id,type:'folder',name:`Acme ${width}`});await h.api(`/items/${folder.id}/governance`,owner,{reviewer:h.vars.OWNER_EMAIL});
  const request=await h.api(`/items/${folder.id}/file-requests`,owner,{title:`Vendor records ${width}`,checklist:['Signed agreement','Tax record'],allowReplacement:true}),path=new URL(request.url).pathname,visit=await h.fetch(path),visitor=visit.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  async function upload(checklist,name,content,replace='') {const form=new FormData();form.set('name','Acme');form.set('email','vendor@example.test');form.set('checklist',checklist);form.set('replace',replace);form.set('files',new File([content],name,{type:'text/plain'}));const response=await h.fetch(path,{method:'POST',headers:{origin:h.origin,cookie:visitor},body:form});assert.equal(response.status,200,await response.clone().text());return (await h.api(`/items/${folder.id}`,owner)).fileRequests.find(r=>r.id===request.request.id).submissions.find(s=>s.checklist===checklist&&s.status==='accepted')}
  const stale=await upload('Signed agreement','Agreement.txt','Agreement with stale date');await upload('Tax record','Tax.txt','Current tax record');
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(browserCookies(owner,h.origin));const p=await context.newPage();
  const fit=async(name,page=p)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${name} fits viewport`);await page.screenshot({path:`test-results/${width}-collection-${name}.png`,fullPage:true})};
  await p.goto(h.origin+'/app/collection');
  const creation=p.locator('form').filter({has:p.getByRole('button',{name:'Create collection checklist',exact:true})});await creation.getByLabel('Checklist title',{exact:true}).fill(`Acme acceptance ${width}`);
  await creation.getByLabel('First requested record').selectOption({label:`Vendor records ${width} · Signed agreement`});await creation.getByLabel('Second requested record').selectOption({label:`Vendor records ${width} · Tax record`});await creation.getByLabel('Approved recipient emails').fill(email);await creation.getByLabel('Reminder authorization').selectOption('true');await fit('create');await press(creation,'Create collection checklist');
  let c=(await h.api('/collection',owner)).checklists.find(c=>c.title===`Acme acceptance ${width}`);assert.ok(c);const endpoint=`/collection/${c.id}`;
  await p.goto(h.origin+`/app/collection?checklist=${c.id}`);
  const bind=async(label,version)=>{c=await h.api(endpoint,owner);const e=c.evidence.find(e=>e.requirement.label===label),candidate=version?e.candidates.find(v=>v.version===version):e.candidates[0];const block=p.locator('ol.events > li').filter({has:p.getByRole('heading',{name:label,exact:true})}),f=block.locator('form').filter({has:p.getByRole('button',{name:'Use this exact submission',exact:true})});await f.getByLabel('Submitted material').selectOption(JSON.stringify({item:candidate.item,version:candidate.version,submission:candidate.submission}));await press(f,'Use this exact submission');await p.goto(h.origin+`/app/collection?checklist=${c.id}`);return candidate};
  const agreement=await bind('Signed agreement'),tax=await bind('Tax record');await h.api(`/items/${agreement.item}/versions/${agreement.version}/review`,owner,{action:'changes',message:'Please supply the currently signed version.'});await h.api(`/items/${tax.item}/versions/${tax.version}/review`,owner,{action:'approve'});await p.reload();await fit('stale');
  const replacement=await upload('Signed agreement','Replacement.txt','Current signed agreement',stale.id);const next=(await h.api(endpoint,owner)).evidence.find(e=>e.requirement.label==='Signed agreement').candidates.find(c=>c.submission===replacement.id).version;await p.reload();await bind('Signed agreement',next);assert.equal((await h.api(endpoint,owner)).evidence.find(e=>e.requirement.label==='Signed agreement').state,'mismatch');await h.api(`/items/${agreement.item}/versions/${next}/review`,owner,{action:'approve'});
  const recipientContext=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await recipientContext.addCookies(browserCookies(recipient,h.origin));const r=await recipientContext.newPage();await r.goto(h.origin+`/app/collection?checklist=${c.id}`);await fit('recipient-review',r);
  assert.equal(await r.getByRole('button',{name:'I confirm this exact version',exact:true}).count(),2);
  const download=r.waitForEvent('download');await r.getByRole('link',{name:'Download this exact version',exact:true}).first().click();await(await download).path();assert.equal((await h.api(endpoint,owner)).state,'open','downloading the cited original still requires explicit confirmation');
  for(let i=0;i<2;i++){const f=r.locator('form').filter({has:r.getByRole('button',{name:'I confirm this exact version',exact:true})}).first();await press(f,'I confirm this exact version');await r.goto(h.origin+`/app/collection?checklist=${c.id}`)}
  assert.equal((await h.api(endpoint,owner)).state,'accepted');await fit('accepted',r);const count=h.mails.filter(m=>m.text.includes(`/app/collection?checklist=${c.id}`)).length;await h.api(endpoint+'/remind',owner,{});assert.equal(h.mails.filter(m=>m.text.includes(`/app/collection?checklist=${c.id}`)).length,count);
  await h.api(`/spaces/${space.id}/members`,owner,{members:[members[0]]});await p.reload();assert.equal((await h.api(endpoint,owner)).state,'open');await fit('revoked');await r.reload();assert.equal((await r.getByRole('button',{name:'I confirm this exact version',exact:true}).count()),0);
  await h.api(`/spaces/${space.id}/members`,owner,{members});await p.reload();assert.equal((await h.api(endpoint,owner)).state,'open','restoration never revives an invalidated human confirmation');await fit('redelivery-proposal');
  await recipientContext.close();await context.close();
 }
 console.log('AGENT-004 browser collection create, stale/correct exact binding, approval, recipient confirmation, reminder stop and revoke reopening at 1440/390 passed');
} finally {await browser?.close();await h.close()}
