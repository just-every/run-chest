// ERASE-001: public erasure workflow, durable custody and denied resurrection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {harness} from './harness.mjs';
const h=await harness(),b64=s=>Buffer.from(s).toString('base64'),sha=s=>createHash('sha256').update(s).digest('hex');
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 await h.api('/people',owner,{action:'invite',email:'departed@example.test',name:'Departed colleague'});const member=await h.signIn('departed@example.test',true);
 const space=(await h.api('/files',owner)).personal,personal=(await h.api('/files',member)).personal;
 const folder=await h.api('/items',owner,{space,type:'folder',name:'Archive project'}),file=await h.api('/items',owner,{parent:folder.id,type:'file',name:'Agreement.txt',base64:b64('sensitive prior version')});
 await h.api(`/items/${file.id}/versions`,owner,{base64:b64('sensitive current version')});
 const link=await h.api(`/items/${folder.id}/public-links`,owner,{download:true});
 await h.api(`/items/${file.id}/comments`,owner,{message:'Sensitive comment to remove'});
 await h.api(`/items/${folder.id}/trash`,owner,{});
 const hold=await h.api('/erasure/holds',owner,{scope:'item',subject:file.id,reason:'Owner preservation instruction'});
 const held=await h.api('/erasure',owner,{item:folder.id});assert.equal(held.payload.state,'held');assert.equal((await h.raw(new URL(link.url).pathname)).status,404);
 await h.api('/erasure/holds',owner,{...hold,active:false});
 const backup=await h.api('/erasure/backups',owner,{name:'Unreachable private archive',locator:'/private/offline/project.rer',retention:'Provider deletion pending until mount is available'});
 await h.api('/erasure',member,{item:folder.id},403);
 const receipt=await h.api('/erasure',owner,{item:folder.id});assert.equal(receipt.payload.state,'pending');assert.ok(receipt.payload.originals.removed.includes(sha('sensitive prior version')));assert.ok(receipt.payload.targets.some(t=>t.backup===backup.id&&t.status==='pending'));
 await h.stop();await h.start();
 assert.equal((await h.raw(`/api/chest/items/${file.id}`,owner)).status,404);assert.equal((await h.raw(`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`,owner)).status,404);
 assert.equal((await h.api('/search?q=sensitive',owner)).results?.length??(await h.api('/search?q=sensitive',owner)).items?.length??0,0);
 const journal=await h.api('/erasure/journal',owner);assert.ok(journal.source);assert.ok(journal.entries.some(e=>e.items.includes(file.id)&&e.checksums.includes(sha('sensitive current version'))));
 await h.api(`/erasure/${receipt.id}/backup-result`,owner,{backup:backup.id,status:'complete',locatorSha256:backup.locatorSha256,verified:false},400);
 const own=await h.api('/items',member,{space:personal,type:'file',name:'Personal notes.txt',base64:b64('personal original')});
 const shared=await h.api('/items',owner,{space,type:'file',name:'Team record.txt',base64:b64('retained team original')});await h.api(`/items/${shared.id}/shares`,owner,{principal:'departed@example.test',role:'editor'});
 await h.api(`/items/${shared.id}/versions`,member,{base64:b64('team contribution')});
 const device=await h.api('/devices',member,{name:'Old laptop',platform:'macos'});
 const personalCollection=await h.api('/collections',owner,{name:'Imported staff evidence'}),personalSchema=await h.api('/schemas',owner,{name:'Evidence',fields:[]});
 const personalArchive=JSON.stringify({format:'chest-archive-1',source:'Employee source',items:[{path:'staff.txt',base64:b64('retained team evidence'),size:22,sha256:sha('retained team evidence'),principals:['departed@example.test']}]});
 const identityImport={archive:personalArchive,collection:personalCollection.id,schema:personalSchema.id,owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL},identityPreview=await h.api('/archive/preview',owner,identityImport);await h.api('/archive/apply',owner,{...identityImport,fingerprint:identityPreview.fingerprint});
 const erased=await h.api('/erasure',owner,{email:'departed@example.test',confirm:'departed@example.test'});assert.equal(erased.payload.identities[0],sha('departed@example.test'));
 assert.equal((await h.raw('/api/chest/files',member)).status,401);assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${device.token}`}})).status,401);
 assert.equal((await h.raw(`/api/chest/items/${own.id}`,owner)).status,404);
 const surviving=await h.api(`/items/${shared.id}`,owner);assert.equal(surviving.versions[0].checksum,sha('team contribution'));assert.match(surviving.versions[0].actor,/Erased person/);
 assert.ok(!(JSON.stringify(await h.api('/audit',owner))).includes('departed@example.test'));
 // Import-kit custody removal is exercised through a real archive import, then repeat import is fenced.
 const collection=await h.api('/collections',owner,{name:'Records'}),schema=await h.api('/schemas',owner,{name:'Contract',fields:[]}),original='imported secret';
 const archive=JSON.stringify({format:'chest-archive-1',source:'Vendor export',items:[{path:'secret.txt',base64:b64(original),size:original.length,sha256:sha(original)}]});
 const input={archive,collection:collection.id,schema:schema.id,owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL};const preview=await h.api('/archive/preview',owner,input);await h.api('/archive/apply',owner,{...input,fingerprint:preview.fingerprint});
 const doc=(await h.api('/library',owner)).documents.find(d=>d.payload.versions.some(v=>v.checksum===sha(original)));assert.ok(doc);
 await h.api(`/documents/${doc.id}/lifecycle`,owner,{action:'trash'});const result=await h.api('/erasure',owner,{document:doc.id});assert.ok(result.payload.originals.removed.includes(sha(original)));
 const repeat=await h.raw('/api/chest/archive/apply',owner,{...input,fingerprint:preview.fingerprint});assert.notEqual(repeat.status,200);
 console.log('ERASE-001 passed: preserved holds, removed versions/authority/custody, revoked identity, durable journal and pending backups');
}finally{await h.close()}
