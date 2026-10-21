import { publicPage } from '../files/ui-public'
import { esc, stamp } from '../ui-shared'
import { box, sheets, type Span } from './ui-sheet'
import { consentText, CONSENT_VERSION, type Field, type SignRequest, type Signer } from './model'
// Pages for the person asked to sign. They show only this document and this signer's own steps.
const post = (base: string, sub: string, body: string, button: string, cls = 'action') => `<form method="post" action="${esc(base)}/${sub}">${body}<button class="${cls}">${esc(button)}</button></form>`
export function staffSignIn(base: string, email: string, wrong?: string) {
 return publicPage('Sign in to continue', wrong ? `<p>This request is for <strong>${esc(email)}</strong>, and you are signed in as ${esc(wrong)}. Sign out and sign in as ${esc(email)} to continue.</p>` : `<p>This request is for <strong>${esc(email)}</strong>. Sign in to Chest with that address to open the document.</p><p><a class="action" href="/signin?returnTo=${encodeURIComponent(base)}">Sign in</a></p>`, wrong ? 403 : 401)
}
export function pinPage(name: string, requester: string, signer: Signer, base: string, sent: boolean, message = '', status = 200) {
 const lead = name ? `<p>${esc(requester)} asked you to review and sign <strong>${esc(name)}</strong>. Nothing opens until you verify this email address: <strong>${esc(signer.email)}</strong>.</p>` : ''
 return publicPage('Verify your email', `${lead}${message ? `<p class="notice" role="alert">${esc(message)}</p>` : ''}${sent ? `<p>A one-time PIN was emailed to ${esc(signer.email)}. It works for 10 minutes.</p>${post(base, 'verify', '<label for="pin">PIN</label><input id="pin" name="pin" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required autofocus>', 'Verify')}${post(base, 'pin', '', 'Email me a new PIN', 'action secondary')}` : post(base, 'pin', '', 'Email me a PIN')}`, status)
}
const head = (p: SignRequest, requester: string) => `<p class="mono">${esc(p.name)} · requested by ${esc(requester)}${p.expires ? ` · open until ${stamp(p.expires)}` : ''}</p>`
export function consentPage(p: SignRequest, signer: Signer, base: string, requester: string) {
 return publicPage('Before you sign', `${head(p, requester)}<section aria-label="Electronic records consent"><h2>Electronic records and signatures</h2>${consentText.map(t => `<p>${esc(t)}</p>`).join('')}<p class="mono">Disclosure ${CONSENT_VERSION}</p></section>${post(base, 'consent', '', 'I agree to sign electronically')}${decline(base)}`)
}
const decline = (base: string) => `<details><summary>Decline to sign</summary>${post(base, 'decline', '<label for="reason">Reason</label><textarea id="reason" name="reason" required maxlength="500"></textarea>', 'Decline to sign', 'action secondary')}</details>`
const label = (f: Field) => f.label || ({ signature: 'Signature', initials: 'Initials', date: 'Date signed', text: 'Text', checkbox: 'Check' } as const)[f.type]
export function signerPage(p: SignRequest, signer: Signer, base: string, text: Span[][], requester: string) {
 const mine = p.fields.filter(f => f.signer === signer.id), names = new Map(p.signers.map(s => [s.id, s.name]))
 const overlay = (page: number, size: { w: number; h: number }) => p.fields.filter(f => f.page === page).map(f => box(f, f.signer === signer.id ? `${label(f)} · you` : `${label(f)} · ${names.get(f.signer)}`, f.signer === signer.id ? 'mine' : 'other', size)).join('')
 const inputs = mine.filter(f => f.type === 'text' || f.type === 'checkbox').map(f => f.type === 'text' ? `<label>${esc(label(f))}<input name="f:${esc(f.id)}" maxlength="500"${f.required ? ' required' : ''}></label>` : `<label class="check"><input type="checkbox" name="f:${esc(f.id)}" value="true"${f.required ? ' required' : ''}> ${esc(label(f))}</label>`).join('')
 const initials = mine.some(f => f.type === 'initials') ? '<label>Your initials<input name="initials" maxlength="6" autocomplete="off"></label>' : ''
 return publicPage(`Sign ${p.name}`, `${head(p, requester)}<p>You are signing as <strong>${esc(signer.name)}</strong> (${esc(signer.email)}). Fields marked "you" are yours; only this document is shown.</p><p><a href="${esc(base)}/document" target="_blank" rel="noopener">Open the PDF</a></p>${sheets(p.document.pages.slice(0, text.length), text, overlay)}<form method="post" action="${esc(base)}/sign" class="sign-form"><h2>Adopt your signature</h2><label>Type your full name to adopt it as your signature<input name="adopt" value="${esc(signer.name)}" minlength="2" maxlength="100" autocomplete="name" required></label>${initials}${inputs}<label class="check"><input type="checkbox" name="intent" value="true" required> I adopt this as my signature and intend to sign ${esc(p.name)} electronically.</label><button class="action">Adopt and sign</button></form>${decline(base)}`)
}
export function waitingPage(p: SignRequest, signer: Signer, signed = false) {
 const before = p.signers.filter(s => s.state !== 'signed' && s.order < signer.order).length
 return publicPage(signed ? 'You have signed' : 'Waiting for the earlier signers', signed ? `<p>Thank you, ${esc(signer.name)}. Your signature on <strong>${esc(p.name)}</strong> was recorded${signer.signedAt ? ` at ${stamp(signer.signedAt)}` : ''}. When everyone has signed, you will receive the completed copy by email.</p>` : `<p>This request is in order. ${before} earlier signer${before === 1 ? '' : 's'} must sign before you. Chest emails you when it is your turn.</p>`)
}
export function outcomePage(p: SignRequest, signer: Signer) {
 const o = p.outcome, why = { voided: 'The person who sent it voided the request.', expired: 'The request expired before everyone signed.', declined: 'A signer declined to sign.' } as Record<string, string>
 return publicPage('This request is closed', `<p>${esc(p.name)} will not be signed through this link. ${esc(why[o?.status ?? ''] ?? '')}${o?.reason && o.status !== 'declined' ? ` ${esc(o.reason)}` : ''}</p><p>Nothing was signed or filed. Ask ${esc(p.createdBy)} if you still need to sign.</p>`, 410)
}
export function completedPage(p: SignRequest, signer: Signer, base: string) {
 return publicPage('Signed by everyone', `<p><strong>${esc(p.name)}</strong> was signed by ${p.signers.map(s => esc(s.name)).join(', ')} and sealed${p.outcome ? ` at ${stamp(p.outcome.at)}` : ''}.</p><ul><li><a href="${esc(base)}/signed">Download the signed PDF</a> <span class="mono">SHA-256 ${esc(p.signed?.checksum ?? '')}</span></li><li><a href="${esc(base)}/certificate">Download the audit certificate</a> <span class="mono">SHA-256 ${esc(p.certificate?.checksum ?? '')}</span></li></ul>`)
}
