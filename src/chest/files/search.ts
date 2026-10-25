import type { Bindings } from '../../auth.server'
import { list } from '../store'
import { allowed, everything, type Who } from './access'
import { maybe } from './repo'
import { type Link, type Prefs } from './model'
import { hiddenMerged } from '../filing/duplicate-view'
import { textHits, type Extraction } from '../read/jobs'
import { permittedLinks } from './link-policy'
import { ancestors, category, filters, matches, sharedBy } from './search-filters'

// Access is resolved before filtering, counting, ranking or building suggestions. An index never grants access.
export async function search(env: Bindings, w: Who, url: URL) {
 const q = (url.searchParams.get('q') || '').trim().toLowerCase(), f = filters(url.searchParams), all = await everything(env,w), entries = [...all.values()], hidden = await hiddenMerged(env,w,entries)
 const read = await textHits(env,q), formats = new Map((await list<Extraction>(env,'extract')).map(r => [r.id.slice(8), r.payload.format || '']))
 const prefs = (await maybe<Prefs>(env,'prefs',`prefs:${w.email}`))?.payload, links = await permittedLinks(env,await list<Link>(env,'link'),new Map(entries.map(e => [e.row.id,e.space.id])))
 const result: any[] = [], locations = new Map<string,string>(), people = new Set<string>(), types: Record<string,number> = {}
 for (const e of entries) {
  if (!e.state.role || hidden.has(e.row.id)) continue
  const p = e.row.payload, authors = [...sharedBy(e,all,w),...links.filter(l => l.payload.item === e.row.id && (l.payload.discoverable || w.opened.includes(l.id))).map(l => l.payload.createdBy)]
  if (!e.state.trash) {
   locations.set(e.space.id, e.space.payload.kind === 'personal' ? (e.space.payload.owner === w.email ? 'My files' : 'Shared personal area') : e.space.payload.name)
   if (p.type === 'folder') locations.set(e.row.id,p.name)
   people.add(p.createdBy); people.add(e.space.payload.kind === 'personal' ? e.space.payload.owner : p.filing?.owner ?? e.space.payload.owner); authors.forEach(a => people.add(a))
  }
  if (!matches(e,all,w,f,prefs?.starred ?? [],authors)) continue
  const current = p.versions.find(v => v.id === p.current), kind = p.type === 'folder' ? 'folders' : category(current,formats.get(current?.checksum ?? ''))
  if (f.type.length && !f.type.includes(kind)) continue
  const metadata = [p.name,...(p.tags ?? []),JSON.stringify(p.filing?.fields ?? {}),p.filing?.owner ?? e.space.payload.owner,p.createdBy,p.updatedAt,...ancestors(e,all).filter(a => a.state.role).map(a => a.row.payload.name)].join(' ').toLowerCase()
  const metadataHit = !!q && metadata.includes(q), versions = f.versions === 'any' ? [current,...p.versions.slice().reverse().filter(v => v.id !== p.current)].filter(v => !!v) : current ? [current] : []
  const found = versions.find(v => v.text.toLowerCase().includes(q) || read.has(v.checksum)), version = metadataHit || !q ? current : found
  if (q && !metadataHit && !found) continue
  const at = q && version && allowed(e,'download') ? version.text.toLowerCase().indexOf(q) : -1, snippet = at >= 0 ? version!.text.slice(Math.max(0,at-24),at+q.length+80) : version && allowed(e,'download') ? read.get(version.checksum) ?? '' : ''
  const earlier = !!version && version.id !== p.current
  types[kind] = (types[kind] ?? 0) + 1
  result.push({ id:e.row.id,name:p.name,type:p.type,category:kind,role:e.state.role,updatedAt:p.updatedAt,size:version?.size ?? null,mediaType:version?.mediaType ?? null,space:{id:e.space.id,name:e.space.payload.kind === 'personal' ? e.space.payload.owner === w.email ? 'My files' : 'Shared with me' : e.space.payload.name},snippet,matchedVersion:version?.id ?? null,versionLabel:earlier ? `Earlier version ${p.versions.findIndex(v => v.id === version!.id)+1}${version!.name ? ` · ${version!.name}` : ''}` : null,rank:q ? (p.name.toLowerCase() === q ? 5 : p.name.toLowerCase().includes(q) ? 4 : metadataHit ? 3 : earlier ? 1 : 2) : 0 })
 }
 result.sort((a,b) => b.rank-a.rank || b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))
 return { q, filters:f, count:result.length, truncated:result.length>200, results:result.slice(0,200).map(({rank,...r}) => r), types, options:{locations:[...locations].map(([id,name])=>({id,name})),people:[...people].filter(Boolean).sort()} }
}
