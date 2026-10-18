import { SAML, ValidateInResponseTo, type CacheProvider } from '@node-saml/node-saml'
import type { Bindings } from '../../auth.server'
import { boundedForm } from './body'
import { ChestError,insist } from '../model'
import { transaction,consume,finish } from './oidc'
import { ssoSettings,type SsoConfig } from './settings'
function client(env:Bindings,config:SsoConfig) {
 const cache:CacheProvider={
  async saveAsync(key,value){const createdAt=Date.now();await env.DB.prepare('INSERT INTO chest_saml_requests VALUES(?,?,?)').bind(key,value,createdAt).run();return {createdAt,value}},
  async getAsync(key){const row=await env.DB.prepare('SELECT value FROM chest_saml_requests WHERE id=? AND created_at>?').bind(key,Date.now()-600_000).first<{value:string}>();return row?.value??null},
  async removeAsync(key){const row=await env.DB.prepare('DELETE FROM chest_saml_requests WHERE id=? RETURNING value').bind(key??'').first<{value:string}>();return row?.value??null}
 }
 return new SAML({callbackUrl:`${env.AUTH_ORIGIN}/auth/company/acs`,issuer:`${env.AUTH_ORIGIN}/auth/company/metadata`,idpIssuer:config.issuer,entryPoint:config.entryPoint!,idpCert:config.certificate!,audience:`${env.AUTH_ORIGIN}/auth/company/metadata`,validateInResponseTo:ValidateInResponseTo.always,requestIdExpirationPeriodMs:600_000,cacheProvider:cache,wantAssertionsSigned:true,wantAuthnResponseSigned:true,acceptedClockSkewMs:30_000,maxAssertionAgeMs:600_000,signatureAlgorithm:'sha256',digestAlgorithm:'sha256',disableRequestedAuthnContext:true,identifierFormat:'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'})
}
export async function beginSaml(env:Bindings,config:SsoConfig,revision:string,test=false) {
 insist(env.AUTH_ORIGIN.startsWith('https:'),'saml_requires_https_for_browser_correlation')
 await env.DB.prepare('DELETE FROM chest_saml_requests WHERE created_at<?').bind(Date.now()-600_000).run()
 const settings=await env.DB.prepare('SELECT generation FROM oa_auth_settings WHERE singleton=1').first<{generation:number}>(),tx=await transaction(env,{protocol:'saml',revision,generation:settings?.generation,test},true)
 const location=await client(env,config).getAuthorizeUrlAsync(tx.state,undefined,{})
 return new Response(null,{status:303,headers:{location,'set-cookie':tx.cookie,'cache-control':'no-store'}})
}
export async function samlCallback(env:Bindings,request:Request) {
 insist(request.method==='POST','method_not_allowed',405);insist((request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'),'form_required',415)
 const form=await boundedForm(request,512_000);insist(form.getAll('RelayState').length===1&&form.getAll('SAMLResponse').length===1,'invalid_saml_response')
 const tx=await consume(env,request,form.get('RelayState')!),row=await ssoSettings(env);insist(row&&row.revision===tx.revision&&tx.protocol==='saml','sso_configuration_changed',409)
 let result;try{result=await client(env,row.config).validatePostResponseAsync({SAMLResponse:form.get('SAMLResponse')!})}catch{throw new ChestError('saml_response_rejected',400)}
 const {profile,loggedOut}=result;insist(profile&&!loggedOut&&typeof profile.nameID==='string','invalid_saml_identity',403)
 insist(profile.issuer===row.config.issuer,'saml_issuer_mismatch',403)
 const assertion:any=profile.getAssertion?.().Assertion,confirmations=assertion?.Subject?.[0]?.SubjectConfirmation
 insist(Array.isArray(confirmations)&&confirmations.length===1&&confirmations[0].$?.Method==='urn:oasis:names:tc:SAML:2.0:cm:bearer','saml_bearer_confirmation_required',403)
 const confirmation=confirmations[0].SubjectConfirmationData?.[0]?.$
 insist(confirmation?.Recipient===`${env.AUTH_ORIGIN}/auth/company/acs`&&confirmation.InResponseTo===profile.inResponseTo&&Number.isFinite(Date.parse(confirmation.NotOnOrAfter)),'saml_recipient_mismatch',403)
 const email=profile.email||profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];insist(typeof email==='string','saml_email_attribute_required',403)
 const contexts=assertion?.AuthnStatement?.flatMap((a:any)=>a.AuthnContext?.flatMap((c:any)=>c.AuthnContextClassRef??[])??[])??[],mfa=contexts.some((c:any)=>['https://refeds.org/profile/mfa','http://schemas.microsoft.com/claims/multipleauthn'].includes(typeof c==='string'?c:c._))
 return finish(env,request,tx,{mfa,issuer:row.config.issuer,subject:profile.nameID,email,emailVerified:true})
}
export async function samlMetadata(env:Bindings) {
 const row=await ssoSettings(env);insist(row?.config.protocol==='saml','saml_not_configured',404)
 return new Response(client(env,row.config).generateServiceProviderMetadata(null,null),{headers:{'content-type':'application/samlmetadata+xml','cache-control':'no-store'}})
}
