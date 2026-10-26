import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';
import {browserHome,receiveSecrets,waitForFile,rerCommand} from './owner-process.mjs';
import {computerJourney} from './owner-computer.mjs';
import {cloudResources,deploymentEnvironment} from './hosted-cloud.mjs';
import {emailSignIn,waitForMailLink} from './hosted-mail.mjs';
import {hostedClient,createHostedData,snapshotHostedData,reconcileHostedOriginals} from './hosted-data.mjs';
import {hostedScreens} from './hosted-screens.mjs';
import {Readable} from 'node:stream';
import {createReadStream} from 'node:fs';
import {diffArchives} from '@runeditrun/rer/internal/modules/portability/diff.mjs';
import {proveIndependent} from './owner-egress.mjs';

assert.equal(process.platform,'darwin');await receiveSecrets();browserHome();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const ownerEmail=process.env.TEST_MAIL_TO,memberEmail='qa-inbox-2@runeditrun.com',from=process.env.SENDGRID_FROM_EMAIL;
const origin='https://own-test.run-chest.com',environment='sx-i813-'+head.slice(0,8),env=deploymentEnvironment(ownerEmail);
env.CHEST_OUTBOUND_HOSTS='api.sendgrid.com';
const resources=await cloudResources(environment);let browser,owner,member,expected,beforeOwner,beforeMember,cloudOrigin,passed=false;
const mails=[];
try {
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 await computerJourney(browser,49719);
 for(let n=0;;n++){try{const response=await fetch(origin+'/health');if(response.ok)break;await response.body?.cancel();}catch{}assert.ok(n<60,'the HTTPS server became reachable');await delay(2000);}
 owner=await emailSignIn({browser,origin,email:ownerEmail,from});mails.push(owner.receipt.id);
 const ownerClient=hostedClient(origin,owner.context),inviter=(await ownerClient.api('/files')).me,since=Date.now();
 await ownerClient.api('/people',{action:'invite',email:memberEmail,name:'Harbor colleague'});
 const invitation=await waitForMailLink({to:memberEmail,subject:`${inviter.name} (${inviter.email}) invited you to Chest`,since,origin,from});mails.push(invitation.receipt.id);
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();member={context,page};
 try{await page.goto(invitation.url);await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL('**/app/files');}catch{throw Error('Delivered server invitation did not establish the staff identity.');}
 const memberClient=hostedClient(origin,context);
 expected=await createHostedData(ownerClient,memberClient,ownerEmail,memberEmail,environment,{originalBytes:8*1024*1024});
 await proveIndependent(ownerClient,expected.folder,'server');
 await reconcileHostedOriginals(ownerClient,expected);await reconcileHostedOriginals(memberClient,expected);
 await hostedScreens(owner.page,origin,expected,'server-owner');await hostedScreens(member.page,origin,expected,'server-member');
 beforeOwner=await snapshotHostedData(ownerClient,expected);beforeMember=await snapshotHostedData(memberClient,expected);
 await writeFile('test-results/owner-server-data.json',JSON.stringify({expected,beforeOwner,beforeMember}),{mode:0o600});
 await owner.context.close();owner=null;await member.context.close();member=null;
 console.log('OWN_SERVER_DATA_READY '+JSON.stringify({head,root:process.cwd(),originalSha256:expected.checksum}));
 await waitForFile('exports/server.rer');
 cloudOrigin=await resources.deploy(env);
 await rerCommand(['import','--target','remote','--origin',cloudOrigin,'--input','exports/server.rer','--yes'],env);
 await rerCommand(['export','--target','remote','--origin',cloudOrigin,'--output','exports/cloud.rer'],env);
 const difference=await diffArchives(Readable.toWeb(createReadStream('exports/server.rer')),Readable.toWeb(createReadStream('exports/cloud.rer')));
 assert.deepEqual(difference.tables,[],'every portable record survives the server to cloud move');
 assert.deepEqual(difference.objects,{added:[],removed:[],changed:[]},'every original and its metadata survives the server to cloud move');
 assert.equal(difference.schemaChanged,false);assert.equal(difference.configurationChanged,false);
 console.log('OWN_ARCHIVE_RECONCILED all portable records and original hashes match.');
 owner=await emailSignIn({browser,origin:cloudOrigin,email:ownerEmail,from});mails.push(owner.receipt.id);
 member=await emailSignIn({browser,origin:cloudOrigin,email:memberEmail,from});mails.push(member.receipt.id);
 const cloudOwner=hostedClient(cloudOrigin,owner.context),cloudMember=hostedClient(cloudOrigin,member.context);
 assert.deepEqual(await snapshotHostedData(cloudOwner,expected),beforeOwner);
 assert.deepEqual(await snapshotHostedData(cloudMember,expected),beforeMember);
 await reconcileHostedOriginals(cloudOwner,expected);await reconcileHostedOriginals(cloudMember,expected);
 await hostedScreens(owner.page,cloudOrigin,expected,'cloud-owner');await hostedScreens(member.page,cloudOrigin,expected,'cloud-member');
 await proveIndependent(cloudOwner,expected.folder,'cloud');
 console.log('OWN_CLOUD_RECONCILED '+JSON.stringify({head,environment,originalSha256:expected.checksum,mailReceiptIds:mails}));passed=true;
}finally{await owner?.context.close();await member?.context.close();await browser?.close();await resources.remove(env);console.log('OWN_CLOUD_REMOVED '+JSON.stringify({environment,passed}));}

await rerCommand(['run','typecheck']);
await rerCommand(['check','--profile','first-party']);
const {spawn}=await import('node:child_process');
for(const test of ['integrations.mjs','backup-archive.mjs']){
 const child=spawn(process.execPath,['tests/chest/'+test],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output=(output+chunk).slice(-8000)});child.stderr.on('data',chunk=>{output=(output+chunk).slice(-8000)});
 const code=await new Promise(resolve=>child.once('close',resolve));
 assert.equal(code,0,'Touched integration journey '+test+' passed; private diagnostics withheld.');
 console.log('OWN_TOUCHED_TEST_PASS '+test);
}
