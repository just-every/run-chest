import { API, CORE, check, ScimError } from './scim-common'
import type { ResourceType } from './scim-resources'

const names: Record<string, string> = { username: 'userName', displayname: 'displayName', externalid: 'externalId', active: 'active', name: 'name', emails: 'emails', roles: 'roles', members: 'members' }
const subNames: Record<string, string> = { givenname: 'givenName', familyname: 'familyName', formatted: 'formatted', middlename: 'middleName', honorificprefix: 'honorificPrefix', honorificsuffix: 'honorificSuffix' }
export function patch(type: ResourceType, current: any, input: any) {
 check(Array.isArray(input.schemas) && input.schemas.includes(API + 'PatchOp'), 'The PatchOp schema is required.', 400, 'invalidSyntax')
 check(Array.isArray(input.Operations) && input.Operations.length > 0 && input.Operations.length <= 50, 'Supply between 1 and 50 patch operations.', 400, 'invalidSyntax')
 const result = structuredClone(current)
 const apply = (raw: string, operation: string, value: any) => {
  const path = raw.replace(new RegExp(`^${CORE}${type}:`, 'i'), '')
  const selected = /^members\[value\s+eq\s+("(?:[^"\\]|\\.)*")\]$/i.exec(path)
  if (selected) {
   check(type === 'Group' && operation === 'remove', 'Only removal by member value is supported.', 400, 'invalidPath')
   let key: string; try { key = JSON.parse(selected[1]) } catch { throw new ScimError(400, 'Invalid member filter.', 'invalidFilter') }
   result.members = (result.members ?? []).filter((m: any) => m.value !== key); return
  }
  const pieces = path.toLowerCase().split('.'), field = Object.hasOwn(names, pieces[0]) ? names[pieces[0]] : undefined
  check(field && (type === 'User' ? field !== 'members' : ['displayName', 'externalId', 'active', 'members'].includes(field)), 'The patch path is unsupported or read-only.', 400, 'invalidPath')
  if (pieces.length > 1) {
   const sub = Object.hasOwn(subNames, pieces[1]) ? subNames[pieces[1]] : undefined
   check(pieces.length === 2 && field === 'name' && sub, 'Unsupported attribute path.', 400, 'invalidPath')
   result.name = { ...(result.name ?? {}) }; if (operation === 'remove') delete result.name[sub]; else result.name[sub] = value
  } else if (operation === 'remove') delete result[field]
  else if ((field === 'members' || field === 'roles') && operation === 'add') {
   check(Array.isArray(value), `${field} must be an array.`)
   result[field] = [...(result[field] ?? []), ...value]
  } else if (field === 'name' && operation === 'add') {
   check(value && typeof value === 'object' && !Array.isArray(value), 'name must be an object.')
   result.name = { ...(result.name ?? {}), ...value }
  } else result[field] = value
 }
 for (const item of input.Operations) {
  check(item && typeof item.op === 'string', 'Invalid patch operation.', 400, 'invalidSyntax')
  const operation = item.op.toLowerCase(); check(['add', 'replace', 'remove'].includes(operation), 'Invalid patch operation.', 400, 'invalidSyntax')
  if (item.path === undefined || item.path === '') {
   check(operation !== 'remove' && item.value && typeof item.value === 'object' && !Array.isArray(item.value), 'A path or attribute object is required.', 400, 'invalidSyntax')
   for (const [key, value] of Object.entries(item.value)) apply(key, operation, value)
  } else { check(typeof item.path === 'string' && item.path.length <= 400, 'Invalid patch path.', 400, 'invalidPath'); apply(item.path, operation, item.value) }
 }
 return result
}
