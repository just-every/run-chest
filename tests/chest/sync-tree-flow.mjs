import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {harness} from './harness.mjs';

// Creation inputs and receipts are the inventory oracle, independent of every tree response.
export async function syncTreeFlow(){
 const h=await harness(),email=n=>`synthetic-chest-${n}${String.fromCharCode(64)}example.test`;
 const inventory=new Map(),originals=new Map(),spaces=new Map(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 try{
  assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Synthetic owner'})).status,303);
  const owner=await h.signIn(h.vars.OWNER_EMAIL);
  assert.equal((await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})).status,303);
  const people=[];
  for(const n of [1,2]){
   await h.api('/people',owner,{action:'invite',email:email(n),name:`synthetic-chest-${n}`});
   const cookie=await h.signIn(email(n),true),personal=(await h.api('/files',cookie)).personal;
   people.push({cookie,personal});
   spaces.set(personal,{id:personal,name:n===1?'My files':'Shared with me',kind:'personal'});
  }
  const [reader,manager]=people,team=await h.api('/spaces',manager.cookie,{name:'synthetic-chest-3'});
  spaces.set(team.id,{id:team.id,name:'synthetic-chest-3',kind:'team'});
  await h.api(`/spaces/${team.id}/members`,manager.cookie,{members:[{principal:email(2),role:'manager'},{principal:email(1),role:'viewer'}]});
  const group=await h.api('/groups',owner,{name:'synthetic-chest-4',members:[email(1)]});
  const add=async(n,{parent=null,space=team.id,file=false,cookie=manager.cookie}={})=>{
   const name=`synthetic-chest-${n}${file?'.txt':''}`,bytes=Buffer.from(`synthetic-chest-${n} original`);
   const receipt=await h.api('/items',cookie,{space,parent,name,type:file?'file':'folder',...(file?{base64:bytes.toString('base64'),checksum:sha(bytes)}:{})});
   const item={id:receipt.id,space,parent,name,type:file?'file':'folder',version:file?receipt.payload.current:null};
   assert.ok(item.id);if(file)assert.ok(item.version);
   inventory.set(item.id,item);if(file)originals.set(item.id,bytes);return item;
  };
  const restrict=async item=>h.api(`/items/${item.id}/settings`,manager.cookie,{restricted:true});
  const grant=async(item,principal)=>h.api(`/items/${item.id}/shares`,manager.cookie,{principal,role:'viewer'});
  const own=await add(101,{space:reader.personal,cookie:reader.cookie});
  const ownFile=await add(102,{space:reader.personal,parent:own.id,file:true,cookie:reader.cookie});
  const open=await add(103),openFile=await add(104,{parent:open.id,file:true});
  // An old version must never replace the current version in the enumerated tree.
  const replaced=await h.api(`/items/${openFile.id}/versions`,manager.cookie,{base64:Buffer.from('synthetic-chest-104 replacement').toString('base64')});
  assert.notEqual(replaced.payload.current,openFile.version);openFile.version=replaced.payload.current;
  originals.set(openFile.id,Buffer.from('synthetic-chest-104 replacement'));
  const restricted=await add(105),hiddenNested=await add(106,{parent:restricted.id});
  await add(107,{parent:hiddenNested.id,file:true});await restrict(restricted);
  const direct=await add(108),directNested=await add(109,{parent:direct.id}),directFile=await add(110,{parent:directNested.id,file:true});
  const directHidden=await add(111,{parent:directNested.id});await add(112,{parent:directHidden.id,file:true});
  await restrict(direct);await restrict(directHidden);await grant(direct,email(1));
  const grouped=await add(113),groupNested=await add(114,{parent:grouped.id}),groupFile=await add(115,{parent:groupNested.id,file:true});
  const groupHidden=await add(116,{parent:groupNested.id});await add(117,{parent:groupHidden.id,file:true});
  await restrict(grouped);await restrict(groupHidden);await grant(grouped,group.id);
  // A direct grant below a concealed ancestor is visible without disclosing the ancestor's name.
  const sharedPersonal=await add(118,{space:manager.personal}),sharedFile=await add(119,{space:manager.personal,parent:sharedPersonal.id,file:true});
  await grant(sharedFile,email(1));await add(120,{space:manager.personal,file:true});
  const permitted=new Set([own,ownFile,open,openFile,direct,directNested,directFile,grouped,groupNested,groupFile,sharedFile].map(i=>i.id));
  const device=await h.api('/devices',reader.cookie,{name:'synthetic-chest-5',platform:'windows'});
  const read=async(query={})=>{
   const response=await h.fetch('/api/chest/sync/tree?'+new URLSearchParams({limit:'1',...query}),{headers:{authorization:`Bearer ${device.token}`}});
   assert.equal(response.status,200);return response.json();
  };
  const identity=item=>({id:item.id,space:item.space,parent:item.parent,name:item.name,type:item.type,version:item.version?.id??null});
  const ordered=items=>items.sort((a,b)=>a.id.localeCompare(b.id));
  const inspect=(page,expected)=>{
   assert.ok(page.items.length<=1,'one-item pages remain bounded');
   const text=JSON.stringify(page);
   for(const item of inventory.values())if(!expected.has(item.id))assert.ok(!text.includes(item.name),`a concealed name is absent: ${item.name}`);
   for(const item of page.items){
    assert.ok(expected.has(item.id),'only independently permitted IDs appear');
    assert.deepEqual(identity(item),inventory.get(item.id),'exact parent, name and current version match the creation inventory');
   }
   assert.deepEqual(page.spaces,page.items.length?[spaces.get(page.items[0].space)]:[],'space names reveal only the permitted page');
  };
  const enumerate=async(expected,query={},first)=>{
   const seen=new Map();let page=first??await read(query),after=query.after??'',empty=0;
   const cursor=String(page.cursor),start=after;
   for(let count=0;;count++){
    assert.ok(count<=inventory.size,'enumeration terminates within the isolated inventory');
    assert.equal(String(page.cursor),cursor,'a continuation retains its change boundary');inspect(page,expected);
    if(!page.items.length&&page.next)empty++;
    for(const item of page.items){assert.ok(!seen.has(item.id),'no item is duplicated');seen.set(item.id,identity(item))}
    if(!page.next)break;
    assert.ok(page.next>after,'even an inaccessible page advances');after=page.next;
    page=await read({...query,cursor,after});
   }
   const want=[...inventory.values()].filter(i=>expected.has(i.id)&&i.id>start&&(!query.space||i.space===query.space));
   assert.deepEqual(ordered([...seen.values()]),ordered(want),'complete enumeration equals the independent inventory');
   return {empty,count:seen.size};
  };
  const initial=await enumerate(permitted);
  assert.ok(initial.empty>0,'inaccessible records produce empty pages with a continuation');
  for(const space of [team.id,reader.personal,manager.personal])await enumerate(permitted,{space});
  console.log(`PROBE SYNC-001 1 inventory: one-item device pages -> ${initial.count} exact items; inaccessible continuation pages observed`);
  const revoke=async(items,action,label)=>{
   const first=await read();inspect(first,permitted);assert.ok(first.next);
   const boundary={cursor:String(first.cursor),after:first.next};
   assert.ok(items.some(i=>i.id>boundary.after),'revocation occurs before affected records are enumerated');
   await action();for(const item of items)permitted.delete(item.id);
   await enumerate(permitted,boundary);await enumerate(permitted);
   // The same credential and pre-revocation continuation survive an actual Worker restart; authority does not.
   await h.stop();await h.start();await enumerate(permitted,boundary);await enumerate(permitted);
   for(const item of [ownFile,openFile,sharedFile]){
    const bytes=await h.fetch(`/api/chest/sync/items/${item.id}/content`,{headers:{authorization:`Bearer ${device.token}`}});
    assert.equal(bytes.status,200);assert.equal(sha(Buffer.from(await bytes.arrayBuffer())),sha(originals.get(item.id)),'permitted personal, team and shared originals remain available');
   }
   for(const item of items.filter(i=>i.type==='file')){
    const refused=await h.fetch(`/api/chest/sync/items/${item.id}/content`,{headers:{authorization:`Bearer ${device.token}`}});
    assert.equal(refused.status,403);const text=await refused.text();assert.ok(!text.includes(item.name));assert.ok(!text.includes(originals.get(item.id).toString()));
   }
   console.log(`PROBE SYNC-001 1 ${label}: public revocation -> subsequent and fresh pages omit affected items and names before and after restart; permitted bytes retained`);
  };
  await revoke([direct,directNested,directFile],()=>h.api(`/items/${direct.id}/unshare`,manager.cookie,{principal:email(1)}),'direct grant');
  await revoke([grouped,groupNested,groupFile],()=>h.api(`/groups/${group.id}`,owner,{name:'synthetic-chest-4',members:[]}),'group membership');
 }finally{await h.close()}
}
