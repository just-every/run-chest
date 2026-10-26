import { resolve } from 'node:path';
import { localOperation } from '@runeditrun/rer/local/operation';
import { recoverInterrupted } from '@runeditrun/rer/local/recovery';
import { selectLocalState } from '@runeditrun/rer/local/state';
import { refuseDevLayerOutput } from '@runeditrun/rer/dev-identity';
import { productionPlan, projectMiniflare } from '@runeditrun/rer/internal/onboarding/production-options.mjs';
import { serverSettings } from './settings.mjs';
import { listenIngress } from './ingress.mjs';

// Preserve the public request URL across Miniflare's internal HTTP transport,
// using the same service-binding ingress pattern as Base's container host.
const ingressScript = `export default {fetch(request,env){
 const url=request.headers.get('x-chest-server-url');
 if(!url)return new Response(null,{status:400});
 const headers=new Headers(request.headers);headers.delete('x-chest-server-url');
 headers.set('host',new URL(url).host);
 return env.APP.fetch(new Request(url,{method:request.method,headers,redirect:'manual',
 ...(!['GET','HEAD'].includes(request.method)?{body:request.body}:{})}));
}}`;

export async function startServer(root, args, signal) {
  const operation = await localOperation(root);
  let runtime, ingress;
  try {
    await recoverInterrupted(root, operation);
    await selectLocalState(root);
    const settings = await serverSettings(root, args);
    await refuseDevLayerOutput(root);
    if (signal.aborted) return;
    const options = await productionPlan(root, settings.origin.origin, 0, '127.0.0.1');
    const app = options.workers[0];
    app.bindings = { ...app.bindings, ...settings.bindings };
    for (const worker of options.workers) {
      for (const key of Object.keys(worker.bindings ?? {})) if (/^(RER_DEV|RER_DEMO|RER_MODELS_)/.test(key)) delete worker.bindings[key];
    }
    options.workers.unshift({ name: 'chest-production-ingress', modules: true, script: ingressScript, serviceBindings: { APP: app.name } });
    const { Miniflare, convertV4MiniflareOptions, Log, LogLevel } = await projectMiniflare(root);
    runtime = new Miniflare({ ...convertV4MiniflareOptions(options),
      resourcePersistencePath: resolve(root, '.wrangler/state/v3'),
      unsafeLocalExplorer: false, unsafeTriggerHandlers: false, inspectorPort: undefined,
      cf: false, log: new Log(LogLevel.NONE),
    });
    await runtime.ready;
    if (signal.aborted) return;
    const dispatch = async request => {
      const headers = new Headers(request.headers);
      headers.set('x-chest-server-url', request.url);
      return runtime.dispatchFetch(request.url, { method: request.method, headers,
        redirect: 'manual', signal: request.signal,
        ...(!['GET', 'HEAD'].includes(request.method) ? { body: request.body, duplex: 'half' } : {}),
      });
    };
    const health = await dispatch(new Request(new URL('/health', settings.origin), { signal: AbortSignal.timeout(15000) }));
    await health.body?.cancel();
    if (!health.ok) throw new Error('Production health failed');
    ingress = await listenIngress({ ...settings, dispatch });
    if (signal.aborted) return;
    console.log(`CHEST_SERVER_READY ${settings.origin.origin} listener=127.0.0.1:${settings.port} pid=${process.pid}`);
    await new Promise((done, reject) => {
      signal.addEventListener('abort', done, { once: true });
      ingress.server.once('error', reject);
      if (signal.aborted) done();
    });
  } finally {
    try { await ingress?.close(); }
    finally { try { await runtime?.dispose(); } finally { await operation.release(); } }
  }
}
