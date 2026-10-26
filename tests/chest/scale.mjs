import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {generate,inventoryTarget} from '../../scripts/scale/generator.mjs';
import {tooltips} from './tooltip-proof.mjs';
const h=await harness();let browser;
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),samples={listing:[],deepOpen:[],search:[],catchUp:[],enumeration:[]};
async function timed(name,fn){const start=performance.now();const value=await fn();samples[name].push(performance.now()-start);return value}
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Scale owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 assert.equal((await h.raw('/api/chest/administration/scale/health',owner)).status,503);
 const data=await generate({api:h.api,owner,files:Number(process.env.CHEST_SCALE_FILES||60),depth:Number(process.env.CHEST_SCALE_DEPTH||8)}),member=await h.signIn(data.sessions[0],true);
 const device=await h.api('/devices',member,{name:'Offline measurement device',platform:'linux'});await h.api('/devices',owner,{name:'Enumeration device',platform:'linux'});data.counts.devices=2;
 const sync=async path=>{const r=await h.fetch('/api/chest/sync'+path,{headers:{authorization:`Bearer ${device.token}`}});assert.equal(r.status,200);return r.json()};
 const start=await timed('enumeration',()=>sync('/tree'));assert.ok(start.items.some(i=>i.id===data.originals[0].id));
 for(let n=0;n<10;n++){await timed('listing',async()=>{const d=await h.api(`/items/${data.folders[0]}`,member);assert.ok(d.children.length)});await timed('deepOpen',async()=>{const d=await h.api(`/items/${data.folders.at(-1)}`,member);assert.ok(d.children.some(i=>i.id===data.originals[0].id))})}
 for(let n=0;n<50;n++)await timed('search',async()=>{const result=await h.api(`/search?q=${encodeURIComponent(`invoice ${n%data.originals.length}`)}`,member);assert.ok(result.count>0)});
 const changed=data.originals.slice(0,20);for(let n=0;n<changed.length;n++)await h.api(`/items/${changed[n].id}/rename`,owner,{name:`Updated invoice ${n}.txt`});data.counts.changes=changed.length;
 await timed('catchUp',async()=>{let cursor=start.cursor,more=true;const seen=new Set();while(more){const feed=await sync(`/changes?cursor=${cursor}`);assert.ok(feed.cursor>=cursor);for(const c of feed.changes)if(c.state==='present')seen.add(c.id);assert.ok(!feed.more||feed.cursor>cursor);cursor=feed.cursor;more=feed.more}for(const item of changed)assert.ok(seen.has(item.id))});
 const file=await h.api(`/items/${data.originals[0].id}`,member),download=`/api/chest/items/${data.originals[0].id}/bytes/${file.item.current}?download=true`;
 assert.equal(await(await h.raw(download,member)).text(),data.originals[0].body.toString());
 await h.api(`/groups/${data.group.id}/members`,owner,{action:'remove',email:data.sessions[0]});
 await h.api(`/items/${data.folders[0]}`,member,undefined,403);
 assert.equal((await h.api('/search?q=invoice',member)).count,0);
 assert.equal((await h.raw(download,member)).status,403);
 assert.equal((await h.fetch(`/api/chest/sync/items/${data.originals[0].id}/content`,{headers:{authorization:`Bearer ${device.token}`}})).status,403);
 const tree=await sync('/tree');assert.ok(!tree.items.some(i=>i.space===data.space.id));
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
 for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(owner.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin,secure:true}}));const page=await context.newPage();await page.goto(h.origin+'/app/administration/scale');await page.getByRole('heading',{name:'Operating scale',exact:true}).waitFor();assert.ok(await page.getByText('Failing scale health check',{exact:true}).isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await tooltips(page,width,'scale');await page.screenshot({path:`test-results/${width}-scale.png`,fullPage:true});await context.close()}
 await writeFile('test-results/scale.json',JSON.stringify({source:head,requestedTarget:inventoryTarget(inventory??{}),buyerInventorySupplied:!!inventory,result:saved,gaps:['Real reference installation and measured US 100 Mbps connection','Seven-day offline device and 10000 remote changes','500000-item initial enumeration without hydration','20000-child scrolling without a full reload','Buyer MIGRATE-001 inventory rerun']},null,2));
 console.log(JSON.stringify({head,counts:data.counts,timings:saved.timings,health:'failing: bounded data and unmeasured network',revocation:report.revocation}));
}finally{await browser?.close();await h.close()}
