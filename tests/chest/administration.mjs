// Public administrative doors: no content elevation, accepted ownership and scoped recovery.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {tooltips} from './tooltip-proof.mjs';
import {accountingJourney} from './administration-accounting-flow.mjs';
import {reportingJourney} from './administration-report-flow.mjs';
import {createHash,createHmac} from 'node:crypto';
const h=await harness(),api=h.api;let browser;
const login=async(email,invite=false)=>{await h.sql('UPDATE oa_limits SET window=0');return h.signIn(email,invite)};
const privateApi=async(path,cookie,body,status=200)=>{const response=await h.raw('/api/security',cookie,body);assert.equal(response.status,status);return response.json()};
function code(secret){let n=0,bits=0,bytes=[];for(const c of secret){n=(n<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((n>>>bits)&255)}}const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',Buffer.from(bytes)).update(msg).digest(),i=hash[19]&15;return String((hash.readUInt32BE(i)&0x7fffffff)%1000000).padStart(6,'0')}
const cookies=(cookie,url)=>cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url}});
const grant=(cookie,email,role,extra={})=>api('/administration/roles',cookie,{email,role,scope:'organization',super:false,...extra});
const people={successor:'morgan@example.test',help:'sam@example.test',recover:'riley@example.test',staff:'jordan@example.test',outside:'taylor@example.test'};
// Reads and refused requests append audit activity without changing content state.
const contentState=({activity,...view})=>view;
const sha=value=>createHash('sha256').update(value).digest('hex');
const bytesOf=async(cookie,item,version)=>{
 const response=await h.fetch(`/api/chest/items/${item}/bytes/${version}?download=true`,{headers:{cookie}});
 assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer());
};
// Reconcile every retained original through the same download door a colleague uses.
const reconcile=async(cookie,id,name,parent,current,originals)=>{
 const view=await api(`/items/${id}`,cookie);
 assert.equal(view.item.name,name);assert.equal(view.item.parent,parent);
 assert.equal(sha(await bytesOf(cookie,id,view.item.current)),sha(current));
 for(const original of originals){
  const version=view.versions.find(v=>v.id===original.id);assert.ok(version,'later history is retained');
  assert.equal(version.checksum,original.checksum);
  assert.equal(sha(await bytesOf(cookie,id,original.id)),original.checksum);
 }
 return view;
};
const deniedContent=async(cookie,id,version,space,query)=>{
 await api(`/items/${id}`,cookie,undefined,403);
 await api(`/spaces/${space}`,cookie,undefined,404);
 await api(`/items/${id}/bytes/${version}`,cookie,undefined,403);
 await api(`/items/${id}/bytes/${version}?download=true`,cookie,undefined,403);
 const found=await api(`/search?q=${encodeURIComponent(query)}`,cookie);
 assert.equal(found.count,0);assert.deepEqual(found.results,[]);
 assert.ok(!JSON.stringify(await api('/files',cookie)).includes(query));
};
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});let owner=await login(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const sessions={};for(const [name,email]of Object.entries(people)){await api('/people',owner,{action:'invite',email,name:name==='help'?'Sam Patel':name==='staff'?'Jordan Lee':name==='successor'?'Morgan Chen':name==='recover'?'Riley Jones':'Taylor Reed'});sessions[name]=await login(email,true)}
 const finance=await api('/groups',owner,{name:'Finance',members:[people.staff]}),space=await api('/spaces',owner,{name:'Quarterly accounts'});await api(`/spaces/${space.id}/member`,owner,{action:'add',principal:people.staff,role:'manager'});
 const uploaded=await api('/items',sessions.staff,{space:space.id,type:'file',name:'Harbor quarterly forecast.txt',base64:Buffer.from('Original quarterly forecast: revenue 120000 USD.').toString('base64')});await api('/files',sessions.staff);
 const secretFile=await api('/items',owner,{space:space.id,type:'file',name:'Private acquisition plan.txt',base64:Buffer.from('Private acquisition: Harbor Supplier').toString('base64')});
 const superGrant=await grant(owner,people.successor,'',{super:true});const helpGrant=await grant(owner,people.help,'help-desk',{scope:'groups',groups:[finance.id]});
 const waiting='casey@example.test';await api('/administration/people',owner,{action:'invite',email:waiting,name:'Casey Flores',group:finance.id});await api('/administration/people',sessions.help,{action:'resend-invite',email:waiting});const invitationMail=h.mails.findLast(m=>[m.to].flat().includes(waiting)),invitationToken=new URL(invitationMail.text.match(/https?:\/\/[^\s]+/)[0]).searchParams.get('token');await api('/administration/groups',owner,{group:finance.id,email:waiting,action:'remove'});assert.equal((await h.raw('/auth/confirm',null,{token:invitationToken})).status,403,'removing an invited person from the issuer scope refuses admission');
 await api('/administration/people',sessions.help,{action:'revoke-sessions',email:people.outside},403);await api('/security/reset',sessions.help,{email:people.outside,verified:true},403);await api('/security/policy',sessions.help,{enabled:true},403);
 // A populated group member's content is available to that member, never through help-desk authority.
 assert.ok((await api('/search?q=forecast',sessions.staff)).results.some(r=>r.id===uploaded.id));
 await api(`/items/${uploaded.id}`,sessions.help,undefined,403);
 await api(`/items/${uploaded.id}/bytes/${uploaded.payload.current}`,sessions.help,undefined,403);
 await api(`/items/${uploaded.id}/bytes/${uploaded.payload.current}?download=true`,sessions.help,undefined,403);
 assert.equal((await api('/search?q=forecast',sessions.help)).count,0);
 await api(`/items/${secretFile.id}`,sessions.help,undefined,403);await api(`/items/${secretFile.id}/bytes/${secretFile.payload.current}?download=true`,sessions.help,undefined,403);assert.equal((await api('/search',sessions.help,undefined)).results.length,0);await api('/administration/people',sessions.help,{action:'revoke-sessions',email:people.staff});assert.equal((await h.raw('/api/chest/library',sessions.staff)).status,401);sessions.staff=await login(people.staff);
 const lost=await privateApi('',sessions.staff,{action:'totp-start'});await privateApi('',sessions.staff,{action:'totp-enroll',code:code(lost.secret)});await api('/security/reset',sessions.help,{email:people.staff,verified:true});const mail=h.mails.findLast(m=>m.subject==='Reset your Chest sign-in factors'),token=new URL(mail.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('reset');await privateApi('',sessions.staff,{action:'reset',reset:token});assert.ok(h.mails.some(m=>m.subject==='Chest notice'&&m.text.includes('Your sign-in factors were reset')));
 // A custom, read-only combination is persisted and remains separate from content roles.
 const custom=await api('/administration/roles',owner,{action:'define',name:'Finance history and recovery',privileges:['content-recovery','audit-reporting']});await grant(owner,people.recover,custom.id);
 // ADMIN-006 recovery journey: genuine stale-base conflicts and changes to current authority.
 await api(`/spaces/${space.id}/member`,owner,{action:'add',principal:people.successor,role:'manager'});
 await api(`/spaces/${space.id}/member`,owner,{action:'add',principal:people.outside,role:'viewer'});
 await api(`/items/${uploaded.id}/shares`,sessions.staff,{principal:people.help,role:'viewer'});
 const teamLink=await api(`/items/${uploaded.id}/public-links`,sessions.staff,{});
 const device=await api('/devices',sessions.staff,{name:'Recovery desktop',platform:'windows'});
 const sync=async(id,base,body)=>{
  const response=await h.fetch(`/api/chest/sync/items/${id}/content`,{method:'PUT',headers:{authorization:`Bearer ${device.token}`,'if-match':base},body});
  assert.equal(response.status,200);return response.json();
 };
 const teamInitial=await api(`/items/${uploaded.id}`,sessions.staff);
 assert.equal(sha(await bytesOf(sessions.staff,uploaded.id,teamInitial.item.current)),sha('Original quarterly forecast: revenue 120000 USD.'));
 const teamCurrent='Current quarterly forecast before incident';
 assert.equal((await sync(uploaded.id,teamInitial.item.current,teamCurrent)).conflict,false);
 const teamConflict=await sync(uploaded.id,teamInitial.item.current,'Offline quarterly correction');assert.equal(teamConflict.conflict,true);
 const conflictBefore=await api(`/items/${teamConflict.kept}`,sessions.staff);assert.equal(conflictBefore.versions[0].arrival,'conflict copy');
 const secondFolder=await api('/items',sessions.staff,{space:space.id,type:'folder',name:'Later corrections'});
 const teamBefore=await api(`/items/${uploaded.id}`,sessions.staff),point=new Date().toISOString();await new Promise(r=>setTimeout(r,5));
 await api(`/items/${uploaded.id}/move`,sessions.staff,{parent:secondFolder.id});await api(`/items/${uploaded.id}/rename`,sessions.staff,{name:'Renamed forecast.txt'});await api(`/items/${uploaded.id}/versions`,sessions.staff,{base64:Buffer.from('Changed quarterly forecast').toString('base64')});
 const teamLater=await api(`/items/${uploaded.id}`,sessions.staff);assert.equal(sha(await bytesOf(sessions.staff,uploaded.id,teamLater.item.current)),sha('Changed quarterly forecast'));
 await api(`/spaces/${space.id}/member`,owner,{action:'remove',principal:people.outside});
 await api(`/items/${uploaded.id}/unshare`,owner,{principal:people.help});await api(`/public-links/${teamLink.link.id}/revoke`,owner,{});
 await api(`/items/${uploaded.id}/trash`,sessions.staff,{});await api(`/items/${teamConflict.kept}/trash`,sessions.staff,{});

 const unselected=await api('/items',sessions.staff,{space:space.id,type:'file',name:'Unselected later record.txt',base64:Buffer.from('Keep this later record untouched').toString('base64')});
 const preview=await api('/administration/recovery',sessions.recover,{space:space.id,at:point});
 assert.ok(preview.scopes[0].changes.some(c=>c.id===uploaded.id));assert.ok(preview.scopes[0].changes.some(c=>c.id===teamConflict.kept));assert.ok(preview.scopes[0].changes.some(c=>c.id===unselected.id&&c.kinds.includes('added since')));
 assert.ok(!JSON.stringify(preview).includes('forecast'));assert.ok(!JSON.stringify(preview).includes('acquisition'));
 assert.equal(preview.scopes[0].sharing.restored,false);
 for(const [action,object]of [['space.members',space.id],['share.remove',uploaded.id],['link.revoke',uploaded.id]])assert.ok(preview.scopes[0].sharing.changes.some(e=>e.action===action&&e.object===object),`preview accounts for ${action}`);
 await h.stop();await h.start();assert.deepEqual(await api(`/administration/recovery/${preview.id}`,sessions.recover),preview);
 const restored=await api(`/administration/recovery/${preview.id}`,sessions.recover,{items:[uploaded.id,teamConflict.kept]});assert.equal(restored.state,'complete');assert.deepEqual(restored.scopes[0].applied.sort(),[uploaded.id,teamConflict.kept].sort());
 const after=await reconcile(sessions.staff,uploaded.id,'Harbor quarterly forecast.txt',null,teamCurrent,teamLater.versions);assert.equal(after.versions.length,teamLater.versions.length+1);
 assert.equal(after.versions.find(v=>v.id===after.item.current).actor,people.recover);assert.equal(after.versions.find(v=>v.id===after.item.current).restoredFrom,teamBefore.item.current);
 await reconcile(sessions.staff,teamConflict.kept,conflictBefore.item.name,null,'Offline quarterly correction',conflictBefore.versions);
 await reconcile(sessions.staff,unselected.id,'Unselected later record.txt',null,'Keep this later record untouched',unselected.payload.versions);
 await deniedContent(sessions.recover,uploaded.id,after.item.current,space.id,'forecast');
 await api(`/items/${uploaded.id}`,sessions.help,undefined,403);await api(`/items/${uploaded.id}`,sessions.outside,undefined,403);
 assert.ok(!(await api(`/spaces/${space.id}`,sessions.successor)).members.some(m=>m.principal===people.outside));
 assert.equal((await h.fetch(new URL(teamLink.url).pathname)).status,410);
 const audit=await api('/administration/audit',sessions.recover);assert.ok(audit.rows.length);assert.ok(!JSON.stringify(audit).includes('Harbor quarterly'));await api('/administration/roles',sessions.recover,{email:people.outside,role:'service-settings'},403);
 // Revocation refuses new and stored previews and apply; no item or version changes.
 const stale=await api('/administration/recovery',sessions.recover,{space:space.id,at:point}),beforeRevocation=await api(`/items/${uploaded.id}`,sessions.staff);
 const grants=(await api('/administration',owner)).roles.grants,recGrant=grants.find(g=>g.payload.email===people.recover);await api('/administration/roles',owner,{action:'revoke',id:recGrant.id});
 await api('/administration/recovery',sessions.recover,{space:space.id,at:point},403);await api(`/administration/recovery/${stale.id}`,sessions.recover,undefined,403);await api(`/administration/recovery/${stale.id}`,sessions.recover,{items:[uploaded.id]},403);
 assert.deepEqual(contentState(await api(`/items/${uploaded.id}`,sessions.staff)),contentState(beforeRevocation));await grant(owner,people.recover,custom.id);
 // Departed-account recovery keeps immutable history and revoked capabilities without reactivating the person.
 const personalId=(await api('/files',sessions.staff)).personal,personalFolder=await api('/items',sessions.staff,{space:personalId,type:'folder',name:'Private supplier records'}),personalFile=await api('/items',sessions.staff,{space:personalId,parent:personalFolder.id,type:'file',name:'Acme supplier terms.txt',base64:Buffer.from('Original Acme supplier terms').toString('base64')}),publicLink=await api(`/items/${personalFile.id}/public-links`,sessions.staff,{}),accountPoint=new Date().toISOString();await new Promise(r=>setTimeout(r,5));
 await api(`/items/${personalFile.id}/move`,sessions.staff,{parent:null});await api(`/items/${personalFile.id}/rename`,sessions.staff,{name:'Accidentally renamed terms.txt'});await api(`/items/${personalFile.id}/versions`,sessions.staff,{base64:Buffer.from('Overwritten Acme terms').toString('base64')});
 const personalLater=await api(`/items/${personalFile.id}`,sessions.staff),personalConflict=await sync(personalFile.id,personalFile.payload.current,'Offline supplier correction');assert.equal(personalConflict.conflict,true);
 assert.equal(sha(await bytesOf(sessions.staff,personalFile.id,personalLater.item.current)),sha('Overwritten Acme terms'));
 const personalConflictBefore=await api(`/items/${personalConflict.kept}`,sessions.staff);assert.equal(personalConflictBefore.versions[0].arrival,'conflict copy');
 await api(`/items/${personalFile.id}/trash`,sessions.staff,{});await api(`/public-links/${publicLink.link.id}/revoke`,sessions.staff,{});await api('/administration/people',owner,{action:'offboard',email:people.staff,to:people.successor});assert.equal((await h.raw('/api/chest/library',sessions.staff)).status,401);
 const accountPreview=await api('/administration/recovery',sessions.recover,{email:people.staff,at:accountPoint});assert.ok(!JSON.stringify(accountPreview).includes('Acme'));assert.equal((await api(`/administration/recovery/${accountPreview.id}`,sessions.recover,{items:[personalFile.id]})).state,'complete');const recoveredAccount=await api(`/items/${personalFile.id}`,sessions.successor);assert.equal(recoveredAccount.item.name,'Acme supplier terms.txt');assert.equal(recoveredAccount.item.parent,personalFolder.id);assert.equal(recoveredAccount.versions.length,3);const bytes=await h.fetch(`/api/chest/items/${personalFile.id}/bytes/${recoveredAccount.item.current}?download=true`,{headers:{cookie:sessions.successor}});assert.equal(bytes.status,200);assert.equal(await bytes.text(),'Original Acme supplier terms');assert.equal((await h.fetch(new URL(publicLink.url).pathname)).status,410);assert.equal((await h.raw('/api/chest/library',sessions.staff)).status,401);
 await reconcile(sessions.successor,personalFile.id,'Acme supplier terms.txt',personalFolder.id,'Original Acme supplier terms',personalLater.versions);
 await reconcile(sessions.successor,personalConflict.kept,personalConflictBefore.item.name,null,'Offline supplier correction',personalConflictBefore.versions);
 await deniedContent(sessions.recover,personalFile.id,recoveredAccount.item.current,personalId,'Acme');
 // A revoked device cannot replay its pending write into the restored departed account.
 const beforeReplay=await api(`/items/${personalFile.id}`,sessions.successor);
 assert.equal((await h.fetch(`/api/chest/sync/items/${personalFile.id}/content`,{method:'PUT',headers:{authorization:`Bearer ${device.token}`,'if-match':personalFile.payload.current},body:'Late departed-device write'})).status,401);
 assert.deepEqual(contentState(await api(`/items/${personalFile.id}`,sessions.successor)),contentState(beforeReplay));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?['--no-sandbox']:[])]});await mkdir('test-results',{recursive:true});
 await reportingJourney(h,browser,owner);
 await accountingJourney(browser);
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(cookies(owner,h.origin));const p=await context.newPage();await p.goto(h.origin+'/app/administration');await p.getByRole('heading',{name:'Administration',exact:true}).waitFor();const define=p.locator('form').filter({has:p.getByRole('button',{name:'Create custom role',exact:true})});await define.getByLabel('Custom role name').fill(`Intake history ${width}`);await define.getByLabel('audit-reporting',{exact:true}).check();await define.getByRole('button',{name:'Create custom role',exact:true}).click();await p.waitForLoadState();assert.ok((await api('/administration',owner)).roles.definitions.some(r=>r.payload.name===`Intake history ${width}`));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`test-results/${width}-administration-owner.png`,fullPage:true});for(const heading of ['Administrative roles','People in your administrative scope','Two-step sign-in policy','Space storage'])await p.getByRole('heading',{name:heading,exact:true}).locator('..').screenshot({path:`test-results/${width}-administration-${heading.replaceAll(' ','-')}.png`});
  await context.clearCookies();await context.addCookies(cookies(sessions.help,h.origin));await p.goto(h.origin+'/app/administration');await p.screenshot({path:`test-results/${width}-administration-helpdesk.png`,fullPage:true});await p.getByRole('button',{name:'Inspect sessions',exact:true}).first().click();await p.getByRole('heading',{name:'Sessions',exact:true}).waitFor();await p.screenshot({path:`test-results/${width}-administration-sessions.png`,fullPage:true});assert.ok(!await p.getByText('Private acquisition plan.txt',{exact:true}).count());
  await context.clearCookies();await context.addCookies(cookies(sessions.recover,h.origin));await api(`/items/${personalFile.id}/rename`,sessions.successor,{name:`Later staff correction ${width}.txt`});await p.goto(h.origin+'/app/administration');const recover=p.locator('form').filter({has:p.getByRole('button',{name:'Preview recovery',exact:true})});await recover.getByLabel('Space to recover').selectOption(personalId);await recover.getByLabel('Recorded point',{exact:false}).fill(accountPoint);await recover.getByRole('button',{name:'Preview recovery',exact:true}).click();await p.waitForURL('**/app/administration/recovery/*');await p.screenshot({path:`test-results/${width}-administration-recovery-preview.png`,fullPage:true});await h.stop();await h.start();await p.reload();await p.locator(`input[name="recoverItem:${personalFile.id}"]`).check();await p.getByRole('button',{name:'Restore selected records',exact:true}).click();await p.waitForLoadState();await p.screenshot({path:`test-results/${width}-administration-recovery.png`,fullPage:true});assert.equal((await api(`/items/${personalFile.id}`,sessions.successor)).item.name,'Acme supplier terms.txt');assert.ok(!await p.getByText('Harbor quarterly forecast.txt',{exact:true}).count());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await reconcile(sessions.successor,personalFile.id,'Acme supplier terms.txt',personalFolder.id,'Original Acme supplier terms',personalLater.versions);
  await reconcile(sessions.successor,personalConflict.kept,personalConflictBefore.item.name,null,'Offline supplier correction',personalConflictBefore.versions);
  await api(`/items/${uploaded.id}/rename`,sessions.successor,{name:`Later team correction ${width}.txt`});await api(`/items/${teamConflict.kept}/trash`,sessions.successor,{});
  await p.goto(h.origin+'/app/administration');const teamRecover=p.locator('form').filter({has:p.getByRole('button',{name:'Preview recovery',exact:true})});await teamRecover.getByLabel('Space to recover').selectOption(space.id);await teamRecover.getByLabel('Recorded point',{exact:false}).fill(point);await teamRecover.getByRole('button',{name:'Preview recovery',exact:true}).click();await p.waitForURL('**/app/administration/recovery/*');
  assert.ok(!await p.getByText('Harbor quarterly forecast.txt',{exact:true}).count());assert.ok(!await p.getByText(conflictBefore.item.name,{exact:true}).count());
  await tooltips(p,width,'administration-recovery');await p.screenshot({path:`test-results/${width}-administration-team-preview.png`,fullPage:true});
  await h.stop();await h.start();await p.reload();await p.locator(`input[name="recoverItem:${uploaded.id}"]`).check();await p.locator(`input[name="recoverItem:${teamConflict.kept}"]`).check();await p.getByRole('button',{name:'Restore selected records',exact:true}).click();await p.waitForLoadState();
  await p.screenshot({path:`test-results/${width}-administration-team-restored.png`,fullPage:true});
  await reconcile(sessions.successor,uploaded.id,'Harbor quarterly forecast.txt',null,teamCurrent,teamLater.versions);await reconcile(sessions.successor,teamConflict.kept,conflictBefore.item.name,null,'Offline quarterly correction',conflictBefore.versions);
  await reconcile(sessions.successor,unselected.id,'Unselected later record.txt',null,'Keep this later record untouched',unselected.payload.versions);
  await deniedContent(sessions.recover,uploaded.id,after.item.current,space.id,'forecast');await deniedContent(sessions.recover,personalFile.id,recoveredAccount.item.current,personalId,'Acme');
  assert.equal((await h.fetch(new URL(publicLink.url).pathname)).status,410);assert.equal((await h.fetch(new URL(teamLink.url).pathname)).status,410);assert.equal((await h.raw('/api/chest/library',sessions.staff)).status,401);
  await p.goto(h.origin+'/app/administration/audit');await p.getByRole('heading',{name:'Administrative activity',exact:true}).waitFor();await p.screenshot({path:`test-results/${width}-administration-audit.png`,fullPage:true});await context.close();
 }
 // Removal of recovery authority also closes both browser and stored account plans.
 const pendingTeam=await api('/administration/recovery',sessions.recover,{space:space.id,at:point}),pendingAccount=await api('/administration/recovery',sessions.recover,{email:people.staff,at:accountPoint});
 const finalGrant=(await api('/administration',owner)).roles.grants.find(g=>g.payload.email===people.recover);
 const stableTeam=contentState(await api(`/items/${uploaded.id}`,sessions.successor)),stableAccount=contentState(await api(`/items/${personalFile.id}`,sessions.successor));
 await api('/administration/roles',owner,{action:'revoke',id:finalGrant.id});
 for(const [pending,input,item]of [[pendingTeam,{space:space.id,at:point},uploaded.id],[pendingAccount,{email:people.staff,at:accountPoint},personalFile.id]]){
  await api('/administration/recovery',sessions.recover,input,403);await api(`/administration/recovery/${pending.id}`,sessions.recover,undefined,403);await api(`/administration/recovery/${pending.id}`,sessions.recover,{items:[item]},403);
  const response=await h.fetch(`/app/administration/recovery/${pending.id}`,{headers:{cookie:sessions.recover}});assert.equal(response.status,403);assert.ok(!(await response.text()).includes(item));
 }
 assert.deepEqual(contentState(await api(`/items/${uploaded.id}`,sessions.successor)),stableTeam);assert.deepEqual(contentState(await api(`/items/${personalFile.id}`,sessions.successor)),stableAccount);
 const offer=await api('/administration/owner',owner,{email:people.successor,keepGrants:[]});await api(`/administration/owner/${offer.id}`,sessions.successor,{decision:'accept'},403);sessions.successor=await login(people.successor);
 const accepting=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});await accepting.addCookies(cookies(sessions.successor,h.origin));const acceptance=await accepting.newPage();await acceptance.goto(h.origin+'/app/administration');for(const width of [1440,390]){await acceptance.setViewportSize({width,height:1000});await acceptance.getByRole('heading',{name:'Installation ownership',exact:true}).locator('..').screenshot({path:`test-results/${width}-administration-offer.png`})}await acceptance.getByRole('button',{name:'Accept installation ownership',exact:true}).click();await acceptance.waitForURL('**/signin');await accepting.close();assert.equal((await h.raw('/api/chest/library',sessions.successor)).status,401);assert.equal((await h.raw('/api/chest/library',owner)).status,401);owner=await login(h.vars.OWNER_EMAIL);const newOwner=await login(people.successor);await api('/administration/roles',owner,{email:people.outside,super:true},403);await api('/administration/owner',owner,{email:people.help},403);await api('/organisation/sso',owner,undefined,403);await api('/administration/people',newOwner,{action:'deactivate',email:people.successor},403);assert.equal((await api('/administration',newOwner)).roles.activeSuperCount,1);
 // Use the same valid promotion on both sides of the transfer, then return to one super admin.
 const promotion={email:people.outside,role:'user-management',scope:'organization',super:true};
 const beforePromotion=(await api('/administration',newOwner)).roles;
 await api('/administration/roles',owner,promotion,403);
 assert.deepEqual((await api('/administration',newOwner)).roles,beforePromotion,'the former owner cannot change authority');
 const managing=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});await managing.addCookies(cookies(newOwner,h.origin));
 const management=await managing.newPage();await management.goto(h.origin+'/app/administration');
 const assignment=management.locator('form').filter({has:management.getByRole('button',{name:'Assign administrative role',exact:true})});
 await assignment.getByLabel('Staff email',{exact:true}).fill(promotion.email);await assignment.getByLabel('Administrative role').selectOption(promotion.role);
 await assignment.getByLabel('Super administrator').selectOption('true');await assignment.getByLabel('Scope').selectOption(promotion.scope);
 await assignment.getByRole('button',{name:'Assign administrative role',exact:true}).click();await management.waitForLoadState();
 let authority=(await api('/administration',newOwner)).roles;
 const promoted=authority.grants.find(g=>g.payload.email===people.outside&&g.payload.super);assert.ok(promoted);
 const promotedRow=management.getByRole('heading',{name:'Administrative roles',exact:true}).locator('..').getByRole('listitem').filter({hasText:people.outside});
 await promotedRow.getByRole('button',{name:'Revoke admin role',exact:true}).waitFor();
 for(const width of [1440,390]){await management.setViewportSize({width,height:1000});await management.getByRole('heading',{name:'Administrative roles',exact:true}).locator('..').screenshot({path:`test-results/${width}-administration-new-owner-promotion.png`})}
 await management.setViewportSize({width:1440,height:1000});
 assert.equal(authority.activeSuperCount,2);assert.ok(authority.grants.some(g=>g.id===promoted.id&&g.payload.email===people.outside&&g.payload.super));
 await promotedRow.getByRole('button',{name:'Revoke admin role',exact:true}).click();await management.waitForLoadState();await managing.close();
 const beforeDemotion=await api('/administration',newOwner),soleAdmin=beforeDemotion.people.find(p=>p.email===people.successor);
 assert.ok(soleAdmin?.id);assert.equal(soleAdmin.role,'owner');assert.equal(beforeDemotion.roles.activeSuperCount,1);assert.ok(beforeDemotion.roles.warning);
 // The legacy identity door must refuse a real demotion, rather than an invalid target or an escalation.
 const demotion=await h.raw('/auth/operator/role',newOwner,{operatorId:soleAdmin.id,role:'member'});
 assert.equal(demotion.status,403);assert.equal((await demotion.json()).error,'use_administrative_role_console');
 const afterDemotion=await api('/administration',newOwner);
 assert.deepEqual(afterDemotion.roles,beforeDemotion.roles);assert.deepEqual(afterDemotion.people,beforeDemotion.people);
 assert.equal((await api('/library',newOwner)).me.role,'owner');
 await api(`/administration/owner/${offer.id}`,newOwner,{decision:'accept'},409);
 assert.deepEqual((await api('/administration',newOwner)).roles,afterDemotion.roles,'replaying an accepted offer changes no authority');
 assert.equal((await h.raw('/auth/operator/role',newOwner,{operatorId:'anything',role:'owner'})).status,403);assert.ok(h.mails.some(m=>m.text.includes('accepted installation ownership')));
 // Read actual public event records; exact targets and outcomes distinguish each step from unrelated activity.
 const event=async(action,actor,object,outcome='succeeded')=>{
  const {rows}=await api('/audit?'+new URLSearchParams({action,object,limit:'300',paginate:'true'}),newOwner);
  const matching=rows.filter(r=>r.actor===actor&&JSON.parse(r.detail).outcome===outcome);
  assert.equal(matching.length,1,`audit records ${action} by ${actor} on ${object} as ${outcome} once`);const found=matching[0];
  assert.ok(Number.isFinite(Date.parse(found.at)));return JSON.parse(found.detail);
 };
 const promotedAudit=await event('admin.grant.assign',h.vars.OWNER_EMAIL,superGrant.id);
 assert.equal(promotedAudit.after.email,people.successor);assert.equal(promotedAudit.after.super,true);
 const delegatedAudit=await event('admin.grant.assign',h.vars.OWNER_EMAIL,helpGrant.id);
 assert.deepEqual(delegatedAudit.after,{email:people.help,role:'help-desk',super:false,scope:'groups',groups:[finance.id]});
 await event('admin.person.revoke-sessions',people.help,people.staff);
 assert.equal((await event('security.mfa.reset.request',people.help,people.staff)).identityVerified,true);
 const offeredAudit=await event('admin.owner.offer',h.vars.OWNER_EMAIL,offer.id);
 assert.equal(offeredAudit.by,h.vars.OWNER_EMAIL);assert.equal(offeredAudit.to,people.successor);assert.deepEqual(offeredAudit.keepGrants,[]);
 const acceptedAudit=await event('admin.owner.accept',people.successor,offer.id);
 assert.equal(acceptedAudit.by,h.vars.OWNER_EMAIL);assert.equal(acceptedAudit.to,people.successor);assert.deepEqual(acceptedAudit.keepGrants,[]);
 assert.equal((await event('admin.grant.assign',people.successor,promoted.id)).after.email,people.outside);
 assert.equal((await event('admin.grant.revoke',people.successor,promoted.id)).before.email,people.outside);
 const refusedAudit=await event('admin.person.role',people.successor,people.successor,'refused');
 assert.equal(refusedAudit.role,'member');assert.equal(refusedAudit.code,'use_administrative_role_console');
 for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(cookies(newOwner,h.origin));const p=await context.newPage();await p.goto(h.origin+'/app/administration');await p.getByRole('heading',{name:'Administrative roles',exact:true}).locator('..').screenshot({path:`test-results/${width}-administration-last-super-admin.png`});await p.getByRole('heading',{name:'Installation ownership'}).scrollIntoViewIfNeeded();await p.getByRole('heading',{name:'Installation ownership'}).locator('..').screenshot({path:`test-results/${width}-administration-transferred.png`});await context.close()}
 console.log('ADMIN-006 recovery journey passed: selected account and team content, original hashes and conflict copies, authority changes, content denial and immediate scope revocation at 1440 and 390.');
 console.log('ADMIN-003 and ADMIN-004 passed: scoped help desk and resets, custom roles, metadata-only reporting, selected recovery after restart, access refusal, fresh accepted owner transfer and last-owner protection at 1440/390.');
 console.log('Administration passed: scoped help desk and resets, content refusal, fresh accepted owner transfer, successful new-owner promotion, refused last-owner demotion with unchanged authority, and attributed audit records. Browser proof at 1440 and 390.');
}finally{await browser?.close();await h.close()}
