import type { Bindings } from '../../auth.server'
import { decode } from '../store'
import { insist, type Row } from '../model'
import type { Item } from './model'

// Read just a page's items and their ancestors. Authorization still evaluates the
// complete path, including restricted folders outside the requested page.
export async function itemPaths(env: Bindings, keys: string[]) {
 const rows = new Map<string, Row<Item>>()
 let pending = [...new Set(keys)]
 for (let depth = 0; pending.length; depth++) {
  insist(depth <= 200, 'tree_corrupt', 503)
  const missing = new Set<string>()
  for (let offset = 0; offset < pending.length; offset += 100) {
   const batch = pending.slice(offset, offset + 100)
   const result = await env.DB.prepare(`SELECT * FROM chest_records WHERE kind='item' AND id IN (${batch.map(() => '?').join(',')})`).bind(...batch).all()
   for (const raw of result.results) {
    const row = decode<Item>(raw); rows.set(row.id, row)
    if (row.payload.parent && !rows.has(row.payload.parent)) missing.add(row.payload.parent)
   }
  }
  pending = [...missing].filter(key => !rows.has(key))
 }
 return [...rows.values()]
}
