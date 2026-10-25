// Explicit live-account journey; never runs in push Verify and never uses dev identity.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,chmod,readFile,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import {cloudResources,deploymentEnvironment,rer} from './hosted-cloud.mjs';
import {emailSignIn,waitForMailLink} from './hosted-mail.mjs';
import {hostedClient,createHostedData,snapshotHostedData,reconcileHostedOriginals} from './hosted-data.mjs';
import {hostedScreens} from './hosted-screens.mjs';

for(const name of ['CLOUDFLARE_API_TOKEN','SENDGRID_API_KEY','SENDGRID_FROM_EMAIL','TEST_MAIL_TO','QA_INBOX_RECEIPT_TOKEN'])assert.ok(process.env[name],`${name} must be supplied by the held-key injector`);
assert.equal(process.env.CHEST_TEST_HOSTED,'1','explicitly authorize this destructive disposable hosted journey');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','commit the exact candidate before the hosted journey');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const ownerEmail=process.env.TEST_MAIL_TO,memberEmail='qa-inbox-2@runeditrun.com',from=process.env.SENDGRID_FROM_EMAIL;
assert.notEqual(ownerEmail.toLowerCase(),memberEmail,'the owner and invited member must have separate routed QA mailboxes');
// Check the real reader before creating any provider resources.
const inbox=await fetch('https://rer-qa-inbox.runeditrun.workers.dev/receipts?limit=1',{headers:{authorization:`Bearer ${process.env.QA_INBOX_RECEIPT_TOKEN}`}});
assert.equal(inbox.status,200,'QA_INBOX_RECEIPT_TOKEN can read delivered mail');await inbox.body?.cancel();
const environment='sx-i812-'+randomUUID().slice(0,8),resources=await cloudResources(environment);
const directory=await mkdtemp(join(tmpdir(),'chest-hosted-lifecycle-'));await chmod(directory,0o700);
const backup=join(directory,'backup'),env=deploymentEnvironment(ownerEmail),mails=[];
let browser,owner,member,origin,expected,beforeOwner,beforeMember,passed=false,failure;
await mkdir('test-results',{recursive:true});
console.log(`Hosted lifecycle ${environment} on ${head}`);
try {
 origin=await resources.deploy(env);console.log('Hosted deploy and resource readback passed.');
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 owner=await emailSignIn({browser,origin,email:ownerEmail,from});mails.push(owner.receipt.id);
 console.log('Hosted owner email sign-in passed.');
 const ownerClient=hostedClient(origin,owner.context),inviter=(await ownerClient.api('/files')).me,since=Date.now();
 await ownerClient.api('/people',{action:'invite',email:memberEmail,name:'Harbor colleague'});
 const invitation=await waitForMailLink({to:memberEmail,subject:`${inviter.name} (${inviter.email}) invited you to Chest`,since,origin,from});mails.push(invitation.receipt.id);
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();member={context,page};
 await page.goto(invitation.url);await page.getByRole('button',{name:'Confirm',exact:true}).click();
 await page.waitForURL(url=>url.origin===origin&&url.pathname==='/app/files');
 const memberClient=hostedClient(origin,context);
 assert.equal((await (await context.request.get(origin+'/auth/session')).json()).operator.email,memberEmail,'the invitation email establishes the invited identity');
 console.log('Hosted invitation delivery and acceptance passed.');
 expected=await createHostedData(ownerClient,memberClient,ownerEmail,memberEmail,environment);
 beforeOwner=await snapshotHostedData(ownerClient,expected);beforeMember=await snapshotHostedData(memberClient,expected);
 console.log('Hosted-only tree, versions, grants, link count, request and 150 MB original created.');
 await owner.context.close();owner=null;await member.context.close();member=null;
 await rer(['run','hosted-backup','--environment',environment,'--output',backup],env);
 assert.equal((await stat(backup)).mode&0o077,0,'the hosted backup is private');
 const manifest=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8'));
 const sql=await readFile(join(backup,'database.sql'),'utf8'),objects=await readdir(join(backup,'objects'));
 for(const value of [environment,expected.space,expected.parent,expected.folder,expected.trash,expected.link,expected.request,expected.checksum,...[expected.library.document,expected.library.collection,expected.library.schema]])assert.ok(sql.includes(value),'the private backup holds the data created only on the hosted installation');
 assert.ok(objects.includes(expected.checksum));assert.ok(manifest.bytes>=expected.size);assert.equal(manifest.objects,objects.length);
 console.log('Hosted backup contains the hosted-only graph and original.');
 await resources.remove(env);console.log('First removal read back no Worker, database or bucket.');
 Object.assign(env,deploymentEnvironment(ownerEmail));
 const freshOrigin=await resources.deploy(env);assert.equal(freshOrigin,origin);
 await rer(['run','hosted-restore','--environment',environment,'--input',backup,'--acknowledge-offline-erasures'],env);
 console.log('Fresh deployment and hosted restore passed.');
 owner=await emailSignIn({browser,origin,email:ownerEmail,from});mails.push(owner.receipt.id);
 member=await emailSignIn({browser,origin,email:memberEmail,from});mails.push(member.receipt.id);
 const restoredOwner=hostedClient(origin,owner.context),restoredMember=hostedClient(origin,member.context);
 assert.deepEqual(await snapshotHostedData(restoredOwner,expected),beforeOwner,'the complete named owner graph reconciles after fresh email sign-in');
 assert.deepEqual(await snapshotHostedData(restoredMember,expected),beforeMember,'the complete named member graph and grants reconcile after fresh email sign-in');
 await reconcileHostedOriginals(restoredOwner,expected);await reconcileHostedOriginals(restoredMember,expected);
 await hostedScreens(owner.page,origin,expected,'owner');await hostedScreens(member.page,origin,expected,'member');
 const publicRequest=await fetch(expected.requestUrl);assert.equal(publicRequest.status,200);await publicRequest.body?.cancel();
 const publicLink=await fetch(expected.linkUrl);assert.equal(publicLink.status,200);await publicLink.body?.cancel();
 console.log(`Hosted restore reconciled both identities and the original SHA-256 ${expected.checksum}; screens passed at 1440 and 390.`);
 passed=true;
} catch(error) {
 failure=String(error.message).replace(/https?:\/\/[^\s"<>]+/g,'[address withheld]');
 for(const value of Object.values(env))if(typeof value==='string'&&value.length>6)failure=failure.replaceAll(value,'[withheld]');
} finally {
 await owner?.context.close();await member?.context.close();await browser?.close();
 try {await resources.remove(env);console.log('Final removal read back no Worker, database or bucket.');}
 finally {await rm(directory,{recursive:true,force:true});}
}
if(failure)throw Error(failure);
assert.ok(passed);
console.log(JSON.stringify({journey:'Hosted Chest email backup restore and removal',head,environment,mailReceiptIds:mails,originalBytes:expected.size,originalSha256:expected.checksum,resourcesRemoved:true}));
