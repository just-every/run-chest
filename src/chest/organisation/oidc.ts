import { createLocalJWKSet, jwtVerify } from 'jose'
import type { Bindings } from '../../auth.server'
import { operatorAuth } from '../../auth.server'
const opaqueToken=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
const constantEqual=(a:unknown,b:unknown)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
import { insist } from '../model'
import { discovery,providerJson } from './provider-http'
import { seal,unseal,ssoSettings,type SsoConfig } from './settings'
const enc=new TextEncoder()
const hash=async(v:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',enc.encode(v))).toString('base64url')
const cookieName=(env:Bindings)=>`${env.AUTH_ORIGIN.startsWith('https:')?'__Host-chest_sso':'chest_sso_local'}_${new URL(env.AUTH_ORIGIN).port||'https'}`
export const correlationCookie=(env:Bindings,value:string,age=600,post=false)=>`${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=${post?'None':'Lax'}; Max-Age=${age}${env.AUTH_ORIGIN.startsWith('https:')?'; Secure':''}`
export async function transaction(env:Bindings,payload:any,post=false) {const state=opaqueToken(),binding=opaqueToken();await env.DB.prepare('DELETE FROM chest_sso_transactions WHERE expires_at<?').bind(Date.now()).run();await env.DB.prepare('INSERT INTO chest_sso_transactions VALUES(?,?,?,?)').bind(await hash(state),await hash(binding),await seal(env,payload),Date.now()+600_000).run();return {state,cookie:correlationCookie(env,binding,600,post)}}
export async function consume(env:Bindings,request:Request,state:string) {
 insist(typeof state==='string'&&/^[A-Za-z0-9_-]{43}$/.test(state),'invalid_sso_state')
 const values=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName(env)+'='));insist(values.length===1,'sso_browser_binding_required');const binding=values[0].slice(cookieName(env).length+1)
 const row=await env.DB.prepare('DELETE FROM chest_sso_transactions WHERE state_hash=? AND binding_hash=? AND expires_at>? RETURNING payload').bind(await hash(state),await hash(binding),Date.now()).first<{payload:string}>();insist(row,'sso_signin_expired_or_used');return unseal<any>(env,row.payload)
}
export async function finish(env:Bindings,request:Request,tx:any,principal:any) {
 const current=await ssoSettings(env);insist(current&&current.revision===tx.revision,'sso_configuration_changed',409)
 const completed=await operatorAuth(env).admission.admit(request,{...principal,provider:'organisation',providerGeneration:tx.generation},{returnTo:tx.test?'/app/sso-tested':'/app/files'})
 await env.DB.prepare('UPDATE chest_sso_config SET tested_at=? WHERE singleton=1 AND revision=?').bind(new Date().toISOString(),tx.revision).run()
 const headers=new Headers({'cache-control':'no-store',location:completed.returnTo});headers.append('set-cookie',correlationCookie(env,'',0));headers.append('set-cookie',completed.cookie);return new Response(null,{status:303,headers})
}
export async function beginOidc(env:Bindings,config:SsoConfig,revision:string,test=false) {
 const metadata=await discovery(env,config.issuer),verifier=opaqueToken(),nonce=opaqueToken(),settings=await env.DB.prepare('SELECT generation FROM oa_auth_settings WHERE singleton=1').first<{generation:number}>()
 const tx=await transaction(env,{protocol:'oidc',revision,generation:settings?.generation,metadata,verifier,nonce,test})
 const url=new URL(metadata.authorization_endpoint);url.search=new URLSearchParams({response_type:'code',client_id:config.clientId!,redirect_uri:`${env.AUTH_ORIGIN}/auth/company/callback`,scope:'openid email profile',state:tx.state,nonce,code_challenge:await hash(verifier),code_challenge_method:'S256'}).toString()
 return new Response(null,{status:303,headers:{location:url.href,'set-cookie':tx.cookie,'cache-control':'no-store'}})
}
export async function oidcCallback(env:Bindings,request:Request) {
 insist(request.method==='GET','method_not_allowed',405);const url=new URL(request.url)
 for(const key of ['state','code','iss','error'])insist(url.searchParams.getAll(key).length<=1,'invalid_sso_response')
 const tx=await consume(env,request,url.searchParams.get('state')!),row=await ssoSettings(env);insist(row&&row.revision===tx.revision&&tx.protocol==='oidc','sso_configuration_changed',409)
 const config=row.config;insist(!url.searchParams.has('error'),'provider_signin_denied',401);insist(!url.searchParams.has('iss')||url.searchParams.get('iss')===config.issuer,'provider_issuer_mismatch')
 const code=url.searchParams.get('code');insist(code&&code.length<=4096,'invalid_sso_code')
 const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:`${env.AUTH_ORIGIN}/auth/company/callback`,code_verifier:tx.verifier,client_id:config.clientId!}),headers:Record<string,string>={'content-type':'application/x-www-form-urlencoded'}
 if(config.authMethod==='client_secret_post')body.set('client_secret',config.clientSecret!);else headers.authorization=`Basic ${Buffer.from(`${encodeURIComponent(config.clientId!)}:${encodeURIComponent(config.clientSecret!)}`).toString('base64')}`
 const tokens=await providerJson(env,tx.metadata.token_endpoint,{method:'POST',headers,body:body.toString()});insist(typeof tokens.id_token==='string','provider_id_token_required',502)
 const keys=await providerJson(env,tx.metadata.jwks_uri),{payload}=await jwtVerify(tokens.id_token,createLocalJWKSet(keys),{issuer:config.issuer,audience:config.clientId,algorithms:['RS256','ES256'],clockTolerance:30,maxTokenAge:'10m',requiredClaims:['exp','iat','sub','nonce']})
 insist(constantEqual(payload.nonce,tx.nonce)&&typeof payload.sub==='string'&&typeof payload.email==='string'&&payload.email_verified===true,'provider_identity_not_verified',403)
 insist(payload.azp===undefined?!(Array.isArray(payload.aud)&&payload.aud.length>1):payload.azp===config.clientId,'provider_audience_mismatch',403)
 if(payload.at_hash){insist(typeof tokens.access_token==='string','invalid_access_token');const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(tokens.access_token)));insist(constantEqual(payload.at_hash,Buffer.from(digest.slice(0,16)).toString('base64url')),'invalid_access_token')}
 return finish(env,request,tx,{issuer:config.issuer,subject:payload.sub,email:payload.email,emailVerified:true,...(payload.email_verified_at!==undefined?{emailVerifiedAt:Number(payload.email_verified_at)*1000}:{}),sid:payload.sid})
}
