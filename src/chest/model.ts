export type Field = { name: string; type: 'text'|'number'|'date'|'boolean'; required: boolean }
export type Grant = { principal: string; role: 'reader'|'editor'|'reviewer' }
export type Collection = { name: string; grants: Grant[] }
export type Person = { email: string; name: string; role: string; status: string; development: boolean }
export type Group = { name: string; members: string[] }
export type Schema = { name: string; fields: Field[] }
export type Version = { id: string; filename: string; checksum: string; size: number; mediaType: string; preview: string; text: string; parser: string; at: string; actor: string; reviewer: string; state: 'submitted'|'changes'|'approved'; events: { action: string; actor: string; at: string; message: string }[]; name?: string; restoredFrom?: string }
export type Document = { title: string; collection: string; schema: string; fields: Record<string, unknown>; owner: string; reviewer: string; reference: { kind: 'supplier'|'customer'|'project'; name: string } | null; reviewDate: string; expiryDate: string; approved: string | null; versions: Version[]; private: boolean; grants: Grant[]; trash: boolean; trashedBy?: string; completions: { actor: string; at: string; evidence: string; kind: string; date: string }[]; source?: unknown }
export type Row<T = any> = { id: string; kind: string; payload: T; revision: string }
export class ChestError extends Error { constructor(public code: string, public status = 400) { super(code) } }
export function insist(value: unknown, code: string, status = 400): asserts value { if (!value) throw new ChestError(code,status) }
export const id = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export const text = (value: unknown, name: string, max = 200) => { insist(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `invalid_${name}`); return value.trim() }
export function date(value: unknown): string { if (value === undefined || value === null || value === '') return ''; insist(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value,'invalid_date'); return value }
