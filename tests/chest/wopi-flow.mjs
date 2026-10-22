import assert from 'node:assert/strict';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
export async function wopiFlow(){
 const origin='https://synthetic-chest-editor.test',h=await harness({bindings:{COLLABORA_URL:origin,CONTENT_SCANNER_URL:'https://synthetic-chest-scanner.test/scan',CONTENT_SCANNER_TOKEN:'synthetic-chest-1'},edge:async r=>{if(r.url==='https://synthetic-chest-scanner.test/scan'){const b=new Uint8Array(await r.arrayBuffer());return Response.json({checksum:r.headers.get('x-content-sha256'),size:b.length,state:'clean',sensitive:false,engine:'synthetic-chest-1',reason:'Synthetic scanner network edge'})}if(r.url===origin+'/hosting/discovery')return new Response(`<wopi-discovery><net-zone><app name="writer"><action name="edit" ext="docx" urlsrc="${origin}/browser/cool.html?"/></app></net-zone></wopi-discovery>`,{headers:{'content-type':'application/xml'}})}});
 const post=(path,input,cookie)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(cookie?{cookie}:{})},body:new URLSearchParams(input).toString()});
 const editor=async(path,cookie)=>{const response=await h.raw(path,cookie,{});assert.equal(response.status,200,await response.clone().text());const html=await response.text(),token=html.match(/name="access_token" value="([^"]+)"/)[1],wopi=new URL(html.match(/action="([^"]+)"/)[1].replaceAll('&amp;','&')).searchParams.get('WOPISrc');assert.ok(wopi);return {token,path:new URL(wopi).pathname}};
 const call=(e,method='GET',sub='',headers={},body)=>h.fetch(e.path+sub+'?access_token='+e.token,{method,headers,body});
 const changed=text=>{const parts=unzipSync(docx());parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Harbor renewal agreement',text));return zipSync(parts)};
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL),space=(await h.api('/files',owner)).personal,file=await h.api('/items',owner,{space,name:'Agreement.docx',base64:Buffer.from(docx()).toString('base64')});
  const staff=await editor(`/api/chest/items/${file.id}/collabora`,owner),info=await(await call(staff)).json();assert.equal(info.UserCanWrite,true);assert.equal(info.BaseFileName,'Agreement.docx');assert.equal(info.Version,file.payload.current);
  const link=await h.api(`/items/${file.id}/links`,owner,{audience:'guests',guests:['writer@outside.test'],role:'editor'}),base=new URL(link.url).pathname,challenge=await post(base+'/verify',{email:'writer@outside.test'}),id=(await challenge.text()).match(/name="challenge" value="([^"]+)"/)[1],pin=h.mails.at(-1).text.match(/PIN is (\d{6})/)[1],verified=await post(base+'/pin',{email:'writer@outside.test',challenge:id,pin}),cookie=verified.headers.getSetCookie()[0].split(';')[0],launch=await post(base+'/editor/'+file.id,{},cookie);assert.equal(launch.status,200,await launch.clone().text());const html=await launch.text(),guest={token:html.match(/name="access_token" value="([^"]+)"/)[1],path:staff.path};
  assert.equal((await(await call(guest)).json()).UserFriendlyName,'writer@outside.test');assert.equal((await h.fetch(staff.path+'?access_token=synthetic-chest-1')).status,401);
  assert.equal((await call(staff,'POST','contents',{},changed('Refused without a lock'))).status,401); // token is bound to the exact file, including its path
  assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':'synthetic-chest-1'},changed('No lock'))).status,409);
  const lock='synthetic-chest-1';assert.equal((await call(staff,'POST','',{'X-WOPI-Override':'LOCK','X-WOPI-Lock':lock})).status,200);
  assert.equal((await call(guest,'POST','',{'X-WOPI-Override':'LOCK','X-WOPI-Lock':'synthetic-chest-2'})).status,409);
  assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':lock},changed('Staff edit'))).status,200);
  assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Guest edit'))).status,200);
  let view=await h.api(`/items/${file.id}`,owner);assert.equal(view.versions.length,3);assert.equal(view.versions[0].actor,'writer@outside.test');assert.equal(view.versions[1].actor,h.vars.OWNER_EMAIL);assert.equal((await(await call(staff)).json()).Version,view.item.current);
  assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Guest edit'))).status,200);assert.equal((await h.api(`/items/${file.id}`,owner)).versions.length,3,'identical retry invents no version');
  await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:true});assert.equal((await call(staff,'GET','/contents')).status,403,'an already-open editor cannot read an unscanned retained version');assert.equal((await call(staff,'POST','/contents',{'X-WOPI-Lock':lock},changed('Quarantine bypass'))).status,403);await h.api('/content-security/scan',owner,{item:file.id});assert.equal((await call(staff,'GET','/contents')).status,200);
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.verifiedAt',?) WHERE kind='guest-session'",new Date(Date.now()-8*86400000).toISOString());assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Expired verification'))).status,403);
  await h.api(`/public-links/${link.link.id}/revoke`,owner,{});assert.equal((await call(guest,'POST','/contents',{'X-WOPI-Lock':lock},changed('Revoked guest'))).status,403);assert.equal((await h.api(`/items/${file.id}`,owner)).versions.length,3);
  assert.equal((await call(staff,'POST','',{'X-WOPI-Override':'UNLOCK','X-WOPI-Lock':lock})).status,200);
  await h.stop();await h.start();assert.equal((await(await call(staff)).json()).Version,view.item.current);
  console.log('SHARE-005 Collabora WOPI public doors: stable file, staff/verified guest attribution, original reads, atomic locks, immutable saves, identical retries, re-verification/revocation refusal and restart passed (editor network edge only)');
 }finally{await h.close()}
}
