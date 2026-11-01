import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Read the complete retained originals and authority through the same doors as a file reader.
export async function ownershipState(h,cookie,id,originals){
 const detail=await h.api(`/items/${id}`,cookie),{item,revision,role,can,space,path,versions,grants,links}=detail;
 assert.equal(detail.id,id);
 assert.equal(versions.length,originals.length,'every seeded version remains visible');
 assert.deepEqual(versions.map(v=>v.checksum).sort(),originals.map(hash).sort());
 const downloads=[];
 for(const version of versions){
  const response=await h.raw(`/api/chest/items/${id}/bytes/${version.id}?download=true`,cookie);
  assert.equal(response.status,200);
  const bytes=Buffer.from(await response.arrayBuffer()),expected=originals.find(value=>hash(value)===version.checksum);
  assert.deepEqual(bytes,expected,'downloaded original matches the independently seeded bytes');
  assert.equal(bytes.length,version.size);assert.equal(hash(bytes),version.checksum);
  downloads.push({id:version.id,checksum:hash(bytes),size:bytes.length});
 }
 return {id:detail.id,item,revision,role,can,space,path,versions,grants,links,downloads};
}

// Compare the entire event set, so a retry cannot add a second successful transition or a wrong event.
export async function ownershipAudit(h,cookie,item,steps){
 const rows=(await h.api(`/audit?object=${encodeURIComponent(item)}`,cookie)).filter(row=>row.action.startsWith('ownership.'));
 const events=rows.map(row=>{
  const detail=JSON.parse(row.detail);
  assert.equal(detail.outcome,'succeeded');assert.ok(Number.isFinite(Date.parse(row.at)));
  return {action:row.action,actor:row.actor,item:row.object_id,offer:detail.offer,recipient:detail.recipient};
 });
 const sort=rows=>rows.sort((a,b)=>(a.offer+a.action).localeCompare(b.offer+b.action));
 assert.deepEqual(sort(events),sort(steps.map(step=>({...step,item}))));
 return rows.map(row=>row.id).sort();
}
