// The provider is the only fake: real originals, real current ACL and atomic metadata decisions run in the Worker.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import UTIF from 'utif2';
import jpeg from 'jpeg-js';
import {harness} from './harness.mjs';
// Expected source words and coordinates were read independently from the originals.
// The TIFF repeats the same sheet twice; term and state deliberately cite its second page.
export const scanExpectations={
 nda:[
  {field:'Party',value:'Harbor Freight Logistics LLC',page:1,pixels:[184,223,534,249],confidence:.97},
  {field:'Effective date',value:'2026-03-04',page:1,pixels:[268,299,445,325],confidence:.91},
  {field:'Term',value:2,page:2,pixels:[163,373,251,399],confidence:.83},
  {field:'Governing state',value:'California',page:2,pixels:[294,449,409,475],confidence:.58},
 ],
 w9:[
  {field:'Legal name',value:'Acme Supply Inc.',page:1,pixels:[240,224,454,250],confidence:.98},
  {field:'Business type',value:'C Corporation',page:1,pixels:[272,299,442,325],confidence:.89},
  {field:'TIN',value:'***-**-6789',page:1,pixels:[627,373,691,400],confidence:.76},
 ],
};
export const scanHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function scanHarness(){
 let revision=1;const calls=[],errors=[];
 const nda=await readFile('tests/chest/scan-nda.png'),w9=await readFile('tests/chest/scan-w9.png'),original=await readFile('tests/chest/scan-nda.tiff');
 // Decode the uploaded TIFF independently of Chest. These are the exact page bytes
 // the provider must receive and the authenticated page-image door must return.
 const buffer=original.buffer.slice(original.byteOffset,original.byteOffset+original.length),directories=UTIF.decode(buffer);
 const pages=directories.map(directory=>{UTIF.decodeImage(buffer,directory);return Buffer.from(jpeg.encode({width:directory.width,height:directory.height,data:UTIF.toRGBA8(directory)},82).data)});
 const h=await harness({edge:async request=>{
  if(request.url!=='https://api.anthropic.com/v1/messages')return;
  try{
   const body=await request.json(),content=body.messages[0].content,images=content.filter(p=>p.type==='image'),ask=content.filter(p=>p.type==='text').map(p=>p.text).join('\n'),schema=body.output_config.format.schema;
   const transcript='text' in schema.properties;
   assert.ok(images.length>0,'the reader submits actual page images');
   const hashes=images.map(p=>{
    assert.equal(p.source.type,'base64');const bytes=Buffer.from(p.source.data,'base64');
    const type=bytes.equals(nda)||bytes.equals(w9)?'image'+'/png':pages.some(page=>page.equals(bytes))?'image'+'/jpeg':null;
    assert.ok(type,'submitted image is an uploaded photo or a decoded original TIFF page');assert.equal(p.source.media_type,type);
    return scanHash(bytes);
   });
   let pageNumbers=[];
   if(transcript){
    assert.equal(images.length,1);const match=ask.match(/Transcribe page (\d+) of (\d+) of a scanned TIFF/);
    if(match){assert.equal(Number(match[2]),2);assert.ok([1,2].includes(Number(match[1])));assert.equal(hashes[0],scanHash(pages[Number(match[1])-1]));pageNumbers=[Number(match[1])]}
   }else{
    const labels=content.filter(p=>p.type==='text'&&p.text.startsWith('Page '));
    assert.equal(labels.length,images.length);
    labels.forEach((label,i)=>{assert.equal(label.text,`Page ${i+1} (1200×1550 pixels):`);assert.equal(content[content.indexOf(label)+1],images[i],'each numbered page label precedes its own image')});
    pageNumbers=labels.map((_,i)=>i+1);
    if(images[0].source.media_type==='image'+'/jpeg'){assert.equal(images.length,2);images.forEach((_,i)=>assert.equal(hashes[i],scanHash(pages[i])))}else assert.equal(images.length,1);
   }
   calls.push({kind:transcript?'text':'fields',pages:pageNumbers,hashes});
   const fields=[...ask.matchAll(/^- (.+) \((text|number|date|yes\/no)\)$/gm)].map(m=>m[1]);
   // Provider responses are explicit, separate from the expected API and browser
   // values above. A single-page NDA keeps the existing unreadable-field journey.
   const twoPages=images.length===2;
   const readings={
    Party:{value:'Harbor Freight Logistics LLC',page:1,box:[184,223,534,249],confidence:.97},
    'Effective date':{value:twoPages||revision===1?'2026-03-04':'2026-04-09',page:1,box:[268,299,445,325],confidence:.91},
    Term:{value:'2',page:twoPages?2:1,box:[163,373,251,399],confidence:.83},
    'Governing state':{value:'California',page:2,box:[294,449,409,475],confidence:.58},
    'Legal name':{value:'Acme Supply Inc.',page:1,box:[240,224,454,250],confidence:.98},
    'Business type':{value:'C Corporation',page:1,box:[272,299,442,325],confidence:.89},
    TIN:{value:'12-3456789',page:1,box:[627,373,691,400],confidence:.76},
   };
   const answer=transcript?{readable:true,language:'en',confidence:.96,text:`Harbor Freight Logistics and Acme Supply agreement. Revision ${revision}.`}:{fields:fields.map(field=>field==='Governing state'&&!twoPages?{field,found:false,value:'',page:0,box:[0,0,0,0],confidence:0,note:'Not readable.'}:{field,found:true,...readings[field],note:''})};
   return Response.json({content:[{type:'text',text:JSON.stringify(answer)}],usage:{input_tokens:500,output_tokens:150}});
  }catch(error){errors.push(error.message);throw error}
 }});
 h.setRevision=n=>{revision=n};h.scanCalls=calls;h.scanErrors=errors;h.scanImages={nda:pages,w9:[w9]};return h;
}
// Reconcile every proposal with an independent original-specific expectation,
// then inspect immutable original and exact-version page images through public doors.
export async function assertScanProvenance(h,item,cookie,kind){
 const version=item.payload?.current??item.item.current,result=await h.api(`/items/${item.id}/reading`,cookie),read=result.versions.find(v=>v.version===version),expected=scanExpectations[kind];
 assert.ok(read);assert.equal(result.version,version);assert.equal(read.fields.state,'done');assert.equal(read.fields.model,'claude-sonnet-5-5');
 assert.equal(read.fields.proposals.length,expected.length);
 expected.forEach((e,i)=>{
  const p=read.fields.proposals[i];assert.deepEqual({field:p.field,found:p.found,value:p.value,page:p.page,box:p.box,confidence:p.confidence,note:p.note},{field:e.field,found:true,value:e.value,page:e.page,box:e.pixels.map((n,j)=>n/(j%2?1550:1200)),confidence:e.confidence,note:''});
 });
 assert.equal(read.reading.pages.length,kind==='nda'?2:1);
 const pageHashes=[];
 for(const [i,page] of read.reading.pages.entries()){
  assert.deepEqual({n:page.n,width:page.width,height:page.height,image:page.image,source:page.source,state:page.state},{n:i+1,width:1200,height:1550,image:true,source:kind==='nda'?'scan':'photo',state:'done'});
  const response=await h.raw(`/api/chest/items/${item.id}/pages/${read.version}/${page.n}`,cookie);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),kind==='nda'?'image'+'/jpeg':'image'+'/png');
  const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,h.scanImages[kind][i]);pageHashes.push(scanHash(bytes));
 }
 const response=await h.raw(`/api/chest/items/${item.id}/bytes/${read.version}?download=true`,cookie);assert.equal(response.status,200);
 const downloaded=Buffer.from(await response.arrayBuffer()),original=await readFile(`tests/chest/scan-${kind==='nda'?'nda.tiff':'w9.png'}`);
 assert.deepEqual(downloaded,original);const detail=await h.api(`/items/${item.id}`,cookie);assert.equal(detail.versions.find(v=>v.id===read.version).checksum,scanHash(original));
 assert.deepEqual(h.scanErrors,[]);return {reading:read,originalHash:scanHash(downloaded),pageHashes};
}
export async function scanPeople(h){
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const [email,name] of [['dana@example.test','Dana Flores'],['casey@example.test','Casey Chen']])await h.api('/people',owner,{action:'invite',email,name});
 const viewer=await h.signIn('dana@example.test',true),outsider=await h.signIn('casey@example.test',true),space=await h.api('/spaces',owner,{name:'Harbor agreements'});
 await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'dana@example.test',role:'viewer'}]});
 await h.api('/reading/settings',owner,{provider:'anthropic',model:'claude-sonnet-5-5',key:'synthetic-chest-42'});
 await h.api('/reading/policy',owner,{enabled:true,maxCalls:61,maxOutput:2048,retention:'until_original_erased',providerRetention:'Verified synthetic provider: discarded after processing.',residency:'Verified synthetic provider region: US.',verified:true,confirm:true});
 return {owner,viewer,outsider,space};
}
export async function scanFolder(h,owner,space,{type='NDA',name='Harbor NDA.png',required=false}={}){
 const schema=await h.api('/schemas',owner,{name:type,fields:(type==='NDA'?[['Party','text'],['Effective date','date'],['Term','number'],['Governing state','text']]:[['Legal name','text'],['Business type','text'],['TIN','text']]).map(([name,type])=>({name,type,required:required && ['Party','Effective date'].includes(name)}))});
 const folder=await h.api('/items',owner,{space:space.id,type:'folder',name:type+' inbox '+name});await h.api(`/items/${folder.id}/governance`,owner,{reviewer:h.vars.OWNER_EMAIL,schema:schema.id,scanIntake:required});
 return {schema,folder};
}
export async function scannedItem(h,owner,space,{type='NDA',name='Harbor NDA.png',fields={},required=false}={}){
 const {schema,folder}=await scanFolder(h,owner,space,{type,name,required});
 const item=await h.api('/items',owner,{parent:folder.id,name,fields,base64:(await readFile(`tests/chest/scan-${type==='NDA'?'nda':'w9'}.png`)).toString('base64')});return {schema,folder,item};
}
export async function settledFields(h,id,cookie){
 for(let i=0;i<100;i++){const r=await h.api(`/items/${id}/reading?work=1`,cookie);if(r.versions?.at(-1)?.fields?.state==='done')return r.versions.at(-1);await new Promise(r=>setTimeout(r,100))}assert.fail('scan fields did not settle: '+h.scanErrors.join('; '));
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const h=await scanHarness();try{
  const {owner,viewer,outsider,space}=await scanPeople(h),{item,folder,schema}=await scannedItem(h,owner,space,{fields:{Term:3}}),v=item.payload.current;
  const read=await settledFields(h,item.id,owner);assert.equal(read.fields.proposals.length,4);assert.ok(read.fields.proposals[0].box?.every(n=>n>=0&&n<=1));
  await h.api(`/items/${item.id}/fields/${v}`,viewer,{field:'Party',decision:'accept'},403);await h.api(`/items/${item.id}/fields/${v}`,outsider,{field:'Party',decision:'accept'},403);
  await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Party',decision:'accept'});await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Effective date',decision:'accept',value:'2026-03-05'});await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Term',decision:'accept'},409);await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Governing state',decision:'reject'});
  const after=await h.api(`/items/${item.id}`,viewer);assert.deepEqual(after.metadata.filing.fields,{Term:3,Party:'Harbor Freight Logistics LLC','Effective date':'2026-03-05'});
  assert.equal((await h.api('/search?q=Harbor%20Freight%20Logistics',viewer)).count,1);assert.equal((await h.api('/search?q=Harbor%20Freight%20Logistics',outsider)).count,0);
  h.setRevision(2);await h.api(`/items/${item.id}/versions`,owner,{base64:(await readFile('tests/chest/scan-w9.png')).toString('base64')});const changed=await settledFields(h,item.id,owner);assert.deepEqual(changed.fields.proposals.map(p=>p.field),['Effective date','Term'],'only changed or undecided fields are proposed again');
  const previous=(await h.api(`/items/${item.id}/reading`,owner)).versions[0];assert.equal(previous.fields.proposals[0].decision.status,'accepted');
  const w9=await scannedItem(h,owner,space,{type:'W-9',name:'Acme W-9.png'}),tax=await settledFields(h,w9.item.id,owner);assert.equal(tax.fields.proposals.find(p=>p.field==='TIN').value,'***-**-6789');assert.ok(!JSON.stringify(tax.fields).includes('12-3456789'));
  const taxBefore=await assertScanProvenance(h,w9.item,owner,'w9');
  await h.api(`/items/${w9.item.id}/fields/${w9.item.payload.current}`,owner,{field:'TIN',decision:'accept',value:'98-7654321'});assert.equal((await h.api(`/items/${w9.item.id}`,owner)).metadata.filing.fields.TIN,'***-**-4321');
  const required=await h.api('/schemas',owner,{name:'Required NDA',fields:[{name:'Party',type:'text',required:true}]}),intake=await h.api('/items',owner,{space:space.id,type:'folder',name:'Scan intake'});await h.api(`/items/${intake.id}/governance`,owner,{reviewer:h.vars.OWNER_EMAIL,schema:required.id,scanIntake:true});await h.api('/items',owner,{parent:intake.id,name:'Incomplete.txt',base64:Buffer.from('Plain upload').toString('base64')},400);const pending=await h.api('/items',owner,{parent:intake.id,name:'Required NDA.png',base64:(await readFile('tests/chest/scan-nda.png')).toString('base64')});await h.api(`/items/${pending.id}/versions/${pending.payload.current}/review`,owner,{action:'approve'},400);await settledFields(h,pending.id,owner);await h.api(`/items/${pending.id}/fields/${pending.payload.current}`,owner,{field:'Party',decision:'accept'});await h.api(`/items/${pending.id}/versions/${pending.payload.current}/review`,owner,{action:'approve'});
  const reservation=await h.api('/uploads',owner,{parent:intake.id,name:'Incomplete browser text.txt',size:5,lastModified:1});assert.equal((await h.fetch(`/api/chest/uploads/${reservation.id}/parts/1`,{method:'PUT',headers:{cookie:owner,origin:h.origin},body:'plain'})).status,200);await h.api(`/uploads/${reservation.id}/complete`,owner,{},400);assert.ok(!(await h.api(`/items/${intake.id}`,owner)).children.some(i=>i.name==='Incomplete browser text.txt'));await h.api(`/uploads/${reservation.id}/cancel`,owner,{});
  const tiff=await h.api('/items',owner,{parent:folder.id,name:'Faxed Harbor NDA.tiff',base64:(await readFile('tests/chest/scan-nda.tiff')).toString('base64')});
  const fax=await settledFields(h,tiff.id,owner);assert.equal(fax.reading.pages.length,2);assert.ok(fax.reading.pages.every(p=>p.state==='done'&&p.source==='scan'));assert.ok(fax.fields.proposals.some(p=>p.box&&p.page===1));
  const faxBefore=await assertScanProvenance(h,tiff,owner,'nda');
  await h.stop();await h.start();
  assert.deepEqual(await assertScanProvenance(h,tiff,owner,'nda'),faxBefore,'NDA page-specific provenance and original survive Worker restart');
  const taxAfter=await assertScanProvenance(h,w9.item,owner,'w9');assert.deepEqual(taxAfter.reading.fields.proposals.map(({decision,...p})=>p),taxBefore.reading.fields.proposals,'W-9 masked proposals survive a confirmation and Worker restart');
  assert.equal(taxAfter.originalHash,taxBefore.originalHash);assert.deepEqual(taxAfter.pageHashes,taxBefore.pageHashes);
  assert.ok(h.scanCalls.some(c=>c.kind==='fields'&&c.pages.join(',')==='1,2'),'the provider received both numbered NDA page images');
  console.log('PROBE SEARCH-002 1 API: actual two-page TIFF and W-9 originals -> every value, page, confidence and box reconciled, masked TIN, unchanged original hashes and persisted provenance after Worker restart');
  const faxPage=await h.raw(`/api/chest/items/${tiff.id}/pages/${tiff.payload.current}/2`,viewer);assert.equal(faxPage.status,200);assert.equal(faxPage.headers.get('content-type'),'image'+'/jpeg');assert.ok((await faxPage.arrayBuffer()).byteLength>1000);assert.ok((await h.api('/search?q=Harbor%20Freight',viewer)).results.some(r=>r.id===tiff.id));
  // A type edit invalidates stale proposals, and a revoked viewer loses text and page images immediately.
  await h.api(`/schemas/${schema.id}`,owner,{name:'NDA',fields:[{name:'Party',type:'text',required:false}]});await h.api(`/items/${item.id}/fields/${changed.version}`,owner,{field:'Term',decision:'accept'},409);
  await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});await h.api(`/items/${item.id}/reading`,viewer,undefined,403);await h.api(`/items/${item.id}/pages/${v}/1`,viewer,undefined,403);
  const audit=(await h.api('/audit',owner)).filter(e=>e.object_id===item.id&&e.action.startsWith('field.'));assert.ok(audit.length>=3&&audit.every(e=>JSON.parse(e.detail).version===v));
  console.log('SEARCH-002 typed-folder proposals, confirmation, immutable prior decisions, TIN masking and current ACL passed');
 }finally{await h.close()}
 await (await import('./ask-flow.mjs')).askFlow();
}
