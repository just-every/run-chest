import { normalizeLinkVersion } from './link-versions'
import { folderSnapshot } from './link-snapshots'
import { hashPassword, passwordMatches } from './capability'
import { digest } from '../blobs'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { createPublicLink, linkDate, limitOf } from './public-links'
import { effectiveLinkPolicy, creatorLinkPolicy, demandLinkPolicy } from './link-policy'
import { sharePolicy } from './sharing-policy'
import { who } from './access'
import { get } from '../store'
import { insist, now, type Row } from '../model'
import { commit, fresh, maybe, next, where } from './repo'
import { context, demand, isAdmin, type Who } from './access'
import { rank, role, shareRoles, type Item, type Link } from './model'
import { randomToken, tokenHash, tokenShape } from './capability'
// Organization links (part of SHARE-001): any signed-in staff member with the link opens the item at the link's role.
// Opening records the item in their recent items and creates no grant, so changing or removing the link changes their
// access on the next request. A non-discoverable link works only for people who opened it. Only the token's hash is
// stored; the token itself is shown once to its creator and never logged or exported.
export async function createLink(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key); demand(ctx, 'share')
 const policy=await effectiveLinkPolicy(env,w,ctx.space.id), audience=input.audience ?? policy.rules.defaultAudience
 if(!['public','guests','domain'].includes(audience))demandLinkPolicy(policy.rules,audience,input.discoverable === true)
 const sharing=await sharePolicy(env,w,ctx,[],input,audience)
 if(['public','guests','domain'].includes(audience))return createPublicLink(env,s,w,key,input)
 if(audience==='restricted')insist(!input.password&&!input.limit&&(!input.versionMode||input.versionMode==='current')&&!input.version&&input.download!==false,'restricted_link_grants_no_controls')
 insist(audience!=='restricted' || !input.discoverable,'restricted_links_not_discoverable')
 const r = role(input.role ?? policy.rules.defaultRole, shareRoles); insist(rank[r] <= rank[ctx.state.role!], 'role_above_own', 403); insist(input.discoverable === undefined || typeof input.discoverable === 'boolean', 'invalid_discoverable')
 const choice=audience==='organisation'?normalizeLinkVersion(ctx.chain.at(-1)!.payload,input):{},password=input.password?await hashPassword(input.password):null,limit=limitOf(input.limit)
 insist(!('versionMode' in choice)||choice.versionMode==='current'||r==='viewer'||r==='commenter','editor_requires_current_versions')
 insist(input.download!==false||r!=='editor','editor_requires_original_downloads')
 const snapshot=audience==='organisation'&&ctx.chain.at(-1)!.payload.type==='folder'&&'versionMode' in choice&&choice.versionMode==='pinned'?await folderSnapshot(env,ctx.chain.at(-1)!):null
 const secret = randomToken('chest_link_'), row = fresh<Link>('link', { item: key, tokenHash: await tokenHash(secret), audience,...choice,password,limit,downloads:0,download:input.download!==false,...(snapshot?{snapshot:snapshot.files,folders:snapshot.fences.filter(r=>r.payload.type==='folder').map(r=>({id:r.id,name:r.payload.name}))}:{}), expires:linkDate(input.expires,input.zone), role: r, discoverable: input.discoverable ?? false, createdBy: s.operator.email, at: now() })
 await commit(env, s, [{ row }], { fences: [...ctx.fences,...policy.fences,...sharing.fences,...snapshot?.fences??[]], changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.create', object: key, detail: { link: row.id, role: r, discoverable: row.payload.discoverable,password:!!password,limit,versionMode:'versionMode' in choice?choice.versionMode:'current' } }] })
 return { link: { id: row.id, ...row.payload,password:!!row.payload.password, tokenHash: undefined }, url: `${env.AUTH_ORIGIN}/s/${secret}` }
}
export async function changeLink(env: Bindings, s: Session, w: Who, id: string, input: any) {
 const link = await get<Link>(env, 'link', id)
 if(input.remove===true && (link.payload.createdBy===s.operator.email || isAdmin(s))){
  const item=await maybe<Item>(env,'item',link.payload.item)
  await commit(env,s,[{row:link,previous:link,remove:true}],{changes:item?[{item:item.id,space:item.payload.space,kind:'access'}]:[],audits:[{action:'link.remove',object:link.payload.item,detail:{link:id}}]});return {removed:true}
 }
 const ctx=await context(env,w,link.payload.item)
 // Removing a link narrows access, so it stays possible while the item is in trash.
 demand(input.remove === true ? { ...ctx, state: { ...ctx.state, trash: null } } : ctx, 'share')
 if (input.remove === true) { await commit(env, s, [{ row: link, previous: link, remove: true }], { fences: ctx.fences, changes: [{ item: link.payload.item, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.remove', object: link.payload.item, detail: { link: id } }] }); return { removed: true } }
 const sharing=await sharePolicy(env,w,ctx,[],input,link.payload.audience),policy=await effectiveLinkPolicy(env,w,ctx.space.id);demandLinkPolicy(policy.rules,link.payload.audience,input.discoverable ?? link.payload.discoverable)
 const r = input.role === undefined ? link.payload.role : role(input.role, shareRoles); insist(rank[r] <= rank[ctx.state.role!], 'role_above_own', 403); insist(input.discoverable === undefined || typeof input.discoverable === 'boolean', 'invalid_discoverable')
 insist(!link.payload.versionMode||link.payload.versionMode==='current'||r!=='editor','editor_requires_current_versions')
 insist(link.payload.download!==false||r!=='editor','editor_requires_original_downloads')
 const payload = { ...link.payload, role: r, discoverable: input.discoverable ?? link.payload.discoverable }
 await commit(env, s, [{ row: next(link, payload), previous: link }], { fences: [...ctx.fences,...policy.fences,...sharing.fences], changes: [{ item: link.payload.item, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.change', object: link.payload.item, detail: { link: id, before: { role: link.payload.role, discoverable: link.payload.discoverable }, after: { role: r, discoverable: payload.discoverable } } }] })
 return { link: { id, ...payload,password:!!payload.password, tokenHash: undefined } }
}
export async function openLink(env: Bindings, s: Session, secret: string,input:any={}) {
 insist(tokenShape('chest_link_').test(secret), 'link_not_found', 404)
 const [link] = await where<Link>(env, 'link', '$.tokenHash', await tokenHash(secret)); insist(link, 'link_not_found', 404)
 const item = await get<Item>(env, 'item', link.payload.item); insist(!item.payload.trash, 'link_not_found', 404)
 insist(!link.payload.expires || Date.parse(link.payload.expires)>Date.now(),'link_expired',410)
 insist(link.payload.limit==null||(link.payload.downloads??0)<link.payload.limit,'link_download_limit_reached',410)
 let viewer=await who(env,s)
 if(link.payload.password&&!viewer.linkSessions?.some(r=>r.payload.link===link.id&&r.payload.passwordHash===link.payload.password?.hash)){
  const recent=await env.DB.prepare("SELECT COUNT(*) n FROM chest_audit WHERE action='link.password.refused' AND object_id=? AND actor=? AND at>?").bind(link.id,s.operator.email,new Date(Date.now()-15*60000).toISOString()).first<{n:number}>()
  insist((recent?.n??0)<10,'link_password_throttled',429)
  if(!await passwordMatches(link.payload.password,input.password)){if(input.password!==undefined)await commit(env,s,[],{audits:[{action:'link.password.refused',object:link.id}]});insist(false,'link_password_required',401)}
  const session=fresh('member-link-session',{link:link.id,email:s.operator.email,sessionHash:await digest(new TextEncoder().encode(s.id)),passwordHash:link.payload.password.hash,expires:Math.min(Date.now()+12*3600000,link.payload.expires?Date.parse(link.payload.expires):Infinity)})
  await commit(env,s,[{row:session}],{fences:[link],audits:[{action:'link.password.verified',object:link.id}]});viewer=await who(env,s)
 }
 const policy=await creatorLinkPolicy(env,link.payload.createdBy,item.payload.space);demandLinkPolicy(policy.rules,link.payload.audience,link.payload.discoverable)
 const ctx=await context(env,link.payload.audience==='organisation'?{...viewer,opened:[...viewer.opened,link.id]}:viewer,item.id);demand(ctx,'view')
 await commit(env, s, [], { fences:[...ctx.fences,...policy.fences], audits: [{ action: 'link.open', object: link.id, detail: { item: item.id } }] })
 return { item: item.id }
}

// Permission-bearing organization links are filtered by access.ts. A sharer's management list must also retain
// restricted, expired and policy-blocked links so each can still be revoked without changing anyone's grants.
export async function describeMemberLink(env: Bindings, link: Row<Link>, space: string | undefined) {
 const p=space?await creatorLinkPolicy(env,link.payload.createdBy,space):null, expires=link.payload.expires ?? null
 return {id:link.id,...link.payload,password:!!link.payload.password,tokenHash:undefined,expires,summary:memberLinkSummary(link.payload),state:expires && Date.parse(expires)<=Date.now()?'expired':link.payload.limit!=null&&(link.payload.downloads??0)>=link.payload.limit?'limit reached':'active',unavailable:!space,policyBlocked:!!p && link.payload.audience==='organisation' && (!p.rules.allowOrganisation || link.payload.discoverable && !p.rules.allowDiscovery)}
}
export async function linksForItem(env: Bindings, item: string, space: string) {
 return Promise.all((await where<Link>(env,'link','$.item',item)).map(link=>describeMemberLink(env,link,space)))
}

export function memberLinkSummary(link:Link){
 const date=link.expires?`Expires ${new Date(link.expires).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}`:'No expiry'
 return `${date} · ${link.downloads??0}${link.limit!=null?' of '+link.limit:''} downloads${link.password?' · password':''}${link.versionMode?' · '+link.versionMode+' versions':''}${link.download===false?' · preview only':''}`
}
