// BULK-001 through the built Worker's HTTP doors; only the mail-provider edge is fake.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {harness} from './harness.mjs';
const h=await harness(),b64=s=>Buffer.from(s).toString('base64'),sha=s=>createHash('sha256').update(s).digest('hex');
const finish=async(cookie,id)=>{for(let n=0;n<30;n++){const job=await h.api(`/bulk/${id}/run`,cookie,{});if(job.state!=='pending')return job}assert.fail('job did not finish')};
try {
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const people={};for(const name of ['manager','worker','viewer','recipient']){await h.api('/people',owner,{action:'invite',email:`${name}@example.test`,name});people[name]=await h.signIn(`${name}@example.test`,true)}
 const space=await h.api('/spaces',people.manager,{name:'Bulk operations'});
 await h.api(`/spaces/${space.id}/members`,people.manager,{members:[{principal:'manager@example.test',role:'manager'},{principal:'worker@example.test',role:'content_manager'},{principal:'viewer@example.test',role:'viewer'},{principal:'recipient@example.test',role:'viewer'}]});
 const folders=[];for(const name of ['North','South'])folders.push(await h.api('/items',people.manager,{space:space.id,type:'folder',name}));
 const dest=await h.api('/items',people.manager,{space:space.id,type:'folder',name:'Moved'}),copies=await h.api('/items',people.manager,{space:space.id,type:'folder',name:'Copies'}),files=[];
 for(let n=0;n<200;n++){
  const text=`Original ${n} — preserved bytes`,file=await h.api('/items',people.manager,{parent:folders[n%2].id,name:`File ${String(n).padStart(3,'0')}.txt`,base64:b64(text)});files.push({...file,text});
  if(n<5)await h.api(`/items/${file.id}/settings`,people.manager,{noDownload:true});
  if(n>=197){await h.api(`/items/${file.id}/settings`,people.manager,{restricted:true});await h.api(`/items/${file.id}/shares`,people.manager,{principal:'viewer@example.test',role:'viewer'})}
 }
 // Original names, both trees, ZIP64 metadata, exact version IDs/hashes and five exclusions reconcile.
 const download=await h.api('/bulk',people.viewer,{action:'download',items:files.map(f=>f.id)});
 const zip=await h.raw(`/api/chest/bulk/${download.id}/archive`,people.viewer);assert.equal(zip.status,200);const zipped=new Uint8Array(await zip.arrayBuffer()),archive=unzipSync(zipped),manifest=JSON.parse(strFromU8(archive['chest-manifest.json']));
 const metered=(await h.api('/administration/egress',owner)).rows.filter(r=>r.door==='selection archive'&&r.item===download.id);assert.equal(metered.length,1);assert.equal(metered[0].bytes,zipped.length);assert.equal(metered[0].outcome,'complete');
 assert.equal(manifest.included.length,195);assert.equal(manifest.excluded.length,5);assert.equal(manifest.complete,false);assert.ok(Buffer.from(zipped).includes(Buffer.from([0x50,0x4b,0x06,0x06])),'ZIP64 end record');
 for(const item of manifest.included){const source=files.find(f=>f.payload.current===item.version);assert.ok(source);assert.equal(item.sha256,sha(source.text));assert.equal(item.size,Buffer.byteLength(source.text));assert.equal(sha(archive[item.path]),item.sha256);assert.ok(item.path.endsWith('/'+source.payload.name));assert.ok(item.path.includes('/'+folders[Number(source.text.match(/Original (\d+)/)[1])%2].payload.name+'/'))}
 for(const item of manifest.excluded){assert.equal(item.reason,'download_restricted');assert.ok(item.path);assert.equal(archive[item.path],undefined)}
 // ACL tightening after a queued job is visible only as an unnamed exclusion.
 const revoked=await h.api('/bulk',people.viewer,{action:'download',items:[files[10].id]});await h.api(`/items/${files[10].id}/settings`,people.manager,{restricted:true});
 const denied=unzipSync(new Uint8Array(await(await h.raw(`/api/chest/bulk/${revoked.id}/archive`,people.viewer)).arrayBuffer()));const deniedManifest=JSON.parse(strFromU8(denied['chest-manifest.json']));assert.equal(deniedManifest.included.length,0);assert.equal(deniedManifest.excluded[0].reason,'access_refused');assert.equal(deniedManifest.excluded[0].path,undefined);assert.ok(!strFromU8(denied['chest-manifest.json']).includes(files[10].payload.name));
 await h.api(`/items/${files[10].id}/settings`,people.manager,{restricted:false});
 const move=await h.api('/bulk',people.worker,{action:'move',space:space.id,parent:dest.id,items:files.map(f=>f.id)});let moved=await h.api(`/bulk/${move.id}/run`,people.worker,{limit:7});assert.equal(moved.done,7);
 await h.stop();await h.start();moved=await finish(people.worker,move.id);assert.equal(moved.state,'partial');assert.equal(moved.succeeded,197);assert.equal(moved.refused,3);assert.equal((await h.api(`/items/${dest.id}`,people.worker)).children.length,197);
 await finish(people.worker,move.id);assert.equal((await h.api('/audit?action=item.move',owner)).length,197,'one move audit per successful item after restart/retry');
 const sharing=await h.api('/bulk',people.worker,{action:'share',principal:'recipient@example.test',role:'viewer',items:files.map(f=>f.id)}),shared=await finish(people.worker,sharing.id);assert.equal(shared.succeeded,197);assert.equal(shared.refused,3);await finish(people.worker,sharing.id);assert.equal((await h.api('/audit?action=share.grant&actor=worker%40example.test',owner)).length,197);
 // Concurrent continuations race the same deterministic receipt; a copy is committed exactly once.
 const copying=await h.api('/bulk',people.worker,{action:'copy',space:space.id,parent:copies.id,items:[files[20].id]});await Promise.all([h.api(`/bulk/${copying.id}/run`,people.worker,{}),h.api(`/bulk/${copying.id}/run`,people.worker,{})]);await h.stop();await h.start();assert.equal((await finish(people.worker,copying.id)).succeeded,1);assert.equal((await h.api(`/items/${copies.id}`,people.worker)).children.length,1);
 const deniedTree=await h.api('/bulk',people.worker,{action:'copy',space:space.id,parent:copies.id,items:[folders[1].id]});assert.equal((await finish(people.worker,deniedTree.id)).refused,1);assert.equal((await h.api(`/items/${copies.id}`,people.worker)).children.length,1,'restricted descendants cannot be copied through a permitted parent');
 const tr=await h.api('/bulk',people.worker,{action:'trash',items:[files[20].id,files[21].id]});assert.equal((await finish(people.worker,tr.id)).state,'complete');const restore=await h.api('/bulk',people.worker,{action:'restore',items:[files[20].id,files[21].id]});assert.equal((await finish(people.worker,restore.id)).state,'complete');assert.equal((await h.api(`/items/${files[20].id}`,people.worker)).versions[0].checksum,files[20].payload.versions[0].checksum);
 const cancel=await h.api('/bulk',people.worker,{action:'trash',items:[files[22].id]});await h.api(`/bulk/${cancel.id}/cancel`,people.worker,{});await h.api(`/bulk/${cancel.id}/run`,people.worker,{},409);await h.api(`/items/${files[22].id}`,people.worker);
 await h.api(`/bulk/${move.id}`,people.viewer,undefined,404);const csrf=await h.fetch(`/api/chest/bulk/${move.id}/run`,{method:'POST',headers:{cookie:people.worker,'content-type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 console.log('BULK-001: 200-file ZIP64/manifest, live ACL exclusions, 197/3 move/share, restart, concurrent copy, trash/restore and cancellation passed');
} finally {await h.close()}
