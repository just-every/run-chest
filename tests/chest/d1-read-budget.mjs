// A small company on Workers Free shares 5,000,000 D1 rows read a day across everything it runs. Chest's scheduled sweep
// and the background work behind every signed-in request must cost the same rows read however much history is stored.
// The built Worker runs against a database that already holds a month of history; D1's own row counts are summed.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const HISTORY=400,SWEEP_CEILING=150,REQUEST_CEILING=150;
const h=await harness({meter:true});
const seed=sql=>h.sql(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<${HISTORY}) ${sql}`);
const iso=new Date(Date.now()-10*86_400_000).toISOString(),later=new Date(Date.now()+30*86_400_000).toISOString();
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'})).status,303);
 const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 // One active webhook that is caught up, and the events, deliveries, expiries, requests, signatures, backups and files behind it.
 await h.sql("INSERT INTO chest_records(id,kind,payload,revision) VALUES('sub1','integration-subscription',json_object('grant','g1','owner','owner@example.test','endpoint','https://hooks.example.test/x','events',json_array('file.create'),'after',?),'r')",HISTORY);
 await h.sql("INSERT INTO chest_integration_secrets(id,value) VALUES('event-clock',?)",String(HISTORY));
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'ev'||i,'integration-event',json_object('kind','file.create','item','it'||i,'at','${iso}','imported',json('false')),'r' FROM n`);
 await h.sql("INSERT INTO chest_integration_secrets(id,value,position) SELECT 'event:'||id,json_object('position',CAST(substr(id,3) AS INTEGER),'row',rowid,'revision',revision,'payload',payload),CAST(substr(id,3) AS INTEGER) FROM chest_records WHERE kind='integration-event'");
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'integration-delivery:sub1:ev'||i,'integration-delivery',json_object('subscription','sub1','event','ev'||i,'state','delivered','attempt',1,'at','${iso}','finishedAt','${iso}'),'r' FROM n`);
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'expiry:it'||i||':x@example.test','expiry',json_object('item','it'||i,'principal','x@example.test','expires','${later}','by','owner@example.test'),'r' FROM n`);
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'rq'||i,'request',json_object('status',CASE WHEN i<=20 THEN 'pending' ELSE 'closed' END,'expiresAt','${later}','requester','x@example.test','item','it'||i,'approvers',json_array('owner@example.test')),'r' FROM n`);
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'sg'||i,'signature',json_object('status',CASE WHEN i<=20 THEN 'pending' ELSE 'completed' END,'item','it'||i,'signers',json_array(),'expires','${later}'),'r' FROM n`);
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'br'||i,'backup-run',json_object('state','complete','at','${iso}'),'r' FROM n WHERE i<=30`);
 await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'it'||i,'item',json_object('space','history','type','file','name','n'||i,'current','v3','grants',json_array(),'versions',json_array(json_object('id','v1','checksum','c1_'||i,'mediaType','application/pdf','size',100),json_object('id','v2','checksum','c2_'||i,'mediaType','application/pdf','size',100),json_object('id','v3','checksum','c3_'||i,'mediaType','application/pdf','size',100))),'r' FROM n`);
 for(const v of [1,2,3])await seed(`INSERT INTO chest_records(id,kind,payload,revision) SELECT 'extract:c${v}_'||i,'extract',json_object('mediaType','application/pdf','size',100,'state','done','pages',json_array(),'text','x','createdAt','${iso}','lease',NULL),'r' FROM n`);
 // Everything above was read long ago: the reader has nothing left to look at.
 await h.sql('DELETE FROM chest_reader_dirty');
 await h.rows();

 // The scheduled sweep every 15 minutes.
 await h.scheduled();
 const sweep=await h.rows();
 assert.equal(sweep.unmetered,0,'every statement reports the rows it read');
 assert.ok(sweep.rows>0&&sweep.rows<SWEEP_CEILING,`the scheduled sweep read ${sweep.rows} rows over ${HISTORY} days of history; expected under ${SWEEP_CEILING}`);

 // A signed-in page or API call, and the reading and filing work that follows every one.
 const settle=()=>new Promise(r=>setTimeout(r,500));
 await settle();await h.rows();
 for(const path of ['/api/chest/notices','/api/chest/notices']){
  const response=await h.fetch(path,{headers:{cookie:owner}});assert.equal(response.status,200,path);await response.arrayBuffer();await settle();
  const request=await h.rows();if(process.env.D1_TOP)console.log(path,JSON.stringify(request.top,null,1));assert.ok(request.rows<REQUEST_CEILING,`${path} read ${request.rows} rows over ${HISTORY} days of history; expected under ${REQUEST_CEILING}`);
 }
 console.log(`D1 read budget: ${HISTORY} days of history, scheduled sweep ${sweep.rows} rows`);
}finally{await h.close()}
