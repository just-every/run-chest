import type { Bindings } from '../../auth.server'
import { insist } from '../model'
import { esc, select, stamp } from '../ui-shared'
import { context, demand, type Who } from './access'

// Select from this person's retained originals, including the version projection of a pinned link.
export async function compareVersions(env: Bindings, w: Who, key: string, left: string | null, right: string | null) {
 const ctx = await context(env, w, key); demand(ctx, 'view')
 const item = ctx.chain.at(-1)!
 insist(item.payload.type === 'file', 'version_not_found', 404)
 const versions = item.payload.versions, ids = [left ?? versions.at(-2)?.id, right ?? item.payload.current]
 insist(ids[0] && ids[1] && ids[0] !== ids[1], 'choose_two_versions')
 const sides = ids.map(id => {
  const v = versions.find(v => v.id === id); insist(v, 'version_not_found', 404)
  return { id: v.id, number: versions.indexOf(v) + 1, name: v.name || v.filename, at: v.at, actor: v.actor }
 })
 return { item: key, name: item.payload.name, versions: versions.map((v, i) => ({ id: v.id, label: `Version ${i + 1} · ${v.name || v.filename}` })), sides }
}

export function comparisonPage(d: Awaited<ReturnType<typeof compareVersions>>) {
 const base = `/app/items/${encodeURIComponent(d.item)}`
 const columns = d.sides.map((v, i) => `<section class="card comparison-side" aria-label="${i ? 'Right' : 'Left'} version"><h2>Version ${v.number}</h2><p>${esc(v.name)}</p><p class="mono">${esc(v.actor)} · ${stamp(v.at)}</p><iframe class="office-frame" title="${i ? 'Right' : 'Left'} version preview" src="/api/chest/items/${encodeURIComponent(d.item)}/comparison-preview/${encodeURIComponent(v.id)}" sandbox="allow-scripts allow-same-origin"></iframe></section>`).join('')
 return `<div class="page-head"><h1>Compare versions</h1><p>${esc(d.name)}</p><a class="link" href="${base}#history">Back to version history</a></div><form class="form" method="get" action="${base}/compare"><div class="form-grid">${select('Left version', 'left', d.versions, d.sides[0].id)}${select('Right version', 'right', d.versions, d.sides[1].id)}</div><button class="btn">Compare selected versions</button></form><div class="version-comparison">${columns}</div>`
}

// The frames use the existing authority-checked preview transports, never a supplied URL.
export async function comparisonPreview(env: Bindings, w: Who, key: string, id: string) {
 const { allowed } = await import('./access'), ctx = await context(env, w, key); demand(ctx, 'view')
 const v = ctx.chain.at(-1)!.payload.versions.find(v => v.id === id); insist(v, 'version_not_found', 404)
 const base = `/api/chest/items/${encodeURIComponent(key)}`, version = encodeURIComponent(id)
 const path = !allowed(ctx, 'download') ? `${base}/rendered-preview/${version}`
  : /\.(docx|xlsx|pptx|odt|ods|odp)$/i.test(v.filename) ? `${base}/office-preview/${version}`
  : v.preview !== 'unsupported' ? `${base}/bytes/${version}` : null
 if (path) return new Response(null, { status: 303, headers: { location: path, 'cache-control': 'no-store' } })
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Version preview</title><body><p>Preview unavailable for ${esc(v.mediaType)}.</p><a href="${base}/bytes/${version}?download=true">Download this version</a></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "sandbox; default-src 'none'; frame-ancestors 'self'" } })
}
