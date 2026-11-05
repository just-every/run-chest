import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {tooltips} from './tooltip-proof.mjs';
import {scanHarness,scanPeople,scanFolder,scannedItem,settledFields,scanExpectations,assertScanProvenance} from './scan-fields.mjs';
// One desktop assertion journey, with the same changed panels photographed at
// both required widths. No route, persistence or application permission is mocked.
async function scanProvenanceBrowser(h,browser,owner,space){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
 await ctx.addCookies(owner.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));
 const p=await ctx.newPage(),records=[];
 try{
  for(const kind of ['nda','w9']){
   const type=kind==='nda'?'NDA':'W-9',name=kind==='nda'?'Two-page Harbor NDA.tiff':'Phone Acme W-9.png',original=await readFile(`tests/chest/scan-${kind==='nda'?'nda.tiff':'w9.png'}`);
   const {folder}=await scanFolder(h,owner,space,{type,name});await p.goto(h.origin+`/app/items/${folder.id}`);
   await Promise.all([
    p.waitForURL(url=>url.pathname.startsWith('/app/items/')&&url.pathname!==`/app/items/${folder.id}`),
    p.locator('input[data-pick]').first().setInputFiles({name,mimeType:kind==='nda'?'image'+'/tiff':'image'+'/png',buffer:original}),
   ]);
   const child=(await h.api(`/items/${folder.id}`,owner)).children.find(c=>c.name===name);assert.ok(child,'native upload published the original in its typed folder');assert.equal(new URL(p.url()).pathname,`/app/items/${child.id}`);
   await settledFields(h,child.id,owner);const item=await h.api(`/items/${child.id}`,owner),before=await assertScanProvenance(h,item,owner,kind);
   assert.deepEqual(item.metadata.filing.fields,{},'reading proposes values without writing authoritative typed fields');
   records.push({kind,item,before});
  }
  const panel=async({kind,item,before},restarted=false)=>{
   const proof=await assertScanProvenance(h,item,owner,kind);assert.deepEqual(proof,before,'every page image, proposal and original hash persists');
   const version=proof.reading.version,paths=proof.reading.reading.pages.map(page=>`/api/chest/items/${item.id}/pages/${version}/${page.n}`);
   const images=paths.map(path=>p.waitForResponse(r=>new URL(r.url()).pathname===path));
   await p.goto(h.origin+`/app/items/${item.id}`);const region=p.getByRole('region',{name:'Fields read from this scan'});
   await expect(region.locator('.read-item')).toHaveCount(scanExpectations[kind].length);
   for(const [i,response] of (await Promise.all(images)).entries()){assert.equal(response.status(),200);assert.deepEqual(await response.body(),h.scanImages[kind][i],'the browser loads the exact-version image submitted to the reader')}
   assert.equal(await region.locator('.read-page').count(),paths.length);
   for(const [i,source] of proof.reading.reading.pages.entries()){
    const figure=region.locator('.read-page').nth(i),svg=figure.locator('svg');
    await expect(figure.locator('figcaption')).toContainText(`Page ${source.n}`);assert.equal(await svg.getAttribute('viewBox'),`0 0 ${source.width} ${source.height}`);
    assert.equal(await svg.locator('image').getAttribute('href'),paths[i]);assert.equal(await figure.getByRole('link',{name:'Open page image'}).getAttribute('href'),paths[i]);
    assert.equal(await svg.locator('.read-mark').count(),scanExpectations[kind].filter(e=>e.page===source.n).length);
   }
   for(const [i,e] of scanExpectations[kind].entries()){
    const proposal=proof.reading.fields.proposals[i],row=region.locator('.read-item').nth(i);
    await expect(row.locator('.read-field')).toHaveText(e.field);await expect(row.locator('.read-value')).toHaveText(String(proposal.value));await expect(row.locator('.quiet').first()).toHaveText(`Page ${proposal.page} · ${Math.round(proposal.confidence*100)}% sure${proposal.confidence<.6?' · low confidence':''}`);
    await expect(row.locator('.read-num')).toHaveText(String(i+1));
    const figure=region.locator('.read-page').filter({has:p.locator('svg').filter({has:p.locator(`image[href="${paths[e.page-1]}"]`)})}),mark=figure.locator('.read-mark').filter({has:p.locator('text').filter({hasText:new RegExp(`^${i+1}$`)})});
    assert.equal(await mark.count(),1,'each list number identifies one box on its declared page');
    const [x0,y0,x1,y1]=e.pixels,rect=mark.locator('rect');
    for(const [attribute,value] of Object.entries({x:x0-4,y:y0-4,width:x1-x0+8,height:y1-y0+8}))assert.equal(Number(await rect.getAttribute(attribute)),value,`${e.field} source ${attribute}`);
   }
   if(kind==='w9'){await expect(region).toContainText('***-**-6789');assert.ok(!(await region.innerText()).includes('12-3456789'),'proposal text never exposes the full TIN')}
   assert.deepEqual((await h.api(`/items/${item.id}`,owner)).metadata.filing.fields,{});
   if(!restarted){
    await tooltips(p,1440,'scan-'+kind);await region.scrollIntoViewIfNeeded();
    for(const width of [1440,390]){
     await p.setViewportSize({width,height:1000});await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await region.screenshot({path:`test-results/${width}-scan-panel-${kind}-provenance.png`});await p.screenshot({path:`test-results/${width}-scan-${kind}-provenance.png`,fullPage:true});
    }
    await p.setViewportSize({width:1440,height:1000});
   }
  };
  for(const record of records)await panel(record);
  await h.stop();await h.start();
  for(const record of records)await panel(record,true);
  console.log('PROBE SEARCH-002 1 browser: native TIFF and W-9 uploads -> all seven proposal values, pages, confidence labels and numbered source boxes match the public reading API and exact-version images, before and after Worker restart; originals unchanged; 1440 and 390 proof captured');
 }finally{await ctx.close()}
}
const h=await scanHarness();let browser;
try{
 await mkdir('test-results',{recursive:true});const {owner,viewer,space}=await scanPeople(h);
 browser=await chromium.launch({headless:true,...(process.env.CHEST_CHROMIUM_PATH?{executablePath:process.env.CHEST_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 await scanProvenanceBrowser(h,browser,owner,space);
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await ctx.addCookies(owner.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const p=await ctx.newPage();
  let {item,folder}=await scannedItem(h,owner,space,{name:`Harbor NDA ${width}.png`,fields:{Term:3},required:true});await settledFields(h,item.id,owner);
  const snap=async(name)=>{await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.getByRole('region',{name:'Fields read from this scan'}).screenshot({path:`test-results/${width}-scan-panel-${name}.png`});await p.screenshot({path:`test-results/${width}-scan-fields-${name}.png`,fullPage:true})};
  await p.goto(h.origin+`/app/items/${folder.id}?manage`);await p.getByLabel('Read required fields after scan upload',{exact:false}).selectOption('true');await p.getByRole('button',{name:'Require version review',exact:true}).click();await p.locator('section.card').filter({has:p.getByRole('heading',{name:'Version review',exact:true})}).screenshot({path:`test-results/${width}-scan-intake-settings.png`});assert.equal((await h.api(`/items/${folder.id}`,owner)).item.governance.scanIntake,true);
  await p.locator('[data-upload]').getByLabel('Term',{exact:false}).fill('3');
  const scan=await readFile('tests/chest/scan-nda.png');
  // A completed single upload opens its file, replacing the transient progress row.
  await Promise.all([
   p.waitForURL(url=>url.pathname.startsWith('/app/items/')&&url.pathname!==`/app/items/${folder.id}`),
   p.locator('input[data-pick]').first().setInputFiles({name:`New Harbor NDA ${width}.png`,mimeType:'image'+'/png',buffer:scan}),
  ]);
  item=(await h.api(`/items/${folder.id}`,owner)).children.find(i=>i.name===`New Harbor NDA ${width}.png`);assert.ok(item,'the uploaded scan is saved in its folder');assert.equal(new URL(p.url()).pathname,`/app/items/${item.id}`);
  const uploaded=await h.api(`/items/${item.id}`,owner);assert.equal(uploaded.versions.at(-1).checksum,createHash('sha256').update(scan).digest('hex'));
  await settledFields(h,item.id,owner);
  await p.goto(h.origin+`/app/items/${item.id}`);const readings=p.getByRole('region',{name:'Fields read from this scan'});await readings.locator('.read-mark').first().waitFor();await snap('proposals');
  const party=readings.locator('.read-item').filter({has:p.locator('.read-field').filter({hasText:'Party'})});await party.getByRole('button',{name:'Accept',exact:true}).click();await p.getByText('Accepted by',{exact:false}).waitFor();
  const date=readings.locator('.read-item').filter({has:p.locator('.read-field').filter({hasText:'Effective date'})});await date.getByText('Correct',{exact:true}).click();await date.getByLabel('Correct value',{exact:false}).fill('2026-03-05');await date.getByRole('button',{name:'Save value',exact:true}).click();await p.getByText('Corrected to 2026-03-05',{exact:false}).waitFor();await snap('confirmed');
  const check=await h.api(`/items/${item.id}`,owner);assert.equal(check.metadata.filing.fields['Effective date'],'2026-03-05');
  // The same original's viewer can inspect the boxes but cannot decide a proposal.
  await ctx.clearCookies();await ctx.addCookies(viewer.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));await p.reload();assert.equal(await p.getByRole('button',{name:'Accept',exact:true}).count(),0);await snap('viewer');await ctx.close();
 }
 console.log('SEARCH-002 boxed folder scans, correction and read-only viewer at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}

await (await import('./ask-browser-flow.mjs')).askBrowserFlow();
