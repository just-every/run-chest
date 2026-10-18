import type { Bindings } from '../../auth.server'
import { list } from '../store'
import type { Group, Row } from '../model'
import type { Space } from '../files/model'

export type QuotaRule = { scope: 'personal-default'|'space-default'|'group'|'user'; target?: string; limitBytes: number|null }
export const ruleId = (scope: string, target = '') => `quota-rule:${scope}${target ? ':' + target : ''}`
export async function quotaRules(env: Bindings) { return { rules: await list<QuotaRule>(env, 'quota-rule'), groups: await list<Group>(env, 'group') } }
export function effectiveQuota(space: Row<Space>, rules: Row<QuotaRule>[], groups: Row<Group>[]) {
 const p = space.payload, scope = p.kind === 'personal' ? 'user' : 'space'
 const user = p.kind === 'personal' ? rules.find(r => r.id === ruleId('user', p.owner)) : undefined
 if (user) return { scope, limitBytes: user.payload.limitBytes, rule: 'User override' }
 if (p.storageLimitBytes != null || p.storageLimitOverride) return { scope, limitBytes: p.storageLimitBytes ?? null, rule: p.kind === 'personal' ? 'User override' : 'Space override' }
 const limited = p.kind === 'personal' ? groups.filter(g => g.payload.members.includes(p.owner)).flatMap(g => { const r = rules.find(r => r.id === ruleId('group', g.id)); return r?.payload.limitBytes != null ? [{ name: g.payload.name, limit: r.payload.limitBytes }] : [] }) : []
 if (limited.length) { const limitBytes = Math.max(...limited.map(r => r.limit)); return { scope, limitBytes, rule: 'Group: ' + limited.filter(r => r.limit === limitBytes).map(r => r.name).sort().join(', ') } }
 const kind = p.kind === 'personal' ? 'personal-default' : 'space-default'
 return { scope, limitBytes: rules.find(r => r.id === ruleId(kind))?.payload.limitBytes ?? null, rule: p.kind === 'personal' ? 'Organization personal default' : 'Organization space default' }
}
// This expression reads the live rules inside the same transaction as the file write.
export function limitSQL(alias = 's') {
 const p = `${alias}.payload`, user = `(SELECT payload FROM chest_records WHERE kind='quota-rule' AND id='quota-rule:user:'||json_extract(${p},'$.owner'))`
 const group = `(SELECT MAX(json_extract(q.payload,'$.limitBytes')) FROM chest_records g JOIN chest_records q ON q.kind='quota-rule' AND q.id='quota-rule:group:'||g.id WHERE g.kind='group' AND EXISTS(SELECT 1 FROM json_each(g.payload,'$.members') m WHERE m.value=json_extract(${p},'$.owner')))`
 const defaults = `(SELECT json_extract(q.payload,'$.limitBytes') FROM chest_records q WHERE q.kind='quota-rule' AND q.id=CASE WHEN json_extract(${p},'$.kind')='personal' THEN 'quota-rule:personal-default' ELSE 'quota-rule:space-default' END)`
 return `CASE WHEN json_extract(${p},'$.kind')='personal' AND ${user} IS NOT NULL THEN json_extract(${user},'$.limitBytes') WHEN json_extract(${p},'$.storageLimitBytes') IS NOT NULL OR json_extract(${p},'$.storageLimitOverride')=1 THEN json_extract(${p},'$.storageLimitBytes') WHEN json_extract(${p},'$.kind')='personal' THEN COALESCE(${group},${defaults}) ELSE ${defaults} END`
}
