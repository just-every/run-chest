// Deterministic originals are admitted through the same public doors as owner uploads.
export const reference={items:2000000,bytes:10000000000000,depth:100,members:150,devices:300,largestSpace:500000,largestFolder:20000,directMembers:600,changes:10000,offlineDays:7};
export function inventoryTarget(inventory={}){return Object.fromEntries(Object.entries(reference).map(([k,n])=>{const value=inventory[k]??0;if(!Number.isSafeInteger(value)||value<0)throw Error(`Invalid inventory dimension: ${k}`);return[k,Math.max(n,Math.ceil(value*1.25))]}))}
export async function generate({api,owner,seed='synthetic-chest-895',files=60,depth=8,members=3,devices=2}){
 if(![files,depth,members,devices].every(Number.isSafeInteger)||files<1||depth<1||members<2||devices<1)throw Error('Invalid generation dimensions');
 const sessions=[];for(let n=1;n<members;n++){const email=`scale-${n}@example.test`;await api('/people',owner,{action:'invite',email,name:`Scale colleague ${n}`});sessions.push(email)}
 const group=await api('/groups',owner,{name:`Scale ${seed}`,members:sessions}),space=await api('/spaces',owner,{name:`Scale ${seed}`});
 await api(`/spaces/${space.id}/member`,owner,{action:'add',principal:group.id,role:'viewer'});
 let parent=null;const folders=[];for(let n=0;n<depth;n++){const folder=await api('/items',owner,{space:space.id,parent,type:'folder',name:`Level ${n}`});parent=folder.id;folders.push(folder.id)}
 const originals=[];let bytes=0;for(let n=0;n<files;n++){const body=Buffer.from(`${seed} invoice ${n} quarter ${n%50} verified original`);bytes+=body.length;const item=await api('/items',owner,{space:space.id,parent:n===0?parent:folders[0],type:'file',name:`Invoice ${n}.txt`,base64:body.toString('base64')});originals.push({id:item.id,body})}
 return {space,group,folders,originals,sessions,counts:{items:files+depth,bytes,depth:depth+1,members,devices,largestSpace:files+depth,largestFolder:Math.max(files-1,1)+(depth>1?1:0),directMembers:members,changes:0,offlineDays:0}};
}
