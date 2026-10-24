import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),b64=x=>Buffer.from(x).toString('base64');
const post=(path,data,cookie)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(cookie?{cookie}:{})},body:new URLSearchParams(data).toString()});
try {
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL),space=(await h.api('/files',owner)).personal;
 const folder=await h.api('/items',owner,{space,type:'folder',name:'Acme delivery'}),file=await h.api('/items',owner,{parent:folder.id,name:'Payment terms.txt',base64:b64('Thirty days after delivery.')}),hidden=await h.api('/items',owner,{parent:folder.id,name:'Private forecast.txt',base64:b64('Private forecast')});
 await h.api(`/items/${hidden.id}/settings`,owner,{restricted:true});
 await h.api('/people',owner,{action:'invite',email:'colleague@example.test',name:'Jordan Lee'});const colleague=await h.signIn('colleague@example.test',true);await h.api(`/items/${folder.id}/shares`,owner,{principal:'colleague@example.test',role:'editor'});
 for(const audience of [{audience:'guests',guests:['vendor@acme.test']},{audience:'domain',domain:'acme.test'}]){
  const link=await h.api(`/items/${folder.id}/links`,owner,{...audience,role:'viewer',password:'delivery-secret',limit:2});const path=new URL(link.url).pathname;
  assert.match(await (await h.fetch(path)).text(),/Verify your email/);assert.doesNotMatch(await (await h.fetch(path+'/f/'+file.id)).text(),/Thirty days/);
  const before=h.mails.length;await post(path+'/verify',{email:'outsider@other.test'});assert.equal(h.mails.length,before,'wrong email receives no challenge');
  await post(path+'/verify',{email:'vendor@acme.test'});const message=h.mails.at(-1),verify=new URL(message.text.match(/https?:\/\/[^\s]+/)[0]);assert.equal(message.to[0],'vendor@acme.test');
  assert.match(await (await h.fetch(verify.pathname+verify.search)).text(),/Confirm your email/);
  if(audience.audience==='domain')await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.at',CAST(? AS INTEGER)) WHERE id=?",new Date(Date.now()-40*86400000).toISOString(),link.link.id);
  const confirmed=await post(path+'/confirm',{token:verify.searchParams.get('token')}),cookie=confirmed.headers.getSetCookie()[0].split(';')[0];assert.equal(confirmed.status,303);if(audience.audience==='domain')assert.ok(Number(confirmed.headers.getSetCookie()[0].match(/Max-Age=(\d+)/)[1])<=43200,'domain sessions keep their 12-hour lifetime even for old grants');
  const replay=await post(path+'/confirm',{token:verify.searchParams.get('token')});assert.equal(replay.status,403,'single use: '+await replay.text());
  assert.match(await (await h.fetch(path,{headers:{cookie}})).text(),/Enter the password/);
  const unlock=await post(path,{password:'delivery-secret'},cookie),both=cookie+'; '+unlock.headers.getSetCookie()[0].split(';')[0];
  const page=await (await h.fetch(path,{headers:{cookie:both}})).text();assert.match(page,/Payment terms/);assert.doesNotMatch(page,/Private forecast/);
  const colleagueActivity=(await h.api(`/items/${folder.id}`,colleague)).activity;assert.ok(colleagueActivity.some(a=>a.action==='link.view'));assert.ok(!colleagueActivity.some(a=>a.actor==='vendor@acme.test'),'non-manager activity hides guest identities');
  assert.equal((await h.fetch(path+'/f/'+hidden.id,{headers:{cookie:both}})).status,404);
  assert.equal(await (await h.fetch(path+'/f/'+file.id,{headers:{cookie:both}})).text(),'Thirty days after delivery.');
  await h.api(`/public-links/${link.link.id}/revoke`,owner,{});assert.equal((await h.fetch(path+'/f/'+file.id,{headers:{cookie:both}})).status,410);
 }
 const publicLink=await h.api(`/items/${file.id}/links`,owner,{audience:'public',password:'synthetic-chest-60'}),pb=new URL(publicLink.url).pathname,admission=await post(pb,{password:'synthetic-chest-60'}),unlock=admission.headers.getSetCookie()[0].split(';')[0];assert.equal((await h.fetch(pb+'/f/'+file.id,{headers:{cookie:unlock}})).status,200);
 assert.equal((await post(pb+'/sign-out',{},unlock)).status,303);assert.equal((await h.fetch(pb+'/f/'+file.id,{headers:{cookie:unlock}})).status,401,'sign-out revokes password admission even when the cookie is replayed');
 const again=await post(pb,{password:'synthetic-chest-60'}),againCookie=again.headers.getSetCookie()[0].split(';')[0];await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.at',CAST(? AS INTEGER)) WHERE kind='member-link-session' AND json_extract(payload,'$.link')=?",Date.now()-13*3600000,publicLink.link.id);assert.equal((await h.fetch(pb+'/f/'+file.id,{headers:{cookie:againCookie}})).status,401,'password admission cannot exceed twelve hours');
 const policy={enabled:false,groups:[],graceDays:0,resistantAdmins:false,sessionHours:1,idleMinutes:60,requireIdpMfa:false};await h.api('/security/policy',owner,policy);const shorter=await post(pb,{password:'synthetic-chest-60'}),shortCookie=shorter.headers.getSetCookie()[0].split(';')[0];assert.ok(Number(shorter.headers.getSetCookie()[0].match(/Max-Age=(\d+)/)[1])<=3600);await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.at',CAST(? AS INTEGER)) WHERE kind='member-link-session' AND json_extract(payload,'$.link')=?",Date.now()-2*3600000,publicLink.link.id);assert.equal((await h.fetch(pb+'/f/'+file.id,{headers:{cookie:shortCookie}})).status,401,'ADMIN-004 shortens password admission');await h.api('/security/policy',owner,{...policy,sessionHours:24});
 const active=await h.api(`/items/${file.id}/links`,owner,{audience:'domain',domain:'acme.test'});
 await h.api('/link-policy',owner,{scope:'organisation',allowExternal:false,allowPublic:false,allowOrganisation:true,allowDiscovery:true,defaultAudience:'organisation',defaultRole:'viewer'});
 assert.equal((await h.fetch(new URL(active.url).pathname)).status,410,'policy change stops existing external audiences');
 console.log('SHARE-001 named guests/domain verification, one-time mail, scoped cookies, password, restricted descendants, revoke and policy passed');
}finally{await h.close()}

// SHARE-005: guest write authority and history are independent of staff sessions.
await (await import('./guest-editing-flow.mjs')).guestEditingFlow();
