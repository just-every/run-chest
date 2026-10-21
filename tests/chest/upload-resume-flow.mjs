// CHEST-15: use the real browser uploader and persisted originals. Only the browser's
// network is interrupted; all admitted parts and completion responses come from Chest.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
const hash=async path=>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex')};
export async function uploadResumeJourney(h,page,width,space,parent){
 const filename=`Handover originals ${width}.bin`,path=join(h.directory,filename);
 await writeFile(path,randomBytes(150*1024*1024));const original=await hash(path);
 const partPattern='**/api/chest/uploads/*/parts/*',sent=[];
 let stopAfter=5;
 const interrupt=async route=>{
  const part=Number(new URL(route.request().url()).pathname.split('/').at(-1));
  if(part>stopAfter)return route.abort('internetdisconnected');
  sent.push(part);return route.continue();
 };
 const shot=async state=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`upload ${state} fits ${width}`);
  await page.screenshot({path:`test-results/${width}-upload-resume-${parent?'folder':'space'}-${state}.png`,fullPage:true});
 };
 try{
  await page.goto(h.origin+(parent?`/app/items/${parent}`:`/app/spaces/${space}`));
  await page.route(partPattern,interrupt);
  const input=()=>page.locator('[data-upload] input[data-pick]').first();
  await input().setInputFiles(path);
  const row=page.locator('.upload-item').filter({hasText:filename});
  await row.locator('.upload-status').filter({hasText:'Connection lost at 26%'}).waitFor({timeout:120_000});
  assert.deepEqual(sent,[1,2,3,4,5]);await shot('interrupted');
  await page.reload();
  const waiting=page.locator('[data-waiting]').filter({hasText:filename});
  assert.match(await waiting.innerText(),/26% of 150\.0 MB received/);
  await shot('unfinished');
  // Rechoose the same actual file. Chest must use the stored parts, with a live
  // progress line above zero and no stale Unfinished uploads row alongside it.
  sent.length=0;stopAfter=6;
  await input().setInputFiles(path);
  await row.locator('.upload-status').filter({hasText:'Connection lost at 32%'}).waitFor({timeout:120_000});
  assert.deepEqual(sent,[6],'already persisted parts are never uploaded again');
  assert.equal(await waiting.count(),0);
  assert.equal(await page.locator('.upload-waiting').count(),0);
  assert.equal(await page.locator('[data-upload-summary]').count(),0);
  assert.equal(Number(await row.locator('progress').getAttribute('value')),32);
  await shot('resumed');
  const from=page.url();stopAfter=Infinity;
  await page.waitForURL(u=>u.href!==from&&u.pathname.startsWith('/app/items/'),{timeout:180_000});
  const id=new URL(page.url()).pathname.split('/').at(-1),response=await page.request.get(h.origin+`/api/chest/items/${id}`);
  assert.equal(response.status(),200);const view=await response.json();
  assert.equal(view.versions.length,1);assert.equal(view.versions[0].size,150*1024*1024);
  assert.equal(view.versions[0].checksum,original);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('.doc-actions').getByRole('link',{name:'Download',exact:true}).click()]);
  assert.equal(await download.failure(),null);assert.equal(await hash(await download.path()),original);
  await shot('complete');
  console.log(`CHEST-15 passed at ${width}: 150 MB, network interruption, reload at 26%, persisted parts, resumed progress, stored and downloaded SHA-256.`);
 }finally{await page.unroute(partPattern,interrupt);await rm(path,{force:true})}
}
