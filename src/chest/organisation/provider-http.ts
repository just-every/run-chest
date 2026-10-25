import { providerFetch } from '../administration/provider-usage'
import { attempt } from '../audit/journal'
import type { Bindings } from '../../auth.server'
import { ChestError, insist } from '../model'
import { managed, providerUrl } from './settings'
export async function providerJson(env:Bindings,url:string,init:RequestInit={}) {
 return attempt(env,'chest:identity','provider.identity','organization',{authority:'configured identity provider',provider:new URL(url).hostname},()=>readJson(env,url,init))
}
async function readJson(env:Bindings,url:string,init:RequestInit={}) {
 insist(!managed(env),'provider_not_available_yet',503);providerUrl(env,url)
 let response:Response;try{response=await providerFetch(env,new URL(url).hostname,'organization','chest:identity',new Request(url,{...init,redirect:'manual',signal:AbortSignal.timeout(12000)}))}catch{throw new ChestError('provider_unreachable',502)}
 insist(response.ok,'provider_request_failed',502)
 const reader=response.body!.getReader(),parts:Uint8Array[]=[];let size=0
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;insist(size<=512_000,'provider_response_too_large',502);parts.push(value)}}finally{void reader.cancel()}
 const all=new Uint8Array(size);let at=0;for(const part of parts){all.set(part,at);at+=part.length}
 try{return JSON.parse(new TextDecoder().decode(all))}catch{throw new ChestError('invalid_provider_response',502)}
}
// The provider's endpoints are the ones its discovery document names, each checked as a provider address (https, no
// credentials, query or fragment, not a private network). They need not share the issuer's origin: Google signs in
// at accounts.google.com but issues tokens at oauth2.googleapis.com and publishes keys at www.googleapis.com.
export async function discovery(env:Bindings,issuer:string) {
 const metadata=await providerJson(env,`${issuer.replace(/\/$/,'')}/.well-known/openid-configuration`)
 insist(metadata&&typeof metadata.issuer==='string'&&metadata.issuer.replace(/\/$/,'')===issuer.replace(/\/$/,''),'provider_issuer_mismatch',502)
 for(const key of ['authorization_endpoint','token_endpoint','jwks_uri']){insist(typeof metadata[key]==='string','invalid_provider_response',502);metadata[key]=providerUrl(env,metadata[key])}
 insist(metadata.response_types_supported?.includes('code')&&metadata.code_challenge_methods_supported?.includes('S256'),'provider_requires_code_and_pkce')
 return metadata
}
