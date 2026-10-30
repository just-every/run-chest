import { pdfNavigation } from './comments'
import { compareVersions, comparisonPage } from './compare'
import { commentImportForm, commentImportPreview } from './ui-comment-import'
import { assignedComments } from './comments'
import { owner } from '../access'
import { canAdmin } from '../administration/roles'
import { guestPolicyCard } from './guest-policy'
import { contentCard } from '../content-security/ui'
import { signatureInput } from '../signatures/ui'
import { signaturePage } from '../signatures/page'
import { bulkPage, bulkInput } from '../bulk/ui'
import { incidents } from '../upload-protection/service'
import { protectionPage } from '../upload-protection/ui'
import { transfersExecute, transferView } from '../transfers/service'
import { repairs } from '../sync-repair/service'
import { transfersPage, transferPage } from '../transfers/ui'
import { shareTargets } from './share-targets'
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
import { itemCrumbs, itemPage, requestAccessPage, rewindDonePage, rewindPage, rewindUndonePage } from './ui-item'
import { agentStrip as agentData, folderRows } from './folder-view'
import { newFileMenu } from '../office/new-ui'
import type { Bar } from '../ui-shell'
import { devicesPage, homePage, newSpacePage, noticesPage, recentPage, requestPage, requestsPage, searchPage, secretPage, sharedPage, spacePage, starredPage, trashPage } from './ui-pages'
import { repairView } from '../filing/link-repairs'
import { linksPage } from './ui-links'
import { linksView } from './exposure'
import type { Space } from './model'
import { quotas, quotaView, quotaPolicyView } from '../quota/api'
import { quotaPage, quotasPage } from '../quota/ui'
import { readOffice } from '../office/service'
import { moveInPage } from './ui-movein'
import { zoned } from './zone'
import { linkPolicies } from './link-policy'
import { ownershipView, ownershipInbox } from './ownership'
import { ownershipPage, ownershipInboxPage } from './ui-ownership'
import { personal } from './spaces'
import { spacePolicyView } from './space-policy'
import { spaceSettingsView } from './space-settings'
import { spacePolicyPage } from './ui-space-policy'
import { readerState } from '../read/settings'
import { isAdmin } from './access'
import { listTemplates } from '../office/create-templates'
import { creationSettings } from '../office/create-settings'
import { templatesPage } from '../office/new-ui'
// Server-rendered files pages and the form-post adaptations they need; every action runs the same API function.
export const filesPath = (path: string) => /^\/(guest-policy|content-security|quota-policy|bulk|upload-protection|sync-repair|transfers|space-policy|space-requests|new-files|templates|creation-settings|signatures|items|spaces|links|public-links|file-requests|link-policy|ownership|requests|notices|devices|rewind|uploads)(\/|$)/.test(path)
export function filesInput(input: any) {
 if(input.path==='/guest-policy')input.confirm=input.confirm===true||input.confirm==='true'
 if(input.path.startsWith('/content-security')){for(const k of ['enabled','confirm','pause'])if(typeof input[k]==='string')input[k]=input[k]==='true';if(typeof input.sensitiveGroups==='string')input.sensitiveGroups=input.sensitiveGroups.split(',').map((g:string)=>g.trim()).filter(Boolean);if(input.path==='/content-security/policy'&&input.releaseGroups===undefined)input.releaseGroups=Object.keys(input).filter(k=>k.startsWith('release:')&&input[k]==='true').map(k=>k.slice(8));if(input.path==='/content-security/policy'&&input.sensitiveGroups===undefined)input.sensitiveGroups=Object.keys(input).filter(k=>k.startsWith('reader:')&&input[k]==='true').map(k=>k.slice(7))}
 if(input.path.startsWith('/bulk'))bulkInput(input)
 if(input.path.startsWith('/signatures'))signatureInput(input)
 if(input.path==='/link-policy' && input.domainRestriction==='false')input.trustedDomains=null
 if (input.path === '/new-files') { const [kind, ...rest] = String(input.start ?? '').split(':'); if (input.start !== undefined) { input.kind = kind; input.template = rest.join(':'); delete input.start } if (input.name === '') delete input.name; if (input.template === '') delete input.template }
 if (input.path === '/templates' && typeof input.templateAudience === 'string') {
  const [type, ...rest] = input.templateAudience.split(':'), value = rest.join(':')
  input.audience = type === 'group' ? { type: 'groups', groups: [value] } : type === 'space' ? { type: 'space', space: value } : { type: 'organisation' }
 }
 if (input.path === '/space-policy' && input.scope === 'organisation') input.creatorGroups = Object.keys(input).filter(k => k.startsWith('creatorGroup:') && input[k] === 'true').map(k => k.slice(13))
 if (input.path === '/creation-settings') input.groups = Object.entries(input).filter(([key, value]) => key.startsWith('format:') && value).map(([key, format]) => ({ group: key.slice(7), format }))
 if (typeof input.limitBytes === 'string') input.limitBytes = input.limitBytes.trim() === '' ? null : Number(input.limitBytes)
 if (typeof input.storageLimitBytes === 'string') input.storageLimitBytes = input.storageLimitBytes.trim() === '' ? null : Number(input.storageLimitBytes)
 for (const key of ['confirmExternal', 'allowExternal', 'allowNonMembers', 'allowEditors', 'warnExternal', 'scanIntake', 'externalAccess', 'nonMemberAccess', 'contentManagerFolderSharing', 'managerOverride', 'confirmOverLimit', 'noDownload', 'editorSharing', 'restricted', 'discoverable', 'starred', 'shortcut', 'remove', 'retainEditor', 'allowPublic', 'allowOrganisation', 'allowDiscovery', 'download']) if (input[key] === 'true' || input[key] === 'false') input[key] = input[key] === 'true'
 if (input.path === '/items' && input.type === 'file' && !input.name) input.name = input.filename
 if (typeof input.destination === 'string') { const [kind, id] = input.destination.split(':'); if (kind === 'space') { input.space = id; input.parent = null } else input.parent = id }
 if (/^\/items\/[^/]+\/office(?:-suggestions)?$/.test(input.path)) input.changes = Object.fromEntries(Object.entries(input).filter(([k]) => k.startsWith('office:')).map(([k, v]) => [k.slice(7), v]))
 if(typeof input.linkVersion==='string'){if(input.linkVersion.startsWith('pinned:')){input.versionMode='pinned';input.version=input.linkVersion.slice(7)}else input.versionMode=['approved','pinned'].includes(input.linkVersion)?input.linkVersion:'current'}
 if (input.expires === '') delete input.expires
 // The restore preview's checkboxes name the items to restore.
 if (input.path === '/rewind/preview' && input.local !== undefined) input.at = zoned(input.local, input.zone)
 if (input.path === '/rewind/apply') input.items = Object.keys(input).filter(k => k.startsWith('item:')).map(k => k.slice(5))
 return input
}
// Pages that must show a one-time secret instead of redirecting.
export function filesReceipt(input: any, result: any) {
 if (/^\/items\/[^/]+\/comment-import\/preview$/.test(input.path)) return commentImportPreview(input, result)
 if (input.path === '/devices') return secretPage('Companion key created',result.token,'This key is shown once. Store it privately and supply it to the companion through CHEST_DEVICE_TOKEN. It authorizes this device with your current file permissions. Revoke it from Sync devices.','/app/devices')
 if (input.path === '/transfers') return secretPage('Delivery package created',result.url,`Copy this link now. Email: ${result.email}. Email acknowledgment is not a recipient receipt.`, '/app/transfers/'+result.id)
 if (input.path === '/space-requests') return `<div class="page-head"><h1>Space request sent</h1></div><p>Your request is recorded and appears in Notices for ${esc(result.notifiedAdmins)} service-settings admin(s).</p><p><a class="link" href="/app/files">Back to Files</a></p>`
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
// The folder browser's extra read: each row's facts, the conflicts, the agent strip and the file picked into the
// details panel (?file=, which must be one of this folder's files).
async function browser(env: Bindings, s: Session, w: Awaited<ReturnType<typeof who>>, space: string, parent: string | null, ids: string[], url: URL) {
 const { rows, conflicts } = await folderRows(env, s, w, space, parent, ids), pick = url.searchParams.get('file'), show = ['files', 'folders'].includes(url.searchParams.get('show') ?? '') ? url.searchParams.get('show')! : ''
 const selected = pick && rows.some(r => r.id === pick && r.type === 'file') ? await itemView(env, s, w, pick) : null
 return { rows, conflicts, agent: await agentData(env, s, w, ids), selected: selected ? { ...selected, members: await members(env, w, pick!) } : null, show }
}
// Who reaches an item through its space: the space's members, unless the item or a folder above it is restricted.
async function members(env: Bindings, w: Awaited<ReturnType<typeof who>>, key: string) {
 const all = await everything(env, w), e = all.get(key); if (!e || e.space.payload.kind !== 'team') return []
 for (let at: typeof e | undefined = e; at; at = at.row.payload.parent ? all.get(at.row.payload.parent) : undefined) if (at.row.payload.restricted) return []
 return e.space.payload.members.map(m => m.principal).filter(p => p.includes('@'))
}
const bar = (crumbs: Bar['crumbs'], creation: any, target: { space?: string; parent?: string }, returnTo: string, share?: string): Bar => ({ crumbs, new: newFileMenu(target, returnTo, creation) || undefined, upload: '#upload', share })
export async function filesPage(env: Bindings, request: Request, s: Session, url: URL): Promise<{ body: string, bar?: Bar } | { redirect: string } | null> {
 const bulk=await bulkPage(env,s,url);if(bulk)return {body:bulk}
 const path = url.pathname, parts = path.split('/').filter(Boolean)
 if (parts[0] === 's' && parts[1]){try{return {redirect:`/app/items/${(await openLink(env,s,parts[1])).item}`}}catch(e){if(e instanceof ChestError&&e.code==='link_password_required'){const {card,form,hidden,field}=await import('../ui-shared');return {body:card('Enter the link password',form('/links/open',hidden('token',parts[1])+field('Link password','password','','password'),'Open organization link',url.pathname))}}throw e}}
 if (parts[0] !== 'app' || !['upload-protection', 'transfers', 'templates', 'files', 'ownership', 'spaces', 'items', 'shared', 'recent', 'starred', 'requests', 'notices', 'devices', 'links', 'storage', 'move-in', 'signatures'].includes(parts[1])) return null
 if (path === '/app/upload-protection') return {body:protectionPage(await incidents(env,s))+await contentCard(env,s)}

 if (parts[1] === 'signatures' && parts[2]) return { body: await signaturePage(env, s, await who(env, s), parts[2]) }
 if (path === '/app/storage') return { body: quotasPage(await quotaPolicyView(env, s)) }
 if (parts[1] === 'spaces' && parts[2] && parts[3] === 'quota') return { body: quotaPage(await quotaView(env, s, parts[2])) }
 const w = await who(env, s), people = (await list<Person>(env, 'person')).filter(p => p.payload.status !== 'inactive'), groups = await list<Group>(env, 'group')
 if(parts[1]==='transfers')return {body:parts[2]?transferPage(await transferView(env,s,w,parts[2])):transfersPage(await transfersExecute(env,request,s,'GET',['transfers'],{}) as any[],await shareTargets(env,w))}
 if (path === '/app/templates') return { body: templatesPage(await listTemplates(env, s, w), await creationSettings(env, s, w), groups, await canAdmin(env, s, 'service-settings')) }
 if (path === '/app/ownership') return { body: ownershipInboxPage(await ownershipInbox(env, s, w)) }
 if (parts[1] === 'ownership' && parts[2]) return { body: ownershipPage(await ownershipView(env, s, w, parts[2])) }
 if (path === '/app/files/space-policy') { const scope = url.searchParams.get('scope') ?? 'organisation'; return { body: spacePolicyPage(await spacePolicyView(env, s), scope, scope.startsWith('space:') ? await spaceSettingsView(env, s, scope.slice(6)) : undefined) } }
 if (path === '/app/files') return { body: homePage(await home(env, s, w)) }
 if (path === '/app/recent') return { body: recentPage(await home(env, s, w)) }
 if (path === '/app/starred') return { body: starredPage(await home(env, s, w)) }
 if (path === '/app/spaces/new') return { body: newSpacePage(await home(env, s, w)) }
 if (path === '/app/files/search') { const reader = await readerState(env); return { body: searchPage(url.searchParams.get('q') || '', await search(env, w, url), 'config' in reader ? null : 'unavailable' in reader ? reader.unavailable : reader.missing) } }
 if (path === '/app/files/trash') return { body: trashPage(await trashView(env, s, w)) }
 if (parts[1] === 'spaces' && parts[2]) { const d = await spaceView(env, w, parts[2]), creation = d.can.contribute ? await listTemplates(env, s, w, { space: d.id }) : null, folder = await browser(env, s, w, d.id, null, d.children.map((c: any) => c.id), url); return { body: spacePage({ ...d, folder, creation, serviceAdmin: isAdmin(s), quotaOwner: s.operator.role === 'owner', manage: url.searchParams.has('manage') }, people, groups), bar: bar([{ label: d.name }], creation, { space: d.id }, `/app/spaces/${d.id}`) } }
 if (parts[1] === 'items' && parts[2]) {
  try {
   if (parts[3] === 'import-comments') { owner(s); return { body: commentImportForm(await itemView(env, s, w, parts[2])) } }
   if (parts[3] === 'compare') return { body: comparisonPage(await compareVersions(env, w, parts[2], url.searchParams.get('left'), url.searchParams.get('right'))) }
   const d = await itemView(env, s, w, parts[2]), returnTo = `/app/items/${d.id}`, officeEdit = url.searchParams.get('edit') === '1' && d.can.download ? await readOffice(env, w, parts[2], undefined, true, url.searchParams.get('mode')==='suggest') : null
   const selectedThread = url.searchParams.get('thread')
   if (selectedThread && d.comments.some(c => c.id === selectedThread && c.resolved && c.anchor?.kind === 'pdf')) {
    return { redirect: `${returnTo}?comment=${encodeURIComponent(selectedThread)}#comment-${encodeURIComponent(selectedThread)}` }
   }
   const creation = d.item.type === 'folder' && d.can.contribute ? await listTemplates(env, s, w, { parent: parts[2] }) : null, folder = d.item.type === 'folder' ? await browser(env, s, w, d.space.id, d.id, d.children.map((c: any) => c.id), url) : null
   return { body: itemPage({ ...d, focusComment: url.searchParams.get('comment'), annotationNavigation: pdfNavigation(d.unresolvedPdf, url.searchParams.get('thread')), folder, members: await members(env, w, d.id), creation, officeEdit, me: s.operator.email, ownerRole: s.operator.role === 'owner', templateAdmin: await canAdmin(env, s, 'service-settings'), manage: url.searchParams.has('manage') }, { people, groups, destinations: await destinations(env, w) }), bar: d.item.type === 'folder' ? bar(itemCrumbs(d), creation, { parent: d.id }, returnTo, d.can.share ? '?manage#share' : undefined) : { crumbs: itemCrumbs(d), upload: d.can.contribute ? '#upload' : undefined, share: d.can.share ? '#share' : undefined } }
  }
  catch (e) { if (e instanceof ChestError && e.code === 'access_required') return { body: requestAccessPage(parts[2]) }; throw e }
 }
 if (path === '/app/shared') return { body: sharedPage(await sharedWithMe(env, w, url.searchParams), url.searchParams) }
 if (path === '/app/requests') return { body: requestsPage(await filesExecute(env, request, s, 'GET', ['requests'], {}, url)) }
 if (parts[1] === 'requests' && parts[2]) return { body: requestPage(await requestView(env, s, w, parts[2])) }
 if (path === '/app/notices') return { body: noticesPage(await notices(env, w), await assignedComments(env, w)) }
 if (path === '/app/links') return { body: linksPage({ ...await linksView(env, s, w), repairs: await repairView(env,s), policy: ['owner','admin'].includes(s.operator.role) ? await linkPolicies(env,s) : null, policyScope: url.searchParams.get('policyScope') ?? 'organisation' })+await guestPolicyCard(env,s) }
 if (path === '/app/devices') return { body: devicesPage(await devices(env, s),await repairs(env,s)) }
 if (path === '/app/move-in') { await personal(env, s); return { body: moveInPage(await destinations(env, w), s.operator.role === 'owner') } }
 throw new ChestError('not_found', 404)
}
