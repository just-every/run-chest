// SHARE-003: the package contains a genuinely uploaded multi-GB original, not a
// declared size or direct object-store fixture. Keep memory bounded to one part.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';

export async function largeTransferJourney(h,owner,space){
 const size=2*1024**3+8*1024**2,expected=createHash('sha256');
 const upload=await h.api('/uploads',owner,{space,name:'Harbor production handover.bin',size});
 for(let n=1,offset=0;offset<size;n++){
  const bytes=randomBytes(Math.min(upload.partSize,size-offset));expected.update(bytes);
  const response=await h.fetch(`/api/chest/uploads/${upload.id}/parts/${n}`,{method:'PUT',headers:{cookie:owner,origin:h.origin,'content-type':'application/octet-stream'},body:bytes});
  assert.equal(response.status,200);await response.json();offset+=bytes.length;
  if(n%64===0)console.log(`SHARE-003 uploaded ${offset} of ${size} real bytes`);
 }
 const checksum=expected.digest('hex'),finished=await h.api(`/uploads/${upload.id}/complete`,owner,{});
 const file=await h.api(`/items/${finished.result.item}`,owner);
 assert.equal(file.versions[0].size,size);assert.equal(file.versions[0].checksum,checksum);
 const post=(path,cookie,body={})=>h.fetch(path,{method:'POST',headers:{origin:h.origin,...(cookie?{cookie}:{})},body:new URLSearchParams(body)});
 for(const invited of [false,true]){
  const recipient='production.vendor@example.test';
  const pack=await h.api('/transfers',owner,{item:finished.result.item,title:'Harbor production originals',limit:1,receipt:true,sendTo:recipient,...(invited?{audience:'guests',guests:[recipient]}:{})});
  const base=new URL(pack.url).pathname;
  let view=await h.api(`/transfers/${pack.id}`,owner);
  assert.ok(view.events.some(e=>e.kind==='mail_accepted'));
  assert.ok(!view.events.some(e=>e.kind==='confirmed'||e.kind==='bytes_completed'));
  let identity='';
  if(invited){
   await post(base+'/verify','',{email:recipient});
   const message=h.mails.findLast(m=>[m.to].flat().includes(recipient));
   const token=new URL(message.text.match(/https?:\/\/[^\s]+/)[0]).searchParams.get('token');
   const verified=await post(base+'/confirm','',{token});assert.equal(verified.status,303);
   identity=verified.headers.get('set-cookie').split(';')[0];
  }
  const landing=await h.fetch(base,{headers:identity?{cookie:identity}:{}});
  assert.equal(landing.status,200);await landing.text();
  view=await h.api(`/transfers/${pack.id}`,owner);
  assert.ok(view.events.some(e=>e.kind==='view'&&e.actor===(invited?recipient:'anyone with the link')));
  const started=await post(base+'/start',identity);assert.equal(started.status,303);
  const cookie=[identity,started.headers.get('set-cookie').split(';')[0]].filter(Boolean).join('; ');
  assert.equal((await post(base+'/start',identity)).status,410);
  const downloaded=createHash('sha256'),split=64*1024**2;
  const consume=async(response,length)=>{
   assert.equal(response.status,206);let received=0;
   for await(const chunk of response.body){downloaded.update(chunk);received+=chunk.length}
   assert.equal(received,length);
  };
  await consume(await h.fetch(base+'/f/'+finished.result.item,{headers:{cookie,range:`bytes=0-${split-1}`}}),split);
  // Start the rest, lose the response and discard its incomplete bytes. The
  // recipient retries from its last durable offset after the server restarts.
  const interrupted=await h.fetch(base+'/f/'+finished.result.item,{headers:{cookie,range:`bytes=${split}-`}});
  assert.equal(interrupted.status,206);const reader=interrupted.body.getReader();
  assert.ok((await reader.read()).value.length>0);await reader.cancel('recipient connection interrupted');
  assert.ok(!(await h.api(`/transfers/${pack.id}`,owner)).events.some(e=>e.kind==='bytes_completed'));
  await h.stop();await h.start();
  await consume(await h.fetch(base+'/f/'+finished.result.item,{headers:{cookie,range:`bytes=${split}-`,'if-range':`"${checksum}"`}}),size-split);
  assert.equal(downloaded.digest('hex'),checksum);
  view=await h.api(`/transfers/${pack.id}`,owner);
  const completed=view.events.filter(e=>e.kind==='bytes_completed');
  assert.equal(completed.length,1);assert.equal(completed[0].bytes,size);
  assert.equal(completed[0].version,finished.result.version);
  assert.ok(!view.events.some(e=>e.kind==='confirmed'));
  assert.equal((await post(base+'/received',cookie,{received:'yes'})).status,303);
  const confirmed=(await h.api(`/transfers/${pack.id}`,owner)).events.filter(e=>e.kind==='confirmed');
  assert.equal(confirmed.length,1);assert.equal(confirmed[0].actor,invited?recipient:'anyone with the link');
  await h.api(`/transfers/${pack.id}/revoke`,owner,{});
  assert.equal((await h.fetch(base+'/f/'+finished.result.item,{headers:{cookie,range:`bytes=${split}-`}})).status,410);
  console.log(`SHARE-003 real ${size}-byte ${invited?'invited':'public'} delivery: interrupted response, persisted range resume, exact SHA-256, limit and separate explicit receipt passed.`);
 }
}
