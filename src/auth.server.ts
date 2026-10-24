import { assertDomainSession } from './chest/organisation/domains'
import { firstRunResponse } from './base/setup'
import { fontDocumentResponse } from './base/font-response'
import { createOperatorAuth, createAuthHandler, createSignInHandler, devGate, devNotFound, type AuthConfig } from './modules/operator-auth/index.mjs'
import { operatorMail } from './mail.server.mjs'
import { createOwnerClaimHandler, OwnerClaimError } from './modules/owner-claim/index.mjs'
import branding from './branding.json'
import { companyResponse } from './chest/organisation/routes'
import { checkInvitationScope } from './chest/administration/invitations'
import { administrativeAuthResponse } from './chest/administration/legacy-auth'
import { identityAdminPolicy } from './chest/administration/roles'
import { securityResponse } from './chest/security/routes'
import { requireMfa } from './chest/security/session'
import { namingInviter } from './chest/invitation-mail'

// The edition's declared theme (public/rer-theme.css), as Base frames link it.
const theme = { href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor }

export interface Bindings {
 ASSETS?: { fetch(request: Request): Promise<Response> }
 RER_DEPLOY_SOURCE?: string
 RER_DEPLOY_FINGERPRINT?: string
 RER_VERSION?: { id: string }
 COLLABORA_URL?: string
 CONTENT_SCANNER_URL?: string
 CONTENT_SCANNER_TOKEN?: string
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
 SIGNING_KEY_SECRET?: string
 SIGNING_KEY_PREVIOUS_SECRET?: string
 SESSION_SECRET: string
 SETUP_TOKEN?: string
 MAIL_PROVIDER?: 'development' | 'resend' | 'sendgrid' | 'cloudflare' | 'rer'
 MAIL_FROM?: string
 MAIL_RELAY_URL?: string
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
// `inviter` names who sends the invitation this instance mails (src/chest/invitation-mail.ts).
export function baseOperatorAuth(env: Bindings, inviter?: string) {
 return createOperatorAuth({ db: env.DB, config: authConfig(env), mailSender: inviter ? namingInviter(operatorMail(env), inviter) : operatorMail(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '',rolePolicy:input=>identityAdminPolicy(env,input),hooks:{afterConfirm:async({session,operator})=>{await checkInvitationScope(env,session,operator)}} })
}

export function operatorAuth(env:Bindings,inviter?:string){
 const auth=baseOperatorAuth(env,inviter)
 return {...auth,async getSession(request:Request){const s=await auth.getSession(request);if(s){await assertDomainSession(env,s);await requireMfa(env,s)}return s}}
}

export async function authResponse(request: Request, original: Bindings): Promise<Response | null> {
 const env = runtimeBindings(original), url = new URL(request.url)
 const security=await securityResponse(request,env);if(security)return security
 const administrativeAuth=await administrativeAuthResponse(env,request);if(administrativeAuth)return administrativeAuth
 // The key exchange answers only a local runtime holding RER_DEV_KEY.
 if (url.pathname === '/__dev/key') {
  const gate = devGate({ key: env.RER_DEV_KEY, origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true' })
  return gate ? await gate.exchange(request) ?? devNotFound() : devNotFound()
 }
 const company = await companyResponse(request, env)
 if (company) return fontDocumentResponse(company)
 // The shared server-rendered sign-in page: plain forms that work before any script.
 if (url.pathname === '/signin') {
  // A signed-in person who opens sign-in goes to the library instead of an empty form.
  if (request.method === 'GET' && await operatorAuth(env).getSession(request)) return new Response(null, { status: 303, headers: { location: '/app/files', 'cache-control': 'no-store' } })
  const page = await createSignInHandler(operatorAuth(env), { defaultReturnTo: '/setup' })(request)
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
