import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { esc } from '../ui-shared'
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
import { quotas, quotaView } from '../quota/api'
import { quotaPage, quotasPage } from '../quota/ui'
import { readOffice } from '../office/service'
import { moveInPage } from './ui-movein'
import { zoned } from './zone'
import { linkPolicies } from './link-policy'
import { ownershipView, ownershipInbox } from './ownership'
import { ownershipPage, ownershipInboxPage } from './ui-ownership'
import { personal } from './spaces'
import { readerState } from '../read/settings'
import { isAdmin } from './access'
import { listTemplates } from '../office/create-templates'
import { creationSettings } from '../office/create-settings'
import { templatesPage } from '../office/new-ui'
// Server-rendered files pages and the form-post adaptations they need; every action runs the same API function.
export const filesPath = (path: string) => /^\/(new-files|templates|creation-settings|items|spaces|links|public-links|file-requests|link-policy|ownership|requests|notices|devices|rewind|uploads)(\/|$)/.test(path)
export function filesInput(input: any) {
 if (input.path === '/new-files') { if (input.name === '') delete input.name; if (input.template === '') delete input.template }
 if (input.path === '/templates' && typeof input.templateAudience === 'string') {
  const [type, ...rest] = input.templateAudience.split(':'), value = rest.join(':')
  input.audience = type === 'group' ? { type: 'groups', groups: [value] } : type === 'space' ? { type: 'space', space: value } : { type: 'organisation' }
 }
 if (input.path === '/creation-settings') input.groups = Object.entries(input).filter(([key, value]) => key.startsWith('format:') && value).map(([key, format]) => ({ group: key.slice(7), format }))
 if (typeof input.storageLimitBytes === 'string') input.storageLimitBytes = input.storageLimitBytes.trim() === '' ? null : Number(input.storageLimitBytes)
 for (const key of ['noDownload', 'editorSharing', 'restricted', 'discoverable', 'starred', 'shortcut', 'remove', 'retainEditor', 'allowPublic', 'allowOrganisation', 'allowDiscovery', 'download']) if (input[key] === 'true' || input[key] === 'false') input[key] = input[key] === 'true'
 if (input.path === '/items' && input.type === 'file' && !input.name) input.name = input.filename
 if (typeof input.destination === 'string') { const [kind, id] = input.destination.split(':'); if (kind === 'space') { input.space = id; input.parent = null } else input.parent = id }
 if (/^\/items\/[^/]+\/office$/.test(input.path)) input.changes = Object.fromEntries(Object.entries(input).filter(([k]) => k.startsWith('office:')).map(([k, v]) => [k.slice(7), v]))
 if(input.audience==='public')delete input.role
 if(typeof input.linkVersion==='string'){if(input.linkVersion.startsWith('pinned:')){input.versionMode='pinned';input.version=input.linkVersion.slice(7)}else input.versionMode='current'}
 if (input.expires === '') delete input.expires
 // The restore preview's checkboxes name the items to restore.
 if (input.path === '/rewind/preview' && input.local !== undefined) input.at = zoned(input.local, input.zone)
 if (input.path === '/rewind/apply') input.items = Object.keys(input).filter(k => k.startsWith('item:')).map(k => k.slice(5))
 return input
}
// Pages that must show a one-time secret instead of redirecting.
export function filesReceipt(input: any, result: any) {
 if (/^\/items\/[^/]+\/links$/.test(input.path)) return secretPage('Link created', result.url, 'Copy this link now. Chest keeps only a fingerprint of it and cannot show it again.', input.returnTo || '/app/files')
 if (/^\/items\/[^/]+\/public-links$/.test(input.path)) return secretPage('Link created', result.url, `Copy this link now and send it to the people who need the ${result.link.password ? 'file; send the password separately' : 'file'}. Chest keeps only a fingerprint of it and cannot show it again. Revoke it any time from the file's page or Links.`, input.returnTo || '/app/links')
 if (/^\/items\/[^/]+\/file-requests$/.test(input.path)) return secretPage('File request created', result.url, `Send this link to the people who should upload. They need no account and see nothing else in the folder. ${result.email === 'available' ? 'You get an email and a notice for every upload.' : 'Email is not available yet on this installation; every upload appears in your Notices.'} Close the request any time from Links.`, input.returnTo || '/app/links')
 if (/^\/items\/[^/]+\/comments$/.test(input.path) && result.email && !/^(accepted|sent)/.test(result.email)) return `<p>${esc(result.email.startsWith('Not available yet') ? result.email : 'Email notification is not available yet on this installation.')}</p><p><a href="${esc(input.returnTo || '/app/files')}">Back to the file</a></p>`
 if (input.path === '/rewind/preview') return rewindPage(input, result)
 if (input.path === '/rewind/preview' && input.local !== undefined) input.at = zoned(input.local, input.zone)
 if (input.path === '/rewind/apply') return rewindDonePage(input, result)
 if (/^\/rewind\/[^/]+\/undo$/.test(input.path)) return rewindUndonePage(input, result)
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
 if (parts[0] !== 'app' || !['templates', 'files', 'ownership', 'spaces', 'items', 'shared', 'requests', 'notices', 'devices', 'links', 'storage', 'move-in'].includes(parts[1])) return null
 if (path === '/app/storage') return { body: quotasPage(await quotas(env, s)) }
 if (parts[1] === 'spaces' && parts[2] && parts[3] === 'quota') return { body: quotaPage(await quotaView(env, s, parts[2])) }
 const w = await who(env, s), people = (await list<Person>(env, 'person')).filter(p => p.payload.status !== 'inactive'), groups = await list<Group>(env, 'group')
 if (path === '/app/templates') return { body: templatesPage(await listTemplates(env, s, w), await creationSettings(env, s, w), groups, isAdmin(s)) }
 if (path === '/app/ownership') return { body: ownershipInboxPage(await ownershipInbox(env, s, w)) }
 if (parts[1] === 'ownership' && parts[2]) return { body: ownershipPage(await ownershipView(env, s, w, parts[2])) }
 if (path === '/app/files') return { body: homePage(await home(env, s, w)) }
 if (path === '/app/files/search') { const reader = await readerState(env); return { body: searchPage(url.searchParams.get('q') || '', await search(env, w, url), 'config' in reader ? null : 'unavailable' in reader ? reader.unavailable : reader.missing) } }
 if (path === '/app/files/trash') return { body: trashPage(await trashView(env, s, w)) }
 if (parts[1] === 'spaces' && parts[2]) { const d = await spaceView(env, w, parts[2]); return { body: spacePage({ ...d, creation: d.can.contribute ? await listTemplates(env, s, w, { space: d.id }) : null, quotaOwner: s.operator.role === 'owner' }, people, groups) } }
 if (parts[1] === 'items' && parts[2]) {
  try { const officeEdit = url.searchParams.get('edit') === '1' ? await readOffice(env, w, parts[2], undefined, true) : null, d = await itemView(env, s, w, parts[2]); return { body: itemPage({ ...d, creation: d.item.type === 'folder' && d.can.contribute ? await listTemplates(env, s, w, { parent: parts[2] }) : null, officeEdit, me: s.operator.email, ownerRole: s.operator.role === 'owner' }, { people, groups, destinations: await destinations(env, w) }) } }
  catch (e) { if (e instanceof ChestError && e.code === 'access_required') return { body: requestAccessPage(parts[2]) }; throw e }
 }
 if (path === '/app/shared') return { body: sharedPage(await sharedWithMe(env, w, url.searchParams), url.searchParams) }
 if (path === '/app/requests') return { body: requestsPage(await filesExecute(env, request, s, 'GET', ['requests'], {}, url)) }
 if (parts[1] === 'requests' && parts[2]) return { body: requestPage(await requestView(env, s, w, parts[2])) }
 if (path === '/app/notices') return { body: noticesPage(await notices(env, w)) }
 if (path === '/app/links') return { body: linksPage({ ...await linksView(env, s, w), policy: ['owner','admin'].includes(s.operator.role) ? await linkPolicies(env,s) : null, policyScope: url.searchParams.get('policyScope') ?? 'organisation' }) }
 if (path === '/app/devices') return { body: devicesPage(await devices(env, s)) }
 if (path === '/app/move-in') { await personal(env, s); return { body: moveInPage(await destinations(env, w), s.operator.role === 'owner') } }
 throw new ChestError('not_found', 404)
}
