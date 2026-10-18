import { canAdmin,requireAdmin } from '../administration/roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { insist } from '../model'
import { start, type Who } from './access'
import { commit, next } from './repo'
import type { Space } from './model'
import { adminStatement, parseSpaceDefaults, serviceAdmin, spaceDefaults } from './space-policy'
import { storage } from '../quota/storage'

export async function spaceSettingsView(env: Bindings, s: Session, key: string) {
 const space = await get<Space>(env, 'space', key);await serviceAdmin(env,s,space.payload.owner||space.payload.createdBy); insist(space.payload.kind === 'team', 'team_space_required')
 return { id: key, name: s.operator.role==='owner'?space.payload.name:space.id, settings: spaceDefaults(space.payload), editorSharing: space.payload.settings.editorSharing, ...await storage(env, key) }
}
export async function changeSpaceSettings(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const space = await get<Space>(env, 'space', key), admin = await canAdmin(env,s,'service-settings',space.payload.owner||space.payload.createdBy)
 if(admin)await requireAdmin(env,s,'service-settings',space.payload.owner||space.payload.createdBy)
 insist(space.payload.kind === 'team' && (admin || start(space.payload, w).role === 'manager'), 'administer_refused', 403)
 const before = spaceDefaults(space.payload), after = parseSpaceDefaults(input, before)
 const changed = Object.keys(before).filter(k => before[k as keyof typeof before] !== after[k as keyof typeof after])
 // Only an admin can unlock settings; a manager cannot switch this on to bypass the default.
 insist(admin || after.managerOverride === before.managerOverride, 'space_manager_override_admin_only', 403)
 insist(admin || before.managerOverride || changed.length === 0, 'space_manager_override_disabled', 403)
 insist(input.editorSharing === undefined || typeof input.editorSharing === 'boolean', 'invalid_settings')
 if (changed.includes('storageLimitBytes') && after.storageLimitBytes !== null) {
  const usage = await storage(env, key)
  insist(usage.usedBytes <= after.storageLimitBytes || input.confirmOverLimit === true, 'space_storage_limit_confirmation_required', 409)
 }
 const { storageLimitBytes, ...settings } = after
 const payload: Space = { ...space.payload, storageLimitBytes, settings: { ...space.payload.settings, ...settings, editorSharing: input.editorSharing ?? space.payload.settings.editorSharing } }
 await commit(env, s, [{ row: next(space, payload), previous: space }], { fences: w.groups, statements: admin ? [adminStatement(s)] : [], changes: [{ item: key, space: key, kind: 'access' }], audits: [{ action: 'space.settings', object: key, detail: { before: { ...before, editorSharing: space.payload.settings.editorSharing }, after: { ...after, editorSharing: payload.settings.editorSharing } } }] })
 return get<Space>(env, 'space', key)
}
