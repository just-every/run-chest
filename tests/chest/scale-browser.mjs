import assert from 'node:assert/strict';
import {tooltips} from './tooltip-proof.mjs';
const resetScroll=page=>page.evaluate(()=>{scrollTo(0,0);for(const element of document.querySelectorAll('*'))if(element.scrollLeft)element.scrollLeft=0});

export async function scaleScreens({browser,h,owner,data}){
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
  try{
   await context.addCookies(owner.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin,secure:true}}));
   const page=await context.newPage();
   await page.goto(h.origin+'/app/administration');
   await page.getByRole('link',{name:'Operating scale',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await tooltips(page,width,'scale-administration');
   await resetScroll(page);
   await page.screenshot({path:`test-results/${width}-scale-administration.png`,fullPage:true});
   await page.screenshot({path:`test-results/${width}-scale-administration-view.png`});
   if(data.membersSpace){
    const first=await page.locator('#people h3').first().textContent();
    await page.getByRole('link',{name:'Next people',exact:true}).first().click();
    await page.waitForURL('**/app/administration?peoplePage=1#people');
    assert.equal(await page.getByRole('heading',{name:first,exact:true}).count(),0,'the next page shows another part of the current scoped roster');
    await page.goto(h.origin+'/app/administration?peoplePage=99999');
    const last=data.membersSpace.members.map(m=>m.principal).sort().at(-1);
    const finalPerson=page.locator('#people h3').filter({hasText:last});
    assert.equal(await finalPerson.count(),1,'the final admitted person remains reachable');
    assert.equal(await page.getByRole('link',{name:'Next people',exact:true}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`test-results/${width}-scale-administration-last.png`,fullPage:true});
    await finalPerson.scrollIntoViewIfNeeded();assert.ok(await finalPerson.isVisible());
    await page.screenshot({path:`test-results/${width}-scale-administration-last-view.png`});
   }
   await page.getByRole('link',{name:'Operating scale',exact:true}).click();
   await page.getByRole('heading',{name:'Operating scale',exact:true}).waitFor();
   assert.ok(await page.getByText('Failing scale health check',{exact:true}).isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await tooltips(page,width,'scale');
   await resetScroll(page);
   await page.screenshot({path:`test-results/${width}-scale.png`,fullPage:true});
   await page.screenshot({path:`test-results/${width}-scale-view.png`});
  }finally{await context.close()}
 }
}
