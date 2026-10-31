// CONNECT-007 at 1440 and 390: real OAuth consent, connected-app policy and embeddable picker.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {integrationReportSetup} from './administration-report-flow.mjs';
import {tooltips} from './tooltip-proof.mjs';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {attachmentClient} from './integration-client.mjs';
let receiverStatus=503;const h=await harness({edge:async request=>new URL(request.url).hostname==='hooks.example.test'?new Response('Receiver outcome',{status:receiverStatus}):undefined});let browser,consumer;
async function shot(page,width,state){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${state} fits ${width}`);await page.screenshot({path:`test-results/${width}-integrations-${state}.png`,fullPage:true})}
const csvRowsForReport=text=>text.trimEnd().split('\r\n').slice(1);
const cookies=cookie=>cookie.split('; ').map(v=>{const at=v.indexOf('=');return {name:v.slice(0,at),value:v.slice(at+1),url:h.origin}});
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});const space=(await h.api('/files',cookie)).personal;
 consumer=await attachmentClient(h.origin);browser=await chromium.launch({headless:true,...(process.env.CHEST_CHROMIUM?{executablePath:process.env.CHEST_CHROMIUM}:{}),args:[...(process.env.CHEST_CHROMIUM?['--no-sandbox']:[]),'--use-mock-keychain','--password-store=basic','--host-resolver-rules=MAP picker-client.example.test 127.0.0.1']});
 const report=await integrationReportSetup(h,cookie);
 const reports=await h.api('/integrations/clients',report.admin,{name:'Administrative activity reader',redirects:[consumer.origin+'/callback/report'],actions:['admin-report']});
 consumer.add('report',reports.client.id,[]);
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
  try{
   await context.addCookies(cookies(report.admin));const page=await context.newPage();
   const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
   const consent=new URLSearchParams({client_id:reports.client.id,redirect_uri:consumer.origin+'/callback/report',response_type:'code',code_challenge_method:'S256',code_challenge:challenge,state:randomBytes(32).toString('base64url'),scope:'admin-report',report_group:report.group.id});
   await page.goto(h.origin+'/oauth/chest/authorize?'+consent);
   if(width===1440){
    assert.ok((await page.locator('body').innerText()).includes(report.group.payload.name));
    assert.ok(!(await page.locator('body').innerText()).includes(report.otherGroup.payload.name));
    assert.equal(await page.getByRole('checkbox',{name:'Allow read-only administrative activity reports for these groups'}).isChecked(),false);
   }
   await tooltips(page,width,'integration-report-consent');await shot(page,width,'report-consent');
   await page.getByRole('checkbox',{name:'Allow read-only administrative activity reports for these groups'}).check();
   await Promise.all([page.waitForURL(/callback\/report/),page.getByRole('button',{name:'Authorize app',exact:true}).click()]);
   const code=new URL(page.url()).searchParams.get('code');
   const response=await h.fetch('/oauth/chest/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:reports.client.id,redirect_uri:consumer.origin+'/callback/report',code,code_verifier:verifier})});
   assert.equal(response.status,200);const grant=await response.json();
   await page.goto(h.origin+'/app/integrations');await shot(page,width,'report-grant');
   await page.goto(h.origin+'/app/administration/audit?'+report.filter+'&group='+report.group.id+'&limit=2');
   await page.getByRole('heading',{name:'Administrative activity',exact:true}).waitFor();
   await tooltips(page,width,'integration-scoped-report');await shot(page,width,'report-activity');
   if(width===1440){
    const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export CSV',exact:true}).click();
    const browserCsv=await readFile(await(await download).path(),'utf8');
    const integration=await h.fetch('/api/chest/integrations/v1/administration/audit/export?'+report.filter+'&limit=2',{headers:{authorization:'Bearer '+grant.access_token}});
    assert.equal(integration.status,200);assert.equal(await integration.text(),browserCsv,'the OAuth CSV reconciles with the actual browser Export CSV control');
    assert.equal(csvRowsForReport(browserCsv).length,305);
    for(const hidden of [report.secret.id,report.file.payload.name,report.secret.payload.name,'synthetic-chest-44 private original'])assert.ok(!browserCsv.includes(hidden));
    await Promise.all([page.waitForNavigation(),page.getByRole('link',{name:'Next page',exact:true}).click()]);await shot(page,width,'report-next-page');
    await page.goto(h.origin+'/app/integrations');const row=page.locator('li').filter({has:page.getByRole('button',{name:'Revoke grant',exact:true})}).filter({hasText:'Administrative activity reader'});
    await Promise.all([page.waitForNavigation(),row.getByRole('button',{name:'Revoke grant',exact:true}).click()]);
    const revoked=await h.fetch('/api/chest/integrations/v1/administration/audit?'+report.filter,{headers:{authorization:'Bearer '+grant.access_token}});assert.equal(revoked.status,401);assert.equal((await revoked.json()).error,'oauth_grant_revoked');
    await shot(page,width,'report-revoked');
   }
  }finally{await context.close()}
 }
 for(const width of [1440,390]){
  await h.api('/integrations/policy',cookie,{scope:'organization',mode:'any',apps:{}});
  const folder=await h.api('/items',cookie,{space,type:'folder',name:`Partner files ${width}`}),file=await h.api('/items',cookie,{parent:folder.id,name:`Signed terms ${width}.txt`,base64:Buffer.from('The original agreed terms.').toString('base64')}),outside=await h.api('/items',cookie,{space,name:`Private forecast ${width}.txt`,base64:Buffer.from('Outside the authorized folder.').toString('base64')});
  const app=await h.api('/integrations/clients',cookie,{name:`Picker partner ${width}`,redirects:[`${consumer.origin}/callback/${width}`],pickerOrigins:[consumer.origin],actions:['read','search','picker','upload','webhook']});
  consumer.add(width,app.client.id,[folder.id]);
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(cookies(cookie));await context.grantPermissions(['local-network-access'],{origin:consumer.origin});
  const host=await context.newPage(),admin=await context.newPage();host.setDefaultTimeout(15000);host.on('pageerror',e=>console.log('Partner client error:',e.message));await admin.goto(h.origin+'/app/integrations');await shot(admin,width,'console');
  await host.goto(`${consumer.origin}/host/${width}`);assert.equal(await host.evaluate(()=>typeof window.ChestPicker),'function','The third-party app loaded the real Chest component');const popupPromise=host.waitForEvent('popup');await host.getByRole('button',{name:'Attach from Chest'}).click();const popup=await popupPromise;popup.on('response',async r=>{if(r.url().includes('/integrations/v1/')&&r.status()>=400)console.log('Picker API refusal:',r.status(),(await r.json()).error)});await popup.setViewportSize({width,height:900});await popup.waitForURL(/\/oauth\/chest\/authorize/);await popup.getByRole('button',{name:'Authorize app',exact:true}).waitFor();await shot(popup,width,'consent');await popup.getByRole('button',{name:'Authorize app',exact:true}).click();try{await popup.waitForURL(/\/app\/integrations\/picker/)}catch(error){console.log('Picker transition:',new URL(popup.url()).pathname,await host.locator('#result').innerText());await popup.screenshot({path:'test-results/picker-transition.png',fullPage:true});throw error};await popup.getByRole('button',{name:file.payload.name,exact:true}).waitFor();assert.equal(await popup.getByRole('button',{name:outside.payload.name,exact:true}).count(),0);await shot(popup,width,'picker');
  // Search uses the same scoped API and never exposes an item outside the grant.
  await popup.getByLabel('Search files').fill('Private forecast');await popup.getByRole('button',{name:'Search',exact:true}).click();await popup.getByText('No accessible files in this grant.',{exact:true}).waitFor();await shot(popup,width,'picker-search-empty');await popup.getByLabel('Search files').fill('Signed terms');await popup.getByRole('button',{name:'Search',exact:true}).click();await popup.getByRole('button',{name:file.payload.name,exact:true}).click();try{await host.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('{'))}catch(error){console.log('Attachment result:',await host.locator('#result').innerText(),popup.isClosed()?'picker closed':await popup.locator('[data-picker-status]').innerText());throw error};const picked=JSON.parse(await host.locator('#result').innerText());assert.equal(picked.id,file.id);assert.equal(picked.url,`${h.origin}/app/items/${file.id}`);await shot(host,width,'attached');
  const access=await host.evaluate(()=>window.picker.token),hookResponse=await h.fetch('/api/chest/integrations/v1/webhooks',{method:'POST',headers:{authorization:'Bearer '+access,'content-type':'application/json','idempotency-key':`browser-webhook-${width}`},body:JSON.stringify({endpoint:'https://hooks.example.test/browser',events:['file.upload']})});assert.equal(hookResponse.status,200);const hook=(await hookResponse.json()).subscription;
  receiverStatus=503;await h.api('/items',cookie,{parent:folder.id,name:`Webhook evidence ${width}.txt`,base64:Buffer.from('Recorded live file arrival.').toString('base64')});
  let failed;for(let n=0;n<30;n++){const response=await h.fetch(`/api/chest/integrations/v1/webhooks/${hook.id}/deliveries`,{headers:{authorization:'Bearer '+access}}),d=await response.json();failed=d.items?.find(v=>v.state==='failed');if(failed)break;await new Promise(r=>setTimeout(r,50))}assert.ok(failed);
  await admin.goto(h.origin+'/app/integrations');await shot(admin,width,'webhook-failed');receiverStatus=200;await Promise.all([admin.waitForNavigation(),admin.locator('li').filter({hasText:failed.event}).getByRole('button',{name:'Replay same event',exact:true}).click()]);await shot(admin,width,'webhook-replayed');assert.equal(await admin.locator('li').filter({hasText:failed.event}).getByText('delivered',{exact:true}).count(),1,JSON.stringify({path:new URL(admin.url()).pathname,states:await admin.locator('strong').allTextContents(),body:(await admin.locator('body').innerText()).slice(-1200)}));
  const grant=await host.evaluate(()=>window.picker.grant);assert.ok(grant);await h.api(`/integrations/grants/${grant}/revoke`,cookie,{});await host.getByRole('button',{name:'Attach from Chest'}).click();await host.waitForFunction(()=>document.querySelector('#result').dataset.error==='oauth_grant_revoked');await shot(host,width,'revoked-pick');
  await admin.goto(h.origin+'/app/integrations');await admin.getByLabel(/^Authorization mode/).selectOption('allowlist');await admin.getByLabel(`Picker partner ${width} policy`).selectOption('read_only');await Promise.all([admin.waitForNavigation(),admin.getByRole('button',{name:'Save app policy',exact:true}).click()]);await shot(admin,width,'allowlist-read-only');
  await host.reload();const nextPopupPromise=host.waitForEvent('popup');await host.getByRole('button',{name:'Attach from Chest'}).click();const nextPopup=await nextPopupPromise;await nextPopup.setViewportSize({width,height:900});await nextPopup.getByRole('button',{name:'Authorize app',exact:true}).waitFor();await nextPopup.getByRole('button',{name:'Authorize app',exact:true}).click();await nextPopup.getByRole('button',{name:file.payload.name,exact:true}).waitFor();await nextPopup.getByRole('button',{name:file.payload.name,exact:true}).click();await host.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('{'));
  await admin.goto(h.origin+'/app/integrations');await admin.getByLabel(/^Authorization mode/).selectOption('allowlist');await admin.getByLabel(`Picker partner ${width} policy`).selectOption('blocked');await Promise.all([admin.waitForNavigation(),admin.getByRole('button',{name:'Save app policy',exact:true}).click()]);await shot(admin,width,'blocked-app');await host.getByRole('button',{name:'Attach from Chest'}).click();await host.waitForFunction(()=>document.querySelector('#result').dataset.error==='oauth_grant_revoked');await shot(host,width,'blocked-next-pick');
  // An off-list app's consent names the organization rule and offers no Authorize action.
  await host.reload();const refusedPromise=host.waitForEvent('popup');await host.getByRole('button',{name:'Attach from Chest'}).click();const refused=await refusedPromise;await refused.setViewportSize({width,height:900});await refused.getByText('Code: app_policy_app_blocked',{exact:true}).waitFor();assert.equal(await refused.getByRole('button',{name:'Authorize app',exact:true}).count(),0);await shot(refused,width,'policy-refusal');await refused.close();await context.close();
 }
 console.log('CONNECT-007 browser OAuth, picker stable IDs/links/search/revoke and allowlist/read-only/block console at 1440 and 390 passed');
}finally{await browser?.close();await consumer?.close();await h.close()}
