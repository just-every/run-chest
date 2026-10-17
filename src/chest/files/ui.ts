import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { ChestError, type Group, type Person } from '../model'
import { allowed, everything, start, who } from './access'
import { home, itemView, search, spaceView } from './views'
import { trashView } from './trash'
import { notices, requestView, sharedWithMe } from './shares'
import { devices } from './devices'
import { openLink } from './links'
import { filesExecute } from './api'
import { itemPage, requestAccessPage, rewindDonePage, rewindPage, rewindUndonePage } from './ui-item'
import { devicesPage, homePage, noticesPage, requestPage, requestsPage, searchPage, secretPage, sharedPage, spacePage, trashPage } from './ui-pages'
import { linksPage } from './ui-links'
import { linksView } from './exposure'
import type { Space } from './model'
// Server-rendered files pages and the form-post adaptations they need; every action runs the same API function.
export const filesPath = (path: string) => /^\/(items|spaces|links|public-links|file-requests|requests|notices|devices|rewind|uploads)(\/|$)/.test(path)
export function filesInput(input: any) {
 for (const key of ['noDownload', 'editorSharing', 'restricted', 'discoverable', 'starred', 'shortcut', 'remove']) if (input[key] === 'true' || input[key] === 'false') input[key] = input[key] === 'true'
 if (input.path === '/items' && input.type === 'file' && !input.name) input.name = input.filename
 if (typeof input.destination === 'string') { const [kind, id] = input.destination.split(':'); if (kind === 'space') { input.space = id; input.parent = null } else input.parent = id }
 if (input.expires === '') delete input.expires
 // The restore preview's checkboxes name the items to restore.
 if (input.path === '/rewind/apply') input.items = Object.keys(input).filter(k => k.startsWith('item:')).map(k => k.slice(5))
 return input
}
// Pages that must show a one-time secret instead of redirecting.
export function filesReceipt(input: any, result: any) {
 if (/^\/items\/[^/]+\/links$/.test(input.path)) return secretPage('Organisation link created', result.url, 'Copy this link now. Chest keeps only a fingerprint of it and cannot show it again.', input.returnTo || '/app/files')
 if (/^\/items\/[^/]+\/public-links$/.test(input.path)) return secretPage('Link created', result.url, `Copy this link now and send it to the people who need the ${result.link.password ? 'file; send the password separately' : 'file'}. Chest keeps only a fingerprint of it and cannot show it again. Revoke it any time from the file's page or Links.`, input.returnTo || '/app/links')
 if (/^\/items\/[^/]+\/file-requests$/.test(input.path)) return secretPage('File request created', result.url, `Send this link to the people who should upload. They need no account and see nothing else in the folder. ${result.email === 'available' ? 'You get an email and a notice for every upload.' : 'Email is not available yet on this installation; every upload appears in your Notices.'} Close the request any time from Links.`, input.returnTo || '/app/links')
 if (input.path === '/rewind/preview') return rewindPage(input, result)
 if (input.path === '/rewind/apply') return rewindDonePage(input, result)
 if (/^\/rewind\/[^/]+\/undo$/.test(input.path)) return rewindUndonePage(input, result)
 if (input.path === '/devices') return secretPage('Device key created', result.token, `Enter this key in the Chest client on ${result.device.name}. It is shown once; revoke the device to stop it.`, '/app/devices')
 return null
}
async function destinations(env: Bindings, w: Awaited<ReturnType<typeof who>>) {
 const all = await everything(env, w), name = (id: string): string => { const e = all.get(id); return e ? (e.row.payload.parent ? `${name(e.row.payload.parent)} / ` : `${e.space.payload.kind === 'personal' ? 'My files' : e.space.payload.name} / `) + e.row.payload.name : '' }
 const spaces = (await list<Space>(env, 'space')).filter(r => allowed({ space: r, state: start(r.payload, w) }, 'contribute')).map(r => ({ id: `space:${r.id}`, label: r.payload.kind === 'personal' ? (r.payload.formerOwner ? r.payload.name : 'My files') : r.payload.name }))
 return [...spaces, ...[...all.values()].filter(e => e.row.payload.type === 'folder' && !e.state.trash && allowed(e, 'contribute')).map(e => ({ id: `folder:${e.row.id}`, label: name(e.row.id) }))]
}
export async function filesPage(env: Bindings, request: Request, s: Session, url: URL): Promise<{ body: string } | { redirect: string } | null> {
 const path = url.pathname, parts = path.split('/').filter(Boolean)
 if (parts[0] === 's' && parts[1]) return { redirect: `/app/items/${(await openLink(env, s, parts[1])).item}` }
 if (parts[0] !== 'app' || !['files', 'spaces', 'items', 'shared', 'requests', 'notices', 'devices', 'links'].includes(parts[1])) return null
 const w = await who(env, s), people = (await list<Person>(env, 'person')).filter(p => p.payload.status !== 'inactive'), groups = await list<Group>(env, 'group')
 if (path === '/app/files') return { body: homePage(await home(env, s, w)) }
 if (path === '/app/files/search') return { body: searchPage(url.searchParams.get('q') || '', await search(env, w, url)) }
 if (path === '/app/files/trash') return { body: trashPage(await trashView(env, s, w)) }
 if (parts[1] === 'spaces' && parts[2]) return { body: spacePage(await spaceView(env, w, parts[2]), people, groups) }
 if (parts[1] === 'items' && parts[2]) {
  try { return { body: itemPage({ ...await itemView(env, s, w, parts[2]), me: s.operator.email, ownerRole: s.operator.role === 'owner' }, { people, groups, destinations: await destinations(env, w) }) } }
  catch (e) { if (e instanceof ChestError && e.code === 'access_required') return { body: requestAccessPage(parts[2]) }; throw e }
 }
 if (path === '/app/shared') return { body: sharedPage(await sharedWithMe(env, w, url.searchParams), url.searchParams) }
 if (path === '/app/requests') return { body: requestsPage(await filesExecute(env, request, s, 'GET', ['requests'], {}, url)) }
 if (parts[1] === 'requests' && parts[2]) return { body: requestPage(await requestView(env, s, w, parts[2])) }
 if (path === '/app/notices') return { body: noticesPage(await notices(env, w)) }
 if (path === '/app/links') return { body: linksPage(await linksView(env, s, w)) }
 if (path === '/app/devices') return { body: devicesPage(await devices(env, s)) }
 throw new ChestError('not_found', 404)
}
