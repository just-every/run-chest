import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export async function enumerate(sync, data, limit=31) {
 let after='', cursor, pages=0;const items=new Map();
 do {
  const page=await sync(`/tree?limit=${limit}${cursor===undefined?'':`&cursor=${cursor}`}&after=${encodeURIComponent(after)}`);
  if(cursor===undefined)cursor=page.cursor;
  assert.equal(page.cursor,cursor);
  assert.ok(page.items.length<=limit);
  for(const item of page.items){assert.ok(!items.has(item.id),'metadata pages never repeat an item');items.set(item.id,item)}
  if(page.next)assert.ok(page.next>after,'the scan advances across empty authorized pages');
  after=page.next;pages++;
 }while(after);
 assert.deepEqual([...items.keys()].sort(),[...data.folders,...data.originals.map(i=>i.id)].sort(),'enumeration returns the exact admitted set');
 for(const original of data.originals){const item=items.get(original.id);assert.equal(item.version.checksum,createHash('sha256').update(original.body).digest('hex'));assert.equal(item.version.size,original.body.length);assert.equal(item.body,undefined);assert.equal(item.base64,undefined)}
 assert.ok(pages>1,'the journey exercises continuation');
 return {cursor,pages,items:items.size};
}
