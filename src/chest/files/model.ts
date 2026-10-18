import { insist } from '../model'
// Everyday files: team spaces and personal areas hold folders and files. Roles are cumulative (ROLE-001); a personal
// area's owner holds every right in it, and file-level grants there use viewer, commenter and editor.
export type Role = 'viewer'|'commenter'|'contributor'|'editor'|'content_manager'|'manager'|'owner'
export const rank: Record<Role,number> = { viewer:1, commenter:2, contributor:3, editor:4, content_manager:4, manager:5, owner:6 }
export const spaceRoles: Role[] = ['viewer','commenter','contributor','content_manager','manager']
export const shareRoles: Role[] = ['viewer','commenter','editor']
export type Grant = { principal: string; role: Role; by: string; at: string; expires?: string; message?: string }
export type Space = { name: string; kind: 'team'|'personal'; owner: string; formerOwner?: string; members: Grant[]; settings: { noDownload: boolean; editorSharing: boolean }; storageLimitBytes?: number | null; createdBy: string; createdAt: string }
export type Arrival = 'email'|'upload'|'sync client'|'restore'|'copy'|'conflict copy'|'browser edit'|'created'
export type FileVersion = { id: string; filename: string; checksum: string; size: number; mediaType: string; preview: string; text: string; parser: string; at: string; actor: string; arrival: Arrival; name: string; restoredFrom?: string; device?: string; transformation?: { sourceItem: string; sourceVersion: string; operation: 'convert'|'unzip' }; template?: { id: string; name: string; version: string; sourceVersion?: string }; review?: { reviewer: string; state: 'submitted'|'approved'|'changes'; actor?: string; at?: string; message?: string } }
export type Trash = { by: string; at: string; role: Role }
export type FolderGovernance = { reviewer: string; schema?: string }
export type ItemFiling = { schema: string; fields: Record<string, unknown>; owner: string }
export type Item = { space: string; parent: string|null; type: 'folder'|'file'; name: string; createdBy: string; createdAt: string; updatedAt: string; restricted: boolean; noDownload: boolean; grants: Grant[]; trash: Trash|null; versions: FileVersion[]; current: string|null; tags?: string[]; governance?: FolderGovernance; filing?: ItemFiling; approved?: string|null }
export type Link = { item: string; tokenHash: string; audience: 'organisation'|'restricted'; expires?: string|null; role: Role; discoverable: boolean; createdBy: string; at: string }
// A link for anyone (SHARE-001): no account; optional password (PBKDF2 hash only), expiry and download limit. Revoking
// keeps the record so the link answers a plain page and the audit keeps its history.
export type PublicLink = { role?: 'viewer'|'commenter'; snapshot?: import('./link-snapshots').SnapshotFile[]; audience?: 'public'|'guests'|'domain'; guests?: string[]; domain?: string; versionMode?: 'current'|'pinned'|'approved'; version?: string; download?: boolean; custodian?: string; item: string; tokenHash: string; password: { salt: string; hash: string; iterations: number } | null; expires: string | null; limit: number | null; downloads: number; createdBy: string; at: string; revokedAt?: string; revokedBy?: string }
// An upload-only file request (SHARE-002): anyone with the link adds files to one folder and sees nothing else.
export type FileRequest = { custodian?: string; folder: string; title: string; message: string; types: string[]; maxBytes: number; deadline: string | null; tokenHash: string; createdBy: string; at: string; uploads: number; closedAt?: string; closedBy?: string }
export type Notice = { to: string; type: string; item: string|null; request?: string; undo?: string; from: string; message: string; at: string; read: boolean; email: string }
export type AccessRequest = { item: string; requester: string; role: Role; message: string; at: string; expiresAt: string; status: 'pending'|'approved'|'declined'|'expired'; approvers: string[]; decidedBy?: string; decidedAt?: string; grantedRole?: Role }
export type Prefs = { starred: string[]; shortcuts: string[] }
export type Expiry = { item: string; principal: string; expires: string; by: string; noticeAt?: string; expiredAt?: string }
export const day = 86_400_000
export const personalId = (email: string) => `personal:${email}`
export function name(value: unknown, field = 'name') {
 insist(typeof value === 'string' && value.trim().length > 0 && value.length <= 240 && !/[\x00-\x1f\/\\]/.test(value) && value.trim() !== '.' && value.trim() !== '..', `invalid_${field}`)
 return value.trim()
}
export function role(value: unknown, allowed: Role[]) { insist(typeof value === 'string' && (allowed as string[]).includes(value), 'invalid_role'); return value as Role }
export const live = (g: { expires?: string }, at = Date.now()) => !g.expires || Date.parse(g.expires) > at
