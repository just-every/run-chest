// ADMIN-002: current audiences and historical identity evidence via public doors.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function guestInventoryJourney(h,browser,{owner,staff,admin,outside,file,folder,secret,group,otherGroup}) {
 const api=h.api,verified='verified@vendors.test',waiting='waiting@vendors.test',unseen='unseen@vendors.test';
 const named=await api(`/items/${file.id}/public-links`,staff,{audience:'guests',guests:[verified,waiting,unseen]});
 const domain=await api(`/items/${file.id}/public-links`,staff,{audience:'domain',domain:'partners.test'});
 await api(`/items/${secret.id}/public-links`,outside,{audience:'guests',guests:['hidden@private.test']});
 const post=(path,data)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data).toString()});
 async function challenge(link,email,confirm) {
  const path=new URL(link.url).pathname;assert.equal((await post(path+'/verify',{email})).status,200);
  const mail=h.mails.findLast(m=>[m.to].flat().includes(email)),verify=new URL(mail.text.match(/https?:\/\/[^\s]+/)[0]);
  if(confirm)assert.equal((await post(path+'/confirm',{token:verify.searchParams.get('token')})).status,303);
 }
 await challenge(named,waiting,false);await challenge(named,verified,true);await challenge(domain,'reader@partners.test',true);
 const request=await api(`/items/${folder.id}/file-requests`,staff,{title:'Supplier submissions'}),base=new URL(request.url).pathname;
 const visited=await h.fetch(base),visitor=visited.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const form=new FormData();form.set('name','A self-reported supplier');form.set('email','claimed@vendors.test');form.set('files',new Blob(['Supplier reference document.'],{type:'text/plain'}),'Supplier reference.txt');
 const submitted=await h.fetch(base,{method:'POST',headers:{origin:h.origin,cookie:visitor},body:form});assert.equal(submitted.status,200);
 const verifiedRequest=await api(`/items/${folder.id}/file-requests`,staff,{title:'Verified supplier submissions',verification:'email'}),verifiedBase=new URL(verifiedRequest.url).pathname;
 const opening=await h.fetch(verifiedBase),verifiedVisitor=opening.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const confirmPost=(path,data)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,cookie:verifiedVisitor,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data).toString()});
 assert.equal((await confirmPost(verifiedBase+'/verify',{email:'confirmed@vendors.test'})).status,200);
 const verificationMail=h.mails.findLast(m=>[m.to].flat().includes('confirmed@vendors.test')),verificationUrl=new URL(verificationMail.text.match(/https?:\/\/[^\s]+/)[0]);
 assert.equal((await confirmPost(verifiedBase+'/confirm',{token:verificationUrl.searchParams.get('token')})).status,303);
 const verifiedForm=new FormData();verifiedForm.set('email','forged@unrelated.test');verifiedForm.set('files',new Blob(['A verified supplier reference.'],{type:'text/plain'}),'Verified supplier reference.txt');
 assert.equal((await h.fetch(verifiedBase,{method:'POST',headers:{origin:h.origin,cookie:verifiedVisitor},body:verifiedForm})).status,200);
 await api(`/file-requests/${verifiedRequest.request.id}/close`,staff,{});
 const report=await api('/administration/guests',admin),namedRows=report.rows.filter(r=>r.sourceId===named.link.id);
 assert.equal(namedRows.length,3);
 assert.equal(namedRows.find(r=>r.identity===verified).evidence,'email verified');assert.ok(namedRows.find(r=>r.identity===verified).recordedAt);
 for(const email of [waiting,unseen]) {const row=namedRows.find(r=>r.identity===email);assert.equal(row.evidence,'configured recipient');assert.equal(row.recordedAt,null)}
 assert.ok(report.rows.some(r=>r.identity==='@partners.test'&&r.evidence==='domain audience'));
 assert.ok(report.rows.some(r=>r.identity==='reader@partners.test'&&r.evidence==='email verified'));
 assert.ok(report.rows.some(r=>r.identity==='Anyone with the link'&&r.evidence==='anonymous audience'));
 assert.ok(report.rows.some(r=>r.source==='file request'&&r.identity==='claimed@vendors.test'&&r.evidence==='self-reported submitter'&&r.state==='historical submission'));
 assert.ok(report.rows.some(r=>r.source==='file request'&&r.identity==='confirmed@vendors.test'&&r.evidence==='verified submission'&&r.state==='historical submission'));
 assert.ok(!JSON.stringify(report).includes('forged@unrelated.test'));
 const serialized=JSON.stringify(report);for(const privateValue of [secret.id,'hidden@private.test','Confidential supplier agreement.txt','Executive acquisition target.txt','tokenHash','password','chest_pub_'])assert.ok(!serialized.includes(privateValue),`report excludes ${privateValue}`);
 await api('/administration/guests',staff,undefined,403);await api('/administration/guests?group='+otherGroup.id,admin,undefined,403);
 assert.equal((await h.raw('/api/chest/administration/guests/export?group='+otherGroup.id,admin)).status,403);
 const filtered=await api('/administration/guests?email='+encodeURIComponent(verified),admin);assert.equal(filtered.rows.length,1);assert.equal(filtered.rows[0].identity,verified);
 const exported=await h.raw('/api/chest/administration/guests/export',admin);assert.equal(exported.status,200);const csv=await exported.text();assert.equal(csv.trimEnd().split('\r\n').length-1,report.rows.length);assert.ok(csv.includes(verified));assert.ok(!csv.includes('hidden@private.test'));
 // Existing view-history policy applies to verification evidence without hiding access definitions.
 await api('/audit/privacy',owner,{scope:'organization',enabled:false,groups:[]});
 const hidden=await api('/administration/guests',admin);assert.equal(hidden.rows.find(r=>r.identity===verified).evidence,'configured recipient');assert.ok(!hidden.rows.some(r=>r.identity==='reader@partners.test'));
 await api('/audit/privacy',owner,{scope:'organization',enabled:true,groups:[]});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
  try {
   await context.addCookies(admin.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin}}));
   const page=await context.newPage();await page.goto(h.origin+'/app/administration/audit?group='+group.id);
   const card=page.getByRole('heading',{name:'External guest evidence',exact:true}).locator('..');
   await card.getByText(verified,{exact:true}).waitFor();await card.getByText('claimed@vendors.test',{exact:true}).waitFor();
   assert.ok(!(await card.innerText()).includes('hidden@private.test'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/${width}-report-external-guests.png`,fullPage:true});
   await page.getByLabel('Guest email or audience (guest evidence only)',{exact:true}).fill(verified);
   await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Apply filters',exact:true}).click()]);
   assert.equal(await card.locator('ul.events > li').count(),1);assert.ok(!(await card.innerText()).includes('claimed@vendors.test'));
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/${width}-report-external-guests-filtered.png`,fullPage:true});
   const [download]=await Promise.all([page.waitForEvent('download'),card.getByRole('link',{name:'Export guest CSV',exact:true}).click()]);assert.equal(await download.failure(),null);
   const downloaded=await readFile(await download.path(),'utf8');assert.ok(downloaded.includes(verified));assert.ok(!downloaded.includes('claimed@vendors.test'));
  }finally{await context.close()}
 }
 const rules={scope:`space:${(await api(`/items/${file.id}`,staff)).space.id}`,allowPublic:false,allowOrganisation:true,allowDiscovery:true,defaultAudience:'organisation',defaultRole:'viewer',allowExternal:false};
 await api('/link-policy',owner,rules);
 assert.ok((await api('/administration/guests',admin)).rows.filter(r=>r.sourceId===named.link.id).every(r=>r.state==='policy blocked'));
 await api('/link-policy',owner,{...rules,remove:true});
 await api(`/public-links/${named.link.id}/revoke`,staff,{});
 const revoked=(await api('/administration/guests',admin)).rows.filter(r=>r.sourceId===named.link.id);assert.ok(revoked.every(r=>r.state==='revoked'));assert.equal(revoked.find(r=>r.identity===verified).evidence,'email verified','revocation ends authority without pretending the historical verification never occurred');
 console.log('ADMIN-002 guest inventory passed: current scope, configured/verified/self-reported evidence, anonymous/domain audiences, privacy, CSV, revoked links and 1440/390.');
}
