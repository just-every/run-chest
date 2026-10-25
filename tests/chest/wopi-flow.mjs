import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {harness} from './harness.mjs';
import {docx,xlsx} from './office-fixtures.mjs';
export async function wopiFlow({browserProof=false}={}){
 const origin='https://synthetic-chest-editor.test',h=await harness({bindings:{COLLABORA_URL:origin,CONTENT_SCANNER_URL:'https://synthetic-chest-scanner.test/scan',CONTENT_SCANNER_TOKEN:'synthetic-chest-1'},edge:async r=>{if(r.url==='https://synthetic-chest-scanner.test/scan'){const b=new Uint8Array(await r.arrayBuffer());return Response.json({checksum:r.headers.get('x-content-sha256'),size:b.length,state:'clean',sensitive:false,engine:'synthetic-chest-1',reason:'Synthetic scanner network edge'})}if(r.url===origin+'/hosting/discovery')return new Response(`<wopi-discovery><net-zone><app name="writer"><action name="edit" ext="docx" urlsrc="${origin}/browser/cool.html?"/></app></net-zone></wopi-discovery>`,{headers:{'content-type':'application/xml'}})}});
 const post=(path,input,cookie)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(cookie?{cookie}:{})},body:new URLSearchParams(input).toString()});
 const editor=async(path,cookie)=>{const response=await h.raw(path,cookie,{});assert.equal(response.status,200,await response.clone().text());const html=await response.text(),token=html.match(/name="access_token" value="([^"]+)"/)[1],wopi=new URL(html.match(/action="([^"]+)"/)[1].replaceAll('&amp;','&')).searchParams.get('WOPISrc');assert.ok(wopi);return {token,path:new URL(wopi).pathname}};
 const call=(e,method='GET',sub='',headers={},body)=>h.fetch(e.path+sub+'?access_token='+e.token,{method,headers,body});
 const changed=text=>{const parts=unzipSync(docx());parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Harbor renewal agreement',text));return zipSync(parts)};
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL),space=(await h.api('/files',owner)).personal,file=await h.api('/items',owner,{space,name:'Agreement.docx',base64:Buffer.from(docx()).toString('base64')});
  const staff=await editor(`/api/chest/items/${file.id}/collabora`,owner),info=await(await call(staff)).json();assert.equal(info.UserCanWrite,true);assert.equal(info.BaseFileName,'Agreement.docx');assert.equal(info.Version,file.payload.current);assert.equal(info.PostMessageOrigin,h.origin);assert.equal((await call(staff,'GET','/state')).status,200);assert.equal((await h.fetch(staff.path+'/state?access_token=synthetic-chest-1')).status,401);
  const link=await h.api(`/items/${file.id}/links`,owner,{audience:'guests',guests:['writer@outside.test'],role:'editor',password:'synthetic-chest-61'}),base=new URL(link.url).pathname,challenge=await post(base+'/verify',{email:'writer@outside.test'}),id=(await challenge.text()).match(/name="challenge" value="([^"]+)"/)[1],pin=h.mails.at(-1).text.match(/PIN is (\d{6})/)[1],verified=await post(base+'/pin',{email:'writer@outside.test',challenge:id,pin}),guestCookie=verified.headers.getSetCookie()[0].split(';')[0],admission=await post(base,{password:'synthetic-chest-61'},guestCookie),cookie=guestCookie+'; '+admission.headers.getSetCookie()[0].split(';')[0],launch=await post(base+'/editor/'+file.id,{},cookie);assert.equal(launch.status,200,await launch.clone().text());const html=await launch.text(),guest={token:html.match(/name="access_token" value="([^"]+)"/)[1],path:staff.path};
  assert.equal((await(await call(guest)).json()).UserFriendlyName,'writer@outside.test');assert.equal((await h.fetch(staff.path+'?access_token=synthetic-chest-1')).status,401);
  assert.equal((await call(staff,'POST','contents',{},changed('Refused without a lock'))).status,401); // token is bound to the exact file, including its path
  assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':'synthetic-chest-1'},changed('No lock'))).status,409);
  const lock='synthetic-chest-1';assert.equal((await call(staff,'POST','',{'X-WOPI-Override':'LOCK','X-WOPI-Lock':lock})).status,200);
  assert.equal((await call(guest,'POST','',{'X-WOPI-Override':'LOCK','X-WOPI-Lock':'synthetic-chest-2'})).status,409);
  assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':lock},changed('Staff edit'))).status,200);
  const guestEdit=changed('Guest edit');assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},guestEdit)).status,200);
  let view=await h.api(`/items/${file.id}`,owner);assert.equal(view.versions.length,3);assert.equal(view.versions[0].actor,'writer@outside.test');assert.equal(view.versions[1].actor,h.vars.OWNER_EMAIL);assert.equal((await(await call(staff)).json()).Version,view.item.current);
  assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},guestEdit)).status,200);assert.equal((await h.api(`/items/${file.id}`,owner)).versions.length,3,'identical retry invents no version');
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:true});assert.equal((await call(staff,'GET','/contents')).status,403,'an already-open editor cannot read an unscanned retained version');assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':lock},changed('Quarantine bypass'))).status,403);await h.api('/content-security/scan',owner,{item:file.id});assert.equal((await call(staff,'GET','/contents')).status,200);
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.at',CAST(? AS INTEGER)) WHERE kind='member-link-session' AND json_extract(payload,'$.link')=?",Date.now()-13*3600000,link.link.id);assert.equal((await call(guest,'GET','/contents')).status,401,'an open editor cannot outlive password admission');assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Expired password'))).status,401);
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.at',CAST(? AS INTEGER)) WHERE kind='member-link-session' AND json_extract(payload,'$.link')=?",Date.now(),link.link.id);assert.equal((await call(guest,'GET','/contents')).status,200);
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.verifiedAt',?) WHERE kind='guest-session'",new Date(Date.now()-8*86400000).toISOString());assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Expired verification'))).status,403);
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.verifiedAt',?) WHERE kind='guest-session'",new Date().toISOString());await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.expires',?) WHERE id=?",new Date(Date.now()-86400000).toISOString().slice(0,10),link.link.id);assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Expired grant'))).status,403,'an open editor refuses the next save after grant expiry');assert.equal((await call(guest,'GET','/contents')).status,403);assert.equal((await call(guest,'GET','/state')).status,403);
  await h.api(`/public-links/${link.link.id}/revoke`,owner,{});assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Revoked guest'))).status,403);assert.equal((await h.api(`/items/${file.id}`,owner)).versions.length,3);
  const restored=await h.api(`/items/${file.id}/versions/${file.payload.current}/restore`,owner,{});assert.equal((await call(staff,'POST','',{'X-WOPI-Override':'REFRESH_LOCK','X-WOPI-Lock':lock})).status,409,'refresh never rebases stale editor bytes onto an external restore');assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':lock},changed('Stale overwrite'))).status,409);assert.equal((await h.api(`/items/${file.id}`,owner)).item.current,restored.payload.current);view=await h.api(`/items/${file.id}`,owner);
  assert.equal((await call(staff,'POST','',{'X-WOPI-Override':'UNLOCK','X-WOPI-Lock':lock})).status,200);
  await h.stop();await h.start();assert.equal((await(await call(staff)).json()).Version,view.item.current);assert.equal((await(await call(staff,'GET','/state')).json()).restore,restored.payload.current);
  if(browserProof)await collaboraRestoreJourney(h,owner,staff,file,call);
  console.log('SHARE-005 Collabora WOPI public doors: stable file, staff/verified guest attribution, original reads, atomic locks, immutable saves, identical retries, re-verification/revocation refusal and restart passed (editor network edge only)');
 }finally{await h.close()}
}

