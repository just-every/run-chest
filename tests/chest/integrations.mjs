// CONNECT-007 via the built Worker; the OAuth client and webhook receiver are network edges.
import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {request as httpsRequest} from 'node:https';
import {harness} from './harness.mjs';
import {integrationReportSetup} from './administration-report-flow.mjs';
let signingSecret='',receiverMode='fail',received=new Map(),attempts=0;
const h=await harness({bindings:{CHEST_OUTBOUND_HOSTS:'hooks.example.test,api.resend.com'},edge:async request=>{if(new URL(request.url).hostname!=='hooks.example.test')return;const body=await request.text(),signature=request.headers.get('x-chest-signature'),[,timestamp,mac]=/^t=(\d+),v1=([a-f0-9]+)$/.exec(signature)||[];assert.ok(timestamp&&Math.abs(Date.now()/1000-Number(timestamp))<60);assert.equal(mac,createHmac('sha256',signingSecret).update(timestamp+'.'+body).digest('hex'));const event=JSON.parse(body);assert.equal(request.headers.get('x-chest-event'),event.id);attempts++;if(receiverMode==='fail')return new Response('temporarily unavailable',{status:503});if(!received.has(event.id))received.set(event.id,event);if(receiverMode==='uncertain')await new Promise(resolve=>setTimeout(resolve,12000));return Response.json({accepted:event.id,duplicate:received.has(event.id)})}});
const b64=s=>Buffer.from(s).toString('base64'),random=()=>randomBytes(32).toString('base64url');
const call=async(token,path,{method='GET',body,key,status=200}={})=>{const response=await h.fetch('/api/chest/integrations/v1'+path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,status,`integration ${path}: ${response.status===status?'':await response.text()}`);return response.status===200?response.json():null};
const form=(path,cookie,body)=>h.fetch(path,{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
let owner,staff,folder,other,client;
async function consentFor(app,cookie,scopes,roots=[folder.id],budget={}){const verifier=random(),challenge=createHash('sha256').update(verifier).digest('base64url'),params=new URLSearchParams({client_id:app.client.id,redirect_uri:'https://client.example.test/callback',response_type:'code',code_challenge_method:'S256',code_challenge:challenge,state:random(),scope:scopes.join(' '),...budget});for(const root of roots)params.append('resource',root);const response=await h.fetch('/oauth/chest/authorize?'+params,{headers:{cookie}});return {response,verifier,params}}
async function authorize(app,cookie,scopes,roots,budget){const {response,verifier}=await consentFor(app,cookie,scopes,roots,budget);assert.equal(response.status,200,await response.clone().text());const html=await response.text(),intent=/name="intent" value="([^"]+)"/.exec(html)?.[1];assert.ok(intent);const allowed=await form('/oauth/chest/authorize',cookie,{intent,decision:'allow'});assert.equal(allowed.status,303);const callback=new URL(allowed.headers.get('location'));assert.equal(callback.origin,'https://client.example.test');const exchangeBody={grant_type:'authorization_code',client_id:app.client.id,redirect_uri:'https://client.example.test/callback',code:callback.searchParams.get('code'),code_verifier:verifier,...(app.clientSecret?{client_secret:app.clientSecret}:{})},exchange=body=>h.fetch('/oauth/chest/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://client.example.test'},body:new URLSearchParams(body)});assert.equal((await exchange({...exchangeBody,code_verifier:random()})).status,400,'PKCE refuses a different verifier');const token=await exchange(exchangeBody);assert.equal(token.status,200,token.status===200?'':await token.clone().text());assert.equal((await exchange(exchangeBody)).status,400,'authorization code is single use');return token.json()}
async function waitDelivery(token,subscription,predicate){for(let n=0;n<30;n++){const result=await call(token,`/webhooks/${subscription}/deliveries`),found=result.items.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,50))}assert.fail('webhook delivery did not settle')}
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 await h.api('/people',owner,{action:'invite',email:'staff@example.test',name:'Sam'});staff=await h.signIn('staff@example.test',true);const space=(await h.api('/files',staff)).personal;folder=await h.api('/items',staff,{space,type:'folder',name:'Authorized folder'});other=await h.api('/items',staff,{space,type:'folder',name:'Outside grant'});
 const initial=[];for(let n=0;n<5;n++)initial.push(await h.api('/items',staff,{parent:folder.id,name:`Original ${n}.txt`,base64:b64(`Searchable original ${n}`)}));const restricted=await h.api('/items',staff,{parent:folder.id,name:'Private.txt',base64:b64('Private')});
 client=await h.api('/integrations/clients',staff,{name:'Scoped client and MCP agent',redirects:['https://client.example.test/callback'],pickerOrigins:['https://client.example.test'],actions:['read','search','download','upload','folder','versions','share','request','picker','webhook'],confidential:true});
 const expanded=await consentFor(client,staff,['read'],[folder.id]);expanded.params.set('redirect_uri','https://attacker.example.test/callback');assert.equal((await h.fetch('/oauth/chest/authorize?'+expanded.params,{headers:{cookie:staff}})).status,400,'redirect exact match');
 const grant=await authorize(client,staff,['read','search','download','upload','folder','versions','share','request','picker','webhook']);let token=grant.access_token;
 // SURFACE-010: the report door requires separate consent and current delegated authority.
 const report = await integrationReportSetup(h,owner);
 const reportApp = await h.api('/integrations/clients',report.admin,{name:'Read-only report client',redirects:['https://client.example.test/callback'],actions:['read','admin-report']});
 const reportConsent = async (groups=[report.group.id],cookie=report.admin) => {
  const budget={report_group:groups[0]};
  const pending=await consentFor(reportApp,cookie,['admin-report'],[],budget);
  for(const group of groups.slice(1))pending.params.append('report_group',group);
  if(groups.length>1)pending.response=await h.fetch('/oauth/chest/authorize?'+pending.params,{headers:{cookie}});
  return pending;
 };
 const issueReport = async (groups=[report.group.id]) => {
  const pending=await reportConsent(groups);assert.equal(pending.response.status,200,await pending.response.clone().text());
  const intent=/name="intent" value="([^"]+)"/.exec(await pending.response.text())[1];
  const absent=await form('/oauth/chest/authorize',report.admin,{intent,decision:'allow'});assert.equal(absent.status,403);assert.match(await absent.text(),/oauth_report_consent_required/);
  const allowed=await form('/oauth/chest/authorize',report.admin,{intent,decision:'allow',adminReportConsent:'yes',report_group:report.otherGroup.id});assert.equal(allowed.status,303);
  const response=await h.fetch('/oauth/chest/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:reportApp.client.id,redirect_uri:'https://client.example.test/callback',code:new URL(allowed.headers.get('location')).searchParams.get('code'),code_verifier:pending.verifier})});
  assert.equal(response.status,200);return response.json();
 };
 const reportGrant=await issueReport(),reportToken=reportGrant.access_token;
 const reportRaw=(path,access=reportToken)=>h.fetch('/api/chest/integrations/v1/administration/audit'+path,{headers:{authorization:'Bearer '+access}});
 const pages = async (access=reportToken) => {
  const rows=[],params=new URLSearchParams(report.filter);params.set('limit','100');let page;
  do {const response=await reportRaw('?'+params,access);assert.equal(response.status,200);page=await response.json();rows.push(...page.rows);if(page.next)params.set('cursor',page.next)}while(page.next);
  return rows;
 };
 const expected={rows:[]},browserParams=new URLSearchParams(report.filter);browserParams.set('group',report.group.id);browserParams.set('limit','300');let browserPage;
 do{browserPage=await h.api('/administration/audit?'+browserParams,report.admin);expected.rows.push(...browserPage.rows);if(browserPage.next)browserParams.set('cursor',browserPage.next)}while(browserPage.next);
 assert.equal(expected.rows.length,305);
 assert.deepEqual(await pages(),expected.rows,'all bounded pages match the browser metadata report');
 const exportPath='/export?'+report.filter+'&limit=2';
 const csv=await reportRaw(exportPath);assert.equal(csv.status,200);const csvText=await csv.text();
 const browserCsv=await h.raw('/api/chest/administration/audit/export?'+report.filter+'&group='+report.group.id,report.admin);
 assert.equal(csvText,await browserCsv.text(),'paginated integration CSV equals the scoped browser CSV row for row');
 const bounded=JSON.stringify(await pages());for(const hidden of [report.secret.id,report.outsideEmail,report.file.payload.name,report.secret.payload.name,'synthetic-chest-44 private original'])assert.ok(!bounded.includes(hidden),'report is content blind and excludes other selected authority');
 const deniedGroup=await reportRaw('?'+report.filter+'&group='+report.otherGroup.id);assert.equal(deniedGroup.status,403);assert.equal((await deniedGroup.json()).error,'admin_group_scope_required');
 assert.equal((await h.fetch('/api/chest/integrations/v1/items',{headers:{authorization:'Bearer '+reportToken}})).status,403,'report consent conveys no file action');
 await h.api(`/items/${report.file.id}`,report.admin,undefined,403);
 const reportFolder=await h.api('/items',report.admin,{space:(await h.api('/files',report.admin)).personal,type:'folder',name:'Report sponsor files'});
 const ordinary=await authorize(reportApp,report.admin,['read'],[reportFolder.id]);
 const noCapability=await reportRaw('',ordinary.access_token);assert.equal(noCapability.status,403);assert.equal((await noCapability.json()).error,'oauth_action_outside_grant');
 const staffBrowser=await h.api('/administration/audit',staff,undefined,403),staffAgent=await reportRaw('',token);assert.equal(staffAgent.status,403);assert.equal((await staffAgent.json()).error,staffBrowser.error);
 const staffConsent=await reportConsent([report.group.id],staff);assert.equal(staffConsent.response.status,403);assert.match(await staffConsent.response.text(),/admin_required/);
 await h.stop();await h.start();assert.deepEqual(await pages(),expected.rows,'group selection persists across restart');
 const firstPage=await (await reportRaw('?'+report.filter+'&limit=2')).json();assert.ok(firstPage.next);
 const assertStopped = async (access,status,code) => {
  for(const path of ['?'+report.filter,'?'+report.filter+'&cursor='+encodeURIComponent(firstPage.next),exportPath]){
   const response=await reportRaw(path,access);assert.equal(response.status,status);assert.equal((await response.json()).error,code);
  }
 };
 // A second HTTP connection lets revocation arrive while the first response remains open.
 // Miniflare's dispatch connection otherwise queues a mutation behind that same response body.
 const revokeOnAnotherConnection=(path,cookie,body)=>new Promise((resolve,reject)=>{
  const request=httpsRequest(new URL('/api/chest'+path,h.origin),{method:'POST',rejectUnauthorized:false,headers:{cookie,origin:h.origin,'content-type':'application/json'}},response=>{
   const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>{try{assert.equal(response.statusCode,200,Buffer.concat(chunks).toString());resolve()}catch(error){reject(error)}});
  });request.on('error',reject);request.end(JSON.stringify(body));
 });
 const interruptedCsv=async (access,revoke) => {
  const response=await reportRaw(exportPath,access);assert.equal(response.status,200);const reader=response.body.getReader();
  const first=await reader.read();assert.ok(!first.done&&new TextDecoder().decode(first.value).startsWith('At,Actor'));
  await revoke();
  const chunks=[first.value];
  try {let next;while(!(next=await reader.read()).done)chunks.push(next.value)}catch { /* A transport may surface the server's abort as a read error. */ }
  const emitted=Buffer.concat(chunks).toString(),rows=emitted.trimEnd().split('\r\n').slice(1);
  assert.ok(rows.length>0&&rows.length<expected.rows.length,'revocation interrupts the open export before its remaining rows are emitted');
  assert.ok(rows.every(row=>row.includes(report.file.id)),'an interrupted export contains only authorized custody');
  reader.releaseLock();
 };
 // The live authority is intersected with both saved groups after one is removed.
 const both=await issueReport([report.group.id,report.otherGroup.id]);assert.equal((await pages(both.access_token)).length,306);
 await h.api('/administration/roles',owner,{id:report.delegation.id,groups:[report.group.id]});assert.deepEqual(await pages(both.access_token),expected.rows);
 await interruptedCsv(reportToken,()=>revokeOnAnotherConnection('/administration/roles',owner,{id:report.delegation.id,groups:[report.otherGroup.id]}));
 await assertStopped(reportToken,403,'admin_group_scope_required');await h.stop();await h.start();await assertStopped(reportToken,403,'admin_group_scope_required');
 await h.api('/administration/roles',owner,{id:report.delegation.id,groups:[report.group.id]});
 const revokedReport=await issueReport();await interruptedCsv(revokedReport.access_token,()=>revokeOnAnotherConnection(`/integrations/grants/${revokedReport.grant}/revoke`,report.admin,{}));
 await assertStopped(revokedReport.access_token,401,'oauth_grant_revoked');await h.stop();await h.start();await assertStopped(revokedReport.access_token,401,'oauth_grant_revoked');
 await h.api('/audit/privacy',report.member,{hidden:true});
 assert.deepEqual(await pages(),[],'the integration report honors the browser view-history suppression');
 await h.api('/audit/privacy',report.member,{hidden:false});
 assert.deepEqual(await pages(),expected.rows);
 await h.api('/administration/roles',owner,{action:'revoke',id:report.delegation.id});
 await assertStopped(reportToken,403,'admin_required');
 await h.api('/administration/roles',owner,{email:report.adminEmail,role:'audit-reporting',scope:'groups',groups:[report.group.id]});
 const erasedReport=await issueReport();
 await h.api('/erasure',owner,{email:report.adminEmail,confirm:report.adminEmail});
 await assertStopped(erasedReport.access_token,401,'oauth_token_expired');
 await h.stop();await h.start();await assertStopped(erasedReport.access_token,401,'oauth_token_expired');
 console.log('PROBE SURFACE-010 1: real OAuth activity pages and CSV -> 305 scoped browser rows, content blind, separate consent, live intersection, scope and OAuth revocation stop streams and persisted reads');
 console.log('PROBE SURFACE-010 2: staff OAuth report request -> 403 '+staffBrowser.error+', matching the browser');
 // Pagination returns only stable IDs under the folder; current role/no-download still govern every door.
 const seen=[];let cursor=null;do{const result=await call(token,'/items?limit=2'+(cursor?'&cursor='+cursor:''));seen.push(...result.items.map(r=>r.id));cursor=result.nextCursor}while(cursor);assert.equal(new Set(seen).size,7);assert.ok(seen.includes(folder.id)&&!seen.includes(other.id));await call(token,`/items/${other.id}`,{status:403});
 const search=await call(token,'/search?q=Searchable&type=documents&creator=me&limit=2');assert.equal(search.items.length,2);assert.ok(search.nextCursor);assert.ok(search.items.every(r=>initial.some(i=>i.id===r.id)));
 const uploadInput={parent:folder.id,name:'Idempotent.txt',base64:b64('One immutable upload')},first=await call(token,'/items',{method:'POST',body:uploadInput,key:'upload-once'});await h.stop();await h.start();const repeated=await call(token,'/items',{method:'POST',body:uploadInput,key:'upload-once'});assert.equal(repeated.id,first.id);assert.equal((await h.api(`/items/${folder.id}`,staff)).children.filter(i=>i.name==='Idempotent.txt').length,1);await call(token,'/items',{method:'POST',body:{...uploadInput,name:'Different.txt'},key:'upload-once',status:409});await call(token,'/items',{method:'POST',body:{parent:other.id,name:'Escape.txt',base64:b64('Escape')},key:'outside-folder',status:403});
 const uploadAudit=(await h.api('/audit',owner)).find(r=>r.action==='file.upload'&&r.object_id===first.id);assert.ok(uploadAudit,'upload audit exists');assert.equal(uploadAudit.actor,'staff@example.test','non-sharing audit keeps its existing person actor');
 const versions=await call(token,`/items/${first.id}/versions?limit=1`);assert.equal(versions.items.length,1);const downloaded=await h.fetch(`/api/chest/integrations/v1/items/${first.id}/bytes/${versions.items[0].id}`,{headers:{authorization:'Bearer '+token}});assert.equal(await downloaded.text(),'One immutable upload');
 // SURFACE-005: OAuth version restore preserves originals, identity and a pre-existing current-version link.
 const sponsor=uploadAudit.actor,recoverySpace=await h.api('/spaces',owner,{name:'Agent recovery'});
 const recoveryMembers=role=>[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:sponsor,role}];
 await h.api(`/spaces/${recoverySpace.id}/members`,owner,{members:recoveryMembers('content_manager')});
 const recoveryRoot=await h.api('/items',staff,{space:recoverySpace.id,type:'folder',name:'Recoverable originals'});
 const originalA=Buffer.from('synthetic-chest-1: approved original A\n'),originalB=Buffer.from('synthetic-chest-2: later original B with different bytes\n');
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.notEqual(sha(originalA),sha(originalB));
 const recoverable=await h.api('/items',staff,{parent:recoveryRoot.id,name:'Recovery.txt',base64:b64(originalA),checksum:sha(originalA),size:originalA.length}),a=recoverable.payload.current;
 const replacement=await h.api(`/items/${recoverable.id}/versions`,staff,{base64:b64(originalB),checksum:sha(originalB),size:originalB.length}),b=replacement.payload.current;
 const existingLink=await h.api(`/items/${recoverable.id}/public-links`,staff,{versionMode:'current'}),linkPath=new URL(existingLink.url).pathname;
 const downloadHash=async(path,headers={})=>{const response=await h.fetch(path,{headers});assert.equal(response.status,200);return sha(Buffer.from(await response.arrayBuffer()))};
 assert.equal(await downloadHash(`${linkPath}/f/${recoverable.id}`),sha(originalB),'existing current-version link serves B before restore');
 const recoveryGrant=await authorize(client,staff,['read','download','versions'],[recoveryRoot.id]),recoveryToken=recoveryGrant.access_token;
 const restorePath=`/items/${recoverable.id}/versions/${a}/restore`,restore=()=>call(recoveryToken,restorePath,{method:'POST',body:{},key:'restore-original-once'});
 const restored=await restore();assert.equal(restored.id,recoverable.id,'restore keeps the stable item ID');assert.notEqual(restored.current,a);assert.notEqual(restored.current,b);assert.equal(restored.sha256,sha(originalA));
 const reconcileRestore=async()=>{
  const detail=await h.api(`/items/${recoverable.id}`,staff),listed=await call(recoveryToken,`/items/${recoverable.id}/versions`),links=(await h.api(`/items/${recoverable.id}`,owner)).publicLinks;
  assert.equal(detail.id,recoverable.id);assert.equal(detail.item.current,restored.current);assert.equal(detail.versions.length,3,'exactly one restore version is added');
  assert.deepEqual(detail.versions.map(v=>v.id).sort(),[a,b,restored.current].sort());assert.deepEqual(listed.items.map(v=>v.id).sort(),[a,b,restored.current].sort());
  const newVersion=detail.versions.find(v=>v.id===restored.current);assert.equal(newVersion.arrival,'restore');assert.equal(newVersion.restoredFrom,a);assert.equal(newVersion.actor,sponsor);
  for(const [version,bytes] of [[a,originalA],[b,originalB],[restored.current,originalA]])assert.equal(await downloadHash(`/api/chest/integrations/v1/items/${recoverable.id}/bytes/${version}`,{authorization:'Bearer '+recoveryToken}),sha(bytes),'every retained original downloads with its exact hash');
  assert.equal(links.find(l=>l.id===existingLink.link.id).versionMode,'current');assert.equal(await downloadHash(`${linkPath}/f/${recoverable.id}`),sha(originalA),'the original link follows restored A');
  const audit=await h.api('/audit',owner),restores=audit.filter(r=>r.action==='version.restore'&&r.object_id===recoverable.id);
  assert.equal(restores.length,1,'retry publishes one restore audit');assert.equal(restores[0].actor,sponsor);assert.deepEqual(JSON.parse(restores[0].detail),{source:a,version:restored.current,outcome:'succeeded',authority:'integration:member'});
  assert.equal(audit.filter(r=>r.action==='integration.mutation'&&r.object_id===recoveryGrant.grant&&JSON.parse(r.detail).path===restorePath).length,1,'retry publishes one integration receipt audit');
  return {current:detail.item.current,versions:detail.versions,links:links.map(({downloads,summary,...link})=>link),restores};
 };
 await reconcileRestore();assert.deepEqual(await restore(),restored);await h.stop();await h.start();assert.deepEqual(await restore(),restored,'same key returns the saved restore after Worker restart');
 const preserved=await reconcileRestore();
 await h.api(`/spaces/${recoverySpace.id}/members`,owner,{members:recoveryMembers('viewer')});
 for(const key of ['restore-original-once','restore-reader-refused'])await call(recoveryToken,restorePath,{method:'POST',body:{},key,status:403});
 await h.api(`/spaces/${recoverySpace.id}/members`,owner,{members:recoveryMembers('content_manager')});
 assert.deepEqual(await reconcileRestore(),preserved,'a current viewer cannot restore or replay a previous mutation');
 await h.api(`/integrations/grants/${recoveryGrant.grant}/revoke`,staff,{});
 for(const key of ['restore-original-once','restore-revoked-refused'])await call(recoveryToken,restorePath,{method:'POST',body:{},key,status:401});
 await h.stop();await h.start();await call(recoveryToken,restorePath,{method:'POST',body:{},key:'restore-original-once',status:401});
 const afterRefusals=await h.api(`/items/${recoverable.id}`,staff);assert.equal(afterRefusals.item.current,preserved.current);assert.deepEqual(afterRefusals.versions,preserved.versions);
 const finalAudit=await h.api('/audit',owner);assert.deepEqual(finalAudit.filter(r=>r.action==='version.restore'&&r.object_id===recoverable.id),preserved.restores);
 assert.equal(finalAudit.filter(r=>r.action==='integration.mutation'&&r.object_id===recoveryGrant.grant).length,1,'refused attempts add no successful mutation receipt');
 assert.equal(await downloadHash(`${linkPath}/f/${recoverable.id}`),sha(originalA),'grant revocation preserves the independent existing link');
 console.log('PROBE SURFACE-005 point 1: OAuth version restore -> exact A hash, retained A and B, stable item and original link; restart retry -> one restore and audit; viewer and revoked grant -> refusal with unchanged history');
 // SECURITY-002: a paused OAuth source stops metadata and mutations too; browser authority remains independent.
 const securityGroup=await h.api('/groups',owner,{name:'Scoped download protection',members:['staff@example.test']});await h.api('/content-security/rule',owner,{scope:securityGroup.id,files:1,bytes:5*1024**3,deletions:200,pause:true});await h.sql('UPDATE chest_activity_events SET at=at-600001');
 const originalPath=`/api/chest/integrations/v1/items/${first.id}/bytes/${versions.items[0].id}`;assert.equal((await h.fetch(originalPath,{headers:{authorization:'Bearer '+token}})).status,200);assert.equal((await h.fetch(originalPath,{headers:{authorization:'Bearer '+token}})).status,423);await call(token,'/items',{status:423});assert.equal((await h.raw('/api/chest/files',staff)).status,200);
 await h.sql('UPDATE chest_activity_events SET at=at-600001');await h.api('/content-security/resume',owner,{subject:'account:staff@example.test',reason:'Reviewed test download burst'});await h.api('/content-security/resume',owner,{subject:'token:'+createHash('sha256').update(token).digest('hex'),reason:'Reviewed the exact scoped client credential'});await h.api('/content-security/rule',owner,{scope:securityGroup.id,files:500,bytes:5*1024**3,deletions:200,pause:false});await call(token,'/items');
 const pick=await call(token,`/items/${first.id}/pick`,{method:'POST',body:{}});assert.equal(pick.id,first.id);assert.equal(pick.url,`${h.origin}/app/items/${first.id}`);assert.ok(!pick.url.includes('chest_oauth_'));
 const rpc=async body=>{const r=await h.fetch('/mcp/chest',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json()};assert.equal((await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'Contract agent',version:'1'}}})).result.serverInfo.name,'Chest');assert.ok((await rpc({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools.some(t=>t.name==='chest_upload'));
 const agent=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'chest_create_folder',arguments:{parent:folder.id,name:'From MCP',key:'agent-folder-once'}}});assert.equal(agent.result.isError,false);const agentAgain=await rpc({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'chest_create_folder',arguments:{parent:folder.id,name:'From MCP',key:'agent-folder-once'}}});assert.equal(agent.result.structuredContent.id,agentAgain.result.structuredContent.id);assert.equal((await rpc({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'chest_get',arguments:{id:other.id}}})).result.isError,true);
 // External agent actions preserve autonomy and record the authenticated initiator, never human consent.
 const sharingRules={scope:'organisation',allowExternal:true,allowPublic:true,allowOrganisation:true,allowDiscovery:true,defaultAudience:'restricted',defaultRole:'viewer',warnExternal:true,organizationDomains:['example.test']};
 await h.api('/link-policy',owner,sharingRules);
 const partners={};for(const email of ['partner@outside.test','second@outside.test']){await h.api('/people',owner,{action:'invite',email,name:'Partner'});partners[email]=await h.signIn(email,true)}
 await h.api(`/items/${first.id}/shares`,staff,{principal:'partner@outside.test',role:'viewer'},409);
 const agentShares=async()=> (await h.api('/audit',owner)).filter(r=>r.action==='share.grant'&&r.object_id===first.id);
 const assertAgentAudit=(row,outside=true)=>{
  assert.ok(row,'agent share has a durable audit row');const detail=JSON.parse(row.detail);
  assert.equal(row.actor,'agent:'+client.client.id,'audit actor is the agent');
  assert.equal(detail.initiation,'agent-initiated','audit records agent initiation');
  assert.equal(detail.agent,client.client.id,'audit names authenticated agent');
  assert.equal(detail.sponsor,'staff@example.test','audit names authenticated sponsor');
  assert.equal(detail.grant,grant.grant,'audit names authenticated grant');
  if(outside){assert.equal(detail.riskClass,'external-share','audit records external risk class');assert.equal(detail.policyDecision,'allow','audit records policy decision');assert.equal(detail.policy,'current-behavior','audit identifies compatibility policy');assert.equal(detail.humanConfirmed,false,'agent flag is never human confirmation')}
  else {assert.equal(detail.riskClass,undefined,'internal share has no external risk class');assert.equal(detail.humanConfirmed,undefined,'internal share needs no human confirmation')}
  assert.equal(detail.confirmExternal,undefined,'raw agent flag is not stored as confirmation');
 };
 await call(token,`/items/${first.id}/shares`,{method:'POST',body:{principal:'partner@outside.test',role:'viewer',confirmExternal:true,agent:'forged',sponsor:'forged@example.test'},key:'external-agent-confirmed'});
 assertAgentAudit((await agentShares()).find(r=>JSON.parse(r.detail).principal==='partner@outside.test'));
 const mcpShare=await rpc({jsonrpc:'2.0',id:6,method:['tools','call'].join('/'),params:{name:'chest_share',arguments:{id:first.id,principal:'second@outside.test',role:'commenter',confirmExternal:true,key:'external-mcp-confirmed'}}});assert.equal(mcpShare.result.isError,false,'MCP external share proceeds');
 assertAgentAudit((await agentShares()).find(r=>JSON.parse(r.detail).principal==='second@outside.test'));
 await call(token,`/items/${first.id}/shares`,{method:'POST',body:{principal:'partner@outside.test',role:'commenter'},key:'external-agent-no-flag'});
 const rows=await agentShares();assert.equal(rows.filter(r=>JSON.parse(r.detail).principal==='partner@outside.test').length,2,'agent sharing needs no confirmation flag');for(const row of rows)assertAgentAudit(row);
 const partner=partners['partner@outside.test'];assert.equal((await h.api(`/items/${first.id}`,partner)).role,'commenter','agent grant actually reaches recipient');
 const externalLink=await call(token,`/items/${first.id}/links`,{method:'POST',body:{audience:'guests',guests:['partner@outside.test'],confirmExternal:true},key:'external-agent-guest-link'});
 assertAgentAudit((await h.api('/audit',owner)).find(r=>r.action==='link.create'&&JSON.parse(r.detail).link===externalLink.link.id));
 await h.api(`/items/${first.id}/shares`,staff,{principal:'second@outside.test',role:'viewer',confirmExternal:true});
 const human=(await agentShares()).find(r=>r.actor==='staff@example.test');assert.ok(human,'human share keeps person actor');assert.equal(JSON.parse(human.detail).humanConfirmed,true,'person may confirm external sharing');assert.equal(JSON.parse(human.detail).initiation,undefined,'human share is not agent initiated');
 await h.api('/link-policy',owner,{...sharingRules,allowExternal:false});
 await call(token,`/items/${first.id}/shares`,{method:'POST',body:{principal:'partner@outside.test',role:'viewer',confirmExternal:true},key:'external-agent-policy-refused',status:403});
 const deniedMcp=await rpc({jsonrpc:'2.0',id:7,method:['tools','call'].join('/'),params:{name:'chest_share',arguments:{id:first.id,principal:'partner@outside.test',role:'viewer',confirmExternal:true,key:'external-mcp-policy-refused'}}});assert.equal(deniedMcp.result.isError,true,'MCP keeps existing organization refusal');
 assert.equal((await agentShares()).length,4,'policy refusal creates no grant audit');
 // Internal shares remain available even when external sharing is disabled and warnings are on.
 await call(token,`/items/${first.id}/shares`,{method:'POST',body:{principal:h.vars.OWNER_EMAIL,role:'viewer'},key:'share-person-once'});assertAgentAudit((await agentShares()).find(r=>JSON.parse(r.detail).principal===h.vars.OWNER_EMAIL),false);
 const internalLink=await call(token,`/items/${first.id}/links`,{method:'POST',body:{audience:'restricted'},key:'internal-agent-link'});assertAgentAudit((await h.api('/audit',owner)).find(r=>r.action==='link.create'&&JSON.parse(r.detail).link===internalLink.link.id),false);
 await h.api('/link-policy',owner,{...sharingRules,warnExternal:false});
 // Public sharing and request doors preserve ordinary policy and idempotency.
 await call(token,`/items/${first.id}/shares`,{method:'POST',body:{principal:h.vars.OWNER_EMAIL,role:'viewer'},key:'share-person-once'});assert.equal((await call(token,`/items/${first.id}/shares?limit=1`)).items.length,1);
 const request=await call(token,`/items/${folder.id}/requests`,{method:'POST',body:{title:'Vendor documents',maxMegabytes:10},key:'request-once'}),sameRequest=await call(token,`/items/${folder.id}/requests`,{method:'POST',body:{title:'Vendor documents',maxMegabytes:10},key:'request-once'});assert.equal(request.request.id,sameRequest.request.id);assert.equal((await call(token,`/requests/${request.request.id}`)).folder,folder.id);assertAgentAudit((await h.api('/audit',owner)).find(r=>r.action==='file-request.create'&&JSON.parse(r.detail).request===request.request.id));
 await h.api('/link-policy',owner,{scope:'organisation',allowExternal:true,allowPublic:false,allowOrganisation:true,allowDiscovery:true,defaultAudience:'restricted',defaultRole:'viewer'});await call(token,`/items/${first.id}/links`,{method:'POST',body:{audience:'public'},key:'policy-denied-link',status:403});await h.api('/link-policy',owner,{scope:'organisation',allowExternal:true,allowPublic:true,allowOrganisation:true,allowDiscovery:true,defaultAudience:'restricted',defaultRole:'viewer'});
 // Signed delivery failure and uncertain acceptance are durable. Replay preserves event identity and deduplication.
 const hook=await call(token,'/webhooks',{method:'POST',body:{endpoint:'https://hooks.example.test/chest',events:['file.upload']},key:'subscribe-once'});signingSecret=hook.signingSecret;const subscribedAgain=await call(token,'/webhooks',{method:'POST',body:{endpoint:'https://hooks.example.test/chest',events:['file.upload']},key:'subscribe-once'});assert.equal(subscribedAgain.subscription.id,hook.subscription.id);
 await call(token,'/items',{method:'POST',body:{parent:folder.id,name:'Webhook source.txt',base64:b64('A live event')},key:'webhook-file-once'});const failed=await waitDelivery(token,hook.subscription.id,d=>d.state==='failed');assert.equal(failed.status,503);await h.stop();await h.start();assert.ok((await call(token,`/webhooks/${hook.subscription.id}/deliveries`)).items.some(d=>d.id===failed.id&&d.state==='failed'));
 receiverMode='uncertain';const uncertain=await call(token,`/webhooks/${failed.id}/replay`,{method:'POST',body:{}});assert.equal(uncertain.payload.state,'uncertain');assert.equal(received.size,1);receiverMode='success';const replay=await call(token,`/webhooks/${failed.id}/replay`,{method:'POST',body:{}});assert.equal(replay.payload.state,'delivered');assert.equal(received.size,1,'receiver deduplicates the stable event ID after uncertain delivery');assert.ok(attempts>=3);
 const importedId=random();await h.sql("INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,'integration-event',?,?)",importedId,JSON.stringify({kind:'file.upload',source:'file.upload',item:first.id,version:first.current,at:new Date().toISOString(),imported:true}),random());for(let n=0;n<3;n++)await call(token,`/webhooks/${hook.subscription.id}/deliveries`);assert.ok(!received.has(importedId),'imported events never send automatically');const historicId=random();await h.sql("INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,'integration-event',?,?)",historicId,JSON.stringify({kind:'file.upload',source:'file.upload',item:first.id,version:first.current,at:new Date().toISOString(),imported:false}),random());for(let n=0;n<3;n++)await call(token,`/webhooks/${hook.subscription.id}/deliveries`);assert.ok(!received.has(historicId),'imported historical event cannot manufacture a local publication proof');
 // An owner host allowlist refuses vendor egress while the same application continues serving originals.
 const blockedHook=await call(token,'/webhooks',{method:'POST',body:{endpoint:'https://runeditrun.com/owner-independence',events:['file.upload']},key:'vendor-egress-denied'});
 const independent=await call(token,'/items',{method:'POST',body:{parent:folder.id,name:'Independent staff.txt',base64:b64('Still in owner storage')},key:'independent-staff-file'});
 const denied=await waitDelivery(token,blockedHook.subscription.id,d=>d.reason==='outbound_host_denied');assert.equal(denied.state,'failed');
 const independentBytes=await h.fetch(`/api/chest/integrations/v1/items/${independent.id}/bytes/${independent.current}`,{headers:{authorization:'Bearer '+token}});assert.equal(independentBytes.status,200);assert.equal(await independentBytes.text(),'Still in owner storage');
 // A current role/restriction or no-download change still wins over an existing OAuth grant.
 const controlled=await h.api('/spaces',owner,{name:'Current OAuth ACL'});await h.api(`/spaces/${controlled.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'staff@example.test',role:'viewer'}]});const sharedFolder=await h.api('/items',owner,{space:controlled.id,type:'folder',name:'Shared root'}),visibleFile=await h.api('/items',owner,{parent:sharedFolder.id,name:'Visible terms.txt',base64:b64('Shared original')}),hiddenFile=await h.api('/items',owner,{parent:sharedFolder.id,name:'Restricted terms.txt',base64:b64('Restricted original')});await h.api(`/items/${hiddenFile.id}/settings`,owner,{restricted:true});const reader=await authorize(client,staff,['read','download','picker'],[sharedFolder.id]);assert.ok(!(await call(reader.access_token,'/items')).items.some(i=>i.id===hiddenFile.id));await call(reader.access_token,`/items/${hiddenFile.id}`,{status:403});await h.api(`/items/${visibleFile.id}/settings`,owner,{noDownload:true});const noDownload=await h.fetch(`/api/chest/integrations/v1/items/${visibleFile.id}/bytes/${visibleFile.payload.current}`,{headers:{authorization:'Bearer '+reader.access_token}});assert.equal(noDownload.status,403);await h.api(`/spaces/${controlled.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});await call(reader.access_token,`/items/${visibleFile.id}/pick`,{method:'POST',body:{},status:403});
 const noMutations=await authorize(client,staff,['upload'],undefined,{budget_mutations:'0'});await call(noMutations.access_token,'/items',{method:'POST',body:{parent:folder.id,name:'Budget refused.txt',base64:b64('Never published')},key:'budget-refused',status:429});assert.ok(!(await h.api(`/items/${folder.id}`,staff)).children.some(i=>i.name==='Budget refused.txt'));
 // Budgets, own-grant revoke, read-only/allowlist/block and live organization/group policy.
 const small=await authorize(client,staff,['read'],undefined,{budget_requests:'1'});await call(small.access_token,'/items');await call(small.access_token,'/items',{status:429});await h.api(`/integrations/grants/${grant.grant}/revoke`,staff,{});await call(token,'/items',{status:401});
 await h.api('/integrations/policy',owner,{scope:'organization',mode:'allowlist',apps:{}});const refused=await consentFor(client,staff,['read']);assert.equal(refused.response.status,403);assert.match(await refused.response.text(),/app_policy_allowlist_only/);
 await h.api('/integrations/policy',owner,{scope:'organization',mode:'allowlist',apps:{[client.client.id]:'read_only'}});const readonly=await authorize(client,staff,['read','search','picker']);await call(readonly.access_token,'/items',{method:'POST',body:uploadInput,key:'read-only-refused',status:403});const writeRefused=await consentFor(client,staff,['read','upload']);assert.equal(writeRefused.response.status,403);assert.match(await writeRefused.response.text(),/app_policy_read_only/);
 const group=await h.api('/groups',owner,{name:'Controlled apps',members:['staff@example.test']}),outsideGroup=await h.api('/groups',owner,{name:'Another group',members:[]});await h.api('/people',owner,{action:'invite',email:'group-admin@example.test',name:'Group admin'});const groupAdmin=await h.signIn('group-admin@example.test',true);await h.api('/administration/roles',owner,{email:'group-admin@example.test',role:'sharing-security',scope:'groups',groups:[group.id]});await h.api('/integrations/policy',groupAdmin,{scope:'group',group:outsideGroup.id,mode:'none',apps:{}},403);await h.api('/integrations/policy',groupAdmin,{scope:'group',group:group.id,mode:'none',apps:{}});await call(readonly.access_token,'/items',{status:401});const groupRefusal=await consentFor(client,staff,['read']);assert.equal(groupRefusal.response.status,403);assert.match(await groupRefusal.response.text(),/app_policy_authorization_disabled/);await h.api('/integrations/policy',groupAdmin,{scope:'group',group:group.id,mode:'any',apps:{}});const allowedAgain=await authorize(client,staff,['read']);await call(allowedAgain.access_token,'/items');
 await h.api('/integrations/policy',owner,{scope:'organization',mode:'allowlist',apps:{[client.client.id]:'blocked'}});await call(allowedAgain.access_token,'/items',{status:401});const consolePage=await(await h.fetch('/app/integrations',{headers:{cookie:owner}})).text();assert.match(consolePage,/Scoped client and MCP agent/);assert.match(consolePage,/staff@example.test/);assert.match(consolePage,/Last use/);
 const beforeErasure=await h.sql('SELECT id FROM chest_integration_secrets WHERE email=?','staff@example.test');assert.ok(beforeErasure.results.length>0,'real OAuth authority exists before erasure');await h.api('/erasure',owner,{email:'staff@example.test',confirm:'staff@example.test'});assert.equal((await h.sql('SELECT id FROM chest_integration_secrets WHERE email=?','staff@example.test')).results.length,0,'identity erasure physically removes OAuth codes, tokens, response and webhook secrets');await call(token,'/items',{status:401});
 console.log('CONNECT-007 OAuth/PKCE, paginated scoped APIs, MCP, idempotency/restart, signed failure/uncertainty/replay, import suppression, budgets and app policy passed');
}finally{await h.close()}
