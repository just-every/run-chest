// SECURITY-002 through the built Worker. The malware scanner is a separately deployed service, faked here at its
// network edge with the industry's harmless test file; quarantine, classification, alerts, pauses and rules run in Chest.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {harness} from './harness.mjs';
export const specimen=Buffer.from(['X5O!P%@AP[4\\PZX54(P^)7CC)7}$','EICAR-STANDARD-ANTIVIRUS','-TEST-FILE!$H+H*'].join(''));
export const SCANNER='https://scanner.example.test/scan';
const sha=b=>createHash('sha256').update(b).digest('hex'),b64=b=>Buffer.from(b).toString('base64');
// A Word file carrying a Microsoft Purview sensitivity label, as Office writes it into the custom properties.
export function labelled(label='Confidential'){const guid='00000000-0000-4000-8000-000000000001',p=(n,name,v)=>`<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${n}" name="${name}"><vt:lpwstr>${v}</vt:lpwstr></property>`
 return Buffer.from(zipSync({'[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Board minutes: acquisition terms.</w:t></w:r></w:p></w:body></w:document>'),'docProps/custom.xml':strToU8(`<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${p(2,`MSIP_Label_${guid}_Enabled`,'true')}${p(3,`MSIP_Label_${guid}_Name`,label)}</Properties>`)}))}
