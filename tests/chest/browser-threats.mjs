// SECURITY-002 in a browser at 1440 and 390: the owner connects and tests the scanner, the scoped security admin finds
// the quarantined test file with its reasons, releases it with a reason, and tunes their group's download rule.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {SCANNER,specimen,threatHarness,threatPeople,until} from './threats.mjs';
const cookies=(h,c)=>c.split('; ').map(v=>{const i=v.indexOf('=');return {name:v.slice(0,i),value:v.slice(i+1),url:h.origin}});
const go=async(page,button)=>{try{await Promise.all([page.waitForNavigation({timeout:15000}),page.getByRole('button',{name:button,exact:true}).click()])}catch(e){throw new Error(`${button}: ${e.message.split('\n')[0]} at ${page.url()}`)}};
let browser;
try{
 await mkdir('test-results',{recursive:true});browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const h=await threatHarness();
  try{
   const {people,space,contractors}=await threatPeople(h),viewport={width,height:900};h.scanner.up=true;
   const fit=async(page,name)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fits ${width}px`);await page.screenshot({path:`test-results/${width}-threats-${name}.png`,fullPage:true})};
   // The owner connects the scanner from the console and proves it with the standard test file.
   const asOwner=await browser.newContext({viewport,ignoreHTTPSErrors:true});await asOwner.addCookies(cookies(h,people.owner));const o=await asOwner.newPage();
   await o.goto(h.origin+'/app/files');await Promise.all([o.waitForNavigation(),o.getByRole('link',{name:/Content threats/}).click()]);assert.match(await o.locator('body').innerText(),/Not connected/);await fit(o,'not-connected');
   await o.getByLabel('Scanner address (https)').fill(SCANNER);await o.getByLabel('Scanner token').fill('synthetic-chest-1');await go(o,'Connect the scanner');
   assert.match(await o.locator('body').innerText(),/Connected · scanner\.example\.test · token …st-1/);await fit(o,'connected');
   await go(o,'Test with the standard test file');assert.match(await o.locator('h1, h2').allInnerTexts().then(t=>t.join(' ')),/The scanner works/);assert.match(await o.locator('body').innerText(),/detected the standard test file as Eicar-Test-Signature/);await fit(o,'scanner-test');
   // A contractor uploads the test file; the scanner quarantines it.
   const file=await h.api('/items',people.uma,{space:space.id,name:`Invoice ${width}.txt`,base64:specimen.toString('base64')}),version=(await h.api(`/items/${file.id}`,people.owner)).item.current;await h.scheduled();
   await until(async()=>(await h.api('/threats',people.sam)).quarantine.some(q=>q.state==='infected'),'the verdict arrives');
   // The scoped security admin: reasons, no file name without content access, and the release with its reason.
   const asSam=await browser.newContext({viewport,ignoreHTTPSErrors:true});await asSam.addCookies(cookies(h,people.sam));const s=await asSam.newPage();
   await s.goto(h.origin+'/app/threats');const quarantine=s.locator('section.card').filter({has:s.getByRole('heading',{name:'Quarantine',exact:true})});
   const text=await quarantine.innerText();assert.match(text,/Quarantined · Eicar-Test-Signature/);assert.match(text,/Restricted item/);assert.match(text,/uploaded by uma@example\.test/);assert.match(text,/ClamAV 1\.4\.3/);assert.doesNotMatch(text,new RegExp(`Invoice ${width}`));
   assert.match(await s.locator('section.card').filter({has:s.getByRole('heading',{name:'Alert history',exact:true})}).innerText(),/Malware · uma@example\.test/);await fit(s,'quarantine');
   assert.equal((await h.fetch(`/api/chest/items/${file.id}/bytes/${version}?download=true`,{headers:{cookie:people.owner}})).status,423);
   await s.getByLabel('Why is this a false positive?').fill('Security awareness training file.');await go(s,'Release to every door');
   const after=await quarantine.innerText();assert.match(after,/Released after review/);assert.match(after,/Released by sam@example\.test/);assert.match(after,/Security awareness training file\./);await fit(s,'released');
   assert.equal((await h.fetch(`/api/chest/items/${file.id}/bytes/${version}?download=true`,{headers:{cookie:people.owner}})).status,200);
   // Sam tunes only the Contractors group: 100 files with pause.
   assert.equal(await s.getByRole('button',{name:'Save organization rules',exact:true}).count(),0,'a group-scoped admin cannot change the organization rules');
   await s.getByLabel('Group',{exact:true}).selectOption(contractors.id);await s.getByLabel('Downloads: more than this many files').fill('100');await s.getByLabel('At the download threshold').selectOption('pause');await go(s,'Save group rule');
   assert.match(await s.locator('section.card').filter({has:s.getByRole('heading',{name:'Mass-activity rules',exact:true})}).innerText(),/Contractors · downloads above 100 files or 5 GB, pause/);await fit(s,'rules');
   await asSam.close();await asOwner.close();
  }finally{await h.close()}
 }
 console.log('SECURITY-002 scanner connection, quarantine reasons, scoped release and group rule browser journey at 1440 and 390 passed');
}finally{await browser?.close()}
