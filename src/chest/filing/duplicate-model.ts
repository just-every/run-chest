import type { FileVersion, Item } from '../files/model'
import type { Row } from '../model'

// Consolidation changes navigation, never original identity, custody, grants or version IDs.
export type DuplicateState = {
 item: string
 duplicateMerge?: { keep: string; merge: string }
 duplicateMerges?: string[]
}
export const stateId = (item: string) => `duplicate-state:${item}`
export type Match = { reason: 'exact_hash' | 'near_content' | 'retained_version' | 'source_identity'; similarity: number }
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

export type Decline = { keep: string; duplicate: string; keepVersion: string; duplicateVersion: string; at: string; by: string }
export const decisionId = (a: Item, b: Item, ai: string, bi: string) =>
 `duplicate-decline:${[`${ai}:${a.current}`, `${bi}:${b.current}`].sort().join('|')}`
export type ReferenceKind = 'prefs'|'link'|'public-link'
export type Reference = { id: string; kind: ReferenceKind; revision: string; label: string; audience: string; fields?: ('starred'|'shortcuts')[]; sourceVersion: string; version: string; blocked: string|null }
export type ReferencePlan = { keep: string; duplicate: string; keepRevision: string; duplicateRevision: string; keepVersion: string; duplicateVersion: string; references: Reference[]; at: string; by: string; state: 'pending'|'applied'|'declined'; receipt?: string }
export type ReferenceChange = { id: string; kind: ReferenceKind; revision: string; originalVersion: string; before: Record<string, unknown>; after: Record<string, unknown> }
export type ReferenceReceipt = { keep: string; duplicate: string; keepVersion: string; duplicateVersion: string; at: string; by: string; changes: ReferenceChange[]; undone: null|{at:string;by:string} }
