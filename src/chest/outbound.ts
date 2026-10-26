import { AsyncLocalStorage } from 'node:async_hooks'
import { ChestError } from './model'

// The owner can restrict this installation to named provider hosts. Context
// follows requests and background work; concurrent calls cannot change it.
const policy = new AsyncLocalStorage<Set<string> | undefined>()
const networkFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (input, init) => {
 const allowed = policy.getStore()
 if (!allowed) return networkFetch(input, init)
 const request = new Request(input, init)
 if (!allowed.has(new URL(request.url).hostname.toLowerCase())) throw new ChestError('outbound_host_denied', 503)
 return networkFetch(request, { redirect: 'manual' }).then(async response => {
  if (response.status >= 300 && response.status < 400) {
   await response.body?.cancel()
   throw new ChestError('outbound_redirect_denied', 503)
  }
  return response
 })
}

export function withOutboundPolicy<E extends { CHEST_OUTBOUND_HOSTS?: string }>(handler: ExportedHandler<E>): ExportedHandler<E> {
 const run = <T>(env:E, operation:()=>T) => {
  const configured = env.CHEST_OUTBOUND_HOSTS?.trim()
  if (!configured) return operation()
  const hosts = configured.split(',').map(host=>host.trim().toLowerCase())
  if (hosts.some(host=>!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host))) throw new ChestError('invalid_outbound_hosts', 503)
  return policy.run(new Set(hosts), operation)
 }
 return { ...handler,
  ...(handler.fetch ? { fetch:(request,env,execution)=>run(env,()=>handler.fetch!.call(handler,request,env,execution)) } : {}),
  ...(handler.scheduled ? { scheduled:(controller,env,execution)=>run(env,()=>handler.scheduled!.call(handler,controller,env,execution)) } : {}),
  ...(handler.email ? { email:(message,env,execution)=>run(env,()=>handler.email!.call(handler,message,env,execution)) } : {}),
 }
}
