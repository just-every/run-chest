// Destructive only inside an explicitly designated, genuine fresh test clone.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {access,mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {command,serving,key} from './local.mjs';
import {browserFlow} from './browser-flow.mjs';
import {restoreJourney} from './restore.mjs';
import {firstRunJourney} from './first-run.mjs';
assert.equal(process.env.CHEST_TEST_CHECKOUT,'1','Set CHEST_TEST_CHECKOUT=1 only in a disposable fresh git clone');
const root=process.cwd();try{await access('.dev.vars');throw Error('Journey requires an unconfigured fresh clone')}catch(e){if(e.code!=='ENOENT')throw e}
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const origin=`http://127.0.0.1:${port}`;
const scratch=await mkdtemp(join(tmpdir(),'chest-restore-')),target=join(scratch,'target');let server,browser,ownerPage,expected,oldCookie;
try{
 await firstRunJourney(root,port);
 await command(root,['describe']);await command(root,['check','--profile','first-party']);await command(root,['install']);
 await command(root,['setup','--owner-email','owner@example.test','--port',String(port)]);const privateBefore=await readFile('.dev.vars','utf8');await command(root,['setup','--owner-email','owner@example.test','--port',String(port)]);assert.ok(await readFile('.dev.vars','utf8')===privateBefore,'setup preserves private settings');
 server=await serving(root,'dev',port);const devKey=await key(root);browser=await chromium.launch({channel:'chromium',headless:true});await mkdir('test-results',{recursive:true});let result;
 for(const width of [1440,390])result=await browserFlow({browser,origin,devKey,width});
 ({expected,oldCookie}=result);await browser.close();browser=null;await server.stop();server=null;
 await command(root,['build']);server=await serving(root,'preview',port);assert.equal((await fetch(origin+'/health')).status,200);await server.stop();server=null;
 await restoreJourney({root,target,port,oldCookie,expected,oldMemberCookie:result.oldMemberCookie,reviewerEmail:result.reviewerEmail,reviewerPersona:result.reviewerPersona,custody:result.custody});await command(root,['deploy','--dry-run']);await command(root,['reset'],{refuse:true});await command(root,['reset','--yes']);await command(root,['setup','--owner-email','owner@example.test','--port',String(port)]);server=await serving(root,'dev',port);const newKey=await key(root);const entered=await fetch(origin+'/auth/dev/enter?as=member',{redirect:'manual',headers:{'x-rer-dev-key':newKey}});assert.equal(entered.status,303);const devCookie=entered.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');const session=await(await fetch(origin+'/auth/session',{headers:{cookie:devCookie}})).json();assert.equal(session.kind,'dev');assert.equal(session.operator.email,'member@dev.localhost');assert.equal((await fetch(origin+'/__dev/personas')).status,404);const library=await(await fetch(origin+'/api/chest/library',{headers:{cookie:devCookie}})).json();assert.equal(library.count,0);await server.stop();server=null;console.log('Responsive dev-identity browser journey passed at 1440 and 390; setup/dev/build/preview/export/import used real RER verbs.');
}finally{await browser?.close();await server?.stop();await rm(scratch,{recursive:true,force:true})}
