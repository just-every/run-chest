import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { ChestError, insist, type Group, type Row } from '../model'
import { permittedLinks } from './link-policy'
import { rank, live, type Item, type Link, type Role, type Space } from './model'
// Current access, computed on every request from the space, each folder on the path and the person's live groups.
// Inherited roles accumulate down the tree; a restricted folder or file stops inheritance except for space managers.
// Expired grants, removed links and trashed ancestors take effect on the next request through every door.
export type Who = { email: string; principals: string[]; groups: Row<Group>[]; opened: string[] }
export type State = { role: Role | null; manager: boolean; noDownload: boolean; trash: Row<Item> | null }
export type Ctx = { space: Row<Space>; chain: Row<Item>[]; state: State; links: Row<Link>[]; fences: Row[] }
// Organization links a person has opened come from the durable audit, never from a grant.
export const who = (env: Bindings, s: Session) => whoFor(env, s.operator.email)
export async function whoFor(env: Bindings, email: string): Promise<Who> {
 const groups = (await list<Group>(env, 'group')).filter(g => g.payload.members.includes(email))
 const opened = (await env.DB.prepare("SELECT DISTINCT object_id FROM chest_audit WHERE actor=? AND action='link.open'").bind(email).all()).results.map((r: any) => String(r.object_id))
 return { email, principals: [email, ...groups.map(g => g.id)], groups, opened }
}
// The person who made a link or file request must still be active and still allowed to share the item; their access
// is recomputed on every public request, so removing them from a space or deactivating them ends the link too.
export async function stillSharing(env: Bindings, email: string, key: string): Promise<Ctx | null> {
 if (!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(email).first()) return null
 const ctx = await context(env, await whoFor(env, email), key)
 return ctx.state.trash || !allowed(ctx, 'share') ? null : ctx
}
const best = (a: Role | null, b: Role | null) => !b ? a : !a || rank[b] > rank[a] ? b : a
const granted = (grants: { principal: string; role: Role; expires?: string }[], w: Who) => grants.filter(g => w.principals.includes(g.principal) && live(g)).reduce<Role | null>((r, g) => best(r, g.role), null)
export function start(space: Space, w: Who): State {
 if (space.kind === 'personal') return { role: space.owner === w.email ? 'owner' : null, manager: space.owner === w.email, noDownload: false, trash: null }
 const role = granted(space.members, w)
 return { role, manager: role === 'manager', noDownload: space.settings.noDownload, trash: null }
}
export function descend(state: State, node: Row<Item>, w: Who, links: Row<Link>[]): State {
 let role = node.payload.restricted ? (state.manager ? (state.role === 'owner' ? 'owner' : 'manager') : null) : state.role
 role = best(role, granted(node.payload.grants, w))
 for (const l of links) if (l.payload.item === node.id && (l.payload.discoverable || w.opened.includes(l.id))) role = best(role, l.payload.role)
 return { role, manager: state.manager, noDownload: state.noDownload || node.payload.noDownload, trash: state.trash ?? (node.payload.trash ? node : null) }
}
export async function chain(env: Bindings, key: string): Promise<{ space: Row<Space>; chain: Row<Item>[] }> {
 const nodes: Row<Item>[] = []
 for (let at: string | null = key; at; ) { const node: Row<Item> = await get<Item>(env, 'item', at); insist(nodes.length < 200 && !nodes.some(n => n.id === node.id), 'tree_corrupt', 503); nodes.unshift(node); at = node.payload.parent }
 return { space: await get<Space>(env, 'space', nodes[0].payload.space), chain: nodes }
}
export async function context(env: Bindings, w: Who, key: string): Promise<Ctx> {
 const { space, chain: nodes } = await chain(env, key), links = await permittedLinks(env, await list<Link>(env, 'link'), new Map(nodes.map(n => [n.id,n.payload.space])))
 let state = start(space.payload, w)
 for (const node of nodes) state = descend(state, node, w, links)
 return { space, chain: nodes, state, links, fences: [space, ...nodes, ...w.groups, ...links] }
}
export const level = (s: State) => s.role ? rank[s.role] : 0
export type Action = 'view' | 'download' | 'comment' | 'contribute' | 'manage' | 'share' | 'administer'
export function allowed(ctx: { space: Row<Space>; state: State }, action: Action) {
 const r = level(ctx.state)
 if (action === 'view') return r >= 1
 if (action === 'download') return r >= 1 && !(ctx.state.noDownload && r < 3)
 if (action === 'comment') return r >= 2
 if (action === 'contribute') return r >= 3
 if (action === 'manage') return r >= 4
 if (action === 'share') return r >= 4 && (ctx.space.payload.kind === 'personal' || ctx.space.payload.settings.editorSharing || r >= 5)
 return r >= 5
}
// No access reads as "request access" without the item's name; a trashed item is gone from every ordinary door.
export function demand(ctx: Ctx, action: Action) {
 if (ctx.state.trash || !allowed(ctx, 'view')) throw new ChestError(ctx.state.trash ? 'not_found' : 'access_required', ctx.state.trash ? 404 : 403)
 if (!allowed(ctx, action)) throw new ChestError(action === 'download' ? 'download_restricted' : action === 'share' && level(ctx.state) >= 4 ? 'editor_sharing_off' : `${action}_refused`, 403)
}
export const isAdmin = (s: Session) => s.operator.role === 'owner' || s.operator.role === 'admin'
// Every item with the person's current state, computed once per request for search, Shared with me, recent and trash.
export type Entry = { row: Row<Item>; space: Row<Space>; state: State }
export async function everything(env: Bindings, w: Who): Promise<Map<string, Entry>> {
 const spaces = new Map((await list<Space>(env, 'space')).map(r => [r.id, r])), rows = new Map((await list<Item>(env, 'item')).map(r => [r.id, r])), links = await permittedLinks(env, await list<Link>(env, 'link'), new Map([...rows.values()].map(r => [r.id,r.payload.space]))), memo = new Map<string, Entry>()
 const visit = (key: string, depth = 0): Entry | undefined => {
  const known = memo.get(key); if (known) return known
  const row = rows.get(key), space = row && spaces.get(row.payload.space); if (!row || !space || depth > 200) return undefined
  const parent = row.payload.parent ? visit(row.payload.parent, depth + 1) : undefined; if (row.payload.parent && !parent) return undefined
  const entry = { row, space, state: descend(parent ? parent.state : start(space.payload, w), row, w, links) }; memo.set(key, entry); return entry
 }
 for (const key of rows.keys()) visit(key)
 return memo
}
