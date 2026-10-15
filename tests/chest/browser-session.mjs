import assert from 'node:assert/strict';
import {browserSignIn} from './local.mjs';
// Sign out through the header (behind "Menu" at phone width): the browser lands on sign-in, and the session it held
// is revoked on the server, not only forgotten by the browser. Another session of the same person keeps working.
export async function signOutFlow({browser,origin,devKey,persona,width,other}){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
 try{
  await browserSignIn(page,origin,devKey,persona);
  const held=(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
  if(width<=760)await page.getByText('Menu',{exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/signin');
  assert.equal((await fetch(origin+'/api/chest/library',{headers:{cookie:held}})).status,401,'the signed-out session is revoked');
  assert.equal((await page.goto(origin+'/app')).url().includes('/signin'),true,'the app asks the browser to sign in again');
  assert.equal((await other.request.get(origin+'/api/chest/library')).status(),200,'other sessions stay signed in');
 }finally{await context.close()}
 console.log(`Sign-out revoked the session at ${width}`);
}
