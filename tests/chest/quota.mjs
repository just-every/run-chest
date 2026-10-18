// QUOTA-001: one retained-storage journey through the built Worker's public doors, including concurrent admission.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),b64=v=>Buffer.from(v).toString('base64');
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);
 const owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 await h.api('/people',owner,{action:'invite',email:'manager@example.test',name:'Manager'});
 const manager=await h.signIn('manager@example.test',true),space=await h.api('/spaces',manager,{name:'Operations'});
 const limit=async(n,id=space.id)=>{const body={storageLimitBytes:n},r=await h.raw(`/api/chest/spaces/${id}/quota`,owner,body);if(r.status===409){const preview=await r.json();assert.equal(preview.error,'storage_limit_confirmation_required');assert.ok(preview.overLimit.some(r=>r.id===id));return h.api(`/spaces/${id}/quota`,owner,{...body,confirmOverLimit:true,confirmation:preview.confirmation})}assert.equal(r.status,200,await r.clone().text());return r.json()};
 const usage=async(id=space.id)=>(await h.api(`/spaces/${id}/quota`,owner)).usedBytes;
 const upload=(name,value,id=space.id)=>h.api('/items',manager,{space:id,name,type:'file',base64:b64(value)});
 const refused=async(path,body)=>{const r=await h.raw('/api/chest'+path,manager,body);assert.equal(r.status,413,await r.clone().text());const error=await r.json();assert.equal(error.error,'storage_limit_exceeded');assert.equal(error.scope,'space');assert.ok(Number.isSafeInteger(error.limitBytes));assert.ok(Number.isSafeInteger(error.usedBytes));assert.ok(error.space)};
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
 // QUOTA-001 inherited personal/group/user rules, confirmation, crossing notices and audit.
 const personal=(await h.api('/files',manager)).personal;
 const policy=async body=>{const r=await h.raw('/api/chest/quota-policy',owner,body);if(r.status===409){const p=await r.json();assert.equal(p.error,'storage_limit_confirmation_required');assert.ok(p.overLimit.length);return h.api('/quota-policy',owner,{...body,confirmOverLimit:true,confirmation:p.confirmation})}assert.equal(r.status,200,await r.clone().text());return r.json()};
 await policy({scope:'personal-default',limitBytes:4});
 assert.equal((await h.api(`/spaces/${personal}/quota`,owner)).limitBytes,4);
 const group=await h.api('/groups',owner,{name:'Operations',members:['manager@example.test']}),second=await h.api('/groups',owner,{name:'Team leads',members:['manager@example.test']});
 await policy({scope:'group',target:group.id,limitBytes:10});assert.equal((await h.api(`/spaces/${personal}/quota`,owner)).limitBytes,10);
 await policy({scope:'group',target:second.id,limitBytes:20});assert.equal((await h.api(`/spaces/${personal}/quota`,owner)).limitBytes,20);
 await policy({scope:'user',target:'manager@example.test',limitBytes:10});assert.equal((await h.api(`/spaces/${personal}/quota`,owner)).rule,'User override');
 const warnings=()=>h.mails.filter(m=>[m.to].flat().includes('manager@example.test')&&/Personal storage/.test(m.text));
 const initial=warnings().length;
 const personalFile=await upload('retained.txt','12345678',personal);assert.equal(warnings().length,initial);
 await upload('crossing.txt','9',personal);assert.equal(warnings().length,initial+1);
 await upload('deduplicated.txt','9',personal);assert.equal(warnings().length,initial+1);
 assert.ok((await h.api('/notices',manager)).some(r=>r.payload.type==='storage.warning'&&/9 bytes used of 10/.test(r.payload.message)));
 await policy({scope:'user',target:'manager@example.test',limitBytes:20});await policy({scope:'user',target:'manager@example.test',limitBytes:10});assert.equal(warnings().length,initial+2,'a new crossing after a raise warns again');
 const pendingLimit={scope:'user',target:'manager@example.test',limitBytes:3},preview=await h.api('/quota-policy',owner,pendingLimit,409);
 assert.ok(preview.overLimit.some(r=>r.id===personal&&r.usedBytes===9&&r.limitBytes===3));assert.equal((await h.api(`/spaces/${personal}/quota`,owner)).limitBytes,10);
 await h.api('/quota-policy',owner,{...pendingLimit,confirmOverLimit:true},409);
 await h.api(`/items/${personalFile.id}/versions`,manager,{base64:b64('0')});
 const stale=await h.api('/quota-policy',owner,{...pendingLimit,confirmOverLimit:true,confirmation:preview.confirmation},409);assert.equal(stale.overLimit.find(r=>r.id===personal).usedBytes,10,'changed usage requires a new confirmation');
 await policy(pendingLimit);
 const blocked=await h.api('/items',manager,{space:personal,name:'held.txt',base64:b64('blocked')},413);assert.deepEqual([blocked.scope,blocked.limitBytes,blocked.usedBytes,blocked.space],['user',3,10,personal]);
 const pd=await h.api(`/items/${personalFile.id}`,manager);assert.equal(await(await h.raw(`/api/chest/items/${personalFile.id}/bytes/${personalFile.payload.current}?download=true`,manager)).text(),'12345678');
 await h.api(`/items/${personalFile.id}/trash`,manager,{});assert.equal(await usage(personal),10);await h.api(`/items/${personalFile.id}/erase`,manager,{});assert.equal(await usage(personal),1);await upload('resumed-after-erasure.txt','ok',personal);
 const inherited=await h.api('/spaces',manager,{name:'Inherited default'});await policy({scope:'space-default',limitBytes:12});assert.equal((await h.api(`/spaces/${inherited.id}/quota`,owner)).limitBytes,12);
 await limit(30,inherited.id);await policy({scope:'space-default',limitBytes:6});assert.equal((await h.api(`/spaces/${inherited.id}/quota`,owner)).limitBytes,30);
 await h.api('/people',owner,{action:'invite',email:'service-admin@example.test',name:'Service administrator'});const serviceAdmin=await h.signIn('service-admin@example.test',true);
 await h.api('/administration/roles',owner,{email:'service-admin@example.test',role:'service-settings',scope:'groups',groups:[group.id],super:false});
 await h.api('/quota-policy',serviceAdmin,{scope:'group',target:group.id,limitBytes:40});
 await h.api('/quota-policy',serviceAdmin,{scope:'space-default',limitBytes:99},403);await h.api('/quota-policy',serviceAdmin,{scope:'user',target:h.vars.OWNER_EMAIL,limitBytes:99},403);
 const scoped=await h.api('/quota-policy',serviceAdmin);assert.equal(scoped.organizationAllowed,false);assert.ok(scoped.rows.every(r=>r.owner==='manager@example.test'||r.id===space.id||r.id===other.id||r.id===inherited.id));
 const virtual=(await h.api('/quota-policy',owner)).rows.find(r=>r.owner==='service-admin@example.test');assert.ok(virtual);assert.equal((await h.api(`/spaces/${virtual.id}/quota`,owner)).usedBytes,0);await h.api(`/spaces/${virtual.id}/quota`,owner,{storageLimitBytes:50});assert.equal((await h.api(`/spaces/${virtual.id}/quota`,owner)).limitBytes,50);
 const audit=await h.api('/audit',owner);assert.ok(audit.some(r=>r.action==='quota.policy'&&JSON.parse(r.detail).before&&JSON.parse(r.detail).after));assert.ok(audit.some(r=>r.action==='space.quota'&&JSON.parse(r.detail).before&&JSON.parse(r.detail).after));
 console.log('QUOTA-001 per-space retained storage and atomic refusal passed');
}finally{await h.close()}
