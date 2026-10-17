import type { Bindings } from '../../auth.server'
import { insist } from '../model'
import { deviceSession } from './devices'
import { sweep } from './shares'
import { changes, create, hydrate, relocate, remove, tree, upload } from './sync'
// /api/chest/sync: device-credential routes for sync clients. No cookie or browser origin is involved.
export async function syncRoute(env: Bindings, request: Request, path: string): Promise<unknown> {
 const s = await deviceSession(env, request), url = new URL(request.url), [, , key, sub] = path.split('/').filter(Boolean), method = request.method
 await sweep(env)
 if (method === 'GET' && path === '/sync/tree') return tree(env, s)
 if (method === 'GET' && path === '/sync/changes') return changes(env, s, url)
 if (method === 'POST' && path === '/sync/items') return create(env, s, url, request)
 if (key && sub === 'content' && method === 'GET') return hydrate(env, s, key, url, request)
 if (key && sub === 'content' && method === 'PUT') return upload(env, s, key, request)
 if (key && sub === 'move' && method === 'POST') return relocate(env, s, key, url)
 if (key && !sub && method === 'DELETE') return remove(env, s, key)
 insist(false, 'not_found', 404)
}
