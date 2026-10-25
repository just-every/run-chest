import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {docx} from './office-fixtures.mjs';
import {unzipSync,strFromU8} from 'fflate';

// Actual page controls are submitted after a live downgrade as well as at their permitted role.
// A stale form is still a real browser door: the server must refuse it without changing the graph.
export async function roleBrowserMatrix(h,browser,people,roles,space,width){
 const manager=people.manager;
 const setRole=async(role,value)=>{const view=await h.api(`/spaces/${space.id}`,manager);return h.api(`/spaces/${space.id}/members`,manager,{members:view.members.map(m=>({principal:m.principal,role:m.principal===`${role}@example.test`?value:m.role}))})};
 const shot=async(p,state)=>{await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state+' fits '+width);await p.screenshot({path:`test-results/${width}-matrix-${state}.png`,fullPage:true})};
 const state=async(id)=>{const d=await h.api(`/items/${id}`,manager);return {item:d.item,versions:d.versions,comments:d.comments,grants:d.grants,children:d.children,members:(await h.api(`/spaces/${space.id}`,manager)).members}};
 for(const [rank,role] of roles.entries()){
  const ctx=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true,acceptDownloads:true});
  await ctx.addCookies(people[role].split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));
  const p=await ctx.newPage(),press=async(scope,label)=>{const [r]=await Promise.all([p.waitForNavigation(),scope.getByRole('button',{name:label,exact:true}).click()]);return r};
  const go=path=>p.goto(h.origin+path),form=path=>p.locator('form').filter({has:p.locator(`input[name=path][value="${path}"]`)});
  // Load a permitted form, downgrade in another session, then use its original visible submit control.
  const denied=async(id,url,prepare,label,scope)=>{
   await setRole(role,'manager');await go(url);if(prepare)await prepare();await setRole(role,role);
   const before=await state(id),r=await press(scope?scope():p,label);assert.equal(r.status(),403,`${role} ${label} is refused`);assert.deepEqual(await state(id),before,`${role} ${label} changes no state`);
  };
  try{
   const folder=await h.api('/items',manager,{space:space.id,type:'folder',name:`Supplier reviews ${width} ${role}`}),destination=await h.api('/items',manager,{space:space.id,type:'folder',name:`Completed reviews ${width} ${role}`});
   const source=docx(),file=await h.api('/items',manager,{parent:folder.id,name:'Payment terms.docx',base64:Buffer.from(source).toString('base64')}),id=file.id,original=file.payload.current,url=`/app/items/${id}`,folderUrl=`/app/items/${folder.id}`;
   await go(folderUrl);await p.getByRole('heading',{name:folder.payload.name,exact:true,level:1}).waitFor();await shot(p,`folder-${role}`);
   for(const control of await p.locator('button,a,summary').filter({has:p.locator('svg')}).all()){if((await control.innerText()).trim()||!await control.isVisible())continue;assert.ok(await control.getAttribute('data-tooltip'));await control.focus();await p.getByRole('tooltip').waitFor({state:'visible'});await p.locator('h1').click();await control.hover();await p.waitForTimeout(350);assert.equal(await p.getByRole('tooltip').isVisible(),true)}
   await go(`/app/spaces/${space.id}`);await p.locator(`input[name=items][value="${folder.id}"]`).check();await press(p,'Actions for selected items');await p.getByLabel('Action',{exact:true}).selectOption('download');await press(p,'Start selected action');await p.locator('[data-bulk-pending="false"]').waitFor();
   const archive=p.waitForEvent('download');await p.getByRole('link',{name:'Download selection ZIP',exact:true}).click();const zip=unzipSync(new Uint8Array(await readFile(await(await archive).path()))),manifest=JSON.parse(strFromU8(zip['chest-manifest.json']));assert.equal(manifest.included.length,1);assert.equal(manifest.included[0].sha256,file.payload.versions[0].checksum);await go(folderUrl);
   await p.getByRole('link',{name:'Payment terms.docx',exact:true}).first().click();await p.getByRole('heading',{name:'Payment terms.docx',exact:true}).waitFor();
   assert.equal(await p.locator('article.ver').count(),1);const download=p.waitForEvent('download');await p.locator('.doc-actions').getByRole('link',{name:'Download',exact:true}).click();assert.deepEqual(new Uint8Array(await readFile(await(await download).path())),source);
   await shot(p,`file-${role}`);
   const comment=async(target,targetUrl)=>{
    if(rank>=1){await go(targetUrl);await p.getByLabel('Comment',{exact:true}).fill(`Please confirm the ${role} review.`);await press(p,'Post comment');await p.getByText(`Please confirm the ${role} review.`,{exact:true}).waitFor()}
    else await denied(target,targetUrl,()=>p.getByLabel('Comment',{exact:true}).fill('Stale comment'),'Post comment');
   };
   await comment(id,url);await comment(folder.id,folderUrl);
   await go(url);await p.getByRole('link',{name:rank>=2?'Edit in browser':rank===1?'Suggest changes':'Open read-only editor',exact:true}).click();
   await p.getByRole('heading',{name:rank>=2?'Edit in browser':rank===1?'Suggest changes':'Read-only editor',exact:true}).waitFor();
   const suggestUrl=url+'?edit=1&mode=suggest';
   if(rank>=1){await go(suggestUrl);await form(`/items/${id}/office-suggestions`).locator('textarea').first().fill(`Suggested payment terms by ${role}.`);await press(p,'Submit suggestions')}
   else await denied(id,suggestUrl,()=>form(`/items/${id}/office-suggestions`).locator('textarea').first().fill('Viewer suggestion'),'Submit suggestions');
   if(rank===0){const model=await h.api(`/items/${id}/office?edit=true`,manager);await h.api(`/items/${id}/office-suggestions`,people.commenter,{version:model.version,changes:{[model.fields[0].key]:'Pending decision for viewer'}})}
   if(rank>=2){await go(url);await press(p,'Accept suggestions');assert.equal((await h.api(`/items/${id}`,manager)).versions[0].suggestion.decidedBy,`${role}@example.test`)}
   else {await denied(id,url,null,'Accept suggestions');const d=await h.api(`/items/${id}`,manager);await h.api(`/items/${id}/office-decisions`,manager,{version:d.item.current,decision:'reject'})}
   // Direct editor saves and replacements are a separate permission from commenting.
   if(rank>=2){await go(url+'?edit=1');await form(`/items/${id}/office`).locator('textarea').first().fill(`Approved terms edited by ${role}.`);await press(p,'Save new version');
    const count=(await h.api(`/items/${id}`,manager)).versions.length;await Promise.all([p.waitForNavigation(),p.locator('[data-upload] input[data-pick]').first().setInputFiles({name:'Payment terms.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(docx())})]);assert.equal((await h.api(`/items/${id}`,manager)).versions.length,count+1);
    await press(form(`/items/${id}/versions/${original}/restore`),'Restore as current version');assert.equal((await h.api(`/items/${id}`,manager)).versions[0].restoredFrom,original);
   }else{
    await denied(id,url+'?edit=1',()=>form(`/items/${id}/office`).locator('textarea').first().fill('Forbidden direct edit'),'Save new version');
    await denied(id,url,async()=>{await p.locator('[data-upload-fallback]').evaluate(e=>{e.hidden=false;e.open=true});await p.getByLabel('Replacement file',{exact:true}).setInputFiles({name:'Payment terms.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(docx())})},'Upload new version');
    await denied(id,url,null,'Restore as current version',()=>form(`/items/${id}/versions/${original}/restore`));
   }
   // The folder's add flow proves that the role propagates into its children.
   if(rank>=2){await go(folderUrl);await Promise.all([p.waitForNavigation(),p.locator('[data-upload] input[data-pick]').first().setInputFiles({name:`Delivery schedule ${role}.txt`,mimeType:'text/plain',buffer:Buffer.from('Delivery is due next week.')})]);assert.ok((await h.api(`/items/${folder.id}`,manager)).children.some(c=>c.name===`Delivery schedule ${role}.txt`))}
   else await denied(folder.id,folderUrl,async()=>{await p.locator('[data-upload-fallback]').evaluate(e=>{e.hidden=false;e.open=true});await p.getByLabel('File',{exact:true}).setInputFiles({name:'Forbidden arrival.txt',mimeType:'text/plain',buffer:Buffer.from('No arrival')})},'Upload file');
   // Copy, move, sharing, trash and recovery operate on both the folder and the file.
   for(const target of [file,folder]){
    const key=target.id,base=`/app/items/${key}`,manage=base+(target.payload.type==='folder'?'?manage':'');
    const fillCopy=async()=>{await p.getByText('Move',{exact:true}).click();await p.getByLabel(/^Copy destination/).selectOption(`folder:${destination.id}`);await p.getByLabel('Copy name',{exact:true}).fill(`Copy of ${target.payload.name}`);if(role==='manager')await shot(p,`copy-${target.payload.type}`)};
    const fillMove=async()=>{await p.getByText('Move',{exact:true}).click();await p.getByLabel(/^Destination/).selectOption(`folder:${destination.id}`)};
    const fillShare=async()=>{await p.getByLabel(/^Person or group/).selectOption('outsider@example.test');await form(`/items/${key}/shares`).getByLabel(/^Role/).selectOption('viewer')};
    if(rank>=3){await go(manage);await fillCopy();await press(p,'Copy here');assert.ok((await h.api(`/items/${destination.id}`,manager)).children.some(c=>c.name===`Copy of ${target.payload.name}`));await go(manage);await fillShare();await press(form(`/items/${key}/shares`),'Share');assert.ok((await h.api(`/items/${key}`,manager)).grants.some(g=>g.principal==='outsider@example.test'));
     await go(base);await fillMove();await press(p,'Move here');assert.equal((await h.api(`/items/${key}`,manager)).item.parent,destination.id);await go(base);await press(p,'Move to trash');await go('/app/files/trash');await press(form(`/items/${key}/restore`),'Restore');assert.ok(!(await h.api('/trash',manager)).some(t=>t.id===key));
    }else{
     await denied(key,manage,fillCopy,'Copy here');await denied(key,manage,fillShare,'Share',()=>form(`/items/${key}/shares`));await denied(key,base,fillMove,'Move here');await denied(key,base,null,'Move to trash');
     await h.api(`/items/${key}/trash`,manager,{});await setRole(role,'manager');await go('/app/files/trash');await setRole(role,role);const [r]=await Promise.all([p.waitForNavigation(),form(`/items/${key}/restore`).getByRole('button',{name:'Restore',exact:true}).click()]);assert.equal(r.status(),403);await h.api(`/items/${key}/restore`,manager,{});
    }
    await shot(p,`${target.payload.type}-end-${role}`);
   }
   if(role==='content_manager'){
    await h.api(`/spaces/${space.id}/settings`,manager,{editorSharing:false});
    const sharePath=`/items/${id}/shares`,fill=async()=>{await p.getByLabel(/^Person or group/).selectOption('outsider@example.test');await form(sharePath).getByLabel(/^Role/).selectOption('viewer')};
    await denied(id,url,fill,'Share',()=>form(sharePath));
    await setRole(role,'manager');await go(url);await fill();await press(form(sharePath),'Share');assert.ok((await h.api(`/items/${id}`,manager)).grants.some(g=>g.principal==='outsider@example.test'));
    await setRole(role,role);await h.api(`/spaces/${space.id}/settings`,manager,{editorSharing:true});
   }
   // Membership remains a manager action, regardless of which item was open.
   const memberUrl=`/app/spaces/${space.id}?manage`,memberPath=`/spaces/${space.id}/member`,memberForm=()=>form(memberPath).filter({has:p.locator('input[name=principal][value="outsider@example.test"]')});
   await h.api(`/spaces/${space.id}/member`,manager,{action:'add',principal:'outsider@example.test',role:'viewer'});
   if(rank===4){await go(memberUrl);await memberForm().getByLabel(/^Role for/).selectOption('commenter');await press(memberForm(),'Change role')}
   else await denied(id,memberUrl,()=>memberForm().getByLabel(/^Role for/).selectOption('commenter'),'Change role',memberForm);
   await h.api(`/spaces/${space.id}/member`,manager,{action:'remove',principal:'outsider@example.test'});
   // A retained download control also uses the newly restricted role on its next request.
   await setRole(role,'manager');await go(url);await h.api(`/spaces/${space.id}/settings`,manager,{noDownload:true});await setRole(role,role);
   if(rank<2){const r=await p.request.get(h.origin+`/api/chest/items/${id}/bytes/${original}?download=true`);assert.equal(r.status(),403)}
   await h.api(`/spaces/${space.id}/settings`,manager,{noDownload:false});await go(url);await shot(p,`final-${role}`);console.log(`ROLE-001 ${role} folder and file controls passed at ${width}`);
  }finally{await setRole(role,role);await ctx.close()}
 }
 console.log(`ROLE-001 real folder and file browser role matrix passed at ${width}`);
}

export async function roleFolderHttpMatrix(h,people,roles,space){
 for(const [rank,role] of roles.entries()){
  const cookie=people[role],folder=await h.api('/items',people.manager,{space:space.id,type:'folder',name:`HTTP ${role} ${crypto.randomUUID()}`}),key=folder.id;
  const bytes=Buffer.from('The delivery schedule remains available.'),child=await h.api('/items',people.manager,{parent:key,name:'Delivery schedule.txt',base64:bytes.toString('base64')});
  const job=await h.api('/bulk',cookie,{action:'download',items:[key]}),response=await h.raw(`/api/chest/bulk/${job.id}/archive`,cookie);assert.equal(response.status,200);
  const archive=unzipSync(new Uint8Array(await response.arrayBuffer())),manifest=JSON.parse(strFromU8(archive['chest-manifest.json']));assert.equal(manifest.included.length,1);assert.equal(manifest.included[0].sha256,child.payload.versions[0].checksum);
  const state=async()=>{const d=await h.api(`/items/${key}`,people.manager);return {item:d.item,children:d.children,comments:d.comments,grants:d.grants}};
  assert.equal((await h.api(`/items/${key}`,cookie)).role,role);
  for(const [action,body,permitted] of [['comments',{message:'Folder role review'},rank>=1],['copy',{space:space.id,name:`Copied ${folder.payload.name}`},rank>=3],['move',{space:space.id,parent:null},rank>=3],['shares',{principal:'outsider@example.test',role:'viewer'},rank>=3],['settings',{restricted:false},rank===4]]){
   const before=await state();await h.api(`/items/${key}/${action}`,cookie,body,permitted?200:403);if(!permitted)assert.deepEqual(await state(),before,role+' '+action+' changes no folder state');
  }
  const before=await state();await h.api('/items',cookie,{parent:key,name:'Arrival.txt',base64:Buffer.from('Expected arrival').toString('base64')},rank>=2?200:403);if(rank<2)assert.deepEqual(await state(),before);
  const beforeTrash=await state();await h.api(`/items/${key}/trash`,cookie,{},rank>=3?200:403);if(rank<3){assert.deepEqual(await state(),beforeTrash);await h.api(`/items/${key}/trash`,people.manager,{})}
  const trash=await h.api('/trash',people.manager);await h.api(`/items/${key}/restore`,cookie,{},rank>=3?200:403);if(rank<3){assert.deepEqual(await h.api('/trash',people.manager),trash);await h.api(`/items/${key}/restore`,people.manager,{})}
 }
}
