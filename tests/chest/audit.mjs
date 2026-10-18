// AUDIT-001: history through HTTP, including privacy, refusals, provider failure and restart.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
let failMail=false, held=false, started, release;
const h=await harness({edge:async r=>{if(r.url==='https://api.resend.com/emails'&&failMail){if(held){started?.();await new Promise(r=>{release=r})}return Response.json({message:'provider unavailable'},{status:503})}}}),cookies={};
const b64=v=>Buffer.from(v).toString('base64');
try{
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});cookies.owner=await h.signIn(h.vars.OWNER_EMAIL);
 await h.fetch('/setup',{method:'POST',headers:{cookie:cookies.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 for(const [name,role] of [['jordan','contributor'],['casey','viewer'],['morgan','contributor']]){await h.api('/people',cookies.owner,{action:'invite',email:`${name}@example.test`,name});cookies[name]=await h.signIn(`${name}@example.test`,true)}
 const space=await h.api('/spaces',cookies.owner,{name:'Harbor Freight operations'});
 await h.api(`/spaces/${space.id}/members`,cookies.owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'jordan@example.test',role:'contributor'},{principal:'casey@example.test',role:'viewer'},{principal:'morgan@example.test',role:'contributor'}]});
 const file=await h.api('/items',cookies.owner,{space:space.id,type:'file',name:'Delivery plan.txt',base64:b64('Delivery schedule for November')});
 for(const n of ['jordan','casey'])await h.api(`/items/${file.id}`,cookies[n]);
 const panel=async n=>(await h.api(`/items/${file.id}`,cookies[n])).activity;
 assert.ok((await panel('morgan')).some(r=>r.action==='item.read'&&r.actor==='jordan@example.test'));
 assert.ok(!(await panel('casey')).some(r=>r.action==='item.read'));
 await h.api('/audit/privacy',cookies.jordan,{hidden:true});assert.ok(!(await panel('morgan')).some(r=>r.action==='item.read'&&r.actor==='jordan@example.test'));
 await h.api('/audit/privacy',cookies.owner,{scope:'organization',enabled:false,groups:[]});assert.ok(!(await panel('morgan')).some(r=>r.action==='item.read'));
 await h.api('/audit/privacy',cookies.owner,{scope:'organization',enabled:true,groups:[]});
 const group=await h.api('/groups',cookies.owner,{name:'Private viewers',members:['casey@example.test']});
 await h.api('/audit/privacy',cookies.owner,{scope:'organization',enabled:true,groups:[group.id]});assert.ok(!(await panel('morgan')).some(r=>r.action==='item.read'&&r.actor==='casey@example.test'));
 await h.api(`/items/${file.id}/rename`,cookies.casey,{name:'Refused.txt'},403);
 for(let n=0;n<64;n++)await h.api(`/items/${file.id}/rename`,cookies.owner,{name:`Delivery plan revision ${n}.txt`});
 let cursor='',ids=[];do{const page=await h.api(`/audit?paginate=true&action=item.rename&limit=17${cursor?'&cursor='+encodeURIComponent(cursor):''}`,cookies.owner);ids.push(...page.rows.map(r=>r.id));cursor=page.next}while(cursor);
 assert.equal(ids.length,64);assert.equal(new Set(ids).size,64);
 const exportResponse=await h.raw('/api/chest/audit/export?action=item.rename',cookies.owner),exported=(await exportResponse.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(exported.map(r=>r.id),ids);
 const refused=await h.api('/audit?paginate=true&outcome=refused',cookies.owner);assert.ok(refused.rows.some(r=>r.actor==='casey@example.test'&&r.object_id===file.id));
 failMail=true;await h.api(`/items/${file.id}/shares`,cookies.owner,{principal:'jordan@example.test',role:'viewer'});
 assert.ok((await h.api('/audit?paginate=true&action=provider.mail&outcome=uncertain',cookies.owner)).rows.some(r=>r.object_id===file.id));
 const began=new Promise(r=>{started=r});held=true;
 const inFlight=h.api(`/items/${file.id}/shares`,cookies.owner,{principal:'morgan@example.test',role:'viewer'}).catch(()=>null);
 await began;await h.stop();release();await h.start();await inFlight;
 await h.sql("UPDATE chest_audit SET at=? WHERE action='provider.mail' AND json_extract(detail,'$.outcome')='running'",new Date(Date.now()-6*60000).toISOString());
 const interrupted=await h.api('/audit?paginate=true&action=provider.mail&outcome=uncertain',cookies.owner);assert.ok(interrupted.rows.some(r=>JSON.parse(r.detail).reason),'interrupted public execution remains uncertain after restart');
 failMail=false;held=false;
 await h.api('/audit/identities/erase',cookies.owner,{email:'casey@example.test',confirm:'casey@example.test'});
 const after=await h.raw('/api/chest/audit/export',cookies.owner),text=await after.text();assert.ok(!text.includes('casey@example.test'));assert.ok(text.includes('Erased person'));assert.ok(!text.includes(h.vars.MAIL_API_KEY));
 await h.stop();await h.start();assert.equal((await h.api('/audit?paginate=true&action=item.rename',cookies.owner)).rows.length,50);
 await h.api(`/spaces/${space.id}/members`,cookies.owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'}]});
 await h.api(`/items/${file.id}/unshare`,cookies.owner,{principal:'jordan@example.test'});
 assert.equal((await h.api(`/audit?paginate=true&object=${file.id}`,cookies.jordan)).rows.length,0,'current revocation removes history and export access');
 console.log('AUDIT-001 passed: current-access history, pagination/export, views/privacy, refusal/provider outcomes and anonymization survive restart');
}finally{await h.close()}
