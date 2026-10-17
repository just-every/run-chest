// One retained-storage journey through the built Worker's public doors, including concurrent admission.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),b64=v=>Buffer.from(v).toString('base64');
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);
 const owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 await h.api('/people',owner,{action:'invite',email:'manager@example.test',name:'Manager'});
 const manager=await h.signIn('manager@example.test',true),space=await h.api('/spaces',manager,{name:'Operations'});
 const limit=(n,id=space.id)=>h.api(`/spaces/${id}/quota`,owner,{storageLimitBytes:n});
 const usage=async(id=space.id)=>(await h.api(`/spaces/${id}/quota`,owner)).usedBytes;
 const upload=(name,value,id=space.id)=>h.api('/items',manager,{space:id,name,type:'file',base64:b64(value)});
 const refused=async(path,body)=>{const r=await h.raw('/api/chest'+path,manager,body);assert.equal(r.status,413,await r.clone().text());assert.equal((await r.json()).error,'storage_limit_exceeded')};
 await h.api(`/spaces/${space.id}/quota`,manager,{storageLimitBytes:100},403);
 await h.api(`/spaces/${space.id}/quota`,owner,{storageLimitBytes:-1},400);
 await limit(6);
 // Distinct concurrent admissions at a six-byte limit: exactly one four-byte original is retained.
 const attempts=await Promise.all(['abcd','efgh'].map((v,i)=>h.raw('/api/chest/items',manager,{space:space.id,name:`parallel-${i}.txt`,base64:b64(v)})));
 assert.deepEqual(attempts.map(r=>r.status).sort(),[200,413]);
 const file=await attempts.find(r=>r.status===200).json(),rejection=await attempts.find(r=>r.status===413).json();
 assert.equal(rejection.error,'storage_limit_exceeded');assert.equal(await usage(),4);
 await refused('/items',{space:space.id,name:'too-large.txt',base64:b64('123')});
 assert.equal((await h.api(`/spaces/${space.id}`,manager)).children.length,1);
 const original=file.payload.versions[0].checksum;
 // Existing content is deduplicated, including copies and restores of an earlier immutable version.
 const duplicate=await h.api(`/items/${file.id}/copy`,manager,{space:space.id,name:'duplicate.txt'});
 assert.equal(await usage(),4);assert.equal(duplicate.payload.versions[0].checksum,original);
 await h.api(`/items/${file.id}/versions`,manager,{base64:b64('ij')});assert.equal(await usage(),6);
 await refused(`/items/${file.id}/versions`,{base64:b64('k')});
 await h.api(`/items/${file.id}/versions/${file.payload.current}/restore`,manager,{});assert.equal(await usage(),6);
 await h.api(`/items/${file.id}/trash`,manager,{});assert.equal(await usage(),6);
 await refused('/items',{space:space.id,name:'trash-still-counts.txt',base64:b64('k')});
 const folder=await h.api('/items',manager,{space:space.id,type:'folder',name:'Requests'}),request=await h.api(`/items/${folder.id}/file-requests`,manager,{title:'Send a file'});
 const submission=new FormData();submission.append('files',new Blob(['new bytes']),'new.txt');
 const rejectedRequest=await h.fetch(new URL(request.url).pathname,{method:'POST',headers:{origin:h.origin},body:submission});
 assert.equal(rejectedRequest.status,413);assert.match(await rejectedRequest.text(),/space has reached its storage limit/);assert.equal((await h.api(`/items/${folder.id}`,manager)).children.length,0);
 // A quota reduction preserves originals and allows deduplicated copies while refusing growth.
 await limit(1);await h.api(`/items/${duplicate.id}/copy`,manager,{space:space.id,name:'another-copy.txt'});assert.equal(await usage(),6);
 const other=await h.api('/spaces',manager,{name:'Destination'});await limit(3,other.id);
 await refused(`/items/${duplicate.id}/copy`,{space:other.id,name:'copy.txt'});
 await refused(`/items/${duplicate.id}/move`,{space:other.id});
 assert.equal((await h.api(`/items/${duplicate.id}`,manager)).item.space,space.id);assert.equal(await usage(other.id),0);
 await limit(4,other.id);await h.api(`/items/${duplicate.id}/move`,manager,{space:other.id});assert.equal(await usage(other.id),4);assert.equal(await usage(),6);
 // Completing a multipart upload uses the same atomic limit; a refused session can finish after the owner raises it.
 const pending=await h.api('/uploads',manager,{space:space.id,name:'resumed.txt',size:3});
 const part=await h.fetch(`/api/chest/uploads/${pending.id}/parts/1`,{method:'PUT',headers:{cookie:manager,origin:h.origin},body:'xyz'});assert.equal(part.status,200);
 await refused(`/uploads/${pending.id}/complete`,{});assert.equal((await h.api(`/uploads/${pending.id}`,manager)).state,'open');assert.equal(await usage(),6);
 const competing=await h.api('/uploads',manager,{space:space.id,name:'competing.txt',size:3});
 assert.equal((await h.fetch(`/api/chest/uploads/${competing.id}/parts/1`,{method:'PUT',headers:{cookie:manager,origin:h.origin},body:'uvw'})).status,200);
 await limit(9);const completions=await Promise.all([pending,competing].map(u=>h.raw(`/api/chest/uploads/${u.id}/complete`,manager,{})));
 assert.deepEqual(completions.map(r=>r.status).sort(),[200,413]);assert.equal((await completions.find(r=>r.status===413).json()).error,'storage_limit_exceeded');
 const done=await completions.find(r=>r.status===200).json();assert.equal(done.state,'complete');assert.equal(await usage(),9);
 const bytes=await h.raw(`/api/chest/items/${done.result.item}/bytes/${done.result.version}?download=true`,manager);assert.ok(['xyz','uvw'].includes(await bytes.text()));
 await h.api(`/uploads/${done.id}/complete`,manager,{});assert.equal(await usage(),9);
 // Erasing the last reference releases retained usage, while a copied original elsewhere stays downloadable.
 await h.api(`/items/${file.id}/erase`,manager,{});assert.equal(await usage(),7);
 await limit(null);await upload('unlimited.txt','additional bytes');assert.equal(await usage(),23);
 assert.equal((await h.raw('/app/storage',owner)).status,200);assert.equal((await h.raw(`/app/spaces/${space.id}/quota`,owner)).status,200);
 const form=new FormData();form.set('path',`/spaces/${space.id}/quota`);form.set('returnTo',`/app/spaces/${space.id}/quota`);form.set('storageLimitBytes','100');
 assert.equal((await h.fetch('/app/action',{method:'POST',headers:{cookie:owner,origin:h.origin},body:form})).status,303);
 assert.equal((await h.api(`/spaces/${space.id}/quota`,owner)).limitBytes,100);
 console.log('QUOTA-001 per-space retained storage and atomic refusal passed');
}finally{await h.close()}
