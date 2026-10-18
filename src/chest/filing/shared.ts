import { effectiveGovernance, prepareFiling } from '../files/folder-metadata'
import { preservePublicAudience } from './public-audience'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, type Row } from '../model'
import { get } from '../store'
import { allowed, context, demand, start, type Ctx, type Who } from '../files/access'
import { folderOf, place, siblings, unique } from '../files/items'
import { live, rank, type Item, type Space } from '../files/model'
import { commit, fresh, next, type Op } from '../files/repo'

export type FilingMove = { space: string; item: string; version: string | null; name: string; source: string | null; destination: string | null; destinationPath: string; explanation: string; evidence: string; by: string; at: string; status: 'filed' | 'blocked' | 'undone'; reason?: string; movedRevision?: string; rule?: string; ruleRevision?: string; undoneAt?: string; undoFences?: { id: string; kind: string; revision: string }[]; undoPublicLinkCount?: number; undoLinkCount?: number }
export async function spaceManager(env: Bindings, w: Who, key: string) {
 const space = await get<Space>(env, 'space', key)
 insist(start(space.payload, w).manager, 'space_manager_required', 403)
 return space
}
export const assertSQL = (sql: string, params: unknown[]) => ({ sql: `INSERT INTO chest_assert(ok) SELECT CASE WHEN (${sql}) THEN 1 ELSE 0 END`, params })
// Standing grants remain attached to a live person, never to the arrival's sender or the uploader.
export async function liveActor(env: Bindings, email: string) {
 const actor: any = await env.DB.prepare("SELECT id,version FROM oa_operators WHERE email=? AND status='active'").bind(email).first()
 insist(actor, 'rule_owner_inactive', 403)
 return assertSQL("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND status='active')", [actor.id, email, actor.version])
}
// For each principal and role level, retain how long that right lasts. A move cannot extend a time-limited grant.
type Audience = Map<string, number[]>
function include(audience:Audience,principal:string,level:number,until:number){
 const rights=audience.get(principal)??Array(7).fill(0)
 for(let n=1;n<=level;n++)rights[n]=Math.max(rights[n],until)
 audience.set(principal,rights)
}
function audience(ctx: Ctx): Audience {
 const roles:Audience=new Map(), managers:Audience=new Map()
 if(ctx.space.payload.kind==='personal')include(managers,ctx.space.payload.owner,rank.owner,Infinity)
 else for(const g of ctx.space.payload.members.filter(g=>live(g))){
  const until=g.expires?Date.parse(g.expires):Infinity
  include(roles,g.principal,rank[g.role],until)
  if(rank[g.role]>=rank.manager)include(managers,g.principal,rank[g.role],until)
 }
 for(const item of ctx.chain){
  if(item.payload.restricted){roles.clear();for(const [p,rights]of managers)roles.set(p,[...rights])}
  for(const g of item.payload.grants.filter(g=>live(g)))include(roles,g.principal,rank[g.role],g.expires?Date.parse(g.expires):Infinity)
  for(const link of ctx.links.filter(l=>l.payload.item===item.id))include(roles,`link:${link.id}`,rank[link.payload.role],Infinity)
 }
 for(const [p,rights]of managers)for(let level=1;level<rights.length;level++)include(roles,p,level,rights[level])
 return roles
}
// New principals, stronger roles and longer grants require a person's explicit move.
export function preserveAudience(source: Ctx, destination: Ctx, item: Row<Item>) {
 const before=audience(source),after=audience({...destination,chain:[...destination.chain,item]})
 for(const [principal,rights]of after)for(let level=1;level<rights.length;level++)insist(rights[level]<=(before.get(principal)?.[level]??0),'filing_would_broaden_access',409)
 insist(!source.state.noDownload || destination.state.noDownload || item.payload.noDownload, 'filing_would_allow_download', 409)
}
export async function moveFile(env: Bindings, s: Session, w: Who, item: Row<Item>, destination: string | null, detail: Omit<FilingMove, 'space'|'item'|'version'|'name'|'source'|'destination'|'destinationPath'|'at'|'status'|'movedRevision'>, key: string, extra: { fences?: Row[]; ops?: Op[]; statements?: { sql: string; params: unknown[] }[] } = {}) {
 const ctx = await context(env, w, item.id); demand(ctx, 'manage')
 const current = ctx.chain.at(-1)!; insist(current.revision === item.revision, 'filing_stale', 409)
 insist(item.payload.type === 'file' && !item.payload.trash, 'not_a_file')
 const dest = await place(env, w, item.payload.space, destination)
 insist(dest.space.id === item.payload.space, 'filing_same_space_required')
 insist(folderOf(dest) !== item.payload.parent, 'filing_already_in_destination', 409)
 preserveAudience(ctx, dest, item)
 const publicAudience=await preservePublicAudience(env,ctx,dest,item)
 unique(await siblings(env, item.payload.space, destination), item.payload.name, item.id)
 const governed = await prepareFiling(env,dest,{...item.payload,governance:effectiveGovernance(ctx,item.payload)})
 const at = now(), row = next(item, { ...governed, parent: destination, updatedAt: at })
 const destinationPath = [dest.space.payload.name, ...dest.chain.map(r => r.payload.name)].join(' / ')
 const links = [...new Map([...ctx.links, ...dest.links].map(r => [r.id, r])).values()]
 const undoFences = [...new Map([...ctx.fences, ...dest.fences, ...links, ...publicAudience.links].filter(r => r.id !== item.id).map(r => [r.id, { id: r.id, kind: r.kind, revision: r.revision }])).values()]
 const move = fresh<FilingMove>('filing_move', { ...detail, space: item.payload.space, item: item.id, version: item.payload.current, name: item.payload.name, source: item.payload.parent, destination, destinationPath, at, status: 'filed', movedRevision: row.revision, undoFences, undoLinkCount: ctx.links.length, undoPublicLinkCount: publicAudience.count }, key)
 const collision = assertSQL("NOT EXISTS(SELECT 1 FROM chest_records WHERE kind='item' AND id<>? AND json_extract(payload,'$.space')=? AND json_extract(payload,'$.parent') IS ? AND json_extract(payload,'$.trash') IS NULL AND lower(json_extract(payload,'$.name'))=lower(?))", [item.id, item.payload.space, destination, item.payload.name])
 const linkSet = assertSQL("(SELECT count(*) FROM chest_records WHERE kind='link')=?", [ctx.links.length])
 await commit(env, s, [{ row, previous: item }, { row: move }, ...(extra.ops ?? [])], { fences: [...ctx.fences, ...dest.fences, ...links, ...publicAudience.links, ...(extra.fences ?? [])], statements: [collision, linkSet, assertSQL("(SELECT count(*) FROM chest_records WHERE kind='public-link')=?",[publicAudience.count]), ...(extra.statements ?? [])], changes: [{ item: item.id, space: item.payload.space, kind: 'move' }], audits: [{ action: 'filing.move', object: item.id, detail: { move: move.id, destination, explanation: detail.explanation, version: item.payload.current, by: detail.by } }] })
 return { item: row, move }
}
export async function undoMove(env: Bindings, s: Session, w: Who, key: string) {
 const move = await get<FilingMove>(env, 'filing_move', key)
 const ctx = await context(env, w, move.payload.item); demand(ctx, 'manage')
 insist(move.payload.status === 'filed', 'filing_not_undoable', 409)
 const item = ctx.chain.at(-1)!
 insist(item.revision === move.payload.movedRevision && item.payload.space === move.payload.space && item.payload.parent === move.payload.destination && item.payload.current === move.payload.version, 'filing_undo_stale', 409)
 const dest = await place(env, w, move.payload.space, move.payload.source)
 insist(dest.space.id === item.payload.space, 'filing_same_space_required')
 insist(ctx.links.length === move.payload.undoLinkCount, 'filing_undo_permissions_changed', 409)
 const fences: Row[] = []
 for (const previous of move.payload.undoFences ?? []) {
  const current = await get(env, previous.kind, previous.id)
  insist(current.revision === previous.revision, 'filing_undo_permissions_changed', 409); fences.push(current)
 }
 unique(await siblings(env, item.payload.space, move.payload.source), item.payload.name, item.id)
 const row = next(item, { ...item.payload, parent: move.payload.source, updatedAt: now() }), undone = next(move, { ...move.payload, status: 'undone' as const, undoneAt: now() })
 const collision = assertSQL("NOT EXISTS(SELECT 1 FROM chest_records WHERE kind='item' AND id<>? AND json_extract(payload,'$.space')=? AND json_extract(payload,'$.parent') IS ? AND json_extract(payload,'$.trash') IS NULL AND lower(json_extract(payload,'$.name'))=lower(?))", [item.id, item.payload.space, move.payload.source, item.payload.name])
 const linkSet = assertSQL("(SELECT count(*) FROM chest_records WHERE kind='link')=?", [move.payload.undoLinkCount ?? 0])
 await commit(env, s, [{ row, previous: item }, { row: undone, previous: move }], { fences: [...ctx.fences, ...dest.fences, ...fences], statements: [collision, linkSet, assertSQL("(SELECT count(*) FROM chest_records WHERE kind='public-link')=?",[move.payload.undoPublicLinkCount ?? 0])], changes: [{ item: item.id, space: item.payload.space, kind: 'move' }], audits: [{ action: 'filing.undo', object: item.id, detail: { move: key } }] })
 return { item: row, move: undone }
}
export async function visibleMove(env: Bindings, w: Who, move: Row<FilingMove>) {
 try { const ctx = await context(env, w, move.payload.item); return !ctx.state.trash && allowed(ctx, 'view') } catch { return false }
}
