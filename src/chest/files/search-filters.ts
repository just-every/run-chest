import { insist } from '../model'
import { live, type FileVersion } from './model'
import type { Entry, Who } from './access'

export const fileTypes = ['folders','documents','spreadsheets','presentations','pdfs','images','videos','audio','archives','other'] as const
export type SearchFilters = ReturnType<typeof filters>
const values = (q: URLSearchParams, key: string) => [...new Set(q.getAll(key).flatMap(v => v.split(',')).map(v => v.trim()).filter(Boolean))]
export function filters(q: URLSearchParams) {
 const type = values(q, 'type'), owner = values(q, 'owner'), creator = values(q, 'creator'), sharedBy = values(q, 'sharedBy')
 insist(type.every(t => (fileTypes as readonly string[]).includes(t)), 'invalid_search_type')
 const versions = q.get('versions') || 'current'; insist(['current','any'].includes(versions), 'invalid_search_versions')
 const timeZone = q.get('timeZone') || 'America/New_York'
 try { new Intl.DateTimeFormat('en-US', { timeZone }).format() } catch { insist(false, 'invalid_search_timezone') }
 const date = (key: string) => { const v = q.get(key) || ''; insist(!v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'invalid_search_date'); return v }
 let modifiedFrom = date('modifiedFrom'), modifiedTo = date('modifiedTo');
 const modified = q.get('modified') || ''; insist(['','today','7','30','year','lastYear'].includes(modified), 'invalid_search_modified')
 if (modified && !modifiedFrom && !modifiedTo) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(), today = ['year','month','day'].map(t => parts.find(p => p.type === t)!.value).join('-'), year = Number(today.slice(0,4))
  modifiedTo = modified === 'lastYear' ? `${year-1}-12-31` : today
  modifiedFrom = modified === 'year' ? `${year}-01-01` : modified === 'lastYear' ? `${year-1}-01-01` : modified === 'today' ? today : new Date(Date.parse(today)- (Number(modified)-1)*86_400_000).toISOString().slice(0,10)
 } insist(!modifiedFrom || !modifiedTo || modifiedFrom <= modifiedTo, 'invalid_search_date_range')
 return { modified, type, owner, creator, sharedBy, modifiedFrom, modifiedTo, timeZone, versions, location: q.get('location') || q.get('space') || 'anywhere' }
}
// The original's byte signature and extraction format determine its category, never its filename.
export function category(v?: FileVersion, format = ''): string {
 if (!v) return 'other'
 if (/spreadsheet/i.test(format)) return 'spreadsheets'
 if (/presentation/i.test(format)) return 'presentations'
 if (/word|document/i.test(format)) return 'documents'
 if (v.mediaType === 'application/pdf') return 'pdfs'
 if (v.mediaType.startsWith('image/')) return 'images'
 if (v.mediaType.startsWith('video/')) return 'videos'
 if (v.mediaType.startsWith('audio/')) return 'audio'
 if (['application/zip','application/x-tar','application/gzip'].includes(v.mediaType)) return 'archives'
 if (v.mediaType.startsWith('text/')) {
  const lines = v.text.trim().split(/\r?\n/).slice(0,10)
  if (lines.length > 1 && [',','\t',';'].some(d => { const n = lines[0].split(d).length; return n > 1 && lines.every(l => l.split(d).length === n) })) return 'spreadsheets'
  return 'documents'
 }
 return 'other'
}
export function ancestors(e: Entry, all: Map<string, Entry>) {
 const result: Entry[] = [], seen = new Set<string>()
 for (let at: Entry | undefined = e; at && !seen.has(at.row.id); at = at.row.payload.parent ? all.get(at.row.payload.parent) : undefined) { seen.add(at.row.id); result.push(at) }
 return result
}
export function sharedBy(e: Entry, all: Map<string, Entry>, w: Who): string[] {
 const by: string[] = []
 for (const node of ancestors(e, all)) {
  by.push(...node.row.payload.grants.filter(g => w.principals.includes(g.principal) && live(g) && g.by !== w.email).map(g => g.by))
  if (node.row.payload.restricted) break
 }
 return by
}
export function matches(e: Entry, all: Map<string, Entry>, w: Who, f: SearchFilters, starred: string[], shareAuthors: string[]) {
 const p = e.row.payload, mine = e.space.payload.kind === 'personal' && e.space.payload.owner === w.email
 if (!e.state.role) return false
 if (f.location === 'trash' ? !e.state.trash || !(e.state.manager || e.state.trash.payload.trash?.by === w.email) : !!e.state.trash) return false
 const ownedBy = e.space.payload.kind === 'personal' ? e.space.payload.owner : p.filing?.owner ?? e.space.payload.owner
 const person = (v: string) => v === 'me' ? w.email : v.toLowerCase()
 if (f.owner.length && !f.owner.some(v => person(v) === ownedBy)) return false
 if (f.creator.length && !f.creator.some(v => person(v) === p.createdBy)) return false
 if (f.sharedBy.length && !f.sharedBy.some(v => shareAuthors.includes(person(v)))) return false
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:f.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(p.updatedAt)), day = ['year','month','day'].map(t => parts.find(p => p.type === t)!.value).join('-')
 if (f.modifiedFrom && day < f.modifiedFrom || f.modifiedTo && day > f.modifiedTo) return false
 if (['anywhere','trash'].includes(f.location)) return true
 if (f.location === 'personal') return mine
 if (f.location === 'shared') return !mine && shareAuthors.length > 0
 if (f.location === 'starred') return starred.includes(e.row.id)
 if (f.location === e.space.id) return true
 return ancestors(e, all).some(a => a.row.id === f.location && a.row.payload.type === 'folder' && !!a.state.role)
}
