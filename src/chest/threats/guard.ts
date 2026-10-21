import { waitUntil } from 'cloudflare:workers'
import type { Bindings } from '../../auth.server'
import { ChestError, id, now } from '../model'
import type { Scan } from './model'
// Every door that hands out original bytes or anything rendered from them (preview, download, range, sync, token,
// link, transfer, archive, editor, signing, page images) asks here first. While a malware scanner is connected, new
// originals wait in quarantine until it answers, and an infected original stays held until an authorized reviewer
// releases it. A verdict outlives a disconnected scanner. Before any scanner is connected, nothing is scanned.
export const scanKey = (checksum: string) => `scan:${checksum}`
// Registered in the same step that stores the bytes, before any version can name them: only while a scanner is
// connected, and only once per original. True when this call began a new scan.
export async function registerScan(env: Bindings, checksum: string, size: number, actor: string) {
 const scan: Scan = { checksum, size, state: 'pending', actor, createdAt: now(), attempts: 0 }
 const r = await env.DB.prepare("INSERT OR IGNORE INTO chest_records(id,kind,payload,revision) SELECT ?,'scan',?,? WHERE EXISTS(SELECT 1 FROM chest_scanner WHERE id=1)").bind(scanKey(checksum), JSON.stringify(scan), id()).run()
 const started = (r.meta?.changes ?? 0) > 0
 if (started) kickScans(env)
 return started
}
export function kickScans(env: Bindings) { try { waitUntil(import('./scanner').then(m => m.sweepScans(env))) } catch (e) { console.error('chest scanning', e) } }
export async function cleared(env: Bindings, checksum: string, size: number) {
 const row = await env.DB.prepare("SELECT payload FROM chest_records WHERE id=? AND kind='scan'").bind(scanKey(checksum)).first<{ payload: string }>()
 if (row) {
  const scan = JSON.parse(row.payload) as Scan
  if (scan.state === 'clean' || scan.state === 'released') return
  throw new ChestError(scan.state === 'infected' ? 'quarantined' : 'scan_pending', 423)
 }
 // An original stored before the scanner was connected is scanned before it is first served.
 if (await registerScan(env, checksum, size, 'chest:existing-original')) throw new ChestError('scan_pending', 423)
}
