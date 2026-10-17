import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { insist, now, type Row } from '../model'
import { commit, fresh, next, spaceItems, where } from './repo'
import { chain, context, demand, descend, isAdmin, start, stillSharing, type State, type Who } from './access'
import { hashPassword, randomToken, tokenHash, tokenShape } from './capability'
import type { Item, PublicLink } from './model'
import { dayEnd } from './zone'
// Links for anyone (SHARE-001): a file or folder opens without an account, behind an optional password, until an
// optional expiry and for an optional number of downloads. Every request re-reads the link, the item's path and the
// custodian's current right to share it, so revoking, trashing, restricting or removing the sharer ends the link at
// once. Folder links never reach restricted or trashed descendants.
export const publicPrefix = 'chest_pub_'
const nobody: Who = { email: '', principals: [], groups: [], opened: [] }
export function linkDate(value: unknown, zone?: unknown) {
 if (value === undefined || value === null || value === '') return null
 insist(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'invalid_expiry')
 const at = dayEnd(value, zone); insist(Number.isFinite(Date.parse(at)) && Date.parse(at) > Date.now(), 'invalid_expiry'); return at
}
function limitOf(value: unknown) {
 if (value === undefined || value === null || value === '') return null
 const n = typeof value === 'string' ? Number(value) : value; insist(Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 100_000, 'invalid_download_limit'); return n as number
}
export async function createPublicLink(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key); demand(ctx, 'share'); insist(!ctx.state.noDownload, 'download_restricted', 403)
 const password = input.password === undefined || input.password === '' ? null : await hashPassword(input.password)
 const secret = randomToken(publicPrefix), row = fresh<PublicLink>('public-link', { item: key, tokenHash: await tokenHash(secret), password, expires: linkDate(input.expires, input.zone), limit: limitOf(input.limit), downloads: 0, createdBy: s.operator.email, at: now() })
 await commit(env, s, [{ row }], { fences: ctx.fences, changes: [{ item: key, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.create', object: key, detail: { link: row.id, audience: 'public', password: !!password, expires: row.payload.expires, limit: row.payload.limit } }] })
 return { link: describe(row), url: `${env.AUTH_ORIGIN}/l/${secret}` }
}
// The creator, anyone who may share the item now, or an admin revokes in one step; it only narrows access, so it works
// on a trashed item too.
export async function revokePublicLink(env: Bindings, s: Session, w: Who, id: string) {
 const link = await get<PublicLink>(env, 'public-link', id), ctx = await context(env, w, link.payload.item)
 if (link.payload.createdBy !== s.operator.email && !isAdmin(s)) demand({ ...ctx, state: { ...ctx.state, trash: null } }, 'share')
 if (link.payload.revokedAt) return { link: describe(link) }
 const row = next(link, { ...link.payload, revokedAt: now(), revokedBy: s.operator.email })
 await commit(env, s, [{ row, previous: link }], { changes: [{ item: link.payload.item, space: ctx.space.id, kind: 'access' }], audits: [{ action: 'link.revoke', object: link.payload.item, detail: { link: id, audience: 'public' } }] })
 return { link: describe(row) }
}
export type LinkState = 'active' | 'revoked' | 'expired' | 'limit reached'
export function linkState(l: PublicLink, at = Date.now()): LinkState { return l.revokedAt ? 'revoked' : l.expires && Date.parse(l.expires) <= at ? 'expired' : l.limit !== null && l.downloads >= l.limit ? 'limit reached' : 'active' }
const monthDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
// "Expires Nov 30 · 3 of 10 downloads", the way the item's link list and the Links view show every link.
export function linkSummary(l: PublicLink) {
 const state = linkState(l), parts = [state === 'revoked' ? `Revoked ${monthDay(l.revokedAt!)}` : state === 'expired' ? `Expired ${monthDay(l.expires!)}` : l.expires ? `Expires ${monthDay(l.expires)}` : 'No expiry']
 parts.push(l.limit === null ? `${l.downloads} download${l.downloads === 1 ? '' : 's'}` : `${l.downloads} of ${l.limit} downloads`)
 if (l.password) parts.push('password')
 return parts.join(' · ')
}
export const describe = (row: Row<PublicLink>) => ({ id: row.id, item: row.payload.item, audience: 'public' as const, password: !!row.payload.password, expires: row.payload.expires, limit: row.payload.limit, downloads: row.payload.downloads, createdBy: row.payload.createdBy, at: row.payload.at, revokedAt: row.payload.revokedAt ?? null, state: linkState(row.payload), summary: linkSummary(row.payload) })
export const linksOn = async (env: Bindings, key: string) => (await where<PublicLink>(env, 'public-link', '$.item', key)).map(describe)
// The public door. Resolution answers why a link cannot be used, never which item it was for.
export type Resolved = { link: Row<PublicLink>; root: Row<Item>; state: State; fences: Row[] }
export type Refusal = { refused: 'not_found' | 'revoked' | 'expired' | 'limit' | 'unavailable' }
export async function resolveLink(env: Bindings, secret: string): Promise<Resolved | Refusal> {
 if (!tokenShape(publicPrefix).test(secret)) return { refused: 'not_found' }
 const [link] = await where<PublicLink>(env, 'public-link', '$.tokenHash', await tokenHash(secret)); if (!link) return { refused: 'not_found' }
 const s = linkState(link.payload); if (s !== 'active') return { refused: s === 'revoked' ? 'revoked' : s === 'expired' ? 'expired' : 'limit' }
 const ctx = await stillSharing(env, link.payload.custodian ?? link.payload.createdBy, link.payload.item); if (!ctx) return { refused: 'unavailable' }
 let state = start(ctx.space.payload, nobody); for (const node of ctx.chain) state = descend(state, node, nobody, [])
 if (state.trash) return { refused: 'unavailable' }
 return { link, root: ctx.chain.at(-1)!, state, fences: [link, ...ctx.fences] }
}
// Files a folder link reaches: below the linked folder, never through a restricted or trashed folder, at most 500.
export async function reachable(env: Bindings, r: Resolved) {
 if (r.root.payload.type === 'file') return [{ row: r.root, path: '' }]
 const rows = (await spaceItems(env, r.root.payload.space)).filter(x => !x.payload.trash && !x.payload.restricted), out: { row: Row<Item>; path: string }[] = []
 const walk = (parent: string, path: string) => { for (const x of rows.filter(x => x.payload.parent === parent).sort((a, b) => a.payload.name.localeCompare(b.payload.name))) { if (out.length >= 500) return; if (x.payload.type === 'folder') walk(x.id, `${path}${x.payload.name} / `); else out.push({ row: x, path }) } }
 walk(r.root.id, ''); return out
}
// One file through the link: in the linked tree, with no restricted, trashed or no-download step on the way down.
export async function fileThrough(env: Bindings, r: Resolved, key: string) {
 if (key === r.root.id) return r.root.payload.type === 'file' && !r.state.noDownload ? { row: r.root, fences: r.fences } : null
 const { chain: nodes } = await chain(env, key), at = nodes.findIndex(n => n.id === r.root.id)
 if (at < 0) return null
 const below = nodes.slice(at + 1), row = nodes.at(-1)!
 if (row.payload.type !== 'file' || below.some(n => n.payload.restricted || n.payload.trash || n.payload.noDownload) || r.state.noDownload) return null
 return { row, fences: [...r.fences, ...below] }
}
