import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {diffArchives} from '@runeditrun/rer/internal/modules/portability/diff.mjs';
import {cloudResources,deploymentEnvironment} from './hosted-cloud.mjs';
import {rerCommand} from './owner-process.mjs';
import {emailSignIn,waitForMailLink} from './hosted-mail.mjs';
import {hostedClient,snapshotHostedData,reconcileHostedOriginals} from './hosted-data.mjs';
import {hostedScreens} from './hosted-screens.mjs';
import {proveIndependent} from './owner-egress.mjs';

export async function cloudJourney({browser,head,ownerEmail,memberEmail,from,expected,beforeOwner,beforeMember,mails=[]}) {
 const environment='sx-i814-'+head.slice(0,8),env=deploymentEnvironment(ownerEmail);
 env.CHEST_OUTBOUND_HOSTS='api.sendgrid.com';
 const resources=await cloudResources(environment);let cloudOrigin,owner,member,passed=false;
 try {
 cloudOrigin=await resources.deploy(env);
 await rerCommand(['import','--target','remote','--origin',cloudOrigin,'--input','exports/server.rer','--yes'],env);
 await rerCommand(['export','--target','remote','--origin',cloudOrigin,'--output','exports/cloud.rer'],env);
 const difference=await diffArchives(Readable.toWeb(createReadStream('exports/server.rer')),Readable.toWeb(createReadStream('exports/cloud.rer')));
 assert.deepEqual(difference.tables,[],'every portable record survives the server to cloud move');
 assert.deepEqual(difference.objects,{added:[],removed:[],changed:[]},'every original and its metadata survives the server to cloud move');
 assert.equal(difference.schemaChanged,false);assert.equal(difference.configurationChanged,false);
 console.log('OWN_ARCHIVE_RECONCILED all portable records and original hashes match.');
 owner=await emailSignIn({browser,origin:cloudOrigin,email:ownerEmail,from});mails.push(owner.receipt.id);
 const cloudOwner=hostedClient(cloudOrigin,owner.context);
 const operators=await owner.context.request.get(cloudOrigin+'/auth/operators');assert.equal(operators.status(),200);
 assert.equal((await operators.json()).some(person=>person.email===memberEmail),false,'portable people do not acquire authentication authority');
 const since=Date.now();
 await cloudOwner.api('/people',{action:'invite',email:memberEmail,name:'Harbor colleague'});
 const invitation=await waitForMailLink({to:memberEmail,subject:`Chest operations test (${ownerEmail}) invited you to Chest`,since,origin:cloudOrigin,from});mails.push(invitation.receipt.id);
 const invited=await browser.newContext(),invitePage=await invited.newPage();
 try{
  await invitePage.goto(invitation.url);await invitePage.getByRole('button',{name:'Confirm',exact:true}).click();await invitePage.waitForURL('**/app/files');
  assert.equal((await (await invited.request.get(cloudOrigin+'/auth/session')).json()).operator.email,memberEmail,'the target owner explicitly admits the restored staff identity');
 }catch{throw Error('Delivered cloud invitation did not establish the staff identity.');}
 finally{await invited.close();}
 member=await emailSignIn({browser,origin:cloudOrigin,email:memberEmail,from});mails.push(member.receipt.id);
 const cloudMember=hostedClient(cloudOrigin,member.context);
 assert.deepEqual(await snapshotHostedData(cloudOwner,expected),beforeOwner);
 assert.deepEqual(await snapshotHostedData(cloudMember,expected),beforeMember);
 await reconcileHostedOriginals(cloudOwner,expected);await reconcileHostedOriginals(cloudMember,expected);
 await hostedScreens(owner.page,cloudOrigin,expected,'cloud-owner');await hostedScreens(member.page,cloudOrigin,expected,'cloud-member');
 await proveIndependent(cloudOwner,expected.folder,'cloud');
 console.log('OWN_CLOUD_RECONCILED '+JSON.stringify({head,environment,originalSha256:expected.checksum,mailReceiptIds:mails}));passed=true;
 }finally{await owner?.context.close();await member?.context.close();await resources.remove(env);console.log('OWN_CLOUD_REMOVED '+JSON.stringify({environment,passed}));}
}
