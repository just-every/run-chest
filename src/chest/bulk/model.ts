export const actions = ['move','copy','share','trash','restore','download'] as const
export type BulkAction = typeof actions[number]
export type BulkEntry = { item: string; root: number; version?: string }
export type BulkJob = { by: string; at: string; action: BulkAction; input: Record<string, unknown>; entries: BulkEntry[]; state: 'active'|'cancelled' }
export type BulkReceipt = { job: string; index: number; item: string; outcome: 'succeeded'|'refused'|'ready'; reason?: string; result?: string; at: string }
export const receiptKey = (job: string, index: number) => `bulk-result:${job}:${index}`
