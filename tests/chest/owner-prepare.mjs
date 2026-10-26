// Run the independently available preparation while the Linux fleet host is held.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {computerJourney} from './owner-computer.mjs';
import {browserHome,rerCommand,waitForFile,running,ready,loopback} from './owner-process.mjs';

assert.equal(process.platform,'darwin');
process.env.TEST_MAIL_TO='synthetic-chest-1@example.test';await mkdir('test-results',{recursive:true});
browserHome();
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});let server;
try {
 if(process.env.CHEST_DOCS_ONLY!=='1'){
 await computerJourney(browser,49719);
 const wrongTarget=running(['export','--origin','https://hosted.example.com','--output','exports/wrong-target.rer']);
 assert.equal(await wrongTarget.closed,4,'an origin cannot relabel a local export as a hosted backup');
 await assert.rejects(stat('exports/wrong-target.rer'),{code:'ENOENT'});
 const production=running(['run','server'],{...process.env,AUTH_ORIGIN:'https://files.example.com',CHEST_SERVER_PORT:'49720',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'synthetic-chest-1@example.com',SENDGRID_API_KEY:'synthetic-chest-1',CHEST_OUTBOUND_HOSTS:'api.sendgrid.com'});
 try {
  await ready(production,'CHEST_SERVER_READY');
  const request=path=>loopback(49720,path,'files.example.com');
  assert.equal((await request('/health')).status,200);
  assert.equal((await request('/signin')).status,200);
  for(const path of ['/__dev/key','/auth/dev/enter','/cdn-cgi/explorer','/exports/server.rer'])assert.equal((await request(path)).status,404);
  assert.equal((await loopback(49720,'/health','other.example.com')).status,421);
  console.log('OWN_SERVER_COMMAND_PASS built production runtime, configured origin and private-door refusal.');
 }finally{await production.stop();}
 await rerCommand(['run','typecheck']);await rerCommand(['check','--profile','first-party']);
 for(const test of ['integrations.mjs','backup-archive.mjs','site.mjs']){
  const child=spawn(process.execPath,['tests/chest/'+test],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output=(output+chunk).slice(-12000)});child.stderr.on('data',chunk=>{output=(output+chunk).slice(-12000)});
  const code=await new Promise(resolve=>child.once('close',resolve));
  if(code!==0)throw Error('Touched journey '+test+' failed: '+output.replace(/https?:\/\/[^\s"<>]+/g,'[address withheld]').slice(-6000));
  console.log('OWN_TOUCHED_TEST_PASS '+test);
 }
 }else await rerCommand(['build','--site']);
 const root=resolve('dist/site');
 server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;assert.ok(!path.includes('..'));const file=join(root,path==='/'?'index.html':path);let bytes;try{bytes=await readFile(file)}catch{bytes=await readFile(file+'.html')}res.setHeader('content-type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.woff2')?'font/woff2':'text/html');res.end(bytes)}catch{res.statusCode=404;res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const page=await browser.newPage();
 for(const slug of ['server','getting-started','hosting'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});assert.equal((await page.goto(origin+'/docs/'+slug)).status(),200);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'installation documentation fits its viewport');
  await page.screenshot({path:`test-results/owner-docs-${slug}-${width}.png`,fullPage:true});
 }
 console.log('OWN_PREPARATION_PAGES '+process.cwd());
 if(process.env.CHEST_COLLECT_SCREENS==='1')await waitForFile('test-results/owner-pages-collected',300000);
 console.log(process.env.CHEST_DOCS_ONLY==='1'?'OWN_DOCS_PASS installation documentation at 1440 and 390.':'OWN_PREPARATION_PASS macOS owner install, touched journeys and documentation at 1440 and 390.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
