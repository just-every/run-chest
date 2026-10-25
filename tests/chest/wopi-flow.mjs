import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {harness} from './harness.mjs';
import {docx,xlsx} from './office-fixtures.mjs';
export async function wopiFlow({browserProof=false}={}){
 const origin='https://synthetic-chest-editor.test',h=await harness({bindings:{COLLABORA_URL:origin,CONTENT_SCANNER_URL:'https://synthetic-chest-scanner.test/scan',CONTENT_SCANNER_TOKEN:'synthetic-chest-1'},edge:async r=>{if(r.url==='https://synthetic-chest-scanner.test/scan'){const b=new Uint8Array(await r.arrayBuffer());return Response.json({checksum:r.headers.get('x-content-sha256'),size:b.length,state:'clean',sensitive:false,engine:'synthetic-chest-1',reason:'Synthetic scanner network edge'})}if(r.url.startsWith(origin+'/cool/convert-to/'))return new Response(await(await r.formData()).get('data').arrayBuffer());if(r.url===origin+'/hosting/discovery')return new Response(`<wopi-discovery><net-zone><app name="writer"><action name="edit" ext="docx" urlsrc="${origin}/browser/cool.html?"/></app></net-zone></wopi-discovery>`,{headers:{'content-type':'application/xml'}})}});
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
  await wopiReviewJourney(h,owner,space,editor,call);
  if(browserProof)await collaboraRestoreJourney(h,owner,staff,file,call);
  console.log('SHARE-005 Collabora WOPI public doors: stable file, staff/verified guest attribution, original reads, atomic locks, immutable saves, identical retries, re-verification/revocation refusal and restart passed (editor network edge only)');
 }finally{await h.close()}
}

