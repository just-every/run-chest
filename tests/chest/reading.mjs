// Reading files through the public HTTP doors of the built Worker: PDF text layers are read with no key, scans and
// photos are read by the installation's own AI model (faked only at its network edge, api.anthropic.com), search
// finds the words inside, and every door filters what was read by current access.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import jpegJs from 'jpeg-js';
import {harness} from './harness.mjs';
import {pdf as textPdf} from './fixtures.mjs';
const calls=[];let activeKey='synthetic-chest-100',providerFailure=false,providerRequests=0,outputAllowance=null;
const scanPolicy={enabled:true,maxCalls:61,maxOutput:2048,retention:'until_original_erased',providerRetention:'Verified synthetic provider: requests discarded after processing.',residency:'Verified synthetic provider region: US.',verified:true,confirm:true};
// The provider's side of the Messages API: it answers the schema Chest asks for. A transcription echoes the page Chest
// names in its request, so each page's text shows it was read; a field reading reads every field it is asked for
// except the last, which it reports as unreadable.
async function anthropic(request){
 if(request.url!=='https://api.anthropic.com/v1/messages')return;
 providerRequests++;const body=await request.json(),content=body.messages[0].content,images=content.filter(p=>p.type==='image'),ask=content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
 if(outputAllowance!==null)assert.equal(body.max_tokens,outputAllowance,'the owner output allowance reaches each scan call');
 assert.ok(request.headers.get('x-api-key')===activeKey,'provider receives only the current configured key');assert.ok(!JSON.stringify(body).includes(activeKey),'the credential is absent from every model prompt');if(providerFailure)return Response.json({error:{message:'Reflected private request credential '+activeKey}},{status:429});assert.equal(body.model,'claude-sonnet-5-5');assert.ok(images.length>0&&images.every(p=>p.source.type==='base64'&&['image/jpeg','image/png'].includes(p.source.media_type)),'every page goes as an image');
 calls.push({schema:Object.keys(body.output_config.format.schema.properties),ask,images:images.map(p=>p.source.media_type)});
 const reply=value=>Response.json({type:'message',role:'assistant',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(value)}],usage:{input_tokens:1200,output_tokens:80}});
 if('text' in body.output_config.format.schema.properties)return reply({readable:true,language:'en',confidence:0.94,text:`Bluebell kiln schedule — ${ask.match(/Transcribe (.*)\./)[1]}`});
 const wanted=[...ask.matchAll(/^- (.+) \((text|number|date|yes\/no)\)$/gm)].map(m=>({name:m[1],type:m[2]}));
 return reply({fields:wanted.map((f,i)=>i===wanted.length-1?{field:f.name,found:false,value:'',page:0,box:[0,0,0,0],confidence:0,note:'Blurred.'}:{field:f.name,found:true,value:f.type==='date'?'2026-03-04':f.type==='number'?'2':'Harbor Freight Logistics LLC',page:1,box:[100,120,500,160],confidence:0.91,note:''})});
}
const h=await harness({edge:anthropic}),b64=v=>Buffer.from(v).toString('base64');
const check=async(id,fn)=>{await fn();console.log(`${id} passed`)};
// A scanned PDF: each page is one JPEG picture and no text layer, as a scanner or phone scanning app writes it.
function scannedPdf(pages){
 const page=n=>{const width=850,height=1100,data=Buffer.alloc(width*height*4,236);for(let y=150+n*40;y<900;y+=60)for(let x=100;x<700;x++)for(let t=0;t<14;t++){const i=((y+t)*width+x)*4;data[i]=data[i+1]=data[i+2]=40}return {width,height,bytes:Buffer.from(jpegJs.encode({data,width,height},70).data)}};
 const images=Array.from({length:pages},(_,n)=>page(n)),objects=[],kids=images.map((_,n)=>`${3+n*3} 0 R`).join(' ');
 objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`));
 images.forEach((image,n)=>{const draw='q 612 0 0 792 0 0 cm /Im1 Do Q';objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 ${4+n*3} 0 R >> >> /Contents ${5+n*3} 0 R >>`),Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),image.bytes,Buffer.from('\nendstream')]),Buffer.from(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`))});
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[];let at=parts[0].length;
 objects.forEach((o,i)=>{offsets.push(at);const chunk=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),o,Buffer.from('\nendobj\n')]);parts.push(chunk);at+=chunk.length});
 parts.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`));
 return Buffer.concat(parts);
}
const people={},mgr={principal:'ana@example.test',role:'manager'};
async function staff(){
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);people.owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:people.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 for(const name of ['ana','ben','dee']){await h.api('/people',people.owner,{action:'invite',email:`${name}@example.test`,name:name[0].toUpperCase()+name.slice(1)});people[name]=await h.signIn(`${name}@example.test`,true)}
}
// Reading runs in the background; the status door also lets it read the next page. Waits until nothing is left.
async function settled(path,who,done=r=>!['queued','reading'].includes(r.state)){
 for(let i=0;i<120;i++){const r=await h.api(`${path}?work=1`,who);const all=r.reading?[r.reading]:r.versions.flatMap(v=>[v.reading,v.fields].filter(Boolean));if(all.every(done)&&all.every(x=>x.state!=='waiting'))return r;await new Promise(f=>setTimeout(f,100))}
 assert.fail(`${path} still reading`);
}
const search=async(who,q)=>(await h.api(`/search?q=${encodeURIComponent(q)}`,people[who])).results.map(r=>r.name).sort();
const library=async(who,q)=>(await h.api(`/library?q=${encodeURIComponent(q)}`,people[who])).documents.map(d=>d.payload.title).sort();
try{
 await staff();
 let space,folder;
 await check('SEARCH-001 access',async()=>{
  space=await h.api('/spaces',people.ana,{name:'Ops'});await h.api(`/spaces/${space.id}/members`,people.ana,{members:[mgr,{principal:'ben@example.test',role:'viewer'}]});
  folder=await h.api('/items',people.ana,{space:space.id,type:'folder',name:'Contracts'});
  // With no AI key, a PDF's text layer is read and searchable; a scan waits for a key and says so.
  const msa=await h.api('/items',people.ana,{parent:folder.id,type:'file',name:'MSA.pdf',base64:b64(textPdf())});
  const scan=await h.api('/items',people.ana,{parent:folder.id,type:'file',name:'NDA scan.pdf',base64:b64(scannedPdf(1))});
  const memo=await h.api('/items',people.ana,{parent:folder.id,type:'file',name:'Memo.docx',base64:b64(await readFile('tests/chest/memo.docx'))});
  const text=(await settled(`/items/${msa.id}/reading`,people.ana)).reading;assert.equal(text.state,'done');assert.equal(text.method,'PDF text layer');
  assert.equal((await settled(`/items/${memo.id}/reading`,people.ana)).reading.method,'text of the Word document');assert.deepEqual(await search('ben','dock schedule'),['Memo.docx']);
  assert.deepEqual(await search('ana','supplier evidence'),['MSA.pdf']);assert.deepEqual(await search('ben','SUPPLIER EVIDENCE'),['MSA.pdf']);
  const waiting=(await settled(`/items/${scan.id}/reading`,people.ana)).reading;assert.equal(waiting.state,'needs_key');assert.match(waiting.problem,/AI model key/);
  assert.equal(calls.length,0,'nothing goes to a provider without a key');
  // Someone outside the space finds nothing and gets no status, text or page image; a viewer removed loses it on the next request.
  assert.deepEqual(await search('dee','supplier evidence'),[]);assert.deepEqual(await search('dee','dock schedule'),[]);await h.api(`/items/${msa.id}/reading`,people.dee,undefined,403);
  await h.api(`/spaces/${space.id}/members`,people.ana,{members:[mgr]});assert.deepEqual(await search('ben','supplier evidence'),[]);await h.api(`/items/${msa.id}/reading`,people.ben,undefined,403);
  // A restricted folder keeps its text from the space's members too.
  await h.api(`/spaces/${space.id}/members`,people.ana,{members:[mgr,{principal:'ben@example.test',role:'viewer'}]});await h.api(`/items/${folder.id}/settings`,people.ana,{restricted:true});
  assert.deepEqual(await search('ben','supplier evidence'),[]);assert.deepEqual(await search('ana','supplier evidence'),['MSA.pdf']);
  await h.api(`/items/${folder.id}/settings`,people.ana,{restricted:false});
  // A governed record's text follows its record grants: private hides it from collection readers.
  const collection=await h.api('/collections',people.owner,{name:'Vendors'}),plain=await h.api('/schemas',people.owner,{name:'Contract',fields:[]});
  await h.api(`/collections/${collection.id}/grants`,people.owner,{grants:[{principal:'ben@example.test',role:'reader'}]});
  const record=await h.api('/documents',people.owner,{title:'Vendor MSA',collection:collection.id,schema:plain.id,fields:{},owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL,filename:'vendor-msa.pdf',base64:b64(textPdf())});
  await settled(`/documents/${record.id}/reading`,people.owner);
  assert.deepEqual(await library('ben','supplier evidence'),['Vendor MSA']);assert.deepEqual(await library('dee','supplier evidence'),[]);
  await h.api(`/documents/${record.id}/reading`,people.dee,undefined,404);
  await h.api(`/documents/${record.id}/grants`,people.owner,{grants:[],private:true});assert.deepEqual(await library('ben','supplier evidence'),[]);
 });
 await check('SEARCH-001/002 scans',async()=>{
  // Saving a key alone grants no automatic scan authority. Only the owner can approve current provider terms.
  await h.api('/reading/settings',people.ana,{provider:'anthropic',key:'synthetic-chest-100'},403);
  const saved=await h.api('/reading/settings',people.owner,{provider:'anthropic',model:'claude-sonnet-5-5',key:activeKey});assert.ok(!JSON.stringify(saved).includes(activeKey),'the key is never sent back');
  const scan=(await h.api(`/items/${folder.id}`,people.ana)).children.find(c=>c.name==='NDA scan.pdf');
  const beforeConsent=providerRequests,blocked=(await settled(`/items/${scan.id}/reading`,people.ana)).reading;
  assert.equal(blocked.state,'unavailable');assert.match(blocked.problem,/owner approves/);assert.equal(providerRequests,beforeConsent,'a saved key never bypasses owner consent');
  await h.api('/reading/policy',people.ana,scanPolicy,403);await h.api('/reading/policy',people.owner,{...scanPolicy,confirm:false},400);await h.api('/reading/policy',people.owner,{...scanPolicy,verified:false},400);await h.api('/reading/policy',people.owner,{...scanPolicy,retention:''},400);
  assert.equal((await h.raw('/api/chest/reading/policy',null,scanPolicy)).status,401);
  const crossPolicy=await h.fetch('/api/chest/reading/policy',{method:'POST',headers:{cookie:people.owner,origin:'https://synthetic-chest-origin.test','content-type':'application/json'},body:JSON.stringify(scanPolicy)});assert.equal(crossPolicy.status,403);
  outputAllowance=scanPolicy.maxOutput;await h.api('/reading/policy',people.owner,scanPolicy);

  const two=await h.api('/items',people.ana,{parent:folder.id,type:'file',name:'Two pages.pdf',base64:b64(scannedPdf(2))});
  const photo=await h.api('/items',people.ana,{parent:folder.id,type:'file',name:'IMG_0412.HEIC',base64:b64(await readFile('tests/chest/photo.heic'))});
  for(const item of [scan,two,photo]){const r=(await settled(`/items/${item.id}/reading`,people.ana)).reading;assert.equal(r.state,'done',item.name);assert.ok(r.pages.every(p=>p.state==='done'&&p.image&&p.language==='en'))}
  assert.equal(photo.payload.versions[0].mediaType,'image/heic');
  assert.deepEqual(await search('ana','page 2 of 2 of a scanned PDF'),['Two pages.pdf']);assert.deepEqual(await search('ben','kiln schedule'),['IMG_0412.HEIC','NDA scan.pdf','Two pages.pdf']);assert.deepEqual(await search('dee','kiln schedule'),[]);
  const image=await h.raw(`/api/chest/items/${photo.id}/pages/${photo.payload.current}/1`,people.ben);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');
  assert.equal((await h.raw(`/api/chest/items/${photo.id}/pages/${photo.payload.current}/1`,people.dee)).status,403);
  // A scanned record of a type with fields: values are proposed with their page and box, and only an editor's yes saves one.
  const collection=await h.api('/collections',people.owner,{name:'Agreements'}),nda=await h.api('/schemas',people.owner,{name:'NDA',fields:[{name:'Party',type:'text',required:false},{name:'Effective date',type:'date',required:false},{name:'Term (years)',type:'number',required:false},{name:'Governing state',type:'text',required:false}]});
  await h.api(`/collections/${collection.id}/grants`,people.owner,{grants:[{principal:'ana@example.test',role:'editor'},{principal:'ben@example.test',role:'reader'}]});
  const record=await h.api('/documents',people.owner,{title:'Bluebell NDA',collection:collection.id,schema:nda.id,fields:{'Term (years)':3},owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL,filename:'bluebell-nda.pdf',base64:b64(scannedPdf(1))});
  const version=record.payload.versions[0].id,read=(await settled(`/documents/${record.id}/reading`,people.ana)).versions[0].fields;
  assert.equal(read.state,'done');assert.deepEqual(read.proposals.map(p=>[p.field,p.found,p.value]),[['Party',true,'Harbor Freight Logistics LLC'],['Effective date',true,'2026-03-04'],['Term (years)',true,2],['Governing state',false,null]]);
  const box=read.proposals[0].box;assert.ok(box.every(n=>n>0&&n<1)&&box[2]>box[0]&&box[3]>box[1],'boxes are fractions of the page image');
  assert.equal((await h.api('/library?q=Harbor%20Freight%20Logistics',people.ana)).count,0,'a proposal is not a saved value');
  await h.api(`/documents/${record.id}/fields/${version}`,people.ben,{field:'Party',decision:'accept'},403);await h.api(`/documents/${record.id}/fields/${version}`,people.dee,{field:'Party',decision:'accept'},404);
  await h.api(`/documents/${record.id}/fields/${version}`,people.ana,{field:'Party',decision:'accept'});
  await h.api(`/documents/${record.id}/fields/${version}`,people.ana,{field:'Effective date',decision:'accept',value:'2026-03-05'});
  await h.api(`/documents/${record.id}/fields/${version}`,people.ana,{field:'Term (years)',decision:'accept'},409);await h.api(`/documents/${record.id}/fields/${version}`,people.ana,{field:'Governing state',decision:'reject'});
  const after=await h.api(`/documents/${record.id}`,people.ben);assert.deepEqual(after.payload.fields,{'Term (years)':3,Party:'Harbor Freight Logistics LLC','Effective date':'2026-03-05'},'a value a person saved is never replaced');
  assert.deepEqual(await library('ben','Harbor Freight Logistics'),['Bluebell NDA']);assert.deepEqual(await library('dee','Harbor Freight Logistics'),[]);
  const audit=(await h.api('/audit',people.owner)).filter(e=>e.object_id===record.id&&e.action.startsWith('field.')).map(e=>({action:e.action,...JSON.parse(e.detail)}));
  assert.deepEqual(audit.map(a=>a.action).sort(),['field.accept','field.correct','field.reject']);assert.ok(audit.every(a=>a.version===version&&a.reader==='claude-sonnet-5-5'));assert.deepEqual(audit.find(a=>a.action==='field.accept').box,box);
  await h.api(`/documents/${record.id}/fields/${version}`,people.ana,{field:'Party',decision:'reject'},409);
  assert.ok(calls.some(c=>c.schema.includes('fields')&&c.ask.includes('- Effective date (date)')));
  // The record page shows the scan with the boxes drawn on it.
  const html=await (await h.raw(`/app/documents/${record.id}`,people.ana)).text();assert.match(html,/Fields read from this scan/);assert.match(html,new RegExp(`<image href="/api/chest/documents/${record.id}/pages/${version}/1"`));assert.match(html,/<rect x="/);
  // OCR and schema reading share a durable allowance for identical retained bytes, including failures.
  await h.api('/reading/policy',people.owner,{...scanPolicy,maxCalls:1});
  const beforeFields=providerRequests,schemaBlocked=await h.api('/documents',people.owner,{title:'Allowance-blocked NDA',collection:collection.id,schema:nda.id,fields:{},owner:h.vars.OWNER_EMAIL,reviewer:h.vars.OWNER_EMAIL,filename:'same-original.pdf',base64:b64(scannedPdf(1))});
  const blockedFields=(await settled(`/documents/${schemaBlocked.id}/reading`,people.owner)).versions[0].fields;assert.equal(blockedFields.state,'unavailable');assert.equal(blockedFields.proposals.length,0);assert.equal(providerRequests,beforeFields,'schema reads cannot bypass the checksum allowance spent on OCR');

  const spentBefore=providerRequests,limitedBytes=scannedPdf(3),limited=await h.api('/items',people.ana,{parent:folder.id,name:'Limited scan.pdf',base64:b64(limitedBytes)});
  const exhausted=(await settled(`/items/${limited.id}/reading`,people.ana)).reading;assert.equal(exhausted.state,'unavailable');assert.match(exhausted.problem,/allowance.*exhausted/);assert.equal(providerRequests,spentBefore+1);
  await h.api(`/items/${limited.id}/reading`,people.ana,{});assert.equal((await settled(`/items/${limited.id}/reading`,people.ana)).reading.state,'unavailable');assert.equal(providerRequests,spentBefore+1,'a manual request cannot reset spent calls');
  const duplicate=await h.api('/items',people.ana,{parent:folder.id,name:'Same retained scan.pdf',base64:b64(limitedBytes)});assert.equal((await settled(`/items/${duplicate.id}/reading`,people.ana)).reading.state,'unavailable');assert.equal(providerRequests,spentBefore+1,'identical originals share one allowance');
  const retainedBytes=await h.raw(`/api/chest/items/${limited.id}/bytes/${limited.payload.current}`,people.ana);assert.equal(retainedBytes.status,200);assert.deepEqual(Buffer.from(await retainedBytes.arrayBuffer()),limitedBytes);
  const oldDecisions=(await h.api(`/documents/${record.id}/reading`,people.ana)).versions[0].fields.proposals.filter(p=>p.decision);assert.equal(oldDecisions.length,3);assert.deepEqual((await h.api(`/documents/${record.id}`,people.ana)).payload.fields,after.payload.fields);
  providerFailure=true;const failureBefore=providerRequests,failed=await h.api('/items',people.ana,{parent:folder.id,name:'Failed scan.pdf',base64:b64(scannedPdf(4))});
  const failure=(await settled(`/items/${failed.id}/reading`,people.ana)).reading;assert.equal(failure.state,'unavailable');assert.equal(providerRequests,failureBefore+1);
  await h.api(`/items/${failed.id}/reading`,people.ana,{});await settled(`/items/${failed.id}/reading`,people.ana);assert.equal(providerRequests,failureBefore+1,'failed calls remain charged without automatic retry');providerFailure=false;
  // Turning off stops new scans while keeping prior text and human decisions visible.
  await h.api('/reading/policy',people.owner,{enabled:false,confirm:true});const offBefore=providerRequests,off=await h.api('/items',people.ana,{parent:folder.id,name:'Policy off.pdf',base64:b64(scannedPdf(5))});assert.equal((await settled(`/items/${off.id}/reading`,people.ana)).reading.state,'unavailable');assert.equal(providerRequests,offBefore);
  assert.equal((await h.api(`/documents/${record.id}/reading`,people.ana)).versions[0].fields.proposals.filter(p=>p.decision).length,oldDecisions.length);
  outputAllowance=null;

 });

 await check('SECURITY-001 provider key custody',async()=>{
  providerFailure=true;
  const canaries=['synthetic-chest-101','synthetic-chest-102'];let previousCiphertext='';
  for(const canary of canaries){
   activeKey=canary;
   const configuration={provider:'anthropic',model:'claude-sonnet-5-5',key:canary};
   await h.api('/reading/settings',people.ana,configuration,403);
   const cross=await h.fetch('/api/chest/reading/settings',{method:'POST',headers:{cookie:people.owner,origin:'https://synthetic-chest-origin.test','content-type':'application/json'},body:JSON.stringify(configuration)});assert.equal(cross.status,403);
   assert.equal((await h.raw('/api/chest/reading/settings',null,configuration)).status,401);
   const saved=await h.api('/reading/settings',people.owner,configuration);
   assert.ok(!JSON.stringify(saved).includes(canary),'save response contains no credential');
   const stored=(await h.sql('SELECT key_sealed FROM chest_reader WHERE id=1')).results[0].key_sealed;
   assert.ok(stored!==previousCiphertext&&!stored.includes(canary),'replacement credential has distinct sealed custody');previousCiphertext=stored;
   const result=await h.api('/reading/settings/test',people.owner,{});
   assert.equal(result.ok,false);assert.match(result.message,/429/);
   for(const secret of canaries)assert.ok(!JSON.stringify(result).includes(secret),'a provider cannot reflect a credential into public diagnostics');
   const exposed=JSON.stringify([await h.api('/reading/settings',people.owner),await h.api('/audit',people.owner)])+await(await h.fetch('/app/admin',{headers:{cookie:people.owner}})).text();
   for(const secret of canaries)assert.ok(!exposed.includes(secret),'settings, served page and durable audit omit credentials');
  }
  if(process.env.CHEST_SECURITY_BROWSER_PROOF==='1'){
   const {chromium}=await import('@playwright/test'),{mkdir}=await import('node:fs/promises'),{tooltips}=await import('./tooltip-proof.mjs');
   const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir('test-results',{recursive:true});
   try{for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
    await context.addCookies(people.owner.split('; ').map(value=>{const i=value.indexOf('=');return{name:value.slice(0,i),value:value.slice(i+1),url:h.origin}}));
    const page=await context.newPage();await page.goto(h.origin+'/app/admin#reading');await tooltips(page,width,'provider-custody-settings');
    await page.locator('#reading').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/${width}-provider-custody-settings.png`,fullPage:true});
    await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Test the key',exact:true}).click()]);
    await page.getByRole('heading',{name:'The key did not work',exact:true}).waitFor();assert.ok((await page.locator('main').innerText()).includes('429'));
    for(const secret of canaries)assert.ok(!(await page.content()).includes(secret),'browser diagnostic contains no credential');
    await tooltips(page,width,'provider-custody-diagnostic');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`test-results/${width}-provider-custody-diagnostic.png`,fullPage:true});await context.close();
   }}finally{await browser.close()}
  }
  await h.api('/reading/settings/remove',people.owner,{});
  const requestsBeforeRemoval=providerRequests,removed=await h.api('/reading/settings/test',people.owner,{});assert.equal(removed.ok,false);assert.match(removed.message,/need an AI model key/);assert.equal(providerRequests,requestsBeforeRemoval,'removed provider authority makes no outbound request');
  assert.equal((await h.sql('SELECT id FROM chest_reader')).results.length,0,'revocation removes saved provider authority');
  assert.equal((await h.api('/search?q=Bluebell',people.ana)).results.length>0,true,'provider rotation and revocation preserve authorized searchable originals');
 });
}finally{await h.close()}
