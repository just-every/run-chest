import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { context, type Who } from '../files/access'
import { composePage, statusPage } from './ui'
import { sheet, view } from './service'
// /app/signatures/<id>: the compose page while a request is a draft, its status and event log afterwards.
export async function signaturePage(env: Bindings, s: Session, w: Who, key: string) {
 const r = await view(env, s, w, key) as any
 if (r.status === 'draft') return composePage(r, (await sheet(env, s, w, key)).text)
 const ctx = await context(env, w, r.item), mine = r.createdBy === s.operator.email
 const checks = r.status === 'completed' && r.signed ? [{ version: r.signed.version, label: 'signed PDF' }, { version: r.certificate.version, label: 'audit certificate' }] : []
 return statusPage(r, { void: mine || ctx.state.manager, resend: mine }, checks)
}
