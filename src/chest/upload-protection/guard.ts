import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { sessionPredicate } from '../store'
import { ChestError, id, now, type Row } from '../model'
import { digest } from '../blobs'
import { commit, fresh, maybe, next } from '../files/repo'
import { deliver, notice } from '../files/notify'
import { principalCanAdmin } from '../administration/roles'
import type { Item } from '../files/model'
import type { Incident, HeldChange } from './model'
import { signals } from './detect'
export const protectionKey = async (s: Session) => `upload-protection:${await digest(new TextEncoder().encode(s.id))}`
// All safe publications carry an absence/unpaused predicate into the same transaction as their immutable version.
function fence(s: Session, key: string) {
 const current = sessionPredicate(s)
 ;(s as any).predicate = { sql: `(${current.sql}) AND NOT EXISTS(SELECT 1 FROM chest_records WHERE id=? AND json_extract(payload,'$.paused')=1)`, params: [...current.params, key] }
}
export async function guardDownload(env: Bindings, s: Session, item: Row<Item>) {
 const incident = await maybe<Incident>(env, 'upload-protection', await protectionKey(s))
 if (incident?.payload.paused && incident.payload.changes.some(c => c.space === item.payload.space && (c.parent === item.payload.parent || c.item === item.id))) throw new ChestError('incident_downloads_paused', 423)
}
export async function protect(env: Bindings, s: Session, target: { item?: Row<Item>; space: string; parent: string | null; name: string }, bytes: Uint8Array | null, retained?: { checksum: string; size: number }) {
 const key = await protectionKey(s), previous = await maybe<Incident>(env, 'upload-protection', key), source = target.item?.payload.versions.find(v => v.id === target.item!.payload.current)
 const sample = bytes?.subarray(0,65536) ?? (retained ? new Uint8Array(await (await env.BLOBS.get(`sha256/${retained.checksum}`, { range: { offset: 0, length: Math.min(65536,retained.size) } }))!.arrayBuffer()) : new Uint8Array())
 const priorObject = source ? await env.BLOBS.get(`sha256/${source.checksum}`, { range: { offset: 0, length: Math.min(65536,source.size) } }) : null
 const prior = priorObject ? new Uint8Array(await priorObject.arrayBuffer()) : undefined
 const reasons = signals(target.name, sample, prior)
 if (!previous?.payload.paused && !reasons.length) { fence(s,key); return }
 // A separate closed incident remains immutable history; a new source pause begins with a new record.
 if (previous && !previous.payload.paused) {
  const archived = fresh('upload-incident', previous.payload)
  await commit(env,s,[{row:archived},{row:previous,previous,remove:true}])
  return protect(env,s,target,bytes,retained)
 }
 if(previous && payloadLimit(previous.payload)) throw new ChestError('incident_review_required',423)
 const checksum = retained?.checksum ?? await digest(bytes!), size = retained?.size ?? bytes!.length
 if (bytes) { await env.BLOBS.put(`sha256/${checksum}`,bytes); const check = await env.BLOBS.get(`sha256/${checksum}`); if (!check || await digest(new Uint8Array(await check.arrayBuffer())) !== checksum) throw new ChestError('storage_verification_failed',503) }
 const payload: Incident = previous?.payload ?? { actor:s.operator.email, source:await digest(new TextEncoder().encode(s.id)), device:(s as any).device ?? null, detectedAt:now(), paused:true, changes:[] }
 // Repeated identical retries are one held original. No completion or later successful version is invented.
 const duplicate = payload.changes.some(c => c.item === (target.item?.id ?? null) && c.parent === target.parent && c.name === target.name && c.checksum === checksum && c.state === 'held')
 const change: HeldChange = { id:id(), item:target.item?.id ?? null, space:target.space, parent:target.parent, name:target.name, source:source?.id ?? null, checksum,size,at:now(),reasons:reasons.length ? reasons : ['Upload source paused after a suspect change'],state:'held' }
 const row = previous ? next(previous,{...payload,changes:duplicate?payload.changes:[...payload.changes,change]}) : fresh('upload-protection',{...payload,changes:[change]},key)
 const alerts = []
 if (!previous) {
  const operators = (await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active'").all<{email:string}>()).results
  for (const p of operators) if (p.email === s.operator.email || await principalCanAdmin(env,p.email,'sharing-security',s.operator.email)) alerts.push(notice(p.email,'security.incident',null,s.operator.email,`Uploads paused for ${s.operator.email}${payload.device?' on device '+payload.device:''} at ${payload.detectedAt}. Suspect originals were held before publication. Review Upload protection in Files.`))
 }
 await commit(env,s,[{row,previous:previous??undefined},...alerts.map(row=>({row}))],{fences:target.item?[target.item]:[],audits:duplicate?[]:[{action:'security.upload.held',object:row.id,detail:{item:change.item,checksum,size,reasons:change.reasons,source:payload.source}}]})
 if(alerts.length)await deliver(env,s,alerts)
 throw new ChestError(`suspect_upload_held`,423)
}

// A source cannot fill the record store indefinitely while paused. Held originals remain available for review.
const payloadLimit = (incident:Incident) => incident.changes.length >= 500
