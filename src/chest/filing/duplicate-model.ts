import type { FileVersion, Item } from '../files/model'
import type { Row } from '../model'

// Consolidation changes navigation, never original identity, custody, grants or version IDs.
export type DuplicateState = {
 item: string
 duplicateMerge?: { keep: string; merge: string }
 duplicateMerges?: string[]
}
export const stateId = (item: string) => `duplicate-state:${item}`
export type Match = { reason: 'exact_hash' | 'near_content'; similarity: number }
export type Merge = Match & {
 keep: string; duplicate: string; at: string; by: string
 keepVersion: string; duplicateVersion: string
 undone: null | { at: string; by: string }
}
export const current = (item: Item) => item.versions.find(v => v.id === item.current)
export function fileBrief(row: Row<Item>) {
 const v = current(row.payload)
 return { id: row.id, name: row.payload.name, space: row.payload.space, version: v?.id ?? null, checksum: v?.checksum ?? null,
  versions: row.payload.versions.map(v => ({ id: v.id, checksum: v.checksum, at: v.at, actor: v.actor, arrival: v.arrival })) }
}
export type LineageVersion = FileVersion & { sourceItem: string }
