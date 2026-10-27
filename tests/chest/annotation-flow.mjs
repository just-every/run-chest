import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const b64=bytes=>Buffer.from(bytes).toString('base64');
async function pdf(changed=false){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(const text of changed?['Original second page moved here.','Changed replacement second page.']:['First page of the agreement.','Original second page for contextual review.']){const page=doc.addPage([400,500]);page.drawText(text,{x:40,y:400,size:12,font})}
 return new Uint8Array(await doc.save());
}
const target={kind:'pdf',page:2,region:[.1,.2,.7,.4]};
async function create(h,people,parent){const bytes=await pdf();const item=await h.api('/items',people.manager,{parent,name:`Review ${crypto.randomUUID()}.pdf`,base64:b64(bytes)});return {item,bytes}}
// Fold this into the existing role journey, which owns authentication and the Worker lifecycle.
export async function annotationFlow({h,people,parent}){
 const {item,bytes}=await create(h,people,parent),key=item.id,version=item.payload.current,path=`/items/${key}/comments`;
 const snapshot=async()=>({comments:(await h.api(`/items/${key}`,people.manager)).comments,mails:h.mails.length});
 let before=await snapshot();
 for(const input of [{version:null,message:'synthetic-chest-1'},{version:'missing',message:'synthetic-chest-1'}])await h.api(path,people.commenter,input,404);
 await h.api(path,people.viewer,{version,message:'synthetic-chest-1',anchor:target},403);
 for(const anchor of [{...target,page:3},{...target,page:0},{...target,region:[.7,.2,.1,.4]},{...target,region:[-.1,.2,.7,.4]}])await h.api(path,people.commenter,{version,message:'synthetic-chest-1',anchor},400);
 await h.api(path,people.commenter,{version,message:'synthetic-chest-2 forbidden outsider text',anchor:target,mentions:['viewer@example.test','outsider@example.test']},403);
 assert.deepEqual(await snapshot(),before,'refused annotations publish neither comments nor mail');
 await h.api(`/items/${key}`,people.outsider,undefined,403);
 const row=await h.api(path,people.commenter,{version,message:'Review the original second page.',anchor:target,mentions:['viewer@example.test'],assignee:'contributor@example.test'});
 assert.equal(row.payload.version,version);assert.deepEqual(row.payload.anchor,target);
 assert.ok((await h.api('/notices',people.viewer)).some(n=>n.payload.item===key&&n.payload.type==='comment.mention'));
 assert.ok(h.mails.some(m=>[m.to].flat().includes('viewer@example.test')&&m.text.includes('Review the original second page.')));
 assert.ok(!h.mails.some(m=>m.text.includes('synthetic-chest-2 forbidden outsider text')));
 assert.ok(!(await h.api('/notices',people.outsider)).some(n=>n.payload.item===key));
 const thread=`${path}/${row.id}`;before=await snapshot();
 await h.api(`${thread}/reply`,people.viewer,{message:'Viewer reply'},403);
 await h.api(`${thread}/reply`,people.commenter,{message:'Move anchor',version:'missing'},409);
 await h.api(`${thread}/reply`,people.commenter,{message:'Move anchor',anchor:{...target,page:1}},400);
 await h.api(`${thread}/resolve`,people.viewer,{decision:'resolve'},403);
 assert.deepEqual(await snapshot(),before);
 const replied=await h.api(`${thread}/reply`,people.contributor,{message:'I checked this original region.'});assert.equal(replied.payload.replies[0].author,'contributor@example.test');assert.deepEqual(replied.payload.anchor,target);
 await h.api(`${thread}/resolve`,people.commenter,{decision:'resolve'});
 await h.api(`${thread}/reply`,people.commenter,{message:'Closed thread'},409);
 const changedBytes=await pdf(true),replacement=await h.api(`/items/${key}/versions`,people.contributor,{base64:b64(changedBytes)});
 let view=await h.api(`/items/${key}`,people.manager),retained=view.comments.find(c=>c.id===row.id);
 assert.notEqual(replacement.payload.current,version);assert.equal(retained.version,version);assert.deepEqual(retained.anchor,target);assert.equal(retained.resolved.by,'commenter@example.test');assert.equal(retained.replies.length,1);
 const original=await h.raw(`/api/chest/items/${key}/bytes/${version}`,people.commenter);assert.equal(original.status,200);assert.deepEqual(new Uint8Array(await original.arrayBuffer()),bytes);
 await h.api(`${thread}/resolve`,people.contributor,{decision:'reopen'});view=await h.api(`/items/${key}`,people.manager);assert.equal(view.comments.find(c=>c.id===row.id).resolved,null);
 // Unresolved navigation visits an explicit set of current and retained PDF anchors only.
 const destination=replacement.payload.current,second=await h.api(path,people.commenter,{version:destination,message:'Check the changed first page.',anchor:{...target,page:1}});
 await h.api(path,people.commenter,{message:'An ordinary file comment is outside PDF navigation.'});
 const navPath=`${path}/unresolved`,nav=await h.api(navPath,people.viewer);
 assert.deepEqual(new Set(nav.threads.map(c=>c.id)),new Set([row.id,second.id]));
 const selected=await h.api(`${navPath}?thread=${row.id}`,people.viewer);assert.equal(selected.selected,row.id);assert.equal(selected.next,second.id);assert.equal(selected.previous,second.id);
 assert.equal((await h.api(`${navPath}?thread=${second.id}`,people.viewer)).next,row.id);
 await h.api(`${navPath}?thread=foreign-thread`,people.commenter,undefined,404);
 await h.api(navPath,people.outsider,undefined,403);
 await h.api(`${thread}/resolve`,people.commenter,{decision:'resolve'});
 assert.deepEqual((await h.api(navPath,people.viewer)).threads.map(c=>c.id),[second.id]);
 const source=(await h.api(`/items/${key}`,people.manager)).comments.find(c=>c.id===row.id);
 const state=async()=>{const v=await h.api(`/items/${key}`,people.manager);return {comments:v.comments,versions:v.versions,item:v.item,audits:v.activity.filter(a=>a.action.startsWith('comment.')),notices:await Promise.all(['viewer','commenter','contributor','manager'].map(async role=>(await h.api('/notices',people[role])).filter(n=>n.payload.item===key))),mails:h.mails.length}};
 const carry={key:crypto.randomUUID(),version:destination,anchor:{kind:'pdf',page:1,region:[.2,.3,.8,.6]},expectedCurrent:destination},carryPath=`${thread}/carry`;
 before=await state();
 await h.api(carryPath,people.viewer,carry,403);
 await h.api(carryPath,people.outsider,carry,403);
 await h.api(carryPath,people.commenter,{...carry,anchor:{...carry.anchor,page:3}},400);
 await h.api(carryPath,people.commenter,{...carry,anchor:{...carry.anchor,region:[.8,.2,.1,.4]}},400);
 await h.api(carryPath,people.commenter,{...carry,anchor:undefined},400);
 await h.api(carryPath,people.commenter,{...carry,version:'foreign-version'},404);
 await h.api(carryPath,people.commenter,{...carry,expectedCurrent:version},409);
 const otherFile=await create(h,people,parent);await h.api(`/items/${otherFile.item.id}/comments/${row.id}/carry`,people.commenter,carry,404);
 assert.deepEqual(await state(),before,'all refused carries preserve threads, version history, audit and notifications');
 // A retained mention must still have access; no silent recipient grant or text disclosure.
 const space=(await h.api(`/items/${key}`,people.manager)).item.space,members=(await h.api(`/spaces/${space}`,people.manager)).members;
 await h.api(`/spaces/${space}/members`,people.manager,{members:members.filter(m=>m.principal!=='viewer@example.test')});
 before=await state();await h.api(carryPath,people.contributor,carry,403);assert.deepEqual(await state(),before);
 await h.api(`/spaces/${space}/members`,people.manager,{members});
 const initialCarries=await Promise.all([h.api(carryPath,people.contributor,carry),h.api(carryPath,people.contributor,carry)]),carried=initialCarries[0];assert.equal(initialCarries[1].id,carried.id);
 assert.equal(carried.payload.author,'contributor@example.test');assert.equal(carried.payload.message,source.message);assert.equal(carried.payload.version,destination);assert.deepEqual(carried.payload.anchor,carry.anchor);
 assert.deepEqual(carried.payload.carriedFrom,{thread:row.id,version,anchor:target,by:'contributor@example.test',at:carried.payload.at});
 assert.ok(!carried.payload.resolved);assert.ok(!carried.payload.replies?.length);assert.deepEqual(carried.payload.mentions,source.mentions);assert.equal(carried.payload.assignee,source.assignee);
 before=await state();assert.deepEqual(before.comments.find(c=>c.id===row.id),source,'original author, anchor, replies and resolution remain immutable');
 assert.equal(before.audits.filter(a=>a.action==='comment.carry').length,1);
 assert.deepEqual(before.notices.flat().filter(n=>n.payload.type==='comment.carry').map(n=>n.payload.to).sort(),['commenter@example.test','manager@example.test','viewer@example.test']);
 const audit=before.audits.find(a=>a.action==='comment.carry');assert.equal(audit.actor,'contributor@example.test');assert.equal(audit.detail.sourceThread,row.id);assert.equal(audit.detail.sourceVersion,version);assert.deepEqual(audit.detail.sourceAnchor,target);assert.equal(audit.detail.comment,carried.id);assert.deepEqual(audit.detail.anchor,carry.anchor);
 const retries=await Promise.all([h.api(carryPath,people.contributor,carry),h.api(carryPath,people.contributor,carry)]);assert.ok(retries.every(r=>r.id===carried.id));assert.deepEqual(await state(),before);
 await h.stop();await h.start();assert.deepEqual(new Set((await h.api(navPath,people.viewer)).threads.map(c=>c.id)),new Set([second.id,carried.id]));assert.equal((await h.api(carryPath,people.contributor,carry)).id,carried.id);assert.deepEqual(await state(),before,'restart and retries publish one thread, notice set and audit');
 await h.api(carryPath,people.contributor,{...carry,anchor:{...carry.anchor,page:2}},409);assert.deepEqual(await state(),before);
 // Both a cached actor and a cached cursor lose authority on the next request, including replay.
 await h.api(`/spaces/${space}/members`,people.manager,{members:members.filter(m=>m.principal!=='contributor@example.test')});
 before=await state();await h.api(carryPath,people.contributor,carry,403);await h.api(navPath,people.contributor,undefined,403);assert.deepEqual(await state(),before);
 await h.api(`/spaces/${space}/members`,people.manager,{members});
 for(const [v,expected] of [[version,bytes],[destination,changedBytes]]){const r=await h.raw(`/api/chest/items/${key}/bytes/${v}`,people.viewer);assert.equal(r.status,200);assert.equal(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex'),createHash('sha256').update(expected).digest('hex'))}
 assert.deepEqual((await state()).versions,before.versions,'carrying a thread never changes original version history');
 await h.api(`${path}/${second.id}/resolve`,people.commenter,{decision:'resolve'});await h.api(`${path}/${carried.id}/resolve`,people.commenter,{decision:'resolve'});
 const empty=await h.api(navPath,people.viewer);assert.deepEqual(empty.threads,[]);assert.equal(empty.selected,null);assert.equal(empty.next,null);assert.equal(empty.previous,null);
 const folder=await h.api(`/items/${parent}/comments`,people.commenter,{version:null,message:'Folder review remains independent of versions.'});assert.equal(folder.payload.version,null);
 const other=await h.api('/items',people.manager,{parent,type:'folder',name:`Other ${crypto.randomUUID()}`});await h.api(`/items/${other.id}/comments/${row.id}/resolve`,people.commenter,{decision:'resolve'},404);
 return {id:key,version,comment:row.id};
}
export async function annotationBrowserFlow({h,people,parent,browser,width}){
 await mkdir('test-results',{recursive:true});
 const contexts=[];
 async function pageFor(role){const ctx=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});contexts.push(ctx);await ctx.addCookies(people[role].split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));return ctx.newPage()}
 const shot=async(page,state)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state+' fits '+width);await page.screenshot({path:`test-results/${width}-annotation-${state}.png`,fullPage:true})};
 const press=(page,scope,label)=>Promise.all([page.waitForNavigation(),scope.getByRole('button',{name:label,exact:true}).click()]);
 try{
  const {item,bytes}=await create(h,people,parent),key=item.id,version=item.payload.current,page=await pageFor('commenter');await page.goto(h.origin+`/app/items/${key}`);
  await page.getByText('Annotate a PDF',{exact:true}).click();const annotation=page.locator('form').filter({has:page.getByRole('button',{name:'Post annotation',exact:true})});
  await annotation.getByLabel('PDF page',{exact:true}).fill('2');for(const [label,value] of [['Left (%)','10'],['Top (%)','20'],['Right (%)','70'],['Bottom (%)','40']])await annotation.getByLabel(label,{exact:true}).fill(value);
  await annotation.getByLabel('Annotation',{exact:true}).fill('Confirm this original page region.');await annotation.getByLabel('Mention people (email addresses, comma separated)').fill('viewer@example.test');await annotation.getByLabel('Assign comment (email address)').fill('contributor@example.test');await shot(page,'compose');
  await press(page,annotation,'Post annotation');let view=await h.api(`/items/${key}`,people.manager),comment=view.comments[0];assert.equal(comment.version,version);assert.deepEqual(comment.anchor,target);
  let thread=page.locator(`[data-comment="${comment.id}"]`);await thread.locator('summary').filter({hasText:/^Reply$/}).click();await thread.getByLabel('Reply',{exact:true}).fill('Keep this discussion with its original.');await press(page,thread,'Post reply');
  thread=page.locator(`[data-comment="${comment.id}"]`);await press(page,thread,'Resolve thread');await page.getByText('Resolved threads (1)',{exact:true}).click();thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText(/Resolved by commenter/).waitFor();await shot(page,'resolved');
  const contributor=await pageFor('contributor');await contributor.goto(h.origin+`/app/items/${key}`);await Promise.all([contributor.waitForNavigation(),contributor.locator('[data-upload] input[data-pick]').first().setInputFiles({name:'Changed review.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf(true))})]);
  await page.reload();await page.getByText('Resolved threads (1)',{exact:true}).click();thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText(/earlier version/).waitFor();const original=thread.getByRole('link',{name:'Open original page',exact:true});assert.equal(await original.getAttribute('href'),`/api/chest/items/${key}/bytes/${version}#page=2`);const response=await page.request.get(h.origin+await original.getAttribute('href'));assert.equal(response.status(),200);assert.deepEqual(await response.body(),Buffer.from(bytes));await shot(page,'retained');
  await press(page,thread,'Reopen thread');thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByRole('button',{name:'Resolve thread',exact:true}).waitFor();assert.equal((await h.api(`/items/${key}`,people.manager)).comments[0].version,version);
  const second=await h.api(`/items/${key}/comments`,people.commenter,{message:'Review the changed first page.',version:(await h.api(`/items/${key}`,people.manager)).item.current,anchor:{...target,page:1}});
  await page.reload();const nav=page.getByRole('navigation',{name:'Unresolved PDF threads',exact:true});
  await nav.getByRole('link',{name:'Next unresolved',exact:true}).click();await page.waitForURL(new RegExp('thread='+second.id));
  await shot(page,'unresolved');
  if(width===1440){assert.equal(new URL(page.url()).searchParams.get('thread'),second.id);await nav.getByRole('link',{name:'Previous unresolved',exact:true}).click();await page.waitForURL(new RegExp('thread='+comment.id))}
  thread=page.locator(`[data-comment="${comment.id}"]`);await press(page,thread,'Resolve thread');await page.getByText('Resolved threads (1)',{exact:true}).click();
  thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText('Carry thread forward',{exact:true}).click();
  const carry=thread.locator('form').filter({has:page.getByRole('button',{name:'Create linked thread',exact:true})}),destination=(await h.api(`/items/${key}`,people.manager)).item.current;
  await carry.getByLabel('Destination PDF version').selectOption(destination);await carry.getByLabel('Destination PDF page',{exact:true}).fill('1');
  await shot(page,'carry-compose');
  await press(page,carry,'Create linked thread');
  view=await h.api(`/items/${key}`,people.manager);const carried=view.comments.find(c=>c.carriedFrom?.thread===comment.id);assert.ok(carried);
  thread=page.locator(`[data-comment="${carried.id}"]`);await thread.getByText(/Carried forward by commenter/).waitFor();await shot(page,'carried');
  const sourceLink=thread.getByRole('link',{name:/original thread/});await sourceLink.click();await page.locator(`[data-comment="${comment.id}"]`).getByText(/Resolved by commenter/).waitFor();
  if(width===1440){assert.equal(new URL(page.url()).hash,'#comment-'+comment.id);assert.equal(carried.author,'commenter@example.test');assert.equal(carried.version,destination);assert.deepEqual(carried.anchor,{kind:'pdf',page:1,region:[.1,.1,.9,.3]});assert.deepEqual(view.comments.find(c=>c.id===comment.id).anchor,target);assert.equal(view.comments.find(c=>c.id===comment.id).replies.length,1);assert.equal(view.comments.find(c=>c.id===comment.id).resolved.by,'commenter@example.test');assert.equal(view.versions.length,2)}
  // A form rendered before a replacement cannot silently target the new current version.
  await page.reload();thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText('Carry thread forward',{exact:true}).click();
  const stale=thread.locator('form').filter({has:page.getByRole('button',{name:'Create linked thread',exact:true})});await stale.getByLabel('Destination PDF version').selectOption(destination);
  await h.api(`/items/${key}/versions`,people.contributor,{base64:b64(await pdf())});await press(page,stale,'Create linked thread');
  if(width===1440){await page.getByText('annotation_target_changed',{exact:false}).waitFor();assert.equal((await h.api(`/items/${key}`,people.manager)).comments.filter(c=>c.carriedFrom).length,1)}
  const viewer=await pageFor('viewer');await viewer.goto(h.origin+`/app/items/${key}`);assert.equal(await viewer.getByRole('button',{name:'Post annotation',exact:true}).count(),0);assert.equal(await viewer.getByRole('button',{name:'Resolve thread',exact:true}).count(),0);assert.equal(await viewer.getByRole('button',{name:'Create linked thread',exact:true}).count(),0);await shot(viewer,'viewer');
  if(width===1440){const icons=viewer.locator('button,a,summary').filter({has:viewer.locator('svg')});for(const control of await icons.all()){if((await control.innerText()).trim()||!await control.isVisible())continue;assert.ok(await control.getAttribute('data-tooltip'));await control.focus();await viewer.getByRole('tooltip').waitFor({state:'visible'});await viewer.locator('h1').click();await control.hover();await viewer.waitForTimeout(350);assert.equal(await viewer.getByRole('tooltip').isVisible(),true)}}
 }finally{for(const ctx of contexts)await ctx.close()}
}
