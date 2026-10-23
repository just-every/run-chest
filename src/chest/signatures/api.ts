import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { rotateSigningCustody } from './custody'
import { insist } from '../model'
import type { Who } from '../files/access'
import { draft, forItem, resend, send, sheet, validate, view, voidRequest } from './service'
// /api/chest/signatures: draft a request from a file version, send it, read it, void it, resend a link, check a seal.
export async function signaturesExecute(env: Bindings, request: Request, s: Session, w: Who, method: string, parts: string[], input: any, url: URL) {
 const [, key, sub] = parts, get = method === 'GET', post = method === 'POST'
 if (post && key === 'rotate-key' && !sub) return rotateSigningCustody(env, s, input)
 if (post && !key) return draft(env, s, w, input)
 if (get && !key) return forItem(env, s, w, String(url.searchParams.get('item') ?? ''))
 if (post && key === 'validate') return validate(env, s, w, input)
 if (get && key && !sub) return view(env, s, w, key)
 if (get && key && sub === 'sheet') return sheet(env, s, w, key)
 if (post && key && sub === 'send') return send(env, s, w, key, input, request)
 if (post && key && sub === 'void') return voidRequest(env, s, w, key, input, request)
 if (post && key && sub === 'remind') return resend(env, s, w, key, input, request)
 insist(false, 'not_found', 404)
}
