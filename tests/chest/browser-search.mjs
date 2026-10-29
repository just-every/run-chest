import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {rtf,rtfPhrase,privateRtf,symbolRtf,symbolPhrase} from './rtf-fixtures.mjs';
import {tooltips} from './tooltip-proof.mjs';
import {pdf} from './fixtures.mjs';
const h=await harness({now:'2026-10-27T02:00:00.000Z'}),b64=x=>Buffer.from(x).toString('base64');let browser;
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const space=await h.api('/spaces',cookie,{name:'Harbor operations'}),folder=await h.api('/items',cookie,{space:space.id,type:'folder',name:'Supplier agreements'});
 const agreement=await h.api('/items',cookie,{parent:folder.id,name:'Acme agreement.txt',base64:b64(pdf())});await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.updatedAt',?) WHERE id=?",'2026-10-15T12:00:00.000Z',agreement.id);const file=await h.api('/items',cookie,{parent:folder.id,name:'Harbor delivery notes.md',base64:b64('Cobalt lantern delivery instructions: report to the harbor office.')});await h.api(`/items/${file.id}/versions`,cookie,{base64:b64('Delivery instructions were updated after the safety review.')});

 await h.api('/people',cookie,{action:'invite',email:'reader@example.test',name:'Reader'});const reader=await h.signIn('reader@example.test',true);await h.api(`/spaces/${space.id}/members`,cookie,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'reader@example.test',role:'viewer'}]});
 const rich=await h.api('/items',cookie,{parent:folder.id,name:'Rich original.bin',base64:b64(rtf())});
 const settle=async id=>{for(let i=0;i<80;i++){const r=await h.api(`/items/${id}/reading?work=1`,cookie);if(!['queued','reading'].includes(r.reading?.state))return r.reading;await new Promise(r=>setTimeout(r,100))}assert.fail('RTF extraction did not finish')};await settle(rich.id);
 const displayed=await h.api('/items',cookie,{parent:folder.id,name:'Displayed RTF.bin',base64:b64(privateRtf)});await settle(displayed.id);
 const symbol=await h.api('/items',cookie,{parent:folder.id,name:'Symbol RTF.bin',base64:b64(symbolRtf)});await settle(symbol.id);
 const broken=await h.api('/items',cookie,{parent:folder.id,name:'Broken RTF.rtf',base64:b64(String.raw`{\rtf1 incomplete`)});await settle(broken.id);
 const bounded=await h.api('/items',cookie,{parent:folder.id,name:'Bounded RTF.rtf',base64:b64(String.raw`{\rtf1 `+'x'.repeat(900_001)+'}')});await settle(bounded.id);
 browser=await chromium.launch({headless:true,...(process.env.CHEST_CHROMIUM_PATH?{executablePath:process.env.CHEST_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const p=await context.newPage();
  const snap=async(name)=>{await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`test-results/${width}-search-${name}.png`,fullPage:true})};
  // The filters fold behind one Filters control (U20); each page load starts folded.
  const filters=async()=>{const fold=p.locator('details.filter-fold');if(!await fold.evaluate(e=>e.open))await fold.locator('summary').click()};
  await p.goto(h.origin+'/app/files/search');
  if(width===1440){
   await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.updatedAt',?) WHERE id=?",'2026-10-26T23:00:00.000Z',agreement.id);
   await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.updatedAt',?) WHERE id=?",'2025-07-04T16:00:00.000Z',file.id);
   await filters();await p.getByLabel('Dates in time zone',{exact:false}).selectOption(['America','Los_Angeles'].join('/'));
   for(const [value,name,absent] of [['today','Acme agreement.txt','Harbor delivery notes.md'],['lastYear','Harbor delivery notes.md','Acme agreement.txt']]){
    await filters();await p.getByRole('combobox',{name:/^Modified/}).selectOption(value);await p.getByLabel('Location',{exact:false}).selectOption(folder.id);await p.getByLabel('PDFs',{exact:true}).check();
    if(value==='lastYear')await p.getByLabel('PDFs',{exact:true}).uncheck();
    await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('main').getByRole('link',{name,exact:true}).waitFor();assert.equal(await p.getByRole('main').getByRole('link',{name:absent,exact:true}).count(),0);
   }
   await filters();await p.getByRole('combobox',{name:/^Modified/}).selectOption('');
   await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.updatedAt',?) WHERE id=?",'2026-10-15T12:00:00.000Z',agreement.id);
  }
  await filters();await p.getByLabel('Modified from',{exact:true}).fill('2026-10-15');await p.getByLabel('Modified through',{exact:true}).fill('2026-10-15');await p.getByLabel('PDFs',{exact:true}).check();await p.getByLabel('Location',{exact:false}).selectOption(folder.id);await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('main').getByRole('link',{name:'Acme agreement.txt',exact:true}).waitFor();assert.equal(await p.getByRole('main').getByRole('link',{name:'Harbor delivery notes.md',exact:true}).count(),0);await snap('combined');
  await filters();await p.getByLabel('Modified from',{exact:true}).fill('');await p.getByLabel('Modified through',{exact:true}).fill('');await p.getByLabel('PDFs',{exact:true}).uncheck();await p.getByRole('main').getByRole('searchbox').fill('Cobalt lantern');await p.getByLabel('Version',{exact:false}).selectOption('any');await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('main').getByRole('link',{name:'Harbor delivery notes.md',exact:true}).waitFor();await p.getByText('Earlier version 1',{exact:false}).waitFor();await snap('earlier-version');

  await filters();await p.getByRole('main').getByRole('searchbox').fill(symbolPhrase);await p.getByLabel('Version',{exact:false}).selectOption('current');await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('main').getByRole('link',{name:'Symbol RTF.bin',exact:true}).waitFor();await snap('rtf-symbol');
  if(width===1440)for(const q of ['private-index-token','private-contents-token','private-unnumbered-token']){await filters();await p.getByRole('main').getByRole('searchbox').fill(q);await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByText('0 accessible result(s).',{exact:true}).waitFor()}
  await filters();await p.getByRole('main').getByRole('searchbox').fill(width===1440?rtfPhrase:'Jade river');await p.getByLabel('Documents',{exact:true}).check();await p.getByLabel('Version',{exact:false}).selectOption('current');await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByRole('main').getByRole('link',{name:'Rich original.bin',exact:true}).waitFor();if(width===1440)assert.ok((await p.locator('main').innerText()).includes(rtfPhrase));await tooltips(p,width,'rtf-search');await snap('rtf-current');
  if(width===1440){await h.api(`/items/${rich.id}/versions`,cookie,{base64:b64(rtf('Jade river current revision'))});await settle(rich.id)}
  await filters();await p.getByRole('main').getByRole('searchbox').fill(rtfPhrase);await p.getByLabel('Version',{exact:false}).selectOption('any');await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.getByText('Earlier version 1',{exact:false}).waitFor();await snap('rtf-retained');
  for(const [item,label,visible] of [[rich,'rtf-reading','text of the RTF document'],[broken,'rtf-failed','At byte'],[bounded,'rtf-truncated','Partially indexed: the first 900,000 characters']]){await p.goto(h.origin+`/app/items/${item.id}`);await p.getByText(visible,{exact:false}).waitFor();if(item===rich)await tooltips(p,width,'rtf-reading');await snap(label)}
  await context.close();
 }

 const revokedContext=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});await revokedContext.addCookies(reader.split('; ').map(c=>{const i=c.indexOf('=');return{name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));const revokedPage=await revokedContext.newPage();const query='/app/files/search?'+new URLSearchParams({q:rtfPhrase,versions:'any',type:'documents'});await revokedPage.goto(h.origin+query);await revokedPage.getByRole('main').getByRole('link',{name:'Rich original.bin',exact:true}).waitFor();
 await h.api(`/spaces/${space.id}/members`,cookie,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});await revokedPage.reload();await revokedPage.getByText('0 accessible result(s).',{exact:true}).waitFor();assert.equal(await revokedPage.getByRole('main').getByRole('link',{name:'Rich original.bin',exact:true}).count(),0);assert.ok(!(await revokedPage.locator('main').innerText()).includes(rtfPhrase));assert.equal(await revokedPage.locator(`select[name=location] option[value="${folder.id}"]`).count(),0);assert.equal(await revokedPage.locator('select[name=creator] option[value="owner@example.test"]').count(),0);await revokedPage.screenshot({path:'test-results/1440-search-rtf-revoked.png',fullPage:true});await revokedContext.close();
 console.log('SEARCH-001 browser filters and earlier versions at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
