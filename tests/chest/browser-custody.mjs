import assert from 'node:assert/strict';
import {json} from './local.mjs';

export async function createReviewerGroup(owner,origin,email,width){
 await owner.goto(origin+'/app/admin');
 const form=owner.locator('form').filter({has:owner.getByRole('button',{name:'Create group',exact:true})});
 await form.getByLabel('Group name').fill(`Review team ${width}`);
 await Promise.all([owner.waitForNavigation(),form.getByRole('button',{name:'Create group',exact:true}).click()]);
 const row=owner.locator('li.row-tabbed').filter({has:owner.locator('.row-name',{hasText:`Review team ${width}`})});await row.locator('summary').click();
 await row.getByLabel('Add a member (email)').fill(email);await Promise.all([owner.waitForNavigation(),row.getByRole('button',{name:'Add member'}).click()]);
 const group=(await json(owner,origin,'/library')).groups.find(r=>r.payload.name===`Review team ${width}`);
 assert.deepEqual(group.payload.members,[email]);return group;
}

// Choose a document type on a filing form and fill its typed fields (one input per field of that type).
export async function chooseType(page,typeName,values){
 await page.getByRole('radio',{name:typeName,exact:true}).check();
 const fields=page.locator('.type-choice').filter({has:page.getByRole('radio',{name:typeName,exact:true})});
 for(const [name,value] of Object.entries(values))await fields.getByLabel(new RegExp(`^${name} `)).fill(value);
}

export async function retainRecoveryRecords({owner,reviewer,origin,collection,schema,email,width,archive,group}){
 await owner.goto(origin+'/app/library');await owner.getByText('Upload a document',{exact:true}).click();
 await owner.getByLabel('Title',{exact:true}).fill(`Retained trash ${width}`);
 await owner.getByLabel(/^Collection/).selectOption(collection.id);
 await chooseType(owner,schema.payload.name,{reference:'TRASH-EVIDENCE'});
 await owner.getByLabel(/^Reviewer/).selectOption(email);
 await owner.getByLabel('Original file').setInputFiles({name:'retained-trash.txt',mimeType:'text/plain',buffer:Buffer.from('Original retained in reversible trash')});
 await owner.getByRole('button',{name:'Upload and submit'}).click();await owner.waitForURL('**/app/documents/*');
 const trashId=owner.url().split('/').at(-1);await owner.getByRole('button',{name:'Move to reversible trash'}).click();
 const trash=await json(owner,origin,`/documents/${trashId}`);assert.equal(trash.payload.trash,true);
 assert.equal((await reviewer.goto(origin+`/app/documents/${trashId}`)).status(),404);
 await owner.goto(origin+'/app/archive');
 await owner.getByLabel('Archive JSON file').setInputFiles({name:'retained-archive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...archive,source:`retained-archive-${width}`}))});
 await owner.getByLabel('Destination collection').selectOption(collection.id);
 await owner.getByLabel(/^Document type/).selectOption(schema.id);
 await owner.getByLabel(/^Reviewer/).selectOption(email);
 await owner.getByRole('button',{name:'Preview archive'}).click();await owner.getByRole('button',{name:'Apply this reviewed fingerprint'}).click();
 const job=JSON.parse(await owner.locator('pre').innerText());assert.equal(job.state,'completed');
 const imported=(await json(owner,origin,'/library')).documents.find(r=>r.payload.source?.archive===`retained-archive-${width}`);
 assert.equal(imported.payload.private,true);assert.equal(imported.payload.approved,null);
 assert.equal((await reviewer.goto(origin+`/app/documents/${imported.id}`)).status(),404);
 return {group,trash,imported,jobId:job.id};
}
