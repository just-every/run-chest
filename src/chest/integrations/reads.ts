import type { Bindings } from '../../auth.server'
import { insist, type Row } from '../model'
import { decode, list } from '../store'
import { permittedLinks } from '../files/link-policy'
import type { Link, Prefs } from '../files/model'
import type { Extraction } from '../read/jobs'
import { maybe } from '../files/repo'
import { context, demand, everything, who, allowed, type Entry } from '../files/access'
import { ancestors, category, filters, matches, sharedBy } from '../files/search-filters'
import { hiddenMerged } from '../filing/duplicate-view'
import { textHits } from '../read/jobs'
import { action, resource, type Authorized } from './auth'
import type { Item } from '../files/model'
export function pageArgs(url: URL) {const limit=Number(url.searchParams.get('limit')??25);insist(Number.isInteger(limit)&&limit>=1&&limit<=100,'invalid_page_limit');let cursor='';if(url.searchParams.has('cursor'))try{cursor=Buffer.from(url.searchParams.get('cursor')!,'base64url').toString();insist(cursor.length<=240,'invalid_page_cursor')}catch{insist(false,'invalid_page_cursor')};return {limit,cursor}}
const cursorFor=(value:string)=>Buffer.from(value).toString('base64url')
export function brief(row: Row<Item>) {const p=row.payload,v=p.versions.find(v=>v.id===p.current);return {id:row.id,name:p.name,type:p.type,parent:p.parent,current:p.current,updatedAt:p.updatedAt,size:v?.size??null,sha256:v?.checksum??null,mediaType:v?.mediaType??null}}
export async function listItems(env: Bindings,auth: Authorized,url: URL) {
 action(auth,'read');const {limit,cursor}=pageArgs(url),parent=url.searchParams.get('parent'),items=[];let after=cursor,hasMore=false
 if(parent)await resource(env,auth,parent,'read')
 // Keyset iteration skips inaccessible records without exposing their names, counts or positions.
 while(items.length<=limit){const rows=(await env.DB.prepare("SELECT * FROM chest_records WHERE kind='item' AND id>? AND (? IS NULL OR json_extract(payload,'$.parent')=?) ORDER BY id LIMIT 100").bind(after,parent,parent).all()).results.map(decode<Item>);if(!rows.length)break
  for(const row of rows){after=row.id;try{const c=await resource(env,auth,row.id,'read');if(c.state.trash)continue;items.push(brief(row));if(items.length>limit){hasMore=true;break}}catch(error){if((error as any).status!==403&&(error as any).status!==404)throw error}}
  if(hasMore||rows.length<100)break
 }
 const results=items.slice(0,limit);return {items:results,nextCursor:hasMore?cursorFor(results.at(-1)!.id):null}
}
export async function scopedSearch(env: Bindings,auth: Authorized,url: URL) {
 action(auth,'search');const {limit,cursor}=pageArgs(url),f=filters(url.searchParams),q=(url.searchParams.get('q')??'').trim().toLowerCase(),all=await everything(env,await who(env,auth.session)),w=await who(env,auth.session),eligible=new Map<string,Entry>()
 for(const [id,e] of all){if(e.state.trash||!allowed(e,'view')||!ancestors(e,all).some(a=>auth.grant.payload.resources.includes(a.row.id)))continue;eligible.set(id,e)}
 const hidden=await hiddenMerged(env,w,[...eligible.values()]),extracted=await textHits(env,q),formats=new Map((await list<Extraction>(env,'extract')).map(r=>[r.id.slice(8),r.payload.format??''])),prefs=(await maybe<Prefs>(env,'prefs',`prefs:${w.email}`))?.payload,links=await permittedLinks(env,await list<Link>(env,'link'),new Map([...all.values()].map(e=>[e.row.id,e.space.id]))),items=[]
 for(const [id,e] of [...eligible].sort(([a],[b])=>a.localeCompare(b))){if(id<=cursor||hidden.has(id))continue;const authors=[...sharedBy(e,all,w),...links.filter(l=>l.payload.item===e.row.id&&(l.payload.discoverable||w.opened.includes(l.id))).map(l=>l.payload.createdBy)];if(!matches(e,all,w,f,prefs?.starred??[],authors))continue
  const p=e.row.payload,vs=f.versions==='any'?p.versions:p.versions.filter(v=>v.id===p.current),v=vs.find(v=>!q||v.text.toLowerCase().includes(q)||extracted.has(v.checksum)),name=[p.name,...(p.tags??[]),JSON.stringify(p.filing?.fields??{}),p.createdBy,p.filing?.owner??e.space.payload.owner,...ancestors(e,all).filter(a=>a.state.role).map(a=>a.row.payload.name)].join(' ').toLowerCase().includes(q),current=p.versions.find(v=>v.id===p.current),kind=p.type==='folder'?'folders':category(current,formats.get(current?.checksum??''));if(f.type.length&&!f.type.includes(kind)||q&&!name&&!v)continue
  items.push({...brief(e.row),matchedVersion:v?.id??p.current});if(items.length>limit)break
 }
 const more=items.length>limit,results=items.slice(0,limit);return {items:results,nextCursor:more?cursorFor(results.at(-1)!.id):null}
}
export function versions(row: Row<Item>,url: URL) {const {limit,cursor}=pageArgs(url),rows=row.payload.versions.filter(v=>v.id>cursor).sort((a,b)=>a.id.localeCompare(b.id)),items=rows.slice(0,limit).map(({text,...v})=>v);return {items,nextCursor:rows.length>limit?cursorFor(items.at(-1)!.id):null}}

export function paginate<T>(rows:T[],url:URL,key:(row:T)=>string){const {limit,cursor}=pageArgs(url),sorted=rows.filter(r=>key(r)>cursor).sort((a,b)=>key(a).localeCompare(key(b))),items=sorted.slice(0,limit);return {items,nextCursor:sorted.length>limit?cursorFor(key(items.at(-1)!)):null}}
