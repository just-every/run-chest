import {createHash} from 'node:crypto';

// Deterministic originals are admitted through the same public doors as owner uploads.
export const reference={items:2000000,bytes:10000000000000,depth:100,members:150,devices:300,largestSpace:500000,largestFolder:20000,directMembers:600,changes:10000,offlineDays:7};
export function inventoryTarget(inventory={}){return Object.fromEntries(Object.entries(reference).map(([k,n])=>{const value=inventory[k]??0;if(!Number.isSafeInteger(value)||value<0)throw Error(`Invalid inventory dimension: ${k}`);return[k,Math.max(n,Math.ceil(value*1.25))]}))}

function dimensions({files,depth,members,directMembers,devices,changes}){
 if(![files,depth,members,directMembers,devices,changes].every(Number.isSafeInteger)||files<1||depth<1||depth>=200||members<2||directMembers<0||directMembers>600||devices<0||changes<0)throw Error('Invalid generation dimensions');
}
const directPeople=space=>space.members.filter(member=>member.principal.includes('@'));

export async function generate({api,owner,seed='synthetic-chest-895',files=60,depth=8,members=3,directMembers=0,devices=0,changes=0}){
 dimensions({files,depth,members,directMembers,devices,changes});
 if(typeof seed!=='string'||!seed.trim())throw Error('Invalid generation seed');
 const fixture=createHash('sha256').update(seed).digest().readUInt32BE(0),people=[];
 for(let n=1;n<members+Math.max(0,directMembers-1);n++){
  const email=`synthetic-chest-${fixture}-${n}@example.test`;
  await api('/people',owner,{action:'invite',email,name:`Scale colleague ${n}`});
  people.push(email);
 }
 const sessions=people.slice(0,members-1);
 const group=await api('/groups',owner,{name:`Scale ${seed}`,members:sessions});
 const space=await api('/spaces',owner,{name:`Scale ${seed}`});
 await api(`/spaces/${space.id}/member`,owner,{action:'add',principal:group.id,role:'viewer'});
 const measurementSpace=await api(`/spaces/${space.id}`,owner);
 const ownerGrant=directPeople(measurementSpace).find(member=>member.role==='manager');
 if(!ownerGrant)throw Error('Generated space has no direct manager');
 let membersSpace;
 if(directMembers>0){
  await api(`/spaces/${space.id}/members`,owner,{members:[{principal:ownerGrant.principal,role:'manager'},...people.slice(members-1).map(principal=>({principal,role:'viewer'}))]});
  membersSpace=await api(`/spaces/${space.id}`,owner);
  if(directPeople(membersSpace).length!==directMembers)throw Error('Generated membership does not match admitted roster');
 }
 const folders=[],originals=[],children=new Map();
 let parent=null,bytes=0,maximumDepth=0;
 function admitted(id,parent,itemDepth){
  if(typeof id!=='string'||!id||children.has(id))throw Error('Invalid admitted item');
  children.set(id,0);
  if(parent!==null)children.set(parent,children.get(parent)+1);
  maximumDepth=Math.max(maximumDepth,itemDepth);
 }
 for(let n=0;n<depth;n++){
  const folder=await api('/items',owner,{space:space.id,parent,type:'folder',name:`Level ${n}`});
  admitted(folder.id,parent,n+1);
  parent=folder.id;
  folders.push(folder.id);
  if(n===0&&directMembers>0)await api(`/items/${folder.id}/shares`,owner,{principal:group.id,role:'viewer'});
 }
 for(let n=0;n<files;n++){
  const body=Buffer.from(`${seed} invoice ${n} quarter ${n%50} verified original`),folder=n===0?parent:folders[0];
  const item=await api('/items',owner,{space:space.id,parent:folder,type:'file',name:`Invoice ${n}.txt`,base64:body.toString('base64')});
  admitted(item.id,folder,n===0?folders.length+1:2);
  originals.push({id:item.id,body});
  bytes+=body.length;
 }
 const enrolled=[];
 let firstDevice;
 for(let n=0;n<devices;n++){
  const result=await api('/devices',owner,{name:`Scale ${fixture} device ${n+1}`,platform:'linux'});
  enrolled.push(result.device);
  if(n===0)firstDevice=result;
 }
 const roster=new Set([ownerGrant.principal,...people]);
 const counts={items:children.size,bytes,depth:maximumDepth,members:roster.size,devices:enrolled.length,largestSpace:children.size,largestFolder:Math.max(...folders.map(id=>children.get(id))),directMembers:Math.max(directPeople(measurementSpace).length,membersSpace?directPeople(membersSpace).length:0),changes:0,offlineDays:0};
 async function applyChanges(count=changes){
  if(!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(counts.changes+count))throw Error('Invalid change count');
  const changed=new Map();
  for(let n=0;n<count;n++){
   const sequence=counts.changes,item=originals[sequence%originals.length];
   await api(`/items/${item.id}/rename`,owner,{name:`Updated invoice ${sequence%originals.length} change ${sequence+1}.txt`});
   counts.changes++;
   changed.set(item.id,item);
  }
  return [...changed.values()];
 }
 return {space,group,folders,originals,sessions,counts,devices:enrolled,...(membersSpace?{membersSpace}:{}),...(firstDevice?{firstDevice}:{}),applyChanges};
}
