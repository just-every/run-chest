import assert from 'node:assert/strict';

// Version-scoped colleagues receive text only for the destination they can currently open.
// Exercise retained mentions, assignment, participants and the file's creator through HTTP.
export async function annotationRecipientsFlow({h,people,bytes,anchor}) {
 for(const kind of ['mention','assignment','author','reply','owner']) {
  const space=await h.api('/spaces',people.manager,{name:`Version-scoped ${kind}`});
  await h.api(`/spaces/${space.id}/members`,people.manager,{members:[{principal:'manager@example.test',role:'manager'},{principal:'viewer@example.test',role:'contributor'}]});
  const file=await h.api('/items',people.viewer,{space:space.id,name:'Scoped review.pdf',base64:Buffer.from(bytes).toString('base64')}),key=file.id;
  const path=`/items/${key}/comments`,message=`Destination-scoped ${kind} discussion`;
  const source=await h.api(path,kind==='author'?people.viewer:people.manager,{message,anchor,...(kind==='mention'?{mentions:['viewer@example.test']}:kind==='assignment'?{assignee:'viewer@example.test'}:{})});
  if(kind==='reply')await h.api(`${path}/${source.id}/reply`,people.viewer,{message:'Original participant'});
  const second=(await h.api(`/items/${key}/versions`,people.manager,{base64:Buffer.from(bytes).toString('base64')})).payload.current;
  await h.api(`/spaces/${space.id}/members`,people.manager,{members:[{principal:'manager@example.test',role:'manager'}]});
  const link=await h.api(`/items/${key}/links`,people.manager,{audience:'organisation',role:'viewer',versionMode:'pinned',version:second,discoverable:true});
  const third=(await h.api(`/items/${key}/versions`,people.manager,{base64:Buffer.from(bytes).toString('base64')})).payload.current;
  assert.deepEqual((await h.api(`/items/${key}`,people.viewer)).versions.map(v=>v.id),[second]);
  const state=async()=>{const view=await h.api(`/items/${key}`,people.manager);return {comments:view.comments,versions:view.versions,audit:view.activity.filter(a=>a.action.startsWith('comment.')),notices:(await h.api('/notices',people.viewer)).filter(n=>n.payload.item===key),mail:h.mails.filter(m=>[m.to].flat().includes('viewer@example.test')).length}};
  const before=await state(),carry={key:crypto.randomUUID(),version:third,expectedCurrent:third,anchor};
  const required=kind==='mention'||kind==='assignment';
  const result=await h.api(`${path}/${source.id}/carry`,people.manager,carry,required?403:200),after=await state();
  if(required){assert.equal(result.error,'comment_recipient_unavailable');assert.deepEqual(after,before,'required out-of-version recipient refuses all publication')}
  else {assert.equal(result.payload.version,third);assert.deepEqual(after.notices,before.notices);assert.equal(after.mail,before.mail,'implicit out-of-version recipients receive no copied text')}
  assert.deepEqual((await h.api(`/items/${key}`,people.viewer)).comments,[],'pinned viewer cannot read the copied thread');
  // The same explicit recipient is supported once the live link includes the destination.
  await h.api(`/links/${link.link.id}`,people.manager,{remove:true});
  await h.api(`/items/${key}/links`,people.manager,{audience:'organisation',role:'viewer',versionMode:'pinned',version:third,discoverable:true});
  const accepted=await h.api(`${path}/${source.id}/carry`,people.manager,{...carry,key:crypto.randomUUID()});
  assert.equal(accepted.payload.version,third);
  assert.ok((await h.api('/notices',people.viewer)).some(n=>n.payload.item===key&&n.payload.type==='comment.carry'));
  assert.ok(h.mails.some(m=>[m.to].flat().includes('viewer@example.test')&&m.text.includes(message)&&m.text.includes('carried')));
  const view=await h.api(`/items/${key}`,people.viewer);assert.ok(view.comments.some(c=>c.id===accepted.id));assert.ok(!view.comments.some(c=>c.id===source.id));
 }
}
