import type { Bindings } from '../../auth.server'
import { list } from '../store'
import { maybe } from './repo'
import { everything, allowed, type Who } from './access'
import { pending } from './shares'
import type { AccessRequest, Item } from './model'
// The Access requests page. Approvers see which item each request is for. A requester sees the item's address and,
// once they can open it, its name: a request never reveals a name to someone without access (see shares.ts).
export async function requestLists(env: Bindings, w: Who) {
 const decide = await Promise.all((await pending(env, w)).map(async r => ({ id: r.id, ...r.payload, itemName: (await maybe<Item>(env, 'item', r.payload.item))?.payload.name ?? null })))
 const mine = (await list<AccessRequest>(env, 'request')).filter(r => r.payload.requester === w.email)
 const visible = mine.length ? await everything(env, w) : new Map()
 return { decide, mine: mine.map(r => { const e = visible.get(r.payload.item); return { id: r.id, item: r.payload.item, itemName: e && !e.state.trash && allowed(e, 'view') ? e.row.payload.name : null, role: r.payload.role, status: r.payload.status, at: r.payload.at, expiresAt: r.payload.expiresAt, grantedRole: r.payload.grantedRole ?? null } }) }
}
