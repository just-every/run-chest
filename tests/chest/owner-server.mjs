import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {browserHome,receiveSecrets,running,ready,rerCommand,waitForFile} from './owner-process.mjs';
import {computerJourney} from './owner-computer.mjs';
import {ownerTunnel} from './owner-tunnel.mjs';

assert.equal(process.platform,'linux');await receiveSecrets();browserHome();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
let browser,tunnel,server;
try {
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 await computerJourney(browser,49717);await browser.close();browser=null;
 tunnel=await ownerTunnel(49718);
 const env={...process.env,AUTH_ORIGIN:tunnel.origin,MAIL_PROVIDER:'sendgrid',MAIL_FROM:process.env.SENDGRID_FROM_EMAIL,CHEST_SERVER_PORT:'49718',CHEST_OUTBOUND_HOSTS:'api.sendgrid.com'};
 server=running(['run','server'],env);await ready(server,'CHEST_SERVER_READY');
 assert.equal((await fetch('http://127.0.0.1:49718/health',{headers:{host:'own-test.run-chest.com'}})).status,200);
 for(const path of ['/__dev/key','/auth/dev/enter','/cdn-cgi/explorer','/exports/server.rer'])assert.equal((await fetch('http://127.0.0.1:49718'+path,{headers:{host:'own-test.run-chest.com'}})).status,404);
 assert.equal((await fetch('http://127.0.0.1:49718/health',{headers:{host:'untrusted.example.com'}})).status,421);
 console.log('OWN_SERVER_READY '+JSON.stringify({head,root:process.cwd(),origin:tunnel.origin}));
 await waitForFile('test-results/owner-server-export');await server.stop();server=null;
 await rerCommand(['export','--output','exports/server.rer']);
 console.log('OWN_SERVER_ARCHIVE '+JSON.stringify({root:process.cwd(),archive:'exports/server.rer'}));
 server=running(['run','server'],env);await ready(server,'CHEST_SERVER_READY');
 await waitForFile('test-results/owner-server-complete');
 console.log('OWN_SERVER_COMPLETE '+head);
}finally{await server?.stop();await browser?.close();await tunnel?.close();}
