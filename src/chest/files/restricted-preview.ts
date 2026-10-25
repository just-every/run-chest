import { PDFDocument, PDFName } from 'pdf-lib'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { assertContent } from '../content-security/scan'
import { digest, SMALL } from '../blobs'
import { ChestError, insist } from '../model'
import { esc } from '../ui-shared'
import { context, demand, who, type Who } from './access'
import { commit } from './repo'
import type { FileVersion } from './model'

const MAX_RENDER = 32 * 1024 * 1024
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }

function converter(env: Bindings) {
 insist(env.COLLABORA_URL, 'collabora_not_configured', 503)
 let base: URL
 try { base = new URL(env.COLLABORA_URL) } catch { throw new ChestError('collabora_requires_https', 503) }
 const local = new URL(env.AUTH_ORIGIN).hostname === 'localhost' || new URL(env.AUTH_ORIGIN).hostname === '127.0.0.1'
 insist((base.protocol === 'https:' || local && base.protocol === 'http:') && !base.username && !base.password && !base.search && !base.hash, 'collabora_requires_https', 503)
 return base
}

async function convert(env: Bindings, bytes: Uint8Array, filename: string, format: 'pdf' | 'png') {
 const endpoint = new URL(`/cool/convert-to/${format}`, converter(env)), body = new FormData()
 body.set('data', new Blob([bytes as BlobPart]), filename)
 // The service renders only visual content; its PDF result remains inside the Worker.
 let response: Response
 try { response = await fetch(endpoint, { method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(60_000) }) }
 catch { throw new ChestError('collabora_render_unavailable', 503) }
 insist(response.ok, 'collabora_render_unavailable', 503)
 insist(Number(response.headers.get('content-length') ?? 0) <= MAX_RENDER, 'rendered_preview_too_large', 413)
 const reader = response.body?.getReader(); insist(reader, 'collabora_render_invalid', 503)
 const chunks: Uint8Array[] = []; let size = 0
 try {
  for (;;) {
   const { value, done } = await reader.read(); if (done) break
   size += value.length; insist(size <= MAX_RENDER, 'rendered_preview_too_large', 413); chunks.push(value)
  }
 } finally { await reader.cancel() }
 const result = new Uint8Array(size); let at = 0
 for (const chunk of chunks) { result.set(chunk, at); at += chunk.length }
 insist(result.length > 0, 'collabora_render_invalid', 503)
 return result
}

// Keep only PNG pixel chunks, excluding comments, embedded profiles and other source metadata.
function pixels(bytes: Uint8Array) {
 insist(bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10', 'collabora_render_invalid', 503)
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), chunks = [bytes.subarray(0, 8)]
 let at = 8, image = false, ended = false
 while (at + 12 <= bytes.length) {
  const size = view.getUint32(at), end = at + size + 12; insist(end <= bytes.length, 'collabora_render_invalid', 503)
  const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8))
  if (at === 8) {
   insist(type === 'IHDR' && size === 13, 'collabora_render_invalid', 503)
   const width = view.getUint32(at + 8), height = view.getUint32(at + 12)
   insist(width > 0 && height > 0 && width * height <= 30_000_000, 'rendered_preview_too_large', 413)
  }
  if (['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'].includes(type)) chunks.push(bytes.subarray(at, end))
  if (type === 'IDAT') image = true
  at = end
  if (type === 'IEND') { ended = true; break }
 }
 insist(image && ended && at === bytes.length, 'collabora_render_invalid', 503)
 const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); at = 0
 for (const chunk of chunks) { result.set(chunk, at); at += chunk.length }
 return result
}

