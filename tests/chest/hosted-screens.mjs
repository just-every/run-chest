import assert from 'node:assert/strict';
import {tooltips} from './tooltip-proof.mjs';

export async function hostedScreens(page,origin,expected,actor) {
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(const [name,path,visible] of [
   ['folders',`/app/items/${expected.parent}`,'Approved originals'],
   ['original',`/app/items/${expected.large}`,'Harbor production handover.bin'],
   ['trash','/app/files/trash','Payment terms.txt'],
   ['links','/app/links','Delivery note.txt'],
   ['request',`/app/items/${expected.incoming}`,'Supplier receipt.txt']]){
   const response=await page.goto(origin+path);
   assert.equal(response.status(),200,`restored ${name} page opens for ${actor}`);
   await page.getByText(visible,{exact:true}).first().waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fits ${width}`);
   await tooltips(page,width,`hosted-${actor}-${name}`);
   await page.screenshot({path:`test-results/${width}-hosted-${actor}-${name}.png`,fullPage:true});
  }
  const request=await page.goto(expected.requestUrl);
  assert.equal(request.status(),200,'the restored public file request opens');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`public file request fits ${width}`);
  await page.screenshot({path:`test-results/${width}-hosted-${actor}-public-request.png`,fullPage:true});
 }
}
