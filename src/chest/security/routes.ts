import type { Bindings } from '../../auth.server'
import { baseOperatorAuth } from '../../auth.server'
import { insist } from '../model'
import { failure } from '../api'
import { boundedForm } from '../organisation/body'
import { securityPage } from './ui'
import { mfaAction } from './service'
import { consumeReset } from './reset'
import { sessionSecurity } from './session'
// The first-factor session is usable only here until the second-factor guard accepts it.
export async function securityResponse(request:Request,env:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,isSecurity=path==='/security'||path==='/api/security'
 if(!isSecurity&&!path.startsWith('/app')&&!path.startsWith('/auth/')&&path!=='/signin')return null
 const s=await baseOperatorAuth(env).getSession(request)
 if(!isSecurity){
  if(!s)return null
  const exempt=['/auth/magic-link','/auth/confirm','/auth/bootstrap','/auth/signout','/auth/company/callback','/auth/company/acs','/auth/owner-claim'].includes(path)
  if(exempt)return null
  const state=await sessionSecurity(env,s,false)
  if(!state.allowed){if(path.startsWith('/auth/'))return Response.json({error:state.reason},{status:403,headers:{'cache-control':'no-store'}});return new Response(null,{status:303,headers:{location:state.reason==='session_expired'?'/signin':'/security','cache-control':'no-store'}})}
  return null
 }
 if(!s)return new Response(null,{status:303,headers:{location:'/signin?returnTo='+encodeURIComponent(path+url.search),'cache-control':'no-store'}})
 try{
  if(request.method==='GET'){if(path==='/api/security')return Response.json(await sessionSecurity(env,s,false),{headers:{'cache-control':'no-store'}});return securityPage(env,s,{},url.searchParams.get('reset')??'')}
  insist(request.method==='POST','method_not_allowed',405);insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','invalid_origin',403)
  let input:any
  if(path==='/api/security'){insist(Number(request.headers.get('content-length')||0)<100000,'request_too_large',413);input=await request.json()}
  else input=Object.fromEntries(await boundedForm(request,10000))
  const result=input.action==='reset'?await consumeReset(env,s,String(input.reset)):await mfaAction(env,s,input)
  if(path==='/api/security')return Response.json(result,{headers:{'cache-control':'no-store'}})
  return securityPage(env,s,result)
 }catch(error){const response=failure(error);if(path==='/api/security')return response;return securityPage(env,s,await response.json())}
}
