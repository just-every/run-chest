// VERSION-001: a colleague's restore reaches open delivered editors without losing unsaved work.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {tooltips} from './tooltip-proof.mjs';
import {docx,xlsx} from './office-fixtures.mjs';
export async function officeRestoreJourney(h,context,owner,width){
 const space=await h.api('/spaces',owner,{name:`Remote restore ${width}`});
 const email=`restorer-${width}@example.test`;
 await h.api('/people',owner,{action:'invite',email,name:'Restore colleague'});
 const colleague=await h.signIn(email,true);
 await h.api(`/spaces/${space.id}/member`,owner,{action:'add',principal:email,role:'contributor'});
 for(const [ext,bytes,before,after,unsaved] of [['docx',docx(),'Payment within thirty days.','Payment within forty-five days.','My unsaved payment terms.'],['xlsx',xlsx(),'12500','14500','16500']]){
  const file=await h.api('/items',owner,{space:space.id,type:'file',name:`Remote restore.${ext}`,base64:Buffer.from(bytes).toString('base64')});
  const original=await h.api(`/items/${file.id}/office?edit=true`,owner),field=original.fields.find(f=>f.value===before);assert.ok(field);
  const newer=await h.api(`/items/${file.id}/office`,owner,{version:original.version,changes:{[field.key]:after}});
  const clean=await context.newPage(),dirty=await context.newPage();
  const input=p=>p.locator('[name="office:'+field.key+'"]');
  for(const p of [clean,dirty]){await p.goto(`${h.origin}/app/items/${file.id}?edit=1`);assert.equal(await input(p).inputValue(),after)}
  await input(dirty).fill(unsaved);
  const restored=await h.api(`/items/${file.id}/versions/${original.version}/restore`,colleague,{});
  const current=(await h.api(`/items/${file.id}`,owner)).item.current;
  assert.equal(restored.id,file.id);assert.notEqual(current,newer.version);
  // The ordinary poll must deliver the change, with no reload or event injected by the test.
  await clean.waitForFunction(({name,value})=>document.getElementsByName(name)[0]?.value===value,{name:'office:'+field.key,value:before},{timeout:35000});
  await dirty.frameLocator('iframe[title="Office preview"]').getByText(before,{exact:true}).waitFor({timeout:35000});
  assert.equal(await input(dirty).inputValue(),unsaved);
  assert.equal(await dirty.locator('.office-editor input[name="version"]').inputValue(),newer.version,'unsaved edits retain their true base');
  assert.equal(await clean.locator('.office-editor input[name="version"]').inputValue(),current);
  assert.equal((await h.api(`/items/${file.id}`,owner)).versions.length,3,'polling never saves a version');
  for(const [name,p] of [['current',clean],['unsaved',dirty]]){
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.locator('.office-panel').screenshot({path:`test-results/${width}-restore-${ext}-${name}.png`});
  }
  const conflict=dirty.waitForResponse(r=>new URL(r.url()).pathname==='/app/action'&&r.request().method()==='POST');
  await dirty.getByRole('button',{name:'Save new version',exact:true}).click();assert.equal((await conflict).status(),409);
  const retained=await h.api(`/items/${file.id}`,owner);assert.equal(retained.item.current,current);assert.equal(retained.versions.length,3);
  assert.ok((await h.api(`/items/${file.id}/office?edit=true`,owner)).fields.some(f=>f.value===before));
  await clean.close();await dirty.close();
 }
 console.log(`VERSION-001 remote restore: DOCX/XLSX clean refresh, unsaved input and true base preserved, conflict refusal, no timer writes at ${width}`);
}

// The archive public door retains the source of an imported original on every restored version.
export async function migrationArrivalJourney(h,context,owner,width){
 const collection=await h.api('/collections',owner,{name:`Migration history ${width}`}),schema=await h.api('/schemas',owner,{name:`Imported record ${width}`,fields:[{name:'reference',type:'text',required:true}]});
 const original=Buffer.from('synthetic-chest-1'),source=`synthetic-chest-${width}`,path='Supplier record.txt',timestamp='2026-10-01T12:00:00Z';
 const archive=JSON.stringify({format:'chest-archive-1',source,items:[{path,sourceId:'synthetic-chest-2',timestamp,size:original.length,sha256:createHash('sha256').update(original).digest('hex'),base64:original.toString('base64'),fields:{reference:'synthetic-chest-3'}}]});
 const input={archive,collection:collection.id,schema:schema.id,owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL},preview=await h.api('/archive/preview',owner,input);
 assert.equal((await h.api('/archive/apply',owner,{...input,fingerprint:preview.fingerprint})).state,'completed');
 const imported=(await h.api('/library',owner)).documents.find(row=>row.payload.source?.archive===source),version=imported.payload.versions[0];
 assert.equal(version.arrival,'migration');assert.equal(imported.payload.approved,null);
 await h.api(`/documents/${imported.id}/history/${version.id}/restore`,owner,{});
 let reading;for(let attempt=0;attempt<100;attempt++){reading=await h.api(`/documents/${imported.id}/reading?work=1`,owner);if(reading.versions.every(v=>!v.reading||!['queued','reading'].includes(v.reading.state)))break;await new Promise(resolve=>setTimeout(resolve,100))}
 assert.ok(reading.versions.every(v=>!v.reading||!['queued','reading'].includes(v.reading.state)),'source extraction settles before inspecting history controls');
 const p=await context.newPage();await p.goto(`${h.origin}/app/documents/${imported.id}`);
 const entries=p.locator('article.ver');assert.equal(await entries.count(),2);
 for(const entry of await entries.all()){assert.ok((await entry.innerText()).includes(`Migration source: ${source}`));assert.ok((await entry.innerText()).includes('Source ID: synthetic-chest-2'));assert.ok((await entry.innerText()).includes(`Source time: ${timestamp}`))}
 assert.ok((await entries.first().innerText()).includes('Restored by'));assert.ok((await entries.last().innerText()).includes('Imported by'));
 await tooltips(p,width,'migration-history');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:`test-results/${width}-migration-version-history.png`,fullPage:true});await p.close();
 console.log(`VERSION-001 migration source and restored lineage shown at ${width}`);
}
