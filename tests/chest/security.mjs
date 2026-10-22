// ADMIN-004: email alone cannot cross the content boundary, enrollment/recovery are real HTTP workflows.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness({hostname:'localhost'});let browser,provedOwner;
export function code(secret,offset=0){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let n=0,bits=0;const bytes=[];for(const c of secret){n=(n<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((n>>>bits)&255)}}const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));const hash=createHmac('sha1',Buffer.from(bytes)).update(msg).digest(),i=hash[19]&15;return String((hash.readUInt32BE(i)&0x7fffffff)%1000000).padStart(6,'0')}
const api=async(cookie,input,status=200)=>{const r=await h.raw('/api/security',cookie,input);assert.equal(r.status,status,status===200?await r.clone().text():'unexpected security response');return r.json()};
// Advance only the mail limiter's stored window between independent sign-ins; no application clock is changed.
const signIn=async()=>{await h.sql('UPDATE oa_limits SET window=0');return h.signIn(h.vars.OWNER_EMAIL)};
const cookies=(cookie,url)=>cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url}});
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await signIn();await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const policy={enabled:true,groups:[],graceDays:0,resistantAdmins:false,sessionHours:1,idleMinutes:30,requireIdpMfa:false};await h.api('/security/policy',owner,policy);
 assert.equal((await h.raw('/api/chest/library',owner)).status,403);assert.equal((await h.fetch('/app/files',{headers:{cookie:owner}})).headers.get('location'),'/security');assert.equal((await h.raw('/auth/operators',owner)).status,403);
 const start=await api(owner,{action:'totp-start'}),enrollmentCode=code(start.secret);const enrolled=await api(owner,{action:'totp-enroll',code:enrollmentCode});assert.equal(enrolled.codes.length,8);assert.equal((await h.raw('/api/chest/library',owner)).status,200);
 const stolen=await signIn();assert.equal((await h.raw('/api/chest/library',stolen)).status,403);await api(stolen,{action:'verify',code:enrollmentCode},403);await api(stolen,{action:'verify',code:code(start.secret,1)});await api(stolen,{action:'verify',code:enrolled.codes[0]});assert.equal((await h.raw('/api/chest/library',stolen)).status,200);const replay=await signIn();await api(replay,{action:'verify',code:enrolled.codes[0]},403);
 await h.api('/security/policy',owner,{...policy,resistantAdmins:true});assert.equal((await h.raw('/api/chest/library',owner)).status,403);
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
 for(const width of [1440,390]){
  // A recovery code authorizes replacement enrollment, but cannot open an admin's content under key-only policy.
  const cookie=await signIn();await api(cookie,{action:'verify',code:enrolled.codes[width===1440?1:2]});assert.equal((await h.raw('/api/chest/library',cookie)).status,403);
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(cookies(cookie,h.origin));const p=await context.newPage(),cdp=await context.newCDPSession(p);await cdp.send('WebAuthn.enable');const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await p.goto(h.origin+'/security');await p.getByRole('button',{name:'Add passkey or security key',exact:true}).click();await p.getByText('I saved my codes',{exact:true}).waitFor().catch(async e=>{throw Error('WebAuthn enrollment: '+await p.locator('[data-webauthn-enroll-status]').textContent())});await p.screenshot({path:`test-results/${width}-security-recovery.png`,fullPage:true});await p.getByText('I saved my codes',{exact:true}).click();assert.equal((await h.raw('/api/chest/library',cookie)).status,200);
  const nextCookie=await signIn();await context.clearCookies();await context.addCookies(cookies(nextCookie,h.origin));await p.goto(h.origin+'/security');await p.screenshot({path:`test-results/${width}-security-challenge.png`,fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.getByRole('button',{name:'Use a passkey or security key',exact:true}).click();await p.waitForURL('**/app/files').catch(async()=>{throw Error('WebAuthn verification: '+await p.locator('[data-webauthn-status]').textContent())});assert.equal((await h.raw('/api/chest/library',nextCookie)).status,200);provedOwner=nextCookie;
  // Reopen account security and inspect the enrolled state, then the actual admin policy form.
  await p.goto(h.origin+'/security');await p.screenshot({path:`test-results/${width}-security-enrolled.png`,fullPage:true});await p.getByRole('button',{name:'Add authenticator',exact:true}).click();await p.getByRole('heading',{name:'Connect your authenticator'}).waitFor();await p.screenshot({path:`test-results/${width}-security-authenticator.png`,fullPage:true});await p.goto(h.origin+'/app/admin');const heading=p.getByRole('heading',{name:'Two-step sign-in policy'});await heading.scrollIntoViewIfNeeded();await heading.locator('..').screenshot({path:`test-results/${width}-security-policy.png`});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1440){await h.api('/security/policy',nextCookie,{...policy,resistantAdmins:false});const target=await h.api('/security/reset',nextCookie,{email:h.vars.OWNER_EMAIL,verified:true});assert.equal(target.resetSent,true);const mail=h.mails.findLast(m=>m.subject==='Reset your Chest sign-in factors'),token=new URL(mail.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('reset');assert.ok(token);await api(nextCookie,{action:'reset',reset:token});await api(nextCookie,{action:'reset',reset:token},400);assert.equal((await h.raw('/api/chest/library',cookie)).status,401);const re=await api(nextCookie,{action:'totp-start'});const result=await api(nextCookie,{action:'totp-enroll',code:code(re.secret)});enrolled.codes=result.codes;await h.api('/security/policy',nextCookie,{...policy,resistantAdmins:true});}
  await cdp.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId});await context.close();
 }
 // Group policy blocks only the selected staff, and an expired reset never consumes authority.
 await h.api('/people',provedOwner,{action:'invite',email:'colleague@example.test',name:'Jordan Lee'});const colleague=await h.signIn('colleague@example.test',true),group=await h.api('/groups',provedOwner,{name:'Finance',members:[]});await h.api(`/groups/${group.id}/members`,provedOwner,{email:'colleague@example.test',action:'add'});
 await h.api('/security/policy',provedOwner,{...policy,enabled:false,groups:[group.id],resistantAdmins:true});assert.equal((await h.raw('/api/chest/library',colleague)).status,403);
 await h.api('/security/reset',provedOwner,{email:'colleague@example.test',verified:true});const resetMail=h.mails.findLast(m=>m.subject==='Reset your Chest sign-in factors'),expiredToken=new URL(resetMail.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('reset');await h.sql('UPDATE chest_mfa_resets SET expires_at=0');await api(colleague,{action:'reset',reset:expiredToken},400);
 // Idle and absolute limits also gate already factor-verified sessions and bearer credentials.
 const device=await h.api('/devices',provedOwner,{name:'Finance laptop',platform:'macos'});await h.sql('UPDATE chest_mfa_verified SET last_seen=0 WHERE session_id=?',`device:${device.device.id}`);const sync=await h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${device.token}`}});assert.equal(sync.status,403);
 await h.sql('UPDATE chest_mfa_verified SET last_seen=0 WHERE session_id=(SELECT id FROM oa_sessions WHERE operator_id=(SELECT id FROM oa_operators WHERE email=?) AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1)',h.vars.OWNER_EMAIL);assert.equal((await h.raw('/api/chest/library',provedOwner)).status,403);
 // An already enrolled session cannot outlive the configured absolute duration or idle timeout.
 const fresh=await signIn();await h.sql('UPDATE oa_sessions SET created_at=created_at-3600001 WHERE id=(SELECT id FROM oa_sessions ORDER BY created_at DESC LIMIT 1)');assert.equal((await h.raw('/api/chest/library',fresh)).status,403);
 console.log('ADMIN-004 passed: two-factor boundary, TOTP/recovery replay, WebAuthn enrollment and sign-in, key-only admins, reset notification and policy at 1440/390.');
}finally{await browser?.close();await h.close()}

// SECURITY-002: independent public-door threat and activity behaviors, folded into this security journey.
const {contentSecurityFlow,activitySecurityFlow}=await import('./content-security-flow.mjs');
await contentSecurityFlow();
await activitySecurityFlow();
