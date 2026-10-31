import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {expect} from '@playwright/test';

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

async function activate(page, target, key = 'Enter', navigation = true) {
 await tabTo(page, target);
 if (navigation) await Promise.all([page.waitForNavigation(), page.keyboard.press(key)]);
 else await page.keyboard.press(key);
}

async function escapeDisclosure(page, details) {
 await page.keyboard.press('Escape');
 await expect(details).not.toHaveAttribute('open');
 await expect(details.locator(':scope > summary')).toBeFocused();
 await focusProof(page);
}

async function snapshot(page, width, name) {
 await page.evaluate(() => document.fonts.ready);
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'keyboard screen fits the viewport');
 await page.screenshot({path:`test-results/${width}-keyboard-${name}.png`,fullPage:true});
}

// One connected public-door journey, folded into the existing push browser runner.
// Business assertions run at desktop width; the phone repeats the flow as browser
// proof, with its own navigation reachability and focus checks.
export async function accessibilityJourney({h, page, cookie, reader, width, assertions = width === 1440}) {
 const api = (path, body, status) => h.api(path, cookie, body, status);
 const bytes = value => Buffer.from(value).toString('base64');
 const personal = (await api('/files')).personal;
 const project = await api('/items', {space:personal,type:'folder',name:`synthetic-chest-47-${width}`});
 const client = await api('/items', {parent:project.id,type:'folder',name:'Harbor launch'});
 const folder = await api('/items', {parent:client.id,type:'folder',name:'Delivery originals'});
 const first = Buffer.from('synthetic-chest-47: signed delivery checklist, initial original.');
 const second = Buffer.from('synthetic-chest-47: signed delivery checklist, revised original.');
 const companion = Buffer.from('synthetic-chest-47: packing notes retained beside the delivery checklist.');
 const file = await api('/items', {parent:folder.id,name:'delivery-checklist.txt',base64:bytes(first)});
 await api(`/items/${file.id}/versions`, {filename:'delivery-checklist.txt',base64:bytes(second)});
 const notes = await api('/items', {parent:folder.id,name:'packing-notes.md',base64:bytes(companion)});
 const original = await api(`/items/${file.id}`), beforeNotes = await api(`/items/${notes.id}`);
 if (assertions) assert.equal((await h.raw(`/api/chest/items/${file.id}`, reader.cookie)).status, 403, 'an unshared colleague cannot read the original');

 await page.goto(h.origin + '/app/files');
 const menu = page.locator('details.app-menu');
 if (width === 390) {
  await activate(page, menu.locator(':scope > summary'), 'Space', false);
  await expect(menu).toHaveAttribute('open');
  const icon = page.getByRole('link', {name:'New team space',exact:true});
  await tabTo(page, icon);
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(menu).toHaveAttribute('open');
  await expect(icon).toBeFocused();
  await escapeDisclosure(page, menu);
  await activate(page, menu.locator(':scope > summary'), 'Enter', false);
  await tabTo(page, menu.getByRole('button', {name:'Sign out',exact:true}));
  await page.keyboard.press('Tab');
  await expect(menu).not.toHaveAttribute('open');
  await focusProof(page);
  await tabTo(page, menu.locator(':scope > summary'), true);
  await activate(page, menu.locator(':scope > summary'), 'Space', false);
 }
 await activate(page, page.getByRole('navigation', {name:'Chest'}).getByRole('link', {name:'My files',exact:true}));
 for (const name of [`synthetic-chest-47-${width}`, 'Harbor launch', 'Delivery originals']) {
  await activate(page, page.getByRole('main').getByRole('link', {name,exact:true}));
 }
 await snapshot(page, width, 'store');

 // Native disclosures must open with both activation keys, return focus on
 // Escape, and leave their input intact when merely dismissed.
 const create = page.locator('details.disclosure').filter({has:page.getByText('New folder',{exact:true})});
 await activate(page, create.locator(':scope > summary'), 'Enter', false);
 const folderName = create.getByLabel('Folder name', {exact:true});
 await tabTo(page, folderName);
 await page.keyboard.insertText('Meeting records');
 await tabTo(page, create.locator(':scope > summary'), true);
 await tabTo(page, folderName);
 await escapeDisclosure(page, create);
 await activate(page, create.locator(':scope > summary'), 'Space', false);
 if (assertions) await expect(folderName).toHaveValue('Meeting records');
 await activate(page, create.getByRole('button', {name:'Create folder',exact:true}));
 const created = new URL(page.url()).pathname.split('/').at(-1);
 if (assertions) assert.equal((await api(`/items/${created}`)).item.parent, folder.id);
 await activate(page, page.getByRole('navigation', {name:'Breadcrumb'}).getByRole('link', {name:'Delivery originals',exact:true}));

 await activate(page, page.getByRole('main').getByRole('link', {name:'delivery-checklist.txt',exact:true}));
 const safeOriginal = page.getByRole('link', {name:'Open safe text preview',exact:true}).first();
 await tabTo(page, safeOriginal);
 const [preview] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')]);
 await preview.waitForLoadState();
 if (assertions) assert.equal(await preview.locator('body').innerText(), second.toString());
 await preview.close();
 await snapshot(page, width, 'open');

 await tabTo(page, page.locator('.bar-actions').getByRole('link', {name:'Share',exact:true}), true);
 await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
 const share = page.locator('form').filter({has:page.getByRole('button', {name:'Share',exact:true})});
 await tabTo(page, share.getByLabel('Person or group'));
 await page.keyboard.press('Home');
 await page.keyboard.press('b'); // Ben is the real invited colleague in the parent journey.
 if (assertions) await expect(share.getByLabel('Person or group')).toHaveValue(reader.principal);
 await tabTo(page, share.getByLabel(/^Role/));
 await page.keyboard.press('Home');
 await page.keyboard.press('ArrowDown');
 await tabTo(page, share.getByLabel('Message (optional)', {exact:true}));
 await page.keyboard.insertText('Please check the revised delivery original.');
 await activate(page, share.getByRole('button', {name:'Share',exact:true}), 'Space');
 await snapshot(page, width, 'share');
 if (assertions) {
  const shared = await h.api(`/items/${file.id}`, reader.cookie);
  assert.equal(shared.role, 'commenter');
  assert.equal(shared.can.contribute, false);
  assert.equal(shared.can.share, false);
  await h.api(`/items/${file.id}/versions`, reader.cookie, {base64:bytes('synthetic-chest-47 forbidden replacement')}, 403);
  assert.deepEqual((await api(`/items/${file.id}`)).versions, original.versions, 'sharing and refused edits preserve retained originals');
 }

 const search = page.getByRole('search').getByRole('searchbox');
 await tabTo(page, search);
 await page.keyboard.insertText('delivery-checklist');
 await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
 await tabTo(page, page.getByRole('main').getByRole('searchbox'));
 await tabTo(page, page.getByLabel('Documents',{exact:true}));
 await page.keyboard.press('Space');
 await page.keyboard.press('Space');
 await activate(page, page.getByRole('button', {name:'Apply filters',exact:true}));
 await snapshot(page, width, 'search');
 await activate(page, page.getByRole('main').getByRole('link', {name:'delivery-checklist.txt',exact:true}));
 await activate(page, page.getByRole('navigation', {name:'Breadcrumb'}).getByRole('link', {name:`synthetic-chest-47-${width}`,exact:true}));
 await activate(page, page.getByRole('button', {name:'Move to trash',exact:true}));
 if (assertions) {
  await h.api(`/items/${file.id}`, reader.cookie, undefined, 404);
  const retained = original.versions[0];
  assert.equal((await h.raw(`/api/chest/items/${file.id}/bytes/${retained.id}?download=true`, reader.cookie)).status, 404);
 }
 if (width === 390) await activate(page, menu.locator(':scope > summary'), 'Space', false);
 await activate(page, page.getByRole('navigation', {name:'Chest'}).getByRole('link', {name:'Trash',exact:true}));
 await snapshot(page, width, 'recover');
 const trashRow = page.locator('li.row-tabbed').filter({hasText:`synthetic-chest-47-${width}`});
 await activate(page, trashRow.getByRole('button', {name:'Restore',exact:true}));
 if (assertions) {
  const restored = await api(`/items/${file.id}`), restoredNotes = await api(`/items/${notes.id}`);
  assert.equal(restored.id, file.id, 'restore keeps the stable file identity');
  assert.equal(restored.item.parent, folder.id);
  assert.deepEqual(restored.versions, original.versions);
  assert.deepEqual(restoredNotes.versions, beforeNotes.versions);
  assert.equal((await h.api(`/items/${file.id}`, reader.cookie)).role, 'commenter');
  for (const [item, versions, expected] of [[file.id,original.versions,[sha(second),sha(first)]],[notes.id,beforeNotes.versions,[sha(companion)]]]) {
   assert.deepEqual(versions.map(version => version.checksum), expected);
   for (const version of versions) {
    const response = await h.raw(`/api/chest/items/${item}/bytes/${version.id}?download=true`, cookie);
    assert.equal(response.status,200);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())), version.checksum, 'every retained original downloads unchanged');
   }
  }
  const response = await h.raw(`/api/chest/items/${file.id}/bytes/${original.item.current}?download=true`, reader.cookie);
  assert.equal(response.status,200);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(second));
 }
 // Leaving recovery in reverse order proves the controls do not trap focus.
 await tabTo(page, page.getByRole('search').getByRole('searchbox'), true);
 await snapshot(page, width, 'restored');
 console.log(`PROBE OPS-001 1: keyboard store, open, share, search, trash and restore at ${width} -> focus, authority, stable IDs and retained originals reconciled`);
}
