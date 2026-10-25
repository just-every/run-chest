import { EditorCapacityRefusal } from './administration/editor-capacity'
import { offboardingView } from './organisation/offboarding'
import { offboardingCard } from './organisation/offboarding-ui'
import { domainView } from './organisation/domains'
import { domainCard } from './organisation/domains-ui'
import { groupReviewView } from './organisation/group-review'
import { groupReviewCard } from './organisation/group-review-ui'
import { erasurePage } from './erasure/ui'
import { erasureView } from './erasure/service'
import { QuotaConfirmation } from './quota/errors'
import { SharingConfirmation } from './files/sharing-policy'
import { hidden,form } from './ui-shared'
import { administrationPage,administrationInput } from './administration/ui'
import { mfaAdminCard } from './security/ui'
import { collectionPage, collectionInput } from './collection'
import { operatorAuth,runtimeBindings,type Bindings } from '../auth.server'
import { authenticated,overview,execute,headers,failure } from './api'
import { syncPeople } from './identity'
import { owner,roles } from './access'
import { insist,type Person,type Schema } from './model'
import { personName } from './names'
import { get,list } from './store'
import { typedValues } from './ui-fields'
import { checkPage } from './signatures/ui'
import { page,refusedPage } from './ui-shell'
import { withRail } from './ui-rail'
import { auditPage,mappingPage,receiptPage } from './ui-receipts'
import { library } from './ui-library'
import { documentPage } from './ui-document'
import { adminPage,archivePage } from './ui-admin'
import { filesInput,filesPage,filesPath,filesReceipt } from './files/ui'
import { sweep } from './files/shares'
import { kick } from './read/jobs'
import { readerView } from './read/settings'
import { readerCard,testReceipt } from './read/ui'
import { filingPage,filingInput } from './filing/ui'
import { documentReadings } from './read/api'
import { stamp, card,esc } from './ui-shared'
import { providerOrigin,ssoView } from './organisation/settings'
import { scimView } from './organisation/scim'
import { organisationCard,ssoReceipt,tokenReceipt } from './organisation/ui'
import { history } from './audit/history'
import { privacy } from './audit/privacy'
import { auditScreen } from './audit/ui'
import { quotaAdminCard } from './quota/ui'
export async function uiResponse(request:Request,original:Bindings){const url=new URL(request.url);if(url.pathname!=='/app'&&!url.pathname.startsWith('/app/')&&!url.pathname.startsWith('/s/'))return null;const env=runtimeBindings(original)
 let back='/app/files'
 try {
 // Sign out: revoke this session (the auth service checks method and origin), clear the cookie, go to sign-in.
 if(url.pathname==='/app/signout'){insist(request.method==='POST','method_not_allowed',405);const {cookie}=await operatorAuth(env).signOut(request);return new Response(null,{status:303,headers:{...headers,location:'/signin','set-cookie':cookie}})}
 const s=await authenticated(env,request);await syncPeople(env,request,s);await sweep(env);if(request.method==='GET')kick(env);const me=await withRail(env,s,url.pathname)
 if(request.method==='POST'&&url.pathname==='/app/action'){
  const fields=await request.formData();const input:any={};for(const [key,value] of fields)if(typeof value==='string')input[key]=value
  const returnTo=input.returnTo||'/app/files';back=returnTo
  // Document type forms send one row per field; a row without a name is left out.
  if(/^\/schemas(\/[^/]+)?$/.test(input.path))input.fields=[...fields.keys()].filter(k=>/^f\.\d+\.name$/.test(k)).map(k=>k.split('.')[1]).filter(n=>String(input[`f.${n}.name`]).trim()).map(n=>({name:String(input[`f.${n}.name`]).trim(),type:input[`f.${n}.type`],required:input[`f.${n}.required`]==='true'}))
  // Filing forms send typed fields as one input per field of the chosen document type.
  if(typeof input.schema==='string'&&/^\/documents(\/[^/]+\/filing)?$/.test(input.path))input.fields=typedValues(await get<Schema>(env,'schema',input.schema),input)
  if(input.path==='/security/policy')input.groups=Object.keys(input).filter(k=>k.startsWith('mfaGroup:')).map(k=>k.slice(9))
  input.private=fields.has('private');if(input.referenceKind)input.reference={kind:input.referenceKind,name:input.referenceName}
  const file=fields.get('file');if(file&&typeof file!=='string'&&file.size){input.base64=Buffer.from(await file.arrayBuffer()).toString('base64');input.filename=file.name;input.size=file.size}
  const archiveFile=fields.get('archiveFile');if(archiveFile&&typeof archiveFile!=='string')input.archive=await archiveFile.text()
  if(input.path==='/archive/job')input.path=`/archive/${encodeURIComponent(input.job)}`
  administrationInput(input)
  if(input.path==='/backups'){if(input.enabled!==undefined)input.enabled=input.enabled==='true';if(input.confirm!==undefined)input.confirm=input.confirm==='true';for(const key of ['everyHours','retentionDays'])if(input[key]!==undefined)input[key]=Number(input[key])}
  if(input.path.startsWith('/collection'))collectionInput(input)
  if(input.path.startsWith('/filing/'))filingInput(input)
  if(filesPath(input.path))filesInput(input)
  if(input.path==='/audit/privacy'&&input.scope==='organization')input.groups=Object.keys(input).filter(k=>k.startsWith('group:')).map(k=>k.slice(6))
  let result:any
  try{result=await execute(env,request,s,'POST',input.path,input)}catch(error){if(error instanceof EditorCapacityRefusal){const key=error.preview.split('/').at(-1)!;const rendered=page(card('Editor capacity reached',`<p>${esc(error.limit)}: ${error.currentUse} of ${error.maximum} in use. Existing editing sessions continue. This file is open as a read-only preview.</p><iframe class="office-frame" title="Read-only file preview" src="/api/chest/items/${encodeURIComponent(key)}/office-preview"></iframe><p><a class="btn" href="${esc(error.preview)}">Return to file</a></p>`),me,error.preview);return new Response(rendered.body,{status:409,headers:rendered.headers})}if(error instanceof QuotaConfirmation){const values=[...fields].filter(([k,v])=>typeof v==='string'&&!['path','returnTo','confirmOverLimit','confirmation'].includes(k)).map(([k,v])=>hidden(k,String(v))).join('');return page(card('Confirm storage limit',`<p>These areas are already above the proposed limit. Existing originals stay retained; growth will be refused.</p><ul class="events">${error.overLimit.map(r=>`<li>${esc(r.owner||r.name)} · ${r.scope==='user'?'Personal area':'Space'} · ${r.usedBytes} bytes used of ${r.limitBytes} bytes · ${esc(r.rule)}</li>`).join('')}</ul>${form(input.path,values+hidden('confirmOverLimit','true')+hidden('confirmation',error.confirmation),'Confirm storage limit',returnTo)}<a class="link" href="${esc(returnTo)}">Cancel</a>`),me,returnTo)}if(!(error instanceof SharingConfirmation))throw error;const values=[...fields].filter(([k,v])=>typeof v==='string'&&!['path','returnTo','confirmExternal'].includes(k)).map(([k,v])=>hidden(k,String(v))).join('');return page(card('Confirm external sharing',`<p>Your sharing policy requires confirmation before giving access outside the organization.</p><p>Recipients: <strong>${error.recipients.map(esc).join(', ')}</strong></p>${form(input.path,values+hidden('confirmExternal','true'),'Confirm external sharing',returnTo)}<a class="link" href="${esc(returnTo)}">Cancel</a>`),me,returnTo)}
  kick(env,request)
  if(result instanceof Response)return result
  if(input.path.startsWith('/bulk')&&result?.id)return new Response(null,{status:303,headers:{...headers,location:`/app/bulk/${result.id}`}})
  if(result?.signInAgain)return new Response(null,{status:303,headers:{...headers,location:'/signin'}})
  if(input.path==='/administration/recovery'&&result?.id)return new Response(null,{status:303,headers:{...headers,location:`/app/administration/recovery/${result.id}`}})
  if(input.path.startsWith('/administration/recovery/')&&result?.id)return new Response(null,{status:303,headers:{...headers,location:`/app/administration/recovery/${result.id}`}})
  if(input.path==='/administration/people'&&input.action==='sessions')return page(card('Sessions',`<ul class="events">${result.map((r:any)=>`<li>${esc(r.kind)} · ${stamp(new Date(r.createdAt).toISOString())} · ${r.active?'Active':'Ended'}</li>`).join('')}</ul><a class="btn" href="/app/administration">Administration</a>`),me,'/app/administration')
  if(input.path==='/organisation/scim/tokens')return page(tokenReceipt(result),me,'/app/admin')
  if(input.path==='/organisation/sso')return page(ssoReceipt(result),me,'/app/admin')
  if(input.path==='/signatures'&&result?.id)return new Response(null,{status:303,headers:{...headers,location:`/app/signatures/${result.id}`}})
  if(input.path==='/signatures/validate')return page(checkPage(result),me,returnTo)
  const secret=filesReceipt(input,result);if(secret)return page(secret,me,returnTo)
  if(input.path==='/reading/settings/test')return page(testReceipt(result),me,'/app/admin')
  if(input.path==='/archive/preview')return page(mappingPage(input,result),me,'/app/archive')
  if(input.path.startsWith('/archive/')||input.action==='sessions')return page(receiptPage(input,result),me,returnTo)
  const location=input.path==='/links/open'&&result?.item?`/app/items/${result.item}`:input.path==='/new-files'&&result?.kind==='item'?`/app/items/${result.id}${/\.(docx|xlsx)$/i.test(result.payload.name)?'?edit=1':''}`:result?.kind==='document'?`/app/documents/${result.id}`:result?.kind==='item'&&input.path==='/items'?`/app/items/${result.id}`:returnTo;return new Response(null,{status:303,headers:{...headers,location:location.startsWith('/app')?location:'/app'}})
 }
 if(url.pathname==='/app/erasure'){return page(erasurePage(await erasureView(env,s)),me,url.pathname)}
 const administrative=await administrationPage(env,s,url);if(administrative)return page(administrative,me,url.pathname)
 const collecting=await collectionPage(env,request,s,url);if(collecting)return page(collecting,me,url.pathname)
 const filing=await filingPage(env,s,url);if(filing)return page(filing,me,url.pathname)
 const files=await filesPage(env,request,s,url);if(files)return 'redirect' in files?new Response(null,{status:303,headers:{...headers,location:files.redirect}}):page(files.body,me,url.pathname,files.bar)
 const data=await overview(env,s,url);let body=''
 if(url.pathname==='/app/sso-tested'){insist(s.kind==='oidc','company_signin_required',403);body=card('Company sign-in works',`<p>You are signed in as <strong>${esc(me.name)}</strong> (${esc(me.email)}). The identity provider connection has been tested.</p><p><a class="btn" href="/app/files">Open files</a></p>${me.role==='owner'?'<p><a class="link" href="/app/admin">Back to people &amp; settings</a></p>':'<p>The owner can now turn off email-link sign-in in People &amp; settings.</p>'}`)}
 else if(url.pathname==='/app')return new Response(null,{status:303,headers:{...headers,location:'/app/files'}})
 else if(url.pathname==='/app/library')body=library(data,url.searchParams.get('q')||'',url.searchParams.get('trash')==='true')
 else if(url.pathname==='/app/admin'){owner(s);body=adminPage({...data,local:env.AUTH_LOCAL==='true'},readerCard(await readerView(env))+organisationCard(await ssoView(env),await scimView(env),env.AUTH_ORIGIN)+domainCard(await domainView(env))+groupReviewCard(await groupReviewView(env))+offboardingCard(await offboardingView(env))+await quotaAdminCard(env,s)+await mfaAdminCard(env))}
 else if(url.pathname==='/app/archive'){owner(s);body=archivePage(data)}
 else if(url.pathname==='/app/audit')body=auditScreen(await history(env,s,url.searchParams),await recordNames(env),url.searchParams,await privacy(env,s.operator.email),s.operator.role==='owner',s.operator.role==='owner'?await list(env,'group'):[])
 else if(url.pathname.startsWith('/app/documents/')){const key=url.pathname.split('/').at(-1)!;const row=await execute(env,request,s,'GET',`/documents/${key}`,{}),readers=me.role==='owner'?await execute(env,request,s,'GET',`/documents/${key}/readers`,{}):[],mine=(await roles(env,s,row.payload)).roles;body=documentPage(row,data,readers,mine.includes('reviewer'),{readings:await documentReadings(env,row.id,row.payload),editor:mine.includes('editor')})}
 else return new Response('Not found',{status:404})
 const response=page(body,me,url.pathname)
 if(url.pathname==='/app/admin'){const provider=await ssoView(env);if(provider.configured){const origin=providerOrigin(provider as any);response.headers.set('content-security-policy',response.headers.get('content-security-policy')!.replace("form-action 'self'",`form-action 'self' ${origin}`))}}
 return response
 }catch(e){const error=failure(e);if(error.status===401)return new Response(null,{status:303,headers:{location:'/signin?returnTo='+encodeURIComponent(url.pathname)}});return refusedPage(await error.json() as any,error.status,error.status===404&&request.method==='GET'?'/app/files':back)}
}
// Names for the audit trail: files, folders, spaces, records, collections, types, groups, people and devices.
async function recordNames(env:Bindings){const names=new Map<string,string>()
 for(const r of await list<Person>(env,'person'))names.set(r.id,personName(r.payload.name,r.id))
 for(const [kind,field] of [['item','name'],['space','name'],['document','title'],['collection','name'],['schema','name'],['group','name'],['device','name'],['public-link','item'],['file-request','title'],['upload','name']])for(const r of await list<any>(env,kind))names.set(r.id,kind==='public-link'?`link to ${names.get(r.payload.item)??'a file'}`:kind==='upload'?`upload of ${r.payload.name}`:kind==='space'&&r.payload.kind==='personal'?`${names.get(r.payload.owner)??r.payload.owner}'s personal area`:String(r.payload[field]??''))
 return names}
