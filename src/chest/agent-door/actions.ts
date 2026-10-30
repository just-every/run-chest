import { defineTool, ToolRefusal, type ToolDefinition, type ToolContext, type ClassAndFacts } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'
import { context, who, start, allowed } from '../files/access'
import { place } from '../files/items'
import { get } from '../store'
import { ChestError } from '../model'
import { rank, type Space } from '../files/model'
import { agentSession } from './identity.ts'
import { itemContext, mutation } from './native.ts'
import { standard, exposure, recipientRisk } from './risk.ts'
import { object, text, id, target, result } from './schemas.ts'
const array={type:'array',items:text,maxItems:20}
type Spec={name:string;scope:string;schema:any;clauses:string[];path:(a:any)=>string;input?:(a:any)=>any;classes?:ToolDefinition['classes'];kind?:'create'|'space'|'share'|'member'|'restore';records?:string[];action?:'contribute'|'manage'|'share';classify?:(a:any,c:ToolContext)=>Promise<ClassAndFacts[]>}
export function actionTools(env:Bindings):ToolDefinition[]{
 const specs:Spec[]=[
  {name:'spaces.create',scope:'spaces:write',schema:object({name:text},['name']),clauses:['SURFACE-004','SPACE-001'],path:()=>'/spaces',kind:'space',records:['space']},
  {name:'files.create',scope:'upload',schema:object({space:id,parent:id,name:text,kind:{enum:['document','spreadsheet','presentation']},template:id},['kind']),clauses:['SURFACE-004','EDIT-004','EDIT-013'],path:()=>'/new-files',kind:'create',classes:['standard','external']},
 {name:'folders.create',scope:'folder',schema:object({space:id,parent:id,name:text},['name']),clauses:['SURFACE-004','SPACE-001'],path:()=>'/items',input:a=>({...a,type:'folder'}),kind:'create',classes:['standard','external']},
  {name:'files.upload',scope:'upload',schema:object({id,space:id,parent:id,name:text,base64:{type:'string',maxLength:699052}},['base64']),clauses:['SURFACE-004','CHEST-03','VERSION-001'],path:a=>a.id?`/items/${encodeURIComponent(a.id)}/versions`:'/items',input:a=>({...a,type:'file'}),kind:'create',classes:['standard','external']},
  {name:'items.update',scope:'upload',schema:object({id,name:text,action:{enum:['rename','move','filing']},space:id,parent:id,schema:id,owner:id,fields:{type:'object'}},['id']),clauses:['SURFACE-004','CHEST-04'],path:a=>`/items/${encodeURIComponent(a.id)}/${a.action??'rename'}`,classes:['standard','external']},
  {name:'versions.name',scope:'versions',schema:object({id,version:id,name:text},['id','version','name']),clauses:['SURFACE-005','VERSION-001'],path:a=>`/items/${encodeURIComponent(a.id)}/versions/${encodeURIComponent(a.version)}/name`},
  {name:'versions.restore',scope:'versions',schema:object({id,version:id},['id','version']),clauses:['SURFACE-005','VERSION-001'],path:a=>`/items/${encodeURIComponent(a.id)}/versions/${encodeURIComponent(a.version)}/restore`,classes:['standard','external']},
  {name:'items.trash',scope:'items:manage',schema:target,clauses:['SURFACE-005','CHEST-13'],path:a=>`/items/${encodeURIComponent(a.id)}/trash`,action:'manage'},
  {name:'items.untrash',scope:'items:manage',schema:target,clauses:['SURFACE-005','CHEST-13'],path:a=>`/items/${encodeURIComponent(a.id)}/restore`,kind:'restore',classes:['standard','external']},
  {name:'share',scope:'share',schema:object({id,principal:id,role:{enum:['viewer','commenter','editor']}},['id','principal','role']),clauses:['SURFACE-006','SHARE-004','POLICY-001'],path:a=>`/items/${encodeURIComponent(a.id)}/shares`,kind:'share',classes:['standard','external'],action:'share'},
  {name:'links.create',scope:'share',schema:object({id,audience:{enum:['restricted','organisation','public','guests']},guests:array,role:{enum:['viewer','commenter','editor']},expires:text},['id','audience']),clauses:['SURFACE-006','SHARE-001','POLICY-002'],path:a=>`/items/${encodeURIComponent(a.id)}/${['public','guests'].includes(a.audience)?'public-links':'links'}`,records:['link','public-link'],action:'share',classes:['standard','external'],classify:async(a,c)=>{const target=await itemContext(env,c,a.id,'share','share');return a.audience==='public'?[{class:'external',facts:{measure:1,counterparty:'public'}}]:a.audience==='guests'?recipientRisk(env,target,a.guests??[]):standard()}},
 {name:'access.narrow',scope:'share',schema:object({id,principal:id},['id','principal']),clauses:['SURFACE-007','SHARE-007'],path:a=>`/items/${encodeURIComponent(a.id)}/unshare`,action:'share'},
  {name:'requests.create',scope:'request',schema:object({id,title:text,message:text},['id','title']),clauses:['SURFACE-008','SHARE-002'],path:a=>`/items/${encodeURIComponent(a.id)}/file-requests`,records:['file-request'],action:'share'},
  {name:'comments.add',scope:'comments:write',schema:object({id,message:text,mentions:array},['id','message']),clauses:['SURFACE-004','EDIT-003','FOLLOW-001'],path:a=>`/items/${encodeURIComponent(a.id)}/comments`,records:['comment'],classes:['standard','external'],classify:async(a,c)=>recipientRisk(env,await itemContext(env,c,a.id,'comment'),a.mentions??[])},
  {name:'members.update',scope:'members:write',schema:object({id,principal:id,action:{enum:['add','role','remove']},role:{enum:['viewer','commenter','contributor','content_manager','manager']}},['id','principal','action']),clauses:['SURFACE-010','SPACE-001','ROLE-001'],path:a=>`/spaces/${encodeURIComponent(a.id)}/member`,kind:'member',records:['space'],classes:['access','external']},
 ]
 return specs.map(spec=>{
  async function resolve(a:any,c:ToolContext){
   if(spec.kind==='space')return null
   const {session,local}=await agentSession(env,c)
   if(spec.kind==='member'){
    if(local)throw new ToolRefusal('insufficient_scope')
    const row=await get<Space>(env,'space',a.id),w=await who(env,session)
    if(start(row.payload,w).role!=='manager')throw new ToolRefusal('resource_unavailable')
    return {space:row,chain:[],state:start(row.payload,w),links:[],fences:[row]}
   }
   if(spec.kind==='create'){
    if(a.id)return itemContext(env,c,a.id,'contribute','versions')
    if(a.parent)return itemContext(env,c,a.parent,'contribute',spec.scope==='folder'?'folder':'upload')
    if(local)throw new ToolRefusal('resource_unavailable')
    return place(env,await who(env,session),a.space,null)
   }
   if(spec.kind==='restore'){
    const w=await who(env,session),found=await context(env,w,a.id)
    if(!found.state.role||local)throw new ToolRefusal('resource_unavailable')
    return found
   }
   return itemContext(env,c,a.id,a.action==='move'?'manage':spec.action??'contribute',spec.scope==='share'?'share':spec.scope==='versions'?'versions':spec.scope==='request'?'request':'upload')
  }
  const tool:ToolDefinition={name:`chest.${spec.name}`,title:spec.name.replaceAll('.',' '),description:`Native Chest ${spec.name}. Current sponsor permissions and record revisions remain authoritative.`,scope:spec.scope,readOnly:false,inputSchema:spec.schema,outputSchema:result,classes:spec.classes??['standard'],clauses:spec.clauses,
   async classify(a,c){
    const target=await resolve(a,c)
    if(spec.classify)return spec.classify(a,c)
    if(spec.name==='items.update'&&a.action==='move'){const {session}=await agentSession(env,c);return exposure(env,await place(env,await who(env,session),a.space??target?.space.id,a.parent))}
    if(spec.kind==='member'){
     const old=target!.space.payload.members.find(g=>g.principal===a.principal),widens=a.action!=='remove'&&(!old||rank[a.role as keyof typeof rank]>rank[old.role])
     const classes:ClassAndFacts[]=[{class:'access',facts:{measure:1,direction:widens?'widens':'narrows'}}]
     const recipients=await recipientRisk(env,target!,[String(a.principal)]);if(recipients[0].class==='external'&&a.action==='add')classes.push(...recipients)
     return classes
    }
    if(spec.kind==='share')return recipientRisk(env,target!,[String(a.principal)])
    if(spec.classes?.includes('external')&&target)return exposure(env,target)
    return standard()
   },
   async summary(a,c){const found=await resolve(a,c);return {target:{...((found?.chain.at(-1)?.id??found?.space.id)?{id:found?.chain.at(-1)?.id??found?.space.id}:{}),name:found?.chain.at(-1)?.payload.name??String(a.name??found?.space.payload.name??'New team space')},...(a.principal?{recipients:[String(a.principal)]}:{}),...(a.role?{role:String(a.role)}:{}),items:[String(a.name??spec.name)]}},
   async run(a,c){await resolve(a,c);const data=spec.input?spec.input(a):{...a,...(spec.name==='files.create'?{key:c.idempotencyKey}:{} )},result=await mutation(env,c,spec.name,spec.path(a),data,spec.records)
    // Native record changes feed the shared audit/event vocabulary.
    if(result.id) c.emit(`item.${spec.name.split('.').at(-1)}`,`${spec.kind==='space'||spec.kind==='member'?'chest://space':'chest://item'}/${encodeURIComponent(result.id)}`,{id:result.id})
    const resource=spec.kind==='space'||spec.kind==='member'?`chest://space/${encodeURIComponent(result.id)}`:spec.records?.includes('file-request')?`chest://request/${encodeURIComponent(result.id)}`:spec.records?.includes('link')?`chest://link/${encodeURIComponent(result.id)}`:spec.records?.includes('comment')?`chest://item/${encodeURIComponent(String(a.id))}`:`chest://item/${encodeURIComponent(result.id)}`
    return {result,...(spec.name==='items.trash'?{}:{resources:[{uri:resource,name:result.name??spec.name}]})}
   },
  }
  if(!['create','space'].includes(spec.kind??'')){
   tool.revisionType='string';tool.revision=async(a,c)=>{const found=await resolve(a,c);return (spec.kind==='member'?found?.space:found?.chain.at(-1))?.revision??null}
   tool.target=async(a,c)=>{const found=await resolve(a,c);const row=spec.kind==='member'?found?.space:found?.chain.at(-1);return row?{kind:row.kind,id:row.id}:null}
  }
  if(spec.kind==='member')tool.authority=async(a,c)=>{
   const found=await resolve(a,c),old=found!.space.payload.members.find(g=>g.principal===a.principal)
   return {subject:String(a.principal),widens:a.action!=='remove'&&(!old||rank[a.role as keyof typeof rank]>rank[old.role])}
  }
  for(const name of ['classify','summary','revision','target','run','authority'] as const){const callback=tool[name];if(typeof callback==='function')(tool as any)[name]=async(...args:any[])=>{try{return await (callback as Function)(...args)}catch(error){if(error instanceof ChestError)throw new ToolRefusal(error.code,error.code,{native_status:error.status});throw error}}}
  return defineTool(tool)
 })
}
