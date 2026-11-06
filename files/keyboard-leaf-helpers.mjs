import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {expect} = await import(pathToFileURL(process.cwd() + '/node_modules/@playwright/test/index.mjs'));

const sha = value => createHash('sha256').update(value).digest('hex');

// Read the actually focused control; never move focus with a locator or a script.
// A visible ring on the picker label counts when its native input is transparent.
async function focusProof(page) {
 await page.locator(':focus').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
 const proof = await page.locator(':focus').evaluate(element => {
  const labels = element.labels ? [...element.labels].map(label => label.textContent).join(' ') : '';
  const namedBy = (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
  const name = element.getAttribute('aria-label') || namedBy.trim() || labels.trim() || element.textContent.trim() || element.getAttribute('title');
  const target = element.matches('.upload-input') ? element.closest('label') : element;
  const style = getComputedStyle(target), box = target.getBoundingClientRect();
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  const shadowed = /0px 0px 0px [2-9]px/.test(style.boxShadow);
  return {name, tag:element.tagName, shadow:style.boxShadow, outline:style.outline, box:{x:box.x,y:box.y,width:box.width,height:box.height}, viewport:{width:innerWidth,height:innerHeight}, visible:box.width > 0 && box.height > 0 && box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight && box.right <= innerWidth,
   unobscured:!!hit && (target.contains(hit) || hit.contains(element)), ring:outlined || shadowed};
 });
 if (!proof.visible || !proof.unobscured || !proof.ring) await page.screenshot({path:'test-results/keyboard-focus-failure.png',fullPage:false});
 assert.ok(proof.name, `keyboard control has an accessible name: ${JSON.stringify(proof)}`);
 assert.ok(proof.visible && proof.unobscured, `keyboard focus is visible and unobscured: ${JSON.stringify(proof)}`);
 assert.ok(proof.ring, `keyboard focus has a visible indicator: ${JSON.stringify(proof)}`);
 const tooltip = await page.locator(':focus').getAttribute('data-tooltip');
 if (tooltip) await expect(page.getByRole('tooltip')).toHaveText(tooltip);
}

async function tabTo(page, target, backwards = false) {
 const seen = new Set();
 for (let step = 0; step < 180; step++) {
  if (await target.evaluateAll(elements => elements.includes(document.activeElement))) {
   await focusProof(page);
   return;
  }
  await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  const focused = page.locator(':focus');
  if (!await focused.count()) continue; // The browser chrome is part of the tab cycle.
  await focusProof(page);
  const identity = await focused.evaluate(element => {
   const path = [];
   for (let at = element; at && at !== document.body; at = at.parentElement) path.unshift(`${at.tagName}:${[...at.parentElement.children].indexOf(at)}`);
   return path.join(' > ');
  });
  // Native date controls visit several segments without changing activeElement.
  if (await focused.evaluate(element => ['date','datetime-local','time'].includes(element.type))) continue;
  if (seen.has(identity)) {
   await page.screenshot({path:'test-results/keyboard-trap-failure.png',fullPage:false});
   assert.fail(`no keyboard trap while reaching ${target}: ${JSON.stringify(await target.evaluateAll(elements => elements.map(element => element.outerHTML)))}; active=${await focused.evaluate(element => element.outerHTML)}`);
  }
  seen.add(identity);
 }
 assert.fail(`keyboard target was not reachable: ${target}`);
}


export {tabTo};