async function wopiReviewJourney(h,owner,space,editor,call){
 await h.api('/content-security/policy',owner,{enabled:false,sensitiveGroups:[],confirm:true});
 const roles={};for(const role of ['viewer','commenter','editor']){await h.api('/people',owner,{action:'invite',email:`review-${role}@example.test`,name:`review-${role}@example.test`});roles[role]=await h.signIn(`review-${role}@example.test`,true)}
 const file=await h.api('/items',owner,{space,name:'Review agreement.docx',base64:Buffer.from(docx()).toString('base64')});
 for(const role of Object.keys(roles))await h.api(`/items/${file.id}/shares`,owner,{principal:`review-${role}@example.test`,role});
 const sessions={};for(const role of Object.keys(roles))sessions[role]=await editor(`/api/chest/items/${file.id}/collabora`,roles[role]);
 const viewer=await(await call(sessions.viewer)).json(),commenter=await(await call(sessions.commenter)).json();assert.equal(viewer.ReadOnly,true);assert.equal(viewer.UserCanWrite,false);assert.equal(commenter.ReadOnly,false);assert.equal(commenter.DisableChangeTrackingRecord,false);assert.equal(commenter.HideChangeTrackingControls,true);
 const lock='synthetic-chest-3',save=(role,bytes)=>call(sessions[role],'POST','/contents',{'X-WOPI-Lock':lock},bytes),snapshot=async()=>(await h.api(`/items/${file.id}`,owner)).versions;
 assert.equal((await save('viewer',docx())).status,403);assert.equal((await call(sessions.commenter,'POST','',{'X-WOPI-Override':'LOCK','X-WOPI-Lock':lock})).status,200);
 const tracked=(author,text='Suggested payment terms.')=>{const parts=unzipSync(docx()),xml=strFromU8(parts['word/document.xml']);parts['word/document.xml']=strToU8(xml.replace('<w:sectPr/>',`<w:p><w:ins w:id="11" w:author="${author}" w:date="2026-10-25T00:00:00Z"><w:r><w:t>${text}</w:t></w:r></w:ins></w:p><w:sectPr/>`));return zipSync(parts)};
 // A new empty paragraph is still a direct edit; put the tracked run inside an existing paragraph.
 const proposal=(author,text)=>{const parts=unzipSync(docx());parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Payment within thirty days.</w:t></w:r></w:p>',`Payment within thirty days.</w:t></w:r><w:ins w:id="11" w:author="${author}" w:date="2026-10-25T00:00:00Z"><w:r><w:t>${text}</w:t></w:r></w:ins></w:p>`));return zipSync(parts)};
 let before=await snapshot();const direct=await save('commenter',changedReview('Direct content edit'));assert.equal(direct.status,403);assert.equal((await direct.json()).error,'suggest_only');assert.deepEqual(await snapshot(),before);
 const forged=await save('commenter',proposal('review-editor@example.test','Forged'));assert.equal(forged.status,403);assert.equal((await forged.json()).error,'author_mismatch');assert.deepEqual(await snapshot(),before);
 const directStructure=await save('commenter',tracked('review-commenter@example.test'));assert.equal(directStructure.status,403);assert.equal((await directStructure.json()).error,'suggest_only');assert.deepEqual(await snapshot(),before);
 const suggested=proposal('review-commenter@example.test',' First suggestion.');assert.equal((await save('commenter',suggested)).status,200);let versions=await snapshot();assert.equal(versions.length,2);assert.equal(versions[0].actor,'review-commenter@example.test');assert.equal(versions[0].suggestion.author,'review-commenter@example.test');
 const decide=(bytes,accept)=>{const parts=unzipSync(bytes);parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace(/<w:ins\b[^>]*>([\s\S]*?)<\/w:ins>/g,accept?'$1':''));return zipSync(parts)};
 before=await snapshot();assert.equal((await save('commenter',decide(suggested,true))).status,403);assert.deepEqual(await snapshot(),before);
 assert.equal((await save('editor',decide(suggested,true))).status,200);versions=await snapshot();assert.equal(versions[0].actor,'review-editor@example.test');assert.equal(versions[0].suggestion.decision,'accept');assert.equal(versions[0].suggestion.author,'review-commenter@example.test');
 const secondParts=unzipSync(decide(suggested,true));secondParts['word/document.xml']=strToU8(strFromU8(secondParts['word/document.xml']).replace('Payment within thirty days.</w:t></w:r>', 'Payment within thirty days.</w:t></w:r><w:ins w:id="12" w:author="review-commenter@example.test" w:date="2026-10-25T00:00:00Z"><w:r><w:t> Second suggestion.</w:t></w:r></w:ins>'));const second=zipSync(secondParts);assert.equal((await save('commenter',second)).status,200);assert.equal((await save('editor',decide(second,false))).status,200);versions=await snapshot();assert.equal(versions[0].suggestion.decision,'reject');assert.equal(versions[0].actor,'review-editor@example.test');assert.equal(versions.length,5);
 await h.api(`/items/${file.id}/shares`,owner,{principal:'review-commenter@example.test',role:'viewer'});before=await snapshot();assert.equal((await save('commenter',second)).status,403);assert.equal((await(await call(sessions.commenter)).json()).ReadOnly,true);assert.deepEqual(await snapshot(),before);
 await h.api(`/items/${file.id}/settings`,owner,{noDownload:true});assert.equal((await call(sessions.viewer,'GET','/contents')).status,403);assert.equal((await call(sessions.commenter,'GET','/contents')).status,403);
 console.log('ROLE-001 WOPI tracked sessions, direct and forged save refusals, attributed decisions, viewer and live downgrade passed');
}
function changedReview(text){const parts=unzipSync(docx());parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Payment within thirty days.',text));return zipSync(parts)}

// This journey uses genuine CODE keyboard input and its public postMessage decision API.
export async function liveCollaboraReviewJourney(h,owner,browser,{stage}){
 const {expect}=await import('@playwright/test'),{mkdir}=await import('node:fs/promises');await mkdir('test-results',{recursive:true});
 for(const role of ['viewer','editor'])await h.api('/people',owner,{action:'invite',email:`live-review-${role}@example.test`,name:`live-review-${role}@example.test`});
 const viewer=await h.signIn('live-review-viewer@example.test',true),contributor=await h.signIn('live-review-editor@example.test',true),space=(await h.api('/files',owner)).personal;
 const post=(path,data,cookie)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(cookie?{cookie}:{})},body:new URLSearchParams(data).toString()});
 for(const width of [1440,390]){
  const file=await h.api('/items',owner,{space,name:`Tracked review ${width}.docx`,base64:Buffer.from(docx()).toString('base64')});
  for(const role of ['viewer','editor'])await h.api(`/items/${file.id}/shares`,owner,{principal:`live-review-${role}@example.test`,role});
  const link=await h.api(`/items/${file.id}/links`,owner,{audience:'guests',guests:['reviewer@outside.test'],role:'commenter'}),base=new URL(link.url).pathname;
  const response=await post(base+'/verify',{email:'reviewer@outside.test'}),challenge=(await response.text()).match(/name="challenge" value="([^"]+)"/)[1],pin=h.mails.at(-1).text.match(/PIN is (\d{6})/)[1],verified=await post(base+'/pin',{email:'reviewer@outside.test',challenge,pin}),guestCookie=verified.headers.getSetCookie()[0].split(';')[0];assert.equal(verified.status,303);
  const contexts=[];
  const open=async(cookie,path)=>{
   const ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true,...(width===390?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'}:{})});contexts.push(ctx);
   await ctx.addCookies(cookie.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const page=await ctx.newPage();await page.goto(h.origin+path);await page.getByRole('button',{name:'Open in Collabora Online',exact:true}).click();
   const token=await page.locator('input[name=access_token]').inputValue();await page.getByRole('button',{name:'Continue to Collabora',exact:true}).click();await page.getByRole('status').filter({hasText:'Editor connected'}).waitFor({timeout:60000});
   const frame=page.frameLocator('iframe[name=chest-collabora]');await frame.locator('#document-container').waitFor();const welcome=frame.locator('.iframe-welcome-wrap');if(await welcome.isVisible()){await page.keyboard.press('Escape');if(await welcome.isVisible()){const box=await frame.locator('.iframe-welcome-content').boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width-28,box.y+26)}await welcome.waitFor({state:'hidden'})}
   const mobileEdit=frame.locator('#mobile-edit-button');if(await mobileEdit.isVisible())await mobileEdit.click();
   return{ctx,page,frame,token};
  };
  const raw=(session,method='GET',suffix='',headers={},body)=>h.fetch(`/wopi/files/${file.id}${suffix}?access_token=${session.token}`,{method,headers,body});
  const currentBytes=async()=>{const view=await h.api(`/items/${file.id}`,owner);return new Uint8Array(await(await h.raw(`/api/chest/items/${file.id}/bytes/${view.item.current}?download=true`,owner)).arrayBuffer())};
  const type=async(session,text)=>{await session.frame.locator('#document-container').click({position:{x:Math.min(250,width-50),y:200}});await session.page.keyboard.press('Control+Home');await session.page.keyboard.type(text);await session.page.keyboard.press('Control+s')};
  try{
   let guest=await open(guestCookie,base+'/guest/'+file.id);const info=await(await raw(guest)).json();assert.equal(info.DisableChangeTrackingRecord,false);assert.equal(info.HideChangeTrackingControls,true);assert.equal(info.UserFriendlyName,'reviewer@outside.test');
   await type(guest,`Guest tracked proposal ${width}. `);
   try{await expect.poll(async()=>{const view=await h.api(`/items/${file.id}`,owner);return view.versions.some(v=>v.actor==='reviewer@outside.test'&&v.suggestion&&!v.suggestion.decision)},{timeout:60000,intervals:[1000]}).toBe(true)}catch(error){const audit=await h.api(`/audit?paginate=true&action=office.collabora.refused&object=${file.id}`,owner);console.error('WOPI_REVIEW_REFUSALS',JSON.stringify(audit.rows.map(r=>JSON.parse(r.detail))));throw error}
   let content=await currentBytes(),parts=unzipSync(content),xml=strFromU8(parts['word/document.xml']);assert.match(xml,/<w:ins[^>]*w:author="reviewer@outside.test"/);assert.ok(xml.includes(`Guest tracked proposal ${width}`));
   await guest.page.screenshot({path:`test-results/${width}-collabora-live-suggest.png`,fullPage:true});
   const lock=(await raw(guest,'POST','',{'X-WOPI-Override':'GET_LOCK'})).headers.get('X-WOPI-Lock'),before=(await h.api(`/items/${file.id}`,owner)).versions;
   assert.ok(xml.includes('Payment within thirty days.'));parts['word/document.xml']=strToU8(xml.replace('Payment within thirty days.','Refused direct edit.'));let refusal=await raw(guest,'POST','/contents',{'X-WOPI-Lock':lock},zipSync(parts));assert.equal(refusal.status,403);assert.equal((await refusal.json()).error,'suggest_only');
   parts['word/document.xml']=strToU8(xml.replace('w:author="reviewer@outside.test"','w:author="live-review-editor@example.test"'));refusal=await raw(guest,'POST','/contents',{'X-WOPI-Lock':lock},zipSync(parts));assert.equal(refusal.status,403);assert.equal((await refusal.json()).error,'author_mismatch');assert.deepEqual((await h.api(`/items/${file.id}`,owner)).versions,before);
   await guest.ctx.close();
   let editor=await open(contributor,'/app/items/'+file.id);await editor.page.getByText('Review suggestions',{exact:true}).click();await editor.page.getByRole('button',{name:'Accept suggestion',exact:true}).click();
   await expect.poll(async()=>{const v=(await h.api(`/items/${file.id}`,owner)).versions[0];return[v.actor,v.suggestion?.author,v.suggestion?.decision]},{timeout:60000,intervals:[1000]}).toEqual(['live-review-editor@example.test','reviewer@outside.test','accept']);
   await editor.page.screenshot({path:`test-results/${width}-collabora-live-accepted.png`,fullPage:true});await editor.ctx.close();
   guest=await open(guestCookie,base+'/guest/'+file.id);await type(guest,`Rejected proposal ${width}. `);
   await expect.poll(async()=>{const v=(await h.api(`/items/${file.id}`,owner)).versions[0];return v.actor==='reviewer@outside.test'&&!v.suggestion?.decision},{timeout:60000,intervals:[1000]}).toBe(true);await guest.ctx.close();
   editor=await open(contributor,'/app/items/'+file.id);await editor.page.getByText('Review suggestions',{exact:true}).click();await editor.page.getByRole('button',{name:'Reject suggestion',exact:true}).click();
   await expect.poll(async()=>{const v=(await h.api(`/items/${file.id}`,owner)).versions[0];return[v.actor,v.suggestion?.author,v.suggestion?.decision]},{timeout:60000,intervals:[1000]}).toEqual(['live-review-editor@example.test','reviewer@outside.test','reject']);await editor.page.screenshot({path:`test-results/${width}-collabora-live-rejected.png`,fullPage:true});await editor.ctx.close();
   const read=await open(viewer,'/app/items/'+file.id),readonly=await(await raw(read)).json();assert.equal(readonly.ReadOnly,true);assert.equal(readonly.UserCanWrite,false);assert.equal(await read.page.locator('[data-review-decision]').count(),0);const versions=(await h.api(`/items/${file.id}`,owner)).versions;assert.equal((await raw(read,'POST','/contents',{'X-WOPI-Lock':lock},content)).status,403);assert.deepEqual((await h.api(`/items/${file.id}`,owner)).versions,versions);await read.page.screenshot({path:`test-results/${width}-collabora-live-viewer.png`,fullPage:true});
   content=await currentBytes();xml=strFromU8(unzipSync(content)['word/document.xml']);assert.ok(xml.includes(`Guest tracked proposal ${width}`));assert.ok(!xml.includes(`Rejected proposal ${width}`));
   stage(width+' real tracked guest typing, direct and author refusals, attributed accept and reject, readonly viewer passed');
  }finally{for(const ctx of contexts)await ctx.close()}
 }
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
