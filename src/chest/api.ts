import { administrationExecute } from './administration/service'
import { requireAdmin } from './administration/roles'
import { saveMfaPolicy } from './security/policy'
import { resetFactor } from './security/reset'
import { collectionExecute } from './collection'
import { operatorAuth,runtimeBindings,type Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { backupView,backupAction } from './backups/service'
import { SharingConfirmation } from './files/sharing-policy'
import { ChestError,insist,type Document,type Person,type Schema } from './model'
import { fieldIssues } from './fields'
import { get,list,recordAccess } from './store'
import { documents,access,owner,roles } from './access'
import { syncPeople,peopleAction } from './identity'
import { createMetadata,grants,groupMember,oneGrant,updateFiling,updateGroup,updateSchema } from './metadata'
import { upload,lifecycle,restoreVersion,nameVersion } from './documents'
import { review } from './reviews'
import { serve } from './blobs'
import { previewArchive,applyArchive,archiveAction } from './archive'
import { filesExecute } from './files/api'
import { syncRoute } from './files/sync-api'
import { offboard } from './files/people'
import { sweep } from './files/shares'
import { everything,who } from './files/access'
import { filingExecute } from './filing/api'
import { readingExecute } from './read/api'
import { kick,textHits } from './read/jobs'
import { totalStorage } from './quota/storage'
import { saveSso,localPolicy,ssoView } from './organisation/settings'
import { issueScimToken,revokeScimToken,scimView } from './organisation/scim'
import { operation } from './audit/journal'
import { history, exportHistory } from './audit/history'
import { privacy, savePrivacy, eraseAuditIdentity } from './audit/privacy'
export const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}
export async function overview(env:Bindings,s:Session,url:URL){
 const rows=await documents(env,s,url.searchParams.get('trash')==='true'),q=(url.searchParams.get('q')||'').toLowerCase(),read=await textHits(env,q)
 // Titles, fields, relationship and the text of every version, including text read from PDFs and scans.
 const filtered=rows.filter(r=>JSON.stringify([r.payload.title,r.payload.fields,r.payload.reference,...r.payload.versions.map(v=>v.text)]).toLowerCase().includes(q)||r.payload.versions.some(v=>read.has(v.checksum)))
 const collections=await list(env,'collection'),groups=await list(env,'group'),schemas=await list<Schema>(env,'schema')
 const principals=[s.operator.email,...groups.filter(g=>g.payload.members.includes(s.operator.email)).map(g=>g.id)]
 const visible=collections.filter(c=>s.operator.role==='owner'||c.payload.grants.some((g:any)=>principals.includes(g.principal)))
 const diagnosed=filtered.map(row=>({...row,fieldIssues:fieldIssues(schemas.find(schema=>schema.id===row.payload.schema)!.payload,row.payload.fields)}))
 return {me:{email:s.operator.email,name:s.operator.displayName,role:s.operator.role},documents:diagnosed,count:filtered.length,collections:visible,schemas,people:await list<Person>(env,'person'),groups:s.operator.role==='owner'?groups:[],storage:s.operator.role==='owner'?{logicalBytes:await totalStorage(env)}:null}
}
export async function execute(env:Bindings,request:Request,s:Session,method:string,path:string,input:any):Promise<any>{
 return operation(env,s,method,path,()=>dispatch(env,request,s,method,path,input))
}
async function dispatch(env:Bindings,request:Request,s:Session,method:string,path:string,input:any):Promise<any>{
 if(path==='/security/policy'&&method==='POST')return saveMfaPolicy(env,s,input)
 if(path==='/security/reset'&&method==='POST')return resetFactor(env,s,input)
 const parts=path.split('/').filter(Boolean),url=new URL(request.url)
 const administration=await administrationExecute(env,request,s,method,parts,input,url);if(administration!==undefined)return administration
 if(parts[0]==='collection')return collectionExecute(env,request,s,method,parts,input,url)
 if(path==='/organisation/sso') {await requireAdmin(env,s,'service-settings');return method==='POST'?saveSso(env,s,input):ssoView(env)}
 if(path==='/organisation/policy'&&method==='POST')return localPolicy(env,s,input)
 if(path==='/organisation/scim/tokens') {await requireAdmin(env,s,'service-settings');return method==='POST'?issueScimToken(env,request,s,input):scimView(env)}
 if(path==='/organisation/scim/revoke'&&method==='POST')return revokeScimToken(env,request,s,input.id)
 if(method==='GET'&&path==='/library')return overview(env,s,url)
 if(path==='/people'&&method==='POST')return input.action==='offboard'?offboard(env,request,s,input):peopleAction(env,request,s,input)
 if(method==='POST'&&['/collections','/schemas','/groups'].includes(path))return createMetadata(env,s,{'/collections':'collection','/schemas':'schema','/groups':'group'}[path]!,input)
 if(method==='POST'&&parts[0]==='collections'&&parts[2]==='grants')return grants(env,s,'collection',parts[1],input)
 if(method==='POST'&&parts[0]==='collections'&&parts[2]==='grant')return oneGrant(env,s,'collection',parts[1],input)
 if(method==='POST'&&parts[0]==='groups'&&parts[2]==='members')return groupMember(env,s,parts[1],input)
 if(method==='POST'&&parts[0]==='groups'&&parts[1])return updateGroup(env,s,parts[1],input)
 if(method==='POST'&&parts[0]==='schemas'&&parts.length===2)return updateSchema(env,s,parts[1],input)
 const filing=await filingExecute(env,s,method,parts,input,url);if(filing!==undefined)return filing
 const reading=await readingExecute(env,s,method,parts,input,url);if(reading!==undefined)return reading
 if(path==='/documents'&&method==='POST')return upload(env,s,input)
 if(parts[0]==='documents'&&parts[1]){
  // Lifecycle decides access itself, so a trashed record can be restored by whoever may restore it.
  const row=await get<Document>(env,'document',parts[1]);if(!(method==='POST'&&parts[2]==='lifecycle'))await access(env,s,row.payload)
  if(method==='GET'&&parts.length===2){await recordAccess(env,s,row,'document.read');const schema=await get<Schema>(env,'schema',row.payload.schema);return {...row,fieldIssues:fieldIssues(schema.payload,row.payload.fields)}}
  if(method==='GET'&&parts[2]==='readers'){owner(s);const people=await list<Person>(env,'person'),readers=[];for(const p of people){if(p.payload.status==='inactive'||!await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? AND status='active'").bind(p.id).first())continue;const r=await roles(env,{...s,operator:{...s.operator,email:p.id,role:p.payload.role as any}},row.payload);if(r.roles.length)readers.push({email:p.id,name:p.payload.name,roles:r.roles})}return readers}
  if(method==='GET'&&parts[2]==='bytes'){const version=row.payload.versions.find(v=>v.id===parts[3]);insist(version,'version_not_found',404);const download=url.searchParams.get('download')==='true';const response=await serve(env,version,download);await access(env,s,(await get<Document>(env,'document',row.id)).payload);await recordAccess(env,s,row,download?'version.download':'version.preview',version.id);return response}
  if(method==='POST'&&parts[2]==='versions')return upload(env,s,input,row)
  if(method==='POST'&&parts[2]==='filing')return updateFiling(env,s,row,input)
  if(method==='POST'&&parts[2]==='grants')return grants(env,s,'document',row.id,input)
  if(method==='POST'&&parts[2]==='grant')return oneGrant(env,s,'document',row.id,input)
  if(method==='POST'&&parts[2]==='lifecycle')return lifecycle(env,s,row,input)
  if(method==='POST'&&parts[2]==='review')return review(env,s,row,parts[3],input)
  if(method==='POST'&&parts[2]==='history'&&parts[4]==='restore')return restoreVersion(env,s,row,parts[3])
  if(method==='POST'&&parts[2]==='history'&&parts[4]==='name')return nameVersion(env,s,row,parts[3],input)
 }
 if(path==='/archive/preview'&&method==='POST')return (await previewArchive(env,s,input)).summary
 if(path==='/archive/apply'&&method==='POST')return applyArchive(env,s,input)
 if(parts[0]==='archive'&&parts[1]&&parts[1]!=='preview'&&parts[1]!=='apply')return archiveAction(env,s,parts[1],method==='POST'?input.action:'status')
 if(path==='/audit/privacy')return method==='POST'?savePrivacy(env,s,input):privacy(env,s.operator.email)
 if(path==='/audit/identities/erase'&&method==='POST')return eraseAuditIdentity(env,s,input)
 if(path==='/audit/export'&&method==='GET')return exportHistory(env,s,url.searchParams)
 if(path==='/audit'&&method==='GET'){const page=await history(env,s,url.searchParams,url.searchParams.has('paginate')?undefined:300);return url.searchParams.has('paginate')?page:page.rows}
 if(path==='/backups')return method==='GET'?backupView(env,s):backupAction(env,s,input)
 const files=await filesExecute(env,request,s,method,parts,input,url);if(files!==undefined)return files
 insist(false,'not_found',404)
}
export async function authenticated(env:Bindings,request:Request){const session=await operatorAuth(env).getSession(request);insist(session,'authentication_required',401);if(request.method!=='GET'&&request.method!=='HEAD')insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','invalid_origin',403);return session}
export function failure(error:unknown){
 const e=error as any
 const symbolic=typeof e?.code==='string'&&/^[A-Za-z][A-Za-z0-9_]+$/.test(e.code)?e.code:typeof e?.message==='string'?e.message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1]:undefined
 const code=error instanceof ChestError?e.code:symbolic||'service_unavailable'
 const status=error instanceof ChestError?e.status:Number.isInteger(e?.status)&&e.status>=400&&e.status<600?e.status:code.startsWith('INVALID_')?400:symbolic&&code!=='D1_ERROR'?409:503
 return Response.json({error:code,...(error instanceof SharingConfirmation?{recipients:error.recipients,message:'Sharing policy requires confirmation of these external recipients. Send confirmExternal: true only after confirming.'}:{}),...(code==='test_company_signin_first'?{message:'Save an identity provider and complete Test company sign-in before turning off email links.'}:{}),...(code==='suspect_upload_held'?{message:'Suspect bytes were held before publication. Review /app/upload-protection before resuming this session or device.'}:{}),...(code==='storage_limit_exceeded'?{message:'This space has reached its storage limit. Ask the owner to raise the limit or permanently erase retained files.'}:{}),...(code==='provider_not_available_yet'?{message:'Provider connections are not available yet on RER Managed.'}:{}),...(code==='NATIVE_EDIT_CONFLICT'?{message:'The imported record was edited. Undo preserves that edit. Recover the earlier library from a separate pre-import snapshot.'}:{})},{status,headers})
}
export async function apiResponse(request:Request,original:Bindings){const pathname=new URL(request.url).pathname;if(!pathname.startsWith('/api/chest/'))return null;const env=runtimeBindings(original)
 // Sync clients authenticate with their device credential, never a browser cookie.
 if(pathname.startsWith('/api/chest/sync/'))try{insist(Number(request.headers.get('content-length')||0)<20_000_000,'request_too_large',413);const result=await syncRoute(env,request,pathname.slice('/api/chest'.length));return result instanceof Response?result:Response.json(result,{headers})}catch(e){return failure(e)}
 try{const s=await authenticated(env,request);await syncPeople(env,request,s);await sweep(env);insist(Number(request.headers.get('content-length')||0)<20_000_000,'request_too_large',413);let input={};if(request.method==='POST'){insist(request.headers.get('content-type')?.includes('application/json'),'json_required');try{input=await request.json()}catch{throw new ChestError('invalid_json')}insist(input&&typeof input==='object'&&!Array.isArray(input),'invalid_input')}
 const result=await execute(env,request,s,request.method,new URL(request.url).pathname.slice('/api/chest'.length),input);kick(env,request);return result instanceof Response?result:Response.json(result,{headers})}catch(e){return failure(e)}
}
