import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {readFile,mkdir} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {harness} from './harness.mjs';
import {docx,xlsx,pptx} from './office-fixtures.mjs';

// Built HTTP and UI doors. Only Collabora's conversion network edge is replaced unless a live URL is supplied.
export async function restrictionFlow({browserProof=false,collaboraUrl}={}){
 const provider=collaboraUrl??'https://synthetic-chest-render.test',pdf=await PDFDocument.create();
 for(const [n,size] of [[1,[612,792]],[2,[640,800]]])pdf.addPage(size).drawText(`synthetic-chest-${n}`,{x:40,y:700});
 const pdfBytes=await pdf.save(),png=await readFile('tests/chest/scan-nda.png');
 let conversions=0,beforeConvert=null;
 const h=await harness({bindings:{COLLABORA_URL:provider},edge:async request=>{
  if(new URL(request.url).origin!==new URL(provider).origin)return;
  assert.match(new URL(request.url).pathname,/^\/cool\/convert-to\/(pdf|png)$/);
  conversions++;if(beforeConvert){const action=beforeConvert;beforeConvert=null;await action()}
  if(collaboraUrl)return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),body:await request.arrayBuffer()});
  const data=(await request.formData()).get('data');assert.equal(typeof data.arrayBuffer,'function');
  if(request.url.endsWith('/png'))assert.equal((await PDFDocument.load(await data.arrayBuffer())).getPageCount(),1,'only one rendered PDF page reaches the raster converter');
  return new Response(request.url.endsWith('/png')?png:pdfBytes,{headers:{'content-type':request.url.endsWith('/png')?'image/png':'application/pdf'}});
 }});
 const b64=value=>Buffer.from(value).toString('base64');
 try{
  await mkdir('test-results',{recursive:true});
  await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Owner'});const owner=await h.signIn(h.vars.OWNER_EMAIL);
  await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
  const people={owner};
  for(const role of ['viewer','commenter']){await h.api('/people',owner,{action:'invite',email:`${role}@example.test`,name:role});people[role]=await h.signIn(`${role}@example.test`,true)}
  const space=await h.api('/spaces',owner,{name:'Rendered previews'}),members=[{principal:h.vars.OWNER_EMAIL,role:'manager'},...['viewer','commenter'].map(role=>({principal:`${role}@example.test`,role}))];
  await h.api(`/spaces/${space.id}/members`,owner,{members});
  await restrictedTreeFlow(h,owner,people,space,members);
  const files=[];
  for(const [ext,bytes] of [['txt',Buffer.from('synthetic-chest-1\nA private original.')],['docx',docx()],['xlsx',xlsx()],['pptx',pptx()],['pdf',pdfBytes],['png',png]]){
   const file=await h.api('/items',owner,{space:space.id,name:`synthetic-chest-1.${ext}`,base64:b64(bytes)});
   if(ext==='txt')await h.api(`/items/${file.id}/versions`,owner,{base64:b64('synthetic-chest-2\nThe retained original stays private.')});
   files.push({id:file.id,ext,bytes,...await h.api(`/items/${file.id}`,owner)});
  }
  const devices={};for(const role of ['viewer','commenter'])devices[role]=await h.api('/devices',people[role],{name:'Preview device',platform:'macos'});
  const originalDenied=async(file,cookie)=>{
   for(const version of file.versions)for(const [query,range] of [['',null],['?download=true',null],['','bytes=0-15']]){
    const response=await h.fetch(`/api/chest/items/${file.id}/bytes/${version.id}${query}`,{headers:{cookie,...(range?{range}:{})}});
    assert.equal(response.status,403);assert.equal((await response.json()).error,'download_restricted');
   }
   if(['docx','xlsx','pptx'].includes(file.ext))for(const path of ['office','office?edit=true',`office-preview/${file.item.current}`]){
    const response=await h.raw(`/api/chest/items/${file.id}/${path}`,cookie);assert.equal(response.status,403);assert.equal((await response.json()).error,'download_restricted');
   }
  };
  for(const scope of ['space','file']){
   if(scope==='space')await h.api(`/spaces/${space.id}/settings`,owner,{noDownload:true});
   else for(const file of files)await h.api(`/items/${file.id}/settings`,owner,{noDownload:true});
   for(const role of ['viewer','commenter']){
    for(const file of files){
     await originalDenied(file,people[role]);
     const detail=await h.api(`/items/${file.id}`,people[role]);assert.equal(detail.can.download,false);
     assert.ok(!JSON.stringify(detail).includes('A private original.'));assert.ok(!JSON.stringify(detail).includes('The retained original stays private.'));
     const path=`/api/chest/items/${file.id}/rendered-preview/${file.item.current}`,shell=await h.raw(path,people[role]);assert.equal(shell.status,200,await shell.clone().text());
     const html=await shell.text();assert.ok(html.includes('data-restricted-preview'));assert.ok(!html.includes('Harbor renewal agreement')&&!html.includes('A private original.'));
     const first=await h.raw(path+'?page=1',people[role]);assert.equal(first.status,200,await first.clone().text());assert.equal(first.headers.get('content-type'),'image/png');assert.equal(first.headers.get('cache-control'),'no-store');
     assert.equal(Buffer.from(await first.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
     const hydrate=await h.fetch(`/api/chest/sync/items/${file.id}/content`,{headers:{authorization:`Bearer ${devices[role].token}`}});assert.equal(hydrate.status,403);
    }
    const job=await h.api('/bulk',people[role],{action:'download',items:files.map(f=>f.id)}),response=await h.raw(`/api/chest/bulk/${job.id}/archive`,people[role]);assert.equal(response.status,200);
    const archive=unzipSync(new Uint8Array(await response.arrayBuffer())),manifest=JSON.parse(strFromU8(archive['chest-manifest.json']));assert.equal(manifest.included.length,0);assert.equal(manifest.excluded.length,files.length);assert.ok(manifest.excluded.every(e=>e.reason==='download_restricted'));assert.deepEqual(Object.keys(archive),['chest-manifest.json']);
   }
   if(scope==='space')await h.api(`/spaces/${space.id}/settings`,owner,{noDownload:false});
   else for(const file of files)await h.api(`/items/${file.id}/settings`,owner,{noDownload:false});
  }
  const pdfFile=files.find(f=>f.ext==='pdf'),pdfPath=`/api/chest/items/${pdfFile.id}/rendered-preview/${pdfFile.item.current}`;
  assert.match(await(await h.raw(pdfPath,people.viewer)).text(),/data-pages="2"/);
  assert.equal((await h.raw(pdfPath+'?page=2',people.viewer)).status,200);assert.equal((await h.raw(pdfPath+'?page=3',people.viewer)).status,404);
  // Revoking a grant while conversion is in flight must discard the completed raster response.
  beforeConvert=()=>h.api(`/spaces/${space.id}/members`,owner,{members:members.filter(m=>m.role!=='viewer')});
  const revoked=await h.raw(pdfPath+'?page=1',people.viewer);assert.equal(revoked.status,403);assert.notEqual(revoked.headers.get('content-type'),'image/png');
  await h.api(`/spaces/${space.id}/members`,owner,{members});
  const text=files.find(f=>f.ext==='txt'),link=await h.api(`/items/${text.id}/public-links`,owner,{download:false}),publicPath=new URL(link.url).pathname;
  const publicShell=await h.fetch(`${publicPath}/p/${text.id}`);assert.equal(publicShell.status,200);const publicHtml=await publicShell.text();assert.ok(publicHtml.includes('data-restricted-preview'));assert.ok(!publicHtml.includes('The retained original stays private.'));
  assert.equal((await h.fetch(`${publicPath}/p/${text.id}?page=1`)).headers.get('content-type'),'image/png');
  assert.equal((await h.fetch(`${publicPath}/f/${text.id}`)).status,410);
  await h.api(`/public-links/${link.link.id}/revoke`,owner,{});assert.equal((await h.fetch(`${publicPath}/p/${text.id}?page=1`)).status,410);
  if(browserProof)await restrictedBrowser(h,owner,people,space,files);
  assert.ok(conversions>0);
  await h.api(`/items/${text.id}/settings`,owner,{noDownload:true});delete h.vars.COLLABORA_URL;await h.stop();await h.start();
  const unavailable=await h.raw(`/api/chest/items/${text.id}/rendered-preview/${text.item.current}`,people.viewer);assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).error,'collabora_not_configured');await originalDenied(text,people.viewer);
  console.log(`ROLE-001 rendered previews: text, Office, PDF and raster; both restriction scopes and reader roles; originals, retained versions, range, sync, archive and extraction refused; conversion-time revoke and public-link revoke passed (${collaboraUrl?'live Collabora conversion':'conversion network edge'})`);
 }finally{await h.close()}
}

