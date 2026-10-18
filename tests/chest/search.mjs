// One public-door journey for composable, permission-safe file search and retained-version matches.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {pdf} from './fixtures.mjs';
import {xlsx} from './office-fixtures.mjs';
const h=await harness(),b64=x=>Buffer.from(x).toString('base64');
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.api('/people',owner,{action:'invite',email:'dana@example.test',name:'Dana Flores'});const dana=await h.signIn('dana@example.test',true);
 const personal=(await h.api('/files',owner)).personal,team=await h.api('/spaces',owner,{name:'Harbor projects'});
 await h.api(`/spaces/${team.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'dana@example.test',role:'contributor'}]});
 const root=await h.api('/items',owner,{space:team.id,type:'folder',name:'Contracts'}),nested=await h.api('/items',owner,{parent:root.id,type:'folder',name:'2026'});
 const a=await h.api('/items',owner,{parent:nested.id,name:'Agreement.txt',base64:b64(pdf())}),b=await h.api('/items',dana,{parent:nested.id,name:'Schedule.csv',base64:b64('Vendor,Amount\nHarbor,12500\nAcme,9400')}),old=await h.api('/items',owner,{parent:nested.id,name:'Notes.md',base64:b64('Cobalt lantern phrase in the old notes')});
 await h.api(`/items/${old.id}/versions`,owner,{base64:b64('The current notes contain a different sentence.')});
 const hidden=await h.api('/items',owner,{parent:root.id,type:'folder',name:'Private acquisition'});await h.api(`/items/${hidden.id}/settings`,owner,{restricted:true});await h.api('/items',owner,{parent:hidden.id,name:'Secret.pdf',base64:b64(pdf())});
 const shared=await h.api('/items',owner,{space:personal,name:'Partner summary.txt',base64:b64('Cobalt lantern phrase shared summary')});await h.api(`/items/${shared.id}/shares`,owner,{principal:'dana@example.test',role:'viewer'});
 const search=(params,cookie=dana)=>h.api('/search?'+new URLSearchParams(params),cookie);
 assert.deepEqual((await search({type:'pdfs',location:root.id})).results.map(r=>r.id),[a.id],'a PDF renamed .txt is still a PDF, nested locations include descendants, and restricted PDFs do not count');
 assert.deepEqual((await search({type:'pdfs,spreadsheets',location:team.id})).results.map(r=>r.id).sort(),[a.id,b.id].sort());
 assert.deepEqual((await search({type:'spreadsheets',creator:'me'})).results.map(r=>r.id),[b.id]);
 assert.equal((await search({q:'Cobalt lantern',location:root.id})).count,0);
 const earlier=await search({q:'Cobalt lantern',location:root.id,versions:'any'});assert.equal(earlier.count,1);assert.equal(earlier.results[0].matchedVersion,old.payload.current);assert.ok(earlier.results[0].versionLabel);assert.match(earlier.results[0].snippet,/Cobalt lantern/);
 assert.deepEqual((await search({q:'Cobalt lantern',location:'shared',owner:'owner@example.test',sharedBy:'owner@example.test',versions:'any'})).results.map(r=>r.id),[shared.id]);
 await h.api(`/items/${b.id}/prefs`,dana,{starred:true});assert.deepEqual((await search({location:'starred'})).results.map(r=>r.id),[b.id]);
 // Stored modification timestamps put the two files on opposite sides of midnight in the selected US timezone.
 await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.updatedAt',?) WHERE id=?",'2026-10-15T02:00:00.000Z',a.id);
 await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.updatedAt',?) WHERE id=?",'2026-10-15T12:00:00.000Z',b.id);
 assert.deepEqual((await search({location:root.id,modifiedFrom:'2026-10-14',modifiedTo:'2026-10-14',timeZone:'America/Los_Angeles',type:'pdfs,spreadsheets'})).results.map(r=>r.id),[a.id]);
 const sheet=await h.api('/items',owner,{space:team.id,name:'Forecast.bin',base64:b64(xlsx())});for(let i=0;i<30;i++){if((await h.api(`/items/${sheet.id}/reading?work=1`,owner)).reading?.state==='done')break;await new Promise(r=>setTimeout(r,100))}assert.deepEqual((await search({q:'Harbor logistics',type:'spreadsheets'})).results.map(r=>r.id),[sheet.id],'Office package contents determine type even with an unknown extension');
 const opts=(await search({})).options;assert.ok(!opts.locations.some(l=>l.id===hidden.id),'inaccessible folders are absent from suggestions');
 await h.api(`/spaces/${team.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});assert.equal((await search({location:root.id,versions:'any'})).count,0,'revocation wins on the next search');
 await h.api('/search?type=invalid',dana,undefined,400);await h.api('/search?modifiedFrom=2026-02-30',dana,undefined,400);
 console.log('SEARCH-001 combined filters, content types, retained versions, timezone dates and current ACL passed');
}finally{await h.close()}
