export type JournalEntry = { id: string; at: string; items: string[]; documents: string[]; identities: string[]; checksums: string[] }
export type ErasureTarget = { store: string; status: 'complete'|'pending'|'held'; detail: string; backup?: string }
export type ErasureReceipt = JournalEntry & { by: string; state: 'pending'|'held'|'complete'; targets: ErasureTarget[]; originals: { pending: string[]; removed: string[]; shared: string[] }; versions: number; bytes: number; scope: string }
export type BackupLocation = { name: string; locator: string; locatorSha256: string; retention: string }
export type Hold = { scope: 'item'|'document'|'identity'; subject: string; reason: string; active: boolean }
