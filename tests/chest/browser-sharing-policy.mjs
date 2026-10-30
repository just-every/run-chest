// POLICY-001: live named/guest policy, explicit recipient confirmation and scoped administration through public doors.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const rules={allowPublic:true,allowOrganisation:true,allowDiscovery:true,defaultAudience:'organisation',defaultRole:'viewer',allowExternal:true,allowNonMembers:true,allowEditors:true,warnExternal:false,trustedDomains:null,organizationDomains:['example.test']};
const press=async(page,button)=>Promise.all([page.waitForNavigation(),button.click()]);
async function shot(page,width,name){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page fits '+width);await page.screenshot({path:`test-results/${width}-sharing-policy-${name}.png`,fullPage:true})}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const sessions={};for(const email of ['dana@example.test','luis@partner.test','sam@untrusted.test']){await h.api('/people',owner,{action:'invite',email,name:email.split('@')[0]});sessions[email]=await h.signIn(email,true)}
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?['--no-sandbox']:[])]});
 for(const width of [1440,390]){
  await h.api('/link-policy',owner,{scope:'organisation',...rules});const area=(await h.api('/files',owner)).personal,file=await h.api('/items',owner,{space:area,type:'file',name:`Harbor supplier terms ${width}.txt`,base64:Buffer.from('Contract renewal is due on November 30.').toString('base64')});
  const anonymous=await h.api(`/items/${file.id}/public-links`,owner,{}),oldGuest=await h.api(`/items/${file.id}/links`,owner,{audience:'guests',guests:['sam@untrusted.test']});
  await h.api(`/items/${file.id}/shares`,owner,{principal:'sam@untrusted.test',role:'viewer'});
  await h.api('/link-policy',owner,{scope:'organisation',...rules,allowPublic:false,trustedDomains:['partner.test'],warnExternal:true});
  const refused=await h.raw('/api/chest'+`/items/${file.id}/links`,owner,{audience:'guests',guests:['sam@untrusted.test']});assert.equal(refused.status,403);assert.equal((await refused.json()).error,'sharing_policy_domain_not_trusted');
  for(const link of [anonymous,oldGuest])for(const path of ['',`/p/${file.id}`,`/f/${file.id}`])assert.equal((await h.fetch(new URL(link.url).pathname+path)).status,410);
  await h.api(`/items/${file.id}`,sessions['sam@untrusted.test'],undefined,403);assert.equal((await h.api('/search?q=Harbor',sessions['sam@untrusted.test'])).count,0);
  await h.api(`/items/${file.id}/links`,owner,{audience:'guests',guests:['luis@partner.test']},409);const trusted=await h.api(`/items/${file.id}/links`,owner,{audience:'guests',guests:['luis@partner.test'],confirmExternal:true});assert.equal((await h.fetch(new URL(trusted.url).pathname)).status,200);
  const context=await browser.newContext({viewport:{width,height:960},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const at=s.indexOf('=');return {name:s.slice(0,at),value:s.slice(at+1),url:h.origin}}));const page=await context.newPage();
  await page.goto(h.origin+'/app/items/'+file.id);const share=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Share',exact:true})});await share.getByLabel('Person or group').selectOption('luis@partner.test');await share.locator('select[name=role]').selectOption('commenter');await share.getByLabel('Message (optional)').fill('Please review the renewal date.');await press(page,share.getByRole('button',{name:'Share',exact:true}));await page.getByRole('heading',{name:'Confirm external sharing',exact:true}).waitFor();assert.ok(await page.getByText('luis@partner.test',{exact:true}).count());await h.api(`/items/${file.id}`,sessions['luis@partner.test'],undefined,403);await shot(page,width,'confirm-recipient');
  await press(page,page.getByRole('button',{name:'Confirm external sharing',exact:true}));assert.equal((await h.api(`/items/${file.id}`,sessions['luis@partner.test'])).role,'commenter');assert.ok(h.mails.some(m=>[m.to].flat().includes('luis@partner.test')&&m.text.includes('Please review the renewal date.')));
  await page.goto(h.origin+'/app/links');await page.locator('#link-policy summary').click();await page.getByRole('heading',{name:'Suspended by sharing policy',exact:true}).waitFor();await shot(page,width,'suspended');assert.ok((await h.api('/link-policy',owner)).suspended.some(r=>r.principal==='sam@untrusted.test'));
  await h.api('/link-policy',owner,{scope:'organisation',...rules});assert.equal((await h.api(`/items/${file.id}`,sessions['sam@untrusted.test'])).role,'viewer');assert.equal((await h.fetch(new URL(oldGuest.url).pathname)).status,200);
  await h.api('/link-policy',owner,{scope:'organisation',...rules,allowExternal:false});await page.reload();await page.locator('#link-policy summary').click();const blocked=page.locator('#link-policy li').filter({hasText:'sam@untrusted.test'}).filter({has:page.getByRole('button',{name:'Remove suspended grant',exact:true})});await press(page,blocked.getByRole('button',{name:'Remove suspended grant',exact:true}));await shot(page,width,'removed-grant');await h.api('/link-policy',owner,{scope:'organisation',...rules});await h.api(`/items/${file.id}`,sessions['sam@untrusted.test'],undefined,403);
  // A group cannot relax a space restriction. Tightening also suspends an existing organization link for outsiders.
  const space=await h.api('/spaces',owner,{name:`Harbor operations ${width}`}),team=await h.api('/items',owner,{space:space.id,type:'file',name:'Internal dispatch.txt',base64:Buffer.from('Dispatch plan').toString('base64')});await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'dana@example.test',role:'content_manager'}]});
  const link=await h.api(`/items/${team.id}/links`,owner,{audience:'organisation'});await h.api('/links/open',sessions['luis@partner.test'],{token:link.url.split('/s/')[1]});await h.api('/link-policy',owner,{scope:`space:${space.id}`,...Object.fromEntries(Object.entries(rules).filter(([k])=>k!=='organizationDomains')),allowNonMembers:false,allowEditors:false});await h.api(`/items/${team.id}`,sessions['luis@partner.test'],undefined,403);await h.api(`/items/${team.id}/shares`,owner,{principal:'luis@partner.test',role:'viewer'},403);await h.api(`/items/${team.id}/shares`,sessions['dana@example.test'],{principal:h.vars.OWNER_EMAIL,role:'viewer'},403);
  await context.close();
 }
 // An authorized content manager submits the real Share form to an internal colleague outside this space.
 const actorEmail=['dana','example.test'].join('@'),colleague=['synthetic-chest-colleague','example.test'].join('@'),teammate=['synthetic-chest-teammate','example.test'].join('@');
 for(const [email,name] of [[colleague,'Colleague'],[teammate,'Teammate']]){await h.api('/people',owner,{action:'invite',email,name});sessions[email]=await h.signIn(email,true)}
 await h.api('/link-policy',owner,{scope:'organisation',...rules});
 const space=await h.api('/spaces',owner,{name:'Member-only dispatch'});
 await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:actorEmail,role:'content_manager'},{principal:teammate,role:'viewer'}]});
 const team=await h.api('/items',sessions[actorEmail],{space:space.id,name:'synthetic-chest-policy.txt',base64:Buffer.from('synthetic-chest-first-original').toString('base64')});
 await h.api(`/items/${team.id}/versions`,sessions[actorEmail],{filename:'synthetic-chest-policy.txt',base64:Buffer.from('synthetic-chest-second-original').toString('base64')});
 await h.api('/link-policy',owner,{scope:`space:${space.id}`,...Object.fromEntries(Object.entries(rules).filter(([key])=>key!=='organizationDomains')),allowNonMembers:false});
 const actor=sessions[actorEmail],before=await h.api(`/items/${team.id}`,actor);assert.equal(before.can.share,true,'the member is authorized to share');
 const shareAudits=async()=>(await h.api('/audit',owner)).filter(row=>row.action==='share.grant'&&row.object_id===team.id);
 const recipientMails=email=>h.mails.filter(mail=>[mail.to].flat().includes(email)).length,mailBefore=recipientMails(colleague);
 const context=await browser.newContext({viewport:{width:1440,height:960},ignoreHTTPSErrors:true});await context.addCookies(actor.split('; ').map(s=>{const at=s.indexOf('=');return {name:s.slice(0,at),value:s.slice(at+1),url:h.origin}}));const page=await context.newPage();
 const submitShare=async principal=>{await page.goto(h.origin+'/app/items/'+team.id);const share=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Share',exact:true})});await share.getByLabel('Person or group').selectOption(principal);await share.locator('select[name=role]').selectOption('viewer');const [response]=await press(page,share.getByRole('button',{name:'Share',exact:true}));return response};
 for(const attempt of ['first','retry','restart']){
  if(attempt==='restart'){await h.stop();await h.start()}
  assert.equal((await submitShare(colleague)).status(),403,'the browser refuses the internal non-member');
  await page.getByText('Code: sharing_policy_non_members_disabled',{exact:true}).waitFor();
  const after=await h.api(`/items/${team.id}`,actor);assert.deepEqual({item:after.item,versions:after.versions,grants:after.grants},{item:before.item,versions:before.versions,grants:before.grants},'refusal preserves location, versions and grants');
  assert.deepEqual(await shareAudits(),[],'refusal creates no successful share audit');assert.equal(recipientMails(colleague),mailBefore,'refusal sends no recipient mail');
  await h.api(`/items/${team.id}`,sessions[colleague],undefined,403);
  for(const version of before.versions){const path=`/api/chest/items/${team.id}/bytes/${version.id}`,response=await h.fetch(path,{headers:{cookie:actor}});assert.equal(response.status,200);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),version.checksum,'each retained original is unchanged');assert.equal((await h.fetch(path,{headers:{cookie:sessions[colleague]}})).status,403,'the recipient cannot read any retained original')}
  if(attempt==='first'){await shot(page,1440,'internal-non-member-refused');await page.setViewportSize({width:390,height:960});await shot(page,390,'internal-non-member-refused');await page.setViewportSize({width:1440,height:960})}
 }
 const memberMailBefore=recipientMails(teammate);assert.equal((await submitShare(teammate)).status(),200,'the same member can share to a space member');
 const allowed=await h.api(`/items/${team.id}`,actor);assert.ok(allowed.grants.some(grant=>grant.principal===teammate&&grant.role==='viewer'&&grant.by===actorEmail));assert.equal((await h.api(`/items/${team.id}`,sessions[teammate])).role,'viewer');assert.equal(recipientMails(teammate),memberMailBefore+1);assert.equal((await shareAudits()).length,1);assert.equal((await shareAudits())[0].actor,actorEmail);
 assert.deepEqual(allowed.item,before.item);assert.deepEqual(allowed.versions,before.versions);
 await shot(page,1440,'member-recipient-allowed');await page.setViewportSize({width:390,height:960});await shot(page,390,'member-recipient-allowed');await context.close();
 console.log('PROBE POLICY-001 3 browser: authorized member Share form to internal non-member -> 403 sharing_policy_non_members_disabled; retry and Worker restart preserve all originals, grants, successful audits and recipient mail; member-recipient control succeeds; screens at 1440 and 390');
 console.log('POLICY-001 browser confirmation, domain/public refusal, live named/guest suspension, reallow/removal and member/editor restrictions passed at 1440/390');
}finally{await browser?.close();await h.close()}
