// SECURITY-003 browser/server protection slice. Network-edge mail only; real Worker custody, sessions and ACLs.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness(),b64=b=>Buffer.from(b).toString('base64'),sha=b=>createHash('sha256').update(b).digest('hex');let browser;
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 await h.api('/people',owner,{action:'invite',email:'ana@example.test',name:'Ana'});const ana=await h.signIn('ana@example.test',true),other=await h.signIn('ana@example.test');
 await h.api('/people',owner,{action:'invite',email:'ben@example.test',name:'Ben'});const ben=await h.signIn('ben@example.test',true);
 const space=(await h.api('/files',ana)).personal,original=Buffer.from('Quarterly supplier terms. '.repeat(400)),suspect=randomBytes(8192);
 const add=async(name,cookie=ana)=>h.api('/items',cookie,{space,type:'file',name,base64:b64(original)});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
 for(const width of [1440,390]){
  // Separate real sessions are separate upload sources. Neither a held candidate nor its hash is a download capability.
  const currentCookie=await h.signIn('ana@example.test'),file=await add(`Vendor terms ${width}.txt`,currentCookie),ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
  await ctx.addCookies(currentCookie.split('; ').map(x=>{const i=x.indexOf('=');return{name:x.slice(0,i),value:x.slice(i+1),url:h.origin}}));const page=await ctx.newPage();
  const before=file.payload.current,fail=await h.raw(`/api/chest/items/${file.id}/versions`,currentCookie,{base64:b64(suspect)});assert.equal(fail.status,423);
  assert.equal((await h.api(`/items/${file.id}`,currentCookie)).item.current,before);
  const incident=(await h.api('/upload-protection',currentCookie)).find(i=>i.changes.some(c=>c.item===file.id));assert.ok(incident.paused);assert.equal(incident.changes[0].checksum,sha(suspect));
  assert.equal((await h.raw(`/api/chest/upload-protection/${incident.id}`,ben)).status,403);
  assert.equal((await h.raw(`/api/chest/items/${file.id}/bytes/${before}?download=true`,currentCookie)).status,423);
  assert.equal((await h.raw(`/api/chest/items/${file.id}/bytes/${incident.changes[0].id}?download=true`,other)).status,404);
  assert.ok(h.mails.some(m=>m.subject==='Chest paused suspect uploads'&&[m.to].flat().includes('ana@example.test')));
  // Restart retains the held bytes and pause. A different session can make a legitimate replacement.
  await h.stop();await h.start();
  const legitimate=Buffer.from('Approved supplier terms. '.repeat(400));await h.api(`/items/${file.id}/versions`,other,{base64:b64(legitimate)});
  await page.goto(h.origin+'/app/upload-protection');await page.getByRole('heading',{name:'Upload protection',exact:true}).waitFor();
  const panel=page.locator('section.card').filter({has:page.getByRole('link',{name:`Vendor terms ${width}.txt`,exact:true})});
  await page.screenshot({path:`test-results/${width}-upload-protection-held.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await Promise.all([page.waitForNavigation(),panel.getByRole('button',{name:'Release held replacements'}).click()]);
  await page.getByText('A later version is current.',{exact:false}).last().waitFor();assert.equal((await h.api(`/items/${file.id}`,other)).versions[0].checksum,sha(legitimate));
  const resolved=page.locator('section.card').filter({has:page.getByRole('link',{name:`Vendor terms ${width}.txt`,exact:true})});await Promise.all([page.waitForNavigation(),resolved.getByRole('button',{name:'Resume this upload source'}).click()]);
  await h.api(`/items/${file.id}/versions`,currentCookie,{base64:b64(legitimate)});
  await page.screenshot({path:`test-results/${width}-upload-protection-resumed.png`,fullPage:true});await ctx.close();
 }
 // A reviewable false positive can be released once, then resumed; repeated decision never adds a duplicate version.
 const f=await add('Working notes.txt'),before=f.payload.current;await h.api(`/items/${f.id}/versions`,ana,{base64:b64(suspect)},423);
 let incident=(await h.api('/upload-protection',ana)).find(i=>i.changes.some(c=>c.item===f.id));
 await h.api(`/upload-protection/${incident.id}`,ana,{action:'release'});await h.api(`/upload-protection/${incident.id}`,ana,{action:'release'});
 assert.equal((await h.api(`/items/${f.id}`,other)).versions.length,2);await h.api(`/upload-protection/${incident.id}`,ana,{action:'resume'});
 // A credentialed device is independently paused before a signature-losing replacement reaches current.
 const pdf=await h.api('/items',other,{space,type:'file',name:'Agreement.pdf',base64:b64('%PDF-1.7\nplain business terms')}),token=(await h.api('/devices',other,{name:'Office companion',platform:'macos'})).token;
 const response=await h.fetch(`/api/chest/sync/items/${pdf.id}/content`,{method:'PUT',headers:{authorization:`Bearer ${token}`,'if-match':pdf.payload.current},body:suspect});assert.equal(response.status,423);
 assert.equal((await h.api(`/items/${pdf.id}`,other)).item.current,pdf.payload.current);
 const deviceIncident=(await h.api('/upload-protection',other)).find(i=>i.device);assert.ok(deviceIncident);
 await h.api(`/upload-protection/${deviceIncident.id}`,other,{action:'keep'});await h.api(`/upload-protection/${deviceIncident.id}`,other,{action:'resume'});
 console.log('SECURITY-003 browser/server slice passed: held custody, restart, session/device isolation, conflicts, release and resume at 1440/390');
}finally{await browser?.close();await h.close()}
