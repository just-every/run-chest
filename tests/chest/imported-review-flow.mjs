import assert from 'node:assert/strict';
const address=role=>[role,'example.test'].join(String.fromCharCode(64));
const source=(page=2)=>({format:'google-drive-comments-1',file:'synthetic-chest-1',mappings:[{authorId:'reply:synthetic-chest-2:synthetic-chest-3',email:address('commenter'),evidence:'Owner verified source reply author against the directory record.'},{authorId:'comment:synthetic-chest-4',email:address('commenter'),evidence:'Owner verified source comment author against the directory record.'},{authorId:'assignee:synthetic-chest-2',email:address('contributor'),evidence:'Owner verified the source assignee.'}],anchors:{'synthetic-chest-4':{kind:'pdf',page,region:[.1,.2,.7,.4]}},comments:[
 {id:'synthetic-chest-2',author:{displayName:'Sam Archive'},createdTime:'2022-04-05T10:00:00.000Z',modifiedTime:'2022-04-06T10:00:00.000Z',content:'Please preserve the delivery wording.',resolved:false,anchor:'source-range-no-longer-present',quotedFileContent:{mimeType:'text/plain',value:'Delivery within thirty days.'},mentionedEmailAddresses:[address('outsider')],assigneeEmailAddress:address('contributor'),replies:[{id:'synthetic-chest-3',author:{displayName:'Review colleague'},createdTime:'2022-04-06T10:00:00.000Z',content:'The original wording matters.'}]},
 {id:'synthetic-chest-4',author:{displayName:'Review colleague'},createdTime:'2022-04-07T10:00:00.000Z',modifiedTime:'2022-04-08T10:00:00.000Z',content:'This original PDF region was approved.',resolved:true,anchor:'source-region',replies:[{id:'synthetic-chest-resolve',author:{displayName:'Case Archive'},createdTime:'2022-04-08T10:00:00.000Z',action:'resolve',content:'Resolved against the original wording.'}]}
]});
async function prepare({h,people,owner,bytes}){
 const personal=(await h.api('/files',owner)).personal,item=await h.api('/items',owner,{space:personal,name:`Imported review ${crypto.randomUUID()}.pdf`,base64:Buffer.from(bytes).toString('base64')});
 for(const [role,grant] of [['commenter','commenter'],['contributor','editor'],['viewer','viewer']])await h.api(`/items/${item.id}/shares`,owner,{principal:address(role),role:grant});
 return {item,archive:source(),version:item.payload.current,path:`/items/${item.id}/comment-import`};
}
export async function importedReviewFlow({h,people,owner,bytes}){
 const {item,archive,version,path}=await prepare({h,people,owner,bytes}),key=item.id;
 const state=async()=>{const v=await h.api(`/items/${key}`,owner);return {comments:v.comments,versions:v.versions,grants:v.grants,mails:h.mails.length}},before=await state();
 const preview=await h.api(`${path}/preview`,owner,{archive,version});assert.equal(preview.threads.length,2);assert.equal(preview.threads[0].author,'Former collaborator (Sam Archive)');assert.equal(preview.threads[1].author,address('commenter'));assert.deepEqual(await state(),before,'preview is read only');
 const input={archive,version,fingerprint:preview.fingerprint,confirm:true};
 await h.api(`${path}/apply`,people.viewer,input,403);await h.api(`${path}/apply`,people.contributor,input,403);await h.api(`${path}/apply`,owner,{...input,confirm:false},400);
 await h.api(`${path}/apply`,owner,{...input,archive:{...archive,file:'changed-source'}},409);
 await h.api(`${path}/preview`,owner,{archive:source(99),version},400);
 await h.api(`${path}/preview`,owner,{archive:{...archive,mappings:[{authorId:'former',email:address('outsider'),evidence:''}]},version},400);
 assert.deepEqual(await state(),before,'refused imports change no review state, grants, originals or notices');
 const published=await h.api(`${path}/apply`,owner,input);assert.equal(published.imported,2);let view=await state();assert.equal(view.mails,before.mails,'migration is silent');assert.deepEqual(view.grants,before.grants);assert.deepEqual(view.versions,before.versions);
 const former=view.comments.find(c=>c.imported.id==='synthetic-chest-2'),resolved=view.comments.find(c=>c.imported.id==='synthetic-chest-4');
 assert.equal(former.author,'Former collaborator (Sam Archive)');assert.equal(former.at,'2022-04-05T10:00:00.000Z');assert.equal(former.imported.quotedText,'Delivery within thirty days.');assert.equal(former.imported.anchorMissing,true);assert.equal(former.replies[0].imported.id,'synthetic-chest-3');assert.equal(former.replies[0].at,'2022-04-06T10:00:00.000Z');assert.equal(resolved.resolved.at,'2022-04-08T10:00:00.000Z');assert.equal(resolved.resolved.by,'Former collaborator (Case Archive)');assert.equal(resolved.imported.state,'resolved');assert.deepEqual(resolved.anchor,archive.anchors['synthetic-chest-4']);
 const open=await h.api(`/items/${key}/comments/unresolved?scope=all`,people.viewer);assert.deepEqual(open.threads.map(t=>t.id),[former.id]);assert.equal(open.selected,former.id);
 assert.ok((await h.api('/tasks',people.contributor)).some(t=>t.id===former.id&&t.at===former.at));assert.ok(!(await h.api('/tasks',people.viewer)).some(t=>t.id===former.id));
 await h.api(`/items/${key}/versions`,people.contributor,{base64:Buffer.from(bytes).toString('base64')});
 await h.api(`/items/${key}/comments/${former.id}/reply`,people.commenter,{message:'I checked the archived quotation.',author:address('outsider'),imported:{authorId:'forged'}});
 await h.api(`/items/${key}/comments/${former.id}/resolve`,people.commenter,{decision:'resolve'});
 assert.ok(!(await h.api('/tasks',people.contributor)).some(t=>t.id===former.id));
 await h.stop();await h.start();view=await state();const kept=view.comments.find(c=>c.id===former.id);assert.equal(kept.author,former.author);assert.equal(kept.at,former.at);assert.deepEqual(kept.imported,former.imported);assert.equal(kept.replies[1].author,address('commenter'));assert.ok(!kept.replies[1].imported);assert.equal(kept.resolved.by,address('commenter'));
 const again=await h.api(`${path}/preview`,owner,{archive,version});assert.equal((await h.api(`${path}/apply`,owner,{...input,fingerprint:again.fingerprint})).imported,0);assert.deepEqual(await state(),view,'replay preserves native replies and decisions');
 await h.api(`${path}/preview`,owner,{archive:{...archive,comments:[{...archive.comments[0],content:'Changed history'}]},version},409);
 await h.api(`/items/${key}/comments/${former.id}/resolve`,people.commenter,{decision:'reopen'});assert.ok((await h.api('/tasks',people.contributor)).some(t=>t.id===former.id));
 await h.api(`/items/${key}/settings`,owner,{noDownload:true});const restricted=await h.raw(`/api/chest/items/${key}/comparison-preview/${version}`,people.viewer);assert.equal(restricted.status,303);assert.equal(restricted.headers.get('location'),`/api/chest/items/${key}/rendered-preview/${version}`);assert.equal((await h.raw(`/api/chest/items/${key}/bytes/${version}`,people.viewer)).status,403);await h.api(`/items/${key}/settings`,owner,{noDownload:false});
 await h.api(`/items/${key}/unshare`,owner,{principal:address('contributor')});assert.ok(!(await h.api('/tasks',people.contributor)).some(t=>t.id===former.id));await h.api(`/items/${key}/comments/${former.id}/reply`,people.contributor,{message:'Revoked reply'},403);
 const page=await h.raw(`/app/items/${key}?comment=${former.id}`,people.commenter);assert.equal(page.status,200);const html=await page.text();for(const text of ['Former collaborator (Sam Archive)','Anchor not found','Delivery within thirty days.','synthetic-chest-2','I checked the archived quotation.'])assert.ok(html.includes(text),text);
 await h.api(`/items/${key}`,people.outsider,undefined,403);
 assert.ok(!(await h.api('/notices',people.outsider)).some(n=>n.payload.item===key),'source mentions grant and deliver nothing');
 // Erasure and a stored import preview cannot restore an erased author's identity or session.
 const erasedAddress=address('synthetic-chest-person');await h.api('/people',owner,{action:'invite',email:erasedAddress,name:'Imported colleague'});const erasedCookie=await h.signIn(erasedAddress,true);
 const privacyArchive={...archive,file:'synthetic-chest-private',mappings:archive.mappings.map(m=>m.authorId==='comment:synthetic-chest-4'?{...m,email:erasedAddress}:m)};
 const privatePlan=await h.api(`${path}/preview`,owner,{archive:privacyArchive,version}),privateInput={archive:privacyArchive,version,fingerprint:privatePlan.fingerprint,confirm:true};await h.api(`${path}/apply`,owner,privateInput);
 const fallback=privatePlan.threads.find(t=>t.imported.id==='synthetic-chest-2');assert.ok((await h.api('/tasks',owner)).some(t=>t.id===fallback.id),'unavailable source assignee routes to the file owner without a grant');
 await h.api('/erasure',owner,{email:erasedAddress,confirm:erasedAddress});
 await h.api('/files',erasedCookie,undefined,401);await h.api(`${path}/apply`,owner,privateInput,409);
 const erasedView=await h.api(`/items/${key}`,owner);assert.ok(!JSON.stringify(erasedView.comments).includes(erasedAddress));assert.equal(erasedView.comments.find(c=>c.imported.file==='synthetic-chest-private'&&c.imported.id==='synthetic-chest-4').author.startsWith('Erased person '),true);const erasedThread=erasedView.comments.find(c=>c.imported.file==='synthetic-chest-private'&&c.imported.id==='synthetic-chest-4');assert.equal(erasedThread.imported.authorName,erasedThread.author);assert.ok(!erasedThread.imported.mappingEvidence);
}
export async function importedReviewBrowserFlow({h,people,owner,bytes,browser,width}){
 const {item,archive,version}=await prepare({h,people,owner,bytes}),contexts=[];
 const pageFor=async cookie=>{const ctx=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});contexts.push(ctx);await ctx.addCookies(cookie.split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));return ctx.newPage()};
 const shot=async(p,state)=>{await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state+' fits '+width);await p.screenshot({path:`test-results/${width}-imported-review-${state}.png`,fullPage:true})};
 const press=(p,label)=>Promise.all([(p.page?p.page():p).waitForNavigation(),p.getByRole('button',{name:label,exact:true}).click()]);
 try{
  const p=await pageFor(owner);await p.goto(h.origin+`/app/items/${item.id}`);await p.getByRole('link',{name:'Import review threads',exact:true}).click();
  await p.getByLabel('Review export JSON',{exact:true}).setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});await press(p,'Preview review import');await shot(p,'preview');await press(p,'Confirm thread import');
  let view=await h.api(`/items/${item.id}`,owner),former=view.comments.find(c=>c.imported.id==='synthetic-chest-2');await p.locator(`[data-comment="${former.id}"]`).getByText('Former collaborator (Sam Archive)',{exact:false}).first().waitFor();await p.getByText('Anchor not found',{exact:true}).waitFor();await shot(p,'received');
  await h.api(`/items/${item.id}/versions`,people.contributor,{base64:Buffer.from(bytes).toString('base64')});
  const reviewer=await pageFor(people.commenter);await reviewer.goto(h.origin+`/app/items/${item.id}`);const thread=reviewer.locator(`[data-comment="${former.id}"]`);await thread.locator('summary').filter({hasText:/^Reply$/}).click();await thread.getByLabel('Reply',{exact:true}).fill('The source quotation is still correct.');await press(reviewer,'Post reply');await press(reviewer,'Resolve thread');await reviewer.getByText('Resolved threads (2)',{exact:true}).click();await shot(reviewer,'resolved');
  if(width===1440){view=await h.api(`/items/${item.id}`,owner);const retained=view.comments.find(c=>c.id===former.id);assert.equal(retained.author,former.author);assert.equal(retained.at,former.at);assert.deepEqual(retained.imported,former.imported);assert.equal(retained.replies.at(-1).author,address('commenter'));assert.equal(retained.resolved.by,address('commenter'))}
  const assignee=await pageFor(people.contributor);await assignee.goto(h.origin+'/app/notices#tasks');if(width===1440)assert.equal(await assignee.locator(`[data-task="${former.id}"]`).count(),0);await shot(assignee,'tasks-resolved');
  await reviewer.goto(h.origin+`/app/items/${item.id}?comment=${former.id}`);await press(reviewer.locator(`[data-comment="${former.id}"]`),'Reopen thread');
  await assignee.reload();await assignee.locator(`[data-task="${former.id}"]`).waitFor();await shot(assignee,'tasks-open');
 }finally{for(const ctx of contexts)await ctx.close()}
}
