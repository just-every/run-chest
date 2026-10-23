import {tooltips} from './tooltip-proof.mjs';
// SIGN-001 in a browser at 1440 and 390: request and place fields, the external signer's PIN, consent and signing,
// the staff signer, the filed versions, and the DOCX fidelity report before sending.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {harness} from './harness.mjs';
const h=await harness();let browser;
const cookies=c=>c.split('; ').map(v=>{const i=v.indexOf('=');return {name:v.slice(0,i),value:v.slice(i+1),url:h.origin}});
const go=async(page,button)=>{try{await Promise.all([page.waitForNavigation({timeout:15000}),page.getByRole('button',{name:button,exact:true}).click()])}catch(e){throw new Error(`${button}: ${e.message.split('\n')[0]} at ${page.url()}`)}};
async function contract(){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(let i=1;i<=2;i++){const p=doc.addPage([612,792]);p.drawText(`Services agreement page ${i}. The supplier delivers within thirty days of the order.`,{x:56,y:700,size:12,font});p.drawText('Signature of the supplier and the customer below.',{x:56,y:640,size:12,font})}return Buffer.from(await doc.save())}
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 await h.api('/people',owner,{action:'invite',email:'colleague@example.test',name:'Jordan Lee'});const colleague=await h.signIn('colleague@example.test',true);
 const space=(await h.api('/files',owner)).personal;
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  const viewport={width,height:900},fit=async(page,name)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fits ${width}px`);await page.screenshot({path:`test-results/${width}-signatures-${name}.png`,fullPage:true})};
  const file=await h.api('/items',owner,{space,name:`Services agreement ${width}.pdf`,base64:(await contract()).toString('base64')}),memo=await h.api('/items',owner,{space,name:`Memo ${width}.docx`,base64:(await readFile(new URL('./memo.docx',import.meta.url))).toString('base64')});
  const asOwner=await browser.newContext({viewport,ignoreHTTPSErrors:true});await asOwner.addCookies(cookies(owner));const p=await asOwner.newPage();
  // The requester: a file page card, the compose page, field placement and the send.
  await p.goto(h.origin+`/app/items/${file.id}`);await tooltips(p,width,'signature-file');await fit(p,'file');await go(p,'Request signatures');assert.match(p.url(),/\/app\/signatures\//);const compose=p.url();await fit(p,'compose');
  await p.locator('input[name="signerEmail:1"]').fill('ellis@outside.test');await p.locator('input[name="signerName:1"]').fill('Ellis Outside');await p.locator('input[name="signerEmail:2"]').fill('colleague@example.test');
  const sheet=p.locator('.sheet[data-sheet="1"]');await sheet.scrollIntoViewIfNeeded();
  await p.locator('[data-field-signer]').selectOption('ellis@outside.test');await sheet.click({position:{x:Math.round(width===1440?120:60),y:Math.round(width===1440?330:150)}});
  await p.locator('[data-field-signer]').selectOption('colleague@example.test');await sheet.click({position:{x:Math.round(width===1440?360:200),y:Math.round(width===1440?330:150)}});
  await p.locator('[data-field-type]').selectOption('date');await sheet.click({position:{x:Math.round(width===1440?120:60),y:Math.round(width===1440?400:200)}});
  assert.equal(await p.locator('[data-field-list] li').count(),3);assert.equal(await p.locator('.sheet .sfield').count(),3);await fit(p,'placed');
  await go(p,'Send for signature');assert.match(await p.locator('h1').innerText(),/Waiting for signatures/);await fit(p,'status');
  const invitation=h.mails.findLast(m=>[m.to].flat().includes('ellis@outside.test')),path=new URL(invitation.text.match(/https?:\/\/[^\s]+\/sign\/[^\s]+/)[0]).pathname;
  // The external signer: PIN, disclosure, signing page, adopt and sign.
  const external=await browser.newContext({viewport,ignoreHTTPSErrors:true}),s=await external.newPage();
  await s.goto(h.origin+path);await fit(s,'pin');assert.doesNotMatch(await s.locator('body').innerText(),/Services agreement page/);await go(s,'Email me a PIN');
  const pin=h.mails.findLast(m=>[m.to].flat().includes('ellis@outside.test')).text.match(/PIN is (\d{6})/)[1];await s.getByLabel('PIN').fill(pin);await go(s,'Verify');
  assert.match(await s.locator('body').innerText(),/withdraw your consent/);await fit(s,'consent');await go(s,'I agree to sign electronically');
  await fit(s,'sign');assert.match(await s.locator('body').innerText(),/Services agreement page 1/);assert.equal(await s.locator('.sfield.mine').count(),1);
  await s.getByLabel('Type your full name to adopt it as your signature').fill('Ellis Outside');await s.getByLabel(/I adopt this as my signature/).check();await go(s,'Adopt and sign');assert.match(await s.locator('h1').innerText(),/You have signed/);await fit(s,'signed');
  // The staff signer signs in as themselves.
  const staff=await browser.newContext({viewport,ignoreHTTPSErrors:true});await staff.addCookies(cookies(colleague));const t=await staff.newPage();
  const second=new URL(h.mails.findLast(m=>[m.to].flat().includes('colleague@example.test')&&/asked you to sign/.test(m.subject)).text.match(/https?:\/\/[^\s]+\/sign\/[^\s]+/)[0]).pathname;
  await t.goto(h.origin+second);await go(t,'I agree to sign electronically');await fit(t,'staff-sign');await t.getByLabel(/I adopt this as my signature/).check();await go(t,'Adopt and sign');assert.match(await t.locator('h1').innerText(),/Signed by everyone/);await fit(t,'completed');
  // The requester sees the outcome, the two new versions and can check the seal.
  await p.goto(compose);assert.match(await p.locator('h1').innerText(),/Completed/);assert.match(await p.locator('body').innerText(),/Filed as new versions/);await fit(p,'completed-status');
  await go(p,'Check seal: signed PDF');assert.match(await p.locator('h1').innerText(),/The seal is intact/);await fit(p,'seal');
  await p.goto(h.origin+`/app/items/${file.id}`);assert.match(await p.locator('body').innerText(),/Signed copy of version 1/);assert.match(await p.locator('body').innerText(),/Audit certificate of version 1/);await fit(p,'versions');
  // A DOCX shows its fidelity report before anything is sent.
  await p.goto(h.origin+`/app/items/${memo.id}`);await go(p,'Request signatures');assert.match(await p.locator('body').innerText(),/Fidelity report/);assert.match(await p.locator('body').innerText(),/Rendered \d+ page/);await fit(p,'fidelity');
  await external.close();await staff.close();await asOwner.close();
 }
 console.log('SIGN-001 request, placement, PIN, consent, signing, filing and DOCX fidelity browser journey at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
