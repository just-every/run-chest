// One public HTTP journey: new Office/ODF files, current folder access, independent scoped templates,
// version-one provenance, creation preferences, quota and concurrent caller-key admission.
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {harness} from './harness.mjs';
const h=await harness(),people={},b64=v=>Buffer.from(v).toString('base64');
const newFile=(cookie,input,status=200)=>h.api('/new-files',cookie,input,status);
const downloaded=async(cookie,row)=>{
 const response=await h.raw(`/api/chest/items/${row.id}/bytes/${row.payload.versions[0].id}?download=true`,cookie);
 assert.equal(response.status,200);return new Uint8Array(await response.arrayBuffer());
};
function packageOf(bytes,extension){
 const files=unzipSync(bytes);
 for(const [path,content]of Object.entries(files))if(path.endsWith('.xml')||path.endsWith('.rels')){
  let invalid=false;new DOMParser({onError:()=>{invalid=true}}).parseFromString(strFromU8(content),'application/xml');assert.equal(invalid,false,`${path} is well-formed XML`);
 }
 const main={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml',odt:'content.xml',ods:'content.xml',odp:'content.xml'}[extension];
 assert.ok(files[main],`${extension} has its document part`);
 if(extension.startsWith('od')){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(view.getUint16(8,true),0,'ODF mimetype is stored');assert.equal(view.getUint16(28,true),0,'ODF mimetype has no local extra fields');
  assert.equal(new TextDecoder().decode(bytes.subarray(30,30+view.getUint16(26,true))),'mimetype');
  assert.ok(files['META-INF/manifest.xml']);assert.match(strFromU8(files.mimetype),/^application\/vnd\.oasis\.opendocument\./);
 }else{
  assert.ok(files['[Content_Types].xml']);assert.ok(files['_rels/.rels']);
  // Follow each internal relationship, including the presentation master/layout/theme graph.
  for(const [path,content]of Object.entries(files))if(path.endsWith('.rels')){
   const document=new DOMParser().parseFromString(strFromU8(content),'application/xml');
   const base=path==='_rels/.rels'?'':path.replace(/_rels\/([^/]+)\.rels$/,'');
   for(const r of Array.from(document.getElementsByTagName('Relationship'))){
    if(r.getAttribute('TargetMode')==='External')continue;
    const resolved=new URL(r.getAttribute('Target'),`https://package.test/${base}`).pathname.slice(1);assert.ok(files[resolved],`${path} links an existing ${resolved}`);
   }
  }
 }
 return files;
}
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);people.owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:people.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 for(const person of ['manager','contributor','viewer','commenter','outside']){await h.api('/people',people.owner,{action:'invite',email:`${person}@example.test`,name:person});people[person]=await h.signIn(`${person}@example.test`,true)}
 const personal=(await h.api('/files',people.owner)).personal,space=await h.api('/spaces',people.manager,{name:'Template projects'});
 await h.api(`/spaces/${space.id}/members`,people.manager,{members:[{principal:'manager@example.test',role:'manager'},{principal:'contributor@example.test',role:'contributor'},{principal:'viewer@example.test',role:'viewer'},{principal:'commenter@example.test',role:'commenter'}]});
 const folder=await h.api('/items',people.manager,{space:space.id,type:'folder',name:'Restricted creation'});
 await h.api(`/items/${folder.id}/settings`,people.manager,{restricted:true,noDownload:true});
 for(const role of ['contributor','viewer','commenter'])await h.api(`/items/${folder.id}/shares`,people.manager,{principal:`${role}@example.test`,role:role==='contributor'?'editor':role});
 const root={space:space.id,parent:folder.id};
 for(const role of ['viewer','commenter'])await newFile(people[role],{...root,kind:'document',key:`denied-${role}`},403);
 await newFile(people.outside,{...root,kind:'document',key:'denied-outside'},403);
 const book=await newFile(people.contributor,{...root,kind:'spreadsheet',key:'blank-book'});
 assert.equal(book.payload.versions.length,1);assert.equal(book.payload.versions[0].arrival,'created');assert.equal(book.payload.versions[0].actor,'contributor@example.test');packageOf(await downloaded(people.contributor,book),'xlsx');
 const initial=await h.api(`/items/${book.id}/office?edit=true`,people.contributor);assert.ok(initial.fields.length,'the blank spreadsheet has an editable empty cell');
 const first=await h.api(`/items/${book.id}/office`,people.contributor,{version:initial.version,changes:{[initial.fields[0].key]:'Public-door project budget'}});
 await h.api(`/items/${book.id}/office`,people.contributor,{version:first.version,changes:{[initial.fields[0].key]:'Updated project budget'}});
 assert.equal((await h.api(`/items/${book.id}`,people.contributor)).versions.length,3);
 assert.ok((await h.api('/search?q=Updated%20project%20budget',people.manager)).results.some(r=>r.id===book.id));assert.equal((await h.api('/search?q=Updated%20project%20budget',people.outside)).count,0);
 await h.api(`/items/${book.id}`,people.outside,undefined,403);
 assert.ok((await h.api('/files',people.contributor)).recent.some(r=>r.id===book.id));
 for(const [kind,extension]of [['document','docx'],['presentation','pptx']]){
  const row=await newFile(people.owner,{space:personal,kind,key:`blank-${extension}`});packageOf(await downloaded(people.owner,row),extension);
 }
 const gallery=await h.api('/templates',people.owner);assert.ok(gallery.templates.filter(t=>t.builtin).length>=10);
 // Generate every built-in through both format choices, inspecting the actual downloaded original packages.
 for(const format of ['office','odf']){
  await h.api('/creation-settings',people.owner,{format,groups:[]});
  for(const entry of gallery.templates.filter(t=>t.builtin)){
   const row=await newFile(people.owner,{space:personal,kind:entry.kind,template:entry.id,key:`gallery-${format}-${entry.id}`}),extension=row.payload.name.split('.').at(-1);
   packageOf(await downloaded(people.owner,row),extension);assert.equal(row.payload.versions[0].template.id,entry.id);
  }
  if(format==='odf')for(const kind of ['document','spreadsheet','presentation']){
   const row=await newFile(people.owner,{space:personal,kind,key:`blank-odf-${kind}`});packageOf(await downloaded(people.owner,row),{document:'odt',spreadsheet:'ods',presentation:'odp'}[kind]);
  }
 }
 const group=await h.api('/groups',people.owner,{name:'Template audience',members:['contributor@example.test']});
 await h.api('/creation-settings',people.owner,{format:'odf',groups:[{group:group.id,format:'office'}]});
 await h.api('/creation-settings',people.contributor,{format:'office',groups:[]},403);
 const override=await newFile(people.contributor,{...root,kind:'document',key:'group-format'});assert.ok(override.payload.name.endsWith('.docx'));
 const source=await newFile(people.owner,{space:personal,kind:'document',template:'builtin:letter',key:'source-letter'});
 // The owner currently uses ODF. Publish an Office source for the editable independence checks below.
 await h.api('/creation-settings',people.owner,{format:'office',groups:[]});
 const officeSource=await newFile(people.owner,{space:personal,kind:'document',template:'builtin:letter',key:'office-source-letter'});
 const published=await h.api('/templates',people.owner,{source:officeSource.id,name:'Group letter',category:'Correspondence',audience:{type:'groups',groups:[group.id]}});
 const broken=await h.api('/items',people.owner,{space:personal,type:'file',name:'damaged.docx',base64:b64('This is not an Office package')});
 await h.api('/templates',people.owner,{source:broken.id,name:'Broken document',category:'Correspondence',audience:{type:'organisation'}},415);
 assert.ok(!(JSON.stringify(published).includes(officeSource.id)),'gallery does not disclose the source ID');
 for(const role of ['outside','viewer'])assert.ok(!(await h.api('/templates',people[role])).templates.some(t=>t.id===published.id));
 assert.ok((await h.api('/templates',people.contributor)).templates.some(t=>t.id===published.id));
 await newFile(people.outside,{space:(await h.api('/files',people.outside)).personal,kind:'document',template:published.id,key:'wrong-audience'},404);
 const copy=await newFile(people.contributor,{...root,kind:'document',template:published.id,key:'published-copy'}),copyVersion=copy.payload.versions[0];
 assert.equal(copyVersion.checksum,officeSource.payload.versions[0].checksum);assert.equal(copyVersion.template.sourceVersion,officeSource.payload.current);
 const editing=await h.api(`/items/${copy.id}/office?edit=true`,people.contributor);
 await h.api(`/items/${copy.id}/office`,people.contributor,{version:editing.version,changes:{[editing.fields[0].key]:'Independent copy author'}});
 assert.equal((await h.api(`/items/${officeSource.id}`,people.owner)).versions.length,1);
 const sourceEditing=await h.api(`/items/${officeSource.id}/office?edit=true`,people.owner);
 await h.api(`/items/${officeSource.id}/office`,people.owner,{version:sourceEditing.version,changes:{[sourceEditing.fields[0].key]:'Changed source author'}});
 assert.ok((await h.api(`/items/${copy.id}/office`,people.contributor)).html.includes('Independent copy author'));
 assert.equal((await h.raw(`/api/chest/items/${officeSource.id}`,people.contributor)).status,403,'template publication grants no source access');
 await h.api(`/templates/${published.id}/unpublish`,people.contributor,{},403);
 await h.api(`/templates/${published.id}/unpublish`,people.owner,{});
 assert.ok(!(await h.api('/templates',people.contributor)).templates.some(t=>t.id===published.id));
 assert.ok((await h.api(`/items/${copy.id}/office`,people.contributor)).html.includes('Independent copy author'));
 await newFile(people.contributor,{...root,kind:'document',template:published.id,key:'unpublished-copy'},404);
 const managerSource=await newFile(people.manager,{...root,kind:'document',key:'manager-source'});
 const spaceTemplate=await h.api('/templates',people.manager,{source:managerSource.id,name:'Space starter',category:'Projects',audience:{type:'space',space:space.id}});
 assert.ok((await h.api('/templates',people.viewer)).templates.some(t=>t.id===spaceTemplate.id));assert.ok(!(await h.api('/templates',people.outside)).templates.some(t=>t.id===spaceTemplate.id));
 await h.api('/templates',people.manager,{source:managerSource.id,name:'Escalation',category:'Projects',audience:{type:'organisation'}},403);
 await h.api(`/templates/${spaceTemplate.id}/unpublish`,people.manager,{});
 const repeated={...root,kind:'document',key:'parallel-idempotency',name:'Exactly one'};
 const same=await Promise.all([newFile(people.contributor,repeated),newFile(people.contributor,repeated)]);assert.equal(same[0].id,same[1].id);
 assert.equal((await newFile(people.contributor,repeated)).id,same[0].id);
 await newFile(people.contributor,{...repeated,name:'Different request'},409);
 const beforeQuota=(await h.api(`/items/${folder.id}`,people.manager)).children.length;
 await h.api(`/spaces/${space.id}/quota`,people.owner,{storageLimitBytes:0});
 const refusal=await newFile(people.contributor,{...root,kind:'document',key:'over-quota'},413);assert.equal(refusal.error,'storage_limit_exceeded');
 assert.equal((await h.api(`/items/${folder.id}`,people.manager)).children.length,beforeQuota);
 const audit=await h.api('/audit',people.owner);for(const action of ['file.create','template.publish','template.unpublish'])assert.ok(audit.some(a=>a.action===action));
 const receiptAudit=audit.filter(a=>a.action==='file.create'&&a.object_id===same[0].id);assert.equal(receiptAudit.length,1);
 // Keep both ODF and Office source documents reachable through ordinary item views.
 assert.equal((await h.api(`/items/${source.id}`,people.owner)).item.name,source.payload.name);
 console.log('New-file public flow passed: Office/ODF packages, all built-ins, scoped independent templates, two saves, access, format overrides, idempotency, quota, recent/search and audit');
}finally{await h.close()}
