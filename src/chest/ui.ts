import { operatorAuth,runtimeBindings,type Bindings } from '../auth.server'
import { authenticated,overview,execute,headers,failure } from './api'
import { syncPeople } from './identity'
import { owner,roles } from './access'
import { insist,type Schema } from './model'
import { get } from './store'
import { typedValues } from './ui-fields'
import { page,refusedPage } from './ui-shell'
import { auditPage,invalidJsonPage,mappingPage,receiptPage } from './ui-receipts'
import { library } from './ui-library'
import { documentPage } from './ui-document'
import { adminPage,archivePage } from './ui-admin'
import { filesInput,filesPage,filesPath,filesReceipt } from './files/ui'
import { sweep } from './files/shares'
export async function uiResponse(request:Request,original:Bindings){const url=new URL(request.url);if(url.pathname!=='/app'&&!url.pathname.startsWith('/app/')&&!url.pathname.startsWith('/s/'))return null;const env=runtimeBindings(original)
 try {
 // Sign out: revoke this session (the auth service checks method and origin), clear the cookie, go to sign-in.
 if(url.pathname==='/app/signout'){insist(request.method==='POST','method_not_allowed',405);const {cookie}=await operatorAuth(env).signOut(request);return new Response(null,{status:303,headers:{...headers,location:'/signin','set-cookie':cookie}})}
 const s=await authenticated(env,request);await syncPeople(env,request,s);await sweep(env);const me={email:s.operator.email,name:s.operator.displayName,role:s.operator.role}
 if(request.method==='POST'&&url.pathname==='/app/action'){
  const fields=await request.formData();const input:any={};for(const [key,value] of fields)if(typeof value==='string')input[key]=value
  const returnTo=input.returnTo||'/app'
  for(const key of ['fields','grants','members'])if(typeof input[key]==='string'){try{input[key]=JSON.parse(input[key])}catch{return page(invalidJsonPage(key,returnTo),me,returnTo)}}
  // Filing forms send typed fields as one input per field of the chosen document type.
  if(typeof input.schema==='string'&&/^\/documents(\/[^/]+\/filing)?$/.test(input.path))input.fields=typedValues(await get<Schema>(env,'schema',input.schema),input)
  input.private=fields.has('private');if(input.referenceKind)input.reference={kind:input.referenceKind,name:input.referenceName}
  const file=fields.get('file');if(file&&typeof file!=='string'&&file.size){input.base64=Buffer.from(await file.arrayBuffer()).toString('base64');input.filename=file.name;input.size=file.size}
  const archiveFile=fields.get('archiveFile');if(archiveFile&&typeof archiveFile!=='string')input.archive=await archiveFile.text()
  if(input.path==='/archive/job')input.path=`/archive/${encodeURIComponent(input.job)}`
  if(filesPath(input.path))filesInput(input)
  const result=await execute(env,request,s,'POST',input.path,input)
  const secret=filesReceipt(input,result);if(secret)return page(secret,me,returnTo)
  if(input.path==='/archive/preview')return page(mappingPage(input,result),me,'/app/archive')
  if(input.path.startsWith('/archive/')||input.action==='sessions')return page(receiptPage(input,result),me,returnTo)
  const location=result?.kind==='document'?`/app/documents/${result.id}`:result?.kind==='item'&&input.path==='/items'?`/app/items/${result.id}`:returnTo;return new Response(null,{status:303,headers:{...headers,location:location.startsWith('/app')?location:'/app'}})
 }
 const files=await filesPage(env,request,s,url);if(files)return 'redirect' in files?new Response(null,{status:303,headers:{...headers,location:files.redirect}}):page(files.body,me,url.pathname)
 const data=await overview(env,s,url);let body=''
 if(url.pathname==='/app')body=library(data,url.searchParams.get('q')||'',url.searchParams.get('trash')==='true')
 else if(url.pathname==='/app/admin'){owner(s);body=adminPage(data)}
 else if(url.pathname==='/app/archive'){owner(s);body=archivePage(data)}
 else if(url.pathname==='/app/audit')body=auditPage(await execute(env,request,s,'GET','/audit',{}))
 else if(url.pathname.startsWith('/app/documents/')){const key=url.pathname.split('/').at(-1)!;const row=await execute(env,request,s,'GET',`/documents/${key}`,{}),readers=me.role==='owner'?await execute(env,request,s,'GET',`/documents/${key}/readers`,{}):[],mine=(await roles(env,s,row.payload)).roles;body=documentPage(row,data,readers,mine.includes('reviewer'))}
 else return new Response('Not found',{status:404})
 return page(body,me,url.pathname)
 }catch(e){const error=failure(e);if(error.status===401)return new Response(null,{status:303,headers:{location:'/signin?returnTo='+encodeURIComponent(url.pathname)}});return refusedPage(await error.json() as any,error.status)}
}
