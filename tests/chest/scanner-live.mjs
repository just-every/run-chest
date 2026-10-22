// SECURITY-002 with a real scanner: the reference adapter (scripts/scanner) over a running ClamAV daemon with its
// official signatures, reached from the built Worker's network edge. Nothing here is faked; the Scanner workflow runs
// it where clamd is installed (CLAMD_SOCKET).
import assert from 'node:assert/strict';
import {startScanner} from '../../scripts/scanner/server.mjs';
import {harness} from './harness.mjs';
import {SCANNER,specimen,threatPeople,until} from './threats.mjs';
assert.ok(process.env.CLAMD_SOCKET,'CLAMD_SOCKET names the running ClamAV daemon');
const scanner=await startScanner({token:'synthetic-chest-1',socket:process.env.CLAMD_SOCKET,port:0});
const h=await harness({edge:async request=>{
 if(request.url!==SCANNER)return;
 return fetch(`http://127.0.0.1:${scanner.port}/scan`,{method:'POST',headers:{authorization:request.headers.get('authorization'),'content-type':'application/octet-stream','x-chest-sha256':request.headers.get('x-chest-sha256')},body:Buffer.from(await request.arrayBuffer())});
}});
try{
 const {people,space}=await threatPeople(h),{owner,uma,sam}=people;
 await h.api('/threats/scanner',owner,{endpoint:SCANNER,token:'synthetic-chest-1'});
 const test=await h.api('/threats/scanner/test',owner,{});assert.equal(test.ok,true,test.message);assert.match(test.message,/^Working: ClamAV /);
 const bad=await h.api('/items',uma,{space:space.id,name:'Invoice 2291.txt',base64:specimen.toString('base64')}),good=await h.api('/items',uma,{space:space.id,name:'Site notes.txt',base64:Buffer.from('Concrete pour finished on schedule.').toString('base64')});
 const held=await until(async()=>{await h.scheduled();return (await h.api('/threats',sam)).quarantine.find(q=>q.state==='infected')},'ClamAV quarantines the test specimen');
 assert.match(held.signature,/eicar/i);assert.match(held.engine,/^ClamAV \d/);assert.match(held.definitions,/^\d+$/);
 const download=item=>h.fetch(`/api/chest/items/${item.id}/bytes/${item.payload.current}?download=true`,{headers:{cookie:owner}});
 await until(async()=>(await download(good)).status===200,'ClamAV clears an ordinary file');
 {const r=await download(bad);assert.equal(r.status,423);assert.equal((await r.json()).error,'quarantined')}
 console.log(`SECURITY-002 live scanner: ${held.engine} with definitions ${held.definitions} quarantined the test specimen as ${held.signature} and cleared an ordinary file passed`);
}finally{await h.close();scanner.server.close()}
