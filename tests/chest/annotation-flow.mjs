import assert from 'node:assert/strict';
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
 const replacement=await h.api(`/items/${key}/versions`,people.contributor,{base64:b64(await pdf(true))});
 let view=await h.api(`/items/${key}`,people.manager),retained=view.comments.find(c=>c.id===row.id);
 assert.notEqual(replacement.payload.current,version);assert.equal(retained.version,version);assert.deepEqual(retained.anchor,target);assert.equal(retained.resolved.by,'commenter@example.test');assert.equal(retained.replies.length,1);
 const original=await h.raw(`/api/chest/items/${key}/bytes/${version}`,people.commenter);assert.equal(original.status,200);assert.deepEqual(new Uint8Array(await original.arrayBuffer()),bytes);
 await h.api(`${thread}/resolve`,people.contributor,{decision:'reopen'});view=await h.api(`/items/${key}`,people.manager);assert.equal(view.comments.find(c=>c.id===row.id).resolved,null);
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
  let thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText('Reply',{exact:true}).click();await thread.getByLabel('Reply',{exact:true}).fill('Keep this discussion with its original.');await press(page,thread,'Post reply');
  thread=page.locator(`[data-comment="${comment.id}"]`);await press(page,thread,'Resolve thread');await page.getByText('Resolved threads (1)',{exact:true}).click();thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText(/Resolved by commenter/).waitFor();await shot(page,'resolved');
  const contributor=await pageFor('contributor');await contributor.goto(h.origin+`/app/items/${key}`);await Promise.all([contributor.waitForNavigation(),contributor.locator('[data-upload] input[data-pick]').first().setInputFiles({name:'Changed review.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf(true))})]);
  await page.reload();await page.getByText('Resolved threads (1)',{exact:true}).click();thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByText(/earlier version/).waitFor();const original=thread.getByRole('link',{name:'Open original page',exact:true});assert.equal(await original.getAttribute('href'),`/api/chest/items/${key}/bytes/${version}#page=2`);const response=await page.request.get(h.origin+await original.getAttribute('href'));assert.equal(response.status(),200);assert.deepEqual(await response.body(),Buffer.from(bytes));await shot(page,'retained');
  await press(page,thread,'Reopen thread');thread=page.locator(`[data-comment="${comment.id}"]`);await thread.getByRole('button',{name:'Resolve thread',exact:true}).waitFor();assert.equal((await h.api(`/items/${key}`,people.manager)).comments[0].version,version);
  const viewer=await pageFor('viewer');await viewer.goto(h.origin+`/app/items/${key}`);assert.equal(await viewer.getByRole('button',{name:'Post annotation',exact:true}).count(),0);assert.equal(await viewer.getByRole('button',{name:'Resolve thread',exact:true}).count(),0);await shot(viewer,'viewer');
 }finally{for(const ctx of contexts)await ctx.close()}
}
