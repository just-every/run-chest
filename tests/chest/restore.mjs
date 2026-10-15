import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {readArchive} from '@runeditrun/rer/modules/portability';
import {command,serving,key,devSession} from './local.mjs';
async function archive(path){const data=await readFile(path),records=[];for await(const record of readArchive(new ReadableStream({start(c){c.enqueue(data);c.close()}})))records.push(record);return records}
export async function restoreJourney({root,target,port,oldCookie,expected,oldMemberCookie,reviewerEmail,reviewerPersona,custody}){
 await command(root,['export','--output','public/exposure.rer'],{refuse:true});
 await command(root,['export','--output','exports/complete.rer']);const before=await archive(join(root,'exports/complete.rer'));
 const graph=before.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(i=>i.kind==='row'&&i.table==='chest_records').map(i=>({...i.row,payload:JSON.parse(i.row.payload)}));
 assert.deepEqual(graph.find(r=>r.id===custody.group.id).payload,custody.group.payload);
 assert.deepEqual(graph.find(r=>r.id===custody.trash.id).payload,custody.trash.payload);assert.equal(custody.trash.payload.trash,true);
 assert.deepEqual(graph.find(r=>r.id===custody.imported.id).payload,custody.imported.payload);assert.equal(custody.imported.payload.private,true);assert.ok(custody.imported.payload.source);
 assert.ok(expected.payload.versions.some(v=>v.state==='submitted'));assert.ok(expected.payload.approved);
 assert.ok(before[0].objects.length>0);assert.ok(before[0].excludedTables.some(n=>n==='oa_sessions'));assert.ok(before[0].tables.some(t=>t.name==='chest_records'));
 // A filename change, JSON spacing and a long prefix must not publish private data.
 const renamed=before.map((record,index)=>(index===0?' '.repeat(4096):'')+JSON.stringify(record).replaceAll(':',': ')).join('\n')+'\n';
 await writeFile(join(root,'public/exposure.txt'),renamed,{mode:0o600});
 try{for(const args of [['build'],['setup','--owner-email','owner@example.test','--port',String(port)]]){const refused=await command(root,args,{refuse:true});assert.ok(refused.includes('Archive content found in public assets'),'refusal identifies private archive content')}}finally{await rm(join(root,'public/exposure.txt'))}
 await command(root,['import','--input','exports/complete.rer','--yes'],{refuse:true});
 const clone=spawn('git',['clone','--no-local',root,target],{stdio:'ignore'});assert.equal(await new Promise(r=>clone.once('exit',r)),0,'fresh target clone');await command(target,['install']);await mkdir(join(target,'exports'),{recursive:true});
 await copyFile(join(root,'exports/complete.rer'),join(target,'exports/complete.rer'));
 const corrupt=(await readFile(join(target,'exports/complete.rer'),'utf8')).replace('"kind":"part"','"kind":"bad"');await writeFile(join(target,'exports/corrupt.rer'),corrupt,{mode:0o600});await command(target,['import','--input','exports/corrupt.rer','--yes'],{refuse:true});
 // Every policy-visible manifest field is bound by the published archive digest.
 for(const [field,value] of [['sourceIdentity','altered-installation'],['epoch',before[0].epoch+1],['journal',['0'.repeat(64)]]]){
  const changed=before.map((record,index)=>JSON.stringify(index===0?{...record,[field]:value}:record)).join('\n')+'\n';
  await writeFile(join(target,'exports/metadata-tampered.rer'),changed,{mode:0o600});
  await command(target,['import','--input','exports/metadata-tampered.rer','--yes'],{refuse:true});
 }
 await command(target,['import','--input','exports/complete.rer','--yes']);await command(target,['export','--output','exports/restored.rer']);const after=await archive(join(target,'exports/restored.rer'));
 const semantic=r=>r.filter(v=>v.kind==='part').flatMap(v=>v.items).map(({index,...item})=>item);
 assert.deepEqual(semantic(after),semantic(before),'all portable table cells and original byte chunks survive empty-target restore');
 const oldVars=await readFile(join(root,'.dev.vars'),'utf8');await command(target,['setup','--owner-email','owner@example.test','--port',String(port)]);const newVars=await readFile(join(target,'.dev.vars'),'utf8');const setting=(s,k)=>s.split('\n').find(l=>l.startsWith(k+'='));assert.ok(setting(oldVars,'SESSION_SECRET')!==setting(newVars,'SESSION_SECRET'),'restore regenerates local session secret');
 // The restored target opens through its own dev identity; old sessions are gone even with its key.
 const server=await serving(target,'dev',port);const origin=`http://127.0.0.1:${port}`,devKey=await key(target);
 try{for(const old of [oldCookie,oldMemberCookie])assert.equal((await fetch(origin+'/api/chest/library',{headers:{cookie:old,'x-rer-dev-key':devKey}})).status,401);const cookie=await devSession(origin,devKey,'owner');
 const result=await(await fetch(origin+'/api/chest/library',{headers:{cookie,'x-rer-dev-key':devKey}})).json();const doc=result.documents.find(r=>r.id===expected.id);assert.deepEqual(doc.payload,expected.payload);
 assert.deepEqual(result.groups.find(r=>r.id===custody.group.id).payload,custody.group.payload);
 assert.deepEqual(result.documents.find(r=>r.id===custody.imported.id).payload,custody.imported.payload);
 const trash=await(await fetch(origin+'/api/chest/documents/'+custody.trash.id,{headers:{cookie,'x-rer-dev-key':devKey}})).json();assert.deepEqual(trash.payload,custody.trash.payload);
 const restoredJob=await(await fetch(origin+'/api/chest/archive/'+custody.jobId,{headers:{cookie,'x-rer-dev-key':devKey}})).json();assert.equal(restoredJob.state,'completed');
 for(const v of doc.payload.versions){const r=await fetch(`${origin}/api/chest/documents/${doc.id}/bytes/${v.id}?download=true`,{headers:{cookie,'x-rer-dev-key':devKey}});assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());assert.equal(bytes.length,v.size)}
 // Export suspends personas; once the owner reactivates the reviewer, its restored grants apply again.
 const reactivated=await fetch(origin+'/api/chest/people',{method:'POST',headers:{cookie,'x-rer-dev-key':devKey,origin,'content-type':'application/json'},body:JSON.stringify({action:'reactivate',email:reviewerEmail})});assert.equal(reactivated.status,200);const memberCookie=await devSession(origin,devKey,reviewerPersona);assert.equal((await fetch(origin+'/api/chest/documents/'+expected.id,{headers:{cookie:memberCookie,'x-rer-dev-key':devKey}})).status,200);
 assert.equal((await fetch(origin+'/api/chest/documents/'+custody.trash.id,{headers:{cookie:memberCookie,'x-rer-dev-key':devKey}})).status,404);
 assert.equal((await fetch(origin+'/api/chest/documents/'+custody.imported.id,{headers:{cookie:memberCookie,'x-rer-dev-key':devKey}})).status,404);

 }finally{await server.stop()}
 console.log('CHEST-12 passed: real RER export, public-asset refusal, corrupt/nonempty refusal, fresh clone restore, complete semantic/byte equality and old credential refusal');
}
