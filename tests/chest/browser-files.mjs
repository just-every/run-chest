// Everyday files in a real browser at 1440 and 390 against the built Worker, with every person signed in through the
// ordinary email link received at the mail provider edge: self-service trash (CHEST-13), version history and restore
// (VERSION-001), item sharing, access requests and expiry (SHARE-004), move-in from a Takeout zip, and sync device keys.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {zip} from './fixtures.mjs';
const h=await harness(),sha=v=>createHash('sha256').update(v).digest('hex'),day=86_400_000,cookies={},b64=v=>Buffer.from(v).toString('base64');
let browser;
const people=['ana','ben','cy','mo','dee','eve'];
async function staff(){
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'})).status,303);cookies.owner=await h.signIn(h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:cookies.owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
 for(const name of people){await h.api('/people',cookies.owner,{action:'invite',email:`${name}@example.test`,name:name[0].toUpperCase()+name.slice(1)});cookies[name]=await h.signIn(`${name}@example.test`,true)}
}
async function as(who,width){
 const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
 await context.addCookies(cookies[who].split('; ').map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),url:h.origin}}));
 return context.newPage();
}
const go=(page,path)=>page.goto(h.origin+path);
const call=(page,path,body)=>page.request.fetch(h.origin+'/api/chest'+path,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{origin:h.origin,'content-type':'application/json'},data:body})});
const json=async(page,path,body)=>{const r=await call(page,path,body);assert.ok(r.ok(),`${path}: ${r.status()}`);return r.json()};
const press=async(scope,name)=>{const page=scope.page?scope.page():scope;await Promise.all([page.waitForNavigation(),scope.getByRole('button',{name,exact:true}).click()])};
const open=async(page,summary)=>page.getByText(summary,{exact:true}).click();
const id=page=>new URL(page.url()).pathname.split('/').at(-1);
const fit=async(page,name,width)=>{const wide=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth?'':[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(-3).map(e=>`${e.tagName}.${e.className}: ${e.textContent.slice(0,60)}`).join(' | '));assert.equal(wide,'',`no horizontal overflow at ${width}: ${name}`);await page.screenshot({path:`test-results/${width}-files-${name}.png`,fullPage:true})};
const download=async(page,link)=>{const [file]=await Promise.all([page.waitForEvent('download'),link.click()]);return readFile(await file.path())};
const audit=async(action,object)=>(await h.api('/audit',cookies.owner)).filter(e=>e.action===action&&e.object_id===object);
const row=(page,text)=>page.locator('li').filter({hasText:text});
// Uploads go through the drop area's picker: a new file opens its page, a new version reloads the file's page.
const pick=async(page,file)=>{const from=page.url(),input=page.locator('[data-upload] input[data-pick]').first();if(page.url().includes('/items/')&&await page.locator('[data-upload][data-item]').count())await Promise.all([page.waitForNavigation(),input.setInputFiles(file)]);else{await input.setInputFiles(file);await page.waitForURL(u=>u.href!==from&&u.pathname.startsWith('/app/items/'))}};
async function journey(width){
 const p=Object.fromEntries(await Promise.all(people.map(async n=>[n,await as(n,width)]))),xlsx=n=>Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(`budget ${width} revision ${n}`)]);
 // Mo creates a team space and its members in the browser; Ana builds a nested tree with an ordinary file.
 await go(p.mo,'/app/files');await p.mo.getByLabel('New team space name').fill(`Projects ${width}`);await press(p.mo,'Create team space');
 await p.mo.getByRole('link',{name:`Projects ${width}`}).click();const space=id(p.mo);
 for(const [email,role] of [['ana@example.test','content_manager'],['ben@example.test','viewer'],['cy@example.test','contributor'],['eve@example.test','commenter']]){await open(p.mo,'Add a person');const add=p.mo.locator('form').filter({has:p.mo.getByRole('button',{name:'Add to space'})});await add.getByLabel('Email').fill(email);await add.getByLabel('Role').selectOption(role);await press(add,'Add to space')}
 // A manager changes a role and removes a member on their row; the change is the space's real membership.
 const benRow=()=>p.mo.locator('li.member').filter({hasText:'ben@example.test'});await benRow().getByLabel(/^Role for/).selectOption('commenter');await press(benRow(),'Change role');await press(benRow(),'Remove');
 await open(p.mo,'Add a person');{const add=p.mo.locator('form').filter({has:p.mo.getByRole('button',{name:'Add to space'})});await add.getByLabel('Email').fill('ben@example.test');await add.getByLabel('Role').selectOption('viewer');await press(add,'Add to space')}
 assert.deepEqual((await json(p.mo,`/spaces/${space}`)).members.map(m=>[m.principal,m.role]),[['mo@example.test','manager'],['ana@example.test','content_manager'],['cy@example.test','contributor'],['eve@example.test','commenter'],['ben@example.test','viewer']]);
 await fit(p.mo,'space',width);
 // Move in (MIGRATE-002 partial): a Takeout zip arrives with its folder tree under "Google Drive"; running it again adds nothing.
 const takeout={name:`takeout-${width}.zip`,mimeType:'application/zip',buffer:zip([['Takeout/archive_browser.html','<p>index</p>'],[`Takeout/Drive/Clients ${width}/Harbor/MSA.txt`,'Master services '+width],[`Takeout/Drive/Budget ${width}.txt`,'Budget '.repeat(3000)]])};
 const moveIn=async()=>{await go(p.mo,'/app/move-in');await p.mo.locator('[data-destination]').selectOption({label:'My files'});await p.mo.locator('[data-zips]').setInputFiles(takeout);await p.mo.getByRole('button',{name:'Start move-in'}).click();await p.mo.getByText('Move-in finished').waitFor({timeout:60_000});return `${await p.mo.locator('[data-counts]').innerText()}${await p.mo.locator('[data-failed]').innerText()}`};
 // The second width's move-in reuses the Google Drive folder the first one made.
 assert.match(await moveIn(),/^2 file\(s\) and [23] folder\(s\) added · 0 already there · 0 not added$/);await fit(p.mo,'move-in',width);
 const myFiles=(await json(p.mo,'/files')).personal,drive=(await json(p.mo,`/spaces/${myFiles}`)).children.find(c=>c.name==='Google Drive'),inDrive=(await json(p.mo,`/items/${drive.id}`)).children;
 assert.ok(inDrive.some(c=>c.name===`Budget ${width}.txt`&&c.type==='file')&&inDrive.some(c=>c.name===`Clients ${width}`&&c.type==='folder'));const harbor=(await json(p.mo,`/items/${(await json(p.mo,`/items/${inDrive.find(c=>c.name===`Clients ${width}`).id}`)).children[0].id}`)).children;
 assert.equal(sha(await (await call(p.mo,`/items/${harbor[0].id}/bytes/${(await json(p.mo,`/items/${harbor[0].id}`)).item.current}?download=true`)).body()),sha('Master services '+width));
 assert.match(await moveIn(),/^0 file\(s\) and 0 folder\(s\) added · 2 already there · 0 not added$/);
 await go(p.ana,`/app/spaces/${space}`);await open(p.ana,'New folder');await p.ana.getByLabel('Folder name').fill('Client');await press(p.ana,'Create folder');const client=id(p.ana);
 await open(p.ana,'New folder');await p.ana.getByLabel('Folder name').fill('Contracts');await press(p.ana,'Create folder');const contracts=id(p.ana);
 await pick(p.ana,{name:'terms.txt',mimeType:'text/plain',buffer:Buffer.from(`Payment terms ${width}`)});const terms=id(p.ana);
 await go(p.ana,`/app/items/${client}`);await fit(p.ana,'folder',width);
 // CHEST-13: a contributor has no trash action and is refused; the content manager trashes and restores her own folder.
 const tree=async()=>{const a=await json(p.ana,`/items/${client}`),b=await json(p.ana,`/items/${contracts}`),c=await json(p.ana,`/items/${terms}`);return [a.children.map(x=>x.id),b.children.map(x=>x.id),c.versions.map(v=>[v.id,v.checksum])]},before=await tree();
 await go(p.cy,`/app/items/${client}`);assert.equal(await p.cy.getByRole('button',{name:'Move to trash'}).count(),0);assert.equal((await call(p.cy,`/items/${client}/trash`,{})).status(),403);
 await go(p.ana,`/app/items/${client}`);await press(p.ana,'Move to trash');assert.equal(new URL(p.ana.url()).pathname,`/app/spaces/${space}`);assert.equal(await p.ana.getByRole('link',{name:'Client',exact:true}).count(),0);
 assert.equal((await go(p.ben,`/app/items/${terms}`)).status(),404);await go(p.ben,`/app/files/search?q=${encodeURIComponent(`Payment terms ${width}`)}`);await p.ben.getByText('No accessible file matches.').waitFor();
 assert.equal((await call(p.ben,`/items/${terms}/bytes/${before[2][0][0]}?download=true`)).status(),404);assert.equal((await call(p.ben,`/items/${client}/restore`,{})).status(),403);
 await go(p.ana,'/app/files/trash');await fit(p.ana,'trash',width);await press(row(p.ana,'Client'),'Restore');assert.deepEqual(await tree(),before);
 assert.equal((await audit('item.trash',client)).length,1);const restored=await audit('item.restore',client);assert.equal(restored.length,1);assert.equal(restored[0].actor,'ana@example.test');
 const notes=await json(p.cy,'/items',{space,type:'file',name:'notes.txt',base64:b64('notes')});await json(p.ana,`/items/${notes.id}/trash`,{});
 await go(p.mo,'/app/files/trash');await press(row(p.mo,'notes.txt'),'Restore');assert.equal((await json(p.ben,`/items/${notes.id}`)).item.name,'notes.txt');
 const scrap=await json(p.ana,'/items',{space,type:'file',name:'scrap.txt',base64:b64(`scrap ${width}`)});await json(p.ana,`/items/${scrap.id}/trash`,{});
 await go(p.ana,'/app/files/trash');assert.equal(await row(p.ana,'scrap.txt').getByRole('button',{name:'Erase permanently'}).count(),0);assert.equal((await call(p.ana,`/items/${scrap.id}/erase`,{})).status(),403);
 await go(p.mo,'/app/files/trash');await press(row(p.mo,'scrap.txt'),'Erase permanently');assert.equal((await call(p.mo,`/items/${scrap.id}`)).status(),404);
 // VERSION-001: three versions by two people; a contributor reads the history, downloads, names and restores version 2.
 await go(p.ana,`/app/spaces/${space}`);await pick(p.ana,{name:'budget.xlsx',mimeType:'application/octet-stream',buffer:xlsx(1)});const budget=id(p.ana);
 await pick(p.ana,{name:'budget-v2.xlsx',mimeType:'application/octet-stream',buffer:xlsx(2)});
 await go(p.mo,`/app/items/${budget}`);await pick(p.mo,{name:'budget-v3.xlsx',mimeType:'application/octet-stream',buffer:xlsx(3)});
 await go(p.ana,`/app/items/${budget}`);await p.ana.getByLabel('Link role').selectOption('viewer');await press(p.ana,'Create link');const link=new URL((await p.ana.locator('pre').innerText()).trim());
 await go(p.cy,`/app/items/${budget}`);const versions=p.cy.locator('article.ver');assert.equal(await versions.count(),3);
 for(const [file,who] of [['budget-v3.xlsx','mo'],['budget-v2.xlsx','ana'],['budget.xlsx','ana']])await versions.filter({has:p.cy.getByRole('heading',{name:file})}).getByText(`By ${who}@example.test`).waitFor();
 const v2=versions.filter({has:p.cy.getByRole('heading',{name:'budget-v2.xlsx'})});assert.equal(sha(await download(p.cy,v2.getByRole('link',{name:'Download this version'}))),sha(xlsx(2)));
 await v2.getByLabel('Version name').fill('Before Q3 edits');await press(v2,'Save version name');
 await press(versions.filter({has:p.cy.getByRole('heading',{name:'Before Q3 edits'})}),'Restore as current version');
 const after=await json(p.cy,`/items/${budget}`);assert.equal(after.versions.length,4);assert.equal(after.versions[0].actor,'cy@example.test');assert.equal(after.versions[0].checksum,sha(xlsx(2)));assert.equal(after.item.current,after.versions[0].id);
 await fit(p.cy,'file',width);
 await p.dee.goto(link.href.replace(link.origin,h.origin));assert.equal(new URL(p.dee.url()).pathname,`/app/items/${budget}`);assert.equal(sha(await download(p.dee,p.dee.locator('.doc-actions').getByRole('link',{name:'Download'}))),sha(xlsx(2)));
 for(const who of ['ben','eve']){await go(p[who],`/app/items/${budget}`);assert.equal(await p[who].locator('article.ver').count(),4);assert.equal(await p[who].getByRole('button',{name:'Restore as current version'}).count(),0);assert.equal((await call(p[who],`/items/${budget}/versions/${after.versions[3].id}/restore`,{})).status(),403)}
 // SHARE-004: Ana shares a personal file with Ben as commenter; Dee asks for access and Ana approves from the email.
 const mine=(await json(p.ana,'/files')).personal;await go(p.ana,`/app/spaces/${mine}`);await pick(p.ana,{name:`plan-${width}.txt`,mimeType:'text/plain',buffer:Buffer.from('launch plan')});const plan=id(p.ana);
 await p.ana.getByLabel('Person or group').selectOption('ben@example.test');await p.ana.getByLabel(/^Role/).selectOption('commenter');await p.ana.getByLabel('Message (optional)').fill('Please check section 2');await press(p.ana,'Share');
 await go(p.ben,'/app/notices');await p.ben.getByText(`shared "plan-${width}.txt" with you as commenter`,{exact:false}).waitFor();await fit(p.ben,'notices',width);
 await go(p.ben,'/app/shared');await fit(p.ben,'shared',width);await p.ben.getByRole('link',{name:`plan-${width}.txt`}).click();
 assert.equal(await p.ben.locator('[data-upload]').count(),0);await p.ben.getByLabel('Comment',{exact:true}).fill('Section 2 is right');await press(p.ben,'Post comment');await p.ben.getByText('Section 2 is right').waitFor();
 assert.equal((await call(p.ben,`/items/${plan}/versions`,{base64:b64('edit')})).status(),403);
 const refused=await go(p.dee,`/app/items/${plan}`);await p.dee.getByRole('heading',{name:'Request access'}).waitFor();assert.ok(!(await refused.text()).includes(`plan-${width}`));
 await p.dee.getByLabel('Access you need').selectOption('editor');await p.dee.getByLabel('Message (optional)').fill('I run the launch');await press(p.dee,'Request access');await p.dee.getByText('editor access to the item you asked for',{exact:false}).waitFor();assert.equal(await p.dee.getByText(`plan-${width}.txt`).count(),0);
 const email=h.mails.findLast(m=>[m.to].flat().includes('ana@example.test')&&/\/app\/requests\//.test(m.text)),requestPath=new URL(email.text.match(/https:\/\/\S+\/app\/requests\/\S+/)[0]).pathname;
 await go(p.ana,requestPath);await fit(p.ana,'request',width);await p.ana.getByLabel('Grant role').selectOption('viewer');await press(p.ana,'Approve');
 await go(p.dee,'/app/notices');await p.dee.getByText(`"plan-${width}.txt" was approved as viewer`,{exact:false}).waitFor();await go(p.dee,`/app/items/${plan}`);await p.dee.locator('.doc-side').getByText('viewer',{exact:false}).first().waitFor();
 await go(p.cy,`/app/items/${plan}`);await p.cy.getByLabel('Access you need').selectOption('viewer');await press(p.cy,'Request access');
 const declined=async()=>(await json(p.cy,'/notices')).filter(n=>n.payload.message.includes('declined')).length,earlier=await declined();
 await go(p.ana,`/app/items/${plan}`);await press(row(p.ana,'cy@example.test asks for viewer'),'Decline');assert.equal(await declined(),earlier+1);await go(p.cy,'/app/notices');await p.cy.getByText('declined',{exact:false}).first().waitFor();
 // Grant expiry: Eve gets commenter for two days; the one-day notice arrives, Ana extends once, then access ends.
 const until=new Date(Date.now()+2*day).toISOString().slice(0,10);await go(p.ana,`/app/items/${plan}`);await p.ana.getByLabel('Person or group').selectOption('eve@example.test');await p.ana.getByLabel(/^Role/).selectOption('commenter');await p.ana.getByLabel('Access expires (optional)').fill(until);await press(p.ana,'Share');
 const age=async ms=>{const at=new Date(Date.now()+ms).toISOString();await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.expires',?) WHERE id=?",at,`expiry:${plan}:eve@example.test`);await h.sql("UPDATE chest_records SET payload=json_set(payload,'$.grants',(SELECT json_group_array(CASE WHEN json_extract(value,'$.principal')='eve@example.test' THEN json_set(value,'$.expires',?) ELSE json(value) END) FROM json_each(payload,'$.grants'))) WHERE id=?",at,plan)};
 await age(12*3600_000);await go(p.eve,'/app/notices');await p.eve.getByText(`Access to "plan-${width}.txt" for eve@example.test`,{exact:false}).waitFor();
 await go(p.ana,`/app/items/${plan}`);const was=(await json(p.ana,`/items/${plan}`)).grants.find(g=>g.principal==='eve@example.test').expires;await press(row(p.ana,'eve@example.test · commenter'),'Extend by 7 days');
 assert.equal(Date.parse((await json(p.ana,`/items/${plan}`)).grants.find(g=>g.principal==='eve@example.test').expires)-Date.parse(was),7*day);
 await age(-1000);await go(p.eve,`/app/items/${plan}`);await p.eve.getByRole('heading',{name:'Request access'}).waitFor();assert.equal((await audit('share.expired',plan)).length,1);
 // Sync devices: no native sync app ships; the scoped command-line companion has a separate key flow. A key for a
 // future client is listed and revoked from the page, and stops working for the sync protocol.
 await go(p.ana,'/app/devices');assert.equal(await p.ana.getByRole('button',{name:'Create device key'}).count(),0);
 const token=(await json(p.ana,'/devices',{name:`Ana laptop ${width}`,platform:'macos'})).token,tree2=()=>h.fetch('/api/chest/sync/tree',{headers:{authorization:`Bearer ${token}`}});assert.equal((await tree2()).status,200);
 await go(p.ana,'/app/devices');await fit(p.ana,'devices',width);await press(row(p.ana,`Ana laptop ${width}`),'Revoke device');assert.equal((await tree2()).status,401);
 // RECOVER-001 from the browser: the space manager previews a restore to a date; nothing changes until it is applied,
 // and the applied restore is undone from its receipt.
 const minute=new Date(Date.now()-60_000).toISOString().slice(0,16),items=(await json(p.mo,`/spaces/${space}`)).children.length;
 await go(p.mo,`/app/spaces/${space}`);await open(p.mo,'Restore to a date');await p.mo.getByLabel('Date and time',{exact:true}).fill(minute);await p.mo.getByLabel('Time zone').selectOption('UTC');await press(p.mo,'Preview restore');
 await p.mo.getByRole('heading',{name:'Restore preview'}).waitFor();await p.mo.getByText('added since',{exact:false}).first().waitFor();await fit(p.mo,'rewind',width);assert.equal((await json(p.mo,`/spaces/${space}`)).children.length,items);
 await press(p.mo,'Restore selected items');await p.mo.getByRole('heading',{name:/^Restored to /}).waitFor();assert.ok((await json(p.mo,`/spaces/${space}`)).children.length<items);
 await press(p.mo,'Undo this restore');await p.mo.getByRole('heading',{name:'Restore undone'}).waitFor();assert.equal((await json(p.mo,`/spaces/${space}`)).children.length,items);
 await go(p.ana,'/app/files');await fit(p.ana,'home',width);
 for(const page of Object.values(p))await page.context().close();
 console.log(`Files browser journey passed at ${width}: trash/restore/erase, version history and restore, sharing, access requests, expiry, members, move-in and device keys`);
}
try{
 await mkdir('test-results',{recursive:true});await staff();
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 for(const width of [1440,390])await journey(width);
 console.log('CHEST-13, VERSION-001 and SHARE-004 browser journeys passed');
}finally{await browser?.close();await h.close()}
