import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {png,pdf} from './fixtures.mjs';
import {harness} from './harness.mjs';
const h=await harness();const bytes=s=>Buffer.from(s).toString('base64');const hash=s=>createHash('sha256').update(s).digest('hex');
let owner,member,stranger,collection,schema,doc;
const check=async(id,fn)=>{await fn();console.log(`${id} passed`)};
try{
 await check('CHEST-01',async()=>{
  assert.equal((await (await h.raw('/setup/state')).json()).state,'unclaimed');
  assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);
  assert.notEqual((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Second'})).status,303);
  owner=await h.signIn(h.vars.OWNER_EMAIL);assert.equal((await h.raw('/__dev/outbox')).status,404);const signedIn=await h.raw('/signin',owner);assert.equal(signedIn.status,303);assert.equal(signedIn.headers.get('location'),'/app/files','a signed-in visit to sign-in opens Files');assert.equal((await h.raw('/missing')).status,404);assert.equal((await h.raw('/')).status,200);
  assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})).status,303);
  assert.equal((await (await h.raw('/setup/state')).json()).state,'claimed');
  await h.api('/people',owner,{action:'invite',email:'reviewer@example.test',name:'Reviewer'});member=await h.signIn('reviewer@example.test',true);
  await h.api('/people',owner,{action:'invite',email:'outsider@example.test',name:'Outsider'});stranger=await h.signIn('outsider@example.test',true);
  await h.api('/library',member);await h.api('/library',stranger);
  const sessions=await h.api('/people',owner,{action:'sessions',email:'outsider@example.test'});await h.api('/people',owner,{action:'revoke',email:'outsider@example.test',session:sessions.find(s=>s.active).id});await h.api('/library',stranger,undefined,401);stranger=await h.signIn('outsider@example.test');await h.api('/people',owner,{action:'deactivate',email:'outsider@example.test'});await h.api('/library',stranger,undefined,401);await h.api('/people',owner,{action:'reactivate',email:'outsider@example.test'});await h.api('/library',stranger,undefined,401);stranger=await h.signIn('outsider@example.test');
 });
 await check('CHEST-02',async()=>{
  collection=await h.api('/collections',owner,{name:'Supplier certificates'});schema=await h.api('/schemas',owner,{name:'Certificate',fields:[{name:'policy',type:'text',required:true},{name:'amount',type:'number',required:false}]});
  await h.api('/collections',member,{name:'Unauthorized'},403);
  await h.api(`/collections/${collection.id}/grants`,owner,{grants:[{principal:'reviewer@example.test',role:'reviewer'},{principal:'reviewer@example.test',role:'editor'}]});
  const typed=await h.api('/schemas',owner,{name:'Typed evidence',fields:[{name:'reference',type:'text',required:true},{name:'amount',type:'number',required:true},{name:'effective',type:'date',required:true},{name:'covered',type:'boolean',required:true}]});
  const sample={title:'Typed evidence',collection:collection.id,schema:typed.id,fields:{reference:'Keep original',amount:250,effective:'2028-02-29',covered:false},owner:h.vars.OWNER_EMAIL,reviewer:'reviewer@example.test',filename:'typed.txt',base64:bytes('typed original')};
  for(const fields of [{...sample.fields,effective:'2027-02-29'},{...sample.fields,covered:'false'},{...sample.fields,covered:undefined}])await h.api('/documents',owner,{...sample,fields},400);
  const record=await h.api('/documents',owner,sample);assert.deepEqual(record.payload.fields,sample.fields);
  await h.api(`/schemas/${typed.id}`,member,{...typed.payload,name:'Unauthorized'},403);
  for(const fields of [[{name:'x',type:'text',required:true},{name:'x',type:'date',required:false}],[{name:'x',type:'unsupported',required:true}]])await h.api(`/schemas/${typed.id}`,owner,{name:'Invalid',fields},400);
  assert.deepEqual((await h.api('/library',owner)).schemas.find(r=>r.id===typed.id),typed);
  const changed={name:'Updated evidence',fields:[{name:'amount',type:'text',required:true},{name:'effective',type:'date',required:true},{name:'covered',type:'boolean',required:true},{name:'expires',type:'date',required:true}]};
  // Exercise the ordinary owner form, which dispatches through the same public API.
  const form=new FormData();form.set('path',`/schemas/${typed.id}`);form.set('returnTo','/app/admin');form.set('name',changed.name);changed.fields.forEach((f,n)=>{form.set(`f.${n}.name`,f.name);form.set(`f.${n}.type`,f.type);if(f.required)form.set(`f.${n}.required`,'true')});form.set('f.9.name','');
  assert.equal((await h.fetch('/app/action',{method:'POST',headers:{cookie:owner,origin:h.origin},body:form,redirect:'manual'})).status,303);
  assert.deepEqual((await h.api('/library',owner)).schemas.find(r=>r.id===typed.id).payload,changed);
  const diagnosed=await h.api(`/documents/${record.id}`,member);assert.deepEqual(diagnosed.payload,record.payload);assert.equal(diagnosed.revision,record.revision);
  assert.deepEqual(diagnosed.fieldIssues.map(i=>[i.field,i.code]),[['reference','unknown_field'],['amount','invalid_field_amount'],['expires','required_field_expires']]);
  assert.deepEqual((await h.api('/library',member)).documents.find(r=>r.id===record.id).fieldIssues,diagnosed.fieldIssues);
  await h.api(`/documents/${record.id}`,stranger,undefined,404);assert.equal((await h.api('/library',stranger)).count,0);
  await h.api('/documents',owner,sample,400);await h.api(`/documents/${record.id}/filing`,owner,sample,400);await h.api(`/documents/${record.id}/versions`,owner,{filename:'pending.txt',base64:bytes('pending')},400);
  assert.deepEqual((await h.api(`/documents/${record.id}`,owner)).payload,record.payload);
  const corrected={amount:'250',effective:'2028-02-29',covered:false,expires:'2029-01-01'};
  await h.api(`/documents/${record.id}/filing`,owner,{...sample,fields:corrected});assert.deepEqual((await h.api(`/documents/${record.id}`,owner)).fieldIssues,[]);
  assert.deepEqual((await h.api(`/documents/${record.id}`,owner)).payload.fields,corrected);
  await h.api(`/documents/${record.id}/lifecycle`,owner,{action:'trash'});
 });
 const filing=()=>({title:'Acme liability',collection:collection.id,schema:schema.id,fields:{policy:'POL-001',amount:500},owner:h.vars.OWNER_EMAIL,reviewer:'reviewer@example.test',reference:{kind:'supplier',name:'Acme'},reviewDate:'2026-12-01',expiryDate:'2027-01-01'});
 await check('CHEST-03',async()=>{
  await h.api('/documents',owner,{...filing(),reviewDate:false,filename:'proof.txt',base64:bytes('private original')},400);
  await h.api('/documents',owner,{...filing(),fields:{policy:'  '},filename:'proof.txt',base64:bytes('private original')},400);
  await h.api('/documents',owner,{...filing(),fields:{policy:'x',amount:'wrong'},filename:'proof.txt',base64:bytes('private original')},400);
  await h.api('/documents',owner,{...filing(),filename:'proof.txt',base64:bytes('private original'),checksum:'wrong'},400);
  assert.equal((await h.api('/library',owner)).count,0);
  for(const offset of [-1,1]){
   const original=Buffer.from(`synthetic-chest-size-${offset<0?'under':'over'}`),before=await h.api('/library',owner);
   const refused=await h.api('/documents',owner,{...filing(),filename:'size-check.txt',base64:original.toString('base64'),checksum:hash(original),size:original.length+offset},400);
   assert.equal(refused.error,'size_mismatch');
   const after=await h.api('/library',owner);assert.equal(after.count,before.count);assert.deepEqual(after.documents,before.documents);
  }
  doc=await h.api('/documents',owner,{...filing(),filename:'proof.txt',base64:bytes('private original'),checksum:hash('private original'),size:16});
  doc=await h.api(`/documents/${doc.id}`,owner);
  assert.equal(doc.payload.versions[0].checksum,hash('private original'));assert.equal(doc.payload.versions[0].size,16);
  const downloaded=await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions[0].id}?download=true`,owner);
  assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),Buffer.from('private original'));
 });
 await check('CHEST-04',async()=>{
  doc=await h.api(`/documents/${doc.id}/filing`,owner,{...filing(),reference:{kind:'customer',name:'Client'}});assert.equal(doc.payload.reference.kind,'customer');assert.equal(doc.payload.versions[0].filename,'proof.txt');
  doc=await h.api(`/documents/${doc.id}/filing`,owner,{...filing(),reference:{kind:'project',name:'Project'}});assert.equal(doc.payload.reference.name,'Project');
  doc=await h.api(`/documents/${doc.id}/review/${doc.payload.versions[0].id}`,member,{action:'approve'});
  const destination=await h.api('/collections',owner,{name:'Customer evidence'}),before=await h.api(`/documents/${doc.id}`,owner);
  await h.api(`/documents/${doc.id}/filing`,member,{...filing(),collection:destination.id},404);
  assert.deepEqual(await h.api(`/documents/${doc.id}`,owner),before);
  // A document-level editor grant still cannot grant destination collection access.
  await h.api(`/documents/${doc.id}/grants`,owner,{grants:[{principal:'reviewer@example.test',role:'editor'}]});
  const granted=await h.api(`/documents/${doc.id}`,owner);await h.api(`/documents/${doc.id}/filing`,member,{...filing(),collection:destination.id},404);assert.deepEqual(await h.api(`/documents/${doc.id}`,owner),granted);
  await h.api(`/documents/${doc.id}/grants`,owner,{grants:[]});
  await h.api(`/collections/${destination.id}/grants`,owner,{grants:[{principal:'reviewer@example.test',role:'editor'},{principal:'outsider@example.test',role:'reader'}]});
  doc=await h.api(`/documents/${doc.id}/filing`,member,{...filing(),collection:destination.id});assert.equal(doc.payload.collection,destination.id);assert.deepEqual(doc.payload.versions,before.payload.versions);assert.equal(doc.payload.approved,before.payload.approved);
  await h.api(`/documents/${doc.id}`,stranger);assert.equal((await h.api('/library?q=private%20original',stranger)).count,1);
  assert.equal((await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions[0].id}`,stranger)).status,200);
  await h.api(`/collections/${destination.id}/grants`,owner,{grants:[{principal:'outsider@example.test',role:'reader'}]});
  await h.api(`/documents/${doc.id}/filing`,member,filing(),404);
  assert.equal((await h.api(`/documents/${doc.id}`,owner)).payload.collection,destination.id);
  doc=await h.api(`/documents/${doc.id}/filing`,owner,filing());assert.equal(doc.payload.collection,collection.id);assert.deepEqual(doc.payload.versions,before.payload.versions);
  await h.api(`/documents/${doc.id}`,stranger,undefined,404);assert.equal((await h.api('/library?q=private%20original',stranger)).count,0);assert.equal((await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions[0].id}`,stranger)).status,404);
 });
 await check('CHEST-05',async()=>{
  let r=await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions[0].id}`,member);assert.equal(r.status,200);assert.equal(await r.text(),'private original');assert.ok(r.headers.get('content-security-policy').includes('sandbox'));
  doc=await h.api(`/documents/${doc.id}/versions`,owner,{filename:'unknown.bin',base64:Buffer.from([0,1,2,3]).toString('base64')});const v=doc.payload.versions.at(-1);assert.equal((await h.raw(`/api/chest/documents/${doc.id}/bytes/${v.id}`,member)).status,415);assert.equal((await h.raw(`/api/chest/documents/${doc.id}/bytes/${v.id}?download=true`,member)).status,200);
  for(const [filename,content,type] of [['active.svg','<svg onload="alert(1)"></svg>','text/plain'],['safe.pdf',pdf(),'application/pdf'],['pixel.png',png,'image/png']]){doc=await h.api(`/documents/${doc.id}/versions`,owner,{filename,base64:bytes(content)});r=await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions.at(-1).id}`,member);assert.equal(r.headers.get('content-type'),type)}
 });
 await check('CHEST-06',async()=>{
  assert.equal((await h.api('/library?q=private%20original',member)).count,1);assert.equal((await h.api('/library?q=private%20original',stranger)).count,0);
  await h.api(`/documents/${doc.id}`,stranger,undefined,404);assert.equal((await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions[0].id}`,stranger)).status,404);
  await h.api(`/documents/${doc.id}/versions`,stranger,{filename:'bad.txt',base64:bytes('bad')},404);
 });
 await check('CHEST-07',async()=>{
  const a=doc.payload.versions[0].id;assert.equal(doc.payload.approved,a);
  doc=await h.api(`/documents/${doc.id}/versions`,owner,{filename:'B.txt',base64:bytes('replacement B')});const b=doc.payload.versions.at(-1).id;
  doc=await h.api(`/documents/${doc.id}/versions`,owner,{filename:'C.txt',base64:bytes('pending C')});assert.equal(doc.payload.approved,a);
  doc=await h.api(`/documents/${doc.id}/review/${b}`,member,{action:'approve'});assert.equal(doc.payload.approved,b);assert.equal(doc.payload.versions.at(-1).state,'submitted');
 });
 await check('CHEST-08',async()=>{
  const c=doc.payload.versions.at(-1).id;await h.api(`/documents/${doc.id}/review/${c}`,owner,{action:'approve'},403);
  doc=await h.api(`/documents/${doc.id}/review/${c}`,member,{action:'changes',message:'Confirm dates'});await h.api(`/documents/${doc.id}/review/${c}`,member,{action:'approve'},409);
  doc=await h.api(`/documents/${doc.id}/review/${c}`,owner,{action:'comment',message:'Evidence attached'});
  const history=structuredClone(doc.payload.versions),approved=doc.payload.approved;
  await h.api(`/documents/${doc.id}/review/${c}`,owner,{action:'resubmit'},400);
  doc=await h.api(`/documents/${doc.id}/versions`,owner,{filename:'corrected.txt',base64:bytes('dates corrected with new evidence')});
  const replacement=doc.payload.versions.at(-1);assert.notEqual(replacement.id,c);assert.equal(replacement.state,'submitted');assert.equal(replacement.actor,h.vars.OWNER_EMAIL);assert.deepEqual(doc.payload.versions.slice(0,-1),history);assert.equal(doc.payload.approved,approved);
  assert.equal(history.at(-1).state,'changes');assert.equal(history.at(-1).events[0].actor,'reviewer@example.test');
  assert.equal(await(await h.raw(`/api/chest/documents/${doc.id}/bytes/${replacement.id}`,member)).text(),'dates corrected with new evidence');
  doc=await h.api(`/documents/${doc.id}/review/${replacement.id}`,member,{action:'approve'});assert.equal(doc.payload.approved,replacement.id);assert.deepEqual(doc.payload.versions.slice(0,-1),history);

 });
 await check('CHEST-09',async()=>{
  const before=await h.api(`/documents/${doc.id}`,owner),evidence='Called supplier; verified coverage against original';
  await h.api(`/documents/${doc.id}/lifecycle`,owner,{action:'complete',kind:'review',evidence:''},400);
  assert.deepEqual(await h.api(`/documents/${doc.id}`,owner),before,'empty evidence leaves the record unchanged');
  doc=await h.api(`/documents/${doc.id}/lifecycle`,owner,{action:'complete',kind:'review',evidence});
  assert.equal(doc.payload.completions.length,1);
  const completion=doc.payload.completions[0];
  assert.deepEqual({kind:completion.kind,date:completion.date,actor:completion.actor,evidence:completion.evidence},{kind:'review',date:'2026-12-01',actor:h.vars.OWNER_EMAIL,evidence});
  assert.ok(Number.isFinite(Date.parse(completion.at)),'completion records its timestamp');
  assert.equal(doc.payload.expiryDate,'2027-01-01');assert.equal(doc.payload.trash,false);
  assert.deepEqual(doc.payload.versions,before.payload.versions,'completion preserves all retained versions');
  const original=await h.raw(`/api/chest/documents/${doc.id}/bytes/${doc.payload.versions[0].id}?download=true`,owner);
  assert.equal(original.status,200);assert.equal(await original.text(),'private original','review completion leaves original bytes unchanged');
 });
 await check('CHEST-10',async()=>{
  assert.ok((await h.api(`/documents/${doc.id}/readers`,owner)).some(p=>p.email==='reviewer@example.test'));
  const group=await h.api('/groups',owner,{name:'Temporary readers',members:['outsider@example.test']});await h.api(`/documents/${doc.id}/grants`,owner,{grants:[{principal:group.id,role:'reader'}]});await h.api(`/documents/${doc.id}`,stranger);
  assert.ok((await h.api(`/documents/${doc.id}/readers`,owner)).some(p=>p.email==='outsider@example.test'));
  for(const version of doc.payload.versions){
   const original=await h.raw(`/api/chest/documents/${doc.id}/bytes/${version.id}?download=true`,stranger);assert.equal(original.status,200);assert.equal(hash(Buffer.from(await original.arrayBuffer())),version.checksum);
  }
  await h.api(`/groups/${group.id}`,owner,{name:'Temporary readers',members:[]});await h.api(`/documents/${doc.id}`,stranger,undefined,404);
  assert.ok(!(await h.api(`/documents/${doc.id}/readers`,owner)).some(p=>p.email==='outsider@example.test'));
  for(const version of doc.payload.versions)for(const suffix of ['', '?download=true']){
   const denied=await h.raw(`/api/chest/documents/${doc.id}/bytes/${version.id}${suffix}`,stranger);assert.equal(denied.status,404);assert.deepEqual(await denied.json(),{error:'not_found'});
  }
  await h.api(`/collections/${collection.id}/grants`,owner,{grants:[]});await h.api(`/documents/${doc.id}`,member,undefined,404);assert.equal((await h.api('/library?q=Acme',member)).count,0);await h.api(`/documents/${doc.id}/review/${doc.payload.versions.at(-1).id}`,member,{action:'approve'},404);
  for(const version of doc.payload.versions)for(const suffix of ['', '?download=true']){
   const denied=await h.raw(`/api/chest/documents/${doc.id}/bytes/${version.id}${suffix}`,member);assert.equal(denied.status,404);assert.deepEqual(await denied.json(),{error:'not_found'});
  }
  await h.api(`/collections/${collection.id}/grants`,owner,{grants:[{principal:'reviewer@example.test',role:'reviewer'}]});
 });
 await check('CHEST-11',async()=>{
  const item=(path,content='archive secret')=>({path,size:Buffer.byteLength(content),sha256:hash(content),base64:bytes(content),fields:{policy:'P-2'},sourceId:'synthetic-chest-1',timestamp:'2026-10-01T12:00:00Z',principals:['unmapped@example.test'],decisions:[{actor:'source reviewer',decision:'approved'}]});
  const archive=JSON.stringify({format:'chest-archive-1',source:'owner-export',items:[item('Acme/certificate.txt'),{...item('skip.txt'),skip:true},{...item('invalid.txt'),fields:{}}]});const input={archive,collection:collection.id,schema:schema.id,owner:h.vars.OWNER_EMAIL,reviewer:'reviewer@example.test'};
  const before=(await h.api('/library',owner)).count,p=await h.api('/archive/preview',owner,input);assert.equal((await h.api('/library',owner)).count,before);assert.deepEqual(p.items.map(i=>i.status),['admitted','skipped','rejected']);assert.equal(p.items[0].gaps.length,2);
  await h.api('/archive/apply',owner,{...input,fingerprint:'wrong'},409);await h.api('/archive/preview',owner,{...input,archive:JSON.stringify({format:'chest-archive-1',source:'bad',items:[item('../escape')]})},400);
  await h.api('/archive/preview',owner,{...input,archive:JSON.stringify({format:'chest-archive-1',source:'bad',items:[{...item('bad.txt'),sha256:'wrong'}]})},400);
  const job=await h.api('/archive/apply',owner,{...input,fingerprint:p.fingerprint});assert.equal(job.state,'completed');assert.equal((await h.api('/library?q=archive%20secret',member)).count,0);
  await h.stop();await h.start();assert.equal((await h.api(`/archive/${job.id}`,owner)).state,'completed');assert.equal((await h.api(`/archive/${job.id}`,owner,{action:'undo'})).state,'undone');assert.equal((await h.api('/library',owner)).count,before);
  // Exceed one request's batch so a real Worker restart interrupts an unfinished apply.
  const source='synthetic-chest-restart',items=Array.from({length:23},(_,n)=>({...item(`Restart/record-${n}.txt`,`synthetic-chest-original-${n}`),sourceId:`synthetic-chest-${n+2}`}));
  const restartInput={...input,archive:JSON.stringify({format:'chest-archive-1',source,items})};
  const restartPreview=await h.api('/archive/preview',owner,restartInput);
  assert.deepEqual(restartPreview.items.map(i=>[i.path,i.checksum,i.size,i.status]),items.map(i=>[i.path,i.sha256,i.size,'admitted']));
  assert.equal((await h.api('/library',owner)).count,before,'preview does not publish records');
  await h.api('/archive/preview',member,restartInput,403);
  await h.api('/archive/apply',member,{...restartInput,fingerprint:restartPreview.fingerprint},403);
  let unfinished=await h.api('/archive/apply',owner,{...restartInput,fingerprint:restartPreview.fingerprint});
  assert.equal(unfinished.state,'applying');assert.equal(unfinished.total,items.length);
  assert.ok(unfinished.checkpoint>0&&unfinished.checkpoint<unfinished.total,'apply leaves a durable, nonzero unfinished checkpoint');
  const admitted=async()=>(await h.api('/library',owner)).documents.filter(r=>r.payload.source?.archive===source).sort((a,b)=>a.id.localeCompare(b.id));
  const firstBatch=await admitted();assert.equal(firstBatch.length,unfinished.checkpoint);
  const ownerSessions=await h.api('/people',owner,{action:'sessions',email:h.vars.OWNER_EMAIL});
  const revokedOwner=await h.signIn(h.vars.OWNER_EMAIL),extraSessions=await h.api('/people',owner,{action:'sessions',email:h.vars.OWNER_EMAIL});
  const extraSession=extraSessions.find(s=>s.active&&!ownerSessions.some(prior=>prior.id===s.id));assert.ok(extraSession);
  await h.api('/people',owner,{action:'revoke',email:h.vars.OWNER_EMAIL,session:extraSession.id});
  await h.stop();await h.start();
  assert.deepEqual(await h.api(`/archive/${unfinished.id}`,owner),unfinished,'a new Worker reads the persisted unfinished job');
  assert.deepEqual(await admitted(),firstBatch,'the first batch survives restart unchanged');
  await h.api(`/archive/${unfinished.id}`,member,undefined,403);
  await h.api(`/archive/${unfinished.id}`,member,{action:'resume'},403);
  await h.api(`/archive/${unfinished.id}`,member,{action:'undo'},403);
  await h.api(`/archive/${unfinished.id}`,revokedOwner,{action:'resume'},401);
  assert.deepEqual(await h.api(`/archive/${unfinished.id}`,owner),unfinished,'refused continuations leave the checkpoint unchanged');
  assert.deepEqual(await admitted(),firstBatch,'refused continuations leave admitted records unchanged');
  for(let attempts=0;unfinished.state!=='completed'&&attempts<items.length;attempts++){
   const previous=unfinished;unfinished=await h.api(`/archive/${unfinished.id}`,owner,{action:'resume'});
   assert.equal(unfinished.id,previous.id);assert.equal(unfinished.fingerprint,restartPreview.fingerprint);
   assert.ok(unfinished.checkpoint>previous.checkpoint&&unfinished.checkpoint<=unfinished.total,'each continuation advances the saved checkpoint');
  }
  assert.equal(unfinished.state,'completed');assert.equal(unfinished.checkpoint,items.length);
  const completed=await admitted();assert.equal(completed.length,items.length);assert.equal((await h.api('/library',owner)).count,before+items.length);
  assert.equal(new Set(completed.map(r=>r.payload.source.path)).size,items.length);
  for(const original of items){
   const record=completed.find(r=>r.payload.source.path===original.path);assert.ok(record,`admitted ${original.path}`);
   const detail=await h.api(`/documents/${record.id}`,owner);assert.deepEqual(detail,record);
   assert.equal(record.payload.versions.length,1);const version=record.payload.versions[0];
   assert.equal(version.checksum,original.sha256);assert.equal(version.size,original.size);assert.equal(version.arrival,'migration');
   assert.deepEqual(version.migration,{archive:source,path:original.path,sourceId:original.sourceId,timestamp:original.timestamp});
   assert.deepEqual(record.payload.source,{archive:source,path:original.path,sourceId:original.sourceId,format:null,timestamp:original.timestamp,principals:original.principals,decisions:original.decisions,gaps:restartPreview.items.find(i=>i.path===original.path).gaps});
   assert.equal(record.payload.approved,null);assert.equal(version.state,'submitted');assert.deepEqual(version.events,[]);
   assert.equal(record.payload.private,true);assert.deepEqual(record.payload.grants,[]);
   const downloaded=await h.raw(`/api/chest/documents/${record.id}/bytes/${version.id}?download=true`,owner);assert.equal(downloaded.status,200);
   const retained=Buffer.from(await downloaded.arrayBuffer());assert.equal(retained.length,original.size);assert.equal(hash(retained),original.sha256);
   for(const reader of [member,stranger]){
    await h.api(`/documents/${record.id}`,reader,undefined,404);
    assert.equal((await h.raw(`/api/chest/documents/${record.id}/bytes/${version.id}?download=true`,reader)).status,404);
   }
  }
  for(const record of firstBatch)assert.deepEqual(completed.find(r=>r.id===record.id),record,'resume preserves existing bytes and migration provenance');
  for(let retry=0;retry<2;retry++)assert.deepEqual(await h.api(`/archive/${unfinished.id}`,owner,{action:'resume'}),unfinished);
  await h.stop();await h.start();
  assert.deepEqual(await h.api(`/archive/${unfinished.id}`,owner,{action:'resume'}),unfinished);
  assert.deepEqual(await admitted(),completed,'repeated resume, including after restart, publishes no duplicate or changed records');
  assert.equal((await h.api('/library',owner)).count,before+items.length);
  for(const record of completed){
   const version=record.payload.versions[0],downloaded=await h.raw(`/api/chest/documents/${record.id}/bytes/${version.id}?download=true`,owner);
   assert.equal(downloaded.status,200);assert.equal(hash(Buffer.from(await downloaded.arrayBuffer())),version.checksum,'replayed continuation preserves original custody');
  }
  assert.equal((await h.api('/library?q=synthetic-chest-original',member)).count,0);
  // Keep the original untouched undo and conflicting-native-edit journeys independent.
  let reversed=await h.api(`/archive/${unfinished.id}`,owner,{action:'undo'});
  for(let attempts=0;reversed.state!=='undone'&&attempts<items.length;attempts++)reversed=await h.api(`/archive/${unfinished.id}`,owner,{action:'resume'});
  assert.equal(reversed.state,'undone');assert.deepEqual(await admitted(),[]);assert.equal((await h.api('/library',owner)).count,before);
  const second={...input,archive:archive.replace('owner-export','second-export')},preview=await h.api('/archive/preview',owner,second),job2=await h.api('/archive/apply',owner,{...second,fingerprint:preview.fingerprint});
  const imported=(await h.api('/library?q=certificate.txt',owner)).documents.find(r=>r.payload.source);const migrated=imported.payload.versions[0];assert.equal(migrated.arrival,'migration');assert.deepEqual(migrated.migration,{archive:'second-export',path:'Acme/certificate.txt',sourceId:'synthetic-chest-1',timestamp:'2026-10-01T12:00:00Z'});assert.equal(imported.payload.approved,null);assert.equal(migrated.state,'submitted');const restored=await h.api(`/documents/${imported.id}/history/${migrated.id}/restore`,owner,{});assert.equal(restored.payload.versions.at(-1).arrival,'restore');assert.equal(restored.payload.versions.at(-1).restoredFrom,migrated.id);assert.deepEqual(restored.payload.versions.at(-1).migration,migrated.migration);assert.equal(restored.payload.approved,null);assert.equal(restored.payload.versions.length,2);await h.api(`/documents/${imported.id}/filing`,owner,{...filing(),title:'Native edit'});assert.equal((await h.api(`/archive/${job2.id}`,owner,{action:'undo'},409)).error,'NATIVE_EDIT_CONFLICT');assert.equal((await h.api(`/documents/${imported.id}`,owner)).payload.title,'Native edit');
 });
 await check('CHEST-13',async()=>{doc=await h.api(`/documents/${doc.id}/lifecycle`,owner,{action:'trash'});assert.ok(!(await h.api('/library',owner)).documents.some(r=>r.id===doc.id));await h.api(`/documents/${doc.id}`,member,undefined,404);assert.ok((await h.api('/library?trash=true',owner)).documents.some(r=>r.id===doc.id));doc=await h.api(`/documents/${doc.id}/lifecycle`,owner,{action:'restore'});assert.equal(doc.payload.trash,false);assert.ok((await h.api('/audit',owner)).some(e=>e.action==='document.trash'))});
 console.log('Public HTTP flows complete. CHEST-12 portability and responsive UI run in the fresh-clone journey.');
}finally{await h.close()}
