import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Row } from '../model'
import type { Item, Link, Space } from './model'
import type { State, Who } from './access'
import { linkedVersion } from './link-versions'
import { insist } from '../model'
import { commit, next } from './repo'
// Ordinary ACLs remain independent. A link never removes rights a colleague already held by name or group.
export function memberProjection(space:Row<Space>,nodes:Row<Item>[],links:Row<Link>[],w:Who,direct:State,state:State){
 const target=nodes.at(-1)!,path=new Set(nodes.map(n=>n.id)),applicable=links.filter(l=>path.has(l.payload.item)&&(l.payload.discoverable||w.opened.includes(l.id)))
 if(direct.role||!state.role||!applicable.length)return {row:target,state,memberLinks:[] as Row<Link>[]}
 const valid=applicable.filter(l=>!l.payload.snapshot||(target.payload.type==='file'?l.payload.snapshot.some(f=>f.item===target.id):l.payload.item===target.id||l.payload.folders?.some(f=>f.id===target.id)))
 if(!valid.length)return {row:target,state:{...state,role:null},memberLinks:[] as Row<Link>[]}
 if(target.payload.type==='folder')return {row:{...target,payload:{...target.payload,name:valid.flatMap(l=>l.payload.folders??[]).find(f=>f.id===target.id)?.name??target.payload.name}},state,memberLinks:valid}
 const permitted=new Set<string>()
 for(const l of valid){
  // Existing links with no version control and current-version editors keep ROLE-001's retained-version rights.
  if(!l.payload.versionMode||l.payload.role==='editor')for(const v of target.payload.versions)permitted.add(v.id)
  else{const pinned=l.payload.snapshot?.find(f=>f.item===target.id),v=linkedVersion(target.payload,pinned?{versionMode:'pinned',version:pinned.version}:l.payload);if(v)permitted.add(v.id)}
 }
 const versions=target.payload.versions.filter(v=>permitted.has(v.id)),current=versions.find(v=>v.id===target.payload.current)?.id??versions.at(-1)?.id??null
 const selected=valid.find(l=>l.payload.snapshot?.some(f=>f.item===target.id)),name=selected?.payload.snapshot?.find(f=>f.item===target.id)?.name??target.payload.name
 return {row:{...target,payload:{...target.payload,name,versions,current}},state:!versions.length?{...state,role:null}:valid.every(l=>l.payload.download===false)?{...state,noDownload:true}:state,memberLinks:valid}
}
export async function consumeMemberLink(env:Bindings,s:Session,item:string,version:string){
 if((s as any).guestWho)return
 const {context,who}=await import('./access'),ctx=await context(env,await who(env,s),item)
 if(ctx.directState?.role)return
 const links=(ctx.memberLinks??[]).filter(l=>!l.payload.snapshot||l.payload.snapshot.some(f=>f.item===item&&f.version===version)).sort((a,b)=>a.payload.at.localeCompare(b.payload.at)||a.id.localeCompare(b.id))
 if(!links.length)return
 const link=links[0],limit=link.payload.limit??null,downloads=link.payload.downloads??0
 insist(limit===null||downloads<limit,'link_download_limit_reached',410)
 await commit(env,s,[{row:next(link,{...link.payload,downloads:downloads+1}),previous:link}],{fences:ctx.fences,audits:[{action:'link.organization.download',object:item,detail:{link:link.id,version,downloads:downloads+1,limit}}]})
}
