import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, type Group, type Row } from '../model'
import { list } from '../store'
import { commit, fresh, maybe, next } from '../files/repo'
import { canAdmin, requireAdmin, requireAdminGroup } from '../administration/roles'
import { DEFAULT_POLICY, type Action, type DeletionRule, type DownloadRule, type GroupRules, type ThreatPolicy } from './model'
// One organization record holds the mass-activity thresholds, per-group overrides and classification rules. Admins with
// security scope tune the organization rules; an admin scoped to groups tunes only those groups. Every change is
// audited with its before and after values.
const KEY = 'threat-policy'
export async function threatPolicyRow(env: Bindings) { return maybe<ThreatPolicy>(env, KEY, KEY) }
export async function threatPolicy(env: Bindings): Promise<ThreatPolicy> {
 const saved = (await threatPolicyRow(env))?.payload
 return saved ? { ...DEFAULT_POLICY, ...saved, classification: { ...DEFAULT_POLICY.classification, ...saved.classification } } : DEFAULT_POLICY
}
export type Effective = { downloads: DownloadRule & { scope: string }; deletions: DeletionRule & { scope: string }; windowMinutes: number }
// A group override replaces the organization rule for that group's members; across several overridden groups the
// most restrictive value applies, and pause outranks alert.
export function effective(p: ThreatPolicy, groups: Row<Group>[]): Effective {
 const pick = <R extends { action: Action }>(base: R, key: 'downloads' | 'deletions', fields: (keyof R)[]) => {
  const overrides = groups.map(g => ({ g, r: p.groups[g.id]?.[key] as R | undefined })).filter((o): o is { g: Row<Group>; r: R } => !!o.r)
  if (!overrides.length) return { ...base, scope: 'organization' }
  const rule = { ...overrides[0].r } as R
  for (const { r } of overrides.slice(1)) { for (const f of fields) if ((r[f] as number) < (rule[f] as number)) rule[f] = r[f]; if (r.action === 'pause') rule.action = 'pause' }
  return { ...rule, scope: overrides.map(o => `group ${o.g.payload.name}`).join(', ') }
 }
 return { downloads: pick(p.downloads, 'downloads', ['files', 'bytes']), deletions: pick(p.deletions, 'deletions', ['items']), windowMinutes: p.windowMinutes }
}
export const ruleText = (kind: 'downloads' | 'deletions', r: (DownloadRule | DeletionRule) & { scope: string }, minutes: number) => kind === 'downloads'
 ? `More than ${(r as DownloadRule).files} files or ${gb((r as DownloadRule).bytes)} downloaded in ${minutes} minutes (${r.scope}; ${r.action === 'pause' ? 'pause' : 'alert'})`
 : `More than ${(r as DeletionRule).items} items trashed or deleted in ${minutes} minutes (${r.scope}; ${r.action === 'pause' ? 'pause' : 'alert'})`
export const gb = (n: number) => `${+(n / 1e9).toFixed(3)} GB`
const count = (v: unknown, name: string, max: number) => { const n = Number(v); insist(Number.isSafeInteger(n) && n >= 1 && n <= max, `invalid_${name}`); return n }
const action = (v: unknown): Action => { insist(v === 'alert' || v === 'pause', 'invalid_action'); return v }
const downloads = (input: any): DownloadRule => ({ files: count(input.files, 'files', 1_000_000), bytes: Math.round(Number(input.gigabytes) * 1e9), action: action(input.downloadAction) })
const deletions = (input: any): DeletionRule => ({ items: count(input.items, 'items', 1_000_000), action: action(input.deletionAction) })
const bool = (v: unknown) => v === true || v === 'true' ? true : v === false || v === 'false' ? false : v === undefined ? undefined : null
const checkBytes = (r: DownloadRule) => { insist(Number.isSafeInteger(r.bytes) && r.bytes >= 1_000_000 && r.bytes <= 1e15, 'invalid_gigabytes'); return r }
export async function savePolicy(env: Bindings, s: Session, input: any) {
 const row = await threatPolicyRow(env), before = await threatPolicy(env)
 let after: ThreatPolicy, scope: string
 if (input.group) {
  insist(typeof input.group === 'string', 'invalid_group'); await requireAdminGroup(env, s, 'sharing-security', input.group); scope = `group:${input.group}`
  const groups = { ...before.groups }
  if (bool(input.clear)) delete groups[input.group]
  else { const rules: GroupRules = {}; if (input.files !== undefined && input.files !== '') rules.downloads = checkBytes(downloads(input)); if (input.items !== undefined && input.items !== '') rules.deletions = deletions(input); insist(rules.downloads || rules.deletions, 'group_rule_required'); groups[input.group] = rules }
  after = { ...before, groups }
 } else {
  await requireAdmin(env, s, 'sharing-security'); scope = 'organization'
  const labels = typeof input.labels === 'string' ? [...new Set(input.labels.split(',').map((l: string) => l.trim()).filter(Boolean))] as string[] : before.classification.labels
  insist(labels.length <= 20 && labels.every(l => l.length <= 60 && !/[\x00-\x1f]/.test(l)), 'invalid_labels')
  const blockExternal = bool(input.blockExternal); insist(blockExternal !== null, 'invalid_block_external')
  after = { ...before, windowMinutes: input.windowMinutes === undefined ? before.windowMinutes : count(input.windowMinutes, 'window', 1440), downloads: input.files === undefined ? before.downloads : checkBytes(downloads(input)), deletions: input.items === undefined ? before.deletions : deletions(input), classification: { labels, blockExternal: blockExternal ?? before.classification.blockExternal } }
 }
 const written = row ? next(row, after) : fresh<ThreatPolicy>(KEY, after, KEY)
 await commit(env, s, [{ row: written, previous: row ?? undefined }], { audits: [{ action: 'threats.policy', object: KEY, detail: { scope, before: scope === 'organization' ? { ...before, groups: undefined } : before.groups[scope.slice(6)] ?? null, after: scope === 'organization' ? { ...after, groups: undefined } : after.groups[scope.slice(6)] ?? null } }] })
 return policyView(env, s)
}
export async function policyView(env: Bindings, s: Session) {
 const policy = await threatPolicy(env), groups = await list<Group>(env, 'group'), organization = await canAdmin(env, s, 'sharing-security')
 const tunable: Row<Group>[] = []
 for (const g of groups) if (organization || await (await import('../administration/roles')).canAdminGroup(env, s, 'sharing-security', g.id)) tunable.push(g)
 insist(organization || tunable.length, 'admin_required', 403)
 return { policy, organization, groups: tunable.map(g => ({ id: g.id, name: g.payload.name, rules: policy.groups[g.id] ?? null })) }
}
