import type { Bindings } from '../../auth.server'
import { digest } from '../blobs'
import { attempt } from './journal'
export async function publicAttempt(env: Bindings, request: Request, run: () => Promise<Response|null>) {
 const [door, token, sub] = new URL(request.url).pathname.split('/').filter(Boolean)
 if (!['l','r'].includes(door) || !token) return run()
 const hash = await digest(new TextEncoder().encode(token))
 const row = await env.DB.prepare("SELECT id,payload FROM chest_records WHERE kind=? AND json_extract(payload,'$.tokenHash')=?").bind(door==='l'?'public-link':'file-request',hash).first<{id:string;payload:string}>()
 const payload = row ? JSON.parse(row.payload) : null
 return attempt(env,'Link visitor',`public.${door==='l'?'link':'request'}.${request.method.toLowerCase()}`,payload?.item ?? payload?.folder ?? 'public request',{authority:door==='l'?'scoped link':'upload-only request',...(row?{link:row.id}:{}),operation:sub??'open'},run)
}