// The scanner's side of the protocol: bearer token, SHA-256 header, the bytes; it can be taken down for maintenance.
export async function threatHarness(){
 const scanner={up:false,seen:[]};
 const h=await harness({edge:async request=>{
  if(request.url!==SCANNER)return;
  assert.equal(request.headers.get('authorization'),'Bearer synthetic-chest-1');const body=Buffer.from(await request.arrayBuffer());assert.equal(sha(body),request.headers.get('x-chest-sha256'));scanner.seen.push(sha(body));
  if(!scanner.up)return new Response('maintenance',{status:503});
  return Response.json(body.includes(specimen)?{verdict:'infected',signature:'Eicar-Test-Signature',engine:'ClamAV 1.4.3',definitions:'27801'}:{verdict:'clean',engine:'ClamAV 1.4.3',definitions:'27801'});
 }});
 h.scanner=scanner;return h;
}
// Owner, a security admin scoped to the Contractors group, one scoped to Finance, contractors and a viewer.
export async function threatPeople(h){
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const names={sam:'Sam Patel',ray:'Ray Quinn',uma:'Uma Reyes',dana:'Dana Flores',eve:'Eve Brooks',dee:'Dee Walsh',vic:'Vic Moreno'},people={owner};
 for(const [k,name] of Object.entries(names))await h.api('/people',owner,{action:'invite',email:`${k}@example.test`,name});
 for(const k of Object.keys(names))people[k]=await h.signIn(`${k}@example.test`,true);
 const contractors=await h.api('/groups',owner,{name:'Contractors',members:['uma@example.test','dana@example.test','eve@example.test']}),finance=await h.api('/groups',owner,{name:'Finance',members:['ray@example.test']});
 await h.api('/administration/roles',owner,{email:'sam@example.test',role:'sharing-security',scope:'groups',groups:[contractors.id]});await h.api('/administration/roles',owner,{email:'ray@example.test',role:'sharing-security',scope:'groups',groups:[finance.id]});
 const space=await h.api('/spaces',owner,{name:'Field projects'});
 await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'uma@example.test',role:'contributor'},{principal:'dana@example.test',role:'content_manager'},{principal:'eve@example.test',role:'viewer'},{principal:'dee@example.test',role:'viewer'},{principal:'vic@example.test',role:'viewer'}]});
 return {people,space,contractors,finance};
}
export const until=async(check,what)=>{for(let i=0;i<60;i++){const v=await check();if(v)return v;await new Promise(r=>setTimeout(r,100))}assert.fail(what)};
if(process.argv[1]===new URL(import.meta.url).pathname){
 const h=await threatHarness();
 try{
  const {people,space,contractors}=await threatPeople(h),{owner,sam,ray,uma,dana,eve,dee,vic}=people;
  const bytesOf=(id,v,cookie,init={})=>h.fetch(`/api/chest/items/${id}/bytes/${v}${init.download===false?'':'?download=true'}`,{headers:{cookie,...init.headers}});
  const current=async id=>{const v=await h.api(`/items/${id}`,owner);return v.versions.find(x=>x.id===v.item.current)};
  // Connecting the scanner needs service settings; the test file proves it detects, and the token never comes back.
  await h.api('/threats/scanner',sam,{endpoint:SCANNER,token:'synthetic-chest-1'},403);
  const connected=await h.api('/threats/scanner',owner,{endpoint:SCANNER,token:'synthetic-chest-1'});assert.equal(connected.connected,true);assert.doesNotMatch(JSON.stringify(connected),/synthetic-chest-1/);
  assert.equal((await h.api('/threats/scanner/test',owner,{})).ok,false,'a scanner in maintenance fails the test');
  // While the scanner is down a new original waits in quarantine: no door serves it, however many sweeps pass.
  const report=await h.api('/items',uma,{space:space.id,name:'Site report.txt',base64:b64('Concrete pour finished on schedule.')}),rv=await current(report.id);
  await h.scheduled();await h.scheduled();
  {const r=await bytesOf(report.id,rv.id,owner);assert.equal(r.status,423);assert.equal((await r.json()).error,'scan_pending')}
  h.scanner.up=true;assert.equal((await h.api('/threats/scanner/test',owner,{})).ok,true);
  await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.lastAttemptAt','2000-01-01T00:00:00.000Z') WHERE kind='scan'");await h.scheduled();
  await until(async()=>(await bytesOf(report.id,rv.id,owner)).status===200,'a clean verdict opens every door');
  // The harmless test specimen: quarantined with the scanner's reasons, recorded in the history, alert to scoped admins.
  const specimenFile=await h.api('/items',uma,{space:space.id,name:'Invoice 2291.txt',base64:specimen.toString('base64')}),sv=await current(specimenFile.id);await h.scheduled();
  const view=await until(async()=>{const v=await h.api('/threats',sam);return v.quarantine.find(q=>q.checksum===sv.checksum&&q.state==='infected')&&v},'the scanner verdict reaches the quarantine history');
  const held=view.quarantine.find(q=>q.checksum===sv.checksum);assert.equal(held.signature,'Eicar-Test-Signature');assert.equal(held.engine,'ClamAV 1.4.3');assert.equal(held.uploadedBy,'uma@example.test');assert.deepEqual(held.files,[{id:null,name:'Restricted item'}],'security scope alone opens no names');assert.equal(held.releasable,true);
  assert.ok(view.history.alerts.some(a=>a.kind==='malware'&&a.subject.email==='uma@example.test'&&/Eicar-Test-Signature/.test(a.detail)));
  assert.ok((await h.api('/notices',sam)).some(n=>/Malware found/.test(n.payload.message)),'the scoped security admin is alerted');assert.ok((await h.api('/notices',uma)).some(n=>/quarantined/.test(n.payload.message)),'the uploader sees why');assert.ok(!(await h.api('/notices',ray)).some(n=>/Malware found/.test(n.payload.message)),'an admin scoped elsewhere is not');
  // Every door refuses the held original: preview, download, range, a sync device, a public link, an archive and search.
  for(const [what,r] of [['preview',await bytesOf(specimenFile.id,sv.id,owner,{download:false})],['download',await bytesOf(specimenFile.id,sv.id,owner)],['range',await bytesOf(specimenFile.id,sv.id,owner,{headers:{range:'bytes=0-9'}})]]){assert.equal(r.status,423,what);const body=await r.text();assert.ok(!body.includes('EICAR'),`${what} leaks nothing`)}
  const device=await h.api('/devices',owner,{name:'Owner laptop',platform:'linux'}),hydrate=id=>h.fetch(`/api/chest/sync/items/${id}/content`,{headers:{authorization:`Bearer ${device.token}`}});
  {const r=await hydrate(specimenFile.id);assert.equal(r.status,423);assert.ok(!(await r.text()).includes('EICAR'))}
  const link=await h.api(`/items/${specimenFile.id}/public-links`,owner,{audience:'public'}),secret=new URL(link.url).pathname.split('/')[2];
  for(const sub of ['f','p']){const r=await h.fetch(`/l/${secret}/${sub}/${specimenFile.id}`);assert.notEqual(r.status,200,`link ${sub}`);assert.ok(!(await r.text()).includes('EICAR'))}
  assert.equal((await h.api('/search?q=antivirus',owner)).count,0,'held text is neither matched nor quoted');
  {const job=await h.api('/bulk',owner,{action:'download',items:[specimenFile.id]}),zip=await h.raw(`/api/chest/bulk/${job.id}/archive`,owner);assert.equal(zip.status,200);const files=unzipSync(new Uint8Array(await zip.arrayBuffer())),manifest=JSON.parse(strFromU8(files['chest-manifest.json']));assert.equal(manifest.included.length,0);assert.equal(manifest.excluded[0].reason,'quarantined');assert.ok(!Object.values(files).some(b=>Buffer.from(b).includes(specimen)),'the archive leaks nothing')}
  assert.equal((await h.raw(`/api/chest/items/${specimenFile.id}/reading`,owner)).status,423,'readings are held too');
  const packed=await h.api('/items',uma,{space:space.id,name:'Payload.docx',base64:Buffer.from(zipSync({'word/document.xml':new Uint8Array(specimen)},{level:0})).toString('base64')});await h.scheduled();
  await until(async()=>{const r=await h.raw(`/api/chest/items/${packed.id}/office`,owner);return r.status===423&&(await r.json()).error==='quarantined'},'the editor refuses a quarantined Office file');
  assert.equal((await h.raw(`/api/chest/items/${packed.id}/office-preview`,owner)).status,423);
  // A delivery, an app token, a template and a signing request cannot reach the held bytes either.
  {const pack=await h.api('/transfers',owner,{item:specimenFile.id}),base=new URL(pack.url).pathname,start=await h.fetch(base+'/start',{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:''}),cookie=start.headers.get('set-cookie')?.split(';')[0]??'';
   const r=await h.fetch(base+'/f/'+specimenFile.id,{headers:{cookie,range:'bytes=0-67'}});assert.ok(![200,206].includes(r.status),`delivery ${r.status}`);assert.ok(!(await r.text()).includes('EICAR'))}
  {const app=await h.api('/integrations/clients',owner,{name:'Threat check client',redirects:['https://client.example.test/callback'],actions:['read','download'],confidential:true}),verifier=randomBytes(32).toString('base64url');
   const params=new URLSearchParams({client_id:app.client.id,redirect_uri:'https://client.example.test/callback',response_type:'code',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),state:randomBytes(32).toString('base64url'),scope:'read download',resource:specimenFile.id});
   const consent=await h.fetch('/oauth/chest/authorize?'+params,{headers:{cookie:owner}}),page=await consent.text(),intent=/name="intent" value="([^"]+)"/.exec(page)?.[1];assert.ok(intent,`consent ${consent.status}: ${page.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,400)}`);
   const allowed=await h.fetch('/oauth/chest/authorize',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({intent,decision:'allow'})}),code=new URL(allowed.headers.get('location')).searchParams.get('code');
   const token=await (await h.fetch('/oauth/chest/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://client.example.test'},body:new URLSearchParams({grant_type:'authorization_code',client_id:app.client.id,redirect_uri:'https://client.example.test/callback',code,code_verifier:verifier,client_secret:app.clientSecret})})).json();
   const r=await h.fetch(`/api/chest/integrations/v1/items/${specimenFile.id}/bytes/${sv.id}`,{headers:{authorization:'Bearer '+token.access_token}});assert.equal(r.status,423,'app token');assert.ok(!(await r.text()).includes('EICAR'))}
  {const r=await h.raw('/api/chest/templates',owner,{source:packed.id,name:'Payload',category:'Operations',audience:{type:'organisation'}});assert.equal(r.status,423,'template');assert.equal((await r.json()).error,'quarantined')}
  {const r=await h.raw('/api/chest/signatures',owner,{item:packed.id});assert.equal(r.status,423,'signing');assert.equal((await r.json()).error,'quarantined')}
  // Release is the reviewer's: not the uploader, not a viewer, not an admin scoped elsewhere; a reason is required.
  await h.api(`/threats/quarantine/${sv.checksum}/release`,uma,{reason:'mine'},403);await h.api(`/threats/quarantine/${sv.checksum}/release`,vic,{reason:'x'},403);await h.api(`/threats/quarantine/${sv.checksum}/release`,ray,{reason:'x'},403);await h.api(`/threats/quarantine/${sv.checksum}/release`,sam,{reason:''},400);
  const released=await h.api(`/threats/quarantine/${sv.checksum}/release`,sam,{reason:'Training file from the security awareness course.'});assert.equal(released.state,'released');assert.equal(released.release.by,'sam@example.test');
  // The original was never erased: the same bytes come back, and release widened no access.
  {const r=await bytesOf(specimenFile.id,sv.id,owner);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(specimen))}
  assert.equal((await bytesOf(specimenFile.id,sv.id,'')).status,401);
  assert.ok((await h.api('/audit',owner)).some(a=>a.action==='threats.malware.release'&&JSON.parse(a.detail).reason.startsWith('Training file')));
  console.log('SECURITY-002 scanner connection, pending and infected quarantine at every door, scoped release and kept originals passed');
  // A labelled document: the label is recorded, the history shows it, and sharing it outside the organization is refused.
  const minutes=await h.api('/items',uma,{space:space.id,name:'Board minutes.docx',base64:labelled().toString('base64')});await h.scheduled();
  const mv=await until(async()=>{const v=await current(minutes.id);return (await bytesOf(minutes.id,v.id,owner)).status===200&&v},'the labelled file scans clean');
  assert.deepEqual(mv.classification,{label:'Confidential',source:'Microsoft sensitivity label'});
  assert.ok((await h.api('/threats',sam)).history.alerts.some(a=>a.kind==='classification'&&a.detail.startsWith('Confidential')&&a.action==='restrict'));
  {const r=await h.raw(`/api/chest/items/${minutes.id}/public-links`,owner,{audience:'public'});assert.equal(r.status,403);assert.equal((await r.json()).error,'classification_blocks_external')}
  {const r=await h.raw(`/api/chest/items/${minutes.id}/public-links`,owner,{audience:'guests',guests:['partner@outside.test']});assert.equal(r.status,403);assert.equal((await r.json()).error,'classification_blocks_external')}
  await h.api(`/items/${minutes.id}/shares`,owner,{principal:'ray@example.test',role:'viewer'});assert.equal((await bytesOf(minutes.id,mv.id,ray)).status,200,'colleagues inside the organization still open it');
  // A marking that arrives later stops an existing outside link on its next request, and the original stays.
  const plan=await h.api('/items',owner,{space:space.id,name:'Bid plan.txt',base64:b64('Bid plan draft.')});await h.scheduled();const planLink=await h.api(`/items/${plan.id}/public-links`,owner,{audience:'public'}),planSecret=new URL(planLink.url).pathname.split('/')[2];
  await until(async()=>(await h.fetch(`/l/${planSecret}/f/${plan.id}`)).status===200,'the outside link serves the unlabelled plan');
  await h.api(`/items/${plan.id}/versions`,owner,{base64:b64('Classification: Restricted\nBid plan final.')});await h.scheduled();const marked=await current(plan.id);assert.equal(marked.classification.label,'Restricted');
  await until(async()=>(await bytesOf(plan.id,marked.id,owner)).status===200,'the marked version scans clean');
  {const r=await h.fetch(`/l/${planSecret}/f/${plan.id}`);assert.notEqual(r.status,200);const page=await r.text();assert.ok(!page.includes('Bid plan final'),'a sensitive label stops the outside link');assert.match(page,/polic/i)}
  assert.equal((await h.api(`/items/${plan.id}`,owner)).versions.length,2,'classification rules erase nothing');
  console.log('SECURITY-002 labelled document classification, outside-sharing refusal and existing link stop passed');
  // Disconnecting stops new scans and keeps every verdict.
  await h.api('/threats/scanner/remove',owner,{});const kept=await h.api('/threats',sam);assert.equal(kept.scanner.connected,false);assert.equal(kept.quarantine.find(q=>q.checksum===sv.checksum).state,'released');
  // Defaults: 501 files downloaded by one account in 10 minutes alerts; 199 items trashed does not.
  const files=[];for(let i=0;i<510;i+=30)files.push(...await Promise.all(Array.from({length:Math.min(30,510-i)},(_,j)=>h.api('/items',owner,{space:space.id,name:`Drawing ${String(i+j).padStart(3,'0')}.txt`,base64:b64(`Drawing ${i+j}`)}))));
  const ids=files.map(f=>[f.id,f.payload.current]);
  const downloads=async(cookie,list)=>{const statuses=[];for(let i=0;i<list.length;i+=25)statuses.push(...await Promise.all(list.slice(i,i+25).map(async([id,v])=>{const r=await bytesOf(id,v,cookie);await r.arrayBuffer();return r.status})));return statuses};
  const alertsFor=async email=>(await h.api('/threats',owner)).history.alerts.filter(a=>a.subject?.email===email);
  assert.deepEqual([...new Set(await downloads(dee,ids.slice(0,500)))],[200]);assert.equal((await alertsFor('dee@example.test')).length,0,'500 files is within the default');
  assert.deepEqual(await downloads(dee,ids.slice(500,501)),[200],'the default alerts without pausing');
  const deeAlert=(await alertsFor('dee@example.test')).find(a=>a.kind==='downloads');assert.ok(deeAlert,'the 501st file raises the alert');assert.equal(deeAlert.count,501);assert.match(deeAlert.rule,/More than 500 files or 5 GB downloaded in 10 minutes \(organization; alert\)/);
  for(let i=0;i<199;i+=25)await Promise.all(ids.slice(i,Math.min(i+25,199)).map(([id])=>h.api(`/items/${id}/trash`,owner,{})));
  assert.equal((await alertsFor(h.vars.OWNER_EMAIL)).filter(a=>a.kind==='deletions').length,0,'199 trashed items raise no alert');
  console.log('SECURITY-002 default thresholds: 501 downloads alert, 199 trashed items do not passed');
  // Tuning: a group-scoped admin tunes only their group, every change audited with before and after values.
  await h.api('/threats/policy',sam,{files:1000,gigabytes:5,downloadAction:'alert',items:200,deletionAction:'alert'},403);await h.api('/threats/policy',ray,{group:contractors.id,files:100,gigabytes:5,downloadAction:'pause'},403);
  await h.api('/threats/policy',sam,{group:contractors.id,files:100,gigabytes:5,downloadAction:'pause',items:5,deletionAction:'alert'});
  const change=(await h.api('/audit',owner)).find(a=>a.action==='threats.policy');const detail=JSON.parse(change.detail);assert.equal(detail.scope,`group:${contractors.id}`);assert.equal(detail.before,null);assert.deepEqual(detail.after,{downloads:{files:100,bytes:5e9,action:'pause'},deletions:{items:5,action:'alert'}});
  // Dana, a contractor: six trashed items cross the group's deletion rule; the 101st download is refused and names the rule.
  const pool=ids.slice(199,509);for(const [id] of pool.slice(0,6))await h.api(`/items/${id}/trash`,dana,{});
  assert.ok((await alertsFor('dana@example.test')).some(a=>a.kind==='deletions'&&a.count===6&&/More than 5 items trashed or deleted in 10 minutes \(group Contractors; alert\)/.test(a.rule)));
  const visible=pool.slice(6);assert.deepEqual([...new Set(await downloads(dana,visible.slice(0,100)))],[200]);
  {const r=await bytesOf(visible[100][0],visible[100][1],dana);assert.equal(r.status,423);const e=await r.json();assert.equal(e.error,'activity_paused');assert.match(e.rule,/More than 100 files or 5 GB downloaded in 10 minutes \(group Contractors; pause\)/)}
  const danaAlert=(await alertsFor('dana@example.test')).find(a=>a.kind==='downloads');assert.equal(danaAlert.count,101);assert.equal(danaAlert.paused,true);assert.match(danaAlert.rule,/group Contractors; pause/);
  assert.equal((await bytesOf(visible[0][0],visible[0][1],dana)).status,423,'the account stays paused');await h.api(`/items/${visible[1][0]}/trash`,dana,{},423);
  // A burst through a test client: Eve's sync device crosses the same rule and only the device is paused.
  const eveDevice=await h.api('/devices',eve,{name:'Eve tablet',platform:'linux'}),eveHydrate=([id])=>h.fetch(`/api/chest/sync/items/${id}/content`,{headers:{authorization:`Bearer ${eveDevice.token}`}});
  const burst=[];for(let i=0;i<101;i+=25)burst.push(...await Promise.all(visible.slice(i,Math.min(i+25,101)).map(async f=>{const r=await eveHydrate(f);await r.arrayBuffer();return r.status})));
  assert.equal(burst.filter(s=>s===200).length,100);assert.equal(burst.filter(s=>s===423).length,1);
  const deviceAlert=(await alertsFor('eve@example.test')).find(a=>a.subject.type==='device');assert.equal(deviceAlert.subject.id,eveDevice.device.id);assert.equal(deviceAlert.paused,true);
  assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${eveDevice.token}`}})).status,423,'a paused device is refused everywhere');assert.equal((await bytesOf(visible[0][0],visible[0][1],eve)).status,200,'Eve herself is not paused');
  // Resume: only an admin whose scope covers the person; evidence stays, and counting starts again.
  const history=await h.api('/threats',sam),danaPause=history.history.pauses.find(p=>p.subject.email==='dana@example.test'&&!p.resumedAt);await h.api(`/threats/pauses/${danaPause.id}/resume`,ray,{},403);await h.api(`/threats/pauses/${danaPause.id}/resume`,sam,{});
  assert.equal((await bytesOf(visible[0][0],visible[0][1],dana)).status,200);assert.ok((await h.api('/threats',sam)).history.alerts.some(a=>a.subject?.email==='dana@example.test'&&a.kind==='downloads'),'alerts are kept');
  // A manual pause of a device keeps every file; tightening rules never touched an original.
  const devPause=(await h.api('/threats',sam)).history.pauses.find(p=>p.subject.type==='device'&&!p.resumedAt);await h.api(`/threats/pauses/${devPause.id}/resume`,sam,{});assert.equal((await eveHydrate(visible[0])).status,200);
  await h.api('/threats/pauses',sam,{type:'device',id:eveDevice.device.id,reason:'Lost on site'});assert.equal((await eveHydrate(visible[0])).status,423);
  assert.equal((await h.api(`/items/${visible[0][0]}`,owner)).versions.length,1);
  // The byte half of the rule, scaled down: the owner lowers the organization threshold to 0.001 GB, audited before and after.
  await h.api('/threats/policy',owner,{files:500,gigabytes:0.001,downloadAction:'alert',items:200,deletionAction:'alert'});
  const orgChange=JSON.parse((await h.api('/audit',owner)).find(a=>a.action==='threats.policy'&&JSON.parse(a.detail).scope==='organization').detail);assert.equal(orgChange.before.downloads.bytes,5e9);assert.equal(orgChange.after.downloads.bytes,1e6);
  const surveys=await Promise.all([1,2].map(n=>h.api('/items',owner,{space:space.id,name:`Survey ${n}.bin`,base64:randomBytes(600_000).toString('base64')})));
  for(const f of surveys){const r=await bytesOf(f.id,f.payload.current,vic);assert.equal(r.status,200);await r.arrayBuffer()}
  const vicAlert=(await alertsFor('vic@example.test')).find(a=>a.kind==='downloads');assert.ok(vicAlert,'two 600 KB files cross 0.001 GB');assert.equal(vicAlert.bytes,1_200_000);assert.match(vicAlert.rule,/More than 500 files or 0\.001 GB downloaded in 10 minutes \(organization; alert\)/);
  console.log('SECURITY-002 group threshold pause names the rule, device burst pause, scoped tuning, byte threshold, resume and audited changes passed');
 }finally{await h.close()}
}
