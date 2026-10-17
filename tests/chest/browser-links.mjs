import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {docx} from './office-fixtures.mjs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
const h=await harness(),cookies={},original=docx();let browser;
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
  const folder=await h.api('/items',cookies.owner,{space,type:'folder',name:`Harbor delivery folder ${width}`});await go(a,`/app/items/${folder.id}`);await fit(a,'folder-links',width);
  await go(a,`/app/items/${item.id}`);const form=a.locator('form').filter({has:a.getByRole('button',{name:'Create link',exact:true})});
  await form.getByLabel('Audience').selectOption('public');await form.getByLabel('Version for links for anyone').selectOption('pinned:'+v);await form.getByLabel('Password').fill('harbor-delivery-brief');await form.getByLabel('Expires').fill('2099-11-30');await form.getByLabel('Download limit').fill('10');await fit(a,'create-pinned',width);await press(form,'Create link');await fit(a,'created',width);const url=(await a.locator('pre.receipt').innerText()).trim(),path=new URL(url).pathname;
  await go(g,path);await fit(g,'password',width);await g.getByLabel('Password').fill('wrong');await press(g,'Open');await fit(g,'wrong-password',width);await g.getByLabel('Password').fill('harbor-delivery-brief');await press(g,'Open');await fit(g,'public-file',width);
  const preview=g.getByRole('link',{name:'Preview',exact:true});await preview.click();await fit(g,'pinned-preview',width);await go(g,path);
  for(let i=0;i<3;i++){const [d]=await Promise.all([g.waitForEvent('download'),g.getByRole('link',{name:'Download',exact:true}).click()]);assert.deepEqual(await readFile(await d.path()),Buffer.from(original))}
  await go(a,'/app/links');const row=a.locator('li').filter({hasText:item.payload.name}).filter({hasText:'Link for anyone'}).filter({has:a.getByRole('button',{name:'Revoke',exact:true})});assert.equal((await h.api(`/items/${item.id}`,cookies.owner)).publicLinks.find(l=>l.version===v&&l.password)?.downloads,3);await fit(a,'usage',width);await press(row,'Revoke');const gone=await go(g,path);assert.equal(gone.status(),410);await fit(g,'revoked',width);
  // A preview-only link exposes the rendered preview, and refuses the original even at a guessed old URL.
  const readOnly=await h.api(`/items/${item.id}/public-links`,cookies.owner,{download:false,versionMode:'pinned',version:v});await go(g,new URL(readOnly.url).pathname);assert.equal(await g.getByRole('link',{name:'Download',exact:true}).count(),0);await g.getByRole('link',{name:'Preview',exact:true}).click();await fit(g,'preview-only',width);assert.equal((await h.fetch(new URL(readOnly.url).pathname+'/f/'+item.id)).status,410);
  const note='Harbor Freight delivery schedule and supplier contacts.',child=await h.api('/items',cookies.owner,{parent:folder.id,type:'file',name:'Delivery schedule.txt',base64:b64(note)}),folderLink=await h.api(`/items/${folder.id}/public-links`,cookies.owner,{download:false});
  await go(g,new URL(folderLink.url).pathname);assert.equal(await g.getByRole('link',{name:'Download',exact:true}).count(),0);await fit(g,'folder-preview-only',width);await g.getByRole('link',{name:'Preview',exact:true}).click();assert.equal(await g.locator('pre.receipt').innerText(),note);await fit(g,'text-preview',width);assert.equal((await h.fetch(new URL(folderLink.url).pathname+'/f/'+child.id)).status,410);
  await go(a,'/app/links');await a.getByText('Link policy',{exact:true}).click();const policy=a.locator('form').filter({has:a.getByRole('button',{name:'Save link policy',exact:true})});await policy.getByLabel('Links for anyone',{exact:false}).selectOption('false');await policy.getByLabel(/^Organization links/).selectOption('false');await policy.getByLabel('Default audience for new links').selectOption('restricted');await fit(a,'policy',width);await press(policy,'Save link policy');await fit(a,'policy-saved',width);
  const blocked=await go(g,new URL(readOnly.url).pathname);assert.equal(blocked.status(),410);await fit(g,'policy-blocked',width);await go(a,`/app/items/${item.id}`);const newForm=a.locator('form').filter({has:a.getByRole('button',{name:'Create link',exact:true})});assert.equal(await newForm.getByLabel('Audience').inputValue(),'restricted');
  await fit(a,'restricted-default',width);await press(newForm,'Create link');await fit(a,'created-restricted',width);const restrictedToken=new URL((await a.locator('pre.receipt').innerText()).trim()).pathname.split('/s/')[1];
  await go(a,`/app/items/${item.id}`);const restrictedRow=a.locator('li').filter({hasText:'Restricted link'}).filter({has:a.getByRole('button',{name:'Revoke',exact:true})});await fit(a,'restricted-list',width);await press(restrictedRow,'Revoke');await h.api('/links/open',cookies.owner,{token:restrictedToken},404);await fit(a,'restricted-revoked',width);await context.close();await guest.close();
 }
 console.log('SHARE-001 and POLICY-001 browser links at 1440 and 390 passed');
}finally{await browser?.close();await h.close()}
