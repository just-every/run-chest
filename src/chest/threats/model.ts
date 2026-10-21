// Content threats (SECURITY-002). A scan verdict belongs to an original's SHA-256, so every version, copy and restore
// of the same bytes shares it. Alerts and pauses name the account, device or token and the rule that fired.
export type ScanState = 'pending' | 'clean' | 'infected' | 'released'
export type Scan = { checksum: string; size: number; state: ScanState; actor: string; createdAt: string; attempts: number; lastAttemptAt?: string; error?: string; signature?: string; engine?: string; definitions?: string; scannedAt?: string; release?: { by: string; at: string; reason: string } }
export type Action = 'alert' | 'pause'
export type DownloadRule = { files: number; bytes: number; action: Action }
export type DeletionRule = { items: number; action: Action }
export type GroupRules = { downloads?: DownloadRule; deletions?: DeletionRule }
export type ThreatPolicy = { windowMinutes: number; downloads: DownloadRule; deletions: DeletionRule; groups: Record<string, GroupRules>; classification: { labels: string[]; blockExternal: boolean } }
// The stated defaults: more than 500 files or 5 GB (decimal) downloaded, or more than 200 items trashed or deleted,
// by one account, device or token within 10 minutes alerts admins. Labelled sensitive files stay inside the organization.
export const DEFAULT_POLICY: ThreatPolicy = { windowMinutes: 10, downloads: { files: 500, bytes: 5_000_000_000, action: 'alert' }, deletions: { items: 200, action: 'alert' }, groups: {}, classification: { labels: ['Confidential', 'Highly Confidential', 'Restricted', 'Secret'], blockExternal: true } }
export type Subject = { type: 'account' | 'device' | 'token'; id: string; email: string }
export type Alert = { kind: 'downloads' | 'deletions' | 'malware' | 'classification'; rule: string; subject: Subject | null; count?: number; bytes?: number; windowStart?: string; action: Action | 'quarantine' | 'restrict'; paused: boolean; item?: string | null; checksum?: string; detail?: string; at: string }
export type Pause = { subject: Subject; rule: string; alert: string | null; by: string; at: string; reason: string; resumedAt?: string; resumedBy?: string }
export type Classification = { label: string; source: 'Microsoft sensitivity label' | 'Document marking' }
