import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { command, serving } from './local.mjs';

// Run before ordinary identity journeys, in their genuine fresh disposable clone.
// No setup call precedes dev: the CLI must install and prepare a usable owner.
export async function firstRunJourney(root, port) {
 const origin = `http://127.0.0.1:${port}`;
 const server = await serving(root, 'dev', port);
 let browser;
 try {
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  await mkdir('test-results', { recursive: true });
  // rer dev claimed the owner before readiness: the Lobby offers Sign in while first-run setup waits at /setup.
  assert.equal((await (await fetch(origin + '/setup/state')).json()).state, 'claimed');
  const owner = await browser.newPage();
  // A navigation failure may contain this credential; never let it reach a log.
  try {
   await owner.goto((await readFile(root + '/.rer/local/open-url', 'utf8')).trim());
   await owner.waitForURL('**/setup');
  } catch { throw Error('Fresh dev owner link failed; private navigation details withheld'); }
  const session = await (await owner.request.get(origin + '/auth/session')).json();
  assert.equal(session.operator.role, 'owner');
  for (const width of [1440, 390]) {
   await owner.setViewportSize({ width, height: width === 390 ? 844 : 900 });
   await owner.screenshot({ path: `test-results/setup-${width}.png`, fullPage: true });
  }
  await owner.getByRole('checkbox').check();
  await owner.getByRole('button', { name: 'Finish setup', exact: true }).click();
  await owner.waitForURL('**/app');
  for (const width of [1440, 390]) {
   await owner.setViewportSize({ width, height: width === 390 ? 844 : 900 });
   await owner.goto(origin);
   await owner.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
   assert.ok(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   await owner.screenshot({ path: `test-results/lobby-claimed-${width}.png`, fullPage: true });
   const signedOut = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
   await signedOut.goto(origin + '/signin');
   await signedOut.screenshot({ path: `test-results/signin-${width}.png`, fullPage: true });
   await signedOut.close();
  }
 } finally { await browser?.close(); await server.stop(); }
 await command(root, ['reset', '--yes']);
 console.log('Fresh rer dev opened a usable owner; Lobby and setup passed at 1440 and 390.');
}
