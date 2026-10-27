import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {harness} from './harness.mjs';
import {zip} from './fixtures.mjs';

const h=await harness({bindings:{CONTENT_SCANNER_URL:'https://synthetic-chest-scanner.test/scan',CONTENT_SCANNER_TOKEN:'synthetic-chest-1'}}),sha=b=>createHash('sha256').update(b).digest('hex'),b64=b=>Buffer.from(b).toString('base64');
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});
 const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const staff={};for(const name of ['reader','outsider']){await h.api('/people',owner,{action:'invite',email:`${name}@example.test`,name});staff[name]=await h.signIn(`${name}@example.test`,true)}
 const space=(await h.api('/files',owner)).personal;
 const upload=(name,bytes)=>h.api('/items',owner,{space,type:'file',name,base64:b64(bytes),checksum:sha(bytes)});
 const source=[['docs/',''],['docs/nested/terms.txt','synthetic-chest-1'],['../outside.txt','synthetic-chest-2'],['<img src=x onerror=alert(1)>.txt','synthetic-chest-3']];
 const original=zip(source),file=await upload('Evidence.zip',original),v1=file.payload.current;
 const path=(version=v1)=>`/api/chest/items/${file.id}/archive-preview/${version}`;
 const listing=async(version=v1,cookie=owner)=>{const r=await h.raw(path(version),cookie);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return r.json()};
 const first=await listing();
 assert.equal(first.state,'ready');assert.equal(first.version,v1);assert.equal(first.checksum,sha(original));assert.equal(first.originalSize,original.length);assert.equal(typeof first.renderer,'string');assert.ok(first.renderer.length>0,'renderer provenance is present');
 assert.deepEqual(first.entries.map(e=>[e.name,e.directory,e.depth,e.size]),[['docs/',true,0,0],['docs/nested/terms.txt',false,2,17],['../outside.txt',false,1,17],['<img src=x onerror=alert(1)>.txt',false,0,17]]);
 assert.equal(first.files,3);assert.equal(first.directories,1);assert.equal(first.size,51);assert.equal(first.compressedSize,source.reduce((sum,[,text])=>sum+deflateRawSync(Buffer.from(text)).length,0));
 assert.ok(!JSON.stringify(first).includes('synthetic-chest-1'),'no member bytes leave the listing route');
 const html=await(await h.raw(path()+'?format=html',owner)).text();assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;.txt'));assert.ok(!html.includes('<img'));assert.match(html,/\.\.\/outside\.txt/);
 const downloaded=await h.raw(`/api/chest/items/${file.id}/bytes/${v1}?download=true`,owner);assert.equal(sha(Buffer.from(await downloaded.arrayBuffer())),sha(original));
 const replacement=zip([['new.txt','synthetic-chest-4']]),changed=await h.api(`/items/${file.id}/versions`,owner,{name:'Evidence.zip',base64:b64(replacement)}),v2=changed.payload.current;
 assert.notEqual(v2,v1);assert.deepEqual((await listing(v2)).entries.map(e=>e.name),['new.txt']);assert.deepEqual(await listing(v1),first);
 for(const [version,expected] of [[v1,original],[v2,replacement]])assert.equal(sha(Buffer.from(await(await h.raw(`/api/chest/items/${file.id}/bytes/${version}?download=true`,owner)).arrayBuffer())),sha(expected));
 // Refusal states return no partial directory and keep the exact original downloadable.
 const encrypted=Buffer.from(original);encrypted.writeUInt16LE(0x801,6);encrypted.writeUInt16LE(0x801,encrypted.readUInt32LE(encrypted.length-6)+8);
 const inconsistent=Buffer.from(original);inconsistent[30]=120;
 const zip64=Buffer.from(original);zip64.writeUInt16LE(65535,zip64.length-14);zip64.writeUInt16LE(65535,zip64.length-12);
 const cases=[['Broken.zip',original.subarray(0,original.length-5),'malformed'],['Inconsistent.zip',inconsistent,'malformed'],['Encrypted.zip',encrypted,'unsupported'],['Large-directory.zip',zip64,'unsupported'],['Many.zip',zip(Array.from({length:1001},(_,n)=>[`entry-${n}.txt`,''])),'over-bound'],['Deep.zip',zip([['a/'.repeat(65)+'file.txt','synthetic-chest-5']]),'over-bound'],['Other.bin',Buffer.from('synthetic-chest-6'),'unsupported'],['Empty.zip',zip([]),'ready']];
 for(const [name,bytes,state] of cases){const item=await upload(name,bytes),r=await h.api(`/items/${item.id}/archive-preview/${item.payload.current}`,owner);assert.equal(r.state,state,name);assert.deepEqual(r.entries,[],name);assert.equal(sha(Buffer.from(await(await h.raw(`/api/chest/items/${item.id}/bytes/${item.payload.current}?download=true`,owner)).arrayBuffer())),sha(bytes),name)}
 // The resumable upload door admits originals above the listing's independent memory bound.
 const large=Buffer.concat([original,Buffer.alloc(8*1024**2)]),session=await h.api('/uploads',owner,{space,name:'Large.zip',size:large.length,checksum:sha(large)});
 for(let at=0,n=1;at<large.length;at+=session.partSize,n++){const r=await h.fetch(`/api/chest/uploads/${session.id}/parts/${n}`,{method:'PUT',headers:{cookie:owner,origin:h.origin},body:large.subarray(at,at+session.partSize)});assert.equal(r.status,200)}
 const done=await h.api(`/uploads/${session.id}/complete`,owner,{}),over=await h.api(`/items/${done.result.item}/archive-preview/${done.result.version}`,owner);
 assert.equal(over.state,'over-bound');assert.deepEqual(over.entries,[]);assert.equal(sha(Buffer.from(await(await h.raw(`/api/chest/items/${done.result.item}/bytes/${done.result.version}?download=true`,owner)).arrayBuffer())),sha(large));
 // Current grants are checked again for retained originals, even after a restart.
 await h.api(`/items/${file.id}/shares`,owner,{principal:'reader@example.test',role:'viewer'});
 assert.equal((await listing(v1,staff.reader)).files,3);
 await h.api(`/items/${file.id}/settings`,owner,{noDownload:true});
 assert.equal((await h.raw(path(),staff.reader)).status,403);assert.equal((await h.raw(path(),staff.outsider)).status,403);assert.equal((await h.raw(path())).status,401);
 await h.api(`/items/${file.id}/settings`,owner,{noDownload:false});
 await h.api(`/items/${file.id}/unshare`,owner,{principal:'reader@example.test'});
 for(const suffix of ['', '?format=html']){const r=await h.raw(path()+suffix,staff.reader);assert.equal(r.status,403);assert.ok(!(await r.text()).includes('outside.txt'))}
 await h.stop();await h.start();assert.equal((await h.raw(path(),staff.reader)).status,403);assert.deepEqual(await listing(v1),first);
 // Enabling a scanner quarantines an unscanned retained original through the same public policy door.
 await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:true});
 const quarantined=await h.raw(path(),owner);assert.equal(quarantined.status,403);assert.ok(!(await quarantined.text()).includes('outside.txt'));
 console.log('ZIP directory public flow passed: metadata, exact versions and originals, bounded refusal states, permission changes, quarantine and restart');
}finally{await h.close()}
