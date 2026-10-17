// Ownership consent through the built Worker's HTTP doors; only the external mail provider is faked.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),people={},areas={},b64=value=>Buffer.from(value).toString('base64');
const check=async(name,fn)=>{await fn();console.log(`${name} passed`)};
const make=(name,input={})=>h.api('/items',people.ana,{space:areas.ana,name,type:'file',base64:b64(name),...input});
const offer=(item,extra={})=>h.api(`/items/${item}/ownership`,people.ana,{recipient:'ben@example.test',...extra});
const decide=(id,who,decision='accept',extra={},status=200)=>h.api(`/ownership/${id}`,people[who],{decision,...extra},status);
const get=(id,who='ana',status=200)=>h.api(`/items/${id}`,people[who],undefined,status);
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);people.owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:people.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 for(const person of ['ana','ben','cy']){await h.api('/people',people.owner,{action:'invite',email:`${person}@example.test`,name:person});people[person]=await h.signIn(`${person}@example.test`,true);areas[person]=(await h.api('/files',people[person])).personal}
 await check('SPACE-001 ownership consent and preserved tree',async()=>{
  const folder=await make('Handover',{type:'folder'}),nested=await make('Private',{parent:folder.id,type:'folder'}),file=await make('contract.txt',{parent:nested.id});
  await h.api(`/items/${nested.id}/settings`,people.ana,{restricted:true});
  await h.api(`/items/${file.id}/shares`,people.ana,{principal:'cy@example.test',role:'viewer'});
  await h.api(`/items/${file.id}/versions`,people.ana,{base64:b64('second contract'),filename:'contract.txt'});
  const before=await get(file.id),link=await h.api(`/items/${file.id}/links`,people.ana,{role:'viewer'}),request=await offer(folder.id);
  assert.equal((await get(folder.id)).role,'owner');await get(folder.id,'ben',403);
  assert.ok((await h.api('/ownership',people.ben)).some(r=>r.id===request.id&&r.canAccept));
  assert.ok((await h.api('/notices',people.ben)).some(r=>r.payload.type==='ownership.request'&&r.payload.request===request.id&&r.payload.email.startsWith('accepted')));
  assert.ok(h.mails.some(m=>[m.to].flat().includes('ben@example.test')&&m.text.includes(`/app/ownership/${request.id}`)));
  await h.api(`/ownership/${request.id}`,people.cy,undefined,404);await decide(request.id,'ana','accept',{},403);
  const csrf=await h.fetch(`/api/chest/ownership/${request.id}`,{method:'POST',headers:{cookie:people.ben,'content-type':'application/json'},body:JSON.stringify({decision:'accept'})});assert.equal(csrf.status,403);
  await decide(request.id,'ben');await decide(request.id,'ben','accept',{},409);
  const after=await get(file.id,'ben'),moved=await get(folder.id,'ben');
  assert.equal(moved.item.space,areas.ben);assert.equal(moved.item.parent,null);assert.equal(moved.role,'owner');
  assert.equal(after.id,before.id);assert.deepEqual(after.versions,before.versions);assert.equal(after.item.current,before.item.current);
  assert.equal((await get(folder.id)).role,'editor');assert.equal((await get(nested.id)).role,'editor');assert.equal((await get(file.id)).role,'editor');assert.equal((await get(file.id,'cy')).role,'viewer');
  const opened=await h.api('/links/open',people.cy,{token:link.url.split('/s/')[1]});assert.equal(opened.item,file.id);
  const bytes=await h.raw(`/api/chest/items/${file.id}/bytes/${after.item.current}?download=true`,people.ben);assert.equal(bytes.status,200);assert.equal(await bytes.text(),'second contract');
  const audit=(await h.api('/audit',people.owner)).filter(r=>r.object_id===folder.id);assert.equal(audit.filter(r=>r.action==='ownership.offer').length,1);assert.equal(audit.filter(r=>r.action==='ownership.accept').length,1);
 });
 await check('SPACE-001 declined, cancelled and stale ownership',async()=>{
  const file=await make('Keep mine.txt'),request=await offer(file.id);await decide(request.id,'ben','decline');assert.equal((await get(file.id)).role,'owner');await get(file.id,'ben',403);
  const cancelled=await offer(file.id);await h.api(`/ownership/${cancelled.id}/cancel`,people.ana,{});await decide(cancelled.id,'ben','accept',{},409);
  const edited=await offer(file.id);await h.api(`/items/${file.id}/rename`,people.ana,{name:'Updated.txt'});await decide(edited.id,'ben','accept',{},409);assert.equal((await get(file.id)).item.space,areas.ana);await h.api(`/ownership/${edited.id}/cancel`,people.ana,{});
  const team=await h.api('/spaces',people.ana,{name:'Team'}),teamFile=await make('Team file.txt',{space:team.id});await h.api(`/items/${teamFile.id}/ownership`,people.ana,{recipient:'ben@example.test'},403);
  const inactive=await offer(file.id);await h.api('/people',people.owner,{action:'deactivate',email:'ben@example.test'});await h.api('/people',people.owner,{action:'reactivate',email:'ben@example.test'});people.ben=await h.signIn('ben@example.test');await decide(inactive.id,'ben','accept',{},409);
  assert.equal((await get(file.id)).role,'owner');await h.api(`/ownership/${inactive.id}/cancel`,people.ana,{});
  await h.api('/people',people.owner,{action:'deactivate',email:'cy@example.test'});await h.api(`/items/${file.id}/ownership`,people.ana,{recipient:'cy@example.test'},409);
  const audit=await h.api('/audit',people.owner);assert.ok(audit.some(r=>r.action==='ownership.decline'&&r.object_id===file.id));assert.ok(audit.some(r=>r.action==='ownership.cancel'&&r.object_id===file.id));
 });
 await check('SPACE-001 collision, concurrent acceptance and relinquishment',async()=>{
  const file=await make('Clash.txt');await h.api('/items',people.ben,{space:areas.ben,name:'Clash.txt',type:'file',base64:b64('unrelated')});
  const publicLink=await h.api(`/items/${file.id}/public-links`,people.ana,{});
  const request=await offer(file.id,{retainEditor:false});await decide(request.id,'ben','accept',{},409);assert.equal((await get(file.id)).role,'owner');
  const responses=await Promise.all([1,2].map(()=>h.raw(`/api/chest/ownership/${request.id}`,people.ben,{decision:'accept',name:'Transferred.txt'})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);await get(file.id,'ana',403);assert.equal((await get(file.id,'ben')).item.name,'Transferred.txt');
  const accepted=(await h.api('/audit',people.owner)).filter(r=>r.action==='ownership.accept'&&r.object_id===file.id);assert.equal(accepted.length,1);
  assert.equal((await h.fetch(new URL(publicLink.url).pathname+'/f/'+file.id)).status,200,'the link survives the sender relinquishing direct access');
  const folder=await make('Incoming after handover',{type:'folder'}),intake=await h.api(`/items/${folder.id}/file-requests`,people.ana,{title:'Vendor files'}),handoff=await offer(folder.id,{retainEditor:false});await decide(handoff.id,'ben');
  assert.equal((await h.fetch(new URL(intake.url).pathname)).status,200,'the upload-only link survives the handoff');
  const form=new FormData();form.append('files',new File(['delivery schedule'],'schedule.txt'));
  const received=await h.fetch(new URL(intake.url).pathname,{method:'POST',headers:{origin:h.origin},body:form});assert.equal(received.status,200);
  assert.ok((await h.api('/notices',people.ben)).some(n=>n.payload.type==='file-request.upload'),'arrivals notify the new responsible owner');
 });
}finally{await h.close()}
