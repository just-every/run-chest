import { insist } from '../model'
import type { FileVersion, Item } from './model'

export type LinkVersionChoice = { versionMode: 'current'|'approved'; version?: never } | { versionMode: 'pinned'; version: string }
export type LinkVersionInput = { versionMode?: unknown; version?: unknown }
const hasVersion = (input: LinkVersionInput) => input.version !== undefined && input.version !== null && input.version !== ''

// Call only after demanding the creator's current share right on this item; publish with that item's access fences.
// Approved-only links require this file's governance and exact approved pointer. Neither its current version nor
// an earlier review decision can substitute for that pointer, and ordinary files cannot promise approved access.
export function normalizeLinkVersion(item: Item, input: LinkVersionInput): LinkVersionChoice {
 const mode = input.versionMode === undefined ? 'current' : input.versionMode
 insist(mode === 'current' || mode === 'pinned' || mode === 'approved', 'invalid_version_mode')
 if (mode === 'approved') {
  insist(item.type === 'file' && item.governance, 'approved_versions_unavailable')
  insist(!hasVersion(input), 'version_requires_pinned')
  insist(linkedVersion(item, { versionMode: 'approved' }), 'approved_version_unavailable')
  return { versionMode: 'approved' }
 }
 if (mode === 'current') {
  insist(!hasVersion(input), 'version_requires_pinned')
  if (item.type === 'file') insist(item.versions.some(v => v.id === item.current), 'version_not_found', 404)
  return { versionMode: 'current' }
 }
 // Folder snapshots require their own reachable-child manifest; a file version ID never selects a folder tree.
 insist(item.type === 'file', 'pinned_version_requires_file')
 insist(typeof input.version === 'string' && input.version.length > 0, 'version_required')
 insist(item.versions.some(v => v.id === input.version), 'version_not_found', 404)
 return { versionMode: 'pinned', version: input.version }
}

// Resolve from the freshly authorized item's retained originals on every landing, preview and download request.
// Missing mode is the original current-link format. Invalid persisted choices and missing originals fail closed;
// a pinned original never silently becomes current. Approved-only follows the authoritative pointer only while
// that retained version is approved. This selector grants no access to an item or its ancestors.
export function linkedVersion(item: Item, choice: LinkVersionInput): FileVersion | null {
 if (item.type !== 'file') return null
 const mode = choice.versionMode === undefined ? 'current' : choice.versionMode
 let selected: string | null
 if (mode === 'current' && !hasVersion(choice)) selected = item.current
 else if (mode === 'approved' && !hasVersion(choice) && item.governance && item.approved) {
  return item.versions.find(v => v.id === item.approved && v.review?.state === 'approved') ?? null
 }
 else if (mode === 'pinned' && typeof choice.version === 'string' && choice.version.length > 0) selected = choice.version
 else return null
 return item.versions.find(v => v.id === selected) ?? null
}
