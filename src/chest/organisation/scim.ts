import type { Bindings } from '../../auth.server'
import { runtimeBindings } from '../../auth.server'
import { BASE, CORE, body, check, integer, page, reply, failure, ScimError } from './scim-common'
import { scimAuthority } from './scim-tokens'
import { load, saveResource, representation, location, type ResourceType } from './scim-resources'
import { discovery } from './scim-discovery'
import { patch } from './scim-patch'
export { issueScimToken, revokeScimToken, scimView } from './scim-tokens'

function filter(type: ResourceType, raw: string | null): { clause: string; params: unknown[] } {
 if (!raw) return { clause: '', params: [] }
 check(raw.length <= 700, 'The filter is too long.', 400, 'invalidFilter')
 const match = /^\s*(userName|externalId|displayName)\s+eq\s+("(?:[^"\\]|\\.)*")\s*$/i.exec(raw)
 check(match, 'Supported filters are userName eq, externalId eq, and group displayName eq.', 400, 'invalidFilter')
 const field = match[1].toLowerCase(); let value: string
 try { value = JSON.parse(match[2]) } catch { throw new ScimError(400, 'Invalid filter string.', 'invalidFilter') }
 if (field === 'externalid') return { clause: ' AND m.external_id=?', params: [value] }
 check((type === 'User' && field === 'username') || (type === 'Group' && field === 'displayname'), 'Unsupported filter attribute.', 400, 'invalidFilter')
 return { clause: type === 'User' ? ' AND lower(o.email)=lower(?)' : " AND lower(json_extract(r.payload,'$.name'))=lower(?)", params: [value] }
}
async function collection(env: Bindings, type: ResourceType, url: URL) {
 const start = integer(url.searchParams.get('startIndex'), 1, 1, 2_147_483_647), count = Math.min(integer(url.searchParams.get('count'), 100, 0, 2_147_483_647), 200), f = filter(type, url.searchParams.get('filter'))
 const from = `FROM chest_scim_resources m JOIN chest_records r ON r.id=m.record_id LEFT JOIN oa_operators o ON o.id=m.operator_id WHERE m.resource_type=? AND m.deleted=0${f.clause}`
 const total: any = await env.DB.prepare(`SELECT COUNT(*) AS total ${from}`).bind(type, ...f.params).first()
 const rows = (await env.DB.prepare(`SELECT m.id ${from} ORDER BY m.id LIMIT ? OFFSET ?`).bind(type, ...f.params, count, start - 1).all()).results as any[]
 const resources = []; for (const row of rows) resources.push(await representation(env, await load(env, type, row.id)))
 return reply(page(resources, total.total, start))
}
export async function scimResponse(request: Request, original: Bindings): Promise<Response | null> {
 const url = new URL(request.url)
 if (url.pathname !== BASE && !url.pathname.startsWith(BASE + '/')) return null
 const env = runtimeBindings(original)
 try {
  check(url.pathname.length <= 1500 && url.search.length <= 2000, 'The request URL is too long.', 414)
  // Browser cookies and Origin have no bearing on this server-to-server authority.
  const auth = await scimAuthority(env, request)
  let path: string[]; try { path = url.pathname.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent) } catch { throw new ScimError(400, 'Invalid URL encoding.', 'invalidSyntax') }
  const discovered = discovery(path, request.method); if (discovered) return discovered
  check(path.length >= 1 && path.length <= 2 && ['Users', 'Groups'].includes(path[0]), 'Endpoint not found.', 404)
  const type: ResourceType = path[0] === 'Users' ? 'User' : 'Group', key = path[1]
  if (!key && request.method === 'GET') return await collection(env, type, url)
  if (!key) check(request.method === 'POST', 'This collection accepts GET and POST.', 405)
  else check(['GET', 'PUT', 'PATCH', 'DELETE'].includes(request.method), 'This resource accepts GET, PUT, PATCH and DELETE.', 405)
  const previous = key ? await load(env, type, key) : undefined
  const current = previous ? await representation(env, previous) : undefined
  if (current && request.method === 'GET') return reply(current, 200, { etag: current.meta.version })
  if (current && request.headers.has('if-match')) check(request.headers.get('if-match') === current.meta.version || request.headers.get('if-match') === '*', 'The resource has changed.', 412)
  let input: any
  if (request.method === 'DELETE') input = { ...previous!.data, ...(type === 'User' ? { userName: previous!.email, displayName: previous!.display_name } : { displayName: previous!.record.name, members: [] }), externalId: previous!.external_id }
  else {
   input = await body(request)
   if (request.method === 'PATCH') {
    const current: any = await representation(env, previous!)
    // An inactive group's provisioned members are retained separately from its empty effective ACL membership.
    if (type === 'Group' && previous!.data.active === false) current.members = previous!.data.members
    input = patch(type, current, input)
   } else check(Array.isArray(input.schemas) && input.schemas.includes(CORE + type), 'The resource schema is required.', 400, 'invalidSyntax')
  }
  const saved = await saveResource(env, auth, type, input, previous, request.method === 'DELETE')
  if (request.method === 'DELETE') return reply(null, 204)
  const resource = await representation(env, saved)
  return reply(resource, previous ? 200 : 201, { location: location(env, type, saved.id), etag: resource.meta.version })
 } catch (error) { return failure(error) }
}
