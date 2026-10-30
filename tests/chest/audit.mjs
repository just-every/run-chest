// AUDIT-001: history through HTTP, including privacy, refusals, provider failure and restart.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
let failMail=false, held=false, started, release;
const h=await harness({edge:async r=>{if(r.url==='https://api.resend.com/emails'&&failMail){if(held){started?.();await new Promise(r=>{release=r})}return Response.json({message:'provider unavailable'},{status:503})}}}),cookies={};
const b64=v=>Buffer.from(v).toString('base64'),email=name=>[name,'example.test'].join('@');
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});cookies.owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:cookies.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const [name,role] of [['jordan','contributor'],['casey','viewer'],['morgan','contributor']]){await h.api('/people',cookies.owner,{action:'invite',email:email(name),name});cookies[name]=await h.signIn(email(name),true)}
 const space=await h.api('/spaces',cookies.owner,{name:'Harbor Freight operations'});
 await h.api(`/spaces/${space.id}/members`,cookies.owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:email('jordan'),role:'contributor'},{principal:email('casey'),role:'viewer'},{principal:email('morgan'),role:'contributor'}]});
 const file=await h.api('/items',cookies.owner,{space:space.id,type:'file',name:'Delivery plan.txt',base64:b64('Delivery schedule for November')});
 const viewed=[];
 for(const n of ['jordan','casey']){
  await h.api(`/items/${file.id}`,cookies[n]);
  const records=await h.api(`/audit?paginate=true&action=item.read&object=${file.id}`,cookies.owner);
  const event=records.rows.find(r=>r.actor===email(n));
  assert.ok(event&&Number.isFinite(Date.parse(event.at)),`${n}'s authenticated open has a public timestamp`);
  viewed.push(event);
 }
 const replacement=await h.api(`/items/${file.id}/versions`,cookies.jordan,{base64:b64('Delivery schedule with confirmed November dates')});
 const panel=async n=>(await h.api(`/items/${file.id}`,cookies[n])).activity;
 const contributor=await panel('morgan');
 for(const event of viewed){
  const shown=contributor.find(r=>r.id===event.id);
  assert.ok(shown,'both colleague views reach the contributor Activity panel');
  assert.equal(shown.actor,event.actor);assert.equal(shown.at,event.at);
 }
 const viewer=await panel('casey');
 assert.ok(viewer.some(r=>r.action==='version.upload'&&r.actor===email('jordan')&&r.detail.version===replacement.payload.current),'a viewer sees the real edit to the same file');
 assert.ok(!viewer.some(r=>r.action==='item.read'),'a viewer receives no colleague view history');
 await h.api('/audit/privacy',cookies.jordan,{hidden:true});
 const hidden=await panel('morgan');assert.ok(!hidden.some(r=>r.action==='item.read'&&r.actor===email('jordan')));
 assert.ok(hidden.some(r=>r.action==='item.read'&&r.actor===email('casey')),'hiding one colleague preserves the other colleague');
 await h.api('/audit/privacy',cookies.owner,{scope:'organization',enabled:false,groups:[]});assert.ok(!(await panel('morgan')).some(r=>r.action==='item.read'));
 await h.api('/audit/privacy',cookies.owner,{scope:'organization',enabled:true,groups:[]});
 const group=await h.api('/groups',cookies.owner,{name:'Private viewers',members:[email('casey')]});
 await h.api('/audit/privacy',cookies.owner,{scope:'organization',enabled:true,groups:[group.id]});assert.ok(!(await panel('morgan')).some(r=>r.action==='item.read'&&r.actor===email('casey')));
 await h.api(`/items/${file.id}/rename`,cookies.casey,{name:'Refused.txt'},403);
 for(let n=0;n<64;n++)await h.api(`/items/${file.id}/rename`,cookies.owner,{name:`Delivery plan revision ${n}.txt`});
 let cursor='',ids=[];do{const page=await h.api(`/audit?paginate=true&action=item.rename&limit=17${cursor?'&cursor='+encodeURIComponent(cursor):''}`,cookies.owner);ids.push(...page.rows.map(r=>r.id));cursor=page.next}while(cursor);
 assert.equal(ids.length,64);assert.equal(new Set(ids).size,64);
 const exportResponse=await h.raw('/api/chest/audit/export?action=item.rename',cookies.owner),exported=(await exportResponse.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(exported.map(r=>r.id),ids);
 const refused=await h.api('/audit?paginate=true&outcome=refused',cookies.owner);assert.ok(refused.rows.some(r=>r.actor===email('casey')&&r.object_id===file.id));
 failMail=true;await h.api(`/items/${file.id}/shares`,cookies.owner,{principal:email('jordan'),role:'viewer'});
 assert.ok((await h.api('/audit?paginate=true&action=provider.mail&outcome=uncertain',cookies.owner)).rows.some(r=>r.object_id===file.id));
 const began=new Promise(r=>{started=r});held=true;
 const inFlight=h.api(`/items/${file.id}/shares`,cookies.owner,{principal:email('morgan'),role:'viewer'}).catch(()=>null);
 await began;await h.stop();release();await h.start();await inFlight;
 await h.sql("UPDATE chest_audit SET at=? WHERE action='provider.mail' AND json_extract(detail,'$.outcome')='running'",new Date(Date.now()-6*60000).toISOString());
 const interrupted=await h.api('/audit?paginate=true&action=provider.mail&outcome=uncertain',cookies.owner);assert.ok(interrupted.rows.some(r=>JSON.parse(r.detail).reason),'interrupted public execution remains uncertain after restart');
 failMail=false;held=false;
 await h.api('/audit/identities/erase',cookies.owner,{email:email('casey'),confirm:email('casey')});
 const after=await h.raw('/api/chest/audit/export',cookies.owner),text=await after.text();assert.ok(!text.includes(email('casey')));assert.ok(text.includes('Erased person'));assert.ok(!text.includes(h.vars.MAIL_API_KEY));
 await h.stop();await h.start();assert.equal((await h.api('/audit?paginate=true&action=item.rename',cookies.owner)).rows.length,50);
 await h.api(`/spaces/${space.id}/members`,cookies.owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});
 await h.api(`/items/${file.id}/unshare`,cookies.owner,{principal:email('jordan')});
 assert.equal((await h.api(`/audit?paginate=true&object=${file.id}`,cookies.jordan)).rows.length,0,'current revocation removes history and export access');
 await h.api(`/items/${file.id}`,cookies.jordan,undefined,403);
 const revokedExport=await h.raw(`/api/chest/audit/export?object=${file.id}`,cookies.jordan);assert.equal(revokedExport.status,200);assert.equal(await revokedExport.text(),'','revoked access discloses no exported activity');
 console.log('AUDIT-001 passed: current-access history, pagination and export, two colleague view identities and times, viewer edits, privacy, refusal and provider outcomes and anonymization survive restart');
}finally{await h.close()}
