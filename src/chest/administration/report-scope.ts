import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, type Group } from '../model'
import { list } from '../store'
import { canAdmin, canAdminGroup, requireAnyAdmin } from './roles'

export type ReportScope = { global: boolean; emails: string[]; groups: { id: string; name: string }[] }
// Use the same current group/area custody as administrative recovery. Content access is never implied.
export async function reportScope(env: Bindings, s: Session, group?: string | null, bounds?: readonly string[]): Promise<ReportScope> {
 await requireAnyAdmin(env, s, 'audit-reporting')
 const global = await canAdmin(env, s, 'audit-reporting'), groups = []
 for (const row of await list<Group>(env, 'group')) if (global || await canAdminGroup(env, s, 'audit-reporting', row.id)) groups.push(row)
 const bounded = bounds ? groups.filter(g => bounds.includes(g.id)) : groups
 if (bounds) insist(bounded.length, 'admin_group_scope_required', 403)
 const chosen = group ? bounded.filter(g => g.id === group) : bounded
 insist(!group || chosen.length, 'admin_group_scope_required', 403)
 return { global: global && !group && !bounds, emails: [...new Set(chosen.flatMap(g => g.payload.members))], groups: bounded.map(g => ({ id: g.id, name: g.payload.name })) }
}
export function areaCondition(scope: ReportScope, alias = 'r') {
 return scope.global ? { sql: '1', params: [] as unknown[] } : {
  sql: `COALESCE(json_extract(${alias}.payload,'$.formerOwner'),NULLIF(json_extract(${alias}.payload,'$.owner'),''),json_extract(${alias}.payload,'$.createdBy')) IN (SELECT value FROM json_each(?))`, params: [JSON.stringify(scope.emails)],
 }
}
export function contentCondition(scope: ReportScope, alias = 'r') {
 const area = areaCondition(scope, 's')
 return scope.global ? { sql: '1', params: [] as unknown[] } : {
  sql: `((${alias}.kind='document' AND json_extract(${alias}.payload,'$.owner') IN (SELECT value FROM json_each(?))) OR (${alias}.kind IN ('item','request-submission') AND json_extract(${alias}.payload,'$.space') IN (SELECT s.id FROM chest_records s WHERE s.kind='space' AND ${area.sql})))`,
  params: [JSON.stringify(scope.emails), ...area.params],
 }
}
export function eventCondition(scope: ReportScope) {
 if (scope.global) return { sql: '1', params: [] as unknown[] }
 const content = contentCondition(scope, 'r'), area = areaCondition(scope, 'r')
 return {
  sql: `(EXISTS(SELECT 1 FROM chest_records r WHERE r.id=a.object_id AND ((r.kind='space' AND ${area.sql}) OR ${content.sql})) OR (a.actor IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE r.id=a.object_id AND r.kind IN ('item','document','space','request-submission'))))`,
  params: [...area.params, ...content.params, JSON.stringify(scope.emails)],
 }
}
