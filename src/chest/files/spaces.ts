import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { validPerson } from '../access'
import { peopleAction } from '../identity'
import { insist, now, text, type Row } from '../model'
import { commit, fresh, maybe, next } from './repo'
import { start, who, type Who } from './access'
import { creationPolicy, newSpaceDefaults } from './space-policy'
import { changeSpaceSettings } from './space-settings'
import { personalId, role, spaceRoles, type Grant, type Space } from './model'
// Team spaces are created by staff, who become their first manager; a personal area exists for every person.
export async function personal(env: Bindings, s: Session): Promise<Row<Space>> {
 const key = personalId(s.operator.email), found = await maybe<Space>(env, 'space', key)
 if (found) return found
 const row = fresh<Space>('space', { name: 'My files', kind: 'personal', owner: s.operator.email, members: [], settings: { noDownload: false, editorSharing: true }, createdBy: s.operator.email, createdAt: now() }, key)
 await commit(env, s, [{ row }], { audits: [{ action: 'space.personal', object: key }] })
 return row
}
export async function createSpace(env: Bindings, s: Session, input: any) {
 const w = await who(env, s), policy = await newSpaceDefaults(env, w), creation = await creationPolicy(env, s, w, policy.organisation)
 insist(creation.allowed, creation.rule, 403)
 const { storageLimitBytes, ...defaults } = policy.defaults
 // Until space defaults are configured, ordinary link-policy defaults remain authoritative.
 if(!policy.fences.some(r=>r.kind==='space-policy'))delete (defaults as Partial<typeof defaults>).defaultLinkAudience
 const at = now(), row = fresh<Space>('space', { name: text(input.name, 'name'), kind: 'team', owner: '', members: [{ principal: s.operator.email, role: 'manager', by: s.operator.email, at }], settings: { ...defaults, editorSharing: true }, storageLimitBytes, createdBy: s.operator.email, createdAt: at })
 await commit(env, s, [{ row }], { fences: policy.fences, statements: policy.statements, audits: [{ action: 'space.create', object: row.id, detail: { name: row.payload.name, defaults: policy.defaults, creationRule: creation.rule } }] })
 return row
}
export async function grantsFrom(env: Bindings, input: unknown, roles: string[], by: string): Promise<Grant[]> {
 insist(Array.isArray(input) && input.length <= 600, 'invalid_members')
 const at = now(), seen = new Set<string>(), result: Grant[] = []
 for (const g of input) {
  insist(g && typeof g === 'object' && typeof g.principal === 'string' && !seen.has(g.principal), 'invalid_members'); seen.add(g.principal)
  const principal = g.principal.includes('@') ? await validPerson(env, g.principal) : (await get(env, 'group', g.principal)).id
  result.push({ principal, role: role(g.role, roles as any), by, at })
 }
 return result
}
export async function members(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const space = await get<Space>(env, 'space', key); insist(space.payload.kind === 'team', 'personal_area_has_no_members'); insist(start(space.payload, w).role === 'manager', 'administer_refused', 403)
 const grants = await grantsFrom(env, input.members, spaceRoles, s.operator.email)
 insist(grants.some(g => g.role === 'manager'), 'space_needs_manager')
 await commit(env, s, [{ row: next(space, { ...space.payload, members: grants }), previous: space }], { fences: w.groups, changes: [{ item: space.id, space: space.id, kind: 'access' }], audits: [{ action: 'space.members', object: space.id, detail: { before: space.payload.members.map(g => [g.principal, g.role]), after: grants.map(g => [g.principal, g.role]) } }] })
 return get<Space>(env, 'space', key)
}
// The Members card's forms: add a person by email (or a group) with a role, change a role, or remove. When the owner
// adds someone not yet in this Chest, they are invited first; a manager who is not the owner is told who can invite.
export async function member(env: Bindings, request: Request, s: Session, w: Who, key: string, input: any) {
 const space = await get<Space>(env, 'space', key); insist(space.payload.kind === 'team', 'personal_area_has_no_members'); insist(start(space.payload, w).role === 'manager', 'administer_refused', 403)
 const raw = typeof input.principal === 'string' ? input.principal.trim() : '', principal = raw.includes('@') ? raw.toLowerCase() : raw
 insist(principal, 'invalid_members')
 const list = space.payload.members.map(g => ({ principal: g.principal, role: g.role as string })), at = list.findIndex(g => g.principal === principal)
 if (input.action === 'remove') { insist(at >= 0, 'not_a_member', 404); list.splice(at, 1) }
 else if (input.action === 'role') { insist(at >= 0, 'not_a_member', 404); list[at].role = role(input.role, spaceRoles) }
 else {
  insist(input.action === 'add', 'invalid_action'); insist(at < 0, 'already_member', 409)
  const chosen = role(input.role, spaceRoles)
  if (principal.includes('@') && !await maybe(env, 'person', principal)) {
   insist(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(principal), 'invalid_email'); insist(s.operator.role === 'owner', 'unknown_person', 404)
   await peopleAction(env, request, s, { action: 'invite', email: principal, name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : principal.split('@')[0] })
  }
  list.push({ principal, role: chosen })
 }
 return members(env, s, w, key, { members: list })
}
export async function settings(env: Bindings, s: Session, w: Who, key: string, input: any) {
 return changeSpaceSettings(env, s, w, key, input)
}
export async function visibleSpaces(env: Bindings, w: Who) { return (await list<Space>(env, 'space')).filter(r => r.payload.kind === 'team' ? start(r.payload, w).role : r.payload.owner === w.email) }