async function restrictedBrowser(h,owner,people,space,files){
 const {chromium}=await import('@playwright/test'),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  await h.api(`/spaces/${space.id}/settings`,owner,{noDownload:true});
  for(const width of [1440,390])for(const role of ['viewer','commenter']){
   const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});
   try{
    await context.addCookies(people[role].split('; ').map(cookie=>{const i=cookie.indexOf('=');return {name:cookie.slice(0,i),value:cookie.slice(i+1),url:h.origin}}));
    const page=await context.newPage();
    for(const file of files){
     await page.goto(h.origin+`/app/items/${file.id}`);
     const frame=page.frameLocator('iframe[src*="rendered-preview"]').first();await frame.locator('[data-preview-page]').waitFor();
     await frame.locator('[data-preview-page]').evaluate(image=>image.decode());
     assert.ok(await frame.locator('[data-preview-page]').evaluate(image=>image.naturalWidth>0));
     const refusal=await frame.locator('body').evaluate(()=>{const copy=new Event('copy',{bubbles:true,cancelable:true}),print=new KeyboardEvent('keydown',{key:'p',ctrlKey:true,bubbles:true,cancelable:true});document.dispatchEvent(copy);document.dispatchEvent(print);return {copy:copy.defaultPrevented,print:print.defaultPrevented,selection:getComputedStyle(document.body).userSelect}});
     assert.deepEqual(refusal,{copy:true,print:true,selection:'none'});
     await page.emulateMedia({media:'print'});assert.equal(await frame.locator('main').evaluate(element=>getComputedStyle(element).display),'none');await page.emulateMedia({media:'screen'});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     assert.ok(!(await frame.locator('body').innerText()).includes('Harbor renewal agreement'));
     if(file.ext==='pdf'){await frame.getByRole('button',{name:'Next page'}).click();await frame.locator('[data-preview-page]').evaluate(image=>image.decode());assert.match(await frame.locator('[data-page-count]').textContent(),/Page 2 of 2/)}
     await page.screenshot({path:`test-results/${width}-restricted-${role}-${file.ext}.png`,fullPage:true});
    }
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}

