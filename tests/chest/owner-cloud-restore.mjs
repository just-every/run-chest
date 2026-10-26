// Continue the cloud leg with the actual private archive and observed server graph.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {browserHome,receiveSecrets,waitForFile,rerCommand} from './owner-process.mjs';
import {cloudJourney} from './owner-cloud.mjs';
await receiveSecrets();browserHome();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
console.log('OWN_CLOUD_INPUT_READY '+JSON.stringify({root:process.cwd(),head}));
const data=JSON.parse(await waitForFile('test-results/owner-server-data.json'));
await waitForFile('exports/server.rer');
await rerCommand(['install']);
await rerCommand(['setup','--owner-email',process.env.TEST_MAIL_TO,'--non-interactive']);
await rerCommand(['build']);
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
try{await cloudJourney({browser,head,ownerEmail:process.env.TEST_MAIL_TO,memberEmail:'qa-inbox-2@runeditrun.com',from:process.env.SENDGRID_FROM_EMAIL,...data});}
finally{await browser.close();}
await rerCommand(['run','typecheck']);await rerCommand(['check','--profile','first-party']);
for(const test of ['integrations.mjs','backup-archive.mjs']){
 const {spawn}=await import('node:child_process');
 const child=spawn(process.execPath,['tests/chest/'+test],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output=(output+chunk).slice(-8000)});child.stderr.on('data',chunk=>{output=(output+chunk).slice(-8000)});
 assert.equal(await new Promise(resolve=>child.once('close',resolve)),0,'Touched integration journey '+test+' passed; private diagnostics withheld.');
 console.log('OWN_TOUCHED_TEST_PASS '+test);
}
console.log('OWN_CLOUD_JOURNEY_PASS '+head);
