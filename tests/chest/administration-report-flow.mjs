// ADMIN-002 reporting slice, exercised from the existing administrative public journey.
import assert from 'node:assert/strict';
import {guestInventoryJourney} from './administration-guest-flow.mjs';
const b64=s=>Buffer.from(s).toString('base64');
const cookieRows=(cookie,url)=>cookie.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url}});
const csvRows=text=>text.trimEnd().split('\r\n').slice(1).map(line=>line.split(',').map(s=>s.replace(/^"|"$/g,'').replaceAll('""','"')));
export async function reportingJourney(h,browser,owner){
 const api=h.api,invite=async(email,name)=>{await api('/people',owner,{action:'invite',email,name});return h.signIn(email,true)};
 const email='avery.reporting@example.test',outsideEmail='devon.reporting@example.test',adminEmail='robin.reporting@example.test';
 const staff=await invite(email,'Avery Nguyen'),outside=await invite(outsideEmail,'Devon Garcia'),admin=await invite(adminEmail,'Robin Brown');
 const group=await api('/groups',owner,{name:'Operations reporting',members:[email]}),otherGroup=await api('/groups',owner,{name:'Restricted reporting',members:[outsideEmail]});
 const grant=await api('/administration/roles',owner,{email:adminEmail,role:'audit-reporting',scope:'groups',groups:[group.id]});
 const space=await api('/spaces',staff,{name:'Operations retained originals'}),other=await api('/spaces',outside,{name:'Private executive planning'});
 const original='Approved supplier agreement: original.',previous='Supplier agreement: retained draft.',trash='Retained trashed supplier document.';
 const folder=await api('/items',staff,{space:space.id,type:'folder',name:'Original contracts'});
 const file=await api('/items',staff,{parent:folder.id,type:'file',name:'Confidential supplier agreement.txt',base64:b64(previous)});
 await api(`/items/${file.id}/versions`,staff,{base64:b64(original)});
 const duplicate=await api('/items',staff,{space:space.id,type:'file',name:'Second reference.txt',base64:b64(original)});
 const trashFolder=await api('/items',staff,{space:space.id,type:'folder',name:'Retained trash folder'});
 await api('/items',staff,{parent:trashFolder.id,type:'file',name:'Deleted but retained.txt',base64:b64(trash)});
 await api(`/items/${trashFolder.id}/trash`,staff,{});
 const secret=await api('/items',outside,{space:other.id,type:'file',name:'Executive acquisition target.txt',base64:b64('Unrelated private bytes.')});
 const personal=(await api('/files',staff)).personal;
 await api('/items',staff,{space:personal,type:'file',name:'Same original in personal area.txt',base64:b64(original)});
 const link=await api(`/items/${file.id}/public-links`,staff,{});
 const view=await api(`/items/${file.id}`,staff),current=view.item.current;
 const guest=await h.fetch(new URL(link.url).pathname+'/f/'+file.id);
 assert.equal(guest.status,200);assert.equal(await guest.text(),original);
 // More than the old 300-row cap, generated through real download requests. Each original stays unchanged.
 for(let i=0;i<305;i++){
  const response=await h.raw(`/api/chest/items/${file.id}/bytes/${current}?download=true`,staff);
  assert.equal(response.status,200);assert.equal(await response.text(),original);
 }
 // Out-of-scope noise must not displace authorized rows before filtering.
 await h.raw(`/api/chest/items/${secret.id}/bytes/${secret.payload.current}?download=true`,outside);
 let report=await api('/administration/audit?category=downloads&limit=2',admin);
 assert.equal(report.rows.length,2);assert.ok(report.next);
 assert.ok(report.rows.every(r=>r.object_id!==secret.id));
 const firstIds=report.rows.map(r=>r.id),second=await api('/administration/audit?'+new URLSearchParams({category:'downloads',limit:'2',cursor:report.next,until:report.until}),admin);
 assert.ok(second.rows.every(r=>!firstIds.includes(r.id)));
 const filter=new URLSearchParams({action:'version.download',actor:email,object:file.id,category:'downloads'});
 const source=await api('/audit?'+new URLSearchParams({action:'version.download',actor:email,object:file.id,limit:'300',paginate:'true'}),owner);
 assert.equal(source.rows.length,300);assert.ok(source.next);
 const sourceTail=await api('/audit?'+new URLSearchParams({action:'version.download',actor:email,object:file.id,limit:'300',paginate:'true',cursor:source.next}),owner);
 const response=await h.raw('/api/chest/administration/audit/export?'+filter,admin);assert.equal(response.status,200);
 const exported=csvRows(await response.text());assert.equal(exported.length,source.rows.length+sourceTail.rows.length);
 assert.equal(exported.length,305);assert.ok(exported.every(r=>r[1]===email&&r[2]==='version.download'&&r[3]===file.id));
 const guestEvents=await api('/administration/audit?category=guests',admin);assert.ok(guestEvents.rows.some(r=>r.action==='link.download'&&r.object_id===file.id),'in-scope guest activity follows content custody');
 const scoped=await api('/administration/storage',admin),area=scoped.rows.find(r=>r.id===space.id);
 assert.equal(area.currentBytes,Buffer.byteLength(original));assert.equal(area.previousBytes,Buffer.byteLength(previous));assert.equal(area.trashBytes,Buffer.byteLength(trash));
 assert.equal(area.retainedBytes,Buffer.byteLength(original+previous+trash));
 assert.equal(scoped.rows.find(r=>r.id===personal).retainedBytes,Buffer.byteLength(original));
 assert.equal(scoped.total.retainedBytes,area.retainedBytes,'shared originals deduplicate across team and personal areas');
 assert.equal(scoped.total.currentBytes+scoped.total.previousBytes+scoped.total.trashBytes+scoped.total.quarantineBytes,scoped.total.retainedBytes);
 assert.equal(scoped.costs,null);assert.ok(!JSON.stringify(scoped).includes(secret.id));
 assert.ok(!JSON.stringify(scoped).includes('Confidential supplier'));
 const storageCsv=await h.raw('/api/chest/administration/storage/export',admin);assert.equal(storageCsv.status,200);assert.equal(Number(csvRows(await storageCsv.text()).find(r=>r[0]===space.id)[3]),area.retainedBytes);
 await api('/administration/storage?group='+otherGroup.id,admin,undefined,403);
 await api('/administration/audit?group='+otherGroup.id,admin,undefined,403);
 await api('/administration/storage',staff,undefined,403);
 await api(`/items/${file.id}`,admin,undefined,403);
 await api('/administration/audit?from=bad-date',admin,undefined,400);
 await api('/administration/audit?from=2030-01-01&to=2020-01-01',admin,undefined,400);
 await api('/administration/audit?cursor=not-base64',admin,undefined,400);
 await api('/administration/costs',admin,undefined,403);
 const rates={provider:'Independent storage provider',quote:'Operations quote, 19 October 2026',storageUsdPerGbMonth:0.02,egressUsdPerGb:0.08};
 await api('/administration/costs',owner,rates,400);
 await api('/administration/costs',owner,{...rates,confirm:true,storageUsdPerGbMonth:-1},400);
 await api('/administration/costs',admin,{...rates,confirm:true},403);
 assert.equal((await api('/administration/costs',owner)).rates,null);
 // An in-scope reader hiding view activity keeps that choice at the administrative door too.
 await api('/audit/privacy',staff,{hidden:true});
 assert.equal((await api('/administration/audit?'+filter,admin)).rows.length,0);
 await api('/audit/privacy',staff,{hidden:false});
 await guestInventoryJourney(h,browser,{owner,staff,admin,outside,file,folder,secret,group,otherGroup});
 const contexts=[];
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});contexts.push(context);
   await context.addCookies(cookieRows(owner,h.origin));const page=await context.newPage();
   await page.goto(h.origin+'/app/administration/costs');
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Save estimate rates',exact:true})});
   await form.getByLabel('Provider',{exact:true}).fill(rates.provider);
   await form.getByLabel('Quote or rate source and date',{exact:true}).fill(rates.quote);
   await form.getByLabel('Storage (USD per decimal GB-month)',{exact:true}).fill(String(rates.storageUsdPerGbMonth));
   await form.getByLabel('Egress (USD per decimal GB)',{exact:true}).fill(String(rates.egressUsdPerGb));
   await page.screenshot({path:`test-results/${width}-report-cost-confirmation.png`,fullPage:true});
   await form.getByRole('checkbox').check();await Promise.all([page.waitForNavigation(),form.getByRole('button',{name:'Save estimate rates',exact:true}).click()]);
   await page.getByText('Independent storage provider',{exact:true}).waitFor();
   await page.screenshot({path:`test-results/${width}-report-cost-saved.png`,fullPage:true});
   await page.goto(h.origin+'/app/administration/storage?group='+group.id);
   await page.getByRole('heading',{name:'Estimated storage cost',exact:true}).waitFor();
   const estimate=(await api('/administration/storage?group='+group.id,owner)).costs.estimate;
   assert.equal(estimate.usd,Number((area.retainedBytes/1e9*rates.storageUsdPerGbMonth).toFixed(6)));
   await page.screenshot({path:`test-results/${width}-report-storage-owner.png`,fullPage:true});
   await context.clearCookies();await context.addCookies(cookieRows(admin,h.origin));
   await page.goto(h.origin+'/app/administration/audit');
   await page.getByLabel('Exact action',{exact:true}).fill('version.download');await page.getByLabel('Actor email or identity',{exact:true}).fill(email);
   await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Apply filters',exact:true}).click()]);
   await page.getByRole('link',{name:'Next page',exact:true}).waitFor();
   const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export CSV',exact:true}).click();await(await download).path();
   assert.equal(await page.getByText('Executive acquisition target.txt',{exact:true}).count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`test-results/${width}-report-activity-filtered.png`,fullPage:true});
   await page.screenshot({path:`test-results/${width}-report-activity-viewport.png`});
   await Promise.all([page.waitForNavigation(),page.getByRole('link',{name:'Next page',exact:true}).click()]);
   await page.screenshot({path:`test-results/${width}-report-activity-next.png`,fullPage:true});
   await page.goto(h.origin+'/app/administration/storage');await page.getByRole('heading',{name:'Usage by area',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`test-results/${width}-report-storage-scoped.png`,fullPage:true});
   await context.close();
  }
 }finally{for(const context of contexts)await context.close()}
 // Live grant removal also invalidates old pagination URLs and exports.
 await api('/administration/roles',owner,{action:'revoke',id:grant.id});
 await api('/administration/audit?cursor='+encodeURIComponent(report.next),admin,undefined,403);
 await api('/administration/storage',admin,undefined,403);
 await api('/administration/guests',admin,undefined,403);
 assert.equal((await h.raw('/api/chest/administration/guests/export',admin)).status,403);
 assert.equal((await h.raw('/api/chest/administration/audit/export',admin)).status,403);
 const unchanged=await api(`/items/${file.id}`,staff);assert.equal(unchanged.item.current,current);assert.equal(unchanged.versions.length,2);
 assert.equal((await api(`/items/${duplicate.id}`,staff)).versions.length,1);
 console.log('ADMIN-002 reporting slice passed: live scoped metadata, guest activity, 305-row reconciled CSV, privacy, retained versions/trash deduplication, USD quote confirmation and browser reports at 1440/390. Collabora and billed egress/AI remain unclaimed.');
}
