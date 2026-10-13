import { insist, text, date, type Schema } from './model'

export type FieldIssue = { field: string; code: string; message: string }

export function schemaDefinition(input: any): Schema {
  insist(Array.isArray(input.fields) && input.fields.length <= 30, 'invalid_schema')
  const names = new Set<string>()
  const fields = input.fields.map((field: any) => {
    insist(field && typeof field === 'object' && !Array.isArray(field), 'invalid_schema')
    const name = text(field.name, 'field', 80)
    insist(name === field.name && !names.has(name) && ['text', 'number', 'date', 'boolean'].includes(field.type) && typeof field.required === 'boolean', 'invalid_schema')
    names.add(name)
    return {name, type: field.type, required: field.required}
  })
  return {name: text(input.name, 'name'), fields}
}

// Diagnose retained values and admit submitted values using the same rules.
// Diagnosis never rewrites authoritative document fields after a schema edit.
export function fieldIssues(schema: Schema, fields: unknown): FieldIssue[] {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return [{field: '', code: 'invalid_fields', message: 'Fields must be a JSON object.'}]
  const values = fields as Record<string, unknown>, issues: FieldIssue[] = []
  for (const key of Object.keys(values)) if (!schema.fields.some(f => f.name === key)) issues.push({field: key, code: 'unknown_field', message: 'Field is absent from the current document type; its saved value is retained.'})
  for (const field of schema.fields) {
    const value = Object.hasOwn(values, field.name) ? values[field.name] : undefined
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      if (field.required) issues.push({field: field.name, code: `required_field_${field.name}`, message: 'Required by the current document type; no value is saved.'})
      continue
    }
    let valid = field.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : field.type === 'boolean' ? typeof value === 'boolean' : typeof value === 'string'
    if (valid && field.type === 'date') { try { date(value) } catch { valid = false } }
    if (!valid) issues.push({field: field.name, code: `invalid_field_${field.name}`, message: `Saved value must be ${field.type === 'date' ? 'a real calendar date (YYYY-MM-DD)' : `of type ${field.type}`} under the current document type.`})
    else if (typeof value === 'string' && value.length > 4000) issues.push({field: field.name, code: 'field_too_long', message: 'Saved text exceeds the supported field length.'})
  }
  return issues
}

export function validateFields(schema: Schema, fields: unknown): Record<string, unknown> {
  const issues = fieldIssues(schema, fields)
  insist(!issues.length, issues[0]?.code || 'invalid_fields')
  return fields as Record<string, unknown>
}
