import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {annotationFlow,annotationBrowserFlow} from './annotation-flow.mjs';
import {docx} from './office-fixtures.mjs';
import {roleBrowserMatrix,roleFolderHttpMatrix} from './role-browser-matrix.mjs';
const b64=v=>Buffer.from(v).toString('base64');
export async function roleReviewFlow({browserProof=false}={}){
 const h=await harness();let browser;
 try{
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL),setup=new FormData();setup.set('confirm','yes');await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin},body:setup});
  const roles=['viewer','commenter','contributor','content_manager','manager'],people={};
  for(const role of [...roles,'outsider']){await h.api('/people',owner,{action:'invite',email:`${role}@example.test`,name:role});people[role]=await h.signIn(`${role}@example.test`,true)}
  const space=await h.api('/spaces',people.manager,{name:'Review operations'}),members=roles.map(role=>({principal:`${role}@example.test`,role}));await h.api(`/spaces/${space.id}/members`,people.manager,{members});
  const folder=await h.api('/items',people.manager,{space:space.id,type:'folder',name:'Agreements'});
  const create=(bytes=docx())=>h.api('/items',people.manager,{parent:folder.id,name:`Terms ${crypto.randomUUID()}.docx`,base64:b64(bytes)});
  const sourceParts=unzipSync(docx()),namespace=strFromU8(sourceParts['word/document.xml']).match(/xmlns:w="([^"]+)"/)[1],sourceRelationship=strFromU8(sourceParts['_rels/.rels']).replace('officeDocument','header').replace('word/document.xml','header1.xml');sourceParts['word/_rels/document.xml.rels']=strToU8(sourceRelationship);sourceParts['word/header1.xml']=strToU8(`<w:hdr xmlns:w="${namespace}"><w:p><w:r><w:t>Reference header</w:t></w:r></w:p></w:hdr>`);
  const snapshot=async id=>{const view=await h.api(`/items/${id}`,people.manager);return {item:view.item,versions:view.versions,comments:view.comments,grants:view.grants}};
  const file=await create(zipSync(sourceParts)),id=file.id,base=await h.api(`/items/${id}/office?edit=true`,people.commenter),field=base.fields.find(f=>f.value==='Payment within thirty days.');assert.ok(field);assert.equal(base.mode,'suggest');
  const change={version:base.version,changes:{[field.key]:'Payment within forty-five days.'}};
  let before=await snapshot(id);const direct=await h.api(`/items/${id}/office`,people.commenter,change,403);assert.equal(direct.error,'suggest_only');assert.deepEqual(await snapshot(id),before);
  assert.equal((await h.api(`/items/${id}/office?edit=true`,people.viewer)).mode,'readonly');await h.api(`/items/${id}/office`,people.viewer,change,403);await h.api(`/items/${id}/office-suggestions`,people.viewer,change,403);assert.deepEqual(await snapshot(id),before);
  const proposal=await h.api(`/items/${id}/office-suggestions`,people.commenter,change),raw=await h.raw(`/api/chest/items/${id}/bytes/${proposal.version}?download=true`,people.manager),zip=unzipSync(new Uint8Array(await raw.arrayBuffer())),xml=strFromU8(zip['word/document.xml']);assert.match(xml,/<w:ins[^>]*w:author="commenter@example.test"/);assert.match(xml,/<w:delText[^>]*>Payment within thirty days\./);assert.match(xml,/Payment within forty-five days\./);assert.equal(strFromU8(zip['customXml/item1.xml']),'<custody>keep this unedited part</custody>');
  assert.match((await h.api(`/items/${id}/office`,people.viewer)).html,/<ins title="commenter@example.test">/);
  before=await snapshot(id);for(const role of ['viewer','commenter'])await h.api(`/items/${id}/office-decisions`,people[role],{version:proposal.version,decision:'accept'},403);assert.deepEqual(await snapshot(id),before);
  await h.api(`/items/${id}/office-decisions`,people.contributor,{version:base.version,decision:'accept'},409);assert.deepEqual(await snapshot(id),before);
  const accepted=await h.api(`/items/${id}/office-decisions`,people.contributor,{version:proposal.version,decision:'accept'});let view=await h.api(`/items/${id}`,people.manager);assert.equal(view.versions[0].actor,'contributor@example.test');assert.equal(view.versions[0].suggestion.author,'commenter@example.test');assert.equal(view.versions[0].suggestion.decision,'accept');assert.equal(view.versions.length,3);assert.match((await h.api(`/items/${id}/office`,people.viewer)).html,/forty-five/);
  let decisionXml=strFromU8(unzipSync(new Uint8Array(await(await h.raw(`/api/chest/items/${id}/bytes/${accepted.version}?download=true`,people.manager)).arrayBuffer()))['word/document.xml']);assert.ok(!decisionXml.includes('<w:ins')&&!decisionXml.includes('<w:del'));const decidedParts=unzipSync(new Uint8Array(await(await h.raw(`/api/chest/items/${id}/bytes/${accepted.version}?download=true`,people.manager)).arrayBuffer()));for(const [part,bytes] of Object.entries(sourceParts))if(part!=='word/document.xml')assert.deepEqual(decidedParts[part],bytes,'decision preserves '+part);
  const second=await h.api(`/items/${id}/office-suggestions`,people.commenter,{version:accepted.version,changes:{[field.key]:'Payment within sixty days.'}});await h.stop();await h.start();
  const rejected=await h.api(`/items/${id}/office-decisions`,people.contributor,{version:second.version,decision:'reject'});assert.match((await h.api(`/items/${id}/office`,people.viewer)).html,/forty-five/);assert.ok(!(await h.api(`/items/${id}/office`,people.viewer)).html.includes('sixty'));
  await h.api(`/items/${id}/office-decisions`,people.contributor,{version:second.version,decision:'reject'},409);assert.equal((await h.api(`/items/${id}`,people.manager)).versions.length,5);
  const comment=await h.api(`/items/${id}/comments`,people.commenter,{message:'Please check the revised terms.',mentions:['viewer@example.test'],assignee:'contributor@example.test'});assert.equal(comment.payload.assignee,'contributor@example.test');assert.ok((await h.api('/notices',people.contributor)).some(n=>n.payload.type==='comment.assignment'&&n.payload.item===id));assert.ok(h.mails.some(m=>[m.to].flat().includes('viewer@example.test')&&m.text.includes('mentioned')));
  before=await snapshot(id);await h.api(`/items/${id}/comments`,people.commenter,{message:'No implied access',assignee:'outsider@example.test'},403);await h.api(`/items/${id}`,people.outsider,undefined,403);assert.deepEqual(await snapshot(id),before);
  await annotationFlow({h,people,parent:folder.id});
  // Every current role's ordinary content and management rights, including refused mutations.
  for(const [index,role] of roles.entries()){
   const cookie=people[role],item=await create(),key=item.id,version=item.payload.current;
   const attempt=async(path,body,permitted)=>{const state=async()=>({item:path===`/items/${key}/restore`?await h.api('/trash',people.manager):await snapshot(key),members:(await h.api(`/spaces/${space.id}`,people.manager)).members}),before=permitted?null:await state(),result=await h.api(path,cookie,body,permitted?200:403);if(!permitted)assert.deepEqual(await state(),before,role+' '+path+' changes no state');return result};
   const original=await snapshot(key);assert.equal((await h.api(`/items/${key}`,cookie)).role,role);assert.equal((await h.raw(`/api/chest/items/${key}/bytes/${version}?download=true`,cookie)).status,200);assert.ok((await h.api(`/items/${key}`,cookie)).versions.some(v=>v.id===version));
   const suggestionBase=await h.api(`/items/${key}/office?edit=true&mode=suggest`,cookie);assert.equal(suggestionBase.mode,index>=1?'suggest':'readonly');
   const first=suggestionBase.fields[0],suggested=await attempt(`/items/${key}/office-suggestions`,{version:suggestionBase.version,changes:{[first.key]:`Proposed by ${role}`}},index>=1);
   if(index>=1){const beforeDecision=await snapshot(key);await attempt(`/items/${key}/office-decisions`,{version:suggested.version,decision:'accept'},index>=2);if(index===1){assert.deepEqual(await snapshot(key),beforeDecision);await h.api(`/items/${key}/office-decisions`,people.manager,{version:suggested.version,decision:'accept'})}}
   await attempt(`/items/${key}/comments`,{message:'Role review'},index>=1);
   await attempt(`/items/${key}/versions`,{base64:b64(docx())},index>=2);
   await attempt(`/items/${key}/versions/${version}/restore`,{},index>=2);
   await attempt(`/items/${key}/move`,{space:space.id,parent:null},index>=3);
   await attempt(`/items/${key}/copy`,{space:space.id,parent:null,name:'Copy '+item.payload.name},index>=3);
   await attempt(`/items/${key}/shares`,{principal:'outsider@example.test',role:'viewer'},index>=3);
   await attempt(`/spaces/${space.id}/member`,{action:'role',principal:'viewer@example.test',role:'viewer'},index===4);
   if(index<1)assert.deepEqual(await snapshot(key),original);
   await attempt(`/items/${key}/trash`,{},index>=3);
   if(index<3)await h.api(`/items/${key}/trash`,people.manager,{});
   await attempt(`/items/${key}/restore`,{},index>=3);if(index<3)await h.api(`/items/${key}/restore`,people.manager,{});
  }
  await roleFolderHttpMatrix(h,people,roles,space);
  // Folder inheritance, reviewer duty and personal grants carry the same live role boundary.
  const restricted=await h.api('/items',people.manager,{space:space.id,type:'folder',name:'Restricted reviews'}),privateFile=await h.api('/items',people.manager,{parent:restricted.id,name:'Review.docx',base64:b64(docx())});
  await h.api(`/items/${restricted.id}/governance`,people.manager,{reviewer:'outsider@example.test'});await h.api(`/items/${privateFile.id}`,people.outsider,undefined,403);
  await h.api(`/items/${restricted.id}/settings`,people.manager,{restricted:true});for(const role of roles.slice(0,-1)){await h.api(`/items/${restricted.id}`,people[role],undefined,403);await h.api(`/items/${privateFile.id}`,people[role],undefined,403)}
  await h.api(`/items/${restricted.id}/shares`,people.manager,{principal:'commenter@example.test',role:'commenter'});assert.equal((await h.api(`/items/${privateFile.id}`,people.commenter)).role,'commenter');
  await h.api(`/items/${restricted.id}/unshare`,people.manager,{principal:'commenter@example.test'});await h.api(`/items/${privateFile.id}`,people.commenter,undefined,403);
  const personal=(await h.api('/files',people.manager)).personal;
  for(const [index,role] of ['viewer','commenter','editor'].entries()){
   const cookie=people[roles[index]],item=await h.api('/items',people.manager,{space:personal,name:`Personal ${role}.docx`,base64:b64(docx())}),key=item.id;
   await h.api(`/items/${key}/shares`,people.manager,{principal:`${roles[index]}@example.test`,role});assert.equal((await h.api(`/items/${key}`,cookie)).role,role);
   await h.api(`/items/${key}/comments`,cookie,{message:'Personal review'},index>=1?200:403);await h.api(`/items/${key}/versions`,cookie,{base64:b64(docx())},index===2?200:403);
   await h.api(`/items/${key}/shares`,cookie,{principal:'outsider@example.test',role:'viewer'},index===2?200:403);await h.api(`/items/${key}/trash`,cookie,{},index===2?200:403);if(index===2)await h.api(`/items/${key}/restore`,cookie,{});
  }
  // Originals are refused at each transport, including jobs queued before the setting changes.
  for(const role of ['viewer','commenter']){
   const cookie=people[role],job=await h.api('/bulk',cookie,{action:'download',items:[id]}),device=await h.api('/devices',cookie,{name:'Review device',platform:'macos'});
   for(const scope of ['space','file']){
    await h.api(scope==='space'?`/spaces/${space.id}/settings`:`/items/${id}/settings`,people.manager,{noDownload:true});
    const extracted=await h.api(`/items/${id}/office`,cookie,undefined,403);assert.equal(extracted.error,'download_restricted');
    for(const suffix of ['', '?download=true'])for(const range of [false,true])assert.equal((await h.fetch(`/api/chest/items/${id}/bytes/${rejected.version}${suffix}`,{headers:{cookie,...range?{range:'bytes=0-63'}:{}}})).status,403);
    assert.equal((await h.fetch(`/api/chest/sync/items/${id}/content`,{headers:{authorization:`Bearer ${device.token}`}})).status,403);
    const archive=unzipSync(new Uint8Array(await(await h.raw(`/api/chest/bulk/${job.id}/archive`,cookie)).arrayBuffer())),manifest=JSON.parse(strFromU8(archive['chest-manifest.json']));assert.equal(manifest.included.length,0);assert.equal(manifest.excluded[0].reason,'download_restricted');assert.equal(Object.keys(archive).length,1);
    await h.api(scope==='space'?`/spaces/${space.id}/settings`:`/items/${id}/settings`,people.manager,{noDownload:false});
   }
  }
  await h.api(`/spaces/${space.id}/settings`,people.manager,{editorSharing:false});await h.api(`/items/${id}/shares`,people.content_manager,{principal:'outsider@example.test',role:'viewer'},403);await h.api(`/items/${id}/shares`,people.manager,{principal:'outsider@example.test',role:'viewer'});await h.api(`/spaces/${space.id}/settings`,people.manager,{editorSharing:true});
  console.log('ROLE-001 HTTP roles and original transport checks passed');
  if(browserProof){
   await mkdir('test-results',{recursive:true});browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?['--no-sandbox']:[])]});
   for(const width of [1440,390]){
    const contexts={};for(const role of ['viewer','commenter','contributor']){const ctx=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await ctx.addCookies(people[role].split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));contexts[role]=ctx}
    const item=await create(),p=await contexts.commenter.newPage();await p.goto(h.origin+`/app/items/${item.id}?edit=1`);await p.getByRole('heading',{name:'Suggest changes',exact:true}).waitFor();const form=p.locator('form').filter({has:p.getByRole('button',{name:'Submit suggestions',exact:true})});await form.locator('textarea').filter({hasText:'Payment within thirty days.'}).fill('Review at sixty days.');
    const shot=async(page,state)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state+' fits '+width);await page.screenshot({path:`test-results/${width}-roles-${state}.png`,fullPage:true})};
    await shot(p,'suggest');await Promise.all([p.waitForNavigation(),form.getByRole('button',{name:'Submit suggestions',exact:true}).click()]);await p.getByRole('heading',{name:'Suggested changes',exact:true}).waitFor();await shot(p,'pending');
    const c=await contexts.contributor.newPage();await c.goto(h.origin+`/app/items/${item.id}`);await shot(c,'decision');await Promise.all([c.waitForNavigation(),c.getByRole('button',{name:'Accept suggestions',exact:true}).click()]);assert.match((await h.api(`/items/${item.id}/office`,people.viewer)).html,/Review at sixty days/);
    await p.goto(h.origin+`/app/items/${item.id}`);await p.getByLabel('Comment',{exact:true}).fill('Please confirm these terms.');await p.getByLabel('Mention people (email addresses, comma separated)').fill('viewer@example.test');await p.getByLabel('Assign comment (email address)').fill('contributor@example.test');await Promise.all([p.waitForNavigation(),p.getByRole('button',{name:'Post comment',exact:true}).click()]);await p.getByText('Assigned to contributor@example.test',{exact:true}).waitFor();await shot(p,'assigned');
    const v=await contexts.viewer.newPage();await v.goto(h.origin+`/app/items/${item.id}?edit=1`);await v.getByRole('heading',{name:'Read-only editor',exact:true}).waitFor();assert.equal(await v.getByRole('button',{name:'Save new version',exact:true}).count(),0);await shot(v,'readonly');
    // Audit existing icon controls on the changed file screen; labels appear on focus and delayed hover.
    const icons=v.locator('button,a,summary').filter({has:v.locator('svg')});for(const control of await icons.all()){if((await control.innerText()).trim()||!await control.isVisible())continue;assert.ok(await control.getAttribute('data-tooltip'),'icon control has a tooltip');await control.focus();await v.getByRole('tooltip').waitFor({state:'visible'});await v.locator('h1').click();await control.hover();await v.waitForTimeout(350);assert.equal(await v.getByRole('tooltip').isVisible(),true)}
    await roleBrowserMatrix(h,browser,people,roles,space,width);
    await annotationBrowserFlow({h,people,parent:folder.id,browser,width});
    for(const ctx of Object.values(contexts))await ctx.close();
   }
  }
  const changed=members.map(m=>m.role==='commenter'?{...m,role:'viewer'}:m);await h.api(`/spaces/${space.id}/members`,people.manager,{members:changed});before=await snapshot(id);await h.api(`/items/${id}/office-suggestions`,people.commenter,{version:rejected.version,changes:{[field.key]:'Downgraded edit'}},403);await h.api(`/items/${id}/comments`,people.commenter,{message:'Downgraded comment'},403);assert.deepEqual(await snapshot(id),before);
  console.log('ROLE-001 tracked suggestion decisions, role HTTP rights, comment recipients, original transport restrictions and '+(browserProof?'1440 and 390 editor screens':'live downgrade')+' passed');
 }finally{await browser?.close();await h.close()}
}
