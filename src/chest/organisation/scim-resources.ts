import type { Bindings } from '../../auth.server'
import { id, now } from '../model'
import { tokenHash } from '../files/capability'
import { CORE, BASE, check, string, sql, assertion, transact, type Sql, type Predicate } from './scim-common'

export type ResourceType = 'User' | 'Group'
export type Resource = {
 id: string; resource_type: ResourceType; record_id: string; operator_id: string | null; external_id: string | null;
 data: any; revision: string; created_at: string; updated_at: string; deleted: number;
 record: any; record_revision: string; record_kind: string; email: string; display_name: string; role: string; status: string; operator_version: number
}
export async function load(env: Bindings, type: ResourceType, key: string): Promise<Resource> {
 const row: any = await env.DB.prepare('SELECT m.*,r.payload AS record,r.revision AS record_revision,r.kind AS record_kind,o.email,o.display_name,o.role,o.status,o.version AS operator_version FROM chest_scim_resources m JOIN chest_records r ON r.id=m.record_id LEFT JOIN oa_operators o ON o.id=m.operator_id WHERE m.id=? AND m.resource_type=? AND m.deleted=0').bind(key, type).first()
 check(row, 'Resource not found.', 404)
 return { ...row, data: JSON.parse(row.data), record: JSON.parse(row.record) }
}
export const location = (env: Bindings, type: ResourceType, key: string) => `${env.AUTH_ORIGIN.replace(/\/$/, '')}${BASE}/${type}s/${encodeURIComponent(key)}`
export async function representation(env: Bindings, row: Resource) {
 let attributes: any
 if (row.resource_type === 'User') {
  attributes = { ...row.data, roles: row.data.roles ?? [], userName: row.email, displayName: row.display_name, active: row.status === 'active', emails: [{ value: row.email, type: 'work', primary: true }] }
 } else {
  const emails: string[] = row.record.members ?? []
  const members = emails.length ? (await env.DB.prepare("SELECT m.id,o.email FROM chest_scim_resources m JOIN oa_operators o ON o.id=m.operator_id WHERE m.resource_type='User' AND m.deleted=0 AND o.email IN (SELECT value FROM json_each(?)) ORDER BY m.id").bind(JSON.stringify(emails)).all()).results as any[] : []
  attributes = { ...row.data, displayName: row.record.name, members: members.map(m => ({ value: m.id, $ref: location(env, 'User', m.id), display: m.email })) }
 }
 const version = `W/"${await tokenHash(JSON.stringify([row.revision, row.record_revision, row.operator_version, attributes]))}"`
 return { schemas: [CORE + row.resource_type], ...attributes, id: row.id, ...(row.external_id ? { externalId: row.external_id } : {}), meta: { resourceType: row.resource_type, created: row.created_at, lastModified: row.updated_at, location: location(env, row.resource_type, row.id), version } }
}
function email(value: unknown) {
 const result = string(value, 'userName', 254).toLowerCase()
 check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) && !result.endsWith('@dev.localhost'), 'userName must be a staff email address.')
 return result
}
function providerRoles(value: unknown): { value: string; primary?: boolean }[] {
 if (value === undefined) return []
 check(Array.isArray(value) && value.length <= 20, 'roles must contain at most 20 provider labels.')
 const roles = value.map(role => {
  check(role && typeof role === 'object' && !Array.isArray(role), 'Each role must be an object.')
  check(role.primary === undefined || typeof role.primary === 'boolean', 'Role primary must be a boolean.')
  return { value: string(role.value, 'role value', 100), ...(role.primary !== undefined ? { primary: role.primary } : {}) }
 })
 check(roles.filter(role => role.primary === true).length <= 1, 'Only one provider role may be primary.')
 return roles
}
function userData(input: any, previous?: Resource) {
 const userName = email(input.userName)
 if (previous) check(userName === previous.email, 'Changing userName or email would change existing file permissions. Create a separate identity instead.', 400, 'mutability')
 check(input.active === undefined || typeof input.active === 'boolean', 'active must be a boolean.')
 if (input.emails !== undefined) {
  check(Array.isArray(input.emails) && input.emails.length <= 5 && input.emails.every((e: any) => e && email(e.value) === userName), 'Email aliases and email renames are not supported.', 400, 'mutability')
 }
 let name: any
 if (input.name !== undefined) {
  check(input.name && typeof input.name === 'object' && !Array.isArray(input.name), 'Invalid name.')
  name = Object.fromEntries(['givenName', 'familyName', 'formatted', 'middleName', 'honorificPrefix', 'honorificSuffix'].filter(k => input.name[k] !== undefined).map(k => [k, string(input.name[k], k, 200, true)]))
 }
 // Provider role labels stay in the SCIM document; only the owner controls actual Chest roles and ACLs.
 return { userName, displayName: string(input.displayName ?? name?.formatted ?? ([name?.givenName, name?.familyName].filter(Boolean).join(' ') || userName), 'displayName', 200), active: input.active ?? true, roles: providerRoles(input.roles), ...(name ? { name } : {}) }
}
async function groupData(env: Bindings, input: any) {
 check(input.active === undefined || typeof input.active === 'boolean', 'active must be a boolean.')
 const members = input.members ?? []
 check(Array.isArray(members) && members.length <= 200, 'A group supports at most 200 members.')
 const keys = [...new Set<string>(members.map((m: any) => string(m?.value, 'member value', 100)))]
 const rows = keys.length ? (await env.DB.prepare("SELECT m.id,o.email FROM chest_scim_resources m JOIN oa_operators o ON o.id=m.operator_id WHERE m.resource_type='User' AND m.deleted=0 AND m.id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(keys)).all()).results as any[] : []
 check(rows.length === keys.length, 'Every group member must reference a provisioned User.')
 return { data: { displayName: string(input.displayName, 'displayName', 200), active: input.active ?? true, members: keys.map(value => ({ value })) }, emails: rows.map(r => r.email), identities: rows.map(r => ({ id: r.id, email: r.email })), keys }
}
function fences(row: Resource): Sql[] {
 const guards = [assertion({ sql: 'EXISTS(SELECT 1 FROM chest_scim_resources WHERE id=? AND revision=? AND deleted=0)', params: [row.id, row.revision] }), assertion({ sql: 'EXISTS(SELECT 1 FROM chest_records WHERE id=? AND kind=? AND revision=?)', params: [row.record_id, row.record_kind, row.record_revision] })]
 if (row.resource_type === 'User') guards.push(assertion({ sql: "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND status=? AND display_name=? AND role!='owner')", params: [row.operator_id, row.email, row.operator_version, row.status, row.display_name] }))
 return guards
}
export async function saveResource(env: Bindings, auth: { predicate: Predicate; actor: string }, type: ResourceType, input: any, previous?: Resource, deleted = false): Promise<Resource> {
 const key = previous?.id ?? id(), at = now(), revision = id(), statements: Sql[] = previous ? fences(previous) : []
 const external = string(input.externalId, 'externalId', 255, true) || null
 const recordKey = previous?.record_id ?? (type === 'User' ? email(input.userName) : `group:${key}`)
 let data: any, payload: any, operator = previous?.operator_id ?? (type === 'User' ? id() : null)
 if (type === 'User') {
  if (previous) check(previous.role !== 'owner' && previous.record_kind === 'person' && previous.email === previous.record_id, 'This identity cannot be changed through provisioning.', 403, 'mutability')
  data = userData(input, previous); if (deleted) data.active = false
  const status = data.active ? 'active' : 'inactive'
  payload = { email: data.userName, name: data.displayName, role: previous?.role ?? 'member', status, development: false }
  if (previous) statements.push(sql('UPDATE oa_operators SET display_name=?,status=? WHERE id=?', data.displayName, status, operator))
  else statements.push(
   assertion({ sql: "NOT EXISTS(SELECT 1 FROM oa_operators WHERE lower(email)=?) AND NOT EXISTS(SELECT 1 FROM chest_records WHERE kind='person' AND (lower(id)=? OR lower(json_extract(payload,'$.email'))=?))", params: [data.userName, data.userName, data.userName] }),
   sql("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,?,?,'member',?,?)", operator, data.userName, data.displayName, status, Date.now())
  )
  if (previous && !data.active) statements.push(
   sql('UPDATE chest_device_credentials SET revoked_at=COALESCE(revoked_at,?) WHERE email=?', at, previous.email),
   sql("UPDATE chest_records SET payload=json_set(payload,'$.revokedAt',?,'$.revokedBy',?),revision=? WHERE kind='device' AND json_extract(payload,'$.owner')=? AND json_extract(payload,'$.revokedAt') IS NULL", at, auth.actor, revision, previous.email)
  )
 } else {
  if (previous) check(previous.record_kind === 'group', 'This group cannot be changed through provisioning.', 403, 'mutability')
  const group = await groupData(env, input); data = group.data; if (deleted) data.active = false
  statements.push(assertion({ sql: "(SELECT COUNT(*) FROM chest_scim_resources m JOIN oa_operators o ON o.id=m.operator_id JOIN json_each(?) j ON m.id=json_extract(j.value,'$.id') AND o.email=json_extract(j.value,'$.email') WHERE m.resource_type='User' AND m.deleted=0 AND m.record_id=o.email)=?", params: [JSON.stringify(group.identities), group.keys.length] }))
  payload = { name: data.displayName, members: data.active ? group.emails : [] }
 }
 if (previous) statements.push(
  sql('UPDATE chest_records SET payload=?,revision=? WHERE id=?', JSON.stringify(payload), revision, recordKey),
  sql('UPDATE chest_scim_resources SET external_id=?,data=?,revision=?,updated_at=?,deleted=? WHERE id=?', external, JSON.stringify(data), revision, at, Number(deleted), key)
 )
 else statements.push(
  sql('INSERT INTO chest_records(id,kind,payload,revision) VALUES(?,?,?,?)', recordKey, type === 'User' ? 'person' : 'group', JSON.stringify(payload), revision),
  sql('INSERT INTO chest_scim_resources(id,resource_type,record_id,operator_id,external_id,data,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', key, type, recordKey, operator, external, JSON.stringify(data), revision, at, at)
 )
 await transact(env, auth.predicate, statements, `scim.${type.toLowerCase()}.${deleted ? 'delete' : previous ? 'update' : 'create'}`, key, auth.actor)
 // DELETE leaves an identity reservation and its person record; old grants never attach to a replacement account.
 if (deleted) return { ...previous!, data, deleted: 1, revision }
 return load(env, type, key)
}
