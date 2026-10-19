import { ownerRecovery } from './organisation-recovery.mjs';
// ADMIN-001 remaining lifecycle behavior, through the same real Workers as organisation.mjs.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import { exerciseTransfer } from './organisation-deprovision.mjs';
const cookieJar=(cookie,url)=>cookie.split('; ').map(value=>{const at=value.indexOf('=');return {name:value.slice(0,at),value:value.slice(at+1),url}});
async function shot(page,width,name,state=''){const section=page.getByRole('heading',{name,exact:true}).locator('..');await section.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`ADMIN-001 ${name} fits ${width}`);await section.screenshot({path:`test-results/${width}-lifecycle-${name.toLowerCase().replaceAll(' ','-')}${state?'-'+state:''}.png`})}
export async function exerciseLifecycle({h,owner,scim,browser,page,user,group}){
 await mkdir('test-results',{recursive:true});
 // The owner's recovery address is separate from the staff domain in this real-provider installation.
 await h.api('/organisation/domains',owner,{allowedDomains:['example.test'],requiredDomains:['example.test']});
 assert.equal((await h.raw('/auth/magic-link',null,{email:user.userName})).status,403,'ADMIN-001 required staff domain refuses email links');
 assert.equal((await page.context().request.get(h.origin+'/api/chest/files')).status(),200,'permitted existing company session remains valid');
 await h.api('/organisation/domains',owner,{allowedDomains:['example.test'],requiredDomains:['outside.test']},400);
 await h.api('/organisation/domains',owner,{allowedDomains:['*.example.test'],requiredDomains:[]},400);
 await h.api('/organisation/domains',owner,{allowedDomains:['outside.test'],requiredDomains:[]});
 assert.equal((await page.context().request.get(h.origin+'/api/chest/files')).status(),401,'changing allowed domains revokes a current company session');
 await page.goto(h.origin+'/signin');const denied=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/company/callback');await page.getByRole('button',{name:'Continue with Auth',exact:true}).click();assert.equal((await denied).status(),403,'verified provider identity outside allowed domain is refused');
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/${width}-lifecycle-domain-refused.png`,fullPage:true})}
 await h.api('/organisation/domains',owner,{allowedDomains:['example.test'],requiredDomains:['example.test']});
 await page.goto(h.origin+'/signin');await page.getByRole('button',{name:'Continue with Auth',exact:true}).click();await page.waitForURL(h.origin+'/app/files');
 const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(cookieJar(owner,h.origin));const admin=await context.newPage();admin.setDefaultTimeout(15000);
 try{
  for(const width of [1440,390]){
   const first=await scim('/Users','POST',{schemas:['urn:ietf:params:scim:schemas:core:2.0:User'],userName:`removed-${width}@example.test`,displayName:`Harbor operator ${width}`},201),second=await scim('/Users','POST',{schemas:['urn:ietf:params:scim:schemas:core:2.0:User'],userName:`added-${width}@example.test`,displayName:`Harbor successor ${width}`},201);
   const g=await scim('/Groups','POST',{schemas:['urn:ietf:params:scim:schemas:core:2.0:Group'],displayName:`Harbor freight ${width}`,members:[{value:first.id},{value:user.id}]},201);
   const team=await h.api('/spaces',owner,{name:`Harbor freight ${width}`});await h.api(`/spaces/${team.id}/members`,owner,{members:[{principal:h.vars.OWNER_EMAIL,role:'manager'},{principal:`group:${g.id}`,role:'contributor'}]});
   const desired={schemas:['urn:ietf:params:scim:schemas:core:2.0:Group'],displayName:`Harbor freight reviewed ${width}`,members:[{value:second.id},{value:user.id}]};
   await scim('/Groups/'+g.id,'PUT',desired,409);const effective=await scim('/Groups/'+g.id);assert.equal(effective.displayName,g.displayName);assert.deepEqual(effective.members.map(m=>m.value),[user.id],'removal immediate, addition waits for review');
   const reviews=await h.api('/organisation/groups/review',owner),review=reviews.find(r=>r.resource===g.id&&r.status==='pending');assert.ok(review);assert.deepEqual(review.removed,[first.userName]);assert.deepEqual(review.added,[second.userName]);await scim('/Groups/'+g.id,'PUT',desired,409);assert.equal((await h.api('/organisation/groups/review',owner)).find(r=>r.resource===g.id&&r.status==='pending').id,review.id,'provider retry retains the same pending review');
   const staffCookies=(await page.context().cookies(h.origin)).map(c=>`${c.name}=${c.value}`).join('; ');await h.api('/organisation/groups/review',staffCookies,{id:review.id,revision:review.revision,decision:'apply'},403);
   await admin.setViewportSize({width,height:900});await admin.goto(h.origin+'/app/admin');await shot(admin,width,'Sign-in domains');await shot(admin,width,'Content when staff leave');await shot(admin,width,'Provider group changes','pending');
   await admin.getByLabel('Domains allowed to use company sign-in').fill('example.test');await admin.getByLabel('Domains that must use company sign-in').fill('example.test');await Promise.all([admin.waitForNavigation(),admin.getByRole('button',{name:'Save sign-in domains',exact:true}).click()]);
   await admin.getByRole('combobox',{name:/^Departing person/}).selectOption(first.userName);await admin.getByRole('combobox',{name:/^Successor/}).selectOption(h.vars.OWNER_EMAIL);await Promise.all([admin.waitForNavigation(),admin.getByRole('button',{name:'Save successor',exact:true}).click()]);await shot(admin,width,'Content when staff leave');
   await Promise.all([admin.waitForNavigation(),admin.locator('li').filter({has:admin.getByRole('heading',{name:g.displayName,exact:true})}).getByRole('button',{name:'Apply reviewed group change',exact:true}).click()]);await shot(admin,width,'Provider group changes');
   const applied=await scim('/Groups/'+g.id);assert.equal(applied.displayName,desired.displayName);assert.deepEqual(new Set(applied.members.map(m=>m.value)),new Set([second.id,user.id]));await h.api('/organisation/groups/review',owner,{id:review.id,revision:review.revision,decision:'apply'},409);
   // Newer provider changes invalidate the old confirmation, and declining never restores removed access.
   await scim('/Groups/'+g.id,'PATCH',{schemas:['urn:ietf:params:scim:api:messages:2.0:PatchOp'],Operations:[{op:'remove',path:`members[value eq "${second.id}"]`}]},409);let pending=(await h.api('/organisation/groups/review',owner)).find(r=>r.resource===g.id&&r.status==='pending');
   await scim('/Groups/'+g.id,'PUT',{...desired,members:[]},409);await h.api('/organisation/groups/review',owner,{id:pending.id,revision:pending.revision,decision:'apply'},409);pending=(await h.api('/organisation/groups/review',owner)).find(r=>r.resource===g.id&&r.status==='pending');await h.api('/organisation/groups/review',owner,{id:pending.id,revision:pending.revision,decision:'decline'});assert.equal((await scim('/Groups/'+g.id)).members.length,0);
   await scim('/Groups/'+g.id,'DELETE',undefined,409);const deletion=(await h.api('/organisation/groups/review',owner)).find(r=>r.resource===g.id&&r.status==='pending');assert.equal(deletion.deleted,true);await h.api('/organisation/groups/review',owner,{id:deletion.id,revision:deletion.revision,decision:'apply'});await scim('/Groups/'+g.id,'GET',undefined,404);
  }
 }finally{await context.close()}
 await exerciseTransfer({h,owner,scim,page,user});
 owner=await ownerRecovery(h,owner);
 await h.api('/organisation/domains',owner,{allowedDomains:[],requiredDomains:[]});
 console.log('ADMIN-001 domains, destructive group preview/confirmation/stale refusal, content-before-deprovision and owner recovery at 1440/390 passed');
 return owner;
}
