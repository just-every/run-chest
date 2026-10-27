import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, text, type Group, type Row } from '../model'
import { decode, sessionPredicate } from '../store'
import { commit, fresh, next } from '../files/repo'

export const adminPrivileges = ['user-management', 'help-desk', 'sharing-security', 'service-settings', 'content-recovery', 'audit-reporting'] as const
export type AdminPrivilege = typeof adminPrivileges[number]
export type AdminRoleDefinition = { name: string; privileges: AdminPrivilege[] }
export type AdminGrant = { email: string; role: string; super: boolean; scope: 'organization' | 'groups'; groups: string[] }
type Predicate = { sql: string; params: unknown[] }
type GuardedSession = Session & { predicate?: Predicate }
type Operator = { id: string; email: string; role: string; status: string; version: number }
type Authority = { rows: Row[]; operators: Operator[]; definitions: Row<AdminRoleDefinition>[]; grants: Row<AdminGrant>[]; groups: Row<Group>[] }
const kinds = "'admin-role-definition','admin-grant','group'"
const builtins: Row<AdminRoleDefinition>[] = adminPrivileges.map(privilege => ({ id: privilege, kind: 'admin-role-definition', revision: 'builtin', payload: { name: privilege, privileges: [privilege] } }))
const validPrivilege = (value: unknown): value is AdminPrivilege => adminPrivileges.includes(value as AdminPrivilege)
const conjunction = (...parts: Predicate[]): Predicate => ({ sql: parts.map(p => `(${p.sql})`).join(' AND '), params: parts.flatMap(p => p.params) })
const attached=new WeakMap<Session,Set<string>>()
function attach(s: Session, predicate: Predicate) {
 const key=JSON.stringify(predicate),seen=attached.get(s)??new Set<string>();if(seen.has(key))return;seen.add(key);attached.set(s,seen)
 const current = sessionPredicate(s)
 ;(s as GuardedSession).predicate = conjunction(current, predicate)
}
async function authority(env: Bindings): Promise<Authority> {
 const [records, identities] = await Promise.all([
  env.DB.prepare(`SELECT * FROM chest_records WHERE kind IN (${kinds}) ORDER BY id`).all(),
  env.DB.prepare('SELECT id,email,role,status,version FROM oa_operators ORDER BY id').all<Operator>(),
 ])
 const rows = records.results.map(decode)
 return { rows, operators: identities.results, definitions: [...builtins, ...rows.filter(r => r.kind === 'admin-role-definition')], grants: rows.filter(r => r.kind === 'admin-grant'), groups: rows.filter(r => r.kind === 'group') }
}
// Fence the exact sets, including absence: an inserted grant, definition, group or identity must also invalidate
// a decision. The predicates travel with the session into the caller's existing atomic commit.
function fence(state: Authority): Predicate {
 const records = JSON.stringify(state.rows.map(r => ({ ...r, payload: JSON.stringify(r.payload) })))
 return conjunction({ sql: `(SELECT COUNT(*) FROM chest_records WHERE kind IN (${kinds}))=? AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE r.kind IN (${kinds}) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND r.kind=json_extract(j.value,'$.kind') AND r.payload=json_extract(j.value,'$.payload') AND r.revision=json_extract(j.value,'$.revision')))`, params: [state.rows.length, records] },
  { sql: `(SELECT COUNT(*) FROM oa_operators)=? AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE o.id=json_extract(j.value,'$.id') AND o.email=json_extract(j.value,'$.email') AND o.role=json_extract(j.value,'$.role') AND o.status=json_extract(j.value,'$.status') AND o.version=json_extract(j.value,'$.version')))`, params: [state.operators.length, JSON.stringify(state.operators)] })
}
function actor(state: Authority, s: Session) {
 return state.operators.find(o => o.id === s.operator.id && o.email === s.operator.email && o.status === 'active' && o.version === s.operator.version)
}
function isSuper(state: Authority, email: string) {
 return state.operators.some(o => o.email === email && o.status === 'active' && (o.role === 'owner' || state.grants.some(g => g.payload.email === email && g.payload.super === true)))
}
function permitted(state: Authority, s: Session, privilege?: AdminPrivilege, targetEmail?: string) {
 const operator = actor(state, s)
 if (!operator) return false
 if (operator.role === 'owner' || isSuper(state, operator.email)) return true
 if (!privilege) return false
 return state.grants.some(({ payload: grant }) => {
  if (grant.email !== operator.email || grant.super !== false) return false
  const definition = state.definitions.find(d => d.id === grant.role)
  if (!definition || !definition.payload.privileges.includes(privilege)) return false
  if (grant.scope === 'organization') return true
  return !!targetEmail && grant.scope === 'groups' && state.groups.some(g => grant.groups.includes(g.id) && g.payload.members.includes(targetEmail))
 })
}
async function current(env: Bindings, s: Session, state: Authority) {
 const predicate = conjunction(sessionPredicate(s), fence(state))
 return !!await env.DB.prepare(`SELECT 1 WHERE (${predicate.sql})`).bind(...predicate.params).first()
}
// These checks are asynchronous because only the persisted authority is authoritative; OA's 'admin' role
// never supplies administrative privileges or content access.
export async function canAdmin(env: Bindings, s: Session, privilege: AdminPrivilege, targetEmail?: string): Promise<boolean> {
 if (!validPrivilege(privilege)) return false
 const state = await authority(env)
 return permitted(state, s, privilege, targetEmail) && await current(env, s, state)
}
// A read may decide many scopes against one authority snapshot, but may return
// its result only while that exact authority and the actor's session remain live.
export async function withAdministrativePermissions<T>(env: Bindings, s: Session, read: (can: (privilege: AdminPrivilege, targetEmail?: string) => boolean) => Promise<T>): Promise<T> {
 const state = await authority(env)
 insist(await current(env, s, state), 'admin_required', 403)
 const result = await read((privilege, targetEmail) => validPrivilege(privilege) && permitted(state, s, privilege, targetEmail))
 insist(await current(env, s, state), 'admin_required', 403)
 return result
}
export async function requireAdmin(env: Bindings, s: Session, privilege: AdminPrivilege, targetEmail?: string) {
 insist(validPrivilege(privilege), 'invalid_admin_privilege')
 const state = await authority(env)
 insist(permitted(state, s, privilege, targetEmail) && await current(env, s, state), 'admin_required', 403)
 attach(s, fence(state))
}
async function requireManager(env: Bindings, s: Session, state: Authority, ownerOnly = false) {
 insist(permitted(state, s) && (!ownerOnly || actor(state, s)?.role === 'owner') && await current(env, s, state), ownerOnly ? 'owner_required' : 'super_admin_required', 403)
 attach(s, fence(state))
}
export async function adminView(env: Bindings, s: Session) {
 const state = await authority(env)
 await requireManager(env, s, state)
 const activeSuperCount = state.operators.filter(o => isSuper(state, o.email)).length
 await commit(env, s, [], { audits: [{ action: 'admin.roles.view', object: 'organization', detail: { activeSuperCount } }] })
 return { definitions: state.definitions, grants: state.grants, activeSuperCount, warning: activeSuperCount < 2 ? 'Add another super admin to protect access to administration.' : null }
}
function privileges(value: unknown): AdminPrivilege[] {
 insist(Array.isArray(value) && value.length > 0 && value.every(validPrivilege), 'invalid_admin_privileges')
 return [...new Set(value)]
}
function activeTarget(state: Authority, value: unknown): Operator {
 const email = text(value, 'email', 254).toLowerCase()
 const target = state.operators.find(o => o.email === email && o.status === 'active')
 insist(target, 'active_identity_required')
 return target
}
function remainingSuper(state: Authority, omitGrant?: string, omitEmail?: string) {
 return state.operators.some(o => o.email !== omitEmail && o.status === 'active' && (o.role === 'owner' || state.grants.some(g => g.id !== omitGrant && g.payload.email === o.email && g.payload.super === true)))
}
// Call before deactivation/offboarding, and retain this same session in the atomic identity mutation.
export async function guardAdminDeactivation(env: Bindings, s: Session, email: string) {
 const state = await authority(env)
 insist(!isSuper(state, email) || remainingSuper(state, undefined, email), 'last_super_admin', 409)
 attach(s, fence(state))
}
export async function assignAdmin(env: Bindings, s: Session, input: any) {
 const state = await authority(env)
 await requireManager(env, s, state)
 if (input.action === 'define') {
  insist(!input.id || !builtins.some(d => d.id === input.id), 'builtin_role_readonly')
  const previous = input.id ? state.definitions.find(d => d.id === input.id) : undefined
  insist(!input.id || previous, 'admin_role_not_found', 404)
  const payload = { name: text(input.name, 'role_name', 100), privileges: privileges(input.privileges) }
  const row = previous ? next(previous, payload) : fresh('admin-role-definition', payload)
  await commit(env, s, [{ row, previous }], { audits: [{ action: 'admin.role.define', object: row.id, detail: { before: previous?.payload ?? null, after: payload } }] })
  return row
 }
 insist(input.action === undefined || input.action === 'assign' || input.action === 'revoke', 'invalid_action')
 const previous = input.id ? state.grants.find(g => g.id === input.id) : undefined
 insist(!input.id || previous, 'admin_grant_not_found', 404)
 if (input.action === 'revoke') {
  insist(previous, 'admin_grant_not_found', 404)
  if (previous.payload.super) await requireManager(env, s, state, true)
  insist(!previous.payload.super || remainingSuper(state, previous.id), 'last_super_admin', 409)
  await commit(env, s, [{ row: previous, previous, remove: true }], { audits: [{ action: 'admin.grant.revoke', object: previous.id, detail: { before: previous.payload, after: null } }] })
  return { revoked: previous.id }
 }
 const target = activeTarget(state, input.email ?? previous?.payload.email)
 const superAdmin = input.super ?? previous?.payload.super ?? false
 insist(typeof superAdmin === 'boolean', 'invalid_super_admin')
 if (superAdmin || previous?.payload.super === true) await requireManager(env, s, state, true)
 const role = superAdmin ? '' : text(input.role ?? previous?.payload.role, 'admin_role')
 insist(superAdmin || state.definitions.some(d => d.id === role), 'admin_role_not_found')
 const scope = input.scope ?? previous?.payload.scope ?? 'organization'
 insist(scope === 'organization' || scope === 'groups', 'invalid_admin_scope')
 const groups = input.groups ?? previous?.payload.groups ?? []
 insist(Array.isArray(groups) && groups.every((g: unknown) => typeof g === 'string' && state.groups.some(row => row.id === g)), 'invalid_groups')
 insist(scope !== 'groups' || groups.length > 0, 'admin_groups_required')
 insist(!superAdmin || scope === 'organization', 'super_admin_requires_organization_scope')
 const payload: AdminGrant = { email: target.email, role, super: superAdmin, scope, groups: scope === 'groups' ? [...new Set<string>(groups)] : [] }
 const row = previous ? next(previous, payload) : fresh('admin-grant', payload)
 if (previous?.payload.super && (!superAdmin || target.email !== previous.payload.email)) insist(remainingSuper(state, previous.id) || superAdmin, 'last_super_admin', 409)
 await commit(env, s, [{ row, previous }], { audits: [{ action: 'admin.grant.assign', object: row.id, detail: { before: previous?.payload ?? null, after: payload } }] })
 return row
}

