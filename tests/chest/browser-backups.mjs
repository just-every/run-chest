// RECOVER-002: an owner configures, pauses and requests independent backups without giving Chest the archive key.
import assert from 'node:assert/strict';
import{mkdir}from'node:fs/promises';
import{chromium,expect}from'@playwright/test';
import{harness}from'./harness.mjs';
const h=await harness();let browser;
const stamp=new Date().toISOString();
const press=async(page,button)=>Promise.all([page.waitForNavigation(),button.click()]);
async function shot(page,width,name){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits '+width);await page.locator('#independent-backups').screenshot({path:`test-results/${width}-backups-${name}.png`})}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});await h.api('/people',owner,{action:'invite',email:'dana@example.test',name:'Dana Lee'});const staff=await h.signIn('dana@example.test',true);await h.api('/backups',staff,undefined,403);await h.api('/backups',staff,{enabled:true,everyHours:24,retentionDays:30,bucket:'owner-recovery'},403);
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of[1440,390]){
  const context=await browser.newContext({viewport:{width,height:960},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const page=await context.newPage();await page.goto(h.origin+'/app/administration#independent-backups');const card=page.locator('#independent-backups');
  await card.locator('select[name=enabled]').selectOption('true');await card.getByLabel('Backup interval (hours)').fill('12');await card.getByLabel('Keep backups (days)').fill('45');await card.getByLabel('Independent backup bucket').fill('harbor-independent-recovery');await press(page,card.getByRole('button',{name:'Save backup schedule'}));const settings=(await h.api('/backups',owner)).settings;assert.equal(settings.everyHours,12);assert.equal(settings.retentionDays,45);assert.equal(settings.enabled,true);await shot(page,width,'scheduled');
  if(width===1440){
   // These are the durable results written by the separate runner, whose CLI journey covers production of them.
   for(const [id,kind,payload] of [
    ['synthetic-chest-20','backup-run',{state:'complete',at:'2026-10-20T12:00:00.000Z',finishedAt:'2026-10-20T12:00:30.000Z',checkedAt:'2026-10-20T12:00:30.000Z',key:'chest-independent/production/retained.chestenc',bytes:68300000,objects:24,sha256:'a'.repeat(64)}],
    ['synthetic-chest-21','backup-run',{state:'failed',at:stamp,finishedAt:stamp}],
    ['backup-contact:runner','backup-contact',{at:stamp}]
   ])await h.sql('INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,?,?,?)',id,kind,JSON.stringify(payload),'synthetic-chest-22');
  }
  await page.reload();assert.ok((await h.api('/backups',owner)).lastSuccess);await expect(card.locator('li').filter({hasText:'failed'})).toBeVisible();await expect(card.locator('li').filter({hasText:'68300000 encrypted bytes'})).toBeVisible();await shot(page,width,'outcomes');
  await page.goto(h.origin+'/app/notices');await expect(page.getByText(/Independent backup did not complete \(failed\)/)).toBeVisible();await expect.poll(()=>h.mails.filter(m=>m.text.includes('Independent backup did not complete (failed)')).length).toBe(1);
  await page.goto(h.origin+'/app/administration#independent-backups');
  await press(page,card.getByRole('button',{name:'Request backup now'}));assert.ok((await h.api('/backups',owner)).settings.requestedAt);await shot(page,width,'requested');
  await card.locator('select[name=enabled]').selectOption('false');await press(page,card.getByRole('button',{name:'Save backup schedule'}));assert.equal((await h.api('/backups',owner)).settings.enabled,false);await card.locator('summary').click();await shot(page,width,'paused-instructions');await context.close();
 }
 const events=(await h.api('/audit',owner)).filter(r=>r.action==='backup.schedule');assert.ok(events.every(e=>{const d=JSON.parse(e.detail);return Object.hasOwn(d,'before')&&Object.hasOwn(d,'after')}));console.log('RECOVER-002 owner-only schedule, retention, manual request, pause, last success, failed-run notice and instructions passed at 1440/390');
}finally{await browser?.close();await h.close()}
