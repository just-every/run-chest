import { esc } from './ui-shared'
// A one-time secret (a new link) shown on the page the person comes back to, not on the address that took the form. The
// secret rides one short-lived cookie that only the browser reads: it is cleared the moment a page shows it, and Chest
// keeps nothing, so a link can be copied once and never shown again.
const cookie = 'chest-flash'
export type Flash = { title: string; url: string; note: string }
const encode = (f: Flash) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(f)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decode = (v: string): Flash | null => { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))) } catch { return null } }
export const flashRedirect = (f: Flash, to: string, headers: Record<string, string>) => new Response(null, { status: 303, headers: { ...headers, location: to, 'set-cookie': `${cookie}=${encode(f)}; Path=/app; Max-Age=300; HttpOnly; SameSite=Strict` } })
const banner = (f: Flash) => `<section class="flash" role="status" aria-label="${esc(f.title)}"><div><strong>${esc(f.title)}</strong><p class="quiet">${esc(f.note)}</p></div><div class="flash-copy"><input class="mono" readonly value="${esc(f.url)}" aria-label="Link"><button type="button" class="btn" data-copy>Copy link</button></div></section><script src="/chest-copy.js" defer></script>`
export async function showFlash(request: Request, response: Response) {
 const found = /(?:^|;\s*)chest-flash=([^;]+)/.exec(request.headers.get('cookie') ?? '')
 if (!found || response.status !== 200 || !(response.headers.get('content-type') ?? '').includes('text/html')) return response
 const flash = decode(found[1]), html = await response.text(), headers = new Headers(response.headers)
 headers.append('set-cookie', `${cookie}=; Path=/app; Max-Age=0; HttpOnly; SameSite=Strict`)
 return new Response(flash ? html.replace('<main class="app-main">', `<main class="app-main">${banner(flash)}`) : html, { status: 200, headers })
}
