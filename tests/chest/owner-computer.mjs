import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {running,ready,rerCommand} from './owner-process.mjs';

// The fresh checkout and locked dependency install are supplied by remote-run.
export async function computerJourney(browser,port) {
 const root=process.cwd();
 await rerCommand(['install']);
 await rerCommand(['setup','--owner-email',process.env.TEST_MAIL_TO,'--port',String(port),'--non-interactive']);
 const server=running(['dev','--foreground','--port',String(port),'--json']);let context;
 try {
  await ready(server,'"event":"ready"');
  context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
  try {await page.goto((await readFile(join(root,'.rer/local/open-url'),'utf8')).trim());await page.waitForURL(/\/(app|setup)(\/|$)/);}catch{throw Error('Private local owner navigation failed.');}
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup',exact:true}).click();}
  await page.waitForURL('**/app/files');
  const session=await (await context.request.get(`http://127.0.0.1:${port}/auth/session`)).json();
  assert.equal(session.operator.email,process.env.TEST_MAIL_TO);
  for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${process.platform}-owner-computer-${width}.png`,fullPage:true});}
  console.log('Fresh computer install reached the owner library on '+process.platform+'.');
 }finally{await context?.close();await server.stop();}
 await rerCommand(['build']);
}
