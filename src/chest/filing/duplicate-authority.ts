import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { context, demand, type Ctx, type Who } from '../files/access'
import { insist } from '../model'
import { ownerPredicate } from '../store'

export function ownerGuards(s: Session, contexts: Ctx[]) {
 const owner = ownerPredicate(s), expiries = new Set<string>()
 // A decision is refused if any supporting live grant expires before its atomic publication.
 for (const c of contexts) for (const g of [...c.space.payload.members, ...c.chain.flatMap(n => n.payload.grants)])
  if (g.expires && Date.parse(g.expires) > Date.now()) expiries.add(g.expires)
 return [{ sql: `INSERT INTO chest_assert(ok) SELECT CASE WHEN (${owner.sql}) THEN 1 ELSE 0 END`, params: owner.params },
  ...[...expiries].map(expiry => ({ sql: "INSERT INTO chest_assert(ok) SELECT CASE WHEN julianday(?)>julianday('now') THEN 1 ELSE 0 END", params: [expiry] }))]
}
export const contextFences = (contexts: Ctx[]) => contexts.flatMap(c => [...c.fences, ...c.links])
export async function managedPair(env: Bindings, s: Session, w: Who, input: {keep?:unknown;duplicate?:unknown}) {
 insist(s.operator.role === 'owner', 'owner_approval_required', 403)
 insist(typeof input.keep === 'string' && typeof input.duplicate === 'string' && input.keep !== input.duplicate, 'invalid_duplicate_pair')
 const keep = await context(env, w, input.keep), duplicate = await context(env, w, input.duplicate)
 demand(keep, 'manage'); demand(duplicate, 'manage')
 const a = keep.chain.at(-1)!, b = duplicate.chain.at(-1)!
 insist(a.payload.type === 'file' && b.payload.type === 'file', 'not_a_file')
 return { keep, duplicate, a, b }
}
