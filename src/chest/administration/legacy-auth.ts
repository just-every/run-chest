import type { Bindings } from '../../auth.server'
import { baseOperatorAuth } from '../../auth.server'
import { requireMfa } from '../security/session'
import { failure } from '../api'
import { insist } from '../model'
import { administrativePersonAction } from './people'
// Existing identity URLs obey the same delegated scope and last-admin protection as the console.
export async function administrativeAuthResponse(env:Bindings,request:Request){
 const path=new URL(request.url).pathname
 if(!['/auth/invite','/auth/operator/role','/auth/operator/status','/auth/session/revoke','/auth/invite/cancel'].includes(path))return null
 try{
  const s=await baseOperatorAuth(env).getSession(request);insist(s,'authentication_required',401);await requireMfa(env,s);insist(request.method==='POST','method_not_allowed',405);insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','invalid_origin',403)
  insist(path!=='/auth/operator/role','use_administrative_role_console',403)
  const input=await readInput(request);if(path==='/auth/invite'){insist(!input.role||input.role==='member','use_administrative_role_console',403);const result=await administrativePersonAction(env,request,s,{action:'invite',email:input.email,name:input.displayName,group:input.group});return Response.json(result,{status:202,headers:{'cache-control':'no-store'}})}
  const target=path==='/auth/session/revoke'?await env.DB.prepare('SELECT o.email FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=?').bind(input.sessionId).first<{email:string}>():await env.DB.prepare('SELECT email FROM oa_operators WHERE id=?').bind(input.operatorId).first<{email:string}>();insist(target,'person_not_found',404)
  const action=path==='/auth/session/revoke'?'revoke-session':path==='/auth/invite/cancel'?'deactivate':input.status==='active'?'reactivate':'deactivate'
  const result=await administrativePersonAction(env,request,s,{action,email:target.email,session:input.sessionId});return Response.json(result,{headers:{'cache-control':'no-store'}})
 }catch(error){return failure(error)}
}

async function readInput(request:Request):Promise<any>{const reader=request.body?.getReader(),parts:Uint8Array[]=[];let size=0;if(reader)try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;insist(size<=10000,'request_too_large',413);parts.push(r.value)}}finally{void reader.cancel()}const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}const body=new TextDecoder().decode(bytes);let input;try{input=request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(body)):JSON.parse(body)}catch{insist(false,'invalid_input')}insist(input&&typeof input==='object'&&!Array.isArray(input),'invalid_input');return input}
