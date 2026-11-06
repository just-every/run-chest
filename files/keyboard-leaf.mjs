// External, report-only comparison: same public fixture and unmodified tabTo/focusProof.
// Run from a committed Chest checkout. Never writes product files.
import assert from 'node:assert/strict';
import {writeFile, copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {tabTo} from './keyboard-leaf-helpers.mjs';
const {chromium} = await import(pathToFileURL(process.cwd() + '/node_modules/@playwright/test/index.mjs'));
const {harness} = await import(pathToFileURL(process.cwd() + '/tests/chest/harness.mjs'));
const label = process.argv[2];
assert.ok(['candidate', 'main'].includes(label));
const mode = process.argv[3] || 'standard';
assert.ok(['standard','isolated'].includes(mode));
const height = mode === 'isolated' ? 8000 : 1000;
const output = name => fileURLToPath(new URL(label + '-' + (mode === 'isolated' ? 'isolated-' : '') + name, import.meta.url));
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {encoding:'utf8'}).trim(), '', 'comparison uses committed product source');
const h = await harness();
let browser;
const receipt={label, head, width:1440, height, targetName:'Open safe text preview', exact:true, node:process.version};
try {
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);
 const owner = await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 await h.api('/people',owner,{action:'invite',email:'ana@example.test',name:'Ana'});
 const cookie=await h.signIn('ana@example.test',true);
 const api=(path, body)=>h.api(path,cookie,body);
 const personal=(await api('/files')).personal;
 const project=await api('/items',{space:personal,type:'folder',name:'synthetic-chest-47-1440'});
 const client=await api('/items',{parent:project.id,type:'folder',name:'Harbor launch'});
 const folder=await api('/items',{parent:client.id,type:'folder',name:'Delivery originals'});
 const file=await api('/items',{parent:folder.id,name:'delivery-checklist.txt',base64:Buffer.from('synthetic-chest-47: signed delivery checklist, initial original.').toString('base64')});
 await api(`/items/${file.id}/versions`,{filename:'delivery-checklist.txt',base64:Buffer.from('synthetic-chest-47: signed delivery checklist, revised original.').toString('base64')});
 await api('/items',{parent:folder.id,name:'packing-notes.md',base64:Buffer.from('synthetic-chest-47: packing notes retained beside the delivery checklist.').toString('base64')});
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height},ignoreHTTPSErrors:true});
 await context.addCookies(cookie.split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));
 const page=await context.newPage();
 await page.goto(h.origin+`/app/items/${folder.id}`);
 await tabTo(page,page.getByRole('main').getByRole('link',{name:'delivery-checklist.txt',exact:true}));
 await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')]);
 await page.evaluate(()=>document.fonts.ready);
 receipt.originals=(await api(`/items/${file.id}`)).versions.map(v=>({filename:v.filename,preview:v.preview,size:v.size,checksum:v.checksum}));
 const target=page.getByRole('link',{name:'Open safe text preview',exact:true}).first();
 receipt.targetCount=await target.count();
 receipt.previewLinks=await page.getByRole('link',{name:'Preview',exact:true}).evaluateAll(elements=>elements.map(e=>({text:e.textContent,retainedOriginal:/\/bytes\//.test(e.pathname),download:e.searchParams?.get('download')??null})));
 receipt.textPreviewFrames=await page.locator('iframe[title="Preview of delivery-checklist.txt"]').count();
 const focus=[];
 await page.exposeFunction('recordFocus', element=>focus.push(element));
 await page.evaluate(()=>document.addEventListener('focusin',event=>window.recordFocus({tag:event.target.tagName,text:(event.target.getAttribute('aria-label')||event.target.textContent).trim().slice(0,100)})));
 await page.screenshot({path:output('leaf-1440.png'),fullPage:true});
 try {await tabTo(page,target);receipt.result='passed'}
 catch(error){receipt.result='failed';receipt.assertion=error.message;receipt.code=error.code;receipt.active=await page.locator(':focus').evaluate(e=>e.outerHTML);}
 receipt.focusEvents=focus;
 receipt.tabFocusEvents=focus.length;
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:output('leaf-390.png'),fullPage:true});
 await writeFile(output('leaf-receipt.json'), JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
 if(receipt.result==='failed')process.exitCode=1;
} finally {await browser?.close();await h.close()}
