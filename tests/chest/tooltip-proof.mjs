import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
// Folded into each affected clause's own browser journey, at both viewport widths.
export async function tooltips(page,width,label){
 const menu=page.locator('details.app-menu');const opened=width===390&&!await menu.evaluate(e=>e.open);
 if(opened)await menu.locator('summary').click();
 const controls=page.locator('[data-tooltip]');let proved=0;
 for(let i=0;i<await controls.count();i++){
  const control=controls.nth(i);if(!await control.isVisible())continue;
  const name=await control.getAttribute('data-tooltip');await control.scrollIntoViewIfNeeded();
  await control.focus();await expect(page.getByRole('tooltip')).toHaveText(name);await expect(page.getByRole('tooltip')).toBeVisible();
  assert.match(await control.getAttribute('aria-describedby'),/chest-tooltip/);
  await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toBeHidden();await control.evaluate(e=>e.blur());
  await page.mouse.move(0,0);await control.hover();assert.equal(await page.getByRole('tooltip').isVisible(),false,'hover starts with a delay');
  await expect(page.getByRole('tooltip')).toBeVisible();await expect(page.getByRole('tooltip')).toHaveText(name);
  assert.ok(await page.getByRole('tooltip').evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth}));
  await page.screenshot({path:`test-results/${width}-${label}-tooltip-${i}.png`,fullPage:true});
  await page.mouse.move(0,0);await expect(page.getByRole('tooltip')).toBeHidden();proved++;
 }
 assert.ok(proved>=2,'shared rail icon controls have tooltips');if(opened)await menu.locator('summary').click();
}
