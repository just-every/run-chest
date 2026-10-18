// RULE-001: a person previews, approves and undoes a rule at both supported browser widths.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
const h=await harness();let browser;
const press=(page,button)=>Promise.all([page.waitForNavigation(),button.click()]);
async function shot(page,width,state){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits '+width);await page.screenshot({path:`test-results/${width}-arrival-rules-${state}.png`,fullPage:true})}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:960},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const page=await context.newPage();
  const space=await h.api('/spaces',owner,{name:`Harbor operations ${width}`}),inbox=await h.api('/items',owner,{space:space.id,type:'folder',name:`Supplier arrivals ${width}`}),tax=await h.api('/items',owner,{space:space.id,type:'folder',name:`Vendor records ${width}`}),file=await h.api('/items',owner,{parent:inbox.id,name:`Acme terms ${width}.docx`,base64:Buffer.from(docx()).toString('base64')});
  await page.goto(h.origin+'/app/filing/rules');const panel=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Preview a filing rule',exact:true})});
  await panel.getByLabel('File or folder to process').selectOption(file.id);await panel.getByLabel('Rename pattern',{exact:false}).fill('Filed {name}');await panel.getByLabel('Tag (optional)',{exact:true}).fill('Vendor due diligence');await panel.getByLabel('Move into').selectOption(tax.id);await panel.getByLabel('Create a separate copy').selectOption('convert');await shot(page,width,'configured');
  await press(page,panel.getByRole('button',{name:'Preview rule',exact:true}));assert.equal((await h.api(`/items/${file.id}`,owner)).item.parent,inbox.id);await shot(page,width,'preview');
  const plans=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Rule plans',exact:true})});await press(page,plans.getByRole('button',{name:'Approve this plan',exact:true}).first());assert.equal((await h.api(`/items/${file.id}`,owner)).item.parent,tax.id);await shot(page,width,'applied');
  await press(page,plans.getByRole('button',{name:'Undo this plan',exact:true}).first());assert.equal((await h.api(`/items/${file.id}`,owner)).item.parent,inbox.id);await shot(page,width,'undone');await context.close();
 }
 console.log('RULE-001 browser preview, apply and Undo at 1440/390 passed');
}finally{await browser?.close();await h.close()}