export async function canAdminGroup(env:Bindings,s:Session,privilege:AdminPrivilege,group:string){
 const state=await authority(env),operator=actor(state,s)
 return !!operator&&await current(env,s,state)&&(operator.role==='owner'||isSuper(state,operator.email)||state.grants.some(g=>g.payload.email===operator.email&&!g.payload.super&&(g.payload.scope==='organization'||g.payload.groups.includes(group))&&state.definitions.some(d=>d.id===g.payload.role&&d.payload.privileges.includes(privilege))))
}
export async function requireAdminGroup(env:Bindings,s:Session,privilege:AdminPrivilege,group:string){
 const state=await authority(env);insist(state.groups.some(g=>g.id===group)&&await canAdminGroup(env,s,privilege,group),'admin_group_scope_required',403);attach(s,fence(state))
}
// Base's invitation confirmation asks about the issuing principal, without a current browser session.
export async function identityAdminPolicy(env:Bindings,input:{actor:any;action:string;target?:any;role?:string}){
 const {actor:operator,action,target,role}=input,state=await authority(env),s={operator} as Session
 if(!actor(state,s))return false
 if(action==='operators:role')return false
 if((action==='sessions:list'||action==='sessions:revoke')&&target?.id===operator.id)return true
 if(operator.role==='owner')return true
 if(action==='providers:manage'||action==='domains:manage')return permitted(state,s,'service-settings')
 if(action==='operators:invite')return role==='member'&&(permitted(state,s,'user-management')||state.grants.some(g=>g.payload.email===operator.email&&!g.payload.super&&state.definitions.some(d=>d.id===g.payload.role&&(d.payload.privileges.includes('user-management')||d.payload.privileges.includes('help-desk')))))
 if(action==='operators:list')return false
 if(action==='operators:deactivate'||action==='operators:reactivate')return target?.role!=='owner'&&permitted(state,s,'user-management',target?.email)
 if(action==='sessions:list'||action==='sessions:revoke')return permitted(state,s,'help-desk',target?.email)
 return false
}
export async function isAdministrator(env:Bindings,s:Session){const state=await authority(env);return !!actor(state,s)&&(isSuper(state,s.operator.email)||state.grants.some(g=>g.payload.email===s.operator.email))}
export async function requireAnyAdmin(env:Bindings,s:Session,privilege:AdminPrivilege){const state=await authority(env);const permittedAny=permitted(state,s,privilege)||state.groups.some(group=>state.grants.some(g=>g.payload.email===s.operator.email&&g.payload.scope==='groups'&&g.payload.groups.includes(group.id)&&state.definitions.some(d=>d.id===g.payload.role&&d.payload.privileges.includes(privilege))));insist(permittedAny&&await current(env,s,state),'admin_required',403);attach(s,fence(state))}
export async function principalCanAdmin(env:Bindings,email:string,privilege:AdminPrivilege,target?:string){const state=await authority(env),operator=state.operators.find(p=>p.email===email&&p.status==='active');return !!operator&&permitted(state,{operator} as Session,privilege,target)}
