import { strFromU8, unzipSync } from 'fflate/browser'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, type Row } from '../model'
import type { FileVersion, Item } from '../files/model'
import { raise } from './alerts'
import { threatPolicy } from './policy'
import type { Classification, ThreatPolicy } from './model'
// Sensitivity labels a document already carries: a Microsoft Purview label in an Office file's custom properties, or a
// "Classification:" / "Sensitivity:" marking line in a text file. The label is recorded on the version; the owner's
// classification rules decide which labels count as sensitive and what they restrict.
const MARKING = /^[ \t]*(?:classification|sensitivity(?: label)?)[ \t]*:[ \t]*([A-Za-z][A-Za-z \-]{1,58}[A-Za-z])[ \t]*$/im
export function classify(bytes: Uint8Array, mediaType: string, text: string): Classification | undefined {
 if (text) { const m = MARKING.exec(text.slice(0, 20_000)); return m ? { label: m[1].trim(), source: 'Document marking' } : undefined }
 if (mediaType !== 'application/octet-stream' || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return undefined
 try {
  const part = unzipSync(bytes, { filter: f => f.name === 'docProps/custom.xml' && f.originalSize <= 1_000_000 })['docProps/custom.xml']
  if (!part) return undefined
  const xml = strFromU8(part), label = /name="MSIP_Label_[0-9a-fA-F-]{36}_Name"[^>]*>\s*<vt:lpwstr>([^<]{1,80})<\/vt:lpwstr>/.exec(xml)?.[1]?.trim()
  const enabled = /name="MSIP_Label_[0-9a-fA-F-]{36}_Enabled"[^>]*>\s*<vt:lpwstr>\s*true\s*<\/vt:lpwstr>/i.test(xml)
  return label && enabled ? { label, source: 'Microsoft sensitivity label' } : undefined
 } catch { return undefined }
}
export const sensitive = (p: ThreatPolicy, c?: Classification) => !!c && p.classification.labels.some(l => l.toLowerCase() === c.label.toLowerCase())
export const currentVersion = (item: Item) => item.versions.find(v => v.id === item.current) as (FileVersion & { classification?: Classification }) | undefined
// Classification-based sharing: a file whose current version carries a sensitive label is never exposed outside the
// organization (external people, guests, domain or public links, deliveries) while the rule is on, and an existing
// outside link or grant to it stops on its next request.
export async function externalBlock(env: Bindings, item: Item) {
 const c = currentVersion(item)?.classification; if (!c) return null
 const p = await threatPolicy(env); return p.classification.blockExternal && sensitive(p, c) ? c : null
}
export async function refuseExternal(env: Bindings, item: Item) { const c = await externalBlock(env, item); if (c) throw new ChestError('classification_blocks_external', 403) }
export async function noteClassified(env: Bindings, s: Session, row: Row<Item>) {
 const v = currentVersion(row.payload), c = v?.classification; if (!c) return
 const p = await threatPolicy(env); if (!sensitive(p, c)) return
 await raise(env, s, { kind: 'classification', rule: `Sensitivity label ${c.label}`, subject: { type: 'account', id: s.operator.email, email: s.operator.email }, action: p.classification.blockExternal ? 'restrict' : 'alert', paused: false, item: row.id, checksum: v!.checksum, detail: `${c.label} (${c.source})`, at: new Date().toISOString() })
}
