// Real hosted data is created and reconciled through Chest's HTTP doors.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function hostedClient(origin,context) {
 async function request(path,body,status=200,method=body===undefined?'GET':'POST') {
  const response=await context.request.fetch(origin+'/api/chest'+path,{
   method,headers:{origin,...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{data:JSON.stringify(body)}),maxRedirects:0});
  assert.equal(response.status(),status,`${method} ${path.split('?')[0]} returned ${response.status()}`);
  return response;
 }
 return {origin,context,request,async api(path,body,status=200){return (await request(path,body,status)).json()}};
}

export async function createHostedData(owner,member,email,memberEmail,marker) {
 const space=await owner.api('/spaces',{name:'Harbor delivery '+marker});
 await owner.api(`/spaces/${space.id}/members`,{members:[{principal:email,role:'manager'},{principal:memberEmail,role:'manager'}]});
 const collection=await owner.api('/collections',{name:'Harbor supplier evidence'});
 const schema=await owner.api('/schemas',{name:'Delivery evidence',fields:[{name:'reference',type:'text',required:true}]});
 await owner.api(`/collections/${collection.id}/grants`,{grants:[{principal:memberEmail,role:'reviewer'}]});
 let document=await owner.api('/documents',{title:'Harbor retained agreement',collection:collection.id,schema:schema.id,
  fields:{reference:marker},owner:email,reviewer:memberEmail,reference:{kind:'project',name:'Harbor delivery'},
  filename:'Approved agreement.txt',base64:Buffer.from('Agreed supplier evidence '+marker).toString('base64')});
 await member.api(`/documents/${document.id}/review/${document.payload.versions[0].id}`,{action:'approve'});
 document=await owner.api(`/documents/${document.id}/versions`,{filename:'Proposed agreement.txt',base64:Buffer.from('Proposed supplier evidence '+marker).toString('base64')});
 const parent=await owner.api('/items',{space:space.id,type:'folder',name:'Client agreements'});
 const folder=await owner.api('/items',{parent:parent.id,type:'folder',name:'Approved originals'});
 const first=Buffer.from('Harbor payment terms, original '+marker),second=Buffer.from('Harbor payment terms, agreed revision '+marker);
 const small=await member.api('/items',{parent:folder.id,type:'file',name:'Payment terms.txt',base64:first.toString('base64')});
 const revised=await owner.api(`/items/${small.id}/versions`,{base64:second.toString('base64')});
 await owner.api(`/items/${small.id}/shares`,{principal:memberEmail,role:'contributor'});
 const delivery=await owner.api('/items',{parent:folder.id,type:'file',name:'Delivery note.txt',base64:Buffer.from('Delivery accepted '+marker).toString('base64')});
 const link=await owner.api(`/items/${delivery.id}/public-links`,{limit:5});
 const downloaded=await fetch(new URL(link.url).href+'/f/'+delivery.id);
 assert.equal(downloaded.status,200,'the public link serves the hosted original');
 assert.equal(sha(Buffer.from(await downloaded.arrayBuffer())),delivery.payload.versions[0].checksum);
 const incoming=await owner.api('/items',{space:space.id,type:'folder',name:'Supplier returns'});
 const request=await owner.api(`/items/${incoming.id}/file-requests`,{title:'Signed supplier return '+marker,message:'Send the agreed delivery note.',types:'txt',maxMegabytes:'1'});
 const form=new FormData(),received=Buffer.from('Supplier receipt '+marker);
 form.set('name','Harbor supplier');form.set('email',memberEmail);form.append('files',new Blob([received]),'Supplier receipt.txt');
 const submission=await fetch(request.url,{method:'POST',headers:{origin:owner.origin},body:form});
 assert.equal(submission.status,200,'a real hosted file request accepts the original');await submission.text();
 const receivedItem=(await owner.api(`/items/${incoming.id}`)).children.find(row=>row.name==='Supplier receipt.txt');
 assert.ok(receivedItem,'the hosted request created its file in the chosen folder');
 const size=150*1024*1024,hash=createHash('sha256');
 const upload=await member.api('/uploads',{parent:folder.id,name:'Harbor production handover.bin',size});
 for(let n=1,offset=0;offset<size;n++){
  const bytes=randomBytes(Math.min(upload.partSize,size-offset));hash.update(bytes);
  const response=await member.context.request.put(member.origin+`/api/chest/uploads/${upload.id}/parts/${n}`,{headers:{origin:member.origin,'content-type':'application/octet-stream'},data:bytes});
  assert.equal(response.status(),200,`hosted original part ${n} is accepted`);await response.dispose();offset+=bytes.length;
 }
 const checksum=hash.digest('hex'),complete=await member.api(`/uploads/${upload.id}/complete`,{});
 const large=await owner.api(`/items/${complete.result.item}`);
 assert.equal(large.versions[0].size,size);assert.equal(large.versions[0].checksum,checksum);
 await owner.api(`/items/${small.id}/trash`,{});
 return {space:space.id,parent:parent.id,folder:folder.id,incoming:incoming.id,trash:small.id,delivery:delivery.id,received:receivedItem.id,
  large:large.id,largeVersion:large.item.current,checksum,size,link:link.link.id,linkUrl:link.url,request:request.request.id,requestUrl:request.url,
  library:{document:document.id,collection:collection.id,schema:schema.id,versions:document.payload.versions.map(v=>({id:v.id,checksum:v.checksum,size:v.size}))},
  originals:[{item:small.id,versions:revised.payload.versions.map(v=>({id:v.id,checksum:v.checksum,size:v.size}))},
   {item:delivery.id,versions:delivery.payload.versions.map(v=>({id:v.id,checksum:v.checksum,size:v.size}))},
   {item:receivedItem.id,versions:[{id:(await owner.api(`/items/${receivedItem.id}`)).item.current,checksum:sha(received),size:received.length}]}]};
}