async function restrictedTreeFlow(h,owner,people,space,members){
 for(const role of ['viewer','commenter']){
  const cookie=people[role];await h.api(`/spaces/${space.id}/members`,owner,{members:members.map(m=>m.principal===`${role}@example.test`?{...m,role:'content_manager'}:m)});
  const folder=await h.api('/items',owner,{space:space.id,type:'folder',name:`Restricted tree ${role}`}),file=await h.api('/items',owner,{parent:folder.id,name:'Restricted original.txt',base64:Buffer.from('This original must stay restricted.').toString('base64')});
  await h.api(`/items/${file.id}/settings`,owner,{restricted:true,noDownload:true});await h.api(`/items/${file.id}/shares`,owner,{principal:`${role}@example.test`,role});
  assert.equal((await h.api(`/items/${file.id}`,cookie)).can.download,false);
  const personal=(await h.api('/files',cookie)).personal,before=(await h.api(`/spaces/${personal}`,cookie)).children;
  await h.api(`/items/${folder.id}/copy`,cookie,{space:personal,parent:null,name:'Copied restricted tree'},403);
  assert.deepEqual((await h.api(`/spaces/${personal}`,cookie)).children,before,'copy cannot hydrate a restricted descendant into a personal area');
  await h.api(`/items/${folder.id}/move`,cookie,{space:personal,parent:null},403);
  assert.equal((await h.api(`/items/${folder.id}`,owner)).item.space,space.id);assert.equal((await h.api(`/items/${file.id}`,owner)).item.parent,folder.id);
  await h.api(`/spaces/${space.id}/members`,owner,{members});
 }
}
