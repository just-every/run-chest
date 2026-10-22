import { activity } from '../content-security/activity'
import { assertContent, contentReadable } from '../content-security/scan'
import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { failure } from '../api'
import { ChestError, insist, now } from '../model'
import { personName } from '../names'
import type { Person } from '../model'
import { maybe } from '../files/repo'
import { publicPage } from '../files/ui-public'
import { complete } from './complete'
import { cancelled, invite, tell } from './messages'
import { sendMail } from './mail'
import { documentBytes } from './service'
import { textMap } from './pdf-tools'
import { settle } from './sweep'
import { byToken, event, getRequest, mac, mutate, origin, same } from './store'
import { outcomePage, pinPage, signerPage, staffSignIn, waitingPage, completedPage, consentPage } from './ui-signer'
import type { SignRequest, Signer } from './model'
// The signer's door: /sign/<link>. The link names one signer on one request. An external signer enters the PIN emailed
// to the invited address; a staff signer signs in as that address. Neither gains access to anything but this document.
const hour = 3_600_000
export async function signResponse(request: Request, original: Bindings): Promise<Response | null> {
 const url = new URL(request.url), [door, secret, sub, extra] = url.pathname.split('/').filter(Boolean)
 if (door !== 'sign' || !secret || extra !== undefined) return null
 const env = runtimeBindings(original)
 try {
  if (request.method === 'POST') insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'invalid_origin', 403)
  else insist(request.method === 'GET' || request.method === 'HEAD', 'method_not_allowed', 405)
  const found = /^chest_sign_[A-Za-z0-9_-]{43}$/.test(secret) ? await byToken(env, secret) : null
  if (!found) return publicPage('Signing link not found', '<p>This signing link does not exist or was replaced. Ask the person who sent it for a new one.</p>', 404)
  const row = await settle(env, found.row.id), signer = row.payload.signers.find(s => s.id === found.signer.id)!, base = `/sign/${secret}`, from = origin(request)
  if (row.payload.signers.find(s => s.id === signer.id)?.tokenHash !== found.signer.tokenHash) return publicPage('Signing link not found', '<p>This signing link was replaced. Ask the person who sent it for a new one.</p>', 404)
  insist(await contentReadable(env,[{checksum:row.payload.sourceChecksum}],'',true),'content_quarantined',423)
  const requester = personName((await maybe<Person>(env, 'person', row.payload.createdBy))?.payload.name, row.payload.createdBy)
  if (request.method === 'POST' && sub === 'pin') return await sendPin(env, row.payload, row.id, signer, base, requester)
  const verified = await admitted(env, request, row.payload, row.id, signer)
  if (verified instanceof Response) return verified
  if (request.method === 'POST' && sub === 'verify') return await checkPin(env, request, row.id, signer, base, from)
  if (verified.pending) return signer.staff ? staffSignIn(base, signer.email, verified.wrong) : pinPage(row.payload.name, requester, signer, base, !!verified.sent)
  const p = row.payload
  if (verified.method === 'sign-in' && !signer.verified) await mutate(env, row.id, async r => r.payload.signers.find(s => s.id === signer.id)?.verified ? null : { payload: { ...r.payload, signers: r.payload.signers.map(s => s.id === signer.id ? { ...s, verified: { method: 'sign-in', at: now() } } : s), events: [...r.payload.events, event('verified', from, { signer: signer.id, email: signer.email, method: 'sign-in' })] } })
  if (sub === 'signed' || sub === 'certificate') { insist(p.status === 'completed' && p[sub === 'signed' ? 'signed' : 'certificate'], 'not_found', 404); await activity(env,null,'download',p[sub==='signed'?'signed':'certificate']!.size,{actor:signer.email,source:`signature:${row.id}`,fences:[row]});return await file(env,p,sub) }
  if (sub === 'document') { insist(p.status === 'pending' && (signer.state === 'invited' || signer.state === 'viewed'), 'not_found', 404); await activity(env,null,'download',p.document.size,{actor:signer.email,source:`signature:${row.id}`,fences:[row]});return pdf(await documentBytes(env, p), `${p.name.replace(/\.(pdf|docx)$/i, '')}.pdf`) }
  if (request.method === 'POST' && ['consent', 'sign', 'decline'].includes(sub ?? '') && (p.status === 'declined' || p.status === 'voided' || p.status === 'expired')) return outcomePage(p, signer)
  if (request.method === 'POST' && sub === 'consent') return await consent(env, row.id, signer, base, from)
  if (request.method === 'POST' && sub === 'sign') return await sign(env, request, row.id, signer, base, from, requester)
  if (request.method === 'POST' && sub === 'decline') return await decline(env, request, row.id, signer, base, from)
  insist(request.method === 'GET' && !sub, 'not_found', 404)
  if (p.status === 'completed') return completedPage(p, signer, base)
  if (p.status !== 'pending' || signer.state === 'declined') return outcomePage(p, signer)
  if (signer.state === 'waiting') return waitingPage(p, signer)
  if (signer.state === 'signed') return waitingPage(p, signer, true)
  if (!signer.consentAt) return consentPage(p, signer, base, requester)
  const text = await textMap(await documentBytes(env, p), Math.min(40, Math.max(12, ...p.fields.filter(f => f.signer === signer.id).map(f => f.page))))
  if (signer.state === 'invited') await mutate(env, row.id, async r => r.payload.signers.find(s => s.id === signer.id)?.state !== 'invited' ? null : { payload: { ...r.payload, signers: r.payload.signers.map(s => s.id === signer.id ? { ...s, state: 'viewed' } : s), events: [...r.payload.events, event('viewed', from, { signer: signer.id, email: signer.email })] } })
  return signerPage(p, signer, base, text, requester)
 } catch (e) { const r = failure(e), body = await r.json() as { error: string }; return publicPage('Not accepted', `<p>Chest did not accept that request.</p><p class="mono">${body.error}</p>`, r.status) }
}
const pdf = (bytes: Uint8Array, name: string) => new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${name.replace(/[^\w.-]+/g, '_')}"`, 'content-length': String(bytes.length), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
async function file(env: Bindings, p: SignRequest, kind: 'signed' | 'certificate') {
 await assertContent(env,p.sourceChecksum)
 const stored = p[kind]!, object = await env.BLOBS.get(`sha256/${stored.checksum}`); insist(object, 'blob_missing', 503)
 return pdf(new Uint8Array(await object.arrayBuffer()), `${p.name.replace(/\.(pdf|docx)$/i, '')}-${kind}.pdf`)
}
// Who is asking: a staff signer holds a Chest session for the invited address; an external signer holds the cookie a PIN earned.
async function admitted(env: Bindings, request: Request, p: SignRequest, key: string, signer: Signer): Promise<Response | { pending?: true; sent?: boolean; wrong?: string; method?: 'pin' | 'sign-in' }> {
 if (signer.staff) {
  const session = await operatorAuth(env).getSession(request).catch(() => null)
  if (!session) return request.method === 'GET' && !new URL(request.url).pathname.split('/')[3] ? new Response(null, { status: 303, headers: { location: `/signin?returnTo=${encodeURIComponent(new URL(request.url).pathname)}`, 'cache-control': 'no-store' } }) : { pending: true }
  if (session.operator.email.toLowerCase() !== signer.email) return { pending: true, wrong: session.operator.email }
  return { method: 'sign-in' }
 }
 const value = (request.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith('chest_signer='))?.slice(13) ?? '', [id, until, tag] = value.split('.')
 if (id === signer.id && Number(until) > Date.now() && tag && same(tag, await mac(env, `${key}:${id}:${until}`))) return { method: 'pin' }
 return { pending: true }
}
async function sendPin(env: Bindings, p: SignRequest, key: string, signer: Signer, base: string, requester: string) {
 if (signer.staff || p.status !== 'pending' && p.status !== 'completed' || signer.state === 'declined') return publicPage('Not accepted', '<p>Chest did not accept that request.</p>', 409)
 const recent = await env.DB.prepare("SELECT COUNT(*) n FROM chest_audit WHERE action='signature.pin' AND object_id=? AND at>?").bind(`${key}:${signer.id}`, new Date(Date.now() - 15 * 60_000).toISOString()).first<{ n: number }>()
 if ((recent?.n ?? 0) >= 5) return pinPage(p.name, requester, signer, base, false, 'Too many PINs were requested. Try again in 15 minutes.', 429)
 const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
 const hash = await mac(env, `pin:${key}:${signer.id}:${pin}`)
 await mutate(env, key, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(s => s.id === signer.id ? { ...s, credential: { hash, expires: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0 } } : s) }, audits: [{ action: 'signature.pin', object: `${key}:${signer.id}`, detail: { signer: signer.email } }], by: 'signature link' }))
 const mail = await sendMail(env, signer.email, `Your PIN to sign ${p.name}`, `Your one-time PIN is ${pin}. It works for 10 minutes. Enter it on the signing page to open ${p.name}.\n\nIf you did not ask for this, ignore this message: nobody can open the document without it.`, crypto.randomUUID(), key, 'pin')
 insist(mail === 'accepted' || mail === 'suppressed', 'verification_mail_failed', 503)
 return pinPage(p.name, requester, signer, base, true)
}
async function checkPin(env: Bindings, request: Request, key: string, signer: Signer, base: string, from: ReturnType<typeof origin>) {
 const given = String((await request.formData()).get('pin') ?? '').replace(/\s/g, ''), credential = signer.credential
 if (!credential || Date.parse(credential.expires) <= Date.now() || credential.attempts >= 5) return pinPage('', '', signer, base, false, 'That PIN expired. Request a new one.', 403)
 const good = /^\d{6}$/.test(given) && same(await mac(env, `pin:${key}:${signer.id}:${given}`), credential.hash)
 await mutate(env, key, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(s => s.id === signer.id ? { ...s, credential: good ? undefined : { ...credential, attempts: credential.attempts + 1 }, ...(good ? { verified: { method: 'pin' as const, at: now() } } : {}) } : s), ...(good ? { events: [...r.payload.events, event('verified', from, { signer: signer.id, email: signer.email, method: 'pin' })] } : {}) } }))
 if (!good) return pinPage('', '', signer, base, true, 'That PIN is not right.', 403)
 const until = Date.now() + hour, cookie = `chest_signer=${signer.id}.${until}.${await mac(env, `${key}:${signer.id}:${until}`)}`
 return new Response(null, { status: 303, headers: { location: base, 'cache-control': 'no-store', 'set-cookie': `${cookie}; Path=${base}; Max-Age=3600; HttpOnly; Secure; SameSite=Lax` } })
}
const redirect = (base: string) => new Response(null, { status: 303, headers: { location: base, 'cache-control': 'no-store' } })
async function consent(env: Bindings, key: string, signer: Signer, base: string, from: ReturnType<typeof origin>) {
 await mutate(env, key, async r => { const s = r.payload.signers.find(x => x.id === signer.id); insist(r.payload.status === 'pending' && s && (s.state === 'invited' || s.state === 'viewed'), 'signature_not_pending', 409); return s.consentAt ? null : { payload: { ...r.payload, signers: r.payload.signers.map(x => x.id === signer.id ? { ...x, consentAt: now() } : x), events: [...r.payload.events, event('consented', from, { signer: signer.id, email: signer.email, detail: 'electronic records consent accepted' })] } } })
 return redirect(base)
}
async function sign(env: Bindings, request: Request, key: string, signer: Signer, base: string, from: ReturnType<typeof origin>, requester: string) {
 const form = await request.formData(), get = (k: string) => String(form.get(k) ?? '').trim()
 const name = get('adopt'), initials = get('initials') || name.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase()
 insist(get('intent') === 'true', 'intent_required', 422); insist(name.length >= 2 && name.length <= 100 && !/[\x00-\x1f]/.test(name), 'signature_name_required', 422)
 let invited: string[] = []
 const updated = await mutate(env, key, async r => {
  const s = r.payload.signers.find(x => x.id === signer.id)
  insist(r.payload.status === 'pending' && s && (s.state === 'invited' || s.state === 'viewed'), 'signature_not_pending', 409); insist(s.consentAt, 'consent_required', 409)
  const values = new Map<string, string>()
  for (const f of r.payload.fields.filter(f => f.signer === s.id && (f.type === 'text' || f.type === 'checkbox'))) { const v = f.type === 'checkbox' ? (form.get(`f:${f.id}`) === 'true' ? 'true' : '') : get(`f:${f.id}`); insist(!f.required || v, 'field_required', 422); insist(v.length <= 500, 'field_invalid', 422); values.set(f.id, v) }
  const at = now(), signed = r.payload.signers.map(x => x.id === s.id ? { ...x, state: 'signed' as const, signedAt: at, adopted: { name, initials } } : x)
  const rest = signed.filter(x => x.state !== 'signed'), nextOrder = rest.length ? Math.min(...rest.map(x => x.order)) : 0
  invited = signed.filter(x => x.state === 'waiting' && x.order === nextOrder).map(x => x.id)
  const signers = signed.map(x => invited.includes(x.id) ? { ...x, state: 'invited' as const, invitedAt: at } : x)
  return { payload: { ...r.payload, signers, fields: r.payload.fields.map(f => values.has(f.id) ? { ...f, value: values.get(f.id) } : f), events: [...r.payload.events, event('signed', from, { signer: s.id, email: s.email, method: s.verified?.method, detail: 'adopted a signature and signed' })] }, audits: [{ action: 'signature.sign', object: r.payload.item, detail: { request: key, signer: s.email } }], by: s.email }
 })
 if (updated.payload.signers.every(s => s.state === 'signed')) await complete(env, key, from)
 else for (const id of invited) await announce(env, key, updated.payload.signers.find(x => x.id === id)!, requester)
 return redirect(base)
}
// The next signer in order is invited the moment the one before has signed.
async function announce(env: Bindings, key: string, s: Signer, requester: string) {
 const row = await getRequest(env, key), mail = await invite(env, row.payload, key, s, requester)
 await mutate(env, key, async r => ({ payload: { ...r.payload, signers: r.payload.signers.map(x => x.id === s.id ? { ...x, mail } : x), events: [...r.payload.events, event('invited', { ip: 'chest', agent: 'Chest signing order' }, { signer: s.id, email: s.email, detail: `mail ${mail}` })] } }))
}
async function decline(env: Bindings, request: Request, key: string, signer: Signer, base: string, from: ReturnType<typeof origin>) {
 const reason = String((await request.formData()).get('reason') ?? '').trim().slice(0, 500); insist(reason, 'decline_reason_required', 422)
 const before = await mutate(env, key, async r => { const s = r.payload.signers.find(x => x.id === signer.id); insist(r.payload.status === 'pending' && s && (s.state === 'invited' || s.state === 'viewed'), 'signature_not_pending', 409); return { payload: { ...r.payload, status: 'declined', signers: r.payload.signers.map(x => x.id === s.id ? { ...x, state: 'declined' } : x), outcome: { at: now(), status: 'declined', reason }, events: [...r.payload.events, event('declined', from, { signer: s.id, email: s.email, detail: reason })] }, audits: [{ action: 'signature.decline', object: r.payload.item, detail: { request: key, signer: s.email } }], by: s.email } })
 await tell(env, before.payload, key, 'declined', signer.email)
 for (const s of before.payload.signers.filter(x => x.id !== signer.id && x.state !== 'signed')) await cancelled(env, before.payload, key, s, 'declined by another signer')
 return redirect(base)
}
