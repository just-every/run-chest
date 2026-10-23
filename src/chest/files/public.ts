import { meterOriginal } from '../administration/egress'
import { openCollabora } from '../office/wopi'
import { guestAuthority } from './guest-mutations'
import { guestTools, guestPage, guestChange, guestVersion } from './guest-mutations'
import { activity } from '../content-security/activity'
import { transferPublic } from '../transfers/public'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { publicVersion } from './link-snapshots'
import { externalComments, externalComment } from './link-comments'
import { esc } from '../ui-shared'
import { isOffice } from '../office/service'
import { serve, digest } from '../blobs'
import { officePreview } from '../office/codec'
import { officeDocument } from '../office/service'
import { ChestError, insist, type Version } from '../model'
import { failure } from '../api'
import { commit, next } from './repo'
import { passwordMatches, unlockCookie, unlocked } from './capability'
import { fileThrough, reachable, resolveLink, type Resolved } from './public-links'
import { requestResponse } from './request-public'
import { linkPage, passwordPage, publicPage, refusedLink } from './ui-public'
// The doors for people without an account: /l/<token> (a link for anyone) and /r/<token> (a file request). Every
// request resolves the token again; posts must come from this origin.
import { guestEmail, guestVerification, verifyPage, confirmGuest } from './guest-links'
export async function publicResponse(request: Request, original: Bindings): Promise<Response | null> {
 const url = new URL(request.url), [door, secret, sub, key, extra] = url.pathname.split('/').filter(Boolean)
 if ((door !== 'l' && door !== 'r') || !secret || extra !== undefined) return null
 const env = runtimeBindings(original)
 try {
  if (request.method === 'POST') insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'invalid_origin', 403)
  else insist(request.method === 'GET' || request.method === 'HEAD', 'method_not_allowed', 405)
  if (door === 'l') { const transfer=await transferPublic(env,request,secret,sub,key);if(transfer)return transfer }
  if (door === 'l' && (sub === 'verify' || sub === 'confirm' || sub === 'pin')) {
   const r=await resolveLink(env,secret);if('refused' in r)return refusedLink(r.refused)
   insist(r.link.payload.audience==='guests' || r.link.payload.audience==='domain','not_found',404)
   const base=`/l/${secret}`
   if(request.method==='GET' && sub==='verify')return confirmGuest(base,url.searchParams.get('token')??'')
   insist(request.method==='POST','method_not_allowed',405)
   return await guestVerification(env,request,r,base,sub==='confirm',sub==='pin')
  }
  if(door==='l'&&(sub==='guest'||sub==='v'||sub==='editor')&&key){
   const r=await resolveLink(env,secret);if('refused' in r)return refusedLink(r.refused)
   if(sub==='editor'&&request.method==='POST'){const {s}=await guestAuthority(env,request,r);return await openCollabora(env,s,key)}
   if(sub==='v'&&request.method==='GET')return await guestVersion(env,request,r,key)
   if(sub==='guest'&&request.method==='POST')return await guestChange(env,request,r,`/l/${secret}`,key)
   if(sub==='guest'&&request.method==='GET')return await guestPage(env,request,r,`/l/${secret}`,key)
   insist(false,'method_not_allowed',405)
  }
  if(door==='l' && sub==='comments' && key && request.method==='POST')return await externalComment(env,request,secret,key)
  if (door === 'l' && !sub) return await (request.method === 'POST' ? unlock(env, request, secret) : open(env, request, secret))
  if (door === 'l' && sub === 'p' && key && request.method === 'GET') return await preview(env, request, secret, key)
  if (door === 'l' && sub === 'f' && key && request.method === 'GET') return await download(env, request, secret, key)
  if (door === 'r') return await requestResponse(env, request, secret, sub, key)
  return refusedLink('not_found')
 } catch (e) { const r = failure(e), body = await r.json() as { error: string }; return publicPage('Not accepted', `<p>Chest did not accept that request.</p><p class="mono">${body.error}</p>`, r.status) }
}
async function locked(env: Bindings, request: Request, r: Resolved) { return !!r.link.payload.password && !await unlocked(env, request, r.link.id, r.link.payload.password.hash) }
async function open(env: Bindings, request: Request, secret: string) {
 const r = await resolveLink(env, secret), base = `/l/${secret}`; if ('refused' in r) return refusedLink(r.refused)
 const actor=await guestEmail(env,request,r);if(!actor)return verifyPage(`/l/${secret}`)
 if (await locked(env, request, r)) return passwordPage(base)
 const files = (await reachable(env, r)).flatMap(({ row, path }) => { const v = publicVersion(row,r.link.payload); return v ? [{ id: row.id, path, name: row.payload.name, size: v.size, mediaType: v.mediaType, canPreview: v.size <= 8_000_000 && (isOffice(v.filename) || v.preview === 'text') }] : [] })
 await commit(env, null, [], { by: actor, audits: [{ action: 'link.view', object: r.root.id, detail: { link: r.link.id } }] })
 return linkPage(base, r.link.payload, r.root.payload, files, !r.state.noDownload,await externalComments(env,r,base)+await guestTools(env,request,r,base))
}
async function preview(env: Bindings, request: Request, secret: string, key: string) {
 const r = await resolveLink(env, secret); if ('refused' in r) return refusedLink(r.refused)
 const actor=await guestEmail(env,request,r);if(!actor)return verifyPage(`/l/${secret}`)
 if (await locked(env, request, r)) return passwordPage(`/l/${secret}`, false, 401)
 const file = await fileThrough(env, r, key, true); if (!file) return refusedLink('unavailable')
 const v = publicVersion(file.row,r.link.payload); insist(v, 'version_not_found', 404)
 insist(v.size <= 8_000_000, 'office_file_too_large', 413)
 const blob = await env.BLOBS.get(`sha256/${v.checksum}`); insist(blob, 'blob_missing', 503)
 const bytes = new Uint8Array(await blob.arrayBuffer()); insist(bytes.length === v.size && await digest(bytes) === v.checksum, 'blob_integrity', 503)
 const text = v.preview === 'text', result = text ? null : await officePreview(bytes); insist(text || result, 'office_format_unsupported', 415)
 await commit(env, null, [], { by: actor, fences: file.fences, audits: [{ action: 'link.preview', object: file.row.id, detail: { link: r.link.id, version: v.id } }] })
 return text ? publicPage(file.row.payload.name, `<pre class="receipt">${esc(new TextDecoder().decode(bytes))}</pre>`) : officeDocument(result!.html)
}
// Ten wrong passwords for one link in 15 minutes pause it; every refusal is audited without the attempt itself.
async function unlock(env: Bindings, request: Request, secret: string) {
 const r = await resolveLink(env, secret), base = `/l/${secret}`; if ('refused' in r) return refusedLink(r.refused)
 const actor=await guestEmail(env,request,r)
 if(!actor)return verifyPage(base)
 if (!r.link.payload.password) return new Response(null, { status: 303, headers: { location: base } })
 const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM chest_audit WHERE action='link.password.refused' AND object_id=? AND at>? AND json_extract(detail,'$.link')=?").bind(r.root.id, new Date(Date.now() - 15 * 60_000).toISOString(), r.link.id).first<{ n: number }>()
 if ((recent?.n ?? 0) >= 10) return publicPage('Too many attempts', '<p>This link is paused after too many wrong passwords. Try again in 15 minutes.</p>', 429)
 const form = await request.formData()
 if (!await passwordMatches(r.link.payload.password, form.get('password'))) { await commit(env, null, [], { by: actor, audits: [{ action: 'link.password.refused', object: r.root.id, detail: { link: r.link.id } }] }); return passwordPage(base, true, 401) }
 return new Response(null, { status: 303, headers: { location: base, 'set-cookie': await unlockCookie(env, base, r.link.id, r.link.payload.password.hash), 'cache-control': 'no-store' } })
}
// A download counts against the limit in the same commit that re-checks the link, the item's path and the sharer, so
// parallel downloads at the limit cannot pass it and a revoke between the check and the count refuses the bytes.
async function download(env: Bindings, request: Request, secret: string, key: string) {
 for (let attempt = 0; attempt < 6; attempt++) {
  const r = await resolveLink(env, secret); if ('refused' in r) return refusedLink(r.refused)
  const actor=await guestEmail(env,request,r);if(!actor)return verifyPage(`/l/${secret}`)
 if (await locked(env, request, r)) return passwordPage(`/l/${secret}`, false, 401)
  const file = await fileThrough(env, r, key); if (!file) return refusedLink(r.state.noDownload ? 'download_off' : 'not_found')
  const v = publicVersion(file.row,r.link.payload); insist(v, 'version_not_found', 404)
  await activity(env,null,'download',v.size,{actor,source:`link:${r.link.id}`,fences:file.fences})
  const response = await serve(env, v as unknown as Version, true), link = r.link.payload
  try { await commit(env, null, [{ row: next(r.link, { ...link, downloads: link.downloads + 1 }), previous: r.link }], { by: actor, fences: file.fences, audits: [{ action: 'link.download', object: file.row.id, detail: { link: r.link.id, version: v.id, downloads: link.downloads + 1, limit: link.limit } }] }); return meterOriginal(env,response,file.row.id,actor,'shared link') }
  catch (e) { if (!String((e as Error)?.message).includes('CHECK constraint failed')) throw e }
 }
 throw new ChestError('busy_try_again', 503)
}