// The editor is faked only at its network edge; WOPI and the Chest host run as built.
async function collaboraRestoreJourney(h,owner,staff,file,call){
 const {chromium}=await import('@playwright/test'),{mkdir}=await import('node:fs/promises');
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  await mkdir('test-results',{recursive:true});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});
   try{
   await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));
   let deliveries=0,acknowledge=true;
   await context.route('https://synthetic-chest-editor.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/current'){
     deliveries++;const info=await(await call(staff)).json(),bytes=await call(staff,'GET','/contents');
     assert.equal(bytes.status,200);assert.equal(createHash('sha256').update(Buffer.from(await bytes.arrayBuffer())).digest('hex'),file.payload.versions[0].checksum,'restore delivers exact original bytes through WOPI');
     return route.fulfill({json:{version:info.Version,acknowledge}});
    }
    return route.fulfill({contentType:'text/html',body:`<!doctype html><html><body><p>Collabora protocol network edge</p><p id="version"></p><textarea aria-label="Unsaved editor work"></textarea><script>
     const host=${JSON.stringify(h.origin)};
     const send=(MessageId,Values)=>parent.postMessage(JSON.stringify({MessageId,Values}),host);
     addEventListener('message',async e=>{if(e.origin!==host||e.source!==parent)return;const m=JSON.parse(e.data);
      if(m.MessageId==='Host_PostmessageReady')send('App_LoadingStatus',{Status:'Document_Loaded'});
      if(m.MessageId==='Host_VersionRestore'){const r=await(await fetch('/current')).json();if(r.acknowledge){document.getElementById('version').textContent=r.version;send('App_VersionRestore',{Status:'Pre_Restore_Ack'});send('App_LoadingStatus',{Status:'Document_Loaded'})}}
     });send('App_LoadingStatus',{Status:'Frame_Ready'});
    </script></body></html>`});
   });
   const page=await context.newPage();
   const launch=await h.raw(`/api/chest/items/${file.id}/collabora`,owner,{});assert.equal(launch.status,200);
   // Serve the actual authenticated host response at its public route, without exposing editor tokens in logs.
   await page.route(h.origin+'/api/chest/items/'+file.id+'/collabora',async route=>route.fulfill({status:200,headers:Object.fromEntries(launch.headers),body:await launch.clone().text()}));
   await page.goto(h.origin+'/api/chest/items/'+file.id+'/collabora');
   await page.getByRole('button',{name:'Continue to Collabora'}).click();
   await page.getByRole('status').filter({hasText:'Editor connected'}).waitFor();
   // Neither a different origin nor a sibling browsing context may acknowledge a restore.
   await page.evaluate(()=>window.postMessage(JSON.stringify({MessageId:'App_VersionRestore',Values:{Status:'Pre_Restore_Ack'}}),'*'));
   const before=await h.api(`/items/${file.id}`,owner),restored=await h.api(`/items/${file.id}/versions/${file.payload.current}/restore`,owner,{});
   await page.frameLocator('iframe').locator('#version').filter({hasText:restored.payload.current}).waitFor({timeout:30000});
   assert.equal(deliveries,1);assert.equal((await h.api(`/items/${file.id}`,owner)).versions.length,before.versions.length+1,'notification creates no version');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(await page.locator('button,a,summary').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&!e.textContent.trim()&&!e.dataset.tooltip).map(e=>e.tagName)),[],'host has no unlabelled icon-only controls');
   await page.screenshot({path:`test-results/${width}-collabora-restore-host.png`,fullPage:true});
   acknowledge=false;await page.frameLocator('iframe').getByLabel('Unsaved editor work').fill('synthetic-chest-1');
   await h.api(`/items/${file.id}/versions/${file.payload.current}/restore`,owner,{});
   await page.getByRole('status').filter({hasText:'A version was restored'}).waitFor({timeout:30000});
   await page.waitForFunction(()=>document.querySelector('[data-collabora-status]').textContent.includes('reconciling'));
   assert.equal(await page.frameLocator('iframe').getByLabel('Unsaved editor work').inputValue(),'synthetic-chest-1');
   await page.screenshot({path:`test-results/${width}-collabora-restore-pending.png`,fullPage:true});
   }finally{
    // Finish route-handler WOPI reads before closing the context and its worker.
    for(const page of context.pages())await page.unrouteAll({behavior:'wait'});
    await context.unrouteAll({behavior:'wait'});
    await context.close();
   }
  }
  console.log('VERSION-001 Collabora host protocol at 1440 and 390: automatic restore notification, exact WOPI originals, unchanged history, origin fences and pending unsaved frame retained; live Collabora engine NOT exercised');
 }finally{await browser.close()}
}

