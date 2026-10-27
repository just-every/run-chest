import { policy as contentPolicy } from '../content-security/policy'
import { memberProjection } from './member-link-controls'
import { contentReadable } from '../content-security/scan'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { ChestError, insist, type Group, type Row } from '../model'
import { policyItems } from './sharing-policy'
import { creatorLinkPolicy } from './link-policy'
import { permittedLinks } from './link-policy'
import { rank, live, type Item, type Link, type Role, type Space } from './model'
import { itemPaths } from './item-paths'
// Current access, computed on every request from the space, each folder on the path and the person's live groups.
// Inherited roles accumulate down the tree; a restricted folder or file stops inheritance except for space managers.
// Expired grants, removed links and trashed ancestors take effect on the next request through every door.
export type Who = { email: string; principals: string[]; groups: Row<Group>[]; opened: string[]; linkSessions?:Row[]; guest?: {root:string;role:Role;download:boolean;fences:Row[]} }
export type State = { role: Role | null; manager: boolean; noDownload: boolean; trash: Row<Item> | null; memberOnlyRefused?: boolean; externalDownloadOff?: boolean }
export type Ctx = { space: Row<Space>; chain: Row<Item>[]; state: State; links: Row<Link>[]; fences: Row[]; directState?:State; memberLinks?:Row<Link>[] }
// Organization links a person has opened come from the durable audit, never from a grant.
export async function who(env:Bindings,s:Session):Promise<Who>{
 if((s as any).guestWho)return (s as any).guestWho
 const {mfaPolicy}=await import('../security/policy'),hours=Math.min(12,(await mfaPolicy(env)).sessionHours)
 const w=await whoFor(env,s.operator.email),{digest}=await import('../blobs'),fingerprint=await digest(new TextEncoder().encode(s.id)),{where}=await import('./repo')
 return {...w,linkSessions:(await where(env,'member-link-session','$.sessionHash',fingerprint)).filter(r=>r.payload.email===s.operator.email&&Math.min(r.payload.expires,(r.payload.at??0)+hours*3600000)>Date.now())}
}
export async function whoFor(env: Bindings, email: string): Promise<Who> {
 const groups = (await list<Group>(env, 'group')).filter(g => g.payload.members.includes(email))
 const auditActor=await (await (await import('../audit/privacy')).identityRedactor(env))(email)
 const opened = (await env.DB.prepare("SELECT DISTINCT object_id FROM chest_audit WHERE actor IN (?,?) AND action='link.open'").bind(email,auditActor).all()).results.map((r: any) => String(r.object_id))
 return { email, principals: [email, ...groups.map(g => g.id)], groups, opened }
}
// The person who made a link or file request must still be active and still allowed to share the item; their access
// is recomputed on every public request, so removing them from a space or deactivating them ends the link too.
export async function stillSharing(env: Bindings, email: string, key: string): Promise<Ctx | null> {
 if (!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first()) return null
 const ctx = await context(env, await whoFor(env, email), key)
 const policy=await creatorLinkPolicy(env,email,ctx.space.id)
 return ctx.state.trash || !allowed(ctx, 'share') || !policy.rules.allowEditors&&!ctx.state.manager ? null : {...ctx,fences:[...ctx.fences,...policy.fences]}
}
const best = (a: Role | null, b: Role | null) => !b ? a : !a || rank[b] > rank[a] ? b : a
const granted = (grants: { principal: string; role: Role; expires?: string }[], w: Who) => grants.filter(g => w.principals.includes(g.principal) && live(g)).reduce<Role | null>((r, g) => best(r, g.role), null)
export function start(space: Space, w: Who): State {
 if (space.kind === 'personal') return { role: space.owner === w.email ? 'owner' : null, manager: space.owner === w.email, noDownload: false, trash: null }
 const role = granted(space.members, w)
 return { role, manager: role === 'manager', noDownload: space.settings.noDownload, trash: null, memberOnlyRefused: space.settings.nonMemberAccess===false && !role }
}
export function descend(state: State, node: Row<Item>, w: Who, links: Row<Link>[]): State {
 if(state.memberOnlyRefused)return {...state,role:null,trash:state.trash ?? (node.payload.trash?node:null),noDownload:state.noDownload || node.payload.noDownload}
 let role = node.payload.restricted ? (state.manager ? (state.role === 'owner' ? 'owner' : 'manager') : null) : state.role
 role = best(role, granted(node.payload.grants, w))
 for (const l of links) if (l.payload.item === node.id && (l.payload.discoverable || w.opened.includes(l.id))) role = best(role, l.payload.role)
 return { role, manager: state.manager, memberOnlyRefused:state.memberOnlyRefused, noDownload: state.noDownload || node.payload.noDownload, trash: state.trash ?? (node.payload.trash ? node : null) }
}
export async function chain(env: Bindings, key: string): Promise<{ space: Row<Space>; chain: Row<Item>[] }> {
 const nodes: Row<Item>[] = []
 for (let at: string | null = key; at; ) { const node: Row<Item> = await get<Item>(env, 'item', at); insist(nodes.length < 200 && !nodes.some(n => n.id === node.id), 'tree_corrupt', 503); nodes.unshift(node); at = node.payload.parent }
 return { space: await get<Space>(env, 'space', nodes[0].payload.space), chain: nodes }
}
export async function context(env: Bindings, w: Who, key: string, checkSecurity=true): Promise<Ctx> {
 if(w.guest){
  const {space,chain:nodes}=await chain(env,key),root=nodes.findIndex(n=>n.id===w.guest!.root),nobody:Who={email:'',principals:[],groups:[],opened:[]}
  let state=start(space.payload,nobody);state={...state,role:null,manager:false,externalDownloadOff:!w.guest.download}
  for(const [i,node] of nodes.entries()){
   if(i===root)state={...state,role:w.guest.role,trash:state.trash??(node.payload.trash?node:null),noDownload:state.noDownload||node.payload.noDownload}
   else if(i>root&&root>=0)state={...descend(state,node,nobody,[]),externalDownloadOff:!w.guest.download}
   else state={...state,trash:state.trash??(node.payload.trash?node:null)}
  }
  if(root<0||checkSecurity&&!await contentReadable(env,nodes.at(-1)!.payload.versions,w.email,true))state={...state,role:null}
  return {space,chain:nodes,state,links:[],fences:[space,...nodes,...w.guest.fences]}
 }
 const { space, chain: nodes } = await chain(env, key), links = await permittedLinks(env, await list<Link>(env, 'link'), new Map(nodes.map(n => [n.id,n.payload.space])),w)
 const filtered=await policyItems(env,w,[space],nodes)
 let state = start(space.payload, w),directState=start(space.payload,w)
 for (const node of filtered.items){state=descend(state,node,w,links);directState=descend(directState,node,w,[])}
 if(checkSecurity&&!await contentReadable(env,nodes.at(-1)!.payload.versions,w.email))state={...state,role:null}
 const projected=memberProjection(space,nodes,links,w,directState,state)
 return { space, chain: [...nodes.slice(0,-1),projected.row], state:projected.state, directState,memberLinks:projected.memberLinks,links,fences:[space,...nodes,...w.groups,...links,...filtered.fences,...w.linkSessions??[]] }
}
export const level = (s: State) => s.role ? rank[s.role] : 0
export type Action = 'view' | 'download' | 'comment' | 'contribute' | 'manage' | 'share' | 'administer'
export function allowed(ctx: { space: Row<Space>; state: State; chain?: Row<Item>[] }, action: Action) {
 const r = level(ctx.state)
 if (action === 'view') return r >= 1
 if (action === 'download') return r >= 1 && !ctx.state.externalDownloadOff && !(ctx.state.noDownload && r < 3)
 if (action === 'comment') return r >= 2
 if (action === 'contribute') return r >= 3
 if (action === 'manage') return r >= 4
 if (action === 'share') return !(ctx.chain?.at(-1)?.payload.type==='folder' && ctx.space.payload.settings.contentManagerFolderSharing===false && r<5) && r >= 4 && (ctx.space.payload.kind === 'personal' || ctx.space.payload.settings.editorSharing || r >= 5)
 return r >= 5
}
// No access reads as "request access" without the item's name; a trashed item is gone from every ordinary door.
export function demand(ctx: Ctx, action: Action) {
 if (ctx.state.trash || !allowed(ctx, 'view')) throw new ChestError(ctx.state.trash ? 'not_found' : 'access_required', ctx.state.trash ? 404 : 403)
 if(action==='share' && ctx.chain.at(-1)?.payload.type==='folder' && ctx.space.payload.settings.contentManagerFolderSharing===false && level(ctx.state)>=4 && level(ctx.state)<5)throw new ChestError('space_folder_sharing_managers_only',403)
 if (!allowed(ctx, action)) throw new ChestError(action === 'download' ? 'download_restricted' : action === 'share' && level(ctx.state) >= 4 ? 'editor_sharing_off' : `${action}_refused`, 403)
}
export const isAdmin = (s: Session) => s.operator.role === 'owner' || s.operator.role === 'admin'
// Every item with the person's current state, computed once per request for search, Shared with me, recent and trash.
export type Entry = { row: Row<Item>; space: Row<Space>; state: State; directState?:State }
export async function everything(env: Bindings, w: Who, keys?: string[]): Promise<Map<string, Entry>> {
 const spaces = new Map((await list<Space>(env, 'space')).map(r => [r.id, r])), original=keys ? await itemPaths(env,keys) : await list<Item>(env,'item'),filtered=await policyItems(env,w,[...spaces.values()],original), rows = new Map(filtered.items.map(r => [r.id, r])), links = await permittedLinks(env, await list<Link>(env, 'link'), new Map([...rows.values()].map(r => [r.id,r.payload.space])),w), memo = new Map<string, Entry>()
 const visit = (key: string, depth = 0): Entry | undefined => {
  const known = memo.get(key); if (known) return known
  const row = rows.get(key), space = row && spaces.get(row.payload.space); if (!row || !space || depth > 200) return undefined
  const parent = row.payload.parent ? visit(row.payload.parent, depth + 1) : undefined; if (row.payload.parent && !parent) return undefined
  const entry = { row, space, state: descend(parent ? parent.state : start(space.payload, w), row, w, links),directState:descend(parent?.directState??start(space.payload,w),row,w,[]) }; memo.set(key, entry); return entry
 }
 for (const key of rows.keys()) visit(key)
 for(const entry of memo.values()){const nodes:Row<Item>[]=[];for(let row:Row<Item>|undefined=entry.row;row;row=row.payload.parent?rows.get(row.payload.parent):undefined)nodes.unshift(row);const p=memberProjection(entry.space,nodes,links,w,entry.directState??entry.state,entry.state);entry.row=p.row;entry.state=p.state}
 const security=await contentPolicy(env)
 for(const entry of memo.values())if(!await contentReadable(env,entry.row.payload.versions,w.email,false,security))entry.state={...entry.state,role:null}
 return memo
}
