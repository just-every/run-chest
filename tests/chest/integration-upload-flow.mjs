import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {specimen} from './content-scanner-fixture.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const b64=bytes=>Buffer.from(bytes).toString('base64');

// SURFACE-004 bounded upload door: real OAuth authority and storage, with only the scanner at the network edge.
export async function integrationUploadFlow(h,{owner,sponsor,token,folder,file}){
 const request=(path,body,key)=>h.fetch('/api/chest/integrations/v1'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json','idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const call=async(path,body,key,status=200)=>{const response=await request(path,body,key);assert.equal(response.status,status,await response.clone().text());return response.json()};
 const detail=()=>h.api(`/items/${file.id}`,sponsor);
 // Filter at the public audit door so earlier receipts cannot fall out of its bounded history page.
 const audit=action=>h.api('/audit?limit=200&action='+encodeURIComponent(action),owner);
 const snapshot=async()=>{const d=await detail();return {id:d.id,item:d.item,versions:d.versions,links:d.publicLinks.map(l=>({id:l.id,item:l.item,state:l.state,versionMode:l.versionMode})),children:(await h.api(`/items/${folder.id}`,sponsor)).children.map(i=>i.id).sort()}};
 const versionPath=`/items/${file.id}/versions`,link=await h.api(`/items/${file.id}/links`,sponsor,{audience:'public',versionMode:'current'}),linkPath=new URL(link.url).pathname;
 const originals=(await detail()).versions.map(v=>({id:v.id,checksum:v.checksum}));
 assert.equal(originals.length,1,'the replacement starts from a real existing original');
 const linkBytes=async checksum=>{const response=await h.fetch(`${linkPath}/f/${file.id}`);assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),checksum,'the original link serves the current exact original')};
 await linkBytes(originals[0].checksum);
 const beforeAudit=(await audit('version.upload')).filter(r=>r.action==='version.upload'&&r.object_id===file.id).length;
 for(const [n,text] of ['synthetic-chest-original-2','synthetic-chest-original-3'].entries()){
  const bytes=Buffer.from(text),body={base64:b64(bytes),checksum:sha(bytes),size:bytes.length},key=`surface-version-${n+2}`;
  const added=await call(versionPath,body,key);assert.equal(added.id,file.id,'new versions keep the stable item ID');assert.equal(added.sha256,sha(bytes));
  const repeated=await call(versionPath,body,key);assert.equal(repeated.current,added.current,'a retry does not append another version');
  await h.stop();await h.start();
  const restarted=await call(versionPath,body,key);assert.equal(restarted.current,added.current,'a restart preserves the once-only result');
  originals.push({id:added.current,checksum:sha(bytes)});
  const d=await detail();assert.equal(d.item.current,added.current);assert.equal(d.versions.length,originals.length);assert.ok(d.publicLinks.some(l=>l.id===link.link.id&&l.item===file.id&&l.state==='active'));
  await linkBytes(sha(bytes));
 }
 assert.equal((await audit('version.upload')).filter(r=>r.action==='version.upload'&&r.object_id===file.id).length,beforeAudit+2,'exactly one publication audit per distinct version');
 const retained=(await call(versionPath+'?limit=100')).items;
 assert.deepEqual(retained.map(v=>({id:v.id,checksum:v.checksum})).sort((a,b)=>a.id.localeCompare(b.id)),originals.toSorted((a,b)=>a.id.localeCompare(b.id)));
 for(const v of originals){
  const agent=await h.fetch(`/api/chest/integrations/v1/items/${file.id}/bytes/${v.id}`,{headers:{authorization:'Bearer '+token}}),browser=await h.raw(`/api/chest/items/${file.id}/bytes/${v.id}?download=true`,sponsor);
  for(const response of [agent,browser]){assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),v.checksum,'retained originals remain exact through both doors')}
 }
 console.log(`PROBE SURFACE-004 2: OAuth version upload, retry and Worker restart -> stable item and link, ${originals.length} exact retained originals, two version publications`);

 // Public quota configuration, then refusals through both ordinary doors without publishing an item or version.
 const space=(await detail()).item.space,usage=await h.api(`/spaces/${space}/quota`,owner),limit=usage.usedBytes;
 await h.api(`/spaces/${space}/quota`,owner,{storageLimitBytes:limit});
 const unchanged=await snapshot(),mutations=(await audit('integration.mutation')).filter(r=>r.action==='integration.mutation').length;
 const overLimit=[{path:'/items',body:{parent:folder.id,name:'Over limit.txt',base64:b64('synthetic-chest-quota-new')},key:'surface-quota-new'},
  {path:versionPath,body:{base64:b64('synthetic-chest-quota-version')},key:'surface-quota-version'}];
 for(const attempt of overLimit){
  const error=await call(attempt.path,attempt.body,attempt.key,413),browser=await h.api(attempt.path,sponsor,attempt.body,413);
  assert.equal(error.error,'storage_limit_exceeded');assert.equal(error.limitBytes,limit,'refusal names the configured limit');assert.equal(error.usedBytes,limit);assert.equal(error.space,space);
  for(const key of ['error','limitBytes','usedBytes','scope','space'])assert.equal(error[key],browser[key],'agent and browser quota refusals agree');
 }
 await h.stop();await h.start();
 for(const attempt of overLimit)await call(attempt.path,attempt.body,attempt.key,413);
 assert.deepEqual(await snapshot(),unchanged,'quota refusals preserve visible content, history, links and folder contents');
 assert.equal((await audit('integration.mutation')).filter(r=>r.action==='integration.mutation').length,mutations,'refused uploads have no successful mutation receipts');
 assert.equal((await h.api(`/spaces/${space}/quota`,owner)).usedBytes,limit);await linkBytes(originals.at(-1).checksum);
 await h.api(`/spaces/${space}/quota`,owner,{storageLimitBytes:null});
 console.log(`PROBE SURFACE-004 6 quota: owner-configured ${limit}-byte limit, OAuth new file and version -> storage_limit_exceeded, actual limit, unchanged visible content across restart`);

 // Scan existing retained originals before attempting distinct malware originals through each door.
 await h.api('/content-security/policy',owner,{enabled:true,sensitiveGroups:[],confirm:true});
 await h.api('/content-security/scan',owner,{item:file.id});
 const beforeQuarantine=await snapshot(),beforeMutations=(await audit('integration.mutation')).filter(r=>r.action==='integration.mutation').length,held=[];
 for(const door of ['agent','browser'])for(const kind of ['new','version']){
  const bytes=Buffer.concat([specimen,Buffer.from(`\nsynthetic-chest-${door}-${kind}`)]),filename=`Held ${door} ${kind}.txt`,body={base64:b64(bytes),...(kind==='new'?{parent:folder.id,name:filename}:{filename})},path=kind==='new'?'/items':versionPath,key=`surface-quarantine-${door}-${kind}`;
  const result=door==='agent'?await call(path,body,key,423):await h.api(path,sponsor,body,423);
  assert.equal(result.error,'content_quarantined','malware is quarantined with the browser admission code');
  held.push({checksum:sha(bytes),filename,size:bytes.length,body,path,key,door});
 }
 assert.deepEqual(await snapshot(),beforeQuarantine,'malware never creates a visible file or replaces a retained original');
 await h.stop();await h.start();
 for(const entry of held.filter(e=>e.door==='agent'))assert.equal((await call(entry.path,entry.body,entry.key,423)).error,'content_quarantined');
 const scans=(await h.api('/content-security',owner)).scans;
 for(const entry of held){const rows=scans.filter(r=>r.payload.checksum===entry.checksum);assert.equal(rows.length,1);assert.equal(rows[0].payload.state,'infected');assert.equal(rows[0].payload.size,entry.size);assert.equal(rows[0].payload.actor,(await detail()).item.createdBy);assert.equal(rows[0].payload.filename,rows[0].payload.actor===h.vars.OWNER_EMAIL?entry.filename:'Restricted original','security administration keeps unpublished staff filenames private');assert.equal(rows[0].payload.released,undefined)}
 assert.deepEqual(await snapshot(),beforeQuarantine);
 assert.equal((await audit('integration.mutation')).filter(r=>r.action==='integration.mutation').length,beforeMutations);
 await linkBytes(originals.at(-1).checksum);
 const cleanBytes=Buffer.from('synthetic-chest-scanned-clean-control'),clean=await call('/items',{parent:folder.id,name:'Scanned clean control.txt',base64:b64(cleanBytes)},'surface-scanned-clean');
 assert.equal(clean.sha256,sha(cleanBytes));const cleanDownload=await h.fetch(`/api/chest/integrations/v1/items/${clean.id}/bytes/${clean.current}`,{headers:{authorization:'Bearer '+token}});assert.equal(cleanDownload.status,200);assert.equal(sha(Buffer.from(await cleanDownload.arrayBuffer())),sha(cleanBytes));
 assert.equal((await h.api('/content-security',owner)).scans.find(r=>r.payload.checksum===clean.sha256).payload.state,'clean','a clean control still publishes under the same scanner policy');
 await h.api('/content-security/policy',owner,{enabled:false,sensitiveGroups:[],confirm:true});
 console.log('PROBE SURFACE-004 6 quarantine: real OAuth and browser new-file and version admissions with scanner-edge specimen -> content_quarantined, durable infected originals, unchanged history and links; clean control publishes');
 return {file:file.id,linkPath,originals,held:held.map(({checksum,filename})=>({checksum,filename}))};
}
