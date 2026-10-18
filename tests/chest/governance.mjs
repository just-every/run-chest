import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
const h=await harness(),b64=x=>Buffer.from(x).toString('base64');
try {
 await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
 for(const [email,name] of [['reviewer@example.test','Jordan Lee'],['outsider@example.test','Casey Chen']])await h.api('/people',owner,{action:'invite',email,name});
 const reviewer=await h.signIn('reviewer@example.test',true),outsider=await h.signIn('outsider@example.test',true),space=await h.api('/spaces',owner,{name:'Harbor operations'});
 await h.api(`/spaces/${space.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:'reviewer@example.test',role:'viewer'}]});
 const folder=await h.api('/items',owner,{space:space.id,type:'folder',name:'Supplier agreements'});
 await h.api(`/items/${folder.id}/governance`,outsider,{reviewer:'outsider@example.test'},403);
 await h.api(`/items/${folder.id}/governance`,owner,{reviewer:'reviewer@example.test'});
 const nested=await h.api('/items',owner,{parent:folder.id,type:'folder',name:'Acme Supply'}),file=await h.api('/items',owner,{parent:nested.id,name:'Payment terms.txt',base64:b64('Payment due in thirty days.')}),a=file.payload.versions[0].id;
 assert.equal(file.payload.versions[0].review.state,'submitted');assert.equal(file.payload.approved,null);
 await h.api(`/items/${file.id}/versions/${a}/review`,owner,{action:'approve'},403);
 await h.api(`/items/${file.id}/versions/${a}/review`,reviewer,{action:'approve'});
 const b=(await h.api(`/items/${file.id}/versions`,owner,{base64:b64('Payment due in sixty days.')})).payload.versions.at(-1).id;
 const c=(await h.api(`/items/${file.id}/versions`,owner,{base64:b64('Payment due in ninety days.')})).payload.versions.at(-1).id;
 assert.equal((await h.api(`/items/${file.id}`,owner)).item.current,a);
 await h.api(`/items/${file.id}/versions/${b}/review`,reviewer,{action:'approve'});
 assert.equal((await h.api(`/items/${file.id}`,owner)).item.current,b,'approving B never selects pending C');
 await h.api(`/items/${file.id}/versions/${c}/review`,reviewer,{action:'changes',message:'Keep the signed payment period.'});
 const restored=await h.api(`/items/${file.id}/versions/${a}/restore`,owner,{});
 assert.equal(restored.payload.current,b);assert.equal(restored.payload.versions.at(-1).review.state,'submitted','restoring approved bytes requires a new decision');
 const personal=(await h.api('/files',owner)).personal;await h.api(`/items/${file.id}/move`,owner,{space:personal,parent:null});
 const moved=await h.api(`/items/${file.id}/versions`,owner,{base64:b64('Moved pending revision')});assert.equal(moved.payload.current,b);assert.equal(moved.payload.versions.at(-1).review.state,'submitted');
 await h.api(`/items/${file.id}/versions/${moved.payload.versions.at(-1).id}/review`,reviewer,{action:'approve'},403);
 const ordinary=await h.api('/items',owner,{space:personal,name:'Delivery notes.txt',base64:b64('Ordinary files need no review')});assert.equal(ordinary.payload.versions[0].review,undefined);
 console.log('SPACE-001 exact-version folder review, inheritance, restore and current ACL passed');
} finally { await h.close() }
