import assert from 'node:assert/strict';

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
