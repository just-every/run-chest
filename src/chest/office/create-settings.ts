import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { isAdmin, type Who } from '../files/access'
import { commit, fresh, maybe, next } from '../files/repo'
import { insist, type Group } from '../model'
import { get } from '../store'
import type { NewFormat, NewSettings } from './create-model'
export const settingsKey = 'office:creation-settings'
export const defaultSettings: NewSettings = { format: 'office', groups: [] }
export const validFormat = (value: unknown): value is NewFormat => value === 'office' || value === 'odf'
export async function effectiveSettings(env: Bindings, w: Who) {
 const row = await maybe<NewSettings>(env, 'office-creation-settings', settingsKey), settings = row?.payload ?? defaultSettings
 return { row, settings, effectiveFormat: settings.groups.find(o => w.groups.some(g => g.id === o.group))?.format ?? settings.format }
}
export async function creationSettings(env: Bindings, s: Session, w: Who) {
 const { settings, effectiveFormat } = await effectiveSettings(env, w)
 return isAdmin(s) ? { ...settings, effectiveFormat, editable: true } : { effectiveFormat, editable: false }
}
export async function saveCreationSettings(env: Bindings, s: Session, w: Who, input: any) {
 insist(isAdmin(s), 'service_settings_refused', 403)
 insist(validFormat(input.format) && Array.isArray(input.groups) && input.groups.length <= 100, 'invalid_creation_settings')
 const seen = new Set<string>(), fences = []
 const groups: NewSettings['groups'] = []
 for (const override of input.groups) {
  insist(override && typeof override.group === 'string' && validFormat(override.format) && !seen.has(override.group), 'invalid_creation_settings')
  seen.add(override.group); fences.push(await get<Group>(env, 'group', override.group)); groups.push({ group: override.group, format: override.format })
 }
 const previous = await maybe<NewSettings>(env, 'office-creation-settings', settingsKey), payload: NewSettings = { format: input.format, groups }
 const row = previous ? next(previous, payload) : fresh('office-creation-settings', payload, settingsKey)
 await commit(env, s, [{ row, previous: previous ?? undefined }], { fences, audits: [{ action: 'office.creation-settings', object: row.id, detail: { before: previous?.payload ?? defaultSettings, after: payload } }] })
 return creationSettings(env, s, w)
}
