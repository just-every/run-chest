import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const encoder = new TextEncoder()

/** A 160-bit authenticator secret, encoded as unpadded RFC 4648 base32. */
export function randomSecret(): string {
  let value = 0, bits = 0, result = ''
  for (const byte of crypto.getRandomValues(new Uint8Array(20))) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      result += alphabet[(value >>> bits) & 31]
    }
    value &= (1 << bits) - 1
  }
  return result
}

function secretBytes(secret: string) {
  const normalized = secret.toUpperCase()
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid authenticator secret')
  const bytes: number[] = []
  let value = 0, bits = 0
  for (const char of normalized) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 255)
    }
    value &= (1 << bits) - 1
  }
  if (!bytes.length || bits >= 5 || value !== 0) throw new Error('Invalid authenticator secret')
  return Uint8Array.from(bytes)
}

/** Returns the consumed 30-second step. Persist it atomically before granting access. */
export async function totp(secret: string, code: string, lastStep: number): Promise<number | null> {
  if (!/^\d{6}$/.test(code) || !Number.isSafeInteger(lastStep) || lastStep < -1) return null
  const key = await crypto.subtle.importKey('raw', secretBytes(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const current = Math.floor(Date.now() / 30_000)
  const matches = await Promise.all([-1, 0, 1].map(async offset => {
    const step = current + offset
    const counter = new Uint8Array(8)
    new DataView(counter.buffer).setBigUint64(0, BigInt(step))
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter))
    const start = signature[signature.length - 1] & 15
    const number = new DataView(signature.buffer).getUint32(start) & 0x7fffffff
    const expected = (number % 1_000_000).toString().padStart(6, '0')
    let difference = 0
    for (let index = 0; index < 6; index++) difference |= expected.charCodeAt(index) ^ code.charCodeAt(index)
    return difference === 0 && step > lastStep ? step : -1
  }))
  const matched = Math.max(...matches)
  return matched < 0 ? null : matched
}

export function totpUri(secret: string, email: string): string {
  const query = new URLSearchParams({ secret, issuer: 'Chest', algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${encodeURIComponent(`Chest:${email}`)}?${query}`
}

function rpId(origin: string): string {
  const url = new URL(origin)
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid WebAuthn origin')
  return url.hostname
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function publicKeyBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid WebAuthn public key')
  const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
  if (base64url(bytes) !== value) throw new Error('Invalid WebAuthn public key')
  return bytes
}

export async function webRegistration(origin: string, email: string, userId: string, excludeIds: string[]) {
  const userID = encoder.encode(userId)
  if (userID.length < 1 || userID.length > 64) throw new Error('Invalid WebAuthn user ID')
  return generateRegistrationOptions({
    rpName: 'Chest',
    rpID: rpId(origin),
    userID,
    userName: email,
    userDisplayName: email,
    attestationType: 'none',
    excludeCredentials: excludeIds.map(id => ({ id })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  })
}

export async function verifyRegistration(origin: string, response: any, challenge: string): Promise<{ id: string, publicKey: string, counter: number, transports: string[] }> {
  if (!challenge) throw new Error('Missing WebAuthn challenge')
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpId(origin),
    requireUserPresence: true,
    requireUserVerification: true,
  })
  if (!result.verified || !result.registrationInfo) throw new Error('WebAuthn registration failed')
  const { credential } = result.registrationInfo
  return { id: credential.id, publicKey: base64url(credential.publicKey), counter: credential.counter, transports: credential.transports ?? [] }
}

type Credential = { id: string, publicKey: string, counter: number, transports?: string[] }

export async function webAuthentication(origin: string, credentials: { id: string, transports?: string[] }[]) {
  if (!credentials.length) throw new Error('No registered WebAuthn credentials')
  return generateAuthenticationOptions({
    rpID: rpId(origin),
    allowCredentials: credentials,
    userVerification: 'required',
  })
}

export async function verifyAuthentication(origin: string, response: any, challenge: string, credential: Credential): Promise<{ counter: number }> {
  if (!challenge || response?.id !== credential.id) throw new Error('Invalid WebAuthn authentication')
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpId(origin),
    credential: { ...credential, publicKey: publicKeyBytes(credential.publicKey) },
    requireUserVerification: true,
  })
  if (!result.verified) throw new Error('WebAuthn authentication failed')
  return { counter: result.authenticationInfo.newCounter }
}
