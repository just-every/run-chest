// AGENT-001: a person grants automatic filing, sees its notice and uses Undo at both widths.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness({edge:async request=>{
 if(request.url!=='https://api.openai.com/v1/chat/completions')return;
 const body=await request.json(),input=JSON.parse(body.messages[1].content),uncertain=input.name.startsWith('Unclear');
 return Response.json({choices:[{message:{content:JSON.stringify({destination:input.destinations[0].id,explanation:'Acme supplier tax records belong with vendor tax evidence.',quote:input.name,confidence:uncertain?0.6:0.96,uncertainty:uncertain?'The document mixes project terms and tax material.':'',taxonomy:['Vendors','Tax'],responsible:input.people[0]?.email??'',proposedName:input.name,tags:['Tax records']})}}]});
}});let browser;
const press=(page,button)=>Promise.all([page.waitForNavigation(),button.click()]);
async function shot(page,width,state){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits '+width+' '+state);await page.screenshot({path:`test-results/${width}-agent-filing-${state}.png`,fullPage:true})}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});await h.api('/filing/agent',owner,{action:'configure',provider:'openai',model:'test-provider-model',key:'test-only-agent-key'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:960},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const page=await context.newPage();
  const space=await h.api('/spaces',owner,{name:`Harbor vendor operations ${width}`}),inbox=await h.api('/items',owner,{space:space.id,type:'folder',name:`Supplier inbox ${width}`}),tax=await h.api('/items',owner,{space:space.id,type:'folder',name:`Acme Tax ${width}`});
  await page.goto(h.origin+'/app/filing/rules');const grants=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Standing agent grants',exact:true})});await grants.getByLabel('Source inbox folder').selectOption(inbox.id);await grants.locator(`input[name="destination:${tax.id}"]`).check();await grants.getByLabel('Allow proposed tags').check();await press(page,grants.getByRole('button',{name:'Grant automatic filing',exact:true}));await shot(page,width,'grant');
  const file=await h.api('/items',owner,{parent:inbox.id,name:`Acme W-9 ${width}.txt`,base64:Buffer.from('Acme supplier W-9 tax evidence.').toString('base64')});assert.equal(file.payload.parent,tax.id);
  await page.goto(h.origin+'/app/filing/rules');await shot(page,width,'filed');await page.goto(h.origin+'/app/filing');await shot(page,width,'activity');await page.goto(h.origin+'/app/notices');const row=page.locator('li').filter({hasText:`Filed Acme W-9 ${width}.txt`});await shot(page,width,'notice');await press(page,row.getByRole('button',{name:'Undo',exact:true}));assert.equal((await h.api(`/items/${file.id}`,owner)).item.parent,inbox.id);await shot(page,width,'undone');
  const unclear=await h.api('/items',owner,{parent:inbox.id,name:`Unclear Acme ${width}.txt`,base64:Buffer.from('Project terms mixed with tax notes.').toString('base64')});assert.equal(unclear.payload.parent,inbox.id);await page.goto(h.origin+'/app/filing/rules');await shot(page,width,'uncertain');const proposal=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Agent proposals and results',exact:true})}).locator('li').filter({hasText:`Unclear Acme ${width}.txt`});await press(page,proposal.getByRole('button',{name:'Decline',exact:true}));await shot(page,width,'declined');await context.close();
 }
 console.log('AGENT-001 browser grant, evidence, automatic filing, notices, Undo and uncertainty at 1440/390 passed');
}finally{await browser?.close();await h.close()}
