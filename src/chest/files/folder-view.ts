import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import type { Person } from '../model'
import { everything, type Entry, type Who } from './access'
import { linkState } from './public-links'
import { notices } from './shares'
import { linksView } from './exposure'
import { proposals } from '../filing/duplicate-proposals'
import type { Report } from '../sync-repair/model'
import type { Device } from './devices'
import { live, type Item, type PublicLink } from './model'
// The folder browser's read model, beside the item and space views: for each row its sync state, who changed it,
// its sharing and its version; the sync conflicts in the folder; and what the Chest agent did and found. Every
// figure comes from records the person can already see on their own pages (Sync devices, Links, Duplicates,
// Notices); nothing here grants access or acts.
export type Sync = 'synced' | 'syncing' | 'conflict' | 'paused' | 'failed' | 'cloud'
export type Row = { id: string; name: string; type: 'file' | 'folder'; updatedAt: string; size: number | null; by: { email: string; name: string } | null; version: number; approval: 'approved' | 'in review' | null; pending: number | null; sharing: { people: { email: string; name: string }[]; link: { expires: string | null } | null }; sync: Sync; syncNote: string }
export type Copy = { item: string; device: string; at: string; size: number; by: string }
export type Conflict = { original: Copy & { name: string }; copy: Copy & { name: string }; keepBothName: string }
export type Agent = { filedToday: number; latest: { message: string; item: string | null; undo: string | null } | null; duplicates: { name: string; count: number } | null; external: { name: string; item: string } | null }

const conflictName = /^(.*) \(conflicted copy(?: \d+)? from (.+)\)(\.[^.]*)?$/
export const personName = (people: Map<string, string>, email: string) => people.get(email) ?? email
const states: Record<string, Sync> = { 'up-to-date': 'synced', queued: 'syncing', conflicted: 'conflict', paused: 'paused', failed: 'failed' }

