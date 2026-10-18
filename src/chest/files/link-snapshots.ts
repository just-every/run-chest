import type { Bindings } from '../../auth.server'
import { insist, type Row } from '../model'
import type { Item, PublicLink } from './model'
import { linkedVersion } from './link-versions'
import { spaceItems } from './repo'
export type SnapshotFile = { item: string; version: string; name: string; path: string }
// Snapshot membership, names and exact versions once. Live authorization still wins on every read:
// a later restriction, move outside the root, trash or revoke never becomes an archived access grant.
export async function folderSnapshot(env: Bindings, root: Row<Item>) {
 const rows=await spaceItems(env,root.payload.space), children=new Map<string,Row<Item>[]>()
 for(const row of rows){const parent=row.payload.parent;if(parent){const group=children.get(parent)??[];group.push(row);children.set(parent,group)}}
 const files:SnapshotFile[]=[],fences:Row<Item>[]=[],seen=new Set<string>()
 function walk(parent:string,path:string,depth:number){
  insist(depth<=100,'folder_snapshot_too_deep',413)
  for(const row of (children.get(parent)??[]).sort((a,b)=>a.payload.name.localeCompare(b.payload.name))){
   if(row.payload.trash || row.payload.restricted)continue
   insist(!seen.has(row.id),'tree_corrupt',503);seen.add(row.id)
   insist(seen.size<=500,'folder_snapshot_too_large',413);fences.push(row)
   if(row.payload.type==='folder')walk(row.id,path+row.payload.name+' / ',depth+1)
   else {const version=linkedVersion(row.payload,{});if(version)files.push({item:row.id,version:version.id,name:row.payload.name,path})}
  }
 }
 walk(root.id,'',0)
 return {files,fences}
}
export function publicVersion(row:Row<Item>,link:PublicLink){
 if(link.snapshot){const file=link.snapshot.find(f=>f.item===row.id);return file?linkedVersion(row.payload,{versionMode:'pinned',version:file.version}):null}
 return linkedVersion(row.payload,link)
}
