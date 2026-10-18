import {setQuota,quotaView} from '../quota/api'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { fromBase64 } from '../blobs'
import { insist } from '../model'
import { who } from './access'
import { offerOwnership, ownershipView, ownershipInbox, decideOwnership, cancelOwnership } from './ownership'
import { linkPolicies, saveLinkPolicy } from './link-policy'
import { updateItemFiling } from './folder-metadata'
import { setGovernance, reviewVersion } from './governance'
import { createFile } from '../office/create-service'
import { listTemplates, publishTemplate, unpublishTemplate } from '../office/create-templates'
import { creationSettings, saveCreationSettings } from '../office/create-settings'
import { requestLists } from './request-lists'
import { addVersion, bytes, copy, createItem, itemSettings, move, nameVersion, rename, restoreVersion } from './items'
import { erase, restore, trash, trashView } from './trash'
import { decide, extend, markRead, notices, pending, prefs, requestAccess, requestView, share, sharedWithMe, unshare } from './shares'
import { changeLink, createLink, openLink } from './links'
import { createPublicLink, revokePublicLink } from './public-links'
import { closeFileRequest, createFileRequest } from './file-requests'
import { linksView, makePrivate } from './exposure'
import { devices, enrol, revoke } from './devices'
import { createSpace, member, members, settings } from './spaces'
import { home, itemView, search, spaceView } from './views'
import { sharingPolicy } from './people'
import { list } from '../store'
import { comment } from './comments'
import { readOffice, saveOffice, officeDocument } from '../office/service'
import { presence } from '../office/presence'
import { apply, plan, undo } from './rewind'
import { begin, cancel, complete, receive, status, unfinished } from './uploads'
import type { AccessRequest } from './model'
// /api/chest routes for everyday files. Every route reads the person's current groups and links first; the UI's form
// posts reach the same functions through execute().
const roots = new Set(['new-files', 'templates', 'creation-settings', 'link-policy', 'uploads', 'rewind', 'ownership', 'files', 'spaces', 'items', 'trash', 'shared', 'requests', 'notices', 'links', 'public-links', 'file-requests', 'devices', 'policy', 'search'])
export async function filesExecute(env: Bindings, request: Request, s: Session, method: string, parts: string[], input: any, url: URL): Promise<unknown> {
 if (!roots.has(parts[0])) return undefined
 const w = await who(env, s), [head, key, sub, version, verb] = parts, get = method === 'GET', post = method === 'POST'
 if (post && head === 'new-files' && !key) return createFile(env, s, w, input)
 if (head === 'templates') {
  if (get && !key) return listTemplates(env, s, w, Object.fromEntries(url.searchParams))
  if (post && !key) return publishTemplate(env, s, w, input)
  if (post && key && sub === 'unpublish') return unpublishTemplate(env, s, w, key)
 }
 if (head === 'creation-settings' && !key) return get ? creationSettings(env, s, w) : saveCreationSettings(env, s, w, input)
 if (head === 'ownership') {
  if (get && !key) return ownershipInbox(env, s, w)
  if (get && key) return ownershipView(env, s, w, key)
  if (post && key && sub === 'cancel') return cancelOwnership(env, s, w, key)
  if (post && key && !sub) return decideOwnership(env, s, w, key, input)
 }
 if(head==='link-policy')return get?linkPolicies(env,s):saveLinkPolicy(env,s,input)
 if (get && head === 'files') return home(env, s, w)
 if (get && head === 'search') return search(env, w, url)
 if (get && head === 'trash') return trashView(env, s, w)
 if (get && head === 'shared') return sharedWithMe(env, w, url.searchParams)
 if (head === 'notices') return get ? notices(env, w) : markRead(env, s, w)
 if (post && head === 'policy') return sharingPolicy(env, s, input)
 if (post && head === 'rewind' && key === 'preview') return plan(env, s, w, input)
 if (post && head === 'rewind' && key === 'apply') return apply(env, s, w, input)
 if (post && head === 'rewind' && key && sub === 'undo') return undo(env, s, w, key)
 if (head === 'uploads') {
  if (get && !key) return unfinished(env, w, { space: url.searchParams.get('space') ?? undefined, parent: url.searchParams.get('parent'), item: url.searchParams.get('item') })
  if (post && !key) return begin(env, s, w, input)
  if (get && key && !sub) return status(env, w, key)
  if (method === 'PUT' && sub === 'parts' && version) return receive(env, s, w, key, Number(version), request)
  if (post && sub === 'complete') return complete(env, s, w, key)
  if (post && sub === 'cancel') return cancel(env, s, w, key)
 }
 if (head === 'spaces') {
  if (get && sub === 'quota') return quotaView(env,s,key)
  if (post && sub === 'quota') return setQuota(env,s,key,input)
  if (post && !key) return createSpace(env, s, input)
  if (get && key && !sub) return spaceView(env, w, key)
  if (post && sub === 'members') return members(env, s, w, key, input)
  if (post && sub === 'member') return member(env, request, s, w, key, input)
  if (post && sub === 'settings') return settings(env, s, w, key, input)
 }
 if (head === 'items') {
  if (post && !key) return createItem(env, s, w, input)
  if (get && key && !sub) return itemView(env, s, w, key)
  if (get && sub === 'office-preview') return officeDocument((await readOffice(env, w, key, version)).html)
  if (get && sub === 'office') { const result = await readOffice(env, w, key, undefined, url.searchParams.get('edit') === 'true'); return { ...result, fields: url.searchParams.get('edit') === 'true' ? result.fields : undefined } }
  if (post && sub === 'office') return saveOffice(env, s, w, key, input)
  if (sub === 'presence' && (get || post)) return presence(env, s, key, post ? input : undefined)
  if (get && sub === 'bytes' && version) return bytes(env, s, w, key, version, url.searchParams.get('download') === 'true', request.headers.get('range'))
  if (post && sub === 'versions' && !version) return addVersion(env, s, w, key, fromBase64(input.base64), input)
  if (post && sub === 'versions' && verb === 'name') return nameVersion(env, s, w, key, version, input)
  if (post && sub === 'versions' && verb === 'restore') return restoreVersion(env, s, w, key, version)
  if (post && sub === 'versions' && verb === 'review') return reviewVersion(env, s, w, key, version, input)
  if (post && sub === 'filing') return updateItemFiling(env, s, w, key, input)
  if (post && sub === 'governance') return setGovernance(env, s, w, key, input)
  const actions: Record<string, () => Promise<unknown>> = { ownership: () => offerOwnership(env, s, w, key, input), rename: () => rename(env, s, w, key, input), move: () => move(env, s, w, key, input), copy: () => copy(env, s, w, key, input), settings: () => itemSettings(env, s, w, key, input), trash: () => trash(env, s, w, key), restore: () => restore(env, s, w, key), erase: () => erase(env, s, w, key), shares: () => share(env, s, w, key, input), unshare: () => unshare(env, s, w, key, input), extend: () => extend(env, s, w, key, input), links: () => createLink(env, s, w, key, input), 'public-links': () => createPublicLink(env, s, w, key, input), 'file-requests': () => createFileRequest(env, s, w, key, input), 'make-private': () => makePrivate(env, s, w, key), 'access-requests': () => requestAccess(env, s, w, key, input), prefs: () => prefs(env, s, w, key, input), comments: () => comment(env, s, w, key, input) }
  if (post && sub && actions[sub] && !version) return actions[sub]()
 }
 if (head === 'requests') {
  if (get && !key) return requestLists(env, w)
  if (get && key) return requestView(env, s, w, key)
  if (post && key) return decide(env, s, w, key, input)
 }
 if (get && head === 'links' && !key) return linksView(env, s, w)
 if (post && head === 'public-links' && key && sub === 'revoke') return revokePublicLink(env, s, w, key)
 if (post && head === 'file-requests' && key && sub === 'close') return closeFileRequest(env, s, w, key)
 if (post && head === 'links' && key === 'open') return openLink(env, s, String(input.token ?? ''))
 if (post && head === 'links' && key) return changeLink(env, s, w, key, input)
 if (head === 'devices') {
  if (get && !key) return devices(env, s)
  if (post && !key) return enrol(env, s, input)
  if (post && sub === 'revoke') return revoke(env, s, key)
 }
 insist(false, 'not_found', 404)
}
