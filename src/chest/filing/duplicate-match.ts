import type { Bindings } from '../../auth.server'
import type { FileVersion } from '../files/model'
import { maybe } from '../files/repo'
import type { Row } from '../model'
import type { Extraction } from '../read/jobs'
import type { Match } from './duplicate-model'

type Text = { value: string; shingles: Set<string>; row: Row<Extraction> | null }
export type Evidence = { version: FileVersion; text: Text }
// Only complete admitted text is compared; a partial scan cannot establish that the whole files are alike.
export async function evidence(env: Bindings, version: FileVersion): Promise<Evidence> {
 const row = version.text ? null : await maybe<Extraction>(env, 'extract', `extract:${version.checksum}`)
 const source = version.text || (row?.payload.state === 'done' && row.payload.truncatedAt === null ? row.payload.text : '')
 const value = source.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
 const words = value.match(/[\p{L}\p{N}]+/gu) ?? [], shingles = new Set<string>()
 for (let i = 0; i + 2 < words.length; i++) shingles.add(words.slice(i, i + 3).join(' '))
 return { version, text: { value, shingles, row } }
}
export function match(a: Evidence, b: Evidence): Match | null {
 if (a.version.checksum === b.version.checksum) return { reason: 'exact_hash', similarity: 1 }
 const x = a.text, y = b.text
 if (!x.value || !y.value) return null
 if (x.value === y.value) return { reason: 'near_content', similarity: 1 }
 // Short boilerplate and tiny excerpts are not enough evidence for a near duplicate proposal.
 if (Math.min(x.value.length, y.value.length) < 80 || Math.min(x.value.length, y.value.length) / Math.max(x.value.length, y.value.length) < .8) return null
 if (Math.min(x.shingles.size, y.shingles.size) < 8) return null
 let common = 0
 const [small, large] = x.shingles.size < y.shingles.size ? [x.shingles, y.shingles] : [y.shingles, x.shingles]
 for (const shingle of small) if (large.has(shingle)) common++
 const similarity = common / (x.shingles.size + y.shingles.size - common)
 return similarity >= .85 ? { reason: 'near_content', similarity: Math.round(similarity * 1000) / 1000 } : null
}
