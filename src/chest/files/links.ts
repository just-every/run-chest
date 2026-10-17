import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { digest } from '../blobs'
import { insist, now } from '../model'
import { commit, fresh, next, where } from './repo'
import { context, demand, type Who } from './access'
import { rank, role, shareRoles, type Item, type Link } from './model'
// Organisation links (part of SHARE-001): any signed-in staff member with the link opens the item at the link's role.
// Opening records the item in their recent items and creates no grant, so changing or removing the link changes their
// access on the next request. A non-discoverable link works only for people who opened it. Only the token's hash is
// stored; the token itself is shown once to its creator and never logged or exported.
const token = () => 'chest_link_' + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export async function createLink(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key); demand(ctx, 'share')
 const r = role(input.role ?? 'viewer', shareRoles); insist(rank[r] <= rank[ctx.state.role!], 'role_above_own', 403); insist(input.discoverable === undefined || typeof input.discoverable === 'boolean', 'invalid_discoverable')
 const secret = token(), row = fresh<Link>('link', { item: key, tokenHash: await digest(new TextEncoder().encode(secret)), audience: 'organisation', role: r, discoverable: input.discoverable ?? false, createdBy: s.operator.email, at: now() })
 await commit(env, s, [{ row }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.create', object: key, detail: { link: row.id, role: r, discoverable: row.payload.discoverable } }] })
 return { link: { id: row.id, ...row.payload, tokenHash: undefined }, url: `${env.AUTH_ORIGIN}/s/${secret}` }
}
export async function changeLink(env: Bindings, s: Session, w: Who, id: string, input: any) {
 const link = await get<Link>(env, 'link', id), ctx = await context(env, w, link.payload.item)
 // Removing a link narrows access, so it stays possible while the item is in trash.
 demand(input.remove === true ? { ...ctx, state: { ...ctx.state, trash: null } } : ctx, 'share')
 if (input.remove === true) { await commit(env, s, [{ row: link, previous: link, remove: true }], { fences: ctx.fences, changes: [{ item: link.payload.item, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.remove', object: link.payload.item, detail: { link: id } }] }); return { removed: true } }
 const r = input.role === undefined ? link.payload.role : role(input.role, shareRoles); insist(rank[r] <= rank[ctx.state.role!], 'role_above_own', 403); insist(input.discoverable === undefined || typeof input.discoverable === 'boolean', 'invalid_discoverable')
 const payload = { ...link.payload, role: r, discoverable: input.discoverable ?? link.payload.discoverable }
 await commit(env, s, [{ row: next(link, payload), previous: link }], { fences: ctx.fences, changes: [{ item: link.payload.item, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.change', object: link.payload.item, detail: { link: id, before: { role: link.payload.role, discoverable: link.payload.discoverable }, after: { role: r, discoverable: payload.discoverable } } }] })
 return { link: { id, ...payload, tokenHash: undefined } }
}
export async function openLink(env: Bindings, s: Session, secret: string) {
 insist(/^chest_link_[A-Za-z0-9_-]{43}$/.test(secret), 'link_not_found', 404)
 const [link] = await where<Link>(env, 'link', '$.tokenHash', await digest(new TextEncoder().encode(secret))); insist(link, 'link_not_found', 404)
 const item = await get<Item>(env, 'item', link.payload.item); insist(!item.payload.trash, 'link_not_found', 404)
 await commit(env, s, [], { audits: [{ action: 'link.open', object: link.id, detail: { item: item.id } }] })
 return { item: item.id }
}
