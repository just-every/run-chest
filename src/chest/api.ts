import { operatorAuth,runtimeBindings,type Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { ChestError,insist,type Document,type Person,type Schema } from './model'
import { fieldIssues } from './fields'
import { get,list,recordAccess } from './store'
import { documents,access,owner,roles } from './access'
import { syncPeople,peopleAction } from './identity'
import { createMetadata,grants,updateFiling,updateGroup,updateSchema } from './metadata'
import { upload,lifecycle } from './documents'
import { review } from './reviews'
import { serve } from './blobs'
import { previewArchive,applyArchive,archiveAction } from './archive'
export const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}
export async function overview(env:Bindings,s:Session,url:URL){
 const rows=await documents(env,s,url.searchParams.get('trash')==='true'),q=(url.searchParams.get('q')||'').toLowerCase()
 const filtered=rows.filter(r=>JSON.stringify([r.payload.title,r.payload.fields,r.payload.reference,...r.payload.versions.map(v=>v.text)]).toLowerCase().includes(q))
 const collections=await list(env,'collection'),groups=await list(env,'group'),schemas=await list<Schema>(env,'schema')
 const principals=[s.operator.email,...groups.filter(g=>g.payload.members.includes(s.operator.email)).map(g=>g.id)]
 const visible=collections.filter(c=>s.operator.role==='owner'||c.payload.grants.some((g:any)=>principals.includes(g.principal)))
 const diagnosed=filtered.map(row=>({...row,fieldIssues:fieldIssues(schemas.find(schema=>schema.id===row.payload.schema)!.payload,row.payload.fields)}))
 return {me:{email:s.operator.email,name:s.operator.displayName,role:s.operator.role},documents:diagnosed,count:filtered.length,collections:visible,schemas,people:await list<Person>(env,'person'),groups:s.operator.role==='owner'?groups:[],storage:s.operator.role==='owner'?{logicalBytes:(await list<Document>(env,'document')).reduce((n,r)=>n+r.payload.versions.reduce((a,v)=>a+v.size,0),0)}:null}
}
export async function execute(env:Bindings,request:Request,s:Session,method:string,path:string,input:any):Promise<any>{
 const parts=path.split('/').filter(Boolean),url=new URL(request.url)
 if(method==='GET'&&path==='/library')return overview(env,s,url)
 if(path==='/people'&&method==='POST')return peopleAction(env,request,s,input)
 if(method==='POST'&&['/collections','/schemas','/groups'].includes(path))return createMetadata(env,s,{'/collections':'collection','/schemas':'schema','/groups':'group'}[path]!,input)
 if(method==='POST'&&parts[0]==='collections'&&parts[2]==='grants')return grants(env,s,'collection',parts[1],input)
 if(method==='POST'&&parts[0]==='groups'&&parts[1])return updateGroup(env,s,parts[1],input)
 if(method==='POST'&&parts[0]==='schemas'&&parts.length===2)return updateSchema(env,s,parts[1],input)
 if(path==='/documents'&&method==='POST')return upload(env,s,input)
 if(parts[0]==='documents'&&parts[1]){
  const row=await get<Document>(env,'document',parts[1]);await access(env,s,row.payload)
  if(method==='GET'&&parts.length===2){await recordAccess(env,s,row,'document.read');const schema=await get<Schema>(env,'schema',row.payload.schema);return {...row,fieldIssues:fieldIssues(schema.payload,row.payload.fields)}}
  if(method==='GET'&&parts[2]==='readers'){owner(s);const people=await list<Person>(env,'person'),readers=[];for(const p of people){if(p.payload.status==='inactive'||!await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? AND status='active'").bind(p.id).first())continue;const r=await roles(env,{...s,operator:{...s.operator,email:p.id,role:p.payload.role as any}},row.payload);if(r.roles.length)readers.push({email:p.id,name:p.payload.name,roles:r.roles})}return readers}
  if(method==='GET'&&parts[2]==='bytes'){const version=row.payload.versions.find(v=>v.id===parts[3]);insist(version,'version_not_found',404);const download=url.searchParams.get('download')==='true';const response=await serve(env,version,download);await access(env,s,(await get<Document>(env,'document',row.id)).payload);await recordAccess(env,s,row,download?'version.download':'version.preview');return response}
  if(method==='POST'&&parts[2]==='versions')return upload(env,s,input,row)
  if(method==='POST'&&parts[2]==='filing')return updateFiling(env,s,row,input)
  if(method==='POST'&&parts[2]==='grants')return grants(env,s,'document',row.id,input)
  if(method==='POST'&&parts[2]==='lifecycle')return lifecycle(env,s,row,input)
  if(method==='POST'&&parts[2]==='review')return review(env,s,row,parts[3],input)
 }
 if(path==='/archive/preview'&&method==='POST')return (await previewArchive(env,s,input)).summary
 if(path==='/archive/apply'&&method==='POST')return applyArchive(env,s,input)
 if(parts[0]==='archive'&&parts[1]&&parts[1]!=='preview'&&parts[1]!=='apply')return archiveAction(env,s,parts[1],method==='POST'?input.action:'status')
 if(path==='/audit'&&method==='GET'){const rows=await env.DB.prepare('SELECT * FROM chest_audit ORDER BY at DESC LIMIT 300').all();const visible=new Set((await documents(env,s)).map(r=>r.id));return s.operator.role==='owner'?rows.results:rows.results.filter((r:any)=>visible.has(r.object_id))}
 insist(false,'not_found',404)
}
export async function authenticated(env:Bindings,request:Request){const session=await operatorAuth(env).getSession(request);insist(session,'authentication_required',401);if(request.method!=='GET'&&request.method!=='HEAD')insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','invalid_origin',403);return session}
export function failure(error:unknown){
 const e=error as any
 const symbolic=typeof e?.code==='string'&&/^[A-Za-z][A-Za-z0-9_]+$/.test(e.code)?e.code:typeof e?.message==='string'?e.message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1]:undefined
 const code=error instanceof ChestError?e.code:symbolic||'service_unavailable'
 const status=error instanceof ChestError?e.status:Number.isInteger(e?.status)&&e.status>=400&&e.status<600?e.status:code.startsWith('INVALID_')?400:symbolic&&code!=='D1_ERROR'?409:503
 return Response.json({error:code,...(code==='NATIVE_EDIT_CONFLICT'?{message:'The imported record was edited. Undo preserves that edit. Recover the earlier library from a separate pre-import snapshot.'}:{})},{status,headers})
}
export async function apiResponse(request:Request,original:Bindings){if(!new URL(request.url).pathname.startsWith('/api/chest/'))return null;const env=runtimeBindings(original)
 try{const s=await authenticated(env,request);await syncPeople(env,request,s);insist(Number(request.headers.get('content-length')||0)<20_000_000,'request_too_large',413);let input={};if(request.method==='POST'){insist(request.headers.get('content-type')?.includes('application/json'),'json_required');try{input=await request.json()}catch{throw new ChestError('invalid_json')}insist(input&&typeof input==='object'&&!Array.isArray(input),'invalid_input')}
 const result=await execute(env,request,s,request.method,new URL(request.url).pathname.slice('/api/chest'.length),input);return result instanceof Response?result:Response.json(result,{headers})}catch(e){return failure(e)}
}
