import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
import {tooltips} from './tooltip-proof.mjs';
export async function accountingJourney(browser){
 const engine='https://synthetic-chest-editor.test',model='synthetic-chest-model',png=await readFile('tests/chest/scan-nda.png'),pdf=await PDFDocument.create();pdf.addPage().drawText('synthetic-chest-1');const pdfBytes=await pdf.save();let refused=false,cached=false;
 const h=await harness({bindings:{COLLABORA_URL:engine},edge:async request=>{
  if(request.url==='https://synthetic-chest-model.test/messages')return refused?Response.json({error:{message:'synthetic-chest-private-detail'}},{status:429}):Response.json({content:[{type:'text',text:JSON.stringify({readable:true,language:'en',text:'synthetic-chest-1',confidence:1})}],usage:{input_tokens:1000,output_tokens:100,cache_read_input_tokens:cached?200:0}});
  if(request.url===engine+'/hosting/discovery')return new Response(`<wopi-discovery><net-zone><app><action name="edit" ext="docx" urlsrc="${engine}/browser/editor?"/></app></net-zone></wopi-discovery>`);
  if(request.url.startsWith(engine+'/cool/convert-to/'))return new Response(request.url.endsWith('/png')?png:pdfBytes);
 }});
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
  await h.api('/people',owner,{action:'invite',email:'reader-accounting@example.test',name:'Reader'});const reader=await h.signIn('reader-accounting@example.test',true);
  const space=(await h.api('/files',owner)).personal,file=await h.api('/items',owner,{space,name:'Costs.docx',base64:Buffer.from(docx()).toString('base64')});
  const rates={provider:'Synthetic storage',quote:'Synthetic quote dated 2026-10-25',storageUsdPerGbMonth:0.02,egressUsdPerGb:0.08,aiProvider:'anthropic',aiModel:model,aiInputUsdPerMillion:2,aiOutputUsdPerMillion:4,aiRequestUsd:0.01,confirm:true};
  const unconfirmed=await h.raw(`/api/chest/items/${file.id}/collabora`,owner,{});assert.equal(unconfirmed.status,409);assert.equal((await unconfirmed.json()).error,'editor_confirmation_required');
  await h.api('/administration/costs',owner,rates);
  await h.api('/reading/settings',owner,{provider:'anthropic',endpoint:'https://synthetic-chest-model.test/messages',model,key:'synthetic-chest-1'});
  await h.api('/reading/settings/test',owner,{});
  let usage=await h.api('/administration/provider-usage',owner),receipt=usage.rows.filter(r=>r.model===model).at(-1);assert.equal(receipt.input,1000);assert.equal(receipt.output,100);assert.equal(receipt.usd,0.0124);assert.equal(receipt.quote,rates.quote);assert.ok(receipt.rateAt);assert.ok(receipt.requestBytes>0&&receipt.responseBytes>0);
  await h.api('/administration/costs',owner,{...rates,aiInputUsdPerMillion:99});await h.stop();await h.start();
  assert.deepEqual((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model),[receipt],'restart and quote replacement preserve dated spend');
  cached=true;await h.api('/reading/settings/test',owner,{});const cache=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1);assert.equal(cache.cacheInput,200);assert.equal(cache.usd,null,'unquoted cached tiers are never priced as ordinary input');cached=false;
  refused=true;await h.api('/reading/settings/test',owner,{});usage=await h.api('/administration/provider-usage',owner);assert.equal(usage.rows.filter(r=>r.model===model).at(-1).outcome,'refused');assert.equal(usage.rows.filter(r=>r.model===model).at(-1).usd,null);assert.doesNotMatch(JSON.stringify(usage),/synthetic-chest-private-detail|synthetic-chest-1/);
  await h.api('/administration/provider-usage',reader,undefined,403);
  assert.equal((await h.raw('/api/chest/administration/provider-usage/export',owner)).status,200);
  const rendered=await h.raw(`/api/chest/items/${file.id}/rendered-preview/${file.payload.current}?page=1`,owner);assert.equal(rendered.status,200);const renderedBytes=(await rendered.arrayBuffer()).byteLength;
  const egress=await h.api('/administration/egress',owner),renderReceipt=egress.rows.find(r=>r.item===file.id&&r.door==='rendered preview');assert.equal(renderReceipt.bytes,renderedBytes);assert.equal(renderReceipt.outcome,'complete');
  const selection=await h.api('/bulk',owner,{action:'download',items:[file.id]}),archive=await h.raw(`/api/chest/bulk/${selection.id}/archive`,owner);assert.equal(archive.status,200);const archiveBytes=(await archive.arrayBuffer()).byteLength;
  const archiveReceipt=(await h.api('/administration/egress',owner)).rows.find(r=>r.door==='selection archive'&&r.item===selection.id);assert.equal(archiveReceipt.bytes,archiveBytes);assert.ok(archiveBytes>docx().length);
  // Crash reconciliation ages a real unfinished receipt; no invented successful completion.
  const pending=await h.api('/uploads',owner,{space,name:'Interrupted accounting.bin',size:20*1024*1024});
  for(let n=1,offset=0;offset<20*1024*1024;n++){const data=Buffer.alloc(Math.min(pending.partSize,20*1024*1024-offset),n);const part=await h.fetch(`/api/chest/uploads/${pending.id}/parts/${n}`,{method:'PUT',headers:{cookie:owner,origin:h.origin,'content-type':'application/octet-stream'},body:data});assert.equal(part.status,200);await part.json();offset+=data.length}
  const finished=await h.api(`/uploads/${pending.id}/complete`,owner,{}),large=await h.api(`/items/${finished.result.item}`,owner);
  const interrupted=await h.raw(`/api/chest/items/${finished.result.item}/bytes/${large.item.current}?download=true`,owner);assert.equal(interrupted.status,200);const body=interrupted.body.getReader();assert.ok((await body.read()).value.length>0);await body.cancel();
  let cancelled;for(let n=0;n<30;n++){cancelled=(await h.api('/administration/egress',owner)).rows.find(r=>r.item===finished.result.item&&r.outcome==='cancelled');if(cancelled)break;await new Promise(r=>setTimeout(r,100))}assert.ok(cancelled);assert.ok(cancelled.bytes>0&&cancelled.bytes<20*1024*1024);
  await h.sql("UPDATE chest_audit SET detail=json_set(detail,'$.outcome','running','$.bytes',0,'$.reservedBytes',64,'$.checkpointAt','2000-01-01T00:00:00.000Z') WHERE action='transfer.egress' AND object_id=? AND json_extract(detail,'$.outcome')='cancelled'",finished.result.item);
  await h.stop();await h.start();const uncertain=(await h.api('/administration/egress',owner)).rows.find(r=>r.item===finished.result.item&&r.outcome==='uncertain');assert.ok(uncertain);assert.equal(uncertain.uncertainBytes,64);assert.equal(uncertain.bytes,0);
  const config={edition:'CODE',enabled:true,documents:1,connections:1,annualUsd:0,quote:'Synthetic reported capacity dated 2026-10-25',confirm:true,codeAcknowledged:true};
  await h.api('/administration/editor',reader,config,403);await h.api('/administration/editor',owner,{...config,codeAcknowledged:false},400);
  const old=(await h.api('/administration/editor-report',owner)).refusals;
  let lastSessionToken;
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const page=await context.newPage();
   await page.goto(h.origin+'/app/administration/costs');const form=page.locator('form').filter({has:page.getByRole('button',{name:'Confirm editor configuration',exact:true})});
   assert.equal(await form.count(),1,(await page.locator('body').innerText()).slice(0,1000));
   await form.getByLabel('Collabora edition').selectOption('CODE');await form.getByLabel('Concurrent document limit',{exact:true}).fill('1');await form.getByLabel('Concurrent connection limit',{exact:true}).fill('1');await form.getByLabel('Annual USD per user',{exact:true}).fill('0');await form.getByLabel('Provider quote and reported limit source',{exact:true}).fill(config.quote);await form.getByLabel('New editing sessions').selectOption('true');
   assert.match(await form.locator('..').innerText(),/development and home use/);await tooltips(page,width,'editor-configuration');await page.screenshot({path:`test-results/${width}-accounting-confirmation.png`,fullPage:true});
   await form.getByLabel('I acknowledge CODE’s production warning and the reported limits.',{exact:true}).check();await form.getByLabel('I confirm the edition, limits and provider price above.',{exact:true}).check();await Promise.all([page.waitForNavigation(),form.getByRole('button',{name:'Confirm editor configuration',exact:true}).click()]);
   await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.expires',0) WHERE kind='editor-session'");
   const opens=await Promise.all([h.raw(`/api/chest/items/${file.id}/collabora`,owner,{}),h.raw(`/api/chest/items/${file.id}/collabora`,owner,{})]);assert.deepEqual(opens.map(r=>r.status).sort(),[200,409]);const denial=await opens.find(r=>r.status===409).json();assert.equal(denial.error,'editor_capacity_reached');assert.equal(denial.limit,'connections');assert.equal(denial.currentUse,1);assert.equal(denial.maximum,1);assert.equal(denial.preview,`/app/items/${file.id}`);
   const launch=await opens.find(r=>r.status===200).text(),token=launch.match(/name="access_token" value="([^"]+)"/)[1];lastSessionToken=token;assert.equal((await h.fetch(`/wopi/files/${file.id}?access_token=${token}`)).status,200,'existing session continues');
   await page.goto(h.origin+'/app/items/'+file.id);await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Open in Collabora Online',exact:true}).click()]);await page.getByRole('heading',{name:'Editor capacity reached',exact:true}).waitFor();await page.frameLocator('iframe[title="Read-only file preview"]').locator('body').getByText('Harbor renewal agreement',{exact:false}).waitFor();await tooltips(page,width,'capacity-preview');await page.screenshot({path:`test-results/${width}-accounting-capacity-preview.png`,fullPage:true});
   await page.goto(h.origin+'/app/administration/audit');await page.getByRole('heading',{name:'Editor capacity',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await tooltips(page,width,'accounting-report');await page.screenshot({path:`test-results/${width}-accounting-report.png`,fullPage:true});await context.close();
  }
  const report=await h.api('/administration/editor-report',owner);assert.equal(report.refusals,old+4);assert.equal(report.usage.connections,1);assert.equal(report.usage.documents,1);assert.equal(report.configuration.edition,'CODE');await h.api('/administration/editor-report',reader,undefined,403);
  assert.equal((await h.raw('/api/chest/administration/editor-report/export',owner)).status,200);
  const closed=await h.fetch(`/wopi/files/${file.id}/state`,{method:'POST',headers:{authorization:'Bearer '+lastSessionToken}});assert.equal(closed.status,200);assert.equal((await h.api('/administration/editor-report',owner)).usage.connections,0);assert.equal((await h.fetch(`/wopi/files/${file.id}?access_token=${lastSessionToken}`)).status,401);const reopened=await h.raw(`/api/chest/items/${file.id}/collabora`,owner,{});assert.equal(reopened.status,200);await reopened.text();
  // A new document hits the document bound even with a free connection.
  await h.api('/administration/editor',owner,{...config,connections:2});const second=await h.api('/items',owner,{space,name:'Second costs.docx',base64:Buffer.from(docx()).toString('base64')});const denied=await h.raw(`/api/chest/items/${second.id}/collabora`,owner,{});assert.equal(denied.status,409);assert.equal((await denied.json()).limit,'documents');
  const group=await h.api('/groups',owner,{name:'Accounting custody',members:[h.vars.OWNER_EMAIL]});await h.api('/administration/roles',owner,{email:'reader-accounting@example.test',role:'audit-reporting',scope:'groups',groups:[group.id]});
  const scoped=await h.api('/administration/provider-usage',reader);assert.ok(scoped.rows.some(r=>r.item===file.id&&r.provider==='Collabora Online'));assert.ok(scoped.rows.every(r=>r.quote===null&&r.usd===null&&r.networkQuote===null&&r.networkUsd===null));assert.doesNotMatch(JSON.stringify(scoped),/Costs.docx/);
  const selected=(await h.api('/administration/egress?group='+group.id,reader)).rows;assert.ok(selected.some(r=>r.item===file.id&&r.door==='archive member'&&r.bytes===docx().length));assert.ok(selected.every(r=>r.door!=='selection archive'),'mixed archive framing is organization-only');
  await h.api('/administration/editor',owner,{...config,enabled:false});await h.api(`/items/${file.id}/collabora`,owner,{},409);
  console.log('ADMIN-002 accounting passed: dated AI quotes, unknown failed costs, restart, stream bounds, rendered bytes, ZIP framing, atomic editor capacities and every refusal at 1440 and 390.');
 }finally{await h.close()}
}
