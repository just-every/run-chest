import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { ChestError } from './model'
import { everything, who, type Entry } from './files/access'
import { personal, visibleSpaces } from './files/spaces'
import { pending } from './files/shares'
import { devices } from './files/devices'
import { storageView } from './quota/storage'
import { esc, avatar } from './ui-shared'
import { icons, type IconName } from '../ui/icons'
// The left rail of the picked app look, read once per page: the files nav, the team spaces with the open one
// expanded down to the current folder, the workspace pages, then your sync devices, your storage and you.
export type Rail = { personal: string; spaces: { id: string; name: string }[]; open: { space: string; chain: string[]; folders: Map<string | null, { id: string; name: string }[]> } | null; requests: number; devices: { count: number; lastSeen: string | null }; storage: { used: number; limit: number | null } }
export async function railData(env: Bindings, s: Session, path: string): Promise<Rail> {
 const w = await who(env, s), mine = await personal(env, s)
 const spaces = (await visibleSpaces(env, w)).filter(r => r.payload.kind === 'team').map(r => ({ id: r.id, name: r.payload.name })).sort((a, b) => a.name.localeCompare(b.name))
 const parts = path.split('/'), key = parts[2] === 'items' || parts[2] === 'spaces' ? decodeURIComponent(parts[3] ?? '') : ''
 let open: Rail['open'] = null
 if (key) {
  const all = await everything(env, w), item = parts[2] === 'items' ? all.get(key) : undefined, space = item ? item.space.id : key
  if (spaces.some(x => x.id === space)) {
   const chain: string[] = []; for (let at: Entry | undefined = item; at; at = at.row.payload.parent ? all.get(at.row.payload.parent) : undefined) chain.unshift(at.row.id)
   const folders = new Map<string | null, { id: string; name: string }[]>()
   for (const e of all.values()) if (e.space.id === space && e.row.payload.type === 'folder' && !e.state.trash && e.state.role) { const p = e.row.payload.parent; folders.set(p, [...folders.get(p) ?? [], { id: e.row.id, name: e.row.payload.name }]) }
   for (const list of folders.values()) list.sort((a, b) => a.name.localeCompare(b.name))
   open = { space, chain, folders }
  }
 }
 const mineDevices = (await devices(env, s)).filter(d => d.owner === s.operator.email && !d.revokedAt)
 const lastSeen = mineDevices.map(d => d.lastSeen).filter((x): x is string => !!x).sort().at(-1) ?? null
 // Storage across every space you belong to: the bytes used, against the sum of their limits when all have one.
 let storage = { used: 0, limit: 0 as number | null }
 for (const sp of [mine, ...(await visibleSpaces(env, w)).filter(r => r.payload.kind === 'team')]) { try { const q = await storageView(env, sp); storage = { used: storage.used + q.usedBytes, limit: storage.limit === null || q.limitBytes === null ? null : storage.limit + q.limitBytes } } catch (e) { if (!(e instanceof ChestError)) throw e } }
 return { personal: mine.id, spaces, open, requests: (await pending(env, w)).length, devices: { count: mineDevices.length, lastSeen }, storage }
}
const bytes = (n: number) => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1).replace(/\.0$/, '')} MB` : n < 1099511627776 ? `${(n / 1073741824).toFixed(1).replace(/\.0$/, '')} GB` : `${(n / 1099511627776).toFixed(1).replace(/\.0$/, '')} TB`
const ago = (at: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago` }
type Link = { key: string; href: string; label: string; icon: IconName; count?: number }
const item = (l: Link, current: string, path: string) => `<li><a href="${l.href}"${l.key === current || l.href === path ? ' aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icons[l.icon]}</span><span class="nav-label">${l.label}</span>${l.count ? `<span class="nav-count">${l.count}</span>` : ''}</a></li>`
// Team spaces and their folders. Each name carries a hidden "team space" or "folder" so a tree link never shares an
// accessible name with the same space or folder in the page's own lists.
function tree(r: Rail, path: string) {
 const here = path.split('/')[3] ? decodeURIComponent(path.split('/')[3]) : ''
 const branch = (parent: string | null, depth: number): string => {
  const list = r.open!.folders.get(parent) ?? []
  return list.length ? `<ul>${list.map(f => { const expanded = r.open!.chain.includes(f.id); return `<li><a class="tree-row depth-${Math.min(depth, 4)}" href="/app/items/${esc(f.id)}"${f.id === here ? ' aria-current="page"' : ''}><span class="tree-chev${(r.open!.folders.get(f.id) ?? []).length ? '' : ' tree-leaf'}${expanded ? ' is-open' : ''}" aria-hidden="true">${icons.chevron}</span><span class="nav-icon" aria-hidden="true">${icons.folder}</span><span class="nav-label">${esc(f.name)}<span class="sr-only"> folder</span></span></a>${expanded ? branch(f.id, depth + 1) : ''}</li>` }).join('')}</ul>` : ''
 }
 return `<ul class="nav-tree">${r.spaces.map(sp => { const open = r.open?.space === sp.id; return `<li><a class="tree-row depth-0" href="/app/spaces/${esc(sp.id)}"${sp.id === here ? ' aria-current="page"' : ''}><span class="tree-chev${open ? ' is-open' : ''}" aria-hidden="true">${icons.chevron}</span><span class="nav-icon" aria-hidden="true">${icons.folder}</span><span class="nav-label">${esc(sp.name)}<span class="sr-only"> team space</span></span></a>${open ? branch(null, 1) : ''}</li>` }).join('')}</ul>`
}
// The signed-in person as every app page needs them: name, email, role and their rail.
export async function withRail(env: Bindings, s: Session, path: string) { return { name: s.operator.displayName, email: s.operator.email, role: s.operator.role, rail: await railData(env, s, path) } }
export function rail(r: Rail, me: { name: string; email: string; role: string }, current: string, path: string) {
 const files: Link[] = [
  { key: 'mine', href: `/app/spaces/${r.personal}`, label: 'My files', icon: 'folder' },
  { key: 'shared', href: '/app/shared', label: 'Shared with me', icon: 'people' },
  { key: 'recent', href: '/app/recent', label: 'Recent', icon: 'clock' },
  { key: 'starred', href: '/app/starred', label: 'Starred', icon: 'star' },
  { key: 'requests', href: '/app/requests', label: 'Requests', icon: 'inbox', count: r.requests },
  { key: 'links', href: '/app/links', label: 'Links', icon: 'link' },
  { key: 'trash', href: '/app/files/trash', label: 'Trash', icon: 'trash' },
 ]
 const more: Link[] = [
  { key: 'library', href: '/app/library', label: 'Library', icon: 'books' },
  { key: 'notices', href: '/app/notices', label: 'Notices', icon: 'bell' },
  { key: 'archive', href: '/app/move-in', label: 'Move in', icon: 'move' },
  ...(me.role === 'owner' ? [{ key: 'admin', href: '/app/admin', label: 'People &amp; settings', icon: 'people' as IconName }] : []),
  { key: 'audit', href: '/app/audit', label: 'Audit', icon: 'audit' },
  { key: 'apps', href: '/app/integrations', label: 'Connected apps', icon: 'plug' },
  { key: 'security', href: '/security', label: 'Account security', icon: 'shield' },
  { key: 'administration', href: '/app/administration', label: 'Administration', icon: 'settings' },
 ]
 const sync = r.devices.count ? `${r.devices.lastSeen ? `Synced ${ago(r.devices.lastSeen)}` : 'Not synced yet'}, ${r.devices.count} device${r.devices.count === 1 ? '' : 's'}` : 'No sync devices'
 const storage = r.storage.limit ? `<progress max="${r.storage.limit}" value="${Math.min(r.storage.used, r.storage.limit)}">${bytes(r.storage.used)}</progress><p>${bytes(r.storage.used)} of ${bytes(r.storage.limit)}</p>` : `<p>${bytes(r.storage.used)} used · no limit</p>`
 return `<nav class="app-nav" aria-label="Chest"><ul class="nav-list">${files.map(l => item(l, current, path)).join('')}</ul><p class="nav-head">Team spaces <a class="nav-add" href="/app/spaces/new" aria-label="New team space" data-tooltip="New team space">${icons.plus}</a></p>${r.spaces.length ? tree(r, path) : '<p class="nav-none">No team spaces yet.</p>'}<details class="nav-more"${more.some(l => l.key === current || l.href === path) ? ' open' : ''}><summary class="nav-head">Workspace <span class="tree-chev" aria-hidden="true">${icons.chevron}</span></summary><ul class="nav-list nav-small">${more.map(l => item(l, current, path)).join('')}</ul></details></nav>
 <div class="rail-foot"><a class="rail-sync${r.devices.count ? '' : ' is-off'}" href="/app/devices"><span class="dot" aria-hidden="true"></span>${sync}</a><div class="rail-storage" aria-label="Storage in your spaces">${storage}</div><div class="app-who">${avatar({ email: me.email, name: me.name })}<p><strong>${esc(me.name)}</strong><span class="mono">${esc(me.email)}</span></p></div><form class="app-signout" method="post" action="/app/signout"><button data-tooltip="Sign out">${icons.signout}<span class="sr-only">Sign out</span></button></form></div>`
}
