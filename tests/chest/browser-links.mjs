import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
import {renderEdge} from './render-edge.mjs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
const renderer=await renderEdge(),h=await harness(renderer),cookies={},original=docx();let browser;
const parts=unzipSync(original);parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Payment within thirty days.','Payment within sixty days after delivery.'));const replacement=zipSync(parts);
const b64=x=>Buffer.from(x).toString('base64');
const go=(p,path)=>p.goto(h.origin+path);
const press=async(p,name)=>{const page=p.page?p.page():p;return Promise.all([page.waitForNavigation(),p.getByRole('button',{name,exact:true}).click()])};
const fit=async(p,name,width)=>{
 await p.waitForLoadState('load');await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>scrollTo(0,0));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);
 const path=`test-results/${width}-links-${name}`;
 await p.screenshot({path:path+'.png',fullPage:true,...(name.startsWith('created')?{mask:[p.locator('pre.receipt')]}:{})});
 if(['create-pinned','folder-links','restricted-default','restricted-list','restricted-revoked'].includes(name))await p.locator('.side-card').filter({has:p.getByRole('heading',{name:'Create link',exact:true})}).screenshot({path:path+'-card.png'});
 if(name==='policy')await p.locator('#link-policy').screenshot({path:path+'-card.png'});
};
try{
 await mkdir('test-results',{recursive:true});await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'});cookies.owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:cookies.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 await h.api('/people',cookies.owner,{action:'invite',email:'jordan@example.test',name:'Jordan Lee'});cookies.jordan=await h.signIn('jordan@example.test',true);
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390]){
  await h.api('/link-policy',cookies.owner,{scope:'organisation',allowPublic:true,allowOrganisation:true,allowDiscovery:true,defaultAudience:'organisation',defaultRole:'viewer'});
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(cookies.owner.split('; ').map(s=>{const i=s.indexOf('=');return {name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));const a=await context.newPage(),guest=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true}),g=await guest.newPage();
  const space=(await h.api('/files',cookies.owner)).personal,item=await h.api('/items',cookies.owner,{space,type:'file',name:`Harbor terms ${width}.docx`,base64:b64(original)}),v=item.payload.current;
  await h.api(`/items/${item.id}/versions`,cookies.owner,{filename:item.payload.name,base64:b64(replacement)});
  await h.api(`/items/${item.id}/links`,cookies.owner,{audience:'organisation',discoverable:true});
  const folder=await h.api('/items',cookies.owner,{space,type:'folder',name:`Harbor delivery folder ${width}`});await go(a,`/app/items/${folder.id}?manage`);await fit(a,'folder-links',width);
  await go(a,`/app/items/${item.id}`);const form=a.locator('form').filter({has:a.getByRole('button',{name:'Create link',exact:true})});
  await form.getByLabel('Audience').selectOption('public');await form.getByLabel('Allowed link version').selectOption('pinned:'+v);await form.getByLabel('Link password').fill('harbor-delivery-brief');await form.getByLabel('Expires').fill('2099-11-30');await form.getByLabel('Link download limit').fill('10');await fit(a,'create-pinned',width);await press(form,'Create link');await fit(a,'created',width);const url=(await a.locator('pre.receipt').innerText()).trim(),path=new URL(url).pathname;
  await go(g,path);await fit(g,'password',width);await g.getByLabel('Password',{exact:true}).fill('wrong');await press(g,'Open');await fit(g,'wrong-password',width);await g.getByLabel('Password',{exact:true}).fill('harbor-delivery-brief');await press(g,'Open');await fit(g,'public-file',width);
  const preview=g.getByRole('link',{name:'Preview',exact:true});await preview.click();await fit(g,'pinned-preview',width);await go(g,path);
  for(let i=0;i<3;i++){const [d]=await Promise.all([g.waitForEvent('download'),g.getByRole('link',{name:'Download',exact:true}).click()]);assert.deepEqual(await readFile(await d.path()),Buffer.from(original))}
  await go(a,'/app/links');const row=a.locator('li').filter({hasText:item.payload.name}).filter({hasText:'Link for anyone'}).filter({has:a.getByRole('button',{name:'Revoke',exact:true})});assert.equal((await h.api(`/items/${item.id}`,cookies.owner)).publicLinks.find(l=>l.version===v&&l.password)?.downloads,3);await fit(a,'usage',width);await press(row,'Revoke');const gone=await go(g,path);assert.equal(gone.status(),410);await fit(g,'revoked',width);
  // A preview-only link exposes the rendered preview, and refuses the original even at a guessed old URL.
  const readOnly=await h.api(`/items/${item.id}/public-links`,cookies.owner,{download:false,versionMode:'pinned',version:v});await go(g,new URL(readOnly.url).pathname);assert.equal(await g.getByRole('link',{name:'Download',exact:true}).count(),0);await g.getByRole('link',{name:'Preview',exact:true}).click();await g.locator('[data-preview-page]').evaluate(image=>image.decode());assert.deepEqual(renderer.inputs.at(-1),Buffer.from(original));await fit(g,'preview-only',width);assert.equal((await h.fetch(new URL(readOnly.url).pathname+'/f/'+item.id)).status,410);
  const note='Harbor Freight delivery schedule and supplier contacts.',child=await h.api('/items',cookies.owner,{parent:folder.id,type:'file',name:'Delivery schedule.txt',base64:b64(note)}),folderLink=await h.api(`/items/${folder.id}/public-links`,cookies.owner,{download:false});
  await go(g,new URL(folderLink.url).pathname);assert.equal(await g.getByRole('link',{name:'Download',exact:true}).count(),0);await fit(g,'folder-preview-only',width);await g.getByRole('link',{name:'Preview',exact:true}).click();await g.locator('[data-preview-page]').evaluate(image=>image.decode());assert.deepEqual(renderer.inputs.at(-1),Buffer.from(note));assert.ok(!(await g.locator('body').innerText()).includes(note));await fit(g,'text-preview',width);assert.equal((await h.fetch(new URL(folderLink.url).pathname+'/f/'+child.id)).status,410);
  await go(a,'/app/links');await a.getByText('Link policy',{exact:true}).click();const policy=a.locator('form').filter({has:a.getByRole('button',{name:'Save link policy',exact:true})});await policy.getByLabel('Links for anyone',{exact:false}).selectOption('false');await policy.getByLabel(/^Organization links/).selectOption('false');await policy.getByLabel('Default audience for new links').selectOption('restricted');await fit(a,'policy',width);await press(policy,'Save link policy');await fit(a,'policy-saved',width);
  const blocked=await go(g,new URL(readOnly.url).pathname);assert.equal(blocked.status(),410);await fit(g,'policy-blocked',width);await go(a,`/app/items/${item.id}`);const newForm=a.locator('form').filter({has:a.getByRole('button',{name:'Create link',exact:true})});assert.equal(await newForm.getByLabel('Audience').inputValue(),'restricted');
  await fit(a,'restricted-default',width);await press(newForm,'Create link');await fit(a,'created-restricted',width);const restrictedToken=new URL((await a.locator('pre.receipt').innerText()).trim()).pathname.split('/s/')[1];
  await go(a,`/app/items/${item.id}`);const restrictedRow=a.locator('li').filter({hasText:'Restricted link'}).filter({has:a.getByRole('button',{name:'Revoke',exact:true})});await fit(a,'restricted-list',width);await press(restrictedRow,'Revoke');await h.api('/links/open',cookies.owner,{token:restrictedToken},404);await fit(a,'restricted-revoked',width);await context.close();await guest.close();
 }
 // POLICY-002 uses each creator's actual form; screenshots resize the same journey after its assertions.
 const rules={allowPublic:true,allowOrganisation:true,allowDiscovery:true,defaultAudience:'restricted',defaultRole:'viewer'};
 const jordanEmail=['jordan','example.test'].join('@'),group=await h.api('/groups',cookies.owner,{name:'Link default creators',members:[jordanEmail]});
 await h.api('/link-policy',cookies.owner,{scope:'organisation',...rules});
 await h.api('/link-policy',cookies.owner,{scope:`group:${group.id}`,...rules,defaultAudience:'organisation'});
 const contexts=[];
 try{
  const pages={};
  for(const person of ['owner','jordan']){
   const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});contexts.push(context);
   await context.addCookies(cookies[person].split('; ').map(s=>{const i=s.indexOf('=');return{name:s.slice(0,i),value:s.slice(i+1),url:h.origin}}));pages[person]=await context.newPage();
  }
  const proof=async(page,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:900});await fit(page,name,width)}await page.setViewportSize({width:1440,height:900})};
  const createForm=page=>page.locator('form').filter({has:page.getByRole('button',{name:'Create link',exact:true})});
  const saveDefaults=async(scope,audience,role,discovery='true')=>{
   const page=pages.owner;await go(page,'/app/links?policyScope='+encodeURIComponent(scope)+'#link-policy');await page.getByText('Link policy',{exact:true}).click();
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Save link policy',exact:true})});
   for(const flag of ['allowPublic','allowOrganisation','allowExternal','allowNonMembers','allowEditors'])assert.equal(await form.locator(`[name=${flag}]`).inputValue(),'true','default changes leave permission switches allowed');
   await form.getByLabel('Default audience for new links').selectOption(audience);await form.getByLabel('Default role for new organization links').selectOption(role);await form.getByLabel('Discoverable organization links').selectOption(discovery);await press(form,'Save link policy');
  };
  const cases=[];
  for(const [person,audience] of [['jordan','organisation'],['owner','restricted']]){
   const space=(await h.api('/files',cookies[person])).personal,bytes=`synthetic-chest-default-${person}`,item=await h.api('/items',cookies[person],{space,name:`Link defaults ${person}.txt`,base64:b64(bytes)});
   if(person==='owner')await h.api(`/items/${item.id}/shares`,cookies.owner,{principal:jordanEmail,role:'viewer'});
   const page=pages[person],opened=await go(page,`/app/items/${item.id}`);assert.equal(opened.status(),200);const form=createForm(page);assert.equal(await form.count(),1,person+' sees the Create link form');
   assert.equal(await form.getByLabel('Audience').inputValue(),audience);assert.equal(await form.getByLabel('Link role').inputValue(),'viewer');
   await proof(page,'default-'+person);await press(form,'Create link');
   const url=(await page.locator('pre.receipt').innerText()).trim(),links=(await h.api(`/items/${item.id}`,cookies[person])).links;assert.equal(links.length,1);assert.equal(links[0].audience,audience);assert.equal(links[0].role,'viewer');
   cases.push({person,item,bytes,url,saved:links[0],reader:person==='owner'?'jordan':'owner'});
  }
  await saveDefaults('organisation','organisation','commenter');await saveDefaults(`group:${group.id}`,'restricted','commenter');
  for(const c of cases){
   const page=pages[c.person];await go(page,`/app/items/${c.item.id}`);const form=createForm(page),audience=c.person==='jordan'?'restricted':'organisation';
   assert.equal(await form.getByLabel('Audience').inputValue(),audience);assert.equal(await form.getByLabel('Link role').inputValue(),'commenter');
   await proof(page,'later-default-'+c.person);await press(form,'Create link');
   const links=(await h.api(`/items/${c.item.id}`,cookies[c.person])).links,later=links.find(l=>l.id!==c.saved.id);assert.equal(links.length,2);assert.equal(later.audience,audience);assert.equal(later.role,'commenter');
   assert.deepEqual(links.find(l=>l.id===c.saved.id),c.saved);
   // Isolate the older capability so a newer link cannot hide an audience or role regression.
   await h.api(`/links/${later.id}`,cookies[c.person],{remove:true});
  }
  await h.stop();await h.start();
  for(const c of cases){
   const links=(await h.api(`/items/${c.item.id}`,cookies[c.person])).links;assert.equal(links.length,1);assert.deepEqual(links[0],c.saved);
   const page=pages[c.reader],response=await go(page,new URL(c.url).pathname);assert.equal(response.status(),200);
   assert.equal((await h.api(`/items/${c.item.id}`,cookies[c.reader])).role,'viewer');
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download',exact:true}).click()]);assert.deepEqual(await readFile(await download.path()),Buffer.from(c.bytes));
   await proof(page,'retained-default-'+c.person);
  }
  await saveDefaults('organisation','organisation','commenter','false');
  const c=cases.find(c=>c.person==='jordan'),page=pages.jordan;await go(page,`/app/items/${c.item.id}`);const form=createForm(page);await form.getByLabel('Audience').selectOption('organisation');await form.getByLabel('Discoverable in search (organization only)').selectOption('true');
  const before=(await h.api(`/items/${c.item.id}`,cookies.jordan)).links;
  const [refusal]=await Promise.all([page.waitForNavigation(),form.getByRole('button',{name:'Create link',exact:true}).click()]);assert.equal(refusal.status(),403);assert.ok((await page.locator('body').innerText()).includes('link_policy_refused'));
  await proof(page,'discovery-refused');assert.deepEqual((await h.api(`/items/${c.item.id}`,cookies.jordan)).links,before);
  console.log('PROBE POLICY-002 browser 1: group and non-member Create link forms -> saved defaults and later changes reconciled; older viewer audiences, tokens and downloaded originals survive restart');
  console.log('PROBE POLICY-002 browser 2: actual discoverable Create link submission with discovery disabled -> HTTP 403 link_policy_refused; no created link');
 }finally{for(const context of contexts)await context.close()}
 console.log('SHARE-001, POLICY-001 and POLICY-002 browser links at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}

await (await import('./organization-link-controls-flow.mjs')).organizationLinkControlsFlow({browserProof:true});
