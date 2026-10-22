import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const b64=b=>Buffer.from(b).toString('base64');
export async function organizationLinkControlsFlow(){
 const h=await harness();let browser;
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});const space=(await h.api('/files',owner)).personal;
  await h.api('/people',owner,{action:'invite',email:'colleague@example.test',name:'Jordan Lee'});const colleague=await h.signIn('colleague@example.test',true);
  const file=await h.api('/items',owner,{space,name:'Pinned terms.txt',base64:b64('synthetic-chest-original')}),first=file.payload.current;await h.api(`/items/${file.id}/versions`,owner,{base64:b64('synthetic-chest-replacement')});
  const link=await h.api(`/items/${file.id}/links`,owner,{audience:'organisation',role:'commenter',password:'synthetic-chest-50',versionMode:'pinned',version:first,limit:10,expires:'2026-11-30'}),token=new URL(link.url).pathname.split('/s/')[1];
  assert.equal(link.link.password,true);assert.ok(!JSON.stringify(link).includes('salt'));
  assert.equal((await h.api('/search?q=Pinned',colleague)).count,0);await h.api('/links/open',colleague,{token,password:'wrong'},401);await h.api('/links/open',colleague,{token,password:'synthetic-chest-50'});
  const view=await h.api(`/items/${file.id}`,colleague);assert.equal(view.item.current,first);assert.equal(view.versions.length,1);assert.equal(view.versions[0].id,first);
  assert.equal((await h.raw(`/api/chest/items/${file.id}/bytes/${(await h.api(`/items/${file.id}`,owner)).item.current}?download=true`,colleague)).status,404,'pinned organization role never exposes the replacement');
  for(let n=0;n<3;n++)assert.equal(await(await h.raw(`/api/chest/items/${file.id}/bytes/${first}?download=true`,colleague)).text(),'synthetic-chest-original');
  assert.match((await h.api(`/items/${file.id}`,owner)).links.find(l=>l.id===link.link.id).summary,/Expires Nov 30 · 3 of 10 downloads/);
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const p=await context.newPage();await p.goto(h.origin+'/app/items/'+file.id);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`test-results/${width}-organization-link-controls.png`,fullPage:true});await p.goto(h.origin+'/app/links');await p.screenshot({path:`test-results/${width}-organization-link-management.png`,fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
   const other=await h.signIn('colleague@example.test'),visitor=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await visitor.addCookies(other.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const q=await visitor.newPage();await q.goto(link.url);await q.getByRole('heading',{name:'Enter the link password',exact:true}).waitFor();await q.screenshot({path:`test-results/${width}-organization-link-password.png`,fullPage:true});await q.getByLabel('Link password',{exact:true}).fill('synthetic-chest-50');await Promise.all([q.waitForNavigation(),q.getByRole('button',{name:'Open organization link',exact:true}).click()]);await q.waitForURL('**/app/items/'+file.id);await visitor.close();
  }
  await h.api(`/links/${link.link.id}`,owner,{remove:true});assert.equal((await h.raw(`/api/chest/items/${file.id}/bytes/${first}?download=true`,colleague)).status,403);
  const preview=await h.api('/items',owner,{space,name:'No download.txt',base64:b64('synthetic-chest-preview')}),noDown=await h.api(`/items/${preview.id}/links`,owner,{audience:'organisation',role:'viewer',download:false});await h.api('/links/open',colleague,{token:new URL(noDown.url).pathname.split('/s/')[1]});assert.equal((await h.raw(`/api/chest/items/${preview.id}/bytes/${preview.payload.current}`,colleague)).status,200);assert.equal((await h.raw(`/api/chest/items/${preview.id}/bytes/${preview.payload.current}?download=true`,colleague)).status,403);
  const limited=await h.api('/items',owner,{space,name:'Atomic count.txt',base64:b64('synthetic-chest-count')}),one=await h.api(`/items/${limited.id}/links`,owner,{audience:'organisation',role:'viewer',limit:1});await h.api('/links/open',colleague,{token:new URL(one.url).pathname.split('/s/')[1]});const results=await Promise.all([h.raw(`/api/chest/items/${limited.id}/bytes/${limited.payload.current}?download=true`,colleague),h.raw(`/api/chest/items/${limited.id}/bytes/${limited.payload.current}?download=true`,colleague)]);assert.equal(results.filter(r=>r.status===200).length,1,'parallel organization requests never exceed a one-download limit');assert.equal((await h.api(`/items/${limited.id}`,owner)).links.find(l=>l.id===one.link.id).downloads,1);
  console.log('SHARE-001 organization passwords, exact pinned projection, hidden pending versions, 3-of-10 expiry display, 1440/390 creation/password/management screens, one-click revoke, preview-only and atomic count passed');
 }finally{await browser?.close();await h.close()}
}
export async function largeFolderSnapshotFlow(){
 const h=await harness(),start=Date.now();
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL),space=(await h.api('/files',owner)).personal,folder=await h.api('/items',owner,{space,type:'folder',name:'501-file snapshot'}),files=[];
  for(let n=0;n<501;n++)files.push(await h.api('/items',owner,{parent:folder.id,name:`Original ${n}.txt`,base64:b64(`synthetic-chest-${n}`)}));
  const link=await h.api(`/items/${folder.id}/links`,owner,{audience:'public',versionMode:'pinned'}),base=new URL(link.url).pathname;
  const late=await h.api('/items',owner,{parent:folder.id,name:'Arrived later.txt',base64:b64('synthetic-chest-later')});await h.api(`/items/${files[500].id}/rename`,owner,{name:'Renamed later.txt'});await h.api(`/items/${files[500].id}/versions`,owner,{base64:b64('synthetic-chest-changed')});
  const page=await(await h.fetch(base)).text();assert.match(page,/501 files shared/);assert.match(page,/Original 500.txt/);assert.doesNotMatch(page,/Arrived later|Renamed later/);assert.equal(await(await h.fetch(`${base}/f/${files[500].id}`)).text(),'synthetic-chest-500');assert.equal((await h.fetch(`${base}/f/${late.id}`)).status,404);
  await h.api(`/items/${files[0].id}/settings`,owner,{restricted:true});assert.equal((await h.fetch(`${base}/f/${files[0].id}`)).status,404);await h.api(`/public-links/${link.link.id}/revoke`,owner,{});assert.equal((await h.fetch(`${base}/f/${files[500].id}`)).status,410);
  console.log('SHARE-001 501-file snapshot membership, names, exact retained bytes, restriction and revoke passed; elapsedMs='+String(Date.now()-start));
 }finally{await h.close()}
}