export async function snapshotHostedData(client,expected) {
 const space=await client.api(`/spaces/${expected.space}`);
 const library=await client.api('/library'),document=await client.api(`/documents/${expected.library.document}`);
 const rows=[];
 for(const id of [expected.parent,expected.folder,expected.incoming,expected.delivery,expected.received,expected.large]){
  const view=await client.api(`/items/${id}`);
  rows.push({id,item:view.item,versions:view.versions,grants:view.grants,
   children:view.children?.map(row=>({id:row.id,name:row.name,type:row.type})).sort((a,b)=>a.id.localeCompare(b.id)),
   publicLinks:view.publicLinks?.map(row=>({id:row.id,downloads:row.downloads,limit:row.limit,revokedAt:row.revokedAt})),
   fileRequests:view.fileRequests});
 }
 const trashed=(await client.api('/trash')).find(row=>row.id===expected.trash);
 assert.ok(trashed,'the exact versioned file remains in hosted trash');
 const delivery=await client.api(`/items/${expected.delivery}`);
 assert.equal(delivery.publicLinks.find(row=>row.id===expected.link).downloads,1,'the public download count survives');
 const requests=(await client.api('/links')).requests;
 const request=requests.find(row=>row.id===expected.request);
 assert.ok(request?.open);assert.equal(request.uploads,1,'the file request retains its accepted upload');
 return {space:{id:space.id,name:space.name,members:space.members,children:space.children.map(row=>({id:row.id,name:row.name,type:row.type})).sort((a,b)=>a.id.localeCompare(b.id))},rows,
  trash:{id:trashed.id,name:trashed.name,trashedBy:trashed.trashedBy,trashedAt:trashed.trashedAt},request,
  library:{document:document.payload,collection:library.collections.find(row=>row.id===expected.library.collection),schema:library.schemas.find(row=>row.id===expected.library.schema)}};
}

export async function reconcileHostedOriginals(client,expected) {
 for(const version of expected.library.versions){
  const response=await client.request(`/documents/${expected.library.document}/bytes/${version.id}?download=true`);
  assert.equal(sha(await response.body()),version.checksum);await response.dispose();
 }
 await client.api(`/items/${expected.trash}/restore`,{});
 for(const file of expected.originals){
  const view=await client.api(`/items/${file.item}`);
  assert.deepEqual(view.versions.map(v=>({id:v.id,checksum:v.checksum,size:v.size})).sort((a,b)=>a.id.localeCompare(b.id)),[...file.versions].sort((a,b)=>a.id.localeCompare(b.id)),'all retained version identities and hashes survive');
  for(const version of file.versions){
   const response=await client.request(`/items/${file.item}/bytes/${version.id}?download=true`);
   assert.equal(sha(await response.body()),version.checksum);await response.dispose();
  }
 }
 // Use streaming fetch so the original's size never dictates client memory use.
 const cookies=await client.context.cookies(client.origin);
 const response=await fetch(client.origin+`/api/chest/items/${expected.large}/bytes/${expected.largeVersion}?download=true`,{headers:{cookie:cookies.map(c=>c.name+'='+c.value).join('; ')}});
 assert.equal(response.status,200);let size=0;const hash=createHash('sha256');
 for await(const bytes of response.body){size+=bytes.length;hash.update(bytes)}
 assert.equal(size,expected.size);assert.equal(hash.digest('hex'),expected.checksum,'the restored 150 MB original is byte-identical');
 await client.api(`/items/${expected.trash}/trash`,{});
}
