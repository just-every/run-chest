import { headers } from '../api'
import { head, policy } from '../ui-shell'
import { esc } from '../ui-shared'
import { size } from './ui-list'
// Pages for people without a Chest account: a link for anyone and a file request. They read like sign-in (the
// wordmark above one card), carry no script, and never show more than the link itself reveals.
// Request limits are set in decimal megabytes, so they read back that way.
export const megabytes = (n: number) => `${+(n / 1_000_000).toFixed(1)} MB`
export function publicPage(title: string, body: string, status = 200, extra: Record<string, string> = {}) {
 return new Response(`<!doctype html><html lang="en" class="rer-themed"><head>${head(`${title} · Chest`)}</head><body><main><p class="brand"><span data-rer-name>Chest</span></p><h1>${esc(title)}</h1>${body}</main></body></html>`, { status, headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': policy, 'x-robots-tag': 'noindex', ...extra } })
}
const gone: Record<string, [string, string]> = {
 not_found: ['Link not found', 'This link does not exist. Check that you copied all of it, or ask the person who sent it.'],
 unavailable: ['Link not available', 'This link no longer opens anything. Ask the person who sent it for a new one.'],
 revoked: ['Link turned off', 'The person who shared this link turned it off. Ask them for a new one if you still need the file.'],
 expired: ['Link expired', 'This link has expired. Ask the person who shared it for a new one.'],
 limit: ['Download limit reached', 'This link has been used for all the downloads it allows. Ask the person who shared it for a new one.'],
 download_off: ['Downloads turned off', 'The owner turned off downloads for this file.'],
}
export const refusedLink = (reason: string) => { const [title, text] = gone[reason] ?? gone.not_found; return publicPage(title, `<p>${esc(text)}</p>`, reason === 'not_found' || reason === 'unavailable' ? 404 : 410) }
export const passwordPage = (action: string, wrong = false, status = 200) => publicPage('Enter the password', `<p>The person who shared this link protected it with a password.</p>${wrong ? '<p class="notice" role="alert">That password is not right. Try again.</p>' : ''}<form method="post" action="${esc(action)}"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button class="action">Open</button></form>`, status)
const until = (link: { expires: string | null; limit: number | null; downloads: number }) => [link.expires ? `Open until ${esc(link.expires.slice(0, 10))}` : '', link.limit !== null ? `${link.limit - link.downloads} of ${link.limit} downloads left` : ''].filter(Boolean).join(' · ')
export function linkPage(base: string, link: { expires: string | null; limit: number | null; downloads: number }, root: { name: string; type: string }, files: { id: string; path: string; name: string; size: number; mediaType: string }[], downloads: boolean) {
 const terms = until(link)
 const facts = (f: { size: number; mediaType: string }) => `${esc(size(f.size))} · ${esc(f.mediaType)}`
 const rows = root.type === 'folder' ? files.map(f => `<p><strong>${esc(f.path)}${esc(f.name)}</strong><br><span class="mono">${facts(f)}</span>${downloads ? ` · <a href="${esc(`${base}/f/${f.id}`)}" download>Download</a>` : ''}</p>`).join('') : files[0] ? `<p class="mono">${facts(files[0])}</p>` : ''
 const lede = root.type === 'folder' ? `<p>A folder shared with you. ${files.length ? `${files.length} file${files.length === 1 ? '' : 's'} you can download.` : 'It has no files yet.'}</p>` : '<p>A file shared with you. You do not need an account to download it.</p>'
 return publicPage(root.name, `${lede}${terms ? `<p class="mono">${terms}</p>` : ''}${rows}${downloads ? root.type === 'file' && files[0] ? `<p><a class="action" href="${esc(`${base}/f/${files[0].id}`)}" download>Download</a></p>` : '' : `<p class="notice">${esc(gone.download_off[1])}</p>`}`)
}
export const closedRequest = () => publicPage('File request closed', '<p>This file request is no longer accepting files. Ask the person who sent it whether they still need them.</p>', 410)
export const missingRequest = () => publicPage('File request not found', '<p>This file request does not exist. Check that you copied all of the link.</p>', 404)
export function requestPage(action: string, r: { title: string; message: string; types: string[]; maxBytes: number; deadline: string | null; asker: string }, error = '', status = 200) {
 const limits = [`Up to 10 files, each up to ${esc(megabytes(r.maxBytes))}`, r.types.length ? `Accepted: ${esc(r.types.join(', '))}` : '', r.deadline ? `Open until ${esc(r.deadline.slice(0, 10))}` : ''].filter(Boolean).join(' · ')
 return publicPage(r.title, `<p>${esc(r.asker)} asked you for files. You do not need an account, and you will not see anything else in their Chest.</p>${r.message ? `<p class="notice">${esc(r.message)}</p>` : ''}<p class="mono">${limits}</p>${error ? `<p class="notice" role="alert">${esc(error)}</p>` : ''}<form method="post" action="${esc(action)}" enctype="multipart/form-data"><label for="name">Your name (optional)</label><input id="name" name="name" autocomplete="name"><label for="email">Your email (optional)</label><input id="email" name="email" type="email" autocomplete="email"><label for="files">Files</label><input id="files" name="files" type="file" multiple required${r.types.length ? ` accept="${esc(r.types.map(t => `.${t}`).join(','))}"` : ''}><button class="action">Upload</button></form>`, status)
}
export function receiptPage(action: string, receipt: { title: string; at: string; files: { name: string; size: number; checksum: string }[] }) {
 return publicPage('Files received', `<p>Thank you. ${receipt.files.length === 1 ? 'Your file was' : `All ${receipt.files.length} files were`} received for “${esc(receipt.title)}” at <span class="mono">${esc(receipt.at.slice(0, 16).replace('T', ' '))} UTC</span>. The person who asked has been told.</p>${receipt.files.map(f => `<p><strong>${esc(f.name)}</strong><br><span class="mono">${esc(size(f.size))} · SHA-256 ${esc(f.checksum.slice(0, 12))}…</span></p>`).join('')}<p class="secondary-link"><a href="${esc(action)}">Send more files</a></p>`)
}