// Live proof uses an owner-provisioned local engine; ordinary Verify uses the network-edge journey above.
export async function liveCollaboraRestoreFlow({origin,tls}){
 const {chromium,expect}=await import('@playwright/test'),{mkdir}=await import('node:fs/promises');
 const h=await harness({tls,bindings:{COLLABORA_URL:origin},edge:async request=>request.url.startsWith(origin+'/')?fetch(request.url):undefined});

let browser;
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Synthetic owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=(await h.api('/files',owner)).personal;
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390])for(const [ext,content,before,after] of [['docx',docx(),'Payment within thirty days.','Synthetic changed payment terms.'],['xlsx',xlsx(),'12500','14500']]){
 const file=await h.api('/items',owner,{space,name:`Restore ${width}.${ext}`,base64:Buffer.from(content).toString('base64')});
 const base=await h.api(`/items/${file.id}/office?edit=true`,owner),field=base.fields.find(f=>f.value===before);
 await h.api(`/items/${file.id}/office`,owner,{version:base.version,changes:{[field.key]:after}});

  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});
  await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));
  const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>console.log('BROWSER ERROR',e.message));
  await page.goto(h.origin+'/app/items/'+file.id);
  await page.getByRole('button',{name:'Open in Collabora Online',exact:true}).click();
  await page.getByRole('button',{name:'Continue to Collabora',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Editor connected'}).waitFor({timeout:45000});
  console.log('LIVE connected',ext,width);
  const restored=await h.api(`/items/${file.id}/versions/${base.version}/restore`,owner,{});
  await expect.poll(async()=>{const audit=await h.api(`/audit?paginate=true&action=office.download&object=${file.id}`,owner);return audit.rows.some(r=>JSON.parse(r.detail).version===restored.payload.current)},{timeout:45000,intervals:[1000]}).toBe(true);
  const view=await h.api(`/items/${file.id}`,owner);assert.equal(view.item.current,restored.payload.current);assert.equal(view.versions.length,3);assert.equal(view.versions[0].checksum,view.versions.at(-1).checksum);
  assert.deepEqual(Buffer.from(await(await h.raw(`/api/chest/items/${file.id}/bytes/${restored.payload.current}?download=true`,owner)).arrayBuffer()),Buffer.from(content));
  const welcome=page.frameLocator('iframe[name=chest-collabora]').frameLocator('iframe[title="Welcome Dialog"]').locator('#welcome-close');
  if(await welcome.isVisible())await welcome.click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/${width}-collabora-live-${ext}-restored.png`,fullPage:true});
  console.log('LIVE restored original read by Collabora',ext,width);await context.close();
 }
}finally{await browser?.close();await h.close()}

}
