import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {generate,inventoryTarget} from '../../scripts/scale/generator.mjs';
import {tooltips} from './tooltip-proof.mjs';
import {enumerate} from './scale-sync.mjs';
const h=await harness();let browser;
// Model distinct client addresses at the runtime's trusted network edge, as in
// the existing 150-person installation journey. Authentication limits stay on.
let invitations=0;
async function generationApi(path,cookie,body){
 if(path!=='/people')return h.api(path,cookie,body);
 const response=await h.fetch('/api/chest/people',{method:'POST',headers:{cookie,origin:h.origin,'content-type':'application/json','CF-Connecting-IP':`198.51.100.${1+Math.floor(invitations++/25)}`},body:JSON.stringify(body)});
 assert.equal(response.status,200,'public invitation succeeds with authentication limits enabled');return response.json();
}
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),samples={listing:[],deepOpen:[],search:[],catchUp:[],enumeration:[]};
async function timed(name,fn){const start=performance.now();const value=await fn();samples[name].push(performance.now()-start);return value}
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Scale owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 assert.equal((await h.raw('/api/chest/administration/scale/health',owner)).status,503);
 const data=await generate({api:generationApi,owner,files:Number(process.env.CHEST_SCALE_FILES||60),depth:Number(process.env.CHEST_SCALE_DEPTH||8),directMembers:Number(process.env.CHEST_SCALE_DIRECT_MEMBERS||0),devices:Number(process.env.CHEST_SCALE_DEVICES||0)}),member=await h.signIn(data.sessions[0],true);
 const wide=await h.api(`/items/${data.folders[0]}`,owner),deep=await h.api(`/items/${data.folders.at(-1)}`,owner);assert.equal(data.counts.largestFolder,Math.max(wide.children.length,deep.children.length),'recorded folder size equals admitted direct children');
 const device=await h.api('/devices',member,{name:'Offline measurement device',platform:'linux'});await h.api('/devices',owner,{name:'Enumeration device',platform:'linux'});data.counts.devices+=2;
 const registered=await h.api('/devices',owner);assert.equal(registered.length,data.counts.devices);assert.equal(new Set(registered.map(d=>d.id)).size,data.counts.devices);
 if(data.membersSpace){const last=data.membersSpace.members.at(-1).principal,lastSession=await h.signIn(last,true),roster=await h.api(`/spaces/${data.membersSpace.id}`,lastSession);assert.equal(roster.role,'viewer');assert.equal(roster.members.length,Number(process.env.CHEST_SCALE_DIRECT_MEMBERS))}
 const sync=async path=>{const r=await h.fetch('/api/chest/sync'+path,{headers:{authorization:`Bearer ${device.token}`}});assert.equal(r.status,200);return r.json()};
 const start=await timed('enumeration',()=>enumerate(sync,data));
 assert.equal(data.counts.depth,Number(process.env.CHEST_SCALE_DEPTH||8)+1);
 if(data.membersSpace)assert.equal(data.membersSpace.members.length,Number(process.env.CHEST_SCALE_DIRECT_MEMBERS));
 for(let n=0;n<10;n++){await timed('listing',async()=>{const d=await h.api(`/items/${data.folders[0]}`,member);assert.ok(d.children.length)});await timed('deepOpen',async()=>{const d=await h.api(`/items/${data.folders.at(-1)}`,member);assert.ok(d.children.some(i=>i.id===data.originals[0].id))})}
 for(let n=0;n<50;n++)await timed('search',async()=>{const result=await h.api(`/search?q=${encodeURIComponent(`invoice ${n%data.originals.length}`)}`,member);assert.ok(result.count>0)});
 const changeCount=Number(process.env.CHEST_SCALE_CHANGES||20),changed=await data.applyChanges(changeCount);
 assert.equal(data.counts.changes,changeCount);
 await timed('catchUp',async()=>{let cursor=start.cursor,more=true,until;const seen=new Map();while(more){const feed=await sync(`/changes?cursor=${cursor}${until===undefined?'':`&until=${until}`}`);until??=feed.until;assert.equal(feed.until,until);assert.ok(feed.cursor>=cursor);for(const c of feed.changes)if(c.state==='present')seen.set(c.id,c.item);assert.ok(!feed.more||feed.cursor>cursor);cursor=feed.cursor;more=feed.more}assert.equal(cursor-start.cursor,changeCount,'every completed remote change advances the durable journal');assert.deepEqual([...seen.keys()].sort(),changed.map(i=>i.id).sort());for(const original of changed){const index=data.originals.indexOf(original),last=index+Math.floor((changeCount-1-index)/data.originals.length)*data.originals.length;assert.equal(seen.get(original.id).name,`Updated invoice ${index} change ${last+1}.txt`)}});
 const file=await h.api(`/items/${data.originals[0].id}`,member),download=`/api/chest/items/${data.originals[0].id}/bytes/${file.item.current}?download=true`;
 assert.equal(await(await h.raw(download,member)).text(),data.originals[0].body.toString());
 const pausedPage=await sync('/tree?limit=1');assert.ok(pausedPage.next);
 await h.api(`/groups/${data.group.id}/members`,owner,{action:'remove',email:data.sessions[0]});
 await h.api(`/items/${data.folders[0]}`,member,undefined,403);
 assert.equal((await h.api('/search?q=invoice',member)).count,0);
 assert.equal((await h.raw(download,member)).status,403);
 assert.equal((await h.fetch(`/api/chest/sync/items/${data.originals[0].id}/content`,{headers:{authorization:`Bearer ${device.token}`}})).status,403);
 let after=pausedPage.next;do{const tree=await sync(`/tree?limit=31&cursor=${pausedPage.cursor}&after=${after}`);assert.equal(tree.items.length,0,'continuation rechecks the revoked group');after=tree.next}while(after);
 const inventory=process.env.CHEST_SCALE_INVENTORY?JSON.parse(await readFile(process.env.CHEST_SCALE_INVENTORY,'utf8')):null;
 const report={head,seed:'synthetic-chest-895',counts:data.counts,samples,environment:{region:'Local cloud VM; region unverified',mbps:0,usRegion:false,measuredNetwork:false},revocation:{list:true,search:true,download:true,sync:true}};
 await h.api('/administration/scale',member,report,403);
 await h.api('/administration/scale',owner,{...report,samples:{...samples,search:[]}},400);
 const slow=await h.api('/administration/scale',owner,{...report,samples:{...samples,listing:Array(10).fill(1001)}});assert.equal(slow.timings.listing.pass,false);assert.equal((await h.raw('/api/chest/administration/scale/health',owner)).status,503);
 const saved=await h.api('/administration/scale',owner,report);assert.equal(saved.pass,false);assert.equal(saved.timings.search.count,50);
 assert.equal((await h.raw('/api/chest/administration/scale/health',owner)).status,503);
 await h.stop();await h.start();assert.deepEqual((await h.api('/administration/scale',owner)).counts,data.counts);
 // A missed timing remains failing even on a bounded run, without replacing its actual measurements.
 assert.ok(Object.values(saved.timings).every(t=>Number.isFinite(t.p50)&&Number.isFinite(t.p95)));
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHEST_CHROMIUM||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin,secure:true}}));const page=await context.newPage();await page.goto(h.origin+'/app/administration');await page.getByRole('link',{name:'Operating scale',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-scale-administration.png`,fullPage:true});await page.getByRole('link',{name:'Operating scale',exact:true}).click();await page.getByRole('heading',{name:'Operating scale',exact:true}).waitFor();assert.ok(await page.getByText('Failing scale health check',{exact:true}).isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await tooltips(page,width,'scale');await page.screenshot({path:`test-results/${width}-scale.png`,fullPage:true});await context.close()}
 await writeFile('test-results/scale.json',JSON.stringify({source:head,enumeration:{pages:start.pages,items:start.items,metadataOnly:true},requestedTarget:inventoryTarget(inventory??{}),buyerInventorySupplied:!!inventory,result:saved,gaps:['Real reference installation and measured US 100 Mbps connection','Seven-day offline device and 10000 remote changes','500000-item initial enumeration without hydration','20000-child scrolling without a full reload','Buyer MIGRATE-001 inventory rerun']},null,2));
 console.log(JSON.stringify({head,counts:data.counts,timings:saved.timings,health:'failing: bounded data and unmeasured network',revocation:report.revocation}));
}finally{await browser?.close();await h.close()}