export async function folderRows(env: Bindings, s: Session, w: Who, space: string, parent: string | null, ids: string[]) {
 const all = await everything(env, w), people = new Map((await list<Person>(env, 'person')).map(p => [p.id, p.payload.name]))
 const devices = new Map((await list<Device>(env, 'device')).map(d => [d.id, d.payload.name]))
 const links = (await list<PublicLink>(env, 'public-link')).filter(l => ids.includes(l.payload.item) && linkState(l.payload) === 'active')
 // The person's own companions report each file they hold; the newest report for a file wins.
 const reported = new Map<string, { state: string; device: string; at: string }>()
 for (const r of (await list<Report>(env, 'sync-report')).filter(r => r.payload.owner === s.operator.email).sort((a, b) => a.payload.at.localeCompare(b.payload.at)))
  for (const f of r.payload.files) reported.set(f.item, { state: f.state, device: devices.get(r.payload.device) ?? 'a device', at: r.payload.at })
 const entries = ids.map(id => all.get(id)).filter((e): e is Entry => !!e)
 const siblings = new Map(entries.map(e => [e.row.payload.name.toLowerCase(), e]))
 const conflicts: Conflict[] = [], copies = new Set<string>(), originals = new Set<string>()
 const copyOf = (e: Entry, fallbackDevice: string): Copy => { const v = e.row.payload.versions.find(v => v.id === e.row.payload.current)!; return { item: e.row.id, device: v.device ? devices.get(v.device) ?? fallbackDevice : fallbackDevice, at: v.at, size: v.size, by: personName(people, v.actor) } }
 for (const e of entries) {
  const m = conflictName.exec(e.row.payload.name), original = m && siblings.get(`${m[1]}${m[3] ?? ''}`.toLowerCase())
  if (!m || !original || original.row.payload.type !== 'file' || e.row.payload.versions.at(-1)?.arrival !== 'conflict copy') continue
  copies.add(e.row.id); originals.add(original.row.id)
  const keep = copyOf(original, 'Chest on the web'), copy = copyOf(e, m[2])
  conflicts.push({ original: { ...keep, device: keep.device === 'Chest on the web' ? `${keep.by} on the web` : keep.device, name: original.row.payload.name }, copy: { ...copy, name: e.row.payload.name }, keepBothName: `${m[1]} (${m[2]})${m[3] ?? ''}` })
 }
 const rows: Row[] = entries.map(e => {
  const p: Item = e.row.payload, v = p.versions.find(v => v.id === p.current), report = reported.get(e.row.id)
  // The chip names the current version (numbered oldest first) with its own state, and a newer version waiting for
  // review beside it, so a reviewer never reads a pending version as approved.
  const newest = p.versions.at(-1), pending = newest && newest.id !== p.current && newest.review?.state === 'submitted' ? p.versions.length : null
  const members = p.restricted ? [] : e.space.payload.members.filter(m => live(m) && people.has(m.principal)).map(m => m.principal)
  const share = [...new Set([...members, ...p.grants.filter(g => live(g) && people.has(g.principal)).map(g => g.principal)])].map(email => ({ email, name: personName(people, email) }))
  const link = links.filter(l => l.payload.item === e.row.id).sort((a, b) => (a.payload.expires ?? '9').localeCompare(b.payload.expires ?? '9'))[0]
  const sync: Sync = originals.has(e.row.id) || copies.has(e.row.id) ? 'conflict' : report ? states[report.state] ?? 'syncing' : 'cloud'
  const syncNote = originals.has(e.row.id) || copies.has(e.row.id) ? 'Edited on two devices; both copies are kept' : report ? `As ${report.device} last reported` : 'In Chest; no sync device holds a copy'
  return { id: e.row.id, name: p.name, type: p.type, updatedAt: p.updatedAt, size: v?.size ?? null, by: v ? { email: v.actor, name: personName(people, v.actor) } : { email: p.createdBy, name: personName(people, p.createdBy) }, version: p.versions.findIndex(x => x.id === p.current) + 1, approval: p.approved && p.approved === p.current ? 'approved' : v?.review?.state === 'submitted' ? 'in review' : null, pending, sharing: { people: share, link: link ? { expires: link.payload.expires } : null }, sync, syncNote }
 })
 return { rows, conflicts }
}

// The agent strip: the person's filing notices from the last day (newest first, with Undo while it still applies),
// duplicate proposals that involve this folder's files, and links on its files that are open outside the team.
export async function agentStrip(env: Bindings, s: Session, w: Who, ids: string[]): Promise<Agent> {
 const since = Date.now() - 86_400_000, filed = (await notices(env, w)).filter(n => n.payload.type === 'filing' && Date.parse(n.payload.at) >= since) as any[]
 const found = ((await proposals(env, s, w, new URL('https://chest.invalid/'))).proposals as any[]).filter(p => ids.includes(p.keep.id) || ids.includes(p.duplicate.id))
 // Each file here with copies elsewhere, named by the copy in this folder (or the first of the pair).
 const named = new Map<string, number>(); for (const p of found) { const here = ids.includes(p.keep.id) ? p.keep : p.duplicate; named.set(here.name, (named.get(here.name) ?? 0) + 1) }
 const top = [...named.entries()].sort((a, b) => b[1] - a[1])[0]
 // The widest-open link here: the one with the most reasons it reaches too far.
 const reach = (x: { links: { reasons: string[] }[] }) => Math.max(...x.links.map(l => l.reasons.length))
 const wide = (await linksView(env, s, w)).wide.filter(x => ids.includes(x.item) && x.links.some(l => l.audience !== 'organisation')).sort((a, b) => reach(b) - reach(a))[0]
 const latest = filed[0]
 return { filedToday: filed.length, latest: latest ? { message: latest.payload.message, item: latest.payload.item, undo: latest.canUndo ? latest.payload.undo : null } : null, duplicates: top ? { name: top[0], count: top[1] } : null, external: wide ? { name: wide.name, item: wide.item } : null }
}
