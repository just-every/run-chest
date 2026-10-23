import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { seal as sealSecret, unseal } from '../seal'
import { insist } from '../model'
import { commit } from '../files/repo'
import { ownerOnly } from '../content-security/policy'
import { certificateFingerprint, newSigningKey } from './cms'
// A dedicated installation secret, with a distinct HKDF info label, wraps the private signing key.
// Neither session-secret rotation nor a database/archive copy supplies signing authority.
const PURPOSE = 'chest-document-signing-custody-v2', LEGACY_PURPOSE = 'signing-key'
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)), unb64 = (t: string) => Uint8Array.from(atob(t), c => c.charCodeAt(0))
export type SigningKey = { privateKey: Uint8Array; certificate: Uint8Array; fingerprint: string }
async function saved(env: Bindings) { return env.DB.prepare('SELECT * FROM chest_signing_key WHERE id=1').first<{ key_sealed: string; certificate: string; fingerprint: string }>() }
function root(env: Bindings) { insist(env.SIGNING_KEY_SECRET && env.SIGNING_KEY_SECRET !== env.SESSION_SECRET, 'signing_custody_not_configured', 503); return env.SIGNING_KEY_SECRET }
const wrap = async (secret: string, value: string) => 'v2.' + await sealSecret(secret, PURPOSE, value)
const open = (secret: string, value: string) => value.startsWith('v2.') ? unseal(secret, PURPOSE, value.slice(3)) : Promise.resolve(null)
export async function signingKey(env: Bindings): Promise<SigningKey> {
 const secret = root(env)
 let row = await saved(env)
 if (!row) {
  const made = await newSigningKey('Chest document signing', new URL(env.AUTH_ORIGIN).host)
  await env.DB.prepare('INSERT OR IGNORE INTO chest_signing_key(id,key_sealed,certificate,fingerprint,created_at) VALUES(1,?,?,?,?)').bind(await wrap(secret, b64(made.pkcs8)), b64(made.certificate), await certificateFingerprint(made.certificate), new Date().toISOString()).run()
  row = await saved(env)
 }
 const privateKey = await open(secret, row!.key_sealed)
 insist(privateKey, 'signing_key_rotation_required', 503)
 return { privateKey: unb64(privateKey), certificate: unb64(row!.certificate), fingerprint: row!.fingerprint }
}
// Explicit owner action only. Re-seal the same key/certificate; never silently replace an unreadable identity.
// The previous root is used only by this rotation door. v1 migration uses the still-held legacy session secret.
export async function rotateSigningCustody(env: Bindings, s: Session, input: any) {
 await ownerOnly(env, s)
 insist(input.confirm === true, 'signing_rotation_confirmation_required')
 const secret = root(env), row = await saved(env)
 insist(row, 'signing_key_not_created', 409)
 const current = await open(secret, row.key_sealed)
 const previous = current ?? (row.key_sealed.startsWith('v2.')
  ? env.SIGNING_KEY_PREVIOUS_SECRET ? await open(env.SIGNING_KEY_PREVIOUS_SECRET, row.key_sealed) : null
  : await unseal(env.SESSION_SECRET, LEGACY_PURPOSE, row.key_sealed))
 insist(previous, 'signing_key_unreadable', 503)
 const sealed = await wrap(secret, previous)
 await commit(env, s, [], {
  preconditions: [{sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM chest_signing_key WHERE id=1 AND key_sealed=?) THEN 1 ELSE 0 END',params:[row.key_sealed]}],
  statements: [{sql:'UPDATE chest_signing_key SET key_sealed=? WHERE id=1',params:[sealed]}],
  audits: [{action:'signature.custody.rotate',object:'signing-key',detail:{fingerprint:row.fingerprint,migrated:!row.key_sealed.startsWith('v2.')}}],
 })
 return {rotated:true,fingerprint:row.fingerprint}
}
export async function currentFingerprint(env: Bindings) { return (await saved(env))?.fingerprint ?? null }
