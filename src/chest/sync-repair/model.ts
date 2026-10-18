import type { Row } from '../model'
export type LocalFile = { item: string; path: string; baseVersion: string | null; localChecksum: string | null; localSize: number; state: 'queued'|'paused'|'conflicted'|'failed'|'up-to-date'; reason: string; conflictItem?: string }
export type Report = { owner: string; device: string; folder: string; clientVersion: string; cache: { freeBytes: number }; files: LocalFile[]; at: string; paused: boolean }
export type Grant = { owner: string; device: string; folder: string; report: string; expiresAt: number; by: string; consumed?: boolean }
export const reportKey = (device: string, folder: string) => `sync-report:${JSON.stringify([device,folder])}`
export const grantKey = (device: string, folder: string) => `sync-grant:${JSON.stringify([device,folder])}`
export type Diagnosis = { id: string; revision: string; device: string; folder: string; deviceName: string; folderName: string; at: string; freeBytes: number; paused: boolean; canResume: boolean; resumeAuthorized?: boolean; files: { item: string; path: string; state: string; reason: string; localChecksum?: string|null; remoteChecksum?: string; conflictItem?: string }[]; state: string }
export type ReportRow = Row<Report>
