// Link defaults and live suspensions through the built Worker; mail is faked only at its provider edge.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),people={},b64=v=>Buffer.from(v).toString('base64');
const rules={allowPublic:true,allowOrganisation:true,allowDiscovery:true,defaultAudience:'organisation',defaultRole:'viewer'};
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);people.owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:people.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const n of ['ana','ben','cy']){await h.api('/people',people.owner,{action:'invite',email:n+'@example.test',name:n});people[n]=await h.signIn(n+'@example.test',true)}
 const area=(await h.api('/files',people.ana)).personal,file=await h.api('/items',people.ana,{space:area,type:'file',name:'Partner terms.txt',base64:b64('Contract scope and delivery terms')});
 const pub=await h.api(`/items/${file.id}/public-links`,people.ana,{}),org=await h.api(`/items/${file.id}/links`,people.ana,{discoverable:true}),open=new URL(pub.url).pathname;
 await h.api('/link-policy',people.ana,{scope:'organisation',...rules},403);
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules,allowPublic:false,allowDiscovery:false,defaultAudience:'restricted'});
 assert.equal((await h.api('/link-policy',people.owner)).defaults.defaultAudience,'restricted');
 for(const suffix of ['',`/p/${file.id}`,`/f/${file.id}`])assert.equal((await h.fetch(open+suffix)).status,410);
 await h.api(`/items/${file.id}/public-links`,people.ana,{},403);
 assert.equal((await h.api('/search?q=Partner',people.ben)).count,0);
 const restricted=await h.api(`/items/${file.id}/links`,people.ana,{});assert.equal(restricted.link.audience,'restricted');
 const listed=(await h.api(`/items/${file.id}`,people.ana)).links;assert.ok(listed.some(l=>l.id===restricted.link.id),'restricted links remain visible to their sharer');assert.equal(listed.find(l=>l.id===org.link.id)?.policyBlocked,true,'the item lists its policy-blocked organization link');
 await h.api('/links/open',people.ben,{token:restricted.url.split('/s/')[1]},403);
 await h.api(`/items/${file.id}/shares`,people.ana,{principal:'ben@example.test',role:'viewer'});
 await h.api('/links/open',people.ben,{token:restricted.url.split('/s/')[1]});
 const beforeRefusal=(await h.api(`/items/${file.id}`,people.ana)).links;
 const discoveryRefusal=await h.api(`/items/${file.id}/links`,people.ana,{audience:'organisation',discoverable:true},403);
 assert.equal(discoveryRefusal.error,'link_policy_refused');
 assert.deepEqual((await h.api(`/items/${file.id}`,people.ana)).links,beforeRefusal,'discovery refusal creates no link or changes an older link');
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules,defaultRole:'commenter'});
 const newer=await h.api(`/items/${file.id}/links`,people.ana,{});assert.equal(newer.link.role,'commenter');assert.equal((await h.api(`/items/${file.id}`,people.ana)).links.find(l=>l.id===org.link.id).role,'viewer');
 await h.api('/links/open',people.cy,{token:newer.url.split('/s/')[1]});assert.equal((await h.api(`/items/${file.id}`,people.cy)).role,'commenter');
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules,allowOrganisation:false,defaultAudience:'restricted'});
 await h.api(`/items/${file.id}`,people.cy,undefined,403);assert.equal((await h.api(`/items/${file.id}`,people.ben)).role,'viewer');
 await h.api(`/items/${file.id}/unshare`,people.ana,{principal:'ben@example.test'});await h.api('/links/open',people.ben,{token:restricted.url.split('/s/')[1]},403);await h.api(`/items/${file.id}`,people.ben,undefined,403);
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules});assert.equal((await h.fetch(open)).status,200);
 console.log('POLICY-001 live public/organization suspension, restricted defaults and named grants passed');
 // A creator group and a space each add restrictions; a looser override cannot undo the organization rule.
 const group=await h.api('/groups',people.owner,{name:'Operations',members:['ana@example.test']});
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules,defaultAudience:'restricted'});
 await h.api('/link-policy',people.owner,{scope:`group:${group.id}`,...rules});
 const groupFile=await h.api('/items',people.ana,{space:area,type:'file',name:'Group defaults.txt',base64:b64('synthetic-chest-group-original')});
 const groupLink=await h.api(`/items/${groupFile.id}/links`,people.ana,{});
 assert.equal(groupLink.link.audience,'organisation');assert.equal(groupLink.link.role,'viewer');
 const benArea=(await h.api('/files',people.ben)).personal,benFile=await h.api('/items',people.ben,{space:benArea,type:'file',name:'Private notes.txt',base64:b64('Internal meeting notes')});
 const nonMemberLink=await h.api(`/items/${benFile.id}/links`,people.ben,{});
 assert.equal(nonMemberLink.link.audience,'restricted');assert.equal(nonMemberLink.link.role,'viewer');
 const originals=[{item:groupFile,creator:people.ana,reader:people.cy,link:groupLink,bytes:'synthetic-chest-group-original'},{item:benFile,creator:people.ben,reader:people.ben,link:nonMemberLink,bytes:'Internal meeting notes'}];
 const saved=[];
 for(const proof of originals){
  await h.api('/links/open',proof.reader,{token:new URL(proof.link.url).pathname.split('/s/')[1]});
  const download=await h.raw(`/api/chest/items/${proof.item.id}/bytes/${proof.item.payload.current}?download=true`,proof.reader);
  assert.equal(download.status,200);assert.equal(await download.text(),proof.bytes);
  saved.push((await h.api(`/items/${proof.item.id}`,proof.creator)).links.find(l=>l.id===proof.link.link.id));
 }
 // Change defaults alone: older capabilities must keep their original audience and role.
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules,defaultRole:'commenter'});
 await h.api('/link-policy',people.owner,{scope:`group:${group.id}`,...rules,defaultAudience:'restricted',defaultRole:'commenter'});
 const laterGroup=await h.api(`/items/${groupFile.id}/links`,people.ana,{}),laterNonMember=await h.api(`/items/${benFile.id}/links`,people.ben,{});
 assert.equal(laterGroup.link.audience,'restricted');assert.equal(laterGroup.link.role,'commenter');
 assert.equal(laterNonMember.link.audience,'organisation');assert.equal(laterNonMember.link.role,'commenter');
 await h.stop();await h.start();
 for(const [i,proof] of originals.entries()){
  assert.deepEqual((await h.api(`/items/${proof.item.id}`,proof.creator)).links.find(l=>l.id===proof.link.link.id),saved[i]);
  await h.api('/links/open',proof.reader,{token:new URL(proof.link.url).pathname.split('/s/')[1]});
  const download=await h.raw(`/api/chest/items/${proof.item.id}/bytes/${proof.item.payload.current}?download=true`,proof.reader);
  assert.equal(download.status,200);assert.equal(await download.text(),proof.bytes);
 }
 assert.equal((await h.api(`/items/${groupFile.id}`,people.cy)).role,'viewer','a later commenter default does not widen the older viewer link');
 // Remove only the new organization link so it cannot hide a widened old restricted audience.
 await h.api(`/links/${laterNonMember.link.id}`,people.ben,{remove:true});
 await h.api('/links/open',people.cy,{token:new URL(nonMemberLink.url).pathname.split('/s/')[1]},403);
 await h.api(`/items/${benFile.id}`,people.cy,undefined,403);
 console.log('PROBE POLICY-002 1: API group and non-member defaults, later defaults and restart -> saved audiences, roles, tokens and exact original downloads preserved');
 console.log('PROBE POLICY-002 2: discoverable link with discovery disabled -> link_policy_refused and unchanged link list');

 await h.api('/link-policy',people.owner,{scope:`group:${group.id}`,...rules,allowPublic:false,defaultAudience:'restricted'});
 await h.api(`/items/${file.id}/public-links`,people.ana,{},403);
 const space=await h.api('/spaces',people.ana,{name:'Client delivery'}),team=await h.api('/items',people.ana,{space:space.id,type:'file',name:'Dispatch.txt',base64:b64('Dispatch manifests')});
 await h.api('/link-policy',people.owner,{scope:`group:${group.id}`,remove:true});
 await h.api('/link-policy',people.owner,{scope:`space:${space.id}`,...rules,allowPublic:false,defaultAudience:'restricted'});
 await h.api(`/items/${team.id}/public-links`,people.ana,{},403);await h.api(`/items/${file.id}/public-links`,people.ana,{});
 await h.api('/link-policy',people.owner,{scope:'organisation',...rules,allowPublic:false,defaultAudience:'restricted'});
 await h.api('/link-policy',people.owner,{scope:`space:${space.id}`,...rules});await h.api(`/items/${team.id}/public-links`,people.ana,{},403);
 const audit=(await h.api('/audit',people.owner)).filter(r=>r.action==='policy.links');assert.ok(audit.length>=8);assert.ok(audit.every(r=>Object.hasOwn(JSON.parse(r.detail),'before')&&Object.hasOwn(JSON.parse(r.detail),'after')));
 console.log('POLICY-001 creator-group/space restrictions, override removal and audit passed');
}finally{await h.close()}
