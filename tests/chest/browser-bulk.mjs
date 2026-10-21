// BULK-001 selection, durable receipts and a real streamed ZIP download at desktop and phone widths.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {unzipSync,strFromU8} from 'fflate';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const press=(p,name)=>Promise.all([p.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()]);
async function shot(p,width,state){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${state} fits ${width}`);await p.screenshot({path:`test-results/${width}-bulk-${state}.png`,fullPage:true})}
async function settled(p){await p.locator('[data-bulk-job][data-bulk-pending="false"]').waitFor({state:'visible',timeout:60000})}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const cookie=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});const space=(await h.api('/files',cookie)).personal;
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true,acceptDownloads:true});await context.addCookies(cookie.split('; ').map(v=>{const at=v.indexOf('=');return {name:v.slice(0,at),value:v.slice(at+1),url:h.origin}}));const p=await context.newPage();
  const folder=await h.api('/items',cookie,{space,type:'folder',name:`Selection proof ${width}`}),files=[];for(const name of ['Contract.txt','Notes.txt'])files.push(await h.api('/items',cookie,{parent:folder.id,name,base64:Buffer.from(`${name} original at ${width}`).toString('base64')}));
  const sibling=await h.api('/items',cookie,{space,type:'folder',name:`Supplier brief ${width}`});files.push(await h.api('/items',cookie,{parent:sibling.id,name:'Supplier brief.txt',base64:Buffer.from(`Supplier original at ${width}`).toString('base64')}));
  // Carry a selection through two folder pages and a search, using only visible controls.
  await p.goto(h.origin+'/app/spaces/'+space);await shot(p,width,'space-list');
  await p.goto(h.origin+'/app/items/'+folder.id);await shot(p,width,'folder-list');await p.locator(`input[type=checkbox][name=items][value="${files[0].id}"]`).check();
  await p.goto(h.origin+'/app/items/'+sibling.id);await p.locator(`input[type=checkbox][name=items][value="${files[2].id}"]`).check();
  await p.goto(h.origin+'/app/files/search?q='+encodeURIComponent(`original at ${width}`));await shot(p,width,'search-list');await p.locator(`input[type=checkbox][name=items][value="${files[1].id}"]`).check();
  await press(p,'Actions for selected items');await shot(p,width,'selection');
  await p.getByLabel('Action',{exact:true}).selectOption('download');await press(p,'Start selected action');await settled(p);await shot(p,width,'download-job');
  const download=p.waitForEvent('download');await p.getByRole('link',{name:'Download selection ZIP',exact:true}).click();const path=await(await download).path(),zip=unzipSync(new Uint8Array(await readFile(path))),manifest=JSON.parse(strFromU8(zip['chest-manifest.json']));assert.equal(manifest.included.length,3);assert.equal(manifest.excluded.length,0);for(const f of manifest.included)assert.ok(zip[f.path]);
  await p.goto(h.origin+'/app/bulk?'+files.map(f=>'items='+encodeURIComponent(f.id)).join('&'));await p.getByLabel('Action',{exact:true}).selectOption('trash');await press(p,'Start selected action');await settled(p);await shot(p,width,'trash-receipt');assert.match(await p.locator('[role=status]').innerText(),/3 succeeded/);
  await p.goto(h.origin+'/app/files/trash');await shot(p,width,'trash-list');await p.goto(h.origin+'/app/bulk?'+files.map(f=>'items='+encodeURIComponent(f.id)).join('&'));await p.getByLabel('Action',{exact:true}).selectOption('restore');await press(p,'Start selected action');await settled(p);await shot(p,width,'restore-receipt');assert.match(await p.locator('[role=status]').innerText(),/3 succeeded/);
  await p.reload();await shot(p,width,'stored-receipt');await p.goto(h.origin+'/app/bulk');await shot(p,width,'stored-jobs');assert.ok(await p.getByRole('link',{name:/restore · Completed/}).count());await context.close();
 }
 console.log('BULK-001 browser selection, streamed ZIP and stored trash/restore receipts at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