async function paginated(env: Bindings, v: FileVersion) {
 converter(env)
 insist(v.size <= SMALL, 'rendered_preview_too_large', 413)
 const office = /\.(docx|xlsx|pptx|odt|ods|odp|doc|xls|ppt)$/i.test(v.filename)
 insist(office || ['text', 'pdf', 'image'].includes(v.preview), 'rendered_preview_unsupported', 415)
 await assertContent(env, v.checksum)
 const blob = await env.BLOBS.get(`sha256/${v.checksum}`); insist(blob, 'blob_missing', 503)
 const bytes = new Uint8Array(await blob.arrayBuffer())
 insist(bytes.length === v.size && await digest(bytes) === v.checksum, 'blob_integrity', 503)
 let pdf: Uint8Array
 if (v.preview === 'pdf') pdf = bytes
 else if (['image/png', 'image/jpeg'].includes(v.mediaType)) {
  const document = await PDFDocument.create(), image = v.mediaType === 'image/png' ? await document.embedPng(bytes) : await document.embedJpg(bytes)
  insist(image.width * image.height <= 30_000_000, 'rendered_preview_too_large', 413)
  document.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  pdf = await document.save()
 } else pdf = await convert(env, bytes, v.preview === 'text' ? 'preview.txt' : v.filename, 'pdf')
 let document: PDFDocument
 try { document = await PDFDocument.load(pdf, { updateMetadata: false }) }
 catch { throw new ChestError('collabora_render_invalid', 503) }
 insist(document.getPageCount() > 0 && document.getPageCount() <= 200, 'rendered_preview_too_large', 413)
 return document
}

export function restrictedPreviewDocument(source: string, pages: number) {
 insist(source.startsWith('/') && !source.startsWith('//') && !/[\r\n]/.test(source), 'invalid_preview_path')
 const pageUrl = `${source}${source.includes('?') ? '&' : '?'}page=`
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>File preview</title><link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/chest-restricted-preview.css"><script src="/chest-restricted-preview.js" defer></script></head><body><main data-restricted-preview data-pages="${pages}" data-page-url="${esc(pageUrl)}"><nav aria-label="Preview pages"><button type="button" data-previous disabled>Previous page</button><span data-page-count>Page 1 of ${pages}</span><button type="button" data-next${pages === 1 ? ' disabled' : ''}>Next page</button></nav><p role="status" aria-live="polite" data-preview-status>Downloading, printing and copying are turned off.</p><img data-preview-page src="${esc(pageUrl)}1" alt="Rendered page 1" draggable="false"></main><noscript>Enable JavaScript to browse the rendered pages.</noscript></body></html>`, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "sandbox allow-scripts allow-same-origin; default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" } })
}

// Callers check their current staff or link authority before reading content, then fence it again before returning.
// No PDF, extracted text, document fields, or original object is returned from either response.
export async function renderRestrictedVersion(env: Bindings, version: FileVersion, source: string, page?: string | null): Promise<Response> {
 if (page !== undefined && page !== null) insist(/^[1-9]\d{0,2}$/.test(page), 'preview_page_not_found', 404)
 const document = await paginated(env, version), count = document.getPageCount()
 if (page === undefined || page === null) return restrictedPreviewDocument(source, count)
 const n = Number(page); insist(n <= count, 'preview_page_not_found', 404)
 const single = await PDFDocument.create(), [copied] = await single.copyPages(document, [n - 1])
 copied.node.delete(PDFName.of('Annots')); single.addPage(copied)
 const png = pixels(await convert(env, await single.save(), 'page.pdf', 'png'))
 return new Response(png as BodyInit, { headers: { ...headers, 'content-type': 'image/png', 'content-security-policy': "sandbox; default-src 'none'", 'content-length': String(png.length) } })
}

export async function renderedPreview(env: Bindings, s: Session, w: Who, key: string, versionId?: string, page?: string | null) {
 const ctx = await context(env, w, key); demand(ctx, 'view')
 const item = ctx.chain.at(-1)!, version = item.payload.versions.find(v => v.id === (versionId || item.payload.current))
 insist(item.payload.type === 'file' && version, 'version_not_found', 404)
 const response = await renderRestrictedVersion(env, version, `/api/chest/items/${encodeURIComponent(key)}/rendered-preview/${encodeURIComponent(version.id)}`, page)
 const current = await context(env, await who(env, s), key); demand(current, 'view')
 insist(current.chain.at(-1)!.payload.versions.some(v => v.id === version.id && v.checksum === version.checksum), 'version_not_found', 404)
 await commit(env, s, [], { fences: current.fences, audits: [{ action: 'version.preview', object: key, detail: { version: version.id, rendered: true, ...(page ? { page: Number(page) } : {}) } }] })
 return response
}
