import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { fromBase64 } from '../blobs'
import { insist } from '../model'
import { who } from './access'
import { addVersion, bytes, copy, createItem, itemSettings, move, nameVersion, rename, restoreVersion } from './items'
import { erase, restore, trash, trashView } from './trash'
import { decide, extend, markRead, notices, pending, prefs, requestAccess, requestView, share, sharedWithMe, unshare } from './shares'
import { changeLink, createLink, openLink } from './links'
import { devices, enrol, revoke } from './devices'
import { createSpace, members, settings } from './spaces'
import { home, itemView, search, spaceView } from './views'
import { sharingPolicy } from './people'
import { list } from '../store'
import { comment } from './comments'
import { apply, plan } from './rewind'
import type { AccessRequest } from './model'
// /api/chest routes for everyday files. Every route reads the person's current groups and links first; the UI's form
// posts reach the same functions through execute().
const roots = new Set(['rewind', 'files', 'spaces', 'items', 'trash', 'shared', 'requests', 'notices', 'links', 'devices', 'policy', 'search'])
export async function filesExecute(env: Bindings, request: Request, s: Session, method: string, parts: string[], input: any, url: URL): Promise<unknown> {
 if (!roots.has(parts[0])) return undefined
 const w = await who(env, s), [head, key, sub, version, verb] = parts, get = method === 'GET', post = method === 'POST'
 if (get && head === 'files') return home(env, s, w)
 if (get && head === 'search') return search(env, w, url)
 if (get && head === 'trash') return trashView(env, s, w)
 if (get && head === 'shared') return sharedWithMe(env, w, url.searchParams)
 if (head === 'notices') return get ? notices(env, w) : markRead(env, s, w)
 if (post && head === 'policy') return sharingPolicy(env, s, input)
 if (post && head === 'rewind' && key === 'preview') return plan(env, s, w, input)
 if (post && head === 'rewind' && key === 'apply') return apply(env, s, w, input)
 if (head === 'spaces') {
  if (post && !key) return createSpace(env, s, input)
  if (get && key && !sub) return spaceView(env, w, key)
  if (post && sub === 'members') return members(env, s, w, key, input)
  if (post && sub === 'settings') return settings(env, s, w, key, input)
 }
 if (head === 'items') {
  if (post && !key) return createItem(env, s, w, input)
  if (get && key && !sub) return itemView(env, s, w, key)
  if (get && sub === 'bytes' && version) return bytes(env, s, w, key, version, url.searchParams.get('download') === 'true', request.headers.get('range'))
  if (post && sub === 'versions' && !version) return addVersion(env, s, w, key, fromBase64(input.base64), input)
  if (post && sub === 'versions' && verb === 'name') return nameVersion(env, s, w, key, version, input)
  if (post && sub === 'versions' && verb === 'restore') return restoreVersion(env, s, w, key, version)
  const actions: Record<string, () => Promise<unknown>> = { rename: () => rename(env, s, w, key, input), move: () => move(env, s, w, key, input), copy: () => copy(env, s, w, key, input), settings: () => itemSettings(env, s, w, key, input), trash: () => trash(env, s, w, key), restore: () => restore(env, s, w, key), erase: () => erase(env, s, w, key), shares: () => share(env, s, w, key, input), unshare: () => unshare(env, s, w, key, input), extend: () => extend(env, s, w, key, input), links: () => createLink(env, s, w, key, input), 'access-requests': () => requestAccess(env, s, w, key, input), prefs: () => prefs(env, s, w, key, input), comments: () => comment(env, s, w, key, input) }
  if (post && sub && actions[sub] && !version) return actions[sub]()
 }
 if (head === 'requests') {
  if (get && !key) return { decide: (await pending(env, w)).map(r => ({ id: r.id, ...r.payload })), mine: (await list<AccessRequest>(env, 'request')).filter(r => r.payload.requester === w.email).map(r => ({ id: r.id, role: r.payload.role, status: r.payload.status, at: r.payload.at, expiresAt: r.payload.expiresAt, grantedRole: r.payload.grantedRole ?? null })) }
  if (get && key) return requestView(env, s, w, key)
  if (post && key) return decide(env, s, w, key, input)
 }
 if (post && head === 'links' && key === 'open') return openLink(env, s, String(input.token ?? ''))
 if (post && head === 'links' && key) return changeLink(env, s, w, key, input)
 if (head === 'devices') {
  if (get && !key) return devices(env, s)
  if (post && !key) return enrol(env, s, input)
  if (post && sub === 'revoke') return revoke(env, s, key)
 }
 insist(false, 'not_found', 404)
}
