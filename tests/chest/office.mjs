// One public-door office flow: upload, preview, edit, attributed version, collaborator comment and owner mail.
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {harness} from './harness.mjs';
import {docx,xlsx,pptx} from './office-fixtures.mjs';
const h=await harness(), b64=v=>Buffer.from(v).toString('base64');
try {
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);
 const owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 const members={};
 for(const role of ['editor','viewer']) {
  await h.api('/people',owner,{action:'invite',email:`${role}@example.test`,name:role});
  members[role]=await h.signIn(`${role}@example.test`,true);
 }
 const personal=(await h.api('/files',owner)).personal;
 const files={};
 for(const [ext,bytes,phrase] of [['docx',docx(),'Harbor renewal agreement'],['xlsx',xlsx(),'Harbor logistics'],['pptx',pptx(),'Harbor quarterly review']]) {
  const file=await h.api('/items',owner,{type:'file',space:personal,name:`Harbor.${ext}`,base64:b64(bytes)}); files[ext]=file;
  const preview=await h.api(`/items/${file.id}/office`,owner); assert.equal(preview.kind,ext); assert.ok(preview.html.includes(phrase));
  if(ext==='docx')assert.match(preview.html,/<table[\s>]/);
  if(ext==='xlsx') {assert.ok(preview.html.includes('25000'));assert.ok(preview.html.includes('October forecast'));}
  if(ext==='pptx')assert.ok(preview.html.indexOf('Harbor quarterly review')<preview.html.indexOf('Next quarter priorities'),'presentation relationship order');
  await h.api(`/items/${file.id}/reading?work=1`,owner);
  assert.ok((await h.api(`/search?q=${encodeURIComponent(phrase)}`,owner)).results.some(result=>result.id===file.id),'search finds the words inside each Office format');
 }
 const file=files.docx.id;
 for(const role of ['editor','viewer'])await h.api(`/items/${file}/shares`,owner,{principal:`${role}@example.test`,role});
 const base=await h.api(`/items/${file}/office?edit=true`,members.editor), field=base.fields.find(f=>f.value==='Payment within thirty days.'); assert.ok(field);
 await h.api(`/items/${file}/office?edit=true`,members.viewer,undefined,403);
 await h.api(`/items/${file}/office`,members.viewer,{version:base.version,changes:{[field.key]:'not permitted'}},403);
 assert.ok((await h.api(`/items/${file}/office`,members.viewer)).html.includes('Payment within thirty days.'));
 const saved=await h.api(`/items/${file}/office`,members.editor,{version:base.version,changes:{[field.key]:'Payment within forty-five days.'}});
 const view=await h.api(`/items/${file}`,owner);assert.equal(view.id,file);assert.equal(view.versions.length,2);assert.equal(view.item.current,saved.version);assert.equal(view.versions[0].actor,'editor@example.test');
 assert.ok((await h.api(`/items/${file}/office`,owner)).html.includes('Payment within forty-five days.'));
 assert.equal((await h.api('/search?q=forty-five',owner)).results[0].id,file);
 const raw=await h.raw(`/api/chest/items/${file}/bytes/${saved.version}?download=true`,owner);
 assert.equal(strFromU8(unzipSync(new Uint8Array(await raw.arrayBuffer()))['customXml/item1.xml']),'<custody>keep this unedited part</custody>');
 await h.api(`/items/${file}/office`,owner,{version:base.version,changes:{[field.key]:'conflicting edit'}},409);
 const heading=base.fields.find(f=>f.value==='Harbor renewal agreement');
 await h.api(`/items/${file}/office`,owner,{version:base.version,changes:{[heading.key]:'Harbor signed agreement'}});
 assert.ok((await h.api(`/items/${file}/office`,owner)).html.includes('Payment within forty-five days.'),'independent edit keeps the latest value');
 await h.api(`/items/${file}/presence`,owner,{mode:'editing'});
 const presence=await h.api(`/items/${file}/presence`,members.editor,{mode:'editing'});assert.ok(presence.people.some(p=>p.email===h.vars.OWNER_EMAIL&&p.mode==='editing'));
 assert.ok((await h.api(`/items/${file}/presence`,owner)).people.some(p=>p.email==='editor@example.test'));
 await h.api(`/items/${file}/presence`,members.viewer,{mode:'editing'},403);
 const comment=await h.api(`/items/${file}/comments`,members.editor,{message:'The renewal wording is ready for your approval.'});
 assert.match(comment.email,/accepted|sent/);assert.ok(h.mails.some(m=>[m.to].flat().includes(h.vars.OWNER_EMAIL)&&m.text.includes('The renewal wording is ready for your approval.')),'owner mail reaches the provider edge');
 const link=await h.api(`/items/${file}/public-links`,owner,{password:'safe-preview-password'}),path=new URL(link.url).pathname;
 assert.equal((await h.fetch(`${path}/p/${file}`)).status,401,'password gates direct preview');
 const unlocked=await h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'password=safe-preview-password'}),cookie=unlocked.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 assert.ok((await (await h.fetch(`${path}/p/${file}`,{headers:{cookie}})).text()).includes('Harbor signed agreement'));
 await h.api(`/items/${file}/settings`,owner,{noDownload:true});const rendered=await h.fetch(`${path}/p/${file}`,{headers:{cookie}});assert.equal(rendered.status,200);assert.match(rendered.headers.get('content-type'),/^text\/html/);const renderedHtml=await rendered.text();assert.ok(renderedHtml.includes('Harbor signed agreement')&&renderedHtml.includes('Payment within forty-five days.'));assert.ok(!renderedHtml.includes('keep this unedited part'),'the rendered preview excludes nonvisual original parts');
 for(const headers of [{cookie},{cookie,range:'bytes=0-63'}]){const original=await h.fetch(`${path}/f/${file}`,{headers});assert.equal(original.status,410,'no-download policy refuses original and range requests');assert.ok(!(await original.text()).includes('Harbor signed agreement'),'an original refusal contains no document text')}
 await h.api(`/items/${file}/settings`,owner,{noDownload:false});
 await h.api(`/public-links/${link.link.id}/revoke`,owner,{});assert.equal((await h.fetch(`${path}/p/${file}`,{headers:{cookie}})).status,410);
 const restored=await h.api(`/items/${file}/versions/${base.version}/restore`,owner,{});assert.equal(restored.id,file);
 assert.ok((await h.api(`/items/${file}/office`,owner)).html.includes('Payment within thirty days.'));
 await h.api(`/items/${files.xlsx.id}/shares`,owner,{principal:'editor@example.test',role:'editor'});
 const book=await h.api(`/items/${files.xlsx.id}/office?edit=true`,members.editor),cell=book.fields.find(f=>f.value==='12500');assert.ok(cell);
 await h.api(`/items/${files.xlsx.id}/office`,members.editor,{version:book.version,changes:{[cell.key]:'14500'}});
 assert.ok((await h.api(`/items/${files.xlsx.id}/office`,owner)).html.includes('14500'));
 assert.equal((await h.api(`/items/${files.xlsx.id}`,owner)).versions.length,2);
 console.log('Office core flow passed: previews, Word/Excel saves, merged/conflicting edits, versions/restore, presence, comment email and permission gates');
} finally {await h.close()}

// SHARE-005's external editor transport uses the same stable file and current authority.
await (await import('./wopi-flow.mjs')).wopiFlow();
