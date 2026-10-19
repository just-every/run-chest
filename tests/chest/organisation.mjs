import { exerciseLifecycle } from './organisation-lifecycle.mjs';
// One core flow across two real built Workers: SCIM user/group provisioning, OIDC and SAML sign-in from Auth,
// company-only policy, immediate deactivation (also on a device), reactivation and token revocation, and email
// sign-in surviving a provider sealed by an earlier deployment (a hosted restore).
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {authProvider,scimTransport} from './auth-provider.mjs';
const checkout=process.env.CHEST_AUTH_CHECKOUT;if(!checkout)throw Error('Build just-every/run-auth and set CHEST_AUTH_CHECKOUT to its checkout.');
const mails=[];let h,browser,auth,transport;
try {
 auth=await authProvider({checkout,mailEdge:async request=>{if(transport&&new URL(request.url).origin===transport.origin){const r=await fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),...(!['GET','HEAD'].includes(request.method)?{body:Buffer.from(await request.arrayBuffer())}:{})});if(!r.ok)console.log('SCIM transport refusal',request.method,new URL(request.url).pathname,r.status,(await r.clone().json()).detail);return r;}assert.equal(request.url,'https://api.sendgrid.com/v3/mail/send');mails.push(await request.json());return new Response(null,{status:202})}});
 h=await harness({bindings:{AUTH_LOCAL:'true',OWNER_EMAIL:'owner@admin.test'},edge:async request=>{if(new URL(request.url).origin!==auth.origin)return undefined;const r=await auth.fetch(request);if(!r.ok)console.log('Provider edge refusal',new URL(request.url).pathname,r.status,(await r.clone().json()).error);return r}});
 transport=await scimTransport(h);
 const claimed=await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});assert.equal(claimed.status,303);let owner=claimed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/auth/company/')&&r.status()>=400)console.log('Company route refusal',new URL(r.url()).pathname,r.status())});
 const proof=await context.request.post(auth.origin+'/auth/identity/email/request',{headers:{origin:auth.origin},data:{email:auth.vars.OWNER_EMAIL,returnTo:'/setup'}});assert.equal(proof.status(),202);
 for(let i=0;i<80&&!mails.length;i++)await new Promise(r=>setTimeout(r,100));assert.ok(mails.length,'mail delivered at provider edge');
 const text=mails.at(-1).content.find(c=>c.type==='text/plain').value,link=text.match(/https?:\/\/[^\s]+/)[0];await page.goto(link);await page.getByRole('button',{name:'Continue to Auth'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();
 const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 await page.goto(auth.origin+'/app/methods');const registered=page.waitForResponse(r=>r.url().endsWith('/passkeys/register/verify')),registrationReload=page.waitForNavigation({waitUntil:'load'});await page.getByRole('button',{name:'Register a passkey'}).click();assert.equal((await registered).status(),200);await registrationReload;
 const provider=async(path,data,status=200)=>{const r=await context.request.post(auth.origin+'/api/auth'+path,{headers:{origin:auth.origin},data});assert.equal(r.status(),status,await r.text());return r.json()};
 const me=await (await context.request.get(auth.origin+'/api/auth/me')).json();
 const app=await provider('/oidc-apps/create',{name:'Chest',redirectUris:[h.origin+'/auth/company/callback'],authMethod:'client_secret_basic',requirePkce:true,subjectType:'pairwise'},201);
 await provider('/company-apps/assign',{appId:app.id,principalType:'person',principalId:me.user.id,role:'member'});
 const providerGroup=await provider('/groups/create',{name:'Operations'},201);await provider('/groups/add',{groupId:providerGroup.id,personId:me.user.id});await provider('/company-apps/assign',{appId:app.id,principalType:'group',principalId:providerGroup.id,role:'member'});
 await auth.fetch(auth.origin+'/.well-known/openid-configuration');
 await auth.ageKeys(); // The test ages the real published timestamp; signing and token expiry use the real clock.
 const token=await h.api('/organisation/scim/tokens',owner,{name:'Auth provisioning'});
 const scim=async(path,method='GET',data,status=200)=>{const r=await h.fetch('/scim/v2'+path,{method,headers:{authorization:'Bearer '+token.token,...(data?{'content-type':'application/scim+json'}:{})},...(data?{body:JSON.stringify(data)}:{})});assert.equal(r.status,status,await r.clone().text());return status===204?null:r.json()};
 await scim('/ServiceProviderConfig');
 await provider('/provisioning/connect',{appId:app.id,baseUrl:transport.origin+'/scim/v2',token:token.token,deprovision:'deactivate',pushGroups:true},201);
 const connection=await provider('/provisioning/test',{appId:app.id});assert.equal(connection.ok,true,JSON.stringify(connection));
 const eventually=async(fn,predicate,message)=>{let value;for(let i=0;i<80;i++){value=await fn();if(predicate(value))return value;await new Promise(r=>setTimeout(r,100))}assert.fail(message)};
 const user=(await eventually(()=>scim('/Users'),v=>v.Resources.length===1,'Auth creates the Chest user through SCIM')).Resources[0];
 const group=(await eventually(()=>scim('/Groups'),v=>v.Resources.length===1,'Auth pushes the Chest group through SCIM')).Resources[0];
 assert.equal(user.userName,auth.vars.OWNER_EMAIL);assert.equal(user.roles[0].value,'member');assert.equal(group.members[0].value,user.id);
 const team=await h.api('/spaces',owner,{name:'Operations'});await h.api(`/spaces/${team.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:`group:${group.id}`,role:'contributor'}]});
 await h.api('/organisation/sso',owner,{protocol:'oidc',label:'Auth',issuer:auth.origin,clientId:app.clientId,clientSecret:app.clientSecret});
 await page.goto(h.origin+'/signin');await page.getByRole('button',{name:'Continue with Auth',exact:true}).click();await page.waitForURL(h.origin+'/app/files').catch(async()=>{throw Error('Company sign-in failed: '+(await page.locator('body').innerText()).slice(0,900))});
 const session=await context.request.get(h.origin+'/api/chest/files');assert.equal(session.status(),200);const dev=await context.request.post(h.origin+'/api/chest/devices',{headers:{origin:h.origin},data:{name:'Erin laptop',platform:'macos'}});assert.equal(dev.status(),200);const device=await dev.json();
 owner=await exerciseLifecycle({h,owner,scim,browser,page,user,group});
 await h.api('/organisation/policy',owner,{localDisabled:true});assert.equal((await h.raw('/auth/magic-link',null,{email:auth.vars.OWNER_EMAIL})).status,403);
 const patch={schemas:['urn:ietf:params:scim:api:messages:2.0:PatchOp'],Operations:[{op:'replace',value:{displayName:'Erin Chen, Operations'}}]};await scim('/Users/'+user.id,'PATCH',patch);
 await provider('/company-apps/unassign',{appId:app.id,principalType:'person',principalId:me.user.id});await provider('/groups/remove',{groupId:providerGroup.id,personId:me.user.id});
 await eventually(()=>scim('/Users/'+user.id),v=>v.active===false,'Auth deactivates the Chest account after access is removed');
 assert.equal((await context.request.get(h.origin+'/api/chest/files')).status(),401,'SCIM deactivation ends live OIDC access');
 assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:'Bearer '+device.token}})).status,401,'SCIM deactivation ends device access');
 await provider('/groups/add',{groupId:providerGroup.id,personId:me.user.id});await eventually(()=>scim('/Users/'+user.id),v=>v.active===true,'Auth reactivates the provisioned account');assert.equal((await context.request.get(h.origin+'/api/chest/files')).status(),401,'reactivation never revives the previous session');
 assert.equal((await h.fetch('/api/chest/sync/tree',{headers:{authorization:'Bearer '+device.token}})).status,401,'reactivation never revives a device');
 await page.goto(h.origin+'/signin');await page.getByRole('button',{name:'Continue with Auth',exact:true}).click();await page.waitForURL(h.origin+'/app/files').catch(async()=>{throw Error('Company sign-in failed: '+(await page.locator('body').innerText()).slice(0,900))});
 // SAML uses the same provisioned account and live provider, with signed response + assertion.
 const saml=await provider('/company-apps/create',{name:'Chest SAML',entityId:h.origin+'/auth/company/metadata',acsUrl:h.origin+'/auth/company/acs',acsBinding:'post',nameIdFormat:'persistent',sign:'both',digest:'sha256',attributes:'email=email\nname=name',idpInitiated:false},201);
 await provider('/company-apps/assign',{appId:saml.id,principalType:'person',principalId:me.user.id,role:'member'});
 const metadata=await (await context.request.get(auth.origin+'/saml/metadata')).text(),cert=metadata.match(/<ds:X509Certificate>([^<]+)</)?.[1];assert.ok(cert);
 await h.api('/organisation/sso',owner,{protocol:'saml',label:'Auth SAML',issuer:auth.origin+'/saml/metadata',entryPoint:auth.origin+'/saml/sso',certificate:`-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`});
 await page.goto(h.origin+'/signin');await page.getByRole('button',{name:'Continue with Auth SAML',exact:true}).click();await page.waitForURL(h.origin+'/app/files').catch(async()=>{throw Error('Company sign-in failed: '+(await page.locator('body').innerText()).slice(0,900))});assert.equal((await context.request.get(h.origin+'/api/chest/files')).status(),200);
 await h.api('/organisation/domains',owner,{allowedDomains:['outside.test'],requiredDomains:[]});await page.goto(h.origin+'/signin');const domainDeniedSaml=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/company/acs');await page.getByRole('button',{name:'Continue with Auth SAML',exact:true}).click();assert.equal((await domainDeniedSaml).status(),403,'ADMIN-001 domain policy also governs a valid signed SAML assertion');await h.api('/organisation/domains',owner,{allowedDomains:[],requiredDomains:[]});await page.goto(h.origin+'/signin');await page.getByRole('button',{name:'Continue with Auth SAML',exact:true}).click();await page.waitForURL(h.origin+'/app/files');
 await scim('/Groups/'+group.id,'PATCH',{...patch,Operations:[{op:'remove',path:`members[value eq "${user.id}"]`}]},409);assert.equal((await scim('/Groups/'+group.id)).members.length,0);assert.equal((await context.request.get(h.origin+`/api/chest/spaces/${team.id}`)).status(),404,'group membership revocation hides the inaccessible space');
 await provider('/groups/remove',{groupId:providerGroup.id,personId:me.user.id});await eventually(()=>scim('/Users/'+user.id),v=>v.active===false,'Auth deactivates the SAML member through SCIM');
 await page.goto(h.origin+'/signin');const deniedSaml=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/company/acs');await page.getByRole('button',{name:'Continue with Auth SAML',exact:true}).click();assert.equal((await deniedSaml).status(),403,'a valid signed assertion cannot reactivate an inactive account');
 await h.api('/organisation/scim/revoke',owner,{id:token.credential.id});const denied=await h.fetch('/scim/v2/Users',{headers:{authorization:'Bearer '+token.token}});assert.equal(denied.status,401);
 // Company sign-in required, then the database moves to a deployment with another secret.
 await h.sql('UPDATE chest_sso_config SET local_disabled=1');
 await h.stop();h.vars.SESSION_SECRET=randomBytes(32).toString('base64url');await h.start();
 const signin=await h.fetch('/signin');assert.equal(signin.status,200,'a provider sealed by another deployment never blocks the sign-in page');assert.match(await signin.text(),/action="\/auth\/magic-link"/);
 assert.equal((await h.raw('/auth/magic-link',null,{email:h.vars.OWNER_EMAIL})).status,202,'email sign-in works again');
 console.log('ADMIN-001 real Auth OIDC/SAML + SCIM lifecycle and revocation passed');
} finally {await browser?.close();await transport?.close();await h?.close();await auth?.close()}
