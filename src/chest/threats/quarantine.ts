import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { decode, get } from '../store'
import { insist, now, text } from '../model'
import { commit, next } from '../files/repo'
import { canAdmin, requireAdmin } from '../administration/roles'
import { context, demand, who } from '../files/access'
import { scanKey } from './guard'
import type { Scan } from './model'
// The quarantine history: every original the scanner holds or has held, with the verdict and who released it. Names
// and links appear only to a reviewer who can open the file; security authority alone opens no content.
async function holders(env: Bindings, checksum: string) {
 return (await env.DB.prepare("SELECT r.* FROM chest_records r WHERE r.kind='item' AND EXISTS(SELECT 1 FROM json_each(r.payload,'$.versions') v WHERE json_extract(v.value,'$.checksum')=?) ORDER BY r.id").bind(checksum).all()).results.map(decode)
}
export async function quarantineView(env: Bindings, s: Session) {
 const rows = (await env.DB.prepare("SELECT * FROM chest_records WHERE kind='scan' AND json_extract(payload,'$.state') IN ('pending','infected','released') ORDER BY json_extract(payload,'$.createdAt') DESC LIMIT 200").all()).results.map(decode<Scan>), w = await who(env, s), out = []
 for (const r of rows) {
  const p = r.payload; if (!(p.actor === s.operator.email || await canAdmin(env, s, 'sharing-security', p.actor.includes('@') ? p.actor : undefined))) continue
  const files = []
  for (const item of await holders(env, p.checksum)) { try { demand(await context(env, w, item.id), 'view'); files.push({ id: item.id, name: item.payload.name }) } catch { files.push({ id: null, name: 'Restricted item' }) } }
  out.push({ checksum: p.checksum, size: p.size, state: p.state, uploadedBy: p.actor, at: p.createdAt, signature: p.signature ?? null, engine: p.engine ?? null, definitions: p.definitions ?? null, scannedAt: p.scannedAt ?? null, error: p.error ?? null, attempts: p.attempts, release: p.release ?? null, files, releasable: p.state === 'infected' && p.actor !== s.operator.email && await canAdmin(env, s, 'sharing-security', p.actor.includes('@') ? p.actor : undefined) })
 }
 return out
}
// Releasing is the false-positive path: only an admin whose security scope covers the uploader, never the uploader,
// and always with a reason. The original was never deleted, so release restores every door to the same bytes.
export async function releaseScan(env: Bindings, s: Session, checksum: string, input: any) {
 const row = await get<Scan>(env, 'scan', scanKey(checksum)), p = row.payload
 insist(p.state === 'infected', 'not_quarantined', 409); insist(p.actor !== s.operator.email, 'release_by_uploader_refused', 403)
 await requireAdmin(env, s, 'sharing-security', p.actor.includes('@') ? p.actor : undefined)
 const reason = text(input.reason, 'reason', 500), release = { by: s.operator.email, at: now(), reason }
 await commit(env, s, [{ row: next(row, { ...p, state: 'released', release }), previous: row }], { audits: [{ action: 'threats.malware.release', object: row.id, detail: { checksum, signature: p.signature ?? null, engine: p.engine ?? null, uploadedBy: p.actor, reason } }] })
 return (await quarantineView(env, s)).find(q => q.checksum === checksum) ?? { checksum, state: 'released', release }
}
