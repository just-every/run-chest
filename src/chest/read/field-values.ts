import { date, insist } from '../model'

export const emptyValue = (v: unknown) => v === undefined || v === null || typeof v === 'string' && !v.trim()
export const tinField = (typeName: string, name: string) => /\bw[\s-]?9\b/i.test(typeName) && /\b(tin|ssn|ein)\b|tax.*(id|identification)/i.test(name)
// Only the last four digits of a W-9 identifier enter proposals, typed metadata or decision audit details.
export function maskedTin(value: unknown): string | null {
 const digits = String(value ?? '').replace(/\D/g,'')
 return digits.length >= 4 ? `***-**-${digits.slice(-4)}` : null
}
export function coerceField(type: string, value: unknown) {
 if (type === 'number') { const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g,'')); insist(String(value).trim() !== '' && Number.isFinite(n), 'invalid_field_value'); return n }
 if (type === 'boolean') { insist(value === true || value === false || value === 'true' || value === 'false', 'invalid_field_value'); return value === true || value === 'true' }
 if (type === 'date') { insist(typeof value === 'string' && value !== '', 'invalid_field_value'); return date(value) }
 insist(typeof value === 'string' && value.trim() && value.length <= 4000, 'invalid_field_value'); return (value as string).trim()
}
export function decidedValue(typeName: string, field: {name: string;type: string}, value: unknown) {
 if (tinField(typeName,field.name)) { const masked = maskedTin(value); insist(masked, 'invalid_tin_last_four'); return masked }
 return coerceField(field.type,value)
}
