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
import { linksForItem } from './links'
import { requestsOn } from './file-requests'
import { personal, visibleSpaces } from './spaces'
import { creationPolicy, spaceDefaults } from './space-policy'
import type { Prefs, Space } from './model'
import { extraction } from '../read/jobs'
import { mergeView,hiddenMerged } from '../filing/duplicate-view'
import { summary } from '../read/api'
import { effectiveLinkPolicy } from './link-policy'
import { accessExplanation } from './access-explanation'
import { ownershipForItem } from './ownership'
import { metadataView } from './folder-metadata'
import { storage } from '../quota/storage'
import { history } from '../audit/history'
// Read models for the files pages and API: what a person may see, with the actions their current role allows.
const can = (ctx: { space: any; state: any }) => Object.fromEntries((['download', 'comment', 'contribute', 'manage', 'share', 'administer'] as const).map(a => [a, allowed(ctx, a)]))
const label = (space: Space, w: Who) => space.kind === 'personal' ? (space.owner !== w.email ? 'Shared with me' : space.formerOwner ? space.name : 'My files') : space.name
const brief = (e: { row: any; state: any }) => { const v = e.row.payload.versions.find((v: any) => v.id === e.row.payload.current); return { id: e.row.id, name: e.row.payload.name, type: e.row.payload.type, role: e.state.role, updatedAt: e.row.payload.updatedAt, size: v?.size ?? null, mediaType: v?.mediaType ?? null } }
async function prefsOf(env: Bindings, w: Who) { return (await maybe<Prefs>(env, 'prefs', `prefs:${w.email}`))?.payload ?? { starred: [], shortcuts: [] } }
export async function recent(env: Bindings, w: Who, all: Map<string, Entry>) {
 const rows = (await env.DB.prepare("SELECT action, object_id, detail FROM chest_audit WHERE actor=? AND action IN ('item.read','link.open','file.create') ORDER BY at DESC LIMIT 300").bind(w.email).all()).results as any[], seen = new Set<string>(), result: any[] = []
 for (const r of rows) { const key = r.action === 'link.open' ? JSON.parse(r.detail).item : r.object_id, e = all.get(key); if (!e || seen.has(key) || !e.state.role || e.state.trash) continue; seen.add(key); result.push(brief(e)); if (result.length === 20) break }
 return result
}
export async function home(env: Bindings, s: Session, w: Who) {
 const mine = await personal(env, s), all = await everything(env, w), prefs = await prefsOf(env, w), pick = (ids: string[]) => ids.map(id => all.get(id)).filter((e): e is Entry => !!e && !!e.state.role && !e.state.trash).map(brief)
 const spaces = (await visibleSpaces(env, w)).filter(r => r.id !== mine.id).map(r => ({ id: r.id, name: r.payload.name, kind: r.payload.kind, role: start(r.payload, w).role }))
 return { spaceCreation: await creationPolicy(env, s, w).then(p => ({ allowed: p.allowed, rule: p.rule })), me: { email: s.operator.email, name: s.operator.displayName, role: s.operator.role }, personal: mine.id, spaces, recent: await recent(env, w, all), starred: pick(prefs.starred), shortcuts: pick(prefs.shortcuts), requests: (await pending(env, w)).length }
}
export async function spaceView(env: Bindings, w: Who, key: string) {
 const space = await get<Space>(env, 'space', key), state = start(space.payload, w); insist(state.role, 'not_found', 404)
 const ctx: Ctx = { space, chain: [], state, links: [], fences: [] }
 const manager = state.role === 'manager' || state.role === 'owner'
 return { id: space.id, name: label(space.payload, w), kind: space.payload.kind, role: state.role, can: can(ctx), settings: { ...space.payload.settings, ...spaceDefaults(space.payload) }, storage: { id: space.id, limitBytes: space.payload.storageLimitBytes ?? null, ...await storage(env, space.id) }, members: space.payload.kind === 'team' ? space.payload.members : [], children: (await children(env, w, ctx, null)).map(brief), uploads: await unfinished(env, w, { space: space.id, parent: null }), rewinds: manager ? await rewinds(env, `space:${space.id}`) : [] }
}
export async function itemView(env: Bindings, s: Session, w: Who, key: string) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'view')
 const path: { id: string; name: string }[] = []; let state = start(ctx.space.payload, w)
 for (const node of ctx.chain.slice(0, -1)) { state = descend(state, node, w, ctx.links); if (state.role) path.push({ id: node.id, name: node.payload.name }) }
 const sharer = allowed(ctx, 'share'), prefs = await prefsOf(env, w), currentVersion = item.payload.versions.find(v => v.id === item.payload.current)
 const lineage=await mergeView(env,s,w,item)
 await recordAccess(env, s, item, 'item.read')
 return {
  metadata: await metadataView(env, ctx), linkCreation: (await effectiveLinkPolicy(env,w,ctx.space.id)).rules, id: key, item: { ...item.payload, versions: undefined, grants: undefined, trash: undefined }, revision: item.revision, ownership: await ownershipForItem(env, s, w, key), accessExplanation: accessExplanation(ctx, w), role: ctx.state.role, can: can(ctx), space: { id: ctx.space.id, name: label(ctx.space.payload, w), kind: ctx.space.payload.kind, member: !!start(ctx.space.payload, w).role }, path,
  versions: lineage.versions.map(v => ({ ...v, text: undefined, textLength: v.text.length })), mergedInto:lineage.mergedInto, merges:lineage.merges,
  reading: currentVersion ? summary((await extraction(env, currentVersion.checksum))?.payload ?? null, currentVersion.mediaType) : null,
  children: item.payload.type === 'folder' ? (await children(env, w, ctx, key)).map(brief) : [],
  grants: sharer ? item.payload.grants : item.payload.grants.filter(g => w.principals.includes(g.principal)),
  links: sharer ? await linksForItem(env,key,ctx.space.id) : [],
  publicLinks: sharer ? await linksOn(env, key) : [],
  fileRequests: sharer && item.payload.type === 'folder' ? await requestsOn(env, key) : [],
  requests: sharer ? (await pending(env, w, key)).map(r => ({ id: r.id, requester: r.payload.requester, role: r.payload.role, message: r.payload.message, at: r.payload.at })) : [],
  activity: (await history(env,s,new URLSearchParams({object:key,limit:'100'}))).rows.map(r=>({...r,detail:JSON.parse(r.detail)})),
  comments: (await comments(env, key)).map(c => ({ id: c.id, ...c.payload })).sort((a, b) => a.at.localeCompare(b.at)),
  starred: prefs.starred.includes(key), shortcut: prefs.shortcuts.includes(key),
  uploads: allowed(ctx, 'contribute') ? await unfinished(env, w, item.payload.type === 'folder' ? { parent: key } : { item: key }) : [],
  rewinds: item.payload.type === 'folder' && allowed(ctx, 'contribute') ? await rewinds(env, `folder:${key}`) : [],
 }
}
export { search } from './search'
