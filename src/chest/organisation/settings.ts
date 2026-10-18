import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { requireAdmin } from '../administration/roles'
import { owner } from '../access'
import { ChestError, id, insist, now, text } from '../model'
import { sessionPredicate } from '../store'
import { discovery } from './provider-http'
export type SsoConfig = { protocol: 'oidc'|'saml'; label: string; issuer: string; clientId?: string; clientSecret?: string; authMethod?: string; authorizationOrigin?: string; entryPoint?: string; certificate?: string }
const encoder = new TextEncoder()
async function key(env:Bindings) { return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(`chest-sso\0${env.SESSION_SECRET}`)), 'AES-GCM', false, ['encrypt','decrypt']) }
export async function seal(env:Bindings, value:unknown) { const iv=crypto.getRandomValues(new Uint8Array(12)); const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(JSON.stringify(value)));return `${Buffer.from(iv).toString('base64url')}.${Buffer.from(bytes).toString('base64url')}` }
export async function unseal<T>(env:Bindings,value:string):Promise<T> { const [iv,bytes]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64url')},await key(env),Buffer.from(bytes,'base64url')))) }
export function providerUrl(env:Bindings, value:string) {
 let url:URL;try{url=new URL(value)}catch{throw new ChestError('invalid_provider_url')}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname)
 insist(!url.username&&!url.password&&!url.hash&&!url.search&&(url.protocol==='https:'||env.AUTH_LOCAL==='true'&&loopback&&url.protocol==='http:'),'provider_requires_https')
 insist(loopback?env.AUTH_LOCAL==='true':!/(^10\.|^127\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^0\.|\.local$|^\[)/.test(url.hostname),'provider_private_address_refused')
 return value
}
export function managed(env:Bindings) { return !!(env.RER_INSTALLATION_ID&&env.RER_MANAGEMENT_ORIGIN&&!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.RER_MANAGEMENT_ORIGIN)) }
// The saved provider is sealed with this deployment's SESSION_SECRET. A row sealed under another secret (a database
// restored into a new deployment) cannot be opened: it counts as no company sign-in, so email sign-in always works,
// and People & settings asks the owner to enter the provider again.
async function storedSso(env:Bindings) {const row=await env.DB.prepare('SELECT * FROM chest_sso_config WHERE singleton=1').first<{payload:string;revision:string;tested_at:string|null;local_disabled:number}>();if(!row)return null;try{return {...row,config:await unseal<SsoConfig>(env,row.payload)}}catch{return {...row,config:null}}}
export async function ssoSettings(env:Bindings) {const row=await storedSso(env);return row?.config?{...row,config:row.config}:null}
// Where the browser is sent to sign in; the page's form-action allows this origin for the start redirect.
export const providerOrigin=(config:SsoConfig)=>config.authorizationOrigin||new URL(config.entryPoint||config.issuer).origin
export async function ssoView(env:Bindings) {const row=await storedSso(env);if(!row)return {configured:false as const,managed:managed(env)};if(!row.config)return {configured:false as const,managed:managed(env),unreadable:true};const {clientSecret,...config}=row.config;return {configured:true as const,managed:managed(env),...config,hasSecret:!!clientSecret,testedAt:row.tested_at,localDisabled:!!row.local_disabled}}
export async function saveSso(env:Bindings,s:Session,input:any) {
 await requireAdmin(env,s,'service-settings');insist(!managed(env),'provider_not_available_yet',503);const previous=await ssoSettings(env),protocol=input.protocol;insist(protocol==='oidc'||protocol==='saml','invalid_protocol')
 const issuer=providerUrl(env,text(input.issuer,'issuer',2000)),config:SsoConfig={protocol,label:text(input.label,'label',60),issuer}
 // OpenID Connect: the provider's own discovery document is read now, so a wrong address is reported on save. Its
 // issuer (with or without a trailing slash, as the provider writes it) becomes the saved Provider address.
 if(protocol==='oidc'){const metadata=await discovery(env,issuer);config.issuer=metadata.issuer;config.authorizationOrigin=new URL(metadata.authorization_endpoint).origin;config.clientId=text(input.clientId,'client_id',512);config.clientSecret=input.clientSecret?text(input.clientSecret,'client_secret',4096):previous?.config.protocol==='oidc'&&previous.config.issuer===config.issuer&&previous.config.clientId===config.clientId?previous.config.clientSecret:undefined;insist(config.clientSecret,'client_secret_required');config.authMethod=String(input.authMethod||'client_secret_basic');insist(['client_secret_basic','client_secret_post'].includes(config.authMethod!),'invalid_client_authentication')}
 else {config.entryPoint=providerUrl(env,text(input.entryPoint,'sso_url',2000));config.certificate=text(input.certificate,'signing_certificate',20000);insist(config.certificate.includes('BEGIN CERTIFICATE'),'invalid_signing_certificate')}
 const fence=sessionPredicate(s),payload=await seal(env,config),revision=id()
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${fence.sql}) THEN 1 ELSE 0 END`).bind(...fence.params),
  env.DB.prepare('INSERT INTO chest_sso_config(singleton,payload,revision) VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,tested_at=NULL,local_disabled=0').bind(payload,revision),
  env.DB.prepare('UPDATE oa_auth_settings SET idp_sign_in=1,generation=generation+1 WHERE singleton=1'),
  env.DB.prepare("UPDATE oa_sessions SET revoked_at=? WHERE kind='oidc'").bind(Date.now()),
  env.DB.prepare('DELETE FROM chest_sso_transactions'),
  env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(id(),s.operator.email,'organisation.sso.configure','organisation',JSON.stringify({protocol,issuer:config.issuer}),now()),
  env.DB.prepare('DELETE FROM chest_assert')
 ]);return ssoView(env)
}
export async function localPolicy(env:Bindings,s:Session,input:any) {
 await requireAdmin(env,s,'service-settings');const disabled=input.localDisabled===true||input.localDisabled==='true',fence=sessionPredicate(s),settings=await ssoSettings(env);insist(settings&&(!disabled||settings.tested_at),'test_company_signin_first',409)
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${fence.sql}) AND EXISTS(SELECT 1 FROM chest_sso_config WHERE singleton=1 AND (?=0 OR tested_at IS NOT NULL)) THEN 1 ELSE 0 END`).bind(...fence.params,disabled?1:0),
  env.DB.prepare('UPDATE chest_sso_config SET local_disabled=? WHERE singleton=1').bind(disabled?1:0),
  env.DB.prepare("UPDATE oa_sessions SET revoked_at=? WHERE kind NOT IN ('oidc','dev') AND operator_id<>?").bind(Date.now(),s.operator.id),
  env.DB.prepare('UPDATE oa_tokens SET revoked_at=? WHERE consumed_at IS NULL').bind(Date.now()),
  env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(id(),s.operator.email,'organisation.signin.policy','organisation',JSON.stringify({localDisabled:disabled}),now()),
  env.DB.prepare('DELETE FROM chest_assert')
 ]);return ssoView(env)
}
