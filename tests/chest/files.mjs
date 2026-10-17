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
