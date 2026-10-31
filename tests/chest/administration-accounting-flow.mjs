import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
import {portabilityJourney} from './backup-archive.mjs';
import {providerTransport} from '../../scripts/backup/accounting.mjs';
import {tooltips} from './tooltip-proof.mjs';
export async function accountingJourney(browser){
 await portabilityJourney();
 const engine='https://synthetic-chest-editor.test',model='synthetic-chest-model',png=await readFile('tests/chest/scan-nda.png'),pdf=await PDFDocument.create();pdf.addPage().drawText('synthetic-chest-1');const pdfBytes=await pdf.save();let refused=false,cached=false,cacheWrite=false,openai=false,serviceTier=null,malformed=false,primaryUsage;
 const h=await harness({bindings:{COLLABORA_URL:engine},edge:async request=>{
  if(request.url===engine+'/hosting/capabilities')return Response.json({productName:'Collabora Online Development Edition',productVersion:'synthetic-chest-1'});
  if(request.url==='https://synthetic-chest-model.test/messages'&&openai)return Response.json({choices:[{message:{content:JSON.stringify({readable:true,language:'en',text:'4417-CHEST',confidence:1})}}],...(primaryUsage===null?{}:{usage:primaryUsage??{prompt_tokens:1000,completion_tokens:100,prompt_tokens_details:{cached_tokens:200}}})});
  if(request.url==='https://synthetic-chest-model.test/messages')return refused?Response.json({error:{message:'synthetic-chest-private-detail'}},{status:429}):Response.json({content:[{type:'text',text:JSON.stringify({readable:true,language:'en',text:'4417-CHEST',confidence:1})}],...(primaryUsage===null?{}:{usage:primaryUsage??{input_tokens:1000,output_tokens:100,service_tier:serviceTier??undefined,cache_read_input_tokens:malformed?-1:cached?200:0,...(cacheWrite?{cache_creation_input_tokens:300,cache_creation:{ephemeral_5m_input_tokens:100,ephemeral_1h_input_tokens:200}}:{})}})});
  if(request.url===engine+'/hosting/discovery')return new Response(`<wopi-discovery><net-zone><app><action name="edit" ext="docx" urlsrc="${engine}/browser/editor?"/></app></net-zone></wopi-discovery>`);
  if(request.url.startsWith(engine+'/cool/convert-to/'))return new Response(request.url.endsWith('/png')?png:pdfBytes);
 }});
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
  await h.api('/people',owner,{action:'invite',email:'reader-accounting@example.test',name:'Reader'});const reader=await h.signIn('reader-accounting@example.test',true);
  const space=(await h.api('/files',owner)).personal,file=await h.api('/items',owner,{space,name:'Costs.docx',base64:Buffer.from(docx()).toString('base64')});
  const rates={provider:'Synthetic storage',quote:'Synthetic quote dated 2026-10-25',storageUsdPerGbMonth:0.02,egressUsdPerGb:0.08,aiProvider:'anthropic',aiModel:model,aiInputUsdPerMillion:2,aiOutputUsdPerMillion:4,aiRequestUsd:0.01,confirm:true};
  const objectQuote={...rates,objectProvider:'Cloudflare R2',objectOperations:{read:4,list:8,write:16,'multipart-start':20,'multipart-part':24,'multipart-complete':28,'multipart-abort':32,delete:0},objectInboundUsdPerGb:0.03,objectOutboundUsdPerGb:0.09};
  await h.api('/administration/costs',owner,{...objectQuote,objectOperations:{unknown:1}},400);
  await h.api('/administration/costs',reader,objectQuote,403);
  await h.api('/administration/costs',owner,objectQuote);
  const realFetch=globalThis.fetch;
  try{
   globalThis.fetch=async(input,init)=>typeof input==='string'&&input.startsWith('https://synthetic-chest-store.test/')?new Response(Buffer.alloc(37,1)):realFetch(input,init);
   const transport=providerTransport(async sql=>(await h.sql(sql)).results,'Cloudflare R2','accounting journey');
   for(const [method,path,body] of [['GET','?list-type=2',undefined],['GET','/synthetic-chest-1',undefined],['PUT','/synthetic-chest-1','synthetic-chest-2'],['POST','/synthetic-chest-1?uploads',''],['PUT','/synthetic-chest-1?uploadId=synthetic-chest-3&partNumber=1','synthetic-chest-4'],['POST','/synthetic-chest-1?uploadId=synthetic-chest-3','synthetic-chest-5'],['DELETE','/synthetic-chest-1?uploadId=synthetic-chest-3',undefined],['DELETE','/synthetic-chest-1',undefined]])await (await transport('https://synthetic-chest-store.test/bucket'+path,{method,body})).arrayBuffer();
  }finally{globalThis.fetch=realFetch}
  const objectReceipts=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.provider==='Cloudflare R2');
  assert.deepEqual(objectReceipts.map(r=>r.operation).sort(),['delete','list','multipart-abort','multipart-complete','multipart-part','multipart-start','read','write'].sort());
  for(const receipt of objectReceipts){assert.equal(receipt.inboundUsdPerGb,0.03);assert.equal(receipt.outboundUsdPerGb,0.09);assert.equal(receipt.responseBytes,37);assert.equal(receipt.operationUsdPerMillion,objectQuote.objectOperations[receipt.operation]);assert.equal(receipt.inboundUsd,Number((receipt.requestBytes/1e9*0.03).toFixed(9)));assert.equal(receipt.outboundUsd,Number((37/1e9*0.09).toFixed(9)));assert.equal(receipt.usd,Number((receipt.operationUsdPerMillion/1e6+receipt.inboundUsd+receipt.outboundUsd).toFixed(9)));}
  await h.api('/administration/costs',owner,{...objectQuote,objectOperations:{read:999}});await h.stop();await h.start();
  assert.deepEqual((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.provider==='Cloudflare R2'),objectReceipts,'operation quotes and both transfer directions survive replacement and restart');
  assert.doesNotMatch(JSON.stringify(objectReceipts),/synthetic-chest-store|synthetic-chest-2|uploadId/);
  const unconfirmed=await h.raw(`/api/chest/items/${file.id}/collabora`,owner,{});assert.equal(unconfirmed.status,409);assert.equal((await unconfirmed.json()).error,'editor_confirmation_required');
  await h.api('/administration/costs',owner,rates);
  await h.api('/reading/settings',owner,{provider:'anthropic',endpoint:'https://synthetic-chest-model.test/messages',model,key:'synthetic-chest-1'});
  await h.api('/reading/settings/test',owner,{});
  let usage=await h.api('/administration/provider-usage',owner),receipt=usage.rows.filter(r=>r.model===model).at(-1);assert.equal(receipt.input,1000);assert.equal(receipt.output,100);assert.equal(receipt.usd,0.0124);assert.equal(receipt.quote,rates.quote);assert.ok(receipt.rateAt);assert.ok(receipt.requestBytes>0&&receipt.responseBytes>0);
  await h.api('/administration/costs',owner,{...rates,aiInputUsdPerMillion:99});await h.stop();await h.start();
  assert.deepEqual((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model),[receipt],'restart and quote replacement preserve dated spend');
  cached=true;await h.api('/reading/settings/test',owner,{});const cache=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1);assert.equal(cache.cacheInput,200);assert.equal(cache.usd,null,'unquoted cached tiers are never priced as ordinary input');cached=false;
  const tiers={...rates,aiCacheReadUsdPerMillion:0.2,aiCacheWrite5mUsdPerMillion:2.5,aiCacheWrite1hUsdPerMillion:4};
  await h.api('/administration/costs',owner,tiers);cached=true;cacheWrite=true;await h.api('/reading/settings/test',owner,{});
  const tierReceipt=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1);
  assert.equal(tierReceipt.usd,0.01349);assert.equal(tierReceipt.uncachedInput,1000);assert.equal(tierReceipt.cacheWrite5m,100);assert.equal(tierReceipt.cacheWrite1h,200);assert.equal(tierReceipt.cacheRead,200);
  await h.api('/administration/costs',owner,{...tiers,aiCacheReadUsdPerMillion:99});await h.stop();await h.start();assert.deepEqual((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1),tierReceipt);
  serviceTier='priority';await h.api('/reading/settings/test',owner,{});assert.equal((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1).usd,null,'a different provider service tier cannot use the standard quote');
  await h.api('/administration/costs',owner,{...tiers,aiServiceTier:'priority'});await h.api('/reading/settings/test',owner,{});assert.equal((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1).usd,tierReceipt.usd);serviceTier=null;
  malformed=true;await h.api('/reading/settings/test',owner,{});assert.equal((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1).usd,null,'invalid cached counts are not silently treated as zero');const invalidUnits=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1);assert.equal(invalidUnits.cacheRead,null);assert.equal(invalidUnits.uncachedInput,null);malformed=false;
  serviceTier='synthetic-chest-private-detail';await h.api('/reading/settings/test',owner,{});assert.doesNotMatch(JSON.stringify(await h.api('/administration/provider-usage',owner)),/synthetic-chest-private-detail/,'unrecognized provider tier text never enters receipts');serviceTier=null;
  openai=true;cacheWrite=false;await h.api('/administration/costs',owner,{...tiers,aiProvider:'openai'});await h.api('/reading/settings',owner,{provider:'openai',endpoint:'https://synthetic-chest-model.test/messages',model,key:'synthetic-chest-1'});await h.api('/reading/settings/test',owner,{});
  const openaiReceipt=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model).at(-1);assert.equal(openaiReceipt.usd,0.01204);assert.equal(openaiReceipt.uncachedInput,800,'OpenAI cache hits are included in prompt token totals');
  // Successful readings do not turn absent or invalid primary units into a zero-priced call.
  const primaryCases=[
   {name:'omitted usage',units:null,input:null,output:null,usd:null},
   {name:'missing input',units:[undefined,100],input:null,output:100,usd:null},
   {name:'missing output',units:[1000,undefined],input:1000,output:null,usd:null},
   {name:'negative input',units:[-1,100],input:null,output:100,usd:null},
   {name:'string input',units:['1000',100],input:null,output:100,usd:null},
   {name:'unsafe input integer',units:[Number.MAX_SAFE_INTEGER+1,100],input:null,output:100,usd:null},
   {name:'fractional output',units:[1000,100.5],input:1000,output:null,usd:null},
   {name:'string output',units:[1000,'100'],input:1000,output:null,usd:null},
   {name:'valid control',units:[1000,100],input:1000,output:100,usd:0.0124},
  ];
  cached=false;cacheWrite=false;
  for(const provider of ['anthropic','openai']){
   openai=provider==='openai';await h.api('/administration/costs',owner,{...rates,aiProvider:provider});
   await h.api('/reading/settings',owner,{provider,endpoint:'https://synthetic-chest-model.test/messages',model,key:'synthetic-chest-1'});
   for(const scenario of primaryCases){
    primaryUsage=scenario.units===null?null:Object.fromEntries((openai?['prompt_tokens','completion_tokens']:['input_tokens','output_tokens']).map((key,i)=>[key,scenario.units[i]]));
    const before=await h.api('/administration/provider-usage',owner);
    assert.equal((await h.api('/reading/settings/test',owner,{})).ok,true,provider+' '+scenario.name+' still reads the sample');
    const after=await h.api('/administration/provider-usage',owner),call=after.rows.at(-1);
    assert.equal(after.rows.length,before.rows.length+1);
    assert.equal(call.provider,provider);assert.equal(call.model,model);assert.equal(call.outcome,'succeeded');
    assert.equal(call.input,scenario.input,provider+' '+scenario.name+' input');
    assert.equal(call.output,scenario.output,provider+' '+scenario.name+' output');
    assert.equal(call.usd,scenario.usd,provider+' '+scenario.name+' estimated cost');
    assert.equal(call.quote,rates.quote);assert.ok(call.at&&call.rateAt);assert.ok(call.requestBytes>0&&call.responseBytes>0);
    assert.equal(after.unknownCosts,before.unknownCosts+(scenario.usd===null?1:0));
    assert.equal(after.estimatedUsd,Number((before.estimatedUsd+(scenario.usd??0)).toFixed(9)));
   }
  }
  primaryUsage=undefined;
  const datedPrimary=(await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model);
  await h.api('/administration/costs',owner,{...rates,quote:'Replacement synthetic quote dated 2026-10-30',aiInputUsdPerMillion:99,aiOutputUsdPerMillion:88,aiRequestUsd:1});
  await h.stop();await h.start();
  assert.deepEqual((await h.api('/administration/provider-usage',owner)).rows.filter(r=>r.model===model),datedPrimary,'successful calls retain unknown amounts and dated estimates after quote replacement and restart');
  const providerCsv=await h.raw('/api/chest/administration/provider-usage/export',owner);assert.equal(providerCsv.status,200);
  const [columns,...csv]= (await providerCsv.text()).trimEnd().split('\r\n').map(line=>line.split(',').map(value=>value.replace(/^"|"$/g,'').replaceAll('""','"')));
  const cell=(row,name)=>row[columns.indexOf(name)],exportedPrimary=csv.filter(row=>cell(row,'Model')===model);
  assert.equal(exportedPrimary.length,datedPrimary.length);
  for(const [i,call]of datedPrimary.entries()){
   const row=exportedPrimary[i];assert.equal(cell(row,'Provider'),call.provider);assert.equal(cell(row,'At'),call.at);
   assert.equal(cell(row,'Input units'),call.input===null?'':String(call.input));
   assert.equal(cell(row,'Output units'),call.output===null?'':String(call.output));
   assert.equal(cell(row,'Estimated provider USD'),call.usd===null?'':String(call.usd),'CSV never substitutes a zero amount for unknown cost');
   assert.equal(cell(row,'Quote'),call.quote);
  }
  openai=false;cached=false;await h.api('/reading/settings',owner,{provider:'anthropic',endpoint:'https://synthetic-chest-model.test/messages',model,key:'synthetic-chest-1'});
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
  // A cancelled ZIP's scoped originals reconcile to the enclosing output,
  // rather than to chunks pulled ahead during assembly.
  const interruptedSelection=await h.api('/bulk',owner,{action:'download',items:[finished.result.item]}),zip=await h.raw(`/api/chest/bulk/${interruptedSelection.id}/archive`,owner);
  assert.equal(zip.status,200);const zipReader=zip.body.getReader();let prefix=Buffer.alloc(0);
  while(prefix.length<1024*1024){const part=await zipReader.read();assert.equal(part.done,false);prefix=Buffer.concat([prefix,part.value])}
  await zipReader.cancel();assert.equal(prefix.readUInt32LE(0),0x04034b50);
  const originalOffset=30+prefix.readUInt16LE(26)+prefix.readUInt16LE(28);
  const accountingGroup=await h.api('/groups',owner,{name:'ZIP accounting scope',members:[h.vars.OWNER_EMAIL]});
  let outer,member;
  for(let n=0;n<30;n++){
   outer=(await h.api('/administration/egress',owner)).rows.find(r=>r.item===interruptedSelection.id&&r.outcome==='cancelled');
   member=(await h.api('/administration/egress?group='+accountingGroup.id,owner)).rows.find(r=>r.item===finished.result.item&&r.door==='archive member');
   if(outer&&member?.outcome==='cancelled')break;await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(outer&&member);assert.equal(member.outcome,'cancelled');assert.ok(member.bytes>0&&member.bytes<20*1024*1024);
  assert.equal(member.bytes,Math.max(0,outer.bytes-originalOffset),'only original bytes at the ZIP output boundary count in the scoped report');
  assert.equal(member.uncertainBytes,outer.uncertainBytes);assert.equal(member.byteBasis,'Original member bytes at ZIP output checkpoints');
  await h.stop();await h.start();
  const persisted=(await h.api('/administration/egress?group='+accountingGroup.id,owner)).rows.find(r=>r.item===finished.result.item&&r.door==='archive member');assert.deepEqual(persisted,member,'restart preserves scoped cancelled output');
  await h.sql("UPDATE chest_audit SET detail=json_remove(detail,'$.measurement') WHERE action='transfer.egress' AND object_id=? AND json_extract(detail,'$.door')='archive member'",finished.result.item);
  const legacy=(await h.api('/administration/egress?group='+accountingGroup.id,owner)).rows.find(r=>r.item===finished.result.item&&r.door==='archive member');assert.equal(legacy.byteBasis,'Generated original chunks entering ZIP assembly');assert.equal(legacy.bytes,member.bytes,'historical assembly measurements are not rewritten');
  await h.sql("UPDATE chest_audit SET detail=json_set(detail,'$.measurement','zip-output') WHERE action='transfer.egress' AND object_id=? AND json_extract(detail,'$.door')='archive member'",finished.result.item);
  await h.sql("UPDATE chest_audit SET detail=json_set(detail,'$.outcome','running','$.bytes',0,'$.reservedBytes',64,'$.checkpointAt','2000-01-01T00:00:00.000Z') WHERE action='transfer.egress' AND object_id=? AND json_extract(detail,'$.outcome')='cancelled'",finished.result.item);
  await h.stop();await h.start();const uncertain=(await h.api('/administration/egress',owner)).rows.find(r=>r.item===finished.result.item&&r.outcome==='uncertain');assert.ok(uncertain);assert.equal(uncertain.uncertainBytes,64);assert.equal(uncertain.bytes,0);
  const config={edition:'CODE',enabled:true,documents:1,connections:1,annualUsd:0,quote:'Synthetic reported capacity dated 2026-10-25',confirm:true,codeAcknowledged:true};
  const licensed=await h.api('/administration/editor',owner,{...config,edition:'subscription',enabled:false,documents:7,connections:9,annualUsd:42,quote:'Synthetic licensed quote 2026-10-25'});assert.equal(licensed.settings.limitAuthority,'administrator-recorded');assert.equal(licensed.settings.connections,9);assert.equal(licensed.settings.annualUsd,42);
  await h.api('/administration/editor',reader,config,403);await h.api('/administration/editor',owner,{...config,codeAcknowledged:false},400);
  const old=(await h.api('/administration/editor-report',owner)).refusals;
  let lastSessionToken;
  for(const width of [1440,390]){
   await h.api('/administration/editor',owner,{...licensed.settings,codeAcknowledged:false,confirm:true});
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const page=await context.newPage();
   await page.goto(h.origin+'/app/administration/costs');
   const costForm=page.locator('form').filter({has:page.getByRole('button',{name:'Save estimate rates',exact:true})});
   await costForm.getByLabel('Object-store provider',{exact:true}).fill('Cloudflare R2');await costForm.getByLabel('List objects (USD per million requests)',{exact:true}).fill('8');await costForm.getByLabel('Read object (USD per million requests)',{exact:true}).fill('4');await costForm.getByLabel('Inbound to object store (USD per decimal GB)',{exact:true}).fill('0.03');await costForm.getByLabel('Outbound from object store (USD per decimal GB)',{exact:true}).fill('0.09');await costForm.getByLabel('I confirm these provider rates and their source for estimates.',{exact:true}).check();
   await Promise.all([page.waitForNavigation(),costForm.getByRole('button',{name:'Save estimate rates',exact:true}).click()]);
   const savedRates=(await h.api('/administration/costs',owner)).rates;assert.equal(savedRates.objectOperations.read,4);assert.equal(savedRates.objectOperations.list,8);assert.equal(savedRates.objectInboundUsdPerGb,0.03);assert.equal(savedRates.objectOutboundUsdPerGb,0.09);
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Confirm editor configuration',exact:true})});
   assert.equal(await page.getByLabel('Object-store provider',{exact:true}).count(),1);assert.match(await page.locator('body').innerText(),/Inbound is sent to the named provider/);
   assert.equal(await form.count(),1,(await page.locator('body').innerText()).slice(0,1000));
   await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Read service capabilities',exact:true}).click()]);assert.match(await page.locator('body').innerText(),/Collabora Online Development Edition/);const observed=await h.api('/administration/editor',owner);assert.equal(observed.observation.connections,null);assert.equal(observed.observation.documents,null);
   const chooseCode=async()=>{
    await form.getByLabel('Collabora edition').selectOption('CODE');await form.getByLabel('Concurrent document limit',{exact:true}).fill('1');await form.getByLabel('Concurrent connection limit',{exact:true}).fill('1');await form.getByLabel('Annual USD per user',{exact:true}).fill('0');await form.getByLabel('Provider quote and reported limit source',{exact:true}).fill(config.quote);await form.getByLabel('New editing sessions').selectOption('true');
   };
   const notice=page.getByRole('heading',{name:'Collabora edition and capacity',exact:true}).locator('..');
   const checkNotice=async()=>{
    const warning=notice.locator('p').filter({hasText:/CODE.*development and home use/});
    assert.ok(await warning.isVisible(),'the production notice is visible beside the configuration');
    assert.match(await warning.innerText(),/not supported business production/);
    assert.match(await warning.innerText(),/subscription adds vendor support and maintained releases.*quote/);
   };
   await chooseCode();
   assert.match(await form.locator('..').innerText(),/development and home use/);await tooltips(page,width,'editor-configuration');await page.screenshot({path:`test-results/${width}-accounting-confirmation.png`,fullPage:true});
   const beforeAcknowledgement=(await h.api('/administration/editor',owner)).settings;
   await form.getByLabel('I confirm the edition, limits and provider price above.',{exact:true}).check();
   if(width===1440){await checkNotice();assert.equal(await form.getByLabel('I acknowledge CODE’s production warning and the reported limits.',{exact:true}).isChecked(),false)}
   const [refusal]=await Promise.all([page.waitForNavigation(),form.getByRole('button',{name:'Confirm editor configuration',exact:true}).click()]);
   if(width===1440){
    assert.equal(refusal.status(),400);assert.match(await page.locator('body').innerText(),/code_acknowledgement_required/);
    assert.equal(beforeAcknowledgement.enabled,false);assert.equal(beforeAcknowledgement.codeAcknowledged,false);
    assert.deepEqual((await h.api('/administration/editor',owner)).settings,beforeAcknowledgement,'unacknowledged browser enablement changes no saved configuration');
    console.log('PROBE EDIT-012 1: real CODE form without acknowledgement -> 400 code_acknowledgement_required; disabled subscription configuration unchanged.');
   }
   await page.goto(h.origin+'/app/administration/costs');await chooseCode();
   await form.getByLabel('I acknowledge CODE’s production warning and the reported limits.',{exact:true}).check();await form.getByLabel('I confirm the edition, limits and provider price above.',{exact:true}).check();await Promise.all([page.waitForNavigation(),form.getByRole('button',{name:'Confirm editor configuration',exact:true}).click()]);
   const saved=(await h.api('/administration/editor',owner)).settings;
   const checkEnabled=async()=>{
    await checkNotice();
    assert.ok(await notice.getByText(/Collabora Online · CODE · New sessions enabled/).isVisible());
    assert.equal(await form.getByLabel('Collabora edition').inputValue(),'CODE');
    assert.equal(await form.getByLabel('New editing sessions').inputValue(),'true');
    const current=await h.api('/administration/editor',owner);assert.deepEqual(current.settings,saved);
    assert.equal(current.settings.codeAcknowledged,true);assert.equal(current.settings.enabled,true);assert.equal(current.settings.edition,'CODE');
    assert.equal(current.settings.quote,config.quote);assert.equal(current.settings.documents,config.documents);assert.equal(current.settings.connections,config.connections);assert.equal(current.settings.annualUsd,0);
    assert.match(current.notice,/CODE.*development and home use, not supported business production/);
    assert.match(current.notice,/subscription adds vendor support and maintained releases.*quote/);
    assert.equal(current.observation.documents,null);assert.equal(current.observation.connections,null);
    assert.match(await notice.innerText(),/license, capacity and live use remain unreported/);
   };
   if(width===1440)await checkEnabled();
   await page.reload();if(width===1440)await checkEnabled();
   await h.stop();await h.start();await page.reload();if(width===1440){await checkEnabled();console.log('PROBE EDIT-012 2: acknowledged CODE form, reload and Worker restart -> enabled CODE and saved acknowledgement persist; complete production warning and subscription additions remain visible.');}
   await notice.evaluate(section=>window.scrollTo(0,window.scrollY+section.getBoundingClientRect().top-120));
   await page.screenshot({path:`test-results/${width}-accounting-code-enabled-restarted.png`});
   await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.expires',0) WHERE kind='editor-session'");
   const opens=await Promise.all([h.raw(`/api/chest/items/${file.id}/collabora`,owner,{}),h.raw(`/api/chest/items/${file.id}/collabora`,owner,{})]);assert.deepEqual(opens.map(r=>r.status).sort(),[200,409]);const denial=await opens.find(r=>r.status===409).json();assert.equal(denial.error,'editor_capacity_reached');assert.equal(denial.limit,'connections');assert.equal(denial.currentUse,1);assert.equal(denial.maximum,1);assert.equal(denial.preview,`/app/items/${file.id}`);
   const launch=await opens.find(r=>r.status===200).text(),token=launch.match(/name="access_token" value="([^"]+)"/)[1];lastSessionToken=token;assert.equal((await h.fetch(`/wopi/files/${file.id}?access_token=${token}`)).status,200,'existing session continues');
   await page.goto(h.origin+'/app/items/'+file.id);await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Open in Collabora Online',exact:true}).click()]);await page.getByRole('heading',{name:'Editor capacity reached',exact:true}).waitFor();await page.frameLocator('iframe[title="Read-only file preview"]').locator('body').getByText('Harbor renewal agreement',{exact:false}).waitFor();await tooltips(page,width,'capacity-preview');await page.screenshot({path:`test-results/${width}-accounting-capacity-preview.png`,fullPage:true});
   await page.goto(h.origin+'/app/administration/audit');await page.getByRole('heading',{name:'Editor capacity',exact:true}).waitFor();
   const providerUsage=await h.api('/administration/provider-usage',owner),providerCard=page.getByRole('heading',{name:'Dated provider usage',exact:true}).locator('..');
   if(width===1440){
    assert.match(await providerCard.innerText(),new RegExp(providerUsage.unknownCosts+' unknown costs'));
    assert.ok((await providerCard.innerText()).includes('USD '+providerUsage.estimatedUsd.toFixed(9)+' estimated provider usage'));
    const rows=providerCard.locator('li');assert.equal(await rows.count(),providerUsage.rows.length);
    for(const [i,call]of providerUsage.rows.entries()){
     const row=rows.nth(i),text=await row.innerText();
     assert.equal(await row.locator('time').getAttribute('datetime'),call.at);
     assert.ok(text.includes(call.provider+' · '+call.model));assert.ok(text.includes(call.outcome));
     assert.ok(text.includes('Input units: '+(call.input??'Unknown')));
     assert.ok(text.includes('Output units: '+(call.output??'Unknown')));
     assert.ok(text.includes('Estimated provider cost: '+(call.usd===null?'Unknown':'USD '+call.usd.toFixed(9))));
    }
   }
   await providerCard.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/${width}-accounting-provider-usage.png`,fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await tooltips(page,width,'accounting-report');await page.screenshot({path:`test-results/${width}-accounting-report.png`,fullPage:true});await context.close();
  }
  const reportOutcome=()=>h.fetch(`/wopi/files/${file.id}/state`,{method:'POST',headers:{authorization:'Bearer '+lastSessionToken,'content-type':'application/json'},body:JSON.stringify({event:'provider-refused',kind:'limitreached'})});
  assert.equal((await reportOutcome()).status,200);assert.equal((await reportOutcome()).status,200);
  const providerReport=await h.api('/administration/editor-report',owner);assert.equal(providerReport.providerRefusals,1,'duplicate provider messages count once for the editor session');assert.deepEqual(providerReport.providerCapacity,{documents:null,connections:null,licensedLimits:null});assert.equal(providerReport.reconciliation.matchedProviderOutcomes,1);assert.equal(providerReport.reconciliation.unmatchedProviderOutcomes,0);assert.ok(providerReport.rows.some(r=>r.source==='Browser-reported provider outcome'&&r.maximum===null));
  const report=await h.api('/administration/editor-report',owner);assert.equal(report.refusals,old+5);assert.equal(report.usage.connections,1);assert.equal(report.usage.documents,1);assert.equal(report.configuration.edition,'CODE');await h.api('/administration/editor-report',reader,undefined,403);
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
