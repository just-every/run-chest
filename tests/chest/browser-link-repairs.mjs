// AGENT-005: a person reviews the scoped findings, declines, revokes and approves Undo on both screen sizes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const press=async(page,button)=>Promise.all([page.waitForNavigation(),button.click()]);
async function shot(page,width,name){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits '+width);await page.screenshot({path:`test-results/${width}-link-repairs-${name}.png`,fullPage:true})}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:960},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const page=await context.newPage(),anon=await browser.newContext({ignoreHTTPSErrors:true}),visitor=await anon.newPage();
  const space=await h.api('/spaces',owner,{name:`Harbor operations ${width}`}),folder=await h.api('/items',owner,{space:space.id,type:'folder',name:`Vendor contracts ${width}`});await h.api('/items',owner,{parent:folder.id,type:'file',name:'Acme delivery terms.txt',base64:Buffer.from('Payment within thirty days.').toString('base64')});const link=await h.api(`/items/${folder.id}/public-links`,owner,{});
  await page.goto(h.origin+'/app/links');await page.locator('details',{has:page.locator('summary',{hasText:'Link repair agent'})}).evaluate(d=>{d.open=true});const agent=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Link repair agent',exact:true})});await agent.getByLabel('File or folder to scan').selectOption(folder.id);await agent.getByLabel('Intended collaborator emails (optional)').fill('dana@example.test;luis@example.test');await press(page,agent.getByRole('button',{name:'Add scan scope',exact:true}));await shot(page,width,'findings');
  const scope=agent.locator('li').filter({has:page.locator('strong').filter({hasText:`Vendor contracts ${width}`})}).first();await press(page,scope.getByRole('button',{name:'Scan now',exact:true}));await press(page,scope.getByRole('button',{name:'Decline repair',exact:true}));assert.equal((await visitor.goto(link.url)).status(),200);await shot(page,width,'declined');
  await press(page,scope.getByRole('button',{name:'Revoke this link',exact:true}));assert.equal((await visitor.goto(link.url)).status(),410);await shot(page,width,'revoked');
  const history=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Link repair history',exact:true})});const receipt=history.locator('li').filter({hasText:`Vendor contracts ${width} · revoke`});await press(page,receipt.getByRole('button',{name:'Approve undo',exact:true}));assert.equal((await visitor.goto(link.url)).status(),200);await shot(page,width,'undone');
  // ADMIN-001 preserves explicit owner adoption while preventing automatic revival on reactivation.
  const email=`custodian-${width}@example.test`;await h.api('/people',owner,{action:'invite',email,name:'Departing custodian'});const staff=await h.signIn(email,true);await h.api(`/items/${folder.id}/shares`,owner,{principal:email,role:'editor'});const orphan=await h.api(`/items/${folder.id}/public-links`,staff,{});await h.api('/people',owner,{action:'deactivate',email});assert.equal((await visitor.goto(orphan.url)).status(),404);await h.api('/people',owner,{action:'reactivate',email});assert.equal((await visitor.goto(orphan.url)).status(),404,'reactivation cannot revive the old custody grant');
  await page.reload();await shot(page,width,'departed-custodian');await press(page,agent.getByRole('button',{name:'Approve new custodian',exact:true}));assert.equal((await visitor.goto(orphan.url)).status(),200,'only explicit owner adoption reauthorizes the link');await shot(page,width,'adopted-custodian');
  await context.close();await anon.close();
 }
 console.log('AGENT-005 browser scoped findings, decline, revoke and Undo at 1440/390 passed');
}finally{await browser?.close();await h.close()}
