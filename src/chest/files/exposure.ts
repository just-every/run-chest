import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { insist, now, type Row } from '../model'
import { commit, next, where, type Op } from './repo'
import { allowed, context, demand, everything, isAdmin, type Entry, type Who } from './access'
import { describe, describePolicy, linkState } from './public-links'
import { describeRequest } from './file-requests'
import { describeMemberLink } from './links'
import { day, type FileRequest, type Link, type PublicLink } from './model'
// The Links view: every link and file request the person made or may manage, and "Shared too widely": links that
// are public, long-lived or past their limit, each with Make private. Admins see every link in the installation.
const longLived = 90 * day
export function reasons(l: { audience: 'public' | 'organisation' | 'restricted'; at: string; expires: string | null; state: string; discoverable?: boolean; policyBlocked?: boolean }, at = Date.now()) {
 if(l.audience==='restricted')return []
 if(l.policyBlocked)return ['Blocked by link policy until the policy permits it again']
 if (l.audience === 'organisation') return [...(l.discoverable ? ['Every colleague can find it in search'] : []), ...(at - Date.parse(l.at) > longLived ? ['Open to the whole organization for more than 90 days'] : [])]
 if (l.state === 'expired') return ['Past its expiry but not revoked']
 if (l.state === 'limit reached') return ['Download limit used up but not revoked']
 return ['Anyone with the link can open it without signing in', ...(!l.expires ? ['Never expires'] : Date.parse(l.expires) - at > longLived ? ['Stays open for more than 90 more days'] : [])]
}
export const pathOf = (all: Map<string, Entry>, key: string): string => { const e = all.get(key); return e ? (e.row.payload.parent ? `${pathOf(all, e.row.payload.parent)} / ` : `${e.space.payload.kind === 'personal' ? `Personal · ${e.space.payload.owner}` : e.space.payload.name} / `) + e.row.payload.name : '' }
export async function linksView(env: Bindings, s: Session, w: Who) {
 const all = await everything(env, w), admin = isAdmin(s), mine = (by: string) => by === s.operator.email
 const manages = (key: string) => { const e = all.get(key); return admin || (!!e && !e.state.trash && allowed(e, 'share')) }
 const named = (key: string) => { const e = all.get(key); return { item: key, name: e ? e.row.payload.name : 'Item', path: e ? pathOf(all, key) : '', type: e?.row.payload.type ?? 'file' } }
 const pub = await Promise.all((await list<PublicLink>(env, 'public-link')).filter(l => mine(l.payload.createdBy) || manages(l.payload.item)).map(async l => ({ ...await describePolicy(env,l,all.get(l.payload.item)?.row.payload.space), ...named(l.payload.item), manage: manages(l.payload.item) })))
 const org = await Promise.all((await list<Link>(env, 'link')).filter(l => mine(l.payload.createdBy) || manages(l.payload.item)).map(async l => ({...await describeMemberLink(env,l,all.get(l.payload.item)?.row.payload.space),...named(l.payload.item),manage:manages(l.payload.item)})))

 const requests = (await list<FileRequest>(env, 'file-request')).filter(r => mine(r.payload.createdBy) || manages(r.payload.folder)).map(r => ({ ...describeRequest(r), ...named(r.payload.folder) }))
 const flagged = new Map<string, { item: string; name: string; path: string; type: string; manage: boolean; links: { id: string; audience: string; summary: string; reasons: string[]; link?: ReturnType<typeof describe> }[] }>()
 for (const l of [...pub.filter(l => l.state !== 'revoked'), ...org]) {
  const why = reasons(l); if (!why.length) continue
  const entry = flagged.get(l.item) ?? { item: l.item, name: l.name, path: l.path, type: l.type, manage: l.manage, links: [] }
  entry.links.push({ id: l.id, audience: l.audience, summary: 'summary' in l ? l.summary : `${l.role} · ${l.discoverable ? 'discoverable' : 'not discoverable'}`, reasons: why, ...('summary' in l ? { link: l } : {}) }); flagged.set(l.item, entry)
 }
 return { wide: [...flagged.values()], public: pub.sort((a, b) => b.at.localeCompare(a.at)), organisation: org.sort((a, b) => b.at.localeCompare(a.at)), requests: requests.sort((a, b) => b.at.localeCompare(a.at)) }
}
// Make private: one step that revokes every link for anyone and removes every organization link on the item, keeping
// the named people and groups it is shared with. It only narrows access, so admins and sharers may use it on trash.
export async function makePrivate(env: Bindings, s: Session, w: Who, key: string) {
 const ctx = await context(env, w, key); if (!isAdmin(s)) demand({ ...ctx, state: { ...ctx.state, trash: null } }, 'share')
 const at = now(), pub = (await where<PublicLink>(env, 'public-link', '$.item', key)).filter(l => !l.payload.revokedAt), org = await where<Link>(env, 'link', '$.item', key)
 insist(pub.length + org.length > 0, 'nothing_to_make_private', 409)
 const ops: Op[] = [...pub.map(l => ({ row: next(l, { ...l.payload, revokedAt: at, revokedBy: s.operator.email }) as Row, previous: l as Row })), ...org.map(l => ({ row: l as Row, previous: l as Row, remove: true }))]
 await commit(env, s, ops, { changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'item.make-private', object: key, detail: { revoked: pub.map(l => l.id), removed: org.map(l => l.id), active: pub.filter(l => linkState(l.payload) === 'active').length } }] })
 return { revoked: pub.length, removed: org.length, grantsKept: ctx.chain.at(-1)!.payload.grants.length }
}
