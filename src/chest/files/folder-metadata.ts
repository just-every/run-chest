import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { fieldIssues, validateFields } from '../fields'
import { insist, type Person, type Schema } from '../model'
import { get, list } from '../store'
import { typedValues } from '../ui-fields'
import { allowed, context, demand, type Ctx, type Who } from './access'
import type { FolderGovernance, Item } from './model'
import { commit, next } from './repo'

// Match version publication: nearest governed folder wins; a moved file keeps its own policy.
export function effectiveGovernance(ctx: Ctx, item: Item): FolderGovernance | undefined {
 return [...ctx.chain].reverse().find(n => n.payload.type === 'folder' && n.payload.governance)?.payload.governance ?? item.governance
}

// Called before every original publication, including restore, copy, editor saves and anonymous arrivals.
// Definitions and accountable people join the same SQL snapshot fences as current access.
export async function prepareFiling(env: Bindings, ctx: Ctx, item: Item, input: any = {}, actor = item.createdBy, allowMissingScanValues = false): Promise<Item> {
 const policy = effectiveGovernance(ctx, item), schemaId = policy?.schema ?? item.filing?.schema
 if (!schemaId || item.type !== 'file') return item
 const schema = await get<Schema>(env, 'schema', schemaId); ctx.fences.push(schema)
 insist(input.schema === undefined || input.schema === schemaId, 'folder_type_required')
 const formFields = Object.keys(input).some(k => k.startsWith(`typed:${schemaId}:`))
 const fields = input.fields !== undefined ? input.fields : formFields ? typedValues(schema, input) : item.filing?.schema === schemaId ? item.filing.fields : {}
 validateFields(allowMissingScanValues ? { ...schema.payload, fields: schema.payload.fields.map(f => ({ ...f, required: false })) } : schema.payload, fields)
 const email = input.owner ?? item.filing?.owner ?? actor
 insist(typeof email === 'string', 'invalid_person')
 const person = await get<Person>(env, 'person', email.toLowerCase()); insist(person.payload.status !== 'inactive', 'inactive_person'); ctx.fences.push(person)
 return { ...item, ...(policy ? { governance: policy } : {}), filing: { schema: schemaId, fields: structuredClone(fields), owner: person.id } }
}

export async function updateItemFiling(env: Bindings, s: Session, w: Who, key: string, input: any) {
 const ctx = await context(env, w, key); demand(ctx, 'manage')
 const item = ctx.chain.at(-1)!; insist(item.payload.type === 'file', 'not_a_file')
 insist(effectiveGovernance(ctx, item.payload)?.schema || item.payload.filing?.schema, 'folder_type_required')
 const payload = await prepareFiling(env, ctx, item.payload, input)
 const row = next(item, payload)
 await commit(env, s, [{ row, previous: item }], { fences: ctx.fences, changes: [{ item: key, space: payload.space, kind: 'metadata' }], audits: [{ action: 'item.filing', object: key, detail: { schema: payload.filing!.schema } }] })
 return row
}

// The caller supplies an authorized context; diagnoses must never scan inaccessible records.
export async function metadataView(env: Bindings, ctx: Ctx) {
 demand(ctx, 'view')
 const item = ctx.chain.at(-1)!.payload, policy = effectiveGovernance(ctx, item), schemaId = policy?.schema ?? item.filing?.schema
 const schema = schemaId ? await get<Schema>(env, 'schema', schemaId) : null
 const fields = item.filing?.fields ?? {}
 return { scanIntake: policy?.scanIntake ?? false, schema, filing: item.filing ?? null, issues: schema && item.type === 'file' ? fieldIssues(schema.payload, fields) : [], types: item.type === 'folder' && allowed(ctx, 'administer') ? await list<Schema>(env, 'schema') : [] }
}
