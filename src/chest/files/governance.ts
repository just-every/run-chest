import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { validPerson } from '../access'
import { insist, now, text } from '../model'
import { context, demand, type Ctx, type Who } from './access'
import type { FileVersion, Item } from './model'
import { commit, next } from './repo'
import { get } from '../store'
import type { Schema } from '../model'
import { effectiveGovernance, prepareFiling } from './folder-metadata'

// A folder opts new originals into exact-version review. Assignment never grants access.
// A file retains its governance when moved out, so moving it cannot bypass review.
export async function versionPublication(env: Bindings, ctx: Ctx, item: Item, original: FileVersion, input: any = {}): Promise<Item> {
 const policy = effectiveGovernance(ctx, item)
 const scan = original.mediaType === 'application/pdf' || original.mediaType.startsWith('image/')
 item = await prepareFiling(env, ctx, item, input, item.createdBy || original.actor, !!policy?.scanIntake && scan)
 const version = { ...original }; delete version.review
 if (policy) version.review = { reviewer: policy.reviewer, state: 'submitted' }
 return { ...item, ...(policy ? { governance: policy, approved: item.approved ?? null } : {}), versions: [...item.versions, version], current: policy && item.approved ? item.approved : version.id, updatedAt: version.at }
}

export async function setGovernance(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'administer')
 insist(item.payload.type === 'folder', 'governance_requires_folder')
 const reviewer = await validPerson(env, input.reviewer)
 ctx.fences.push(await get(env, 'person', reviewer))
 const schema = input.schema === undefined ? item.payload.governance?.schema : input.schema
 insist(schema === undefined || schema === null || typeof schema === 'string', 'invalid_schema')
 if (schema) ctx.fences.push(await get<Schema>(env, 'schema', schema))
 const scanIntake = input.scanIntake ?? item.payload.governance?.scanIntake ?? false; insist(typeof scanIntake === 'boolean', 'invalid_scan_intake'); insist(!scanIntake || !!schema, 'scan_intake_requires_type')
 const policy = { reviewer, ...(schema ? { schema } : {}), scanIntake }
 await commit(env, s, [{ row: next(item, { ...item.payload, governance: policy }), previous: item }], { fences: ctx.fences, audits: [{ action: 'folder.governance', object: key, detail: { before: item.payload.governance ?? null, after: policy } }] })
 return { reviewer }
}

export async function reviewVersion(env: Bindings, s: Session, w: Who, key: string, version: string, input: any) {
 const ctx = await context(env, w, key), item = ctx.chain.at(-1)!; demand(ctx, 'view')
 const v = item.payload.versions.find(v => v.id === version); insist(v, 'version_not_found', 404)
 insist(v.review && v.review.reviewer === s.operator.email, 'assigned_reviewer_required', 403)
 insist(v.review.state === 'submitted', 'version_not_submitted', 409)
 insist(input.action === 'approve' || input.action === 'changes', 'invalid_action')
 if (input.action === 'approve') await prepareFiling(env, ctx, item.payload)
 const message = input.action === 'changes' ? text(input.message, 'reason', 4000) : '', at = now()
 const payload: Item = { ...item.payload, versions: item.payload.versions.map(x => x.id === version ? { ...x, review: { reviewer: v.review!.reviewer, state: input.action === 'approve' ? 'approved' : 'changes', actor: s.operator.email, at, message } } : x), ...(input.action === 'approve' ? { approved: version, current: version } : {}), updatedAt: at }
 await commit(env, s, [{ row: next(item, payload), previous: item }], { fences: ctx.fences, changes: [{ item: key, space: item.payload.space, kind: 'version' }], audits: [{ action: `version.review.${input.action}`, object: key, detail: { version, message } }] })
 return { id: key, version, approved: payload.approved ?? null }
}
