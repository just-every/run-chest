import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { insist, now, text, type Group, type Row } from '../model'
import { isAdmin, type Who } from './access'
import { commit, fresh, maybe, next } from './repo'
import { notice } from './notify'
import type { Space } from './model'

export type SpaceDefaults = { externalAccess: boolean; nonMemberAccess: boolean; contentManagerFolderSharing: boolean; noDownload: boolean; defaultLinkAudience: 'restricted'|'organisation'|'public'; storageLimitBytes: number|null; managerOverride: boolean }
export type SpacePolicy = { creation: 'everyone'|'groups'|'admins'; creatorGroups: string[]; defaults: SpaceDefaults }
export type SpaceRequest = { name: string; message: string; requester: string; at: string; rule: string; admins: string[] }
export const compatibleDefaults: SpaceDefaults = { externalAccess: true, nonMemberAccess: true, contentManagerFolderSharing: true, noDownload: false, defaultLinkAudience: 'organisation', storageLimitBytes: null, managerOverride: true }
const initial: SpacePolicy = { creation: 'everyone', creatorGroups: [], defaults: compatibleDefaults }
const key = (scope: string) => `space-policy:${scope}`
const flags = ['externalAccess','nonMemberAccess','contentManagerFolderSharing','noDownload','managerOverride'] as const
export function spaceDefaults(space: Space): SpaceDefaults {
 const s = space.settings
 return { externalAccess: s.externalAccess ?? true, nonMemberAccess: s.nonMemberAccess ?? true, contentManagerFolderSharing: s.contentManagerFolderSharing ?? true, noDownload: s.noDownload, defaultLinkAudience: s.defaultLinkAudience ?? 'organisation', storageLimitBytes: space.storageLimitBytes ?? null, managerOverride: s.managerOverride ?? true }
}
export function parseSpaceDefaults(input: any, base: SpaceDefaults): SpaceDefaults {
 insist(input && typeof input === 'object' && !Array.isArray(input), 'invalid_space_defaults')
 for (const flag of flags) insist(input[flag] === undefined || typeof input[flag] === 'boolean', 'invalid_space_defaults')
 insist(input.defaultLinkAudience === undefined || ['restricted','organisation','public'].includes(input.defaultLinkAudience), 'invalid_space_defaults')
 insist(input.storageLimitBytes === undefined || input.storageLimitBytes === null || Number.isSafeInteger(input.storageLimitBytes) && input.storageLimitBytes >= 0, 'invalid_storage_limit')
 return Object.fromEntries(Object.keys(base).map(k => [k, input[k] === undefined ? base[k as keyof SpaceDefaults] : input[k]])) as SpaceDefaults
}
export const serviceAdmin = (s: Session) => insist(isAdmin(s), 'service_settings_admin_required', 403)
export const adminStatement = (s: Session) => ({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin')) THEN 1 ELSE 0 END", params: [s.operator.id] })
export async function creationPolicy(env: Bindings, s: Session, w: Who, supplied?: Row<SpacePolicy>|null) {
 const row = supplied === undefined ? await maybe<SpacePolicy>(env, 'space-policy', key('organisation')) : supplied, policy = row?.payload ?? initial
 const allowed = isAdmin(s) || policy.creation === 'everyone' || policy.creation === 'groups' && w.groups.some(g => policy.creatorGroups.includes(g.id))
 const rule = policy.creation === 'groups' ? 'space_creation_named_groups_only' : policy.creation === 'admins' ? 'space_creation_admins_only' : 'space_creation_everyone'
 return { allowed, rule, policy, row }
}
// If a creator belongs to several override groups, use the more restrictive value for each setting.
export async function newSpaceDefaults(env: Bindings, w: Who) {
 const scopes = ['organisation', ...w.groups.map(g => `group:${g.id}`).sort()], reads = await Promise.all(scopes.map(scope => maybe<SpacePolicy|SpaceDefaults>(env, 'space-policy', key(scope))))
 const org = reads[0] as Row<SpacePolicy>|null, defaults = { ...(org?.payload.defaults ?? compatibleDefaults) }
 const overrides = reads.slice(1).filter((r): r is Row<SpaceDefaults> => !!r), audiences = ['restricted','organisation','public']
 if (overrides.length) {
  Object.assign(defaults, overrides[0].payload)
  for (const { payload: p } of overrides.slice(1)) {
   for (const flag of ['externalAccess','nonMemberAccess','contentManagerFolderSharing','managerOverride'] as const) defaults[flag] &&= p[flag]
   defaults.noDownload ||= p.noDownload
   if (audiences.indexOf(p.defaultLinkAudience) < audiences.indexOf(defaults.defaultLinkAudience)) defaults.defaultLinkAudience = p.defaultLinkAudience
   if (p.storageLimitBytes !== null) defaults.storageLimitBytes = defaults.storageLimitBytes === null ? p.storageLimitBytes : Math.min(defaults.storageLimitBytes, p.storageLimitBytes)
  }
 }
 return { defaults, organisation: org, fences: [...w.groups, ...reads.filter((r): r is Row<SpacePolicy|SpaceDefaults> => !!r)], statements: scopes.flatMap((scope, i) => reads[i] ? [] : [{ sql: 'INSERT INTO chest_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM chest_records WHERE id=?) THEN 1 ELSE 0 END', params: [key(scope)] }]) }
}
export async function spacePolicyView(env: Bindings, s: Session) {
 serviceAdmin(s)
 const groups = await list<Group>(env, 'group'), org = await maybe<SpacePolicy>(env, 'space-policy', key('organisation'))
 return { policy: org?.payload ?? initial, groups: await Promise.all(groups.map(async g => ({ id: g.id, name: g.payload.name, defaults: (await maybe<SpaceDefaults>(env, 'space-policy', key(`group:${g.id}`)))?.payload ?? null }))), spaces: (await list<Space>(env, 'space')).filter(r => r.payload.kind === 'team').map(r => ({ id: r.id, name: r.payload.name, settings: spaceDefaults(r.payload) })), requests: (await list<SpaceRequest>(env, 'space-request')).map(r => ({ id: r.id, ...r.payload })) }
}
export async function saveSpacePolicy(env: Bindings, s: Session, input: any) {
 serviceAdmin(s)
 const scope = input.scope ?? 'organisation'; insist(typeof scope === 'string', 'invalid_policy_scope')
 let group: Row<Group>|undefined
 if (scope !== 'organisation') { insist(scope.startsWith('group:'), 'invalid_policy_scope'); group = await get<Group>(env, 'group', scope.slice(6)) }
 const old = await maybe<SpacePolicy|SpaceDefaults>(env, 'space-policy', key(scope)), org = await maybe<SpacePolicy>(env, 'space-policy', key('organisation'))
 if (input.remove === true) {
  insist(group, 'invalid_policy_scope')
  if (old) await commit(env, s, [{ row: old, previous: old, remove: true }], { fences: [group], statements: [adminStatement(s)], audits: [{ action: 'policy.spaces', object: key(scope), detail: { scope, before: old.payload, after: null } }] })
  return { removed: true }
 }
 const defaults = parseSpaceDefaults(input.defaults ?? input, group ? (old?.payload as SpaceDefaults ?? org?.payload.defaults ?? compatibleDefaults) : (org?.payload.defaults ?? compatibleDefaults))
 let payload: SpacePolicy|SpaceDefaults = defaults
 if (!group) {
  const creation = input.creation ?? org?.payload.creation ?? initial.creation, creatorGroups = input.creatorGroups ?? org?.payload.creatorGroups ?? []
  insist(['everyone','groups','admins'].includes(creation) && Array.isArray(creatorGroups) && creatorGroups.every(g => typeof g === 'string'), 'invalid_space_creation_rule')
  const all = await list<Group>(env, 'group'); insist(creatorGroups.every(id => all.some(g => g.id === id)) && (creation !== 'groups' || creatorGroups.length > 0), 'invalid_space_creation_groups')
  payload = { creation, creatorGroups: [...new Set<string>(creatorGroups)], defaults }
 }
 const row = old ? next(old, payload) : fresh('space-policy', payload, key(scope))
 await commit(env, s, [{ row, ...(old ? { previous: old } : {}) }], { fences: [...(group ? [group] : []), ...(org && org.id !== row.id ? [org] : [])], statements: [adminStatement(s)], audits: [{ action: 'policy.spaces', object: row.id, detail: { scope, before: old?.payload ?? (group ? null : initial), after: payload } }] })
 return payload
}
export async function requestSpace(env: Bindings, s: Session, w: Who, input: any) {
 const p = await creationPolicy(env, s, w), name = text(input.name, 'name'), message = typeof input.message === 'string' ? input.message.trim() : ''; insist(message.length <= 2000, 'invalid_message')
 const result = await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active' AND role IN ('owner','admin') ORDER BY email").all<{email:string}>(), admins = result.results.map(r => r.email)
 insist(admins.length, 'service_settings_admin_unavailable', 409)
 const row = fresh<SpaceRequest>('space-request', { name, message, requester: w.email, at: now(), rule: p.rule, admins }), notices = admins.map(to => notice(to, 'space.request', null, w.email, `${w.email} requests a team space: ${name}.${message ? ` ${message}` : ''} Review Space creation & defaults from Files. Rule: ${p.rule}.`))
 await commit(env, s, [{ row }, ...notices.map(row => ({ row }))], { fences: [...w.groups, ...(p.row ? [p.row] : [])], audits: [{ action: 'space.request', object: row.id, detail: { name, rule: p.rule, admins } }] })
 return { id: row.id, notifiedAdmins: admins.length }
}
