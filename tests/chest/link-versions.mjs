// Exact-version public links through the built Worker; only the mail-provider edge is faked by the harness.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';

const h=await harness(),people={},b64=v=>Buffer.from(v).toString('base64'),sha=v=>createHash('sha256').update(v).digest('hex');
const check=async(name,fn)=>{await fn();console.log(`${name} passed`)};
const original=docx(),parts=unzipSync(original);
parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Payment within thirty days.','Payment within sixty days after delivery.'));
const replacement=zipSync(parts);
const link=(item,choice={},who='editor',status=200)=>h.api(`/items/${item}/public-links`,people[who],choice,status);
const base=made=>new URL(made.url).pathname;
const text=async(path,status=200)=>{const r=await h.fetch(path);assert.equal(r.status,status);return r.text()};
const download=async(path,expected)=>{const r=await h.fetch(path);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(expected),'the retained original bytes match the selected version')};
const closed=async(path,item,status)=>{for(const suffix of ['',`/p/${item}`,`/f/${item}`])await text(path+suffix,status)};

try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);
 people.owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:people.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 for(const person of ['editor','viewer']){
  await h.api('/people',people.owner,{action:'invite',email:`${person}@example.test`,name:person});
  people[person]=await h.signIn(`${person}@example.test`,true);
 }
 const space=await h.api('/spaces',people.owner,{name:'External deliveries'});
 await h.api(`/spaces/${space.id}/members`,people.owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'editor@example.test',role:'content_manager'},{principal:'viewer@example.test',role:'viewer'}]});
 const folder=await h.api('/items',people.editor,{space:space.id,type:'folder',name:'Client package'});
 const nested=await h.api('/items',people.editor,{parent:folder.id,type:'folder',name:'Working files'});
 let file=await h.api('/items',people.editor,{parent:nested.id,type:'file',name:'terms.docx',base64:b64(original)});
 const a=file.payload.current;
 file=await h.api(`/items/${file.id}/versions`,people.editor,{base64:b64(replacement)});
 const b=file.payload.current;
 let pinned,current,legacy;

 await check('SHARE-001 current and exact retained-version links',async()=>{
  pinned=await link(file.id,{versionMode:'pinned',version:a});
  current=await link(file.id,{versionMode:'current'});
  legacy=await link(file.id);
  assert.equal(pinned.link.versionMode,'pinned');assert.equal(pinned.link.version,a);
  assert.equal(current.link.versionMode,'current');assert.equal(legacy.link.versionMode,'current');
  for(const made of [pinned,current,legacy])await text(base(made));
  await download(`${base(pinned)}/f/${file.id}`,original);
  for(const made of [current,legacy])await download(`${base(made)}/f/${file.id}`,replacement);
  assert.ok((await text(`${base(pinned)}/p/${file.id}`)).includes('Payment within thirty days.'));
  const currentPreview=await text(`${base(current)}/p/${file.id}`);
  assert.ok(currentPreview.includes('Payment within sixty days after delivery.'));
  assert.ok(!currentPreview.includes('Payment within thirty days.'));
  // Caller-supplied version parameters cannot change the link's choice, even to another retained original.
  await download(`${base(pinned)}/f/${file.id}?version=${b}`,original);
  const forced=await text(`${base(pinned)}/p/${file.id}?version=${b}`);
  assert.ok(forced.includes('Payment within thirty days.')&&!forced.includes('Payment within sixty days after delivery.'));
  await h.api(`/items/${file.id}/versions/${a}/restore`,people.editor,{});
  for(const made of [pinned,current,legacy])await download(`${base(made)}/f/${file.id}`,original);
  const later=await h.api(`/items/${file.id}/versions`,people.editor,{base64:b64(replacement)});
  await download(`${base(pinned)}/f/${file.id}`,original);
  await download(`${base(current)}/f/${file.id}`,replacement);
  const retained=await h.raw(`/api/chest/items/${file.id}/bytes/${a}?download=true`,people.editor);
  assert.equal(retained.status,200);assert.equal(sha(Buffer.from(await retained.arrayBuffer())),sha(original));
  const audit=(await h.api('/audit',people.owner)).filter(e=>e.action==='link.download'&&e.object_id===file.id);
  assert.ok(audit.some(e=>{const d=JSON.parse(e.detail);return d.link===pinned.link.id&&d.version===a}));
  assert.ok(audit.some(e=>{const d=JSON.parse(e.detail);return d.link===current.link.id&&d.version===later.payload.current}));
 });

 await check('SHARE-001 rejects unsupported and foreign version choices',async()=>{
  await link(file.id,{versionMode:'pinned',version:a},'viewer',403);
  await link(file.id,{versionMode:'approved'},'editor',400);
  await link(file.id,{versionMode:'unknown'},'editor',400);
  await link(file.id,{versionMode:'pinned'},'editor',400);
  await link(file.id,{versionMode:'current',version:a},'editor',400);
  const other=await h.api('/items',people.editor,{space:space.id,type:'file',name:'unrelated.docx',base64:b64(replacement)});
  await link(file.id,{versionMode:'pinned',version:other.payload.current},'editor',404);
  await text(`${base(pinned)}/f/${other.id}`,404);await text(`${base(pinned)}/p/${other.id}`,404);
  // An ordinary file has no approved pointer. A rejected approved-only request never creates a current link.
  const listed=(await h.api(`/items/${file.id}`,people.editor)).publicLinks;
  assert.deepEqual(listed.map(l=>l.id).sort(),[pinned.link.id,current.link.id,legacy.link.id].sort());
  assert.equal(listed.find(l=>l.id===pinned.link.id).version,a);
 });

 await check('SHARE-001 version choice preserves current public-link authorization',async()=>{
  const whole=await link(folder.id,{versionMode:'current'}),path=base(whole);
  assert.ok((await text(path)).includes('terms.docx'));
  await h.api(`/items/${nested.id}/settings`,people.owner,{restricted:true});
  const hidden=await text(path);assert.ok(!hidden.includes('terms.docx')&&!hidden.includes('Working files'));
  await text(`${path}/p/${file.id}`,404);await text(`${path}/f/${file.id}`,404);
  // The direct pinned link also ends when its creator loses the right to share the restricted child.
  await closed(base(pinned),file.id,404);
  await h.api(`/items/${nested.id}/settings`,people.owner,{restricted:false});
  await download(`${base(pinned)}/f/${file.id}`,original);
  await h.api(`/items/${file.id}/settings`,people.owner,{noDownload:true});
  assert.ok((await text(`${base(pinned)}/p/${file.id}`)).includes('Payment within thirty days.'));await text(`${base(pinned)}/f/${file.id}`,410);
  await h.api(`/items/${file.id}/settings`,people.owner,{noDownload:false});
  await h.api(`/public-links/${pinned.link.id}/revoke`,people.editor,{});
  await closed(base(pinned),file.id,410);
  await h.api(`/spaces/${space.id}/members`,people.owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'viewer@example.test',role:'viewer'}]});
  await closed(base(current),file.id,404);
 });
}finally{await h.close()}
