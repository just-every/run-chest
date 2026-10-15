import { firstRunResponse } from './base/setup'
import { fontDocumentResponse } from './base/font-response'
import { createOperatorAuth, createAuthHandler, createSignInHandler, devGate, devNotFound, type AuthConfig } from './modules/operator-auth/index.mjs'
import { operatorMail } from './mail.server.mjs'
import { createOwnerClaimHandler, OwnerClaimError } from './modules/owner-claim/index.mjs'
import { createD1DevelopmentOutbox, createDevelopmentOutboxHandler } from './modules/mail/src/development/index.mjs'
import branding from './branding.json'

// The edition's declared theme (public/rer-theme.css), as Base frames link it.
const theme = { href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor }

export interface Bindings {
 ASSETS?: { fetch(request: Request): Promise<Response> }
 RER_DEPLOY_SOURCE?: string
 RER_DEPLOY_FINGERPRINT?: string
 RER_VERSION?: { id: string }
 BLOBS: R2Bucket
 DB: D1Database
 AUTH_ORIGIN: string
 AUTH_LOCAL?: string
 RER_DEV_ORIGIN?: string
 /** Local runtimes only: the checkout's key gate and dev identity switch. Deploy refuses both. */
 RER_DEV_KEY?: string
 RER_DEV_IDENTITY?: string
 RER_INSTALLATION_ID?: string
 RER_MANAGEMENT_ORIGIN?: string
 OWNER_EMAIL: string
 SESSION_SECRET: string
 SETUP_TOKEN?: string
 MAIL_PROVIDER?: 'development' | 'resend' | 'sendgrid' | 'cloudflare'
 MAIL_FROM?: string
 MAIL_API_KEY?: string
 MAIL_ACCOUNT_ID?: string
 /** A signed owner claim (RER Managed, or a hosted demo's front): its issuer, installation and public keys. */
 RER_OWNER_CLAIM_ISSUER?: string
 RER_OWNER_CLAIM_INSTALLATION_ID?: string
 RER_OWNER_CLAIM_PUBLIC_KEYS?: string
 /** Demo mode (`rer demo`, a hosted demo container); Base modules/demo reads it. Deploy refuses both. */
 RER_DEMO?: string
 RER_DEMO_EXPIRES?: string
}

export const runtimeBindings = (env: Bindings): Bindings => env.RER_DEV_ORIGIN && env.AUTH_LOCAL === 'true' ? { ...env, AUTH_ORIGIN: env.RER_DEV_ORIGIN } : env
export const authConfig = (env: Bindings): AuthConfig => ({ origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true', OWNER_EMAIL: env.OWNER_EMAIL, SESSION_SECRET: env.SESSION_SECRET, SETUP_TOKEN: env.SETUP_TOKEN, MAIL_FROM: env.MAIL_FROM, branding: { productName: branding.name, accentColor: branding.primaryColor, signInPath: '/signin', theme: theme.href } })
export function operatorAuth(env: Bindings) {
 return createOperatorAuth({ db: env.DB, config: authConfig(env), mailSender: operatorMail(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '' })
}

export async function authResponse(request: Request, original: Bindings): Promise<Response | null> {
 const env = runtimeBindings(original), url = new URL(request.url)
 // The outbox and key exchange answer only a local runtime holding RER_DEV_KEY;
 // the outbox also needs the key gate's cookie (or the rer harness's header).
 if (url.pathname === '/__dev/outbox' || url.pathname === '/__dev/key') {
  const gate = env.MAIL_PROVIDER === 'development' ? devGate({ key: env.RER_DEV_KEY, origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true' }) : null
  if (!gate) return devNotFound()
  if (url.pathname === '/__dev/key') return await gate.exchange(request) ?? devNotFound()
  if (!await gate.admits(request)) return devNotFound()
  return await createDevelopmentOutboxHandler({ local: true, origin: env.AUTH_ORIGIN, outbox: createD1DevelopmentOutbox({ db: env.DB }) })(request) ?? devNotFound()
 }
 // The shared server-rendered sign-in page: plain forms that work before any script.
 if (url.pathname === '/signin') {
  // A signed-in person who opens sign-in goes to the library instead of an empty form.
  if (request.method === 'GET' && await operatorAuth(env).getSession(request)) return new Response(null, { status: 303, headers: { location: '/app', 'cache-control': 'no-store' } })
  const page = await createSignInHandler(operatorAuth(env), {
   defaultReturnTo: '/setup',
   links: () => env.MAIL_PROVIDER === 'development' && env.AUTH_LOCAL === 'true' ? [{ href: '/__dev/outbox', label: 'Open the local development outbox' }] : [],
  })(request)
  if (page) return fontDocumentResponse(page)
 }
 // The signed owner claim: deployment bindings are the authority, the request carries only the signed token.
 if (url.pathname === '/auth/owner-claim' && env.RER_OWNER_CLAIM_PUBLIC_KEYS) return await ownerClaim(request, env)
 if (url.pathname.startsWith('/auth/')) return fontDocumentResponse(await createAuthHandler(operatorAuth(env))(request))
 if (url.pathname === '/setup' || url.pathname === '/app' || url.pathname.startsWith('/app/')) {
  const setup = await firstRunResponse(request, env, operatorAuth(env), { theme })
  if (setup) return setup
 }
 return null
}

async function ownerClaim(request: Request, env: Bindings): Promise<Response> {
 try {
  const handler = createOwnerClaimHandler({ db: env.DB, authConfig: authConfig(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '', issuer: env.RER_OWNER_CLAIM_ISSUER ?? '', installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID ?? env.RER_INSTALLATION_ID ?? '', appOrigin: env.AUTH_ORIGIN, expectedEmail: env.OWNER_EMAIL, publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS!) })
  return (await handler(request))!
 } catch (error) {
  if (error instanceof OwnerClaimError) return Response.json({ error: error.code }, { status: error.status, headers: { 'cache-control': 'no-store' } })
  return Response.json({ error: 'owner_claim_configuration_invalid' }, { status: 503, headers: { 'cache-control': 'no-store' } })
 }
}
