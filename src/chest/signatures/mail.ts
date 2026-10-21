import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { attempt } from '../audit/journal'
import { esc } from '../ui-shared'
// Signing mail goes through the installation's mail provider; the provider's own outcome is journaled, never assumed.
export async function sendMail(env: Bindings, to: string, subject: string, text: string, deliveryId: string, object: string, purpose: string) {
 const sender = operatorMail(env)
 if (!sender || !env.MAIL_FROM) return 'not_configured'
 try {
  const result = await attempt(env, 'chest:signing', 'provider.mail', object, { authority: 'signature request', purpose, provider: String(env.MAIL_PROVIDER) }, () => sender.send({ deliveryId, from: env.MAIL_FROM!, to: [to], subject, text, html: `<p>${esc(text).replace(/\n/g, '<br>')}</p>`, headers: { 'Auto-Submitted': 'auto-generated' } }))
  return String(result.status)
 } catch (e: any) { return `failed:${typeof e?.code === 'string' ? e.code : 'send_error'}` }
}
export const link = (env: Bindings, token: string) => `${env.AUTH_ORIGIN}/sign/${token}`
