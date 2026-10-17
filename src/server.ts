import { withDemo } from './modules/demo/index.mjs'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { apiResponse } from './chest/api'
import { uiResponse } from './chest/ui'
import { scimResponse } from './chest/organisation/scim'
import { publicResponse } from './chest/files/public'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { deploymentHealth } from './base/deployment-health'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { identity } from './identity'
import { authResponse, runtimeBindings, type Bindings } from './auth.server'
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

export default withDemo({
  async email(message, env) { await receiveIntake(runtimeBindings(env), message) },
  async fetch(request, original, execution) {
    const asset = await staticAssetResponse(request, original)
    if (asset) return documentResponse(asset)
    const env = runtimeBindings(original)
    const publicPage = await setupStateResponse(request, env) ?? await lobbyResponse(request, env, identity)
    if (publicPage) return documentResponse(publicPage)
    const shared = await publicResponse(request, env)
    if (shared) return documentResponse(shared)
    const provisioning = await scimResponse(request, env)
    if (provisioning) return provisioning
    const auth = await authResponse(request, env)
    if (auth) return documentResponse(auth)
    const product = await apiResponse(request, env) ?? await uiResponse(request, env)
    if (product) return documentResponse(product)
    return documentResponse(await dispatch(request, () => api.fetch(request, env, execution), () => start.fetch(request)))
  },
} satisfies ExportedHandler<Bindings>, { seed: seedDemo })
