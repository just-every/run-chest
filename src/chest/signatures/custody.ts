import type { Bindings } from '../../auth.server'
import { seal as sealSecret, unseal } from '../seal'
import { certificateFingerprint, newSigningKey } from './cms'
// The installation's signing key. The private key is sealed under SESSION_SECRET in chest_signing_key (never in
// archives, logs, served assets or prompts); the certificate is public and travels inside every document it seals.
const PURPOSE = 'signing-key', b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)), unb64 = (t: string) => Uint8Array.from(atob(t), c => c.charCodeAt(0))
export type SigningKey = { privateKey: Uint8Array; certificate: Uint8Array; fingerprint: string }
async function saved(env: Bindings) { return env.DB.prepare('SELECT * FROM chest_signing_key WHERE id=1').first<{ key_sealed: string; certificate: string; fingerprint: string }>() }
export async function signingKey(env: Bindings): Promise<SigningKey> {
 let row = await saved(env)
 if (!row) {
  const made = await newSigningKey('Chest document signing', new URL(env.AUTH_ORIGIN).host)
  await env.DB.prepare('INSERT OR IGNORE INTO chest_signing_key(id,key_sealed,certificate,fingerprint,created_at) VALUES(1,?,?,?,?)').bind(await sealSecret(env.SESSION_SECRET, PURPOSE, b64(made.pkcs8)), b64(made.certificate), await certificateFingerprint(made.certificate), new Date().toISOString()).run()
  row = await saved(env)
 }
 const privateKey = await unseal(env.SESSION_SECRET, PURPOSE, row!.key_sealed)
 if (!privateKey) throw Object.assign(new Error('signing_key_unreadable'), { code: 'signing_key_unreadable', status: 503 })
 return { privateKey: unb64(privateKey), certificate: unb64(row!.certificate), fingerprint: row!.fingerprint }
}
export async function currentFingerprint(env: Bindings) { return (await saved(env))?.fingerprint ?? null }
