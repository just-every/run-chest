import type { Bindings } from '../../auth.server'
import { insist } from '../model'
import { managed, providerUrl } from './settings'
export async function providerJson(env:Bindings,url:string,init:RequestInit={}) {
 insist(!managed(env),'provider_not_available_yet',503);providerUrl(env,url)
 const response=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(12000)})
 insist(response.ok,'provider_request_failed',502)
 const reader=response.body!.getReader(),parts:Uint8Array[]=[];let size=0
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;insist(size<=512_000,'provider_response_too_large',502);parts.push(value)}}finally{void reader.cancel()}
 const all=new Uint8Array(size);let at=0;for(const part of parts){all.set(part,at);at+=part.length}
 try{return JSON.parse(new TextDecoder().decode(all))}catch{throw new Error('invalid_provider_response')}
}
export async function discovery(env:Bindings,issuer:string) {
 const metadata=await providerJson(env,`${issuer.replace(/\/$/,'')}/.well-known/openid-configuration`)
 insist(metadata.issuer===issuer,'provider_issuer_mismatch',502)
 for(const key of ['authorization_endpoint','token_endpoint','jwks_uri']){const endpoint=providerUrl(env,metadata[key]);insist(new URL(endpoint).origin===new URL(issuer).origin,'provider_endpoint_origin_mismatch');metadata[key]=endpoint}
 insist(metadata.response_types_supported?.includes('code')&&metadata.code_challenge_methods_supported?.includes('S256'),'provider_requires_code_and_pkce')
 return metadata
}
