import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, recordAccess } from '../store'
import { insist } from '../model'
import { maybe } from './repo'
import { allowed, context, demand, descend, everything, start, type Ctx, type Entry, type Who } from './access'
import { children } from './items'
import { pending } from './shares'
import { comments } from './comments'
import { rewinds } from './rewind'
import { unfinished } from './uploads'
import { linksOn } from './public-links'
import { requestsOn } from './file-requests'
import { personal, visibleSpaces } from './spaces'
import type { Link, Prefs, Space } from './model'
// Read models for the files pages and API: what a person may see, with the actions their current role allows.
const can = (ctx: { space: any; state: any }) => Object.fromEntries((['download', 'comment', 'contribute', 'manage', 'share', 'administer'] as const).map(a => [a, allowed(ctx, a)]))
const label = (space: Space, w: Who) => space.kind === 'personal' ? (space.owner !== w.email ? 'Shared with me' : space.formerOwner ? space.name : 'My files') : space.name
const brief = (e: { row: any; state: any }) => { const v = e.row.payload.versions.find((v: any) => v.id === e.row.payload.current); return { id: e.row.id, name: e.row.payload.name, type: e.row.payload.type, role: e.state.role, updatedAt: e.row.payload.updatedAt, size: v?.size ?? null, mediaType: v?.mediaType ?? null } }
async function prefsOf(env: Bindings, w: Who) { return (await maybe<Prefs>(env, 'prefs', `prefs:${w.email}`))?.payload ?? { starred: [], shortcuts: [] } }
export async function recent(env: Bindings, w: Who, all: Map<string, Entry>) {
 const rows = (await env.DB.prepare("SELECT action, object_id, detail FROM chest_audit WHERE actor=? AND action IN ('item.read','link.open') ORDER BY at DESC LIMIT 300").bind(w.email).all()).results as any[], seen = new Set<string>(), result: any[] = []
 for (const r of rows) { const key = r.action === 'link.open' ? JSON.parse(r.detail).item : r.object_id, e = all.get(key); if (!e || seen.has(key) || !e.state.role || e.state.trash) continue; seen.add(key); result.push(brief(e)); if (result.length === 20) break }
 return result
}
export async function home(env: Bindings, s: Session, w: Who) {
 const mine = await personal(env, s), all = await everything(env, w), prefs = await prefsOf(env, w), pick = (ids: string[]) => ids.map(id => all.get(id)).filter((e): e is Entry => !!e && !!e.state.role && !e.state.trash).map(brief)
 const spaces = (await visibleSpaces(env, w)).filter(r => r.id !== mine.id).map(r => ({ id: r.id, name: r.payload.name, kind: r.payload.kind, role: start(r.payload, w).role }))
 return { me: { email: s.operator.email, name: s.operator.displayName, role: s.operator.role }, personal: mine.id, spaces, recent: await recent(env, w, all), starred: pick(prefs.starred), shortcuts: pick(prefs.shortcuts), requests: (await pending(env, w)).length }
}
export async function spaceView(env: Bindings, w: Who, key: string) {
 const space = await get<Space>(env, 'space', key), state = start(space.payload, w); insist(state.role, 'not_found', 404)
 const ctx: Ctx = { space, chain: [], state, links: [], fences: [] }
 const manager = state.role === 'manager' || state.role === 'owner'
 return { id: space.id, name: label(space.payload, w), kind: space.payload.kind, role: state.role, can: can(ctx), settings: space.payload.settings, members: space.payload.kind === 'team' ? space.payload.members : [], children: (await children(env, w, ctx, null)).map(brief), uploads: await unfinished(env, w, { space: space.id, parent: null }), rewinds: manager ? await rewinds(env, `space:${space.id}`) : [] }
}
export async function itemView(env: Bindings, s: Session, w: Who, key: string) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'view')
 const path: { id: string; name: string }[] = []; let state = start(ctx.space.payload, w)
 for (const node of ctx.chain.slice(0, -1)) { state = descend(state, node, w, ctx.links); if (state.role) path.push({ id: node.id, name: node.payload.name }) }
 const sharer = allowed(ctx, 'share'), prefs = await prefsOf(env, w)
 await recordAccess(env, s, item, 'item.read')
 return {
  id: key, item: { ...item.payload, versions: undefined, grants: undefined, trash: undefined }, revision: item.revision, role: ctx.state.role, can: can(ctx), space: { id: ctx.space.id, name: label(ctx.space.payload, w), kind: ctx.space.payload.kind, member: !!start(ctx.space.payload, w).role }, path,
  versions: item.payload.versions.map(v => ({ ...v, text: undefined, textLength: v.text.length })).reverse(),
  children: item.payload.type === 'folder' ? (await children(env, w, ctx, key)).map(brief) : [],
  grants: sharer ? item.payload.grants : item.payload.grants.filter(g => w.principals.includes(g.principal)),
  links: sharer ? ctx.links.filter((l: { payload: Link }) => l.payload.item === key).map(l => ({ id: l.id, ...l.payload, tokenHash: undefined })) : [],
  publicLinks: sharer ? await linksOn(env, key) : [],
  fileRequests: sharer && item.payload.type === 'folder' ? await requestsOn(env, key) : [],
  requests: sharer ? (await pending(env, w, key)).map(r => ({ id: r.id, requester: r.payload.requester, role: r.payload.role, message: r.payload.message, at: r.payload.at })) : [],
  activity: await activity(env, key, allowed(ctx, 'contribute')),
  comments: (await comments(env, key)).map(c => ({ id: c.id, ...c.payload })).sort((a, b) => a.at.localeCompare(b.at)),
  starred: prefs.starred.includes(key), shortcut: prefs.shortcuts.includes(key),
  uploads: allowed(ctx, 'contribute') ? await unfinished(env, w, item.payload.type === 'folder' ? { parent: key } : { item: key }) : [],
  rewinds: item.payload.type === 'folder' && allowed(ctx, 'contribute') ? await rewinds(env, `folder:${key}`) : [],
 }
}
// A file's activity: uploads, restores, renames, moves, sharing and trash for everyone who can open it; who viewed or
// downloaded it only for people who can edit it.
async function activity(env: Bindings, key: string, editor: boolean) {
 const rows = (await env.DB.prepare('SELECT actor, action, detail, at FROM chest_audit WHERE object_id=? ORDER BY at DESC LIMIT 100').bind(key).all()).results as { actor: string; action: string; detail: string; at: string }[]
 return rows.filter(r => editor || !['item.read', 'version.download', 'version.preview', 'sync.hydrate', 'link.view', 'link.download', 'link.password.refused'].includes(r.action)).map(r => ({ actor: r.actor, action: r.action, at: r.at, detail: JSON.parse(r.detail) }))
}
// Names, current extracted text and folders; hits, counts and snippets follow current access exactly.
export async function search(env: Bindings, w: Who, url: URL) {
 const q = (url.searchParams.get('q') || '').trim().toLowerCase(), space = url.searchParams.get('space') || '', result: any[] = []
 for (const e of (await everything(env, w)).values()) {
  if (!e.state.role || e.state.trash || (space && e.space.id !== space)) continue
  const v = e.row.payload.versions.find(v => v.id === e.row.payload.current), text = v?.text.toLowerCase() ?? '', inName = e.row.payload.name.toLowerCase().includes(q), at = q ? text.indexOf(q) : -1
  if (q && !inName && at < 0) continue
  result.push({ ...brief(e), space: { id: e.space.id, name: label(e.space.payload, w) }, snippet: at >= 0 ? v!.text.slice(Math.max(0, at - 60), at + q.length + 60) : '' })
 }
 return { q, count: result.length, results: result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200) }
}
