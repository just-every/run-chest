import { bits, body, bool, dotted, explicit, integer, joined, kids, nul, octets, oid, read, seq, set, setOf, time, tlv, utf8, type Node } from './der'
// Self-signed ECDSA P-256 certificate and PAdES (ETSI.CAdES.detached) CMS signatures built with Web Crypto only.
const OID = { sha256: '2.16.840.1.101.3.4.2.1', ecdsaSha256: '1.2.840.10045.4.3.2', data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2', contentType: '1.2.840.113549.1.9.3', messageDigest: '1.2.840.113549.1.9.4', signingTime: '1.2.840.113549.1.9.5', signingCertificateV2: '1.2.840.113549.1.9.16.2.47', cn: '2.5.4.3', org: '2.5.4.10', keyUsage: '2.5.29.15', basic: '2.5.29.19' }
const buf = (b: Uint8Array) => b as unknown as BufferSource
export const sha256 = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', buf(bytes)))
export const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
const ecdsa = { name: 'ECDSA', namedCurve: 'P-256' }
const name = (common: string, organisation: string) => seq(set(seq(oid(OID.org), utf8(organisation))), set(seq(oid(OID.cn), utf8(common))))
// Web Crypto returns r||s; X.509 and CMS carry DER.
const toDer = (raw: Uint8Array) => seq(integer(raw.slice(0, 32)), integer(raw.slice(32)))
const fromDer = (der: Uint8Array) => { const [r, s] = kids(read(der)); const fit = (n: Node) => { const v = body(n); const trimmed = v[0] === 0 ? v.slice(1) : v; if (trimmed.length > 32) throw new Error('signature_shape'); const out = new Uint8Array(32); out.set(trimmed, 32 - trimmed.length); return out }; return joined([fit(r), fit(s)]) }
export async function newSigningKey(common: string, organisation: string, years = 10) {
 const pair = await crypto.subtle.generateKey(ecdsa, true, ['sign', 'verify']) as CryptoKeyPair
 const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
 const from = new Date(Date.now() - 5 * 60_000), to = new Date(Date.now() + years * 365 * 86_400_000), issuer = name(common, organisation)
 const serial = crypto.getRandomValues(new Uint8Array(16)); serial[0] &= 0x7f
 const extensions = explicit(3, seq(
  seq(oid(OID.basic), bool(true), octets(seq())),
  seq(oid(OID.keyUsage), bool(true), octets(tlv(3, Uint8Array.of(6, 0xc0))))))
 const tbs = seq(explicit(0, integer(2)), integer(serial), seq(oid(OID.ecdsaSha256)), issuer, seq(time(from), time(to)), issuer, spki, extensions)
 const signature = toDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, buf(tbs))))
 return { pkcs8, certificate: seq(tbs, seq(oid(OID.ecdsaSha256)), bits(signature)) }
}
export async function certificateFingerprint(certificate: Uint8Array) { return hex(await sha256(certificate)) }
function issuerAndSerial(certificate: Uint8Array) { const tbs = kids(read(certificate))[0], parts = kids(tbs), at = parts[0].tag === 0xa0 ? 1 : 0; return { issuer: parts[at + 2].bytes, serial: parts[at].bytes } }
const attribute = (id: string, ...values: Uint8Array[]) => seq(oid(id), set(...values))
// The PDF's signed byte ranges are hashed by the caller; this signs that digest as detached CAdES (PAdES baseline B).
export async function pades(digest: Uint8Array, privateKey: Uint8Array, certificate: Uint8Array, at = new Date()) {
 const key = await crypto.subtle.importKey('pkcs8', buf(privateKey), ecdsa, false, ['sign'])
 const attributes = [
  attribute(OID.contentType, oid(OID.data)),
  attribute(OID.signingTime, time(at)),
  attribute(OID.messageDigest, octets(digest)),
  attribute(OID.signingCertificateV2, seq(seq(seq(octets(await sha256(certificate))))))]
 const signedAttributes = setOf(attributes)
 const signature = toDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, buf(signedAttributes))))
 const { issuer, serial } = issuerAndSerial(certificate)
 const signer = seq(integer(1), seq(issuer, serial), seq(oid(OID.sha256), nul()), tlv(0xa0, ...[...attributes].sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length })), seq(oid(OID.ecdsaSha256)), octets(signature))
 const signedData = seq(integer(1), set(seq(oid(OID.sha256), nul())), seq(oid(OID.data)), tlv(0xa0, certificate), set(signer))
 return seq(oid(OID.signedData), explicit(0, signedData))
}
export type Validation = { valid: boolean; reason?: string; certificate?: string; signedAt?: string; subject?: string }
// Checks the CMS container against the digest of the signed byte ranges: digest attribute, signature over the
// signed attributes with the embedded certificate's key, and that certificate's own self-signature when self-issued.
export async function verifyPades(cms: Uint8Array, digest: Uint8Array): Promise<Validation> {
 try {
  const root = read(cms), content = kids(kids(root)[1])[0], parts = kids(content)
  const certificates = parts.find(p => p.tag === 0xa0), signers = parts[parts.length - 1]
  if (!certificates || signers.tag !== 0x31) return { valid: false, reason: 'cms_shape' }
  const certificate = kids(certificates)[0], signer = kids(kids(signers)[0])
  const attributes = signer.find(p => p.tag === 0xa0)!, signatureNode = signer[signer.length - 1]
  const found = new Map(kids(attributes).map(a => { const [id, values] = kids(a); return [dotted(id), kids(values)[0]] as const }))
  if (hex(body(found.get(OID.messageDigest)!)) !== hex(digest)) return { valid: false, reason: 'digest_mismatch' }
  const tbs = kids(certificate)[0], tbsParts = kids(tbs), at = tbsParts[0].tag === 0xa0 ? 1 : 0
  const spki = tbsParts[at + 5].bytes, certificateKey = await crypto.subtle.importKey('spki', buf(spki), ecdsa, false, ['verify'])
  const asSet = joined([Uint8Array.of(0x31), attributes.bytes.subarray(1)])
  const good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, certificateKey, buf(fromDer(body(signatureNode))), buf(asSet))
  if (!good) return { valid: false, reason: 'signature_invalid' }
  const issuedBySelf = hex(tbsParts[at + 2].bytes) === hex(tbsParts[at + 4].bytes), outer = kids(certificate)
  if (issuedBySelf && !await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, certificateKey, buf(fromDer(body(outer[2]).slice(1))), buf(tbs.bytes))) return { valid: false, reason: 'certificate_invalid' }
  const signingTime = found.get(OID.signingTime), text = signingTime ? new TextDecoder().decode(body(signingTime)) : ''
  const stamp = text.length === 13 ? `${+text.slice(0, 2) < 50 ? 20 : 19}${text.slice(0, 2)}-${text.slice(2, 4)}-${text.slice(4, 6)}T${text.slice(6, 8)}:${text.slice(8, 10)}:${text.slice(10, 12)}Z` : undefined
  return { valid: true, certificate: await certificateFingerprint(certificate.bytes), ...(stamp ? { signedAt: stamp } : {}) }
 } catch { return { valid: false, reason: 'cms_unreadable' } }
}
