import type { Bindings } from '../../auth.server'
import { digest } from '../blobs'
import { ChestError, insist, now } from '../model'
import { get } from '../store'
import { commit, next } from '../files/repo'
import { context, whoFor } from '../files/access'
import { admit } from '../files/items'
import { effectiveGovernance } from '../files/folder-metadata'
import type { FileVersion, Item } from '../files/model'
import { auditCertificate } from './certificate'
import { signingKey } from './custody'
import { loadPdf, stamp } from './pdf-tools'
import { seal } from './seal-pdf'
import { completedMail, tell } from './messages'
import { documentBytes } from './service'
import { event, getRequest, type Origin } from './store'
// Every signer has signed. Stamp each completed field into the PDF, seal it with the installation key, write the audit
// certificate (sealed too) and file both as new versions of the source file in one commit. The source version, the
// file's current version, its grants and links are untouched; on a governed folder the new versions wait for review.
export async function complete(env: Bindings, key: string, from: Origin) {
 const row = await getRequest(env, key), p = row.payload
 insist(p.status === 'pending' && p.signers.every(s => s.state === 'signed'), 'signature_not_complete', 409)
 const pdf = await loadPdf(await documentBytes(env, p)); await stamp(pdf, p, id => p.signers.find(s => s.id === id)?.signedAt)
 const custody = await signingKey(env), host = new URL(env.AUTH_ORIGIN).host, material = { privateKey: custody.privateKey, certificate: custody.certificate }
 const signed = await seal(pdf, material, `Signed through Chest by ${p.signers.map(s => s.email).join(', ')}`, `Chest document signing (${host})`)
 const at = now(), done = { ...p, status: 'completed' as const, outcome: { at, status: 'completed' as const }, events: [...p.events, event('completed', from, { detail: 'all signers signed' })] }
 const signedHash = await digest(signed)
 const certificate = await seal(await auditCertificate(done, { source: p.sourceChecksum, document: p.document.checksum, signed: signedHash }, host), material, `Audit certificate for ${p.name}`, `Chest document signing (${host})`)
 const item = await get<Item>(env, 'item', p.item), ctx = await context(env, await whoFor(env, p.createdBy), p.item), policy = effectiveGovernance(ctx, item.payload)
 const base = item.payload.name.replace(/\.(pdf|docx)$/i, '')
 const filed = async (bytes: Uint8Array, filename: string, role: 'signed' | 'certificate') => { const v = await admit(env, bytes, filename, p.createdBy, 'signature', {}, { signature: { request: key, role, sourceVersion: p.version },...(p.preparedBy?{preparedBy:p.preparedBy}:{}) }); return (policy ? { ...v, review: { reviewer: policy.reviewer, state: 'submitted' as const } } : v) as FileVersion }
 const signedVersion = await filed(signed, `${base}-signed.pdf`, 'signed'), certificateVersion = await filed(certificate, `${base}-certificate.pdf`, 'certificate')
 const finished = { ...done, signed: { version: signedVersion.id, checksum: signedVersion.checksum, size: signedVersion.size }, certificate: { version: certificateVersion.id, checksum: certificateVersion.checksum, size: certificateVersion.size } }
 try {
  await commit(env, null, [{ row: next(item, { ...item.payload, versions: [...item.payload.versions, signedVersion, certificateVersion], updatedAt: at }), previous: item }, { row: next(row, finished), previous: row }], { fences: ctx.fences, changes: [{ item: item.id, space: item.payload.space, kind: 'version' }], audits: [{ action: 'signature.complete', object: item.id, detail: { request: key, source: p.version, signed: signedVersion.id, certificate: certificateVersion.id, signedSha256: signedVersion.checksum } }], by: 'Chest signing' })
 } catch (error) {
  if ((await getRequest(env, key)).payload.status !== 'pending') return getRequest(env, key)
  throw error instanceof ChestError ? error : error
 }
 const final = await getRequest(env, key)
 for (const s of final.payload.signers) await completedMail(env, final.payload, key, s)
 await tell(env, final.payload, key, 'completed')
 return final
}
