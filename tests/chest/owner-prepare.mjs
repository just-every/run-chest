// Run the independently available preparation while the Linux fleet host is held.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {computerJourney} from './owner-computer.mjs';
import {rerCommand} from './owner-process.mjs';

assert.equal(process.platform,'darwin');
process.env.TEST_MAIL_TO='synthetic-chest-1@example.test';await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});let server;
try {
 await computerJourney(browser,49719);
 await rerCommand(['run','typecheck']);await rerCommand(['check','--profile','first-party']);
 for(const test of ['integrations.mjs','backup-archive.mjs','site.mjs']){
  const child=spawn(process.execPath,['tests/chest/'+test],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output=(output+chunk).slice(-12000)});child.stderr.on('data',chunk=>{output=(output+chunk).slice(-12000)});
  const code=await new Promise(resolve=>child.once('close',resolve));
  if(code!==0)throw Error('Touched journey '+test+' failed: '+output.replace(/https?:\/\/[^\s"<>]+/g,'[address withheld]').slice(-6000));
  console.log('OWN_TOUCHED_TEST_PASS '+test);
 }
 const root=resolve('dist/site');
 server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;assert.ok(!path.includes('..'));const file=join(root,path==='/'?'index.html':path);let bytes;try{bytes=await readFile(file)}catch{bytes=await readFile(file+'.html')}res.setHeader('content-type',file.endsWith('.css')?'text/css':/\.(woff2|png|svg)$/.test(file)?'application/octet-stream':'text/html');res.end(bytes)}catch{res.statusCode=404;res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const page=await browser.newPage();
 for(const slug of ['server','getting-started'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});assert.equal((await page.goto(origin+'/docs/'+slug)).status(),200);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'installation documentation fits its viewport');
  await page.screenshot({path:`test-results/owner-docs-${slug}-${width}.png`,fullPage:true});
 }
 console.log('OWN_PREPARATION_PASS macOS owner install, touched journeys and documentation at 1440 and 390.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
