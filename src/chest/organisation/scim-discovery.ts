import { BASE, CORE, page, reply, check } from './scim-common'

const attribute = (name: string, type = 'string', extra: Record<string, any> = {}) => ({ name, type, multiValued: false, description: name, required: false, caseExact: false, mutability: 'readWrite', returned: 'default', uniqueness: 'none', ...extra })
const schemas = [
 { schemas: [CORE + 'Schema'], id: CORE + 'User', name: 'User', description: 'A provisioned Chest staff identity. userName and emails are immutable email identities. Provider role labels do not grant Chest roles or file access.', attributes: [
  attribute('userName', 'string', { required: true, uniqueness: 'server', mutability: 'immutable' }), attribute('externalId', 'string', { caseExact: true, uniqueness: 'server' }), attribute('displayName'), attribute('active', 'boolean'),
  attribute('name', 'complex', { subAttributes: ['givenName', 'familyName', 'formatted', 'middleName', 'honorificPrefix', 'honorificSuffix'].map(name => attribute(name)) }),
  attribute('emails', 'complex', { multiValued: true, mutability: 'immutable', subAttributes: [attribute('value'), attribute('type'), attribute('primary', 'boolean')] }),
  attribute('roles', 'complex', { multiValued: true, description: 'Provider application labels only; these never grant Chest roles or permissions.', subAttributes: [attribute('value', 'string', { required: true, caseExact: true }), attribute('primary', 'boolean')] })
 ] },
 { schemas: [CORE + 'Schema'], id: CORE + 'Group', name: 'Group', description: 'A Chest group. Setting active=false empties its effective membership while retaining provisioned members for reactivation.', attributes: [
  attribute('displayName', 'string', { required: true }), attribute('externalId', 'string', { caseExact: true, uniqueness: 'server' }), attribute('active', 'boolean'),
  attribute('members', 'complex', { multiValued: true, subAttributes: [attribute('value', 'string', { required: true, caseExact: true }), attribute('$ref', 'reference', { referenceTypes: ['User'], mutability: 'readOnly' }), attribute('display', 'string', { mutability: 'readOnly' })] })
 ] }
]
const resourceTypes = ['User', 'Group'].map(name => ({ schemas: [CORE + 'ResourceType'], id: name, name, endpoint: '/' + name + 's', schema: CORE + name, schemaExtensions: [] }))
export function discovery(path: string[], method: string): Response | null {
 if (!['ServiceProviderConfig', 'ResourceTypes', 'Schemas'].includes(path[0])) return null
 check(method === 'GET', 'This discovery endpoint is read-only.', 405)
 if (path[0] === 'ServiceProviderConfig') {
  check(path.length === 1, 'Resource not found.', 404)
  return reply({ schemas: [CORE + 'ServiceProviderConfig'], patch: { supported: true }, bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 }, filter: { supported: true, maxResults: 200 }, changePassword: { supported: false }, sort: { supported: false }, etag: { supported: true }, authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Owner-issued provisioning token', description: 'An installation-local bearer credential issued and revoked by the owner.', primary: true }] })
 }
 const values = path[0] === 'Schemas' ? schemas : resourceTypes
 if (path.length === 1) return reply(page(values))
 check(path.length === 2, 'Resource not found.', 404)
 const resource = values.find(r => r.id === path[1]); check(resource, 'Resource not found.', 404)
 return reply(resource)
}
