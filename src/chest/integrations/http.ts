import { runtimeBindings, type Bindings } from '../../auth.server'
import { authenticated, failure, headers } from '../api'
import { insist } from '../model'
import { page, refusedPage } from '../ui-shell'
import { withRail } from '../ui-rail'
import { card, esc } from '../ui-shared'
import { authorize, requestBudget, action, resource } from './auth'
import { exchange, consent } from './oauth'
import { consentPage, integrationInput, managementPage, pickerPage } from './ui'
import { integrationsExecute } from './service'
import { resourceCall } from './resources'
import { mcp } from './mcp'
import { subscribe, deliverEvent } from './webhooks'
import { list, get } from '../store'
import type { Client, Subscription, Delivery } from './model'
import { paginate } from './reads'
import { requestBytes } from './capacity'
import { mutate } from './mutations'
async function input(request: Request) {insist(Number(request.headers.get('content-length')??0)<requestBytes,'request_too_large',413);if(request.headers.get('content-type')?.includes('application/json'))return request.json();return Object.fromEntries(await request.formData())}
function cross(response: Response,origin: string|null) {if(origin){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','Origin');response.headers.set('access-control-allow-methods','GET, POST, OPTIONS');response.headers.set('access-control-allow-headers','Authorization, Content-Type, Idempotency-Key, MCP-Protocol-Version');response.headers.set('access-control-expose-headers','Content-Disposition, Content-Range')}return response}
export async function integrationsResponse(request: Request,original: Bindings): Promise<Response|null> {
 const url=new URL(request.url),path=url.pathname,isMetadata=path==='/.well-known/oauth-authorization-server'||path==='/.well-known/oauth-protected-resource/mcp/chest',isOauth=path.startsWith('/oauth/chest/'),isApi=path.startsWith('/api/chest/integrations/v1/'),isMcp=path==='/mcp/chest',isUi=path==='/app/integrations'||path==='/app/integrations/picker'
 if(!isMetadata&&!isOauth&&!isApi&&!isMcp&&!isUi)return null
 const env=runtimeBindings(original),origin=request.headers.get('origin');let permittedOrigin:string|null=null
 try {
  if(isMetadata){insist(request.method==='GET','method_not_allowed',405);return Response.json(path==='/.well-known/oauth-authorization-server'?{issuer:env.AUTH_ORIGIN,authorization_endpoint:`${env.AUTH_ORIGIN}/oauth/chest/authorize`,token_endpoint:`${env.AUTH_ORIGIN}/oauth/chest/token`,response_types_supported:['code'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none','client_secret_post'],scopes_supported:['read','search','download','upload','folder','versions','share','request','picker','webhook']}:{resource:`${env.AUTH_ORIGIN}/mcp/chest`,authorization_servers:[env.AUTH_ORIGIN],bearer_methods_supported:['header']},{headers:{...headers,'access-control-allow-origin':'*'}})}
  if(origin){const clients=await list<Client>(env,'integration-client');if(clients.some(c=>!c.payload.revokedAt&&(c.payload.pickerOrigins.includes(origin)||c.payload.redirects.some(u=>new URL(u).origin===origin))))permittedOrigin=origin}
  if(request.method==='OPTIONS'){
   insist(isApi||isMcp||path==='/oauth/chest/token','not_found',404);const clients=await list<Client>(env,'integration-client');insist(origin&&clients.some(c=>!c.payload.revokedAt&&(c.payload.pickerOrigins.includes(origin)||c.payload.redirects.some(u=>new URL(u).origin===origin))),'oauth_origin_mismatch',403);return cross(new Response(null,{status:204}),origin)
  }
  if(path==='/oauth/chest/token'){insist(request.method==='POST','method_not_allowed',405);const result=await exchange(env,await input(request),origin);return cross(Response.json(result,{headers}),origin)}
  if(path==='/app/integrations/picker'){insist(request.method==='GET','method_not_allowed',405);return await pickerPage(env,url)}
  if(path==='/oauth/chest/authorize'){
   const s=await authenticated(env,request);if(request.method==='GET')return await consentPage(env,s,url);insist(request.method==='POST','method_not_allowed',405);return new Response(null,{status:303,headers:{...headers,location:await consent(env,s,await input(request))}})
  }
  if(isUi){const s=await authenticated(env,request);if(request.method==='GET')return await managementPage(env,s);insist(request.method==='POST','method_not_allowed',405);const data=integrationInput(await request.formData()),result=await integrationsExecute(env,request,s,'POST',String(data.path).split('/').filter(Boolean),data,url);if((result as any)?.clientSecret)return page(card('App registered',`<p>Client ID: <code>${esc((result as any).client.id)}</code></p><p>Copy this secret now. It is shown once.</p><code>${esc((result as any).clientSecret)}</code><p><a href="/app/integrations">Connected apps</a></p>`),await withRail(env,s,path),path);return new Response(null,{status:303,headers:{...headers,location:'/app/integrations'}})}
  let auth=await authorize(env,request)
  if(origin){insist(origin===env.AUTH_ORIGIN||auth.client.payload.pickerOrigins.includes(origin)||auth.client.payload.redirects.some(u=>new URL(u).origin===origin),'oauth_origin_mismatch',403);permittedOrigin=origin}
  insist(request.method==='GET'||request.method==='POST','method_not_allowed',405)
  auth=await requestBudget(env,auth)
  if(isMcp){insist(request.method==='POST','method_not_allowed',405);const result=await mcp(env,auth,await input(request));return cross(result===undefined?new Response(null,{status:202}):Response.json(result,{headers}),permittedOrigin)}
  const resourcePath=path.slice('/api/chest/integrations/v1'.length),data=request.method==='POST'?await input(request):{},parts=resourcePath.split('/').filter(Boolean);let result:unknown
  if(parts[0]==='webhooks'){
   action(auth,'webhook')
   if(request.method==='GET'&&!parts[1])result=paginate((await list<Subscription>(env,'integration-subscription')).filter(s=>s.payload.grant===auth.grant.id).map(s=>({id:s.id,...s.payload})),url,s=>s.id)
   else if(request.method==='POST'&&!parts[1])result=await mutate(env,auth,request.headers.get('idempotency-key')??'',resourcePath,data,0,s=>subscribe(env,{...auth,session:s},data))
   else if(request.method==='GET'&&parts[2]==='deliveries'){const hook=await get<Subscription>(env,'integration-subscription',parts[1]);insist(hook.payload.grant===auth.grant.id,'not_found',404);result=paginate((await list<Delivery>(env,'integration-delivery')).filter(d=>d.payload.subscription===hook.id).map(d=>({id:d.id,...d.payload})),url,d=>d.id)}
   else if(request.method==='POST'&&parts[2]==='replay'){const delivery=await get<Delivery>(env,'integration-delivery',parts[1]),hook=await get<Subscription>(env,'integration-subscription',delivery.payload.subscription);insist(hook.payload.grant===auth.grant.id,'not_found',404);result=await deliverEvent(env,delivery.id,true)}
   else insist(false,'not_found',404)
  }else result=await resourceCall(env,auth,request.method,resourcePath,data,url,request.headers.get('idempotency-key')??'')
  return cross(result instanceof Response?result:Response.json(result,{headers}),permittedOrigin)
 }catch(error){const response=failure(error);if(isUi||path==='/oauth/chest/authorize'){const detail=await response.json() as {error?:string;message?:string};if(response.status===401&&detail.error==='authentication_required')return new Response(null,{status:303,headers:{location:'/signin?returnTo='+encodeURIComponent(path+url.search)}});return refusedPage(detail,response.status===401?403:response.status,'/app/integrations')}if(response.status===401&&(isMcp||isApi))response.headers.set('www-authenticate',`Bearer resource_metadata="${env.AUTH_ORIGIN}/.well-known/oauth-protected-resource/mcp/chest"`);return cross(response,permittedOrigin)}
}
