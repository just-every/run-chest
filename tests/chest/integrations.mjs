// CONNECT-007 via the built Worker; the OAuth client and webhook receiver are network edges.
import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {harness} from './harness.mjs';
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
 // Pagination returns only stable IDs under the folder; current role/no-download still govern every door.
 const seen=[];let cursor=null;do{const result=await call(token,'/items?limit=2'+(cursor?'&cursor='+cursor:''));seen.push(...result.items.map(r=>r.id));cursor=result.nextCursor}while(cursor);assert.equal(new Set(seen).size,7);assert.ok(seen.includes(folder.id)&&!seen.includes(other.id));await call(token,`/items/${other.id}`,{status:404});
 const search=await call(token,'/search?q=Searchable&type=documents&creator=me&limit=2');assert.equal(search.items.length,2);assert.ok(search.nextCursor);assert.ok(search.items.every(r=>initial.some(i=>i.id===r.id)));
 const uploadInput={parent:folder.id,name:'Idempotent.txt',base64:b64('One immutable upload')},first=await call(token,'/items',{method:'POST',body:uploadInput,key:'upload-once'});await h.stop();await h.start();const repeated=await call(token,'/items',{method:'POST',body:uploadInput,key:'upload-once'});assert.equal(repeated.id,first.id);assert.equal((await h.api(`/items/${folder.id}`,staff)).children.filter(i=>i.name==='Idempotent.txt').length,1);await call(token,'/items',{method:'POST',body:{...uploadInput,name:'Different.txt'},key:'upload-once',status:409});await call(token,'/items',{method:'POST',body:{parent:other.id,name:'Escape.txt',base64:b64('Escape')},key:'outside-folder',status:403});
 const uploadAudit=(await h.api('/audit',owner)).find(r=>r.action==='file.upload'&&r.object_id===first.id);assert.ok(uploadAudit,'upload audit exists');assert.equal(uploadAudit.actor,'staff@example.test','non-sharing audit keeps its existing person actor');
 const versions=await call(token,`/items/${first.id}/versions?limit=1`);assert.equal(versions.items.length,1);const downloaded=await h.fetch(`/api/chest/integrations/v1/items/${first.id}/bytes/${versions.items[0].id}`,{headers:{authorization:'Bearer '+token}});assert.equal(await downloaded.text(),'One immutable upload');
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
 // SURFACE-002: metadata and retained versions conceal inaccessible items through both transports.
 const controlled=await h.api('/spaces',owner,{name:'Current OAuth ACL'});
 const members=[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'staff@example.test',role:'viewer'}];
 await h.api(`/spaces/${controlled.id}/members`,owner,{members});
 const sharedFolder=await h.api('/items',owner,{space:controlled.id,type:'folder',name:'Shared root'});
 const visibleFile=await h.api('/items',owner,{parent:sharedFolder.id,name:'Visible terms.txt',base64:b64('synthetic-chest-1')});
 const hiddenFile=await h.api('/items',owner,{parent:sharedFolder.id,name:'Restricted terms.txt',base64:b64('synthetic-chest-2')});
 const outsideFile=await h.api('/items',owner,{space:controlled.id,name:'Outside terms.txt',base64:b64('synthetic-chest-3')});
 const replacement=await h.api(`/items/${visibleFile.id}/versions`,owner,{base64:b64('synthetic-chest-4')});
 await h.api(`/items/${hiddenFile.id}/versions`,owner,{base64:b64('synthetic-chest-5')});
 await h.api(`/items/${hiddenFile.id}/settings`,owner,{restricted:true});
 assert.equal((await h.api(`/items/${outsideFile.id}`,staff)).id,outsideFile.id,'the sponsor can open the existing item outside the grant');
 assert.equal((await h.api(`/items/${hiddenFile.id}`,owner)).versions.length,2,'the restricted file has retained metadata to conceal');
 await h.api(`/items/${hiddenFile.id}`,staff,undefined,403);
 const reader=await authorize(client,staff,['read','download','picker'],[sharedFolder.id]);
 const noRead=await authorize(client,staff,['download'],[sharedFolder.id]);
 const missingId='synthetic-chest-404',concealed=[hiddenFile.id,outsideFile.id,missingId];
 const httpRead=async(credential,id,versions=false)=>{
  const response=await h.fetch(`/api/chest/integrations/v1/items/${id}${versions?'/versions?limit=1':''}`,{headers:credential?{authorization:'Bearer '+credential}:{}});
  return {status:response.status,body:await response.text()};
 };
 const mcpRead=async(credential,name,id)=>{
  const response=await h.fetch('/mcp/chest',{method:'POST',headers:{...(credential?{authorization:'Bearer '+credential}:{}),'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:20,method:['tools','call'].join('/'),params:{name,arguments:{id}}})});
  return {status:response.status,body:await response.json()};
 };
 const mcpError=error=>({status:200,body:{jsonrpc:'2.0',id:20,result:{content:[{type:'text',text:JSON.stringify({error})}],isError:true}}});
 const assertConcealed=async(ids,label)=>{
  const absent=await httpRead(reader.access_token,missingId),absentVersions=await httpRead(reader.access_token,missingId,true);
  assert.deepEqual(absent,{status:404,body:JSON.stringify({error:'not_found'})},label+' missing metadata');
  assert.deepEqual(absentVersions,absent,label+' missing versions');
  for(const id of ids){
   assert.deepEqual(await httpRead(reader.access_token,id),absent,label+' metadata is existence blind');
   assert.deepEqual(await httpRead(reader.access_token,id,true),absentVersions,label+' versions are existence blind');
   for(const name of ['chest_get','chest_versions'])assert.deepEqual(await mcpRead(reader.access_token,name,id),mcpError('not_found'),label+' MCP '+name+' is existence blind');
  }
 };
 const assertReadable=async()=>{
  const metadata=await call(reader.access_token,`/items/${visibleFile.id}`);
  assert.equal(metadata.id,visibleFile.id);assert.equal(metadata.name,'Visible terms.txt');
  assert.equal(metadata.current,replacement.payload.current);assert.equal(metadata.sha256,createHash('sha256').update('synthetic-chest-4').digest('hex'));
  const firstPage=await call(reader.access_token,`/items/${visibleFile.id}/versions?limit=1`);
  assert.equal(firstPage.items.length,1);assert.ok(firstPage.nextCursor);
  const secondPage=await call(reader.access_token,`/items/${visibleFile.id}/versions?limit=1&cursor=${firstPage.nextCursor}`);
  const retained=[...firstPage.items,...secondPage.items];assert.equal(retained.length,2);assert.equal(secondPage.nextCursor,null);
  assert.deepEqual(retained.map(v=>v.id).sort(),[visibleFile.payload.current,replacement.payload.current].sort());
  assert.deepEqual(retained.map(v=>v.checksum).sort(),['synthetic-chest-1','synthetic-chest-4'].map(value=>createHash('sha256').update(value).digest('hex')).sort());
  const metadataRpc=await mcpRead(reader.access_token,'chest_get',visibleFile.id);
  assert.equal(metadataRpc.status,200);assert.equal(metadataRpc.body.result.isError,false);assert.deepEqual(metadataRpc.body.result.structuredContent,metadata);
  const versionsRpc=await mcpRead(reader.access_token,'chest_versions',visibleFile.id);
  assert.equal(versionsRpc.status,200);assert.equal(versionsRpc.body.result.isError,false);
  assert.deepEqual(versionsRpc.body.result.structuredContent.items.map(v=>v.id).sort(),retained.map(v=>v.id).sort());
 };
 await assertReadable();
 assert.ok(!(await call(reader.access_token,'/items')).items.some(i=>concealed.includes(i.id)));
 await assertConcealed(concealed,'current ACL');
 // Scope and authentication errors are independent of whether the requested item exists.
 for(const id of [visibleFile.id,...concealed]){
  for(const versions of [false,true]){
   assert.deepEqual(await httpRead(noRead.access_token,id,versions),{status:403,body:JSON.stringify({error:'oauth_action_outside_grant'})});
   assert.deepEqual(await httpRead(null,id,versions),{status:401,body:JSON.stringify({error:'oauth_authentication_required'})});
  }
  for(const name of ['chest_get','chest_versions']){
   assert.deepEqual(await mcpRead(noRead.access_token,name,id),mcpError('oauth_action_outside_grant'));
   assert.deepEqual(await mcpRead(null,name,id),{status:401,body:{error:'oauth_authentication_required'}});
  }
 }
 await h.stop();await h.start();
 await assertReadable();await assertConcealed(concealed,'restarted ACL');
 // Download refusal remains explicit for a visible file; metadata and versions remain readable.
 await h.api(`/items/${visibleFile.id}/settings`,owner,{noDownload:true});
 const noDownload=await h.fetch(`/api/chest/integrations/v1/items/${visibleFile.id}/bytes/${replacement.payload.current}`,{headers:{authorization:'Bearer '+reader.access_token}});
 assert.equal(noDownload.status,403);assert.deepEqual(await noDownload.json(),{error:'download_restricted'});
 assert.equal((await call(reader.access_token,`/items/${visibleFile.id}`)).canDownload,false);await assertReadable();
 await h.api(`/spaces/${controlled.id}/members`,owner,{members:[members[0]]});
 await assertConcealed([visibleFile.id,...concealed],'revoked space access');
 await call(reader.access_token,`/items/${visibleFile.id}/pick`,{method:'POST',body:{},status:403});
 await h.stop();await h.start();
 await assertConcealed([visibleFile.id,...concealed],'revoked space access after restart');
 // Restoring access restores reads, but revoking the credential refuses every item before lookup.
 await h.api(`/spaces/${controlled.id}/members`,owner,{members});await assertReadable();
 await h.api(`/integrations/grants/${reader.grant}/revoke`,staff,{});
 const assertRevokedGrant=async()=>{
  for(const id of [visibleFile.id,...concealed]){
   for(const versions of [false,true])assert.deepEqual(await httpRead(reader.access_token,id,versions),{status:401,body:JSON.stringify({error:'oauth_grant_revoked'})});
   for(const name of ['chest_get','chest_versions'])assert.deepEqual(await mcpRead(reader.access_token,name,id),{status:401,body:{error:'oauth_grant_revoked'}});
  }
 };
 await assertRevokedGrant();await h.stop();await h.start();await assertRevokedGrant();
 console.log('SURFACE-002 existence-blind metadata and versions: scoped HTTP and legacy MCP, live ACL, credential revocation and Worker restart passed');
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
