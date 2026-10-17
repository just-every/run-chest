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
 await h.api(`/items/${file.id}/links`,people.ana,{audience:'organisation',discoverable:true},403);
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
 assert.equal((await h.api(`/items/${file.id}/links`,people.ana,{})).link.audience,'organisation');
 const benArea=(await h.api('/files',people.ben)).personal,benFile=await h.api('/items',people.ben,{space:benArea,type:'file',name:'Private notes.txt',base64:b64('Internal meeting notes')});
 assert.equal((await h.api(`/items/${benFile.id}/links`,people.ben,{})).link.audience,'restricted');

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
