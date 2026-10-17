// Everyday files through the public HTTP doors of the built Worker: team spaces, self-service trash, version history,
// item sharing with access requests and expiry, and the sync protocol a desktop client speaks with its device key.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {harness} from './harness.mjs';
const h=await harness(),b64=v=>Buffer.from(v).toString('base64'),sha=v=>createHash('sha256').update(v).digest('hex'),day=86_400_000;
const check=async(id,fn)=>{await fn();console.log(`${id} passed`)};
const people={};let space,personalOf={};
// The staff of one business: Ana (content manager), Ben (viewer), Cy (contributor), Mo (space manager), Dee and Eve
// (colleagues outside the space) and Fay (who leaves).
async function staff(){
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);people.owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:people.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 for(const name of ['ana','ben','cy','mo','dee','eve','fay']){await h.api('/people',people.owner,{action:'invite',email:`${name}@example.test`,name:name[0].toUpperCase()+name.slice(1)});people[name]=await h.signIn(`${name}@example.test`,true);personalOf[name]=(await h.api('/files',people[name])).personal}
}
const mail=(to,pattern)=>h.mails.filter(m=>[m.to].flat().includes(to)&&pattern.test(m.text));
const upload=(who,input)=>h.api('/items',who,{type:'file',...input});
const bytesOf=async(who,item,version,status=200,query='?download=true')=>{const r=await h.raw(`/api/chest/items/${item}/bytes/${version}${query}`,people[who]);assert.equal(r.status,status,`${who} bytes ${r.status}`);return status===200?Buffer.from(await r.arrayBuffer()):r.json()};
const audit=async action=>(await h.api('/audit',people.owner)).filter(e=>e.action===action);
try{
 await staff();
 await check('SPACE-001',async()=>{
  space=await h.api('/spaces',people.mo,{name:'Projects'});
  await h.api(`/spaces/${space.id}/members`,people.ana,{members:[]},403);
  await h.api(`/spaces/${space.id}/members`,people.mo,{members:[{principal:'mo@example.test',role:'manager'},{principal:'ana@example.test',role:'content_manager'},{principal:'ben@example.test',role:'viewer'},{principal:'cy@example.test',role:'contributor'}]});
  const client=await h.api('/items',people.ana,{space:space.id,type:'folder',name:'Client A'}),contracts=await h.api('/items',people.ana,{parent:client.id,type:'folder',name:'Contracts'});
  // Ordinary files need no document type, reviewer or approval.
  const terms=await upload(people.ana,{parent:contracts.id,name:'terms.txt',base64:b64('Payment terms net 30'),checksum:sha('Payment terms net 30')});
  assert.equal((await h.raw('/api/chest/items',people.ana,{parent:contracts.id,type:'file',name:'TERMS.txt',base64:b64('x')})).status,409,'case-insensitive names are unique in a folder');
  await h.api('/items',people.ben,{parent:contracts.id,type:'folder',name:'Mine'},403);
  const listing=await h.api(`/items/${client.id}`,people.ben);assert.deepEqual(listing.children.map(c=>c.name),['Contracts']);assert.equal(listing.can.download,true);assert.equal(listing.can.contribute,false);
  // A restricted subfolder keeps out inherited members except managers.
  const hr=await h.api('/items',people.mo,{space:space.id,type:'folder',name:'HR'});await upload(people.mo,{parent:hr.id,name:'salaries.txt',base64:b64('confidential salaries')});
  await h.api(`/items/${hr.id}/settings`,people.ana,{restricted:true},403);await h.api(`/items/${hr.id}/settings`,people.mo,{restricted:true});
  await h.api(`/items/${hr.id}`,people.ana,undefined,403);assert.equal((await h.api('/search?q=salaries',people.ana)).count,0);assert.equal((await h.api('/search?q=salaries',people.mo)).count,1);
  assert.equal((await h.api('/search?q=net%2030',people.ben)).results[0].id,terms.id);assert.equal((await h.api('/search?q=net%2030',people.dee)).count,0);
  // Moves need manage rights at the source; the stable ID and versions survive and access follows the destination.
  await h.api(`/items/${terms.id}/move`,people.cy,{parent:client.id},403);
  const moved=await h.api(`/items/${terms.id}/move`,people.ana,{parent:client.id});assert.equal(moved.id,terms.id);assert.deepEqual(moved.payload.versions,terms.payload.versions);
  await h.api(`/items/${terms.id}/move`,people.ana,{parent:hr.id},403);await h.api(`/items/${terms.id}/move`,people.ana,{parent:contracts.id});
  const copied=await h.api(`/items/${terms.id}/copy`,people.ana,{parent:client.id});assert.notEqual(copied.id,terms.id);assert.equal(copied.payload.versions[0].checksum,terms.payload.versions[0].checksum);assert.equal(copied.payload.versions[0].arrival,'copy');
  space.client=client.id;space.contracts=contracts.id;space.terms=terms.id;space.hr=hr.id;
 });
 await check('CHEST-13',async()=>{
  const tree=async who=>{const c=await h.api(`/items/${space.client}`,people[who]),inner=await h.api(`/items/${space.contracts}`,people[who]),file=await h.api(`/items/${space.terms}`,people[who]);return {children:c.children.map(x=>x.id),inner:inner.children.map(x=>x.id),versions:file.versions.map(v=>[v.id,v.checksum])}};
  const before=await tree('ana'),link=await h.api(`/items/${space.terms}/links`,people.ana,{role:'viewer'});
  // A contributor may not trash; a content manager trashes her nested folder with no owner session involved.
  await h.api(`/items/${space.client}/trash`,people.cy,{},403);
  await h.api(`/items/${space.client}/trash`,people.ana,{});
  assert.ok((await h.api('/trash',people.ana)).some(t=>t.id===space.client&&t.mine&&t.name==='Client A'));
  await h.api(`/items/${space.terms}`,people.ben,undefined,404);assert.equal((await h.api('/search?q=net%2030',people.ben)).count,0);await bytesOf('ben',space.terms,before.versions[0][0],404);
  assert.ok(!(await h.api('/trash',people.ben)).some(t=>t.id===space.client),'a viewer sees nobody else\'s trash');
  await h.api(`/items/${space.client}/restore`,people.ben,{},403);
  // While trashed, the link is removed; restoring never brings it back.
  await h.api(`/links/${link.link.id}`,people.ana,{remove:true});
  await h.api(`/items/${space.client}/restore`,people.ana,{});
  assert.deepEqual(await tree('ana'),before,'tree, version IDs, hashes and stable IDs are identical after restore');
  await h.api('/links/open',people.dee,{token:link.url.split('/s/')[1]},404);
  assert.equal((await audit('item.trash')).filter(e=>e.object_id===space.client).length,1);const restored=(await audit('item.restore')).filter(e=>e.object_id===space.client);assert.equal(restored.length,1);assert.equal(restored[0].actor,'ana@example.test');assert.equal(JSON.parse(restored[0].detail).outcome,'restored');
  // A space manager sees and restores what another member trashed.
  const notes=await upload(people.cy,{space:space.id,name:'notes.txt',base64:b64('meeting notes')});await h.api(`/items/${notes.id}/trash`,people.ana,{});
  assert.ok((await h.api('/trash',people.mo)).some(t=>t.id===notes.id&&!t.mine&&t.managed));await h.api(`/items/${notes.id}/restore`,people.cy,{},403);await h.api(`/items/${notes.id}/restore`,people.mo,{});
  // An admin restores across spaces without being a member; the item's name is not shown to them.
  await h.api(`/items/${notes.id}/trash`,people.ana,{});assert.equal((await h.api('/trash',people.owner)).find(t=>t.id===notes.id).name,null);await h.api(`/items/${notes.id}/restore`,people.owner,{});await h.api(`/items/${notes.id}`,people.owner,undefined,403);
  // Permanent removal is the manager's (ERASE-001): an editor is refused; the manager's erasure removes records and unshared bytes.
  const scrap=await upload(people.ana,{space:space.id,name:'scrap.txt',base64:b64('unique scrap bytes 9f2')});await h.api(`/items/${scrap.id}/trash`,people.ana,{});
  await h.api(`/items/${scrap.id}/erase`,people.ana,{},403);const receipt=await h.api(`/items/${scrap.id}/erase`,people.mo,{});
  assert.equal(receipt.payload.state,'complete');assert.deepEqual(receipt.payload.originals.removed,[sha('unique scrap bytes 9f2')]);await h.api(`/items/${scrap.id}`,people.mo,undefined,404);
  assert.equal(JSON.parse((await audit('item.trash')).find(e=>e.object_id===scrap.id).detail).erased,true,'erased item audit keeps the action and drops its details');
  // In a personal area the owning user erases their own trashed item; a governed record's editor restores what they trashed.
  const own=await upload(people.ben,{space:personalOf.ben,name:'draft.txt',base64:b64('ben draft')});await h.api(`/items/${own.id}/trash`,people.ben,{});await h.api(`/items/${own.id}/erase`,people.ben,{});
  const collection=await h.api('/collections',people.owner,{name:'Governed'}),schema=await h.api('/schemas',people.owner,{name:'Plain',fields:[]});
  await h.api(`/collections/${collection.id}/grants`,people.owner,{grants:[{principal:'ana@example.test',role:'editor'},{principal:'ben@example.test',role:'reader'}]});
  const record=await h.api('/documents',people.owner,{title:'Governed policy',collection:collection.id,schema:schema.id,fields:{},owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL,filename:'policy.txt',base64:b64('governed policy')});
  await h.api(`/documents/${record.id}/lifecycle`,people.ben,{action:'trash'},403);await h.api(`/documents/${record.id}/lifecycle`,people.ana,{action:'trash'});
  assert.ok((await h.api('/library?trash=true',people.ana)).documents.some(r=>r.id===record.id));await h.api(`/documents/${record.id}`,people.ben,undefined,404);
  await h.api(`/documents/${record.id}/lifecycle`,people.ben,{action:'restore'},403);await h.api(`/documents/${record.id}/lifecycle`,people.ana,{action:'restore'});await h.api(`/documents/${record.id}`,people.ben);
 });
 await check('VERSION-001',async()=>{
  const xlsx=n=>Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(`budget workbook revision ${n}`)]);
  let file=await upload(people.ana,{space:space.id,name:'budget.xlsx',base64:b64(xlsx(1))});const v1=file.payload.current;
  file=await h.api(`/items/${file.id}/versions`,people.ana,{base64:b64(xlsx(2))});const v2=file.payload.current;
  file=await h.api(`/items/${file.id}/versions`,people.mo,{base64:b64(xlsx(3))});const v3=file.payload.current;
  const link=await h.api(`/items/${file.id}/links`,people.ana,{role:'viewer'});
  const device=await h.api('/devices',people.ana,{name:'Ana laptop',platform:'macos'}),sync=(path,init={})=>h.fetch('/api/chest'+path,{...init,headers:{authorization:`Bearer ${device.token}`,...init.headers}});
  const {cursor}=await(await sync('/sync/tree')).json();
  const history=await h.api(`/items/${file.id}`,people.cy);assert.deepEqual(history.versions.map(v=>[v.id,v.actor,v.size,v.arrival]),[[v3,'mo@example.test',xlsx(3).length,'upload'],[v2,'ana@example.test',xlsx(2).length,'upload'],[v1,'ana@example.test',xlsx(1).length,'upload']]);assert.ok(history.versions.every(v=>v.at&&v.checksum));
  assert.equal(sha(await bytesOf('cy',file.id,v2)),sha(xlsx(2)));
  await h.api(`/items/${file.id}/versions/${v2}/name`,people.cy,{name:'Before Q3 edits'});
  file=await h.api(`/items/${file.id}/versions/${v2}/restore`,people.cy,{});const v4=file.payload.versions.at(-1);
  assert.equal(file.payload.current,v4.id);assert.equal(v4.actor,'cy@example.test');assert.equal(v4.arrival,'restore');assert.equal(v4.restoredFrom,v2);assert.equal(v4.checksum,sha(xlsx(2)));assert.equal(file.payload.versions.find(v=>v.id===v2).name,'Before Q3 edits');
  for(const [v,n] of [[v1,1],[v2,2],[v3,3]])assert.equal(sha(await bytesOf('cy',file.id,v)),sha(xlsx(n)));
  // The existing link and stable ID serve the restored content.
  assert.equal((await h.api('/links/open',people.dee,{token:link.url.split('/s/')[1]})).item,file.id);const viaLink=await h.api(`/items/${file.id}`,people.dee);assert.equal(viaLink.item.current,v4.id);assert.equal(sha(await bytesOf('dee',file.id,v4.id)),sha(xlsx(2)));
  const feed=await(await sync(`/sync/changes?cursor=${cursor}`)).json();assert.ok(feed.changes,JSON.stringify(feed));assert.equal(feed.changes.find(c=>c.id===file.id).item.version.id,v4.id,'a synced client receives the restore as a remote change');
  // Viewers and commenters see history and download, but cannot restore or rename versions.
  await h.api(`/items/${file.id}/shares`,people.ana,{principal:'eve@example.test',role:'commenter'});
  for(const who of ['ben','eve']){assert.equal((await h.api(`/items/${file.id}`,people[who])).versions.length,4);assert.equal(sha(await bytesOf(who,file.id,v1)),sha(xlsx(1)));await h.api(`/items/${file.id}/versions/${v1}/restore`,people[who],{},403);await h.api(`/items/${file.id}/versions/${v1}/name`,people[who],{name:'x'},403)}
  assert.equal((await h.api(`/items/${file.id}`,people.ana)).versions.length,4);
  await h.api(`/spaces/${space.id}/settings`,people.mo,{noDownload:true});assert.equal((await bytesOf('ben',file.id,v1,403)).error,'download_restricted');await bytesOf('ben',file.id,v1,403,'');await bytesOf('cy',file.id,v1);await h.api(`/spaces/${space.id}/settings`,people.mo,{noDownload:false});
  // On a governed record the restored version is a new submission; the approved pointer moves only by approval.
  const collection=await h.api('/collections',people.owner,{name:'Approved budgets'}),schema=await h.api('/schemas',people.owner,{name:'Budget',fields:[]});
  await h.api(`/collections/${collection.id}/grants`,people.owner,{grants:[{principal:'cy@example.test',role:'editor'},{principal:'mo@example.test',role:'reviewer'}]});
  let doc=await h.api('/documents',people.owner,{title:'FY budget',collection:collection.id,schema:schema.id,fields:{},owner:h.vars.OWNER_EMAIL,reviewer:'mo@example.test',filename:'fy1.txt',base64:b64('fy one')});doc=await h.api(`/documents/${doc.id}/versions`,people.owner,{filename:'fy2.txt',base64:b64('fy two')});
  doc=await h.api(`/documents/${doc.id}/review/${doc.payload.versions[1].id}`,people.mo,{action:'approve'});
  doc=await h.api(`/documents/${doc.id}/history/${doc.payload.versions[0].id}/restore`,people.cy,{});const restoredDoc=doc.payload.versions.at(-1);
  assert.equal(restoredDoc.state,'submitted');assert.equal(restoredDoc.checksum,sha('fy one'));assert.equal(doc.payload.approved,doc.payload.versions[1].id);
  const shown=(await h.api(`/items/${file.id}`,people.ben)).activity;assert.ok(shown.some(a=>a.action==='version.restore'&&a.actor==='cy@example.test'&&a.detail.source===v2));assert.ok(shown.some(a=>a.action==='version.name'));assert.ok(!shown.some(a=>a.action==='item.read'),'a viewer sees edits, not who viewed');
  assert.ok((await h.api(`/items/${file.id}`,people.cy)).activity.some(a=>a.action==='item.read'&&a.actor==='ben@example.test'),'a contributor sees who viewed');
  const restores=(await audit('version.restore')).filter(e=>e.object_id===file.id);assert.equal(restores.length,1);assert.equal(restores[0].actor,'cy@example.test');assert.equal(JSON.parse(restores[0].detail).source,v2);
 });
 await check('SHARE-004',async()=>{
  // Ana shares a personal file with Ben as commenter: in-app notice, email, Shared with me; he comments but cannot edit.
  const plan=await upload(people.ana,{space:personalOf.ana,name:'plan.txt',base64:b64('launch plan')});
  await h.api(`/items/${plan.id}/shares`,people.ana,{principal:'ben@example.test',role:'commenter',message:'Please review section 2'});
  assert.ok((await h.api('/notices',people.ben)).some(n=>n.payload.type==='share'&&n.payload.item===plan.id&&n.payload.message.includes('Please review section 2')));
  assert.equal(mail('ben@example.test',new RegExp(`/app/items/${plan.id}`)).length,1);
  const shared=await h.api('/shared',people.ben);assert.equal(shared.find(s=>s.id===plan.id).sharer,'ana@example.test');assert.equal((await h.api('/shared?sharer=mo%40example.test',people.ben)).filter(s=>s.id===plan.id).length,0);assert.equal((await h.api(`/shared?from=2000-01-01&to=2000-01-02`,people.ben)).length,0);
  await h.api(`/items/${plan.id}/comments`,people.ben,{message:'Section 2 looks right'});await h.api(`/items/${plan.id}/versions`,people.ben,{base64:b64('edit')},403);
  // A shortcut in Ben's area grants nothing further.
  await h.api(`/items/${plan.id}/prefs`,people.ben,{shortcut:true});assert.ok((await h.api('/files',people.ben)).shortcuts.some(s=>s.id===plan.id&&s.role==='commenter'));
  // Dee opens the stable link without access: Request access, never the name; Ana approves at a lower role.
  const refused=await h.raw(`/api/chest/items/${plan.id}`,people.dee);assert.equal(refused.status,403);const refusal=await refused.text();assert.ok(!refusal.includes('plan.txt')&&refusal.includes('access_required'));
  const request=await h.api(`/items/${plan.id}/access-requests`,people.dee,{role:'editor',message:'I run the launch'});
  assert.ok(!JSON.stringify(await h.api(`/requests/${request.request}`,people.dee)).includes('plan.txt'));assert.equal(mail('ana@example.test',new RegExp(`/app/requests/${request.request}`)).length,1);
  await h.api(`/requests/${request.request}`,people.cy,{decision:'approve'},403);await h.api(`/requests/${request.request}`,people.ana,{decision:'approve',role:'viewer'});
  assert.ok((await h.api('/notices',people.dee)).some(n=>n.payload.type==='request.decision'&&n.payload.message.includes('was approved as viewer')));assert.equal(mail('dee@example.test',/approved as viewer/).length,1);
  const opened=await h.api(`/items/${plan.id}`,people.dee);assert.equal(opened.role,'viewer');await h.api(`/requests/${request.request}`,people.ana,{decision:'approve'},409);
  // A second request is declined from the share dialog's list; the requester is told.
  const second=await h.api(`/items/${plan.id}/access-requests`,people.cy,{role:'viewer'});assert.ok((await h.api(`/items/${plan.id}`,people.ana)).requests.some(r=>r.id===second.request));
  await h.api(`/requests/${second.request}`,people.ana,{decision:'decline'});assert.ok((await h.api('/notices',people.cy)).some(n=>n.payload.message.includes('declined')));await h.api(`/items/${plan.id}`,people.cy,undefined,403);
  // Fay leaves: her successor receives requests for her files. With no one holding share rights, admins decide.
  const fays=await upload(people.fay,{space:personalOf.fay,name:'vendors.txt',base64:b64('vendor list')});
  await h.api('/people',people.owner,{action:'offboard',email:'fay@example.test',to:'mo@example.test'});await h.api('/files',people.fay,undefined,401);
  const routed=await h.api(`/items/${fays.id}/access-requests`,people.dee,{role:'viewer'});assert.deepEqual((await h.api(`/requests/${routed.request}`,people.mo)).approvers,['mo@example.test']);
  const orphan=await upload(people.eve,{space:personalOf.eve,name:'orphan.txt',base64:b64('orphan')});await h.api('/people',people.owner,{action:'deactivate',email:'eve@example.test'});
  const toAdmins=await h.api(`/items/${orphan.id}/access-requests`,people.dee,{role:'viewer'});assert.deepEqual((await h.api(`/requests/${toAdmins.request}`,people.owner)).approvers,[h.vars.OWNER_EMAIL]);
  await h.api('/people',people.owner,{action:'reactivate',email:'eve@example.test'});people.eve=await h.signIn('eve@example.test');
  const spaceRequest=await h.api(`/items/${space.terms}/access-requests`,people.dee,{role:'viewer'});assert.deepEqual((await h.api(`/requests/${spaceRequest.request}`,people.mo)).approvers,['ana@example.test','mo@example.test']);
  // Requests close after 30 days and the requester is told.
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.expiresAt',?) WHERE id=?",new Date(Date.now()-1000).toISOString(),spaceRequest.request);
  assert.equal((await h.api(`/requests/${spaceRequest.request}`,people.dee)).status,'expired');assert.ok((await h.api('/notices',people.dee)).some(n=>n.payload.type==='request.expired'));
  // Grant expiry: commenter on a space file for two days; the one-day notice reaches both, one extend moves it once.
  const device=await h.api('/devices',people.dee,{name:'Dee desktop',platform:'windows'}),hydrate=()=>h.fetch(`/api/chest/sync/items/${space.terms}/content`,{headers:{authorization:`Bearer ${device.token}`}});
  await h.api('/policy',people.ana,{maxGrantDays:10},403);await h.api('/policy',people.owner,{maxGrantDays:10});
  await h.api(`/items/${space.terms}/shares`,people.ana,{principal:'dee@example.test',role:'commenter',expires:new Date(Date.now()+30*day).toISOString().slice(0,10)},400);
  const until=new Date(Date.now()+2*day).toISOString().slice(0,10);await h.api(`/items/${space.terms}/shares`,people.ana,{principal:'dee@example.test',role:'commenter',expires:until});
  assert.equal((await hydrate()).status,200);await h.api(`/items/${space.terms}/comments`,people.dee,{message:'Noted'});
  const age=async ms=>{const at=new Date(Date.now()+ms).toISOString();await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.expires',?) WHERE id=?",at,`expiry:${space.terms}:dee@example.test`);await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.grants',(SELECT json_group_array(CASE WHEN json_extract(value,'$.principal')='dee@example.test' THEN json_set(value,'$.expires',?) ELSE json(value) END) FROM json_each(payload,'$.grants'))) WHERE id=?",at,space.terms)};
  await age(12*3600_000);await h.api('/files',people.mo);
  for(const who of ['ana','dee'])assert.equal((await h.api('/notices',people[who])).filter(n=>n.payload.type==='share.expiring'&&n.payload.item===space.terms).length,1,`${who} gets one expiry notice`);
  const grant=(await h.api(`/items/${space.terms}`,people.ana)).grants.find(g=>g.principal==='dee@example.test');
  const extended=await h.api(`/items/${space.terms}/extend`,people.ana,{principal:'dee@example.test',from:grant.expires});const moved=extended.payload.grants.find(g=>g.principal==='dee@example.test').expires;assert.equal(Date.parse(moved)-Date.parse(grant.expires),7*day);
  await h.api(`/items/${space.terms}/extend`,people.ana,{principal:'dee@example.test',from:grant.expires},409);
  await age(-1000);await h.api('/files',people.mo);
  await h.api(`/items/${space.terms}`,people.dee,undefined,403);await bytesOf('dee',space.terms,(await h.api(`/items/${space.terms}`,people.ana)).item.current,403);assert.equal((await hydrate()).status,403);await h.api(`/items/${space.terms}/comments`,people.dee,{message:'late'},403);
  assert.equal((await h.api('/search?q=net%2030',people.dee)).count,0);assert.ok(!(await h.api('/shared',people.dee)).some(s=>s.id===space.terms));
  assert.equal((await audit('share.expired')).filter(e=>e.object_id===space.terms).length,1);
  assert.equal((await h.api(`/items/${plan.id}`,people.dee)).role,'viewer','other grants are kept');
 });
 await check('RECOVER-001',async()=>{
  // A folder with history; then, after the recorded point, a rename, an overwrite, a deletion, a new file and removed sharing.
  const q3=await h.api('/items',people.mo,{space:space.id,type:'folder',name:'Q3'});let a=await upload(people.mo,{parent:q3.id,name:'a.txt',base64:b64('a one')});a=await h.api(`/items/${a.id}/versions`,people.ana,{base64:b64('a two')});
  const b=await upload(people.ana,{parent:q3.id,name:'b.txt',base64:b64('b original')}),link=await h.api(`/items/${b.id}/links`,people.ana,{role:'viewer'});await h.api(`/items/${q3.id}/shares`,people.mo,{principal:'dee@example.test',role:'viewer'});
  await new Promise(r=>setTimeout(r,25));const at=new Date().toISOString();await new Promise(r=>setTimeout(r,25));
  await h.api(`/items/${q3.id}/rename`,people.ana,{name:'Q3 old'});await h.api(`/items/${b.id}/versions`,people.ana,{base64:b64('b overwritten')});await h.api(`/items/${a.id}/trash`,people.ana,{});
  const c=await upload(people.cy,{parent:q3.id,name:'c.txt',base64:b64('c added later')});await h.api(`/links/${link.link.id}`,people.ana,{remove:true});await h.api(`/items/${q3.id}/unshare`,people.mo,{principal:'dee@example.test'});await h.api(`/items/${q3.id}/trash`,people.ana,{});
  await h.api('/rewind/preview',people.ben,{folder:q3.id,at},403);await h.api('/rewind/preview',people.dee,{space:space.id,at},404);
  const preview=await h.api('/rewind/preview',people.mo,{space:space.id,at}),kinds=key=>preview.changes.find(x=>x.id===key)?.kinds??[];
  assert.deepEqual(kinds(q3.id),['name','not trashed then']);assert.deepEqual(kinds(a.id),['not trashed then']);assert.deepEqual(kinds(b.id),['earlier version']);assert.deepEqual(kinds(c.id),['added since']);
  assert.equal(preview.sharing.restored,false);assert.ok(preview.sharing.removedSince.some(e=>e.action==='link.remove')&&preview.sharing.removedSince.some(e=>e.action==='share.remove'));
  await h.api('/rewind/apply',people.mo,{space:space.id,at,fingerprint:'stale'},409);
  // The space manager, not the installation owner, restores the selected content and keeps the new file.
  const result=await h.api('/rewind/apply',people.mo,{space:space.id,at,fingerprint:preview.fingerprint,items:[q3.id,a.id,b.id]});assert.deepEqual(result.applied.sort(),[q3.id,a.id,b.id].sort());
  assert.equal((await h.api(`/items/${q3.id}`,people.mo)).item.name,'Q3');const aNow=await h.api(`/items/${a.id}`,people.mo);assert.equal(sha(await bytesOf('mo',a.id,aNow.item.current)),sha('a two'));
  const bNow=await h.api(`/items/${b.id}`,people.mo);assert.equal(sha(await bytesOf('mo',b.id,bNow.item.current)),sha('b original'));assert.equal(bNow.versions.length,3,'later history is retained');assert.equal(sha(await bytesOf('mo',b.id,bNow.versions[1].id)),sha('b overwritten'));
  assert.equal((await h.api(`/items/${c.id}`,people.mo)).item.name,'c.txt');
  await h.api('/links/open',people.dee,{token:link.url.split('/s/')[1]},404);await h.api(`/items/${q3.id}`,people.dee,undefined,403);await h.api('/files',people.fay,undefined,401);
  assert.equal((await audit('rewind.apply')).at(-1).actor,'mo@example.test');
  // Below manager, a rewind covers only the person's own files; the same contributor restores a colleague's version under VERSION-001.
  assert.deepEqual((await h.api('/rewind/preview',people.cy,{folder:q3.id,at})).changes.map(x=>x.id),[c.id]);
  const colleague=await h.api(`/items/${b.id}/versions/${bNow.versions[1].id}/restore`,people.cy,{});assert.equal(colleague.payload.versions.at(-1).actor,'cy@example.test');
  // An admin previews a departed person's area (Fay's, now held by her successor) without being its owner.
  assert.equal((await h.api('/rewind/preview',people.owner,{space:personalOf.fay,at})).scope,`space:${personalOf.fay}`);await h.api('/rewind/preview',people.ana,{space:personalOf.fay,at},404);
  // A person rewinds their own personal area.
  const own=await upload(people.dee,{space:personalOf.dee,name:'own.txt',base64:b64('own v1')});const ownAt=new Date().toISOString();await new Promise(r=>setTimeout(r,25));await h.api(`/items/${own.id}/versions`,people.dee,{base64:b64('own v2')});
  const ownPlan=await h.api('/rewind/preview',people.dee,{space:personalOf.dee,at:ownAt});await h.api('/rewind/apply',people.dee,{space:personalOf.dee,at:ownAt,fingerprint:ownPlan.fingerprint});
  assert.equal(sha(await bytesOf('dee',own.id,(await h.api(`/items/${own.id}`,people.dee)).item.current)),sha('own v1'));
 });
 await check('TRANSFER-001 resumable upload',async()=>{
  // A 17 MB original in three parts: two arrive, the Worker restarts, and choosing the same file resumes with only the missing part.
  const big=Buffer.alloc(17*1024*1024+123);for(let i=0;i+4<=big.length;i+=4)big.writeUInt32LE(Math.imul(i,2654435761)>>>0,i);
  const begin={parent:space.contracts,name:'site-survey.bin',size:big.length,lastModified:1760000000000};
  await h.api('/uploads',people.ben,begin,403);await h.api('/uploads',people.ana,{...begin,size:4*1024**3+1},413);
  const u=await h.api('/uploads',people.ana,begin),slice=n=>big.subarray((n-1)*u.partSize,Math.min(n*u.partSize,big.length));
  const put=(n,who='ana',body=slice(n))=>h.fetch(`/api/chest/uploads/${u.id}/parts/${n}`,{method:'PUT',headers:{cookie:people[who],origin:h.origin,'content-type':'application/octet-stream'},body});
  assert.deepEqual(u.parts,[]);assert.equal((await put(1)).status,200);
  assert.equal((await put(2,'ana',big.subarray(0,10))).status,400,'a part of the wrong size is refused');assert.equal((await put(2,'cy',big.subarray(0,10))).status,404,"another person's upload");
  assert.equal((await put(2)).status,200);await h.api(`/uploads/${u.id}/complete`,people.ana,{},409);
  assert.ok(!(await h.api(`/items/${space.contracts}`,people.ana)).children.some(c=>c.name==='site-survey.bin'),'nothing is half-visible');
  await h.stop();await h.start();
  const again=await h.api('/uploads',people.ana,begin);assert.equal(again.id,u.id);assert.deepEqual(again.parts,[1,2]);assert.equal(again.received,2*u.partSize);
  assert.deepEqual((await h.api(`/uploads?parent=${space.contracts}`,people.ana)).map(x=>x.id),[u.id]);
  assert.equal((await put(3)).status,200);
  const done=await h.api(`/uploads/${u.id}/complete`,people.ana,{});assert.equal(done.state,'complete');assert.deepEqual((await h.api(`/uploads/${u.id}/complete`,people.ana,{})).result,done.result,'completing twice makes one file');
  const file=await h.api(`/items/${done.result.item}`,people.mo);assert.equal(file.versions.length,1);assert.equal(file.versions[0].checksum,sha(big));assert.equal(file.versions[0].size,big.length);
  assert.equal(sha(await bytesOf('mo',done.result.item,done.result.version)),sha(big),'the original streams back verified');
  assert.equal((await h.api(`/items/${space.contracts}`,people.ana)).children.filter(c=>c.name==='site-survey.bin').length,1);
  // A new version through the same door carries a stated checksum; a wrong one is refused before the file changes.
  const v2=Buffer.from('survey revised'),bad=await h.api('/uploads',people.cy,{item:done.result.item,name:'site-survey.bin',size:v2.length,checksum:sha('other')});
  assert.equal((await h.fetch(`/api/chest/uploads/${bad.id}/parts/1`,{method:'PUT',headers:{cookie:people.cy,origin:h.origin},body:v2})).status,200);await h.api(`/uploads/${bad.id}/complete`,people.cy,{},400);
  await h.api(`/uploads/${bad.id}/cancel`,people.cy,{});await h.api(`/uploads/${bad.id}`,people.cy,undefined,404);
  const good=await h.api('/uploads',people.cy,{item:done.result.item,name:'site-survey.bin',size:v2.length,checksum:sha(v2)});
  await h.fetch(`/api/chest/uploads/${good.id}/parts/1`,{method:'PUT',headers:{cookie:people.cy,origin:h.origin},body:v2});await h.api(`/uploads/${good.id}/complete`,people.cy,{});
  const after=await h.api(`/items/${done.result.item}`,people.mo);assert.equal(after.versions.length,2);assert.equal(after.versions[0].checksum,sha(v2));assert.equal(after.versions[1].checksum,sha(big));
 });
 await check('RECOVER-001 folder to a date',async()=>{
  // Harbor Freight on the 12th, then an overwrite, a deletion, a move out, a rename and a new file.
  const pause=()=>new Promise(r=>setTimeout(r,25)),f=await h.api('/items',people.ana,{space:space.id,type:'folder',name:'Harbor Freight'}),sub=await h.api('/items',people.ana,{parent:f.id,type:'folder',name:'Invoices'}),elsewhere=await h.api('/items',people.ana,{space:space.id,type:'folder',name:'Archive'});
  const quote=await upload(people.ana,{parent:f.id,name:'quote.txt',base64:b64('quote v1')}),invoice=await upload(people.ana,{parent:sub.id,name:'inv-1.txt',base64:b64('invoice one')}),notes=await upload(people.ana,{parent:f.id,name:'notes.txt',base64:b64('notes')});
  await pause();const at=new Date().toISOString();await pause();
  await h.api(`/items/${quote.id}/versions`,people.ana,{base64:b64('quote v2')});await h.api(`/items/${invoice.id}/trash`,people.ana,{});await h.api(`/items/${notes.id}/move`,people.ana,{parent:elsewhere.id});await h.api(`/items/${sub.id}/rename`,people.ana,{name:'Bills'});
  const late=await upload(people.ana,{parent:f.id,name:'late.txt',base64:b64('late')});
  const state=async()=>({quote:sha(await bytesOf('mo',quote.id,(await h.api(`/items/${quote.id}`,people.mo)).item.current)),invoice:(await h.raw(`/api/chest/items/${invoice.id}`,people.mo)).status,notes:(await h.api(`/items/${notes.id}`,people.mo)).item.parent,sub:(await h.api(`/items/${sub.id}`,people.mo)).item.name,late:(await h.raw(`/api/chest/items/${late.id}`,people.mo)).status});
  const changed={quote:sha('quote v2'),invoice:404,notes:elsewhere.id,sub:'Bills',late:200};assert.deepEqual(await state(),changed);
  await h.api('/rewind/preview',people.ben,{folder:f.id,at},403);
  const preview=await h.api('/rewind/preview',people.mo,{folder:f.id,at}),kinds=key=>preview.changes.find(x=>x.id===key)?.kinds??[];
  assert.deepEqual(kinds(quote.id),['earlier version']);assert.deepEqual(kinds(invoice.id),['not trashed then']);assert.deepEqual(kinds(notes.id),['place']);assert.deepEqual(kinds(sub.id),['name']);assert.deepEqual(kinds(late.id),['added since']);
  assert.deepEqual(await state(),changed,'a preview changes nothing');
  const applied=await h.api('/rewind/apply',people.mo,{folder:f.id,at,fingerprint:preview.fingerprint});
  assert.deepEqual(await state(),{quote:sha('quote v1'),invoice:200,notes:f.id,sub:'Invoices',late:404});
  assert.equal(sha(await bytesOf('mo',invoice.id,(await h.api(`/items/${invoice.id}`,people.mo)).item.current)),sha('invoice one'));
  // Undo returns each item to its state just before the restore, as new states; every version stays.
  await h.api(`/rewind/${applied.id}/undo`,people.ben,{},403);
  const undone=await h.api(`/rewind/${applied.id}/undo`,people.mo,{});assert.deepEqual(undone.restored.sort(),applied.applied.sort());assert.deepEqual(undone.skipped,[]);
  assert.deepEqual(await state(),changed);assert.equal((await h.api(`/items/${quote.id}`,people.mo)).versions.length,4);
  await h.api(`/rewind/${applied.id}/undo`,people.mo,{},409);
 });
 await check('SYNC-001 server protocol',async()=>{
  const device=await h.api('/devices',people.ana,{name:'Ana desktop',platform:'windows'}),auth={authorization:`Bearer ${device.token}`},sync=(path,init={})=>h.fetch('/api/chest'+path,{...init,headers:{...auth,...init.headers}});
  assert.equal((await h.fetch('/api/chest/sync/tree')).status,401);assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:'Bearer chest_dev_'+'x'.repeat(43)}})).status,401);
  const start=await(await sync('/sync/tree')).json();assert.ok(start.items.some(i=>i.id===space.terms));assert.ok(!start.items.some(i=>i.id===space.hr),'restricted folders stay out of the tree');
  const body='synced from the desktop client',created=await(await sync(`/sync/items?parent=${space.contracts}&name=desk.txt`,{method:'POST',body})).json();
  const part=await sync(`/sync/items/${created.item}/content`,{headers:{range:'bytes=7-10'}});assert.equal(part.status,206);assert.equal(await part.text(),body.slice(7,11));
  const saved=await(await sync(`/sync/items/${created.item}/content`,{method:'PUT',headers:{'if-match':created.version},body:'second save'})).json();assert.equal(saved.conflict,false);
  const conflict=await(await sync(`/sync/items/${created.item}/content`,{method:'PUT',headers:{'if-match':created.version},body:'offline edit'})).json();assert.equal(conflict.conflict,true);
  const kept=await h.api(`/items/${conflict.kept}`,people.ana);assert.match(kept.item.name,/^desk \(conflicted copy from Ana desktop .*\)\.txt$/);assert.equal(kept.versions[0].arrival,'conflict copy');
  assert.equal(sha(await bytesOf('ana',created.item,(await h.api(`/items/${created.item}`,people.ana)).item.current)),sha('second save'),'the remote version stays current');
  assert.equal((await sync(`/sync/items/${created.item}`,{method:'DELETE'})).status,200);
  const feed=await(await sync(`/sync/changes?cursor=${start.cursor}`)).json();assert.equal(feed.changes.find(c=>c.id===created.item).state,'removed');assert.equal(feed.changes.find(c=>c.id===conflict.kept).state,'present');
  assert.equal((await h.api('/trash',people.ana)).find(t=>t.id===created.item).trashedBy,'ana@example.test');
  const benDevice=await h.api('/devices',people.ben,{name:'Ben phone',platform:'ios'});assert.equal((await h.fetch(`/api/chest/sync/items?parent=${space.contracts}&name=no.txt`,{method:'POST',headers:{authorization:`Bearer ${benDevice.token}`},body:'x'})).status,403);
  assert.ok((await h.api('/devices',people.owner)).some(d=>d.id===device.device.id&&d.lastSeen));await h.api(`/devices/${device.device.id}/revoke`,people.ben,{},404);
  await h.api(`/devices/${device.device.id}/revoke`,people.ana,{});assert.equal((await sync('/sync/tree')).status,401);
  await h.api('/people',people.owner,{action:'deactivate',email:'ben@example.test'});assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${benDevice.token}`}})).status,401);
 });
}finally{await h.close()}
