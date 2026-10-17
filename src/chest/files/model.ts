import { insist } from '../model'
// Everyday files: team spaces and personal areas hold folders and files. Roles are cumulative (ROLE-001); a personal
// area's owner holds every right in it, and file-level grants there use viewer, commenter and editor.
export type Role = 'viewer'|'commenter'|'contributor'|'editor'|'content_manager'|'manager'|'owner'
export const rank: Record<Role,number> = { viewer:1, commenter:2, contributor:3, editor:4, content_manager:4, manager:5, owner:6 }
export const spaceRoles: Role[] = ['viewer','commenter','contributor','content_manager','manager']
export const shareRoles: Role[] = ['viewer','commenter','editor']
export type Grant = { principal: string; role: Role; by: string; at: string; expires?: string; message?: string }
export type Space = { name: string; kind: 'team'|'personal'; owner: string; formerOwner?: string; members: Grant[]; settings: { noDownload: boolean; editorSharing: boolean }; createdBy: string; createdAt: string }
export type Arrival = 'upload'|'sync client'|'restore'|'copy'|'conflict copy'
export type FileVersion = { id: string; filename: string; checksum: string; size: number; mediaType: string; preview: string; text: string; parser: string; at: string; actor: string; arrival: Arrival; name: string; restoredFrom?: string; device?: string }
export type Trash = { by: string; at: string; role: Role }
export type Item = { space: string; parent: string|null; type: 'folder'|'file'; name: string; createdBy: string; createdAt: string; updatedAt: string; restricted: boolean; noDownload: boolean; grants: Grant[]; trash: Trash|null; versions: FileVersion[]; current: string|null }
export type Link = { item: string; tokenHash: string; audience: 'organisation'; role: Role; discoverable: boolean; createdBy: string; at: string }
export type Notice = { to: string; type: string; item: string|null; request?: string; from: string; message: string; at: string; read: boolean; email: string }
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
