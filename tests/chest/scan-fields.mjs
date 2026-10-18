// The provider is the only fake: real originals, real current ACL and atomic metadata decisions run in the Worker.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {harness} from './harness.mjs';
export async function scanHarness(){
 let revision=1;
 const h=await harness({edge:async request=>{
  if(request.url!=='https://api.anthropic.com/v1/messages')return;
  const body=await request.json(),ask=body.messages[0].content.filter(p=>p.type==='text').map(p=>p.text).join('\n'),schema=body.output_config.format.schema;
  const fields=[...ask.matchAll(/^- (.+) \((text|number|date|yes\/no)\)$/gm)].map(m=>m[1]);
  const answer='text' in schema.properties?{readable:true,language:'en',confidence:.96,text:`Harbor Freight Logistics and Acme Supply agreement. Revision ${revision}.`}:{fields:fields.map((field,i)=>({field,found:field!=='Governing state',value:field==='Party'?'Harbor Freight Logistics LLC':field==='Effective date'?revision===1?'2026-03-04':'2026-04-09':field==='Term'?'2':field==='TIN'?'12-3456789':field==='Legal name'?'Acme Supply Inc.':field==='Business type'?'C Corporation':'',page:field==='Governing state'?0:1,box:field==='Governing state'?[0,0,0,0]:[85,200+i*75,1000,250+i*75],confidence:field==='Governing state'?0:.94,note:field==='Governing state'?'Not readable.':''}))};
  return Response.json({content:[{type:'text',text:JSON.stringify(answer)}],usage:{input_tokens:500,output_tokens:150}});
 }});
 h.setRevision=n=>{revision=n};return h;
}
export async function scanPeople(h){
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const [email,name] of [['dana@example.test','Dana Flores'],['casey@example.test','Casey Chen']])await h.api('/people',owner,{action:'invite',email,name});
 const viewer=await h.signIn('dana@example.test',true),outsider=await h.signIn('casey@example.test',true),space=await h.api('/spaces',owner,{name:'Harbor agreements'});
 await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'dana@example.test',role:'viewer'}]});
 await h.api('/reading/settings',owner,{provider:'anthropic',model:'claude-sonnet-5-5',key:'test-only-scan-key'});
 return {owner,viewer,outsider,space};
}
export async function scannedItem(h,owner,space,{type='NDA',name='Harbor NDA.png',fields={},required=false}={}){
 const schema=await h.api('/schemas',owner,{name:type,fields:(type==='NDA'?[['Party','text'],['Effective date','date'],['Term','number'],['Governing state','text']]:[['Legal name','text'],['Business type','text'],['TIN','text']]).map(([name,type])=>({name,type,required:required && ['Party','Effective date'].includes(name)}))});
 const folder=await h.api('/items',owner,{space:space.id,type:'folder',name:type+' inbox '+name});await h.api(`/items/${folder.id}/governance`,owner,{reviewer:h.vars.OWNER_EMAIL,schema:schema.id,scanIntake:required});
 const item=await h.api('/items',owner,{parent:folder.id,name,fields,base64:(await readFile(`tests/chest/scan-${type==='NDA'?'nda':'w9'}.png`)).toString('base64')});return {schema,folder,item};
}
export async function settledFields(h,id,cookie){
 for(let i=0;i<100;i++){const r=await h.api(`/items/${id}/reading?work=1`,cookie);if(r.versions?.at(-1)?.fields?.state==='done')return r.versions.at(-1);await new Promise(r=>setTimeout(r,100))}assert.fail('scan fields did not settle');
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const h=await scanHarness();try{
  const {owner,viewer,outsider,space}=await scanPeople(h),{item,folder,schema}=await scannedItem(h,owner,space,{fields:{Term:3}}),v=item.payload.current;
  const read=await settledFields(h,item.id,owner);assert.equal(read.fields.proposals.length,4);assert.ok(read.fields.proposals[0].box?.every(n=>n>=0&&n<=1));
  await h.api(`/items/${item.id}/fields/${v}`,viewer,{field:'Party',decision:'accept'},403);await h.api(`/items/${item.id}/fields/${v}`,outsider,{field:'Party',decision:'accept'},403);
  await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Party',decision:'accept'});await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Effective date',decision:'accept',value:'2026-03-05'});await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Term',decision:'accept'},409);await h.api(`/items/${item.id}/fields/${v}`,owner,{field:'Governing state',decision:'reject'});
  const after=await h.api(`/items/${item.id}`,viewer);assert.deepEqual(after.metadata.filing.fields,{Term:3,Party:'Harbor Freight Logistics LLC','Effective date':'2026-03-05'});
  assert.equal((await h.api('/search?q=Harbor%20Freight%20Logistics',viewer)).count,1);assert.equal((await h.api('/search?q=Harbor%20Freight%20Logistics',outsider)).count,0);
  h.setRevision(2);await h.api(`/items/${item.id}/versions`,owner,{base64:(await readFile('tests/chest/scan-w9.png')).toString('base64')});const changed=await settledFields(h,item.id,owner);assert.deepEqual(changed.fields.proposals.map(p=>p.field),['Effective date','Term'],'only changed or undecided fields are proposed again');
  const previous=(await h.api(`/items/${item.id}/reading`,owner)).versions[0];assert.equal(previous.fields.proposals[0].decision.status,'accepted');
  const w9=await scannedItem(h,owner,space,{type:'W-9',name:'Acme W-9.png'}),tax=await settledFields(h,w9.item.id,owner);assert.equal(tax.fields.proposals.find(p=>p.field==='TIN').value,'***-**-6789');assert.ok(!JSON.stringify(tax.fields).includes('12-3456789'));
  await h.api(`/items/${w9.item.id}/fields/${w9.item.payload.current}`,owner,{field:'TIN',decision:'accept',value:'98-7654321'});assert.equal((await h.api(`/items/${w9.item.id}`,owner)).metadata.filing.fields.TIN,'***-**-4321');
  const required=await h.api('/schemas',owner,{name:'Required NDA',fields:[{name:'Party',type:'text',required:true}]}),intake=await h.api('/items',owner,{space:space.id,type:'folder',name:'Scan intake'});await h.api(`/items/${intake.id}/governance`,owner,{reviewer:h.vars.OWNER_EMAIL,schema:required.id,scanIntake:true});await h.api('/items',owner,{parent:intake.id,name:'Incomplete.txt',base64:Buffer.from('Plain upload').toString('base64')},400);const pending=await h.api('/items',owner,{parent:intake.id,name:'Required NDA.png',base64:(await readFile('tests/chest/scan-nda.png')).toString('base64')});await h.api(`/items/${pending.id}/versions/${pending.payload.current}/review`,owner,{action:'approve'},400);await settledFields(h,pending.id,owner);await h.api(`/items/${pending.id}/fields/${pending.payload.current}`,owner,{field:'Party',decision:'accept'});await h.api(`/items/${pending.id}/versions/${pending.payload.current}/review`,owner,{action:'approve'});
  const reservation=await h.api('/uploads',owner,{parent:intake.id,name:'Incomplete browser text.txt',size:5,lastModified:1});assert.equal((await h.fetch(`/api/chest/uploads/${reservation.id}/parts/1`,{method:'PUT',headers:{cookie:owner,origin:h.origin},body:'plain'})).status,200);await h.api(`/uploads/${reservation.id}/complete`,owner,{},400);assert.ok(!(await h.api(`/items/${intake.id}`,owner)).children.some(i=>i.name==='Incomplete browser text.txt'));await h.api(`/uploads/${reservation.id}/cancel`,owner,{});
  // A type edit invalidates stale proposals, and a revoked viewer loses text and page images immediately.
  await h.api(`/schemas/${schema.id}`,owner,{name:'NDA',fields:[{name:'Party',type:'text',required:false}]});await h.api(`/items/${item.id}/fields/${changed.version}`,owner,{field:'Term',decision:'accept'},409);
  await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});await h.api(`/items/${item.id}/reading`,viewer,undefined,403);await h.api(`/items/${item.id}/pages/${v}/1`,viewer,undefined,403);
  const audit=(await h.api('/audit',owner)).filter(e=>e.object_id===item.id&&e.action.startsWith('field.'));assert.ok(audit.length>=3&&audit.every(e=>JSON.parse(e.detail).version===v));
  console.log('SEARCH-002 typed-folder proposals, confirmation, immutable prior decisions, TIN masking and current ACL passed');
 }finally{await h.close()}
}
