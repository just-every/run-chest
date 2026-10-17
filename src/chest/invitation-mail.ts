import type { MailMessage, MailSender } from '../modules/operator-auth/index.mjs'
import branding from '../branding.json'
// Base's invitation email names only the product. Who invited them is the first thing the invited person needs, so
// the one message an invitation sends carries the inviter in its subject, opening line and heading.
const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
export function namingInviter(sender: MailSender | undefined, inviter: string): MailSender | undefined {
 if (!sender) return sender
 const line = `${inviter} invited you to ${branding.name}.`
 return {
  send(message: MailMessage) {
   if (!message.html.includes('</h1>')) throw new Error('Base invitation email no longer has a heading; update src/chest/invitation-mail.ts.')
   return sender.send({ ...message, subject: `${inviter} invited you to ${branding.name}`, text: `${line}\n\n${message.text}`, html: message.html.replace('</h1>', `</h1><p>${escape(line)}</p>`) })
  },
 }
}
