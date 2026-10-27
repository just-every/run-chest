import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { ChestError, insist, type Row } from '../model'
import { allowed, context, demand, everything, who, type Entry } from './access'
import { addVersion, bytes, createItem, move, rename, siblings } from './items'
import { trash } from './trash'
import type { Item } from './model'
// The sync protocol a desktop or mobile client speaks with its device credential: enumerate what the person can see,
// read the ordered change journal from a cursor, hydrate original bytes (ranges allowed), and send new files, new
// versions, renames, moves and deletions. A save based on an outdated version keeps both: the remote version stays
// current and the client's bytes become a named conflict copy beside it. Every call uses current access.
const view = (e: Entry) => { const v = e.row.payload.versions.find(v => v.id === e.row.payload.current)
 return { id: e.row.id, space: e.space.id, parent: e.row.payload.parent, type: e.row.payload.type, name: e.row.payload.name, updatedAt: e.row.payload.updatedAt, role: e.state.role, download: allowed(e, 'download'), version: v ? { id: v.id, checksum: v.checksum, size: v.size, mediaType: v.mediaType, arrival: v.arrival } : null } }
const head = async (env: Bindings) => Number((await env.DB.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM chest_changes').first<{ seq: number }>())!.seq)
export async function tree(env: Bindings, s: Session, url: URL) {
 const latest = await head(env), cursor = Number(url.searchParams.get('cursor') ?? latest), after = url.searchParams.get('after') ?? '', limit = Number(url.searchParams.get('limit') ?? 500), space = url.searchParams.get('space') ?? ''
 insist(Number.isSafeInteger(cursor) && cursor >= 0 && cursor <= latest && Number.isSafeInteger(limit) && limit >= 1 && limit <= 500 && after.length <= 200 && space.length <= 200, 'invalid_cursor')
 const query = space ? env.DB.prepare("SELECT id FROM chest_records WHERE kind='item' AND json_extract(payload,'$.space')=? AND id>? ORDER BY id LIMIT ?").bind(space,after,limit+1) : env.DB.prepare("SELECT id FROM chest_records WHERE kind='item' AND id>? ORDER BY id LIMIT ?").bind(after,limit+1)
 const rows = (await query.all()).results as { id: string }[]
 const page = rows.slice(0,limit), all = await everything(env, await who(env,s), page.map(r=>r.id)), entries = page.map(r=>all.get(r.id)).filter((e): e is Entry => !!e && !!e.state.role && !e.state.trash)
 const spaces = new Map(entries.map(e => [e.space.id, { id: e.space.id, name: e.space.payload.kind === 'personal' ? (e.space.payload.owner === s.operator.email ? 'My files' : 'Shared with me') : e.space.payload.name, kind: e.space.payload.kind }]))
 return { cursor, next: rows.length > limit ? page.at(-1)!.id : null, spaces: [...spaces.values()], items: entries.map(view) }
}
export async function changes(env: Bindings, s: Session, url: URL) {
 const cursor = Number(url.searchParams.get('cursor') ?? '0'); insist(Number.isSafeInteger(cursor) && cursor >= 0, 'invalid_cursor')
 const latest = await head(env); if (cursor > latest) return { resync: true, cursor: latest, changes: [] }
 const until = Number(url.searchParams.get('until') ?? latest); insist(Number.isSafeInteger(until) && until >= cursor && until <= latest, 'invalid_cursor')
 const window = (await env.DB.prepare('SELECT item,seq,kind FROM chest_changes WHERE seq>? AND seq<=? ORDER BY seq LIMIT 501').bind(cursor,until).all()).results as { item: string; seq: number; kind: string }[]
 const consumed = window.slice(0,500), merged = new Map<string,{item:string;seq:number;kinds:string}>()
 for(const row of consumed){const previous=merged.get(row.item);merged.set(row.item,{item:row.item,seq:row.seq,kinds:previous?`${previous.kinds},${row.kind}`:row.kind})}
 const rows = [...merged.values()]
 const all = await everything(env, await who(env, s), rows.map(r=>r.item)), result = rows.map(r => {
  const e = all.get(r.item), access = r.kinds.split(',').includes('access')
  // A space's membership or settings changed (or an item went away): rescan that space, or drop the item.
  if (!e) return access && !r.kinds.includes('erase') ? { id: r.item, state: 'rescan' } : { id: r.item, state: 'removed' }
  if (!e.state.role || e.state.trash) return { id: r.item, state: 'removed' }
  return { id: r.item, state: 'present', rescan: access && e.row.payload.type === 'folder', item: view(e) }
 })
 return { cursor: consumed.length ? consumed.at(-1)!.seq : until, until, more: window.length > 500, changes: result }
}
export async function hydrate(env: Bindings, s: Session, key: string, url: URL, request: Request) {
 const item = await get<Item>(env, 'item', key), version = url.searchParams.get('version') ?? item.payload.current
 insist(version, 'not_a_file')
 return bytes(env, s, await who(env, s), key, version, true, request.headers.get('range'), 'sync.hydrate')
}
// The copy is named after the device that made it; a second copy from the same device in the same folder is numbered.
const conflictName = (name: string, device: string, taken: Set<string>) => {
 const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '', from = device.replace(/[\x00-\x1f\/\\]/g, ' ').slice(0, 60)
 for (let n = 1; ; n++) { const copy = `${stem} (conflicted copy${n > 1 ? ` ${n}` : ''} from ${from})${ext}`; if (!taken.has(copy.toLowerCase())) return copy }
}
export async function upload(env: Bindings, s: Session, key: string, request: Request) {
 const w = await who(env, s), base = request.headers.get('if-match'), body = new Uint8Array(await request.arrayBuffer()), device = (s as any).device as string
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'contribute'); insist(item.payload.type === 'file', 'not_a_file'); insist(base, 'base_version_required', 428)
 if (base === item.payload.current) return { conflict: false, item: (await addVersion(env, s, w, key, body, { device }, 'sync client')).id }
 insist(item.payload.versions.some(v => v.id === base), 'unknown_base_version', 409)
 const deviceName = (await get<{ name: string }>(env, 'device', device)).payload.name
 const copy = await createItem(env, s, w, { space: item.payload.space, parent: item.payload.parent, name: conflictName(item.payload.name, deviceName, new Set((await siblings(env, item.payload.space, item.payload.parent)).map(r => r.payload.name.toLowerCase()))), device }, 'conflict copy', body)
 return { conflict: true, current: item.payload.current, kept: copy.id }
}
export async function create(env: Bindings, s: Session, url: URL, request: Request) {
 const q = url.searchParams, type = q.get('type') === 'folder' ? 'folder' : 'file', body = type === 'file' ? new Uint8Array(await request.arrayBuffer()) : undefined
 const row = await createItem(env, s, await who(env, s), { space: q.get('space'), parent: q.get('parent'), name: q.get('name'), type, device: (s as any).device }, 'sync client', body)
 return { item: row.id, version: row.payload.current }
}
export async function relocate(env: Bindings, s: Session, key: string, url: URL) {
 const q = url.searchParams, w = await who(env, s); let row: Row<Item> | undefined
 if (q.has('name')) row = await rename(env, s, w, key, { name: q.get('name') })
 if (q.has('parent') || q.has('space')) row = await move(env, s, w, key, { space: q.get('space') ?? undefined, parent: q.get('parent') || null })
 if (!row) throw new ChestError('nothing_to_change')
 return { item: row.id, parent: row.payload.parent, name: row.payload.name }
}
export async function remove(env: Bindings, s: Session, key: string) { await trash(env, s, await who(env, s), key); return { trashed: true } }
