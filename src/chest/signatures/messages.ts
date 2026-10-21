import type { Bindings } from '../../auth.server'
import { deliver, notice } from '../files/notify'
import { commit } from '../files/repo'
import { id } from '../model'
import { link, sendMail } from './mail'
import type { SignRequest, Signer } from './model'
import { getRequest, signerToken } from './store'
const when = (iso: string | null) => iso ? iso.slice(0, 10) : 'later'
// The invitation names the sender and document and carries the signer's own link; the link alone opens nothing for an
// external signer until the PIN sent to this address is entered, and a staff signer must be signed in as this address.
export async function invite(env: Bindings, r: SignRequest, key: string, signer: Signer, requester: string) {
 const token = await signerToken(env, key, signer)
 const how = signer.staff ? 'Open the link and sign in to Chest as this address to continue.' : 'Open the link. Chest emails a one-time PIN to this address before the document opens.'
 return sendMail(env, signer.email, `${requester} asked you to sign ${r.name}`, `${requester} asked you to review and sign ${r.name}${r.expires ? ` by ${when(r.expires)}` : ''}.\n\n${how}\n\n${link(env, token)}\n\nYou will see only this document. If you did not expect this, do not open the link.`, id(), key, 'invitation')
}
export async function reminder(env: Bindings, r: SignRequest, key: string, signer: Signer, requester: string) {
 const token = await signerToken(env, key, signer)
 return sendMail(env, signer.email, `Reminder: ${requester} is waiting for your signature on ${r.name}`, `${requester} is still waiting for you to sign ${r.name}${r.expires ? `. The request expires ${when(r.expires)}` : ''}.\n\n${link(env, token)}`, id(), key, 'reminder')
}
// Outcomes go to the requester as notices (in app and by mail); completion also mails every signer the completed-copy link.
export async function tell(env: Bindings, r: SignRequest, key: string, outcome: 'completed' | 'declined' | 'voided' | 'expired', detail = '') {
 const text = { completed: `Everyone signed ${r.name}. The signed PDF and its audit certificate are now versions of the file.`, declined: `${detail || 'A signer'} declined to sign ${r.name}. Nothing was signed or filed.`, voided: `The request to sign ${r.name} was voided. Nothing was signed or filed.`, expired: `The request to sign ${r.name} expired before everyone signed. Nothing was signed or filed.` }[outcome]
 const n = notice(r.createdBy, `signature.${outcome}`, r.item, r.createdBy, text)
 await commit(env, null, [{ row: n }], { by: 'chest:signing' })
 await deliver(env, null, [n])
}
export const completedMail = async (env: Bindings, r: SignRequest, key: string, signer: Signer) => sendMail(env, signer.email, `Signed: ${r.name}`, `Everyone has signed ${r.name}. Open your link to download the signed PDF and its audit certificate. You will be asked to verify again.\n\n${link(env, await signerToken(env, key, signer))}`, id(), key, 'completed')
export const cancelled = (env: Bindings, r: SignRequest, key: string, signer: Signer, why: string) => sendMail(env, signer.email, `${r.name}: signing ${why}`, `The request to sign ${r.name} was ${why}. Nothing was signed, and your earlier link no longer opens the document.`, id(), key, why)
export { getRequest }
