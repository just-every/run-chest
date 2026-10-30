import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness(),cookies={};let browser;
const go=(p,path)=>p.goto(h.origin+path);
const submit=async(form,name)=>{const p=form.page();await Promise.all([p.waitForNavigation(),form.getByRole('button',{name,exact:true}).click()])};
const fit=async(p,name,width)=>{await p.waitForLoadState('load');await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:`test-results/${width}-space-policy-${name}.png`,fullPage:true})};
try{
await mkdir('test-results',{recursive:true});
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});cookies.owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:cookies.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const n of ['lead','staff']){await h.api('/people',cookies.owner,{action:'invite',email:n+'@example.test',name:n==='lead'?'Jordan Lee':'Casey Chen'});cookies[n]=await h.signIn(n+'@example.test',true)}
 const group=await h.api('/groups',cookies.owner,{name:'Ops leads',members:['lead@example.test']});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const contexts=[];const page=async who=>{const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});contexts.push(context);await context.addCookies(cookies[who].split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));return context.newPage()};
  const a=await page('owner'),lead=await page('lead'),staff=await page('staff');
  await h.api('/space-policy',cookies.owner,{creation:'everyone',defaults:{externalAccess:true,nonMemberAccess:true,contentManagerFolderSharing:true,noDownload:false,defaultLinkAudience:'organisation',storageLimitBytes:null,managerOverride:true}});
  const old=await h.api('/spaces',cookies.lead,{name:`Existing team ${width}`}),before=(await h.api(`/spaces/${old.id}`,cookies.lead)).settings;
  await go(a,'/app/files');await a.getByRole('link',{name:'Space creation & defaults',exact:true}).click();
  const policy=a.locator('form').filter({has:a.getByRole('button',{name:'Save space policy',exact:true})});
  await policy.getByLabel('Who may create team spaces').selectOption('groups');await policy.getByLabel('Ops leads',{exact:true}).check();
  for(const name of ['Allow external access','Allow access for people outside space membership','Content managers may share folders','Allow managers to override defaulted settings'])await policy.getByLabel(name).selectOption('false');
  await policy.getByLabel('No download, print or copy for viewers and commenters').selectOption('true');await policy.getByLabel('Default link audience').selectOption('restricted');await policy.getByLabel('Storage limit in GB (blank means unlimited)',{exact:true}).fill(String(1048576/2**30));await fit(a,'admin-defaults',width);await submit(policy,'Save space policy');
  await go(staff,'/app/files');assert.equal(await staff.getByRole('button',{name:'Create team space',exact:true}).count(),0);await fit(staff,'creation-refused',width);
  await staff.getByText('Request a team space',{exact:true}).click();const request=staff.locator('form').filter({has:staff.getByRole('button',{name:'Send space request',exact:true})});await request.getByLabel('Requested team space name').fill(`Field operations ${width}`);await request.getByLabel('Why do you need this space?').fill('Shared files for the field crew');await submit(request,'Send space request');await fit(staff,'request-sent',width);
  await go(a,'/app/notices');assert.ok(await a.getByText(`staff@example.test requests a team space: Field operations ${width}.`,{exact:false}).count());await fit(a,'admin-notice',width);
  await go(lead,'/app/files');const create=lead.locator('form').filter({has:lead.getByRole('button',{name:'Create team space',exact:true})});const name=`Governed team ${width}`;await create.getByLabel('New team space name').fill(name);await submit(create,'Create team space');const created=(await h.api('/files',cookies.lead)).spaces.find(s=>s.name===name);assert.ok(created);await go(lead,`/app/spaces/${created.id}?manage`);
  const settings=lead.locator('form').filter({has:lead.getByRole('button',{name:'Save space settings',exact:true})});assert.equal(await settings.getByLabel('Allow external access').inputValue(),'false');await fit(lead,'locked-defaults',width);
  await settings.getByLabel('Allow external access').selectOption('true');await submit(settings,'Save space settings');assert.equal(lead.url(),h.origin+'/app/action');assert.ok(await lead.getByText('Code: space_manager_override_disabled',{exact:true}).count());await fit(lead,'manager-refused',width);
  assert.deepEqual((await h.api(`/spaces/${old.id}`,cookies.lead)).settings,before);
  await go(a,`/app/files/space-policy?scope=${encodeURIComponent('space:'+created.id)}`);const admin=a.locator('form').filter({has:a.getByRole('button',{name:'Save this space',exact:true})});await admin.getByLabel('Allow external access').selectOption('true');await admin.getByLabel('Allow managers to override defaulted settings').selectOption('true');await submit(admin,'Save this space');await fit(a,'admin-space-saved',width);
  await go(lead,`/app/spaces/${created.id}?manage`);const unlocked=lead.locator('form').filter({has:lead.getByRole('button',{name:'Save space settings',exact:true})});await unlocked.getByLabel('Allow external access').selectOption('false');await submit(unlocked,'Save space settings');assert.equal((await h.api(`/spaces/${created.id}`,cookies.lead)).settings.externalAccess,false);await fit(lead,'manager-saved',width);
  for(const context of contexts)await context.close();
 }
 console.log('SPACE-002 browser controls, request notices, existing-space preservation and manager locks at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
