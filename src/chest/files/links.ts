import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { createPublicLink, linkDate } from './public-links'
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
 insist(!input.password && !input.limit && (!input.versionMode || input.versionMode==='current') && !input.version && input.download!==false,'public_link_controls_only')
 insist(audience!=='restricted' || !input.discoverable,'restricted_links_not_discoverable')
 const r = role(input.role ?? policy.rules.defaultRole, shareRoles); insist(rank[r] <= rank[ctx.state.role!], 'role_above_own', 403); insist(input.discoverable === undefined || typeof input.discoverable === 'boolean', 'invalid_discoverable')
 const secret = randomToken('chest_link_'), row = fresh<Link>('link', { item: key, tokenHash: await tokenHash(secret), audience, expires:linkDate(input.expires,input.zone), role: r, discoverable: input.discoverable ?? false, createdBy: s.operator.email, at: now() })
 await commit(env, s, [{ row }], { fences: [...ctx.fences,...policy.fences,...sharing.fences], changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.create', object: key, detail: { link: row.id, role: r, discoverable: row.payload.discoverable } }] })
 return { link: { id: row.id, ...row.payload, tokenHash: undefined }, url: `${env.AUTH_ORIGIN}/s/${secret}` }
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
 const payload = { ...link.payload, role: r, discoverable: input.discoverable ?? link.payload.discoverable }
 await commit(env, s, [{ row: next(link, payload), previous: link }], { fences: [...ctx.fences,...policy.fences,...sharing.fences], changes: [{ item: link.payload.item, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.change', object: link.payload.item, detail: { link: id, before: { role: link.payload.role, discoverable: link.payload.discoverable }, after: { role: r, discoverable: payload.discoverable } } }] })
 return { link: { id, ...payload, tokenHash: undefined } }
}
export async function openLink(env: Bindings, s: Session, secret: string) {
 insist(tokenShape('chest_link_').test(secret), 'link_not_found', 404)
 const [link] = await where<Link>(env, 'link', '$.tokenHash', await tokenHash(secret)); insist(link, 'link_not_found', 404)
 const item = await get<Item>(env, 'item', link.payload.item); insist(!item.payload.trash, 'link_not_found', 404)
 insist(!link.payload.expires || Date.parse(link.payload.expires)>Date.now(),'link_expired',410)
 const viewer=await who(env,s),policy=await creatorLinkPolicy(env,link.payload.createdBy,item.payload.space);demandLinkPolicy(policy.rules,link.payload.audience,link.payload.discoverable)
 const ctx=await context(env,link.payload.audience==='organisation'?{...viewer,opened:[...viewer.opened,link.id]}:viewer,item.id);demand(ctx,'view')
 await commit(env, s, [], { fences:[...ctx.fences,...policy.fences], audits: [{ action: 'link.open', object: link.id, detail: { item: item.id } }] })
 return { item: item.id }
}

// Permission-bearing organization links are filtered by access.ts. A sharer's management list must also retain
// restricted, expired and policy-blocked links so each can still be revoked without changing anyone's grants.
export async function describeMemberLink(env: Bindings, link: Row<Link>, space: string | undefined) {
 const p=space?await creatorLinkPolicy(env,link.payload.createdBy,space):null, expires=link.payload.expires ?? null
 return {id:link.id,...link.payload,tokenHash:undefined,expires,state:expires && Date.parse(expires)<=Date.now()?'expired':'active',unavailable:!space,policyBlocked:!!p && link.payload.audience==='organisation' && (!p.rules.allowOrganisation || link.payload.discoverable && !p.rules.allowDiscovery)}
}
export async function linksForItem(env: Bindings, item: string, space: string) {
 return Promise.all((await where<Link>(env,'link','$.item',item)).map(link=>describeMemberLink(env,link,space)))
}
