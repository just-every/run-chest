import assert from 'node:assert/strict';
import {zip} from './fixtures.mjs';
import {createHash} from 'node:crypto';
import {tooltips} from './tooltip-proof.mjs';

export async function archivePreviewJourney({page,owner,h,width,assertions=true}){
 const sha=b=>createHash('sha256').update(b).digest('hex'),original=zip([['docs/',''],['docs/nested/terms.txt','synthetic-chest-1'],['<img src=x onerror=alert(1)>.txt','synthetic-chest-2']]);
 const space=(await h.api('/files',owner)).personal,file=await h.api('/items',owner,{space,name:`Archive ${width}.zip`,base64:original.toString('base64')}),v1=file.payload.current;
 await page.goto(h.origin+`/app/items/${file.id}`);
 const frame=page.frameLocator('iframe[title="ZIP directory"]');await frame.getByRole('heading',{name:'ZIP directory'}).waitFor();
 if(assertions){
  assert.deepEqual(await frame.locator('li > span').allTextContents(),['docs/','docs/nested/terms.txt','<img src=x onerror=alert(1)>.txt']);
  assert.match(await frame.getByRole('status').innerText(),/2 files · 1 folders · 34 bytes/);
  assert.equal(await frame.locator('img,script').count(),0);
  const response=await page.request.get(h.origin+`/api/chest/items/${file.id}/bytes/${v1}?download=true`);assert.equal(sha(await response.body()),sha(original));
  const fresh=zip([['replacement.txt','synthetic-chest-3']]);await h.api(`/items/${file.id}/versions`,owner,{base64:fresh.toString('base64')});await page.reload();
  await frame.getByText('replacement.txt',{exact:true}).waitFor();assert.deepEqual(await frame.locator('li > span').allTextContents(),['replacement.txt']);
  const retained=page.locator('.ver').filter({has:page.getByRole('heading',{name:/Version 1/})}).getByRole('link',{name:'Open ZIP directory'});
  const [popup]=await Promise.all([page.waitForEvent('popup'),retained.click()]);await popup.getByText('Retained version',{exact:false}).waitFor();assert.deepEqual(await popup.locator('li > span').allTextContents(),['docs/','docs/nested/terms.txt','<img src=x onerror=alert(1)>.txt']);await popup.close();
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'file page fits');
 assert.ok(await frame.locator('html').evaluate(e=>e.scrollWidth<=innerWidth),'ZIP listing fits');
 await page.screenshot({path:`test-results/${width}-files-zip-directory.png`,fullPage:true});
 await tooltips(page,width,'zip-directory');
}

// Chromium creates the embed before the native viewer has loaded its PDF.
// Ask that viewer for its load result; an attached embed alone can be blank.
export async function pdfReady(page){
 const plugin=page.locator('embed[type="application/pdf"]');
 await plugin.waitFor({state:'attached'});
 const result=await plugin.evaluate(element=>new Promise((resolve,reject)=>{
  const done=(error,value)=>{clearTimeout(timer);window.removeEventListener('message',onMessage);error?reject(error):resolve(value)};
  const onMessage=event=>{
   if(event.origin!=='chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai')return;
   if(event.data?.type==='documentLoaded'){
    if(event.data.load_state!=='success'){done(Error('Native PDF failed to load'));return}
    element.postMessage({type:'selectAll'},'*');element.postMessage({type:'getSelectedText'},'*');
   }
   if(event.data?.type==='getSelectedTextReply')done(null,event.data.selectedText);
  };
  const timer=setTimeout(()=>done(Error('Native PDF viewer did not finish loading')),15000);
  window.addEventListener('message',onMessage);
  element.postMessage({type:'initialize'},'*');
 }));
 assert.equal(typeof result,'string');return result;
}
