import type { Bindings } from '../../auth.server'
import { operatorAuth } from '../../auth.server'
import { failure } from '../api'
import { insist } from '../model'
import { refusedPage } from '../ui-shell'
import { hasProblemWords } from '../ui-problems'
import { beginOidc,oidcCallback } from './oidc'
import { beginSaml,samlCallback,samlMetadata } from './saml'
import { managed,providerOrigin,ssoSettings } from './settings'
import { boundedForm } from './body'
import { signInPage } from './ui'
export async function companyResponse(request:Request,env:Bindings):Promise<Response|null> {
 const url=new URL(request.url),path=url.pathname
 if(!path.startsWith('/auth/company/')&&path!=='/signin'&&!['/auth/magic-link','/auth/confirm'].includes(path))return null
 try {
  const row=await ssoSettings(env)
  if(path==='/signin'&&request.method==='GET'&&row){if(await operatorAuth(env).getSession(request))return null;return signInPage(row.config.label,!!row.local_disabled,managed(env),providerOrigin(row.config))}
  if(['/auth/magic-link','/auth/confirm'].includes(path)){if(row?.local_disabled)return Response.json({error:'organisation_sso_required',message:'Your organisation requires company sign-in.'},{status:403,headers:{'cache-control':'no-store'}});return null}
  if(path==='/signin')return null
  if(path==='/auth/company/metadata')return await samlMetadata(env)
  if(path==='/auth/company/callback')return await oidcCallback(env,request)
  if(path==='/auth/company/acs')return await samlCallback(env,request)
  insist(path==='/auth/company/start','not_found',404);insist(row,'sso_not_configured',404);insist(!managed(env),'provider_not_available_yet',503)
  insist(request.method==='POST','method_not_allowed',405);insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','invalid_origin',403)
  const form=await boundedForm(request,4096),test=form.get('test')==='true';if(test){const s=await operatorAuth(env).getSession(request);insist(s?.operator.role==='owner','owner_required',403)}
  return await (row.config.protocol==='saml'?beginSaml(env,row.config,row.revision,test):beginOidc(env,row.config,row.revision,test))
 }catch(error){const response=failure(error),data=await response.json() as {error:string;message?:string};if(!data.message&&!hasProblemWords(data.error))data.message='Company sign-in did not finish. If you set it up, check the provider settings in People & settings; otherwise ask whoever set it up to check them and your access to the Chest app.';return refusedPage(data,response.status)}
}
