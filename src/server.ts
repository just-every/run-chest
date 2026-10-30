import { chestAgentDoor } from './chest/agent-door/index.ts'
import { withOutboundPolicy } from './chest/outbound'
import { wopiResponse } from './chest/office/wopi'
import { integrationsResponse } from './chest/integrations/http'
import { sweepIntegrations } from './chest/integrations/webhooks'
import { sweepBackups } from './chest/backups/service'
import { collectionSweep } from './chest/collection'
import { withDemo } from './modules/demo/index.mjs'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { apiResponse } from './chest/api'
import { uiResponse } from './chest/ui'
import { scimResponse } from './chest/organisation/scim'
import { publicAttempt } from './chest/audit/public'
import { publicResponse } from './chest/files/public'
import { signResponse } from './chest/signatures/public'
import { sweepSignatures } from './chest/signatures/sweep'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { deploymentHealth } from './base/deployment-health'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { identity } from './identity'
import { authResponse, runtimeBindings, businessSettings, type Bindings } from './auth.server'
import { sweepAgents } from './chest/filing/agent-arrivals'
import { sweepLinkRepairs } from './chest/filing/link-repairs'
import { receiveIntake } from './chest/filing/intake'
import { seedDemo } from './demo'

const api = new Hono<{ Bindings: Bindings }>()
api.get('/health', (context) => context.json({ status: 'ok', ...deploymentHealth(context.env) }))

function documentResponse(response: Response): Response {
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response
  const headers = new Headers(response.headers)
  const control = headers.get('cache-control') ?? 'no-store'
  headers.set('cache-control', control.includes('no-transform') ? control : `${control}, no-transform`)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default withDemo(withOutboundPolicy({
  async scheduled(_controller, original) { await Promise.all([sweepIntegrations(runtimeBindings(original)),sweepBackups(runtimeBindings(original)),collectionSweep(runtimeBindings(original)),sweepLinkRepairs(runtimeBindings(original)),sweepAgents(runtimeBindings(original)),sweepSignatures(runtimeBindings(original))]) },
  async email(message, env) { await receiveIntake(runtimeBindings(env), message) },
  async fetch(request, original, execution) {
    const asset = await staticAssetResponse(request, original)
    if (asset) return documentResponse(asset)
    const env = runtimeBindings(original)
    const business = await businessSettings(env).handle(request)
    if (business) return business
    const agent = await chestAgentDoor(env).handle(request)
    if (agent) return documentResponse(agent)
    if(new URL(request.url).pathname.startsWith('/app') || new URL(request.url).pathname.startsWith('/api/chest'))execution.waitUntil(Promise.all([sweepBackups(env),collectionSweep(env),sweepLinkRepairs(env),sweepAgents(env),sweepSignatures(env)]))
    const publicPage = await setupStateResponse(request, env) ?? await lobbyResponse(request, env, identity)
    if (publicPage) return documentResponse(publicPage)
    const wopi = await wopiResponse(request,env);if(wopi)return documentResponse(wopi)
    const signing = await signResponse(request, env)
    if (signing) return documentResponse(signing)
    const shared = await publicAttempt(env, request, ()=>publicResponse(request, env))
    if (shared) return documentResponse(shared)
    const provisioning = await scimResponse(request, env)
    if (provisioning) return provisioning
    const auth = await authResponse(request, env)
    if (auth) return documentResponse(auth)
    const product = await integrationsResponse(request, env) ?? await apiResponse(request, env) ?? await uiResponse(request, env)
    if (product) { execution.waitUntil(sweepIntegrations(env)); return documentResponse(product) }
    return documentResponse(await dispatch(request, () => api.fetch(request, env, execution), () => start.fetch(request)))
  },
} satisfies ExportedHandler<Bindings>), { seed: seedDemo })
