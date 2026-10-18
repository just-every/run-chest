import { insist, text, type Row } from '../model'
import { name, type Item, type FileVersion } from '../files/model'

export type Actions = { rename?: string; tag?: string; destination?: string | null; convert?: boolean; unzip?: boolean }
export type Fence = Pick<Row, 'id' | 'kind' | 'revision'>
export type BatchItem = { item: string; name: string; version: string; revision: string; before: Item; afterName: string; destination: string | null; path: string; fences: Fence[]; policies: string; derivatives: { path: string; version: FileVersion }[]; state: 'ready'|'blocked'|'applied'|'undone'; reason?: string; appliedRevision?: string; created?: Fence[] }
export type Batch = { by: string; at: string; actions: Actions; items: BatchItem[] }
export function actions(input: any): Actions {
 insist(input && typeof input === 'object' && !Array.isArray(input), 'filing_actions_required')
 insist(Object.keys(input).every(k => ['rename','tag','destination','convert','unzip'].includes(k)), 'invalid_filing_action')
 const result: Actions = {}
 if (input.rename) { result.rename = text(input.rename, 'rename', 240); insist(!/\{(?!name\}|stem\}|extension\})/.test(result.rename), 'invalid_rename_template') }
 if (input.tag) result.tag = text(input.tag, 'tag', 80)
 if ('destination' in input) { insist(input.destination === null || typeof input.destination === 'string', 'invalid_destination'); result.destination = input.destination || null }
 for (const k of ['convert','unzip'] as const) { insist(input[k] === undefined || typeof input[k] === 'boolean', 'invalid_filing_action'); if (input[k]) result[k] = true }
 insist(Object.keys(result).length && !(result.convert && result.unzip), 'filing_actions_required')
 return result
}
export function renamed(original: string, template?: string) {
 if (!template) return original
 const dot = original.lastIndexOf('.'), stem = dot > 0 ? original.slice(0, dot) : original, extension = dot > 0 ? original.slice(dot) : ''
 return name(template.replace(/\{(name|stem|extension)\}/g, (_, k) => ({ name: original, stem, extension })[k as 'name']))
}
export const fence = (row: Row): Fence => ({ id: row.id, kind: row.kind, revision: row.revision })
