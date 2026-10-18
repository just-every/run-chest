// RULE-001: approve an exact multi-action plan, retain originals, block stale/unsafe items and undo.
import assert from 'node:assert/strict';
import {zipSync} from 'fflate';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
const originalBytes=Buffer.from(docx()),h=await harness(),b64=x=>Buffer.from(x).toString('base64');
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=await h.api('/spaces',owner,{name:'Harbor vendor operations'}),inbox=await h.api('/items',owner,{space:space.id,type:'folder',name:'Arrivals'}),filed=await h.api('/items',owner,{space:space.id,type:'folder',name:'Vendor records'});
 const file=await h.api('/items',owner,{parent:inbox.id,name:'Acme terms.docx',base64:b64(originalBytes)}),version=file.payload.current;
 const preview=await h.api('/filing/batches',owner,{items:[inbox.id],actions:{rename:'Reviewed {name}',tag:'Vendor due diligence',destination:filed.id,convert:true}});
 assert.equal(preview.payload.items[0].state,'ready');assert.equal((await h.api(`/items/${file.id}`,owner)).item.name,'Acme terms.docx');
 const applied=await h.api(`/filing/batches/${preview.id}/apply`,owner,{});assert.equal(applied.payload.items[0].state,'applied',JSON.stringify(applied));
 const moved=await h.api(`/items/${file.id}`,owner);assert.equal(moved.item.parent,filed.id);assert.equal(moved.item.name,'Reviewed Acme terms.docx');assert.equal(moved.item.current,version);assert.deepEqual(moved.item.tags,['Vendor due diligence']);
 const outputs=(await h.api(`/items/${filed.id}`,owner)).children;const converted=outputs.find(r=>r.name==='Reviewed Acme terms.txt');assert.ok(converted);
 const derived=await h.api(`/items/${converted.id}`,owner);assert.equal(derived.versions[0].transformation.sourceVersion,version);assert.ok((await h.raw(`/api/chest/items/${converted.id}/bytes/${derived.item.current}?download=true`,owner)).ok);
 await h.api(`/filing/batches/${preview.id}/apply`,owner,{});assert.equal((await h.api(`/items/${filed.id}`,owner)).children.length,2,'replay makes no duplicate');
 assert.ok((await h.api('/search?q=due%20diligence',owner)).results.some(r=>r.id===file.id));
 await h.api(`/filing/batches/${preview.id}/undo`,owner,{});const original=await h.api(`/items/${file.id}`,owner);assert.equal(original.item.name,file.payload.name);assert.equal(original.item.parent,inbox.id);assert.deepEqual(original.versions.map(v=>v.id),[version]);assert.deepEqual(Buffer.from(await(await h.raw(`/api/chest/items/${file.id}/bytes/${version}?download=true`,owner)).arrayBuffer()),originalBytes);
 assert.equal((await h.api(`/items/${filed.id}`,owner)).children.length,0,'derived originals retained in trash');
 const zip=await h.api('/items',owner,{parent:inbox.id,name:'Acme records.zip',base64:b64(zipSync({'Tax/W-9.txt':Buffer.from('Acme W-9'), 'Terms.txt':Buffer.from('Net 30 payment terms')}))});
 const zipPlan=await h.api('/filing/batches',owner,{items:[zip.id],actions:{unzip:true}}),zipApplied=await h.api(`/filing/batches/${zipPlan.id}/apply`,owner,{});assert.equal(zipApplied.payload.items[0].state,'applied',JSON.stringify(zipApplied));
 const root=(await h.api(`/items/${inbox.id}`,owner)).children.find(r=>r.name==='Acme records extracted');assert.ok(root);const tax=(await h.api(`/items/${root.id}`,owner)).children.find(r=>r.name==='Tax');assert.equal((await h.api(`/items/${tax.id}`,owner)).children[0].name,'W-9.txt');
 await h.api(`/filing/batches/${zipPlan.id}/undo`,owner,{});assert.equal((await h.api(`/items/${inbox.id}`,owner)).children.filter(r=>r.name==='Acme records.zip').length,1);
 const bad=await h.api('/items',owner,{parent:inbox.id,name:'unsafe.zip',base64:b64(zipSync({'../stolen.txt':Buffer.from('Unsafe')}))}),bomb=await h.api('/items',owner,{parent:inbox.id,name:'bomb.zip',base64:b64(zipSync({'expanded.txt':new Uint8Array(1000000)}))});
 for(const item of [bad,bomb]){const p=await h.api('/filing/batches',owner,{items:[item.id],actions:{unzip:true}});assert.equal(p.payload.items[0].state,'blocked');assert.match(p.payload.items[0].reason,/archive_/);await h.api(`/filing/batches/${p.id}/apply`,owner,{});assert.equal((await h.api(`/items/${item.id}`,owner)).versions.length,1)}
 const stale=await h.api('/filing/batches',owner,{items:[file.id],actions:{rename:'Old {name}'}});await h.api(`/items/${file.id}/rename`,owner,{name:'Human edited name.docx'});const blocked=await h.api(`/filing/batches/${stale.id}/apply`,owner,{});assert.equal(blocked.payload.items[0].state,'blocked');assert.equal((await h.api(`/items/${file.id}`,owner)).item.name,'Human edited name.docx');
 await h.api('/people',owner,{action:'invite',email:'dana@example.test',name:'Dana'});const dana=await h.signIn('dana@example.test',true);await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'dana@example.test',role:'content_manager'}]});
 const p=await h.api('/filing/batches',dana,{items:[file.id],actions:{destination:filed.id}});await h.api(`/items/${filed.id}/settings`,owner,{restricted:true});const refused=await h.api(`/filing/batches/${p.id}/apply`,dana,{});assert.equal(refused.payload.items[0].state,'blocked');assert.equal((await h.api(`/items/${file.id}`,owner)).item.parent,inbox.id);
 const broad=await h.api('/items',owner,{space:space.id,type:'folder',name:'Public folder'});await h.api(`/items/${broad.id}/public-links`,owner,{});const leak=await h.api('/filing/batches',owner,{items:[file.id],actions:{destination:broad.id}});assert.equal(leak.payload.items[0].state,'blocked');assert.equal(leak.payload.items[0].reason,'filing_would_broaden_public_access');
 console.log('RULE-001 preview, rename/tag/move/convert/unzip, replay, unsafe archives, live authority and Undo passed');
}finally{await h.close()}
