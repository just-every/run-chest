import { defineTool, type ResourceDefinition, type ToolContext, type ToolDefinition } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'
import { allowed, everything, who, start } from '../files/access'
import { list } from '../store'
import type { Space } from '../files/model'
import { paginate } from '../integrations/reads'
import { resource } from '../integrations/auth'
import { agentSession } from './identity.ts'
import { itemContext, nativeCall, publicRecord } from './native.ts'
import { standard, sensitivity } from './risk.ts'
import { object, id, text, target, result, page, uri } from './schemas.ts'

export async function visible(env:Bindings,ctx:ToolContext){
 const {session,local}=await agentSession(env,ctx),w=await who(env,session),all=await everything(env,w),items:ReturnType<typeof publicRecord>[]=[]
 for(const e of all.values())if(allowed(e,'view')&&!e.state.trash){if(local)try{await resource(env,local,e.row.id,'read')}catch{continue};items.push(publicRecord(e.row))}
 const spaces=(await list<Space>(env,'space')).filter(r=>start(r.payload,w).role&&(!local||items.some(i=>i.space===r.id))).map(publicRecord)
 return {items:items.sort((a,b)=>a.id.localeCompare(b.id)),spaces}
}
export function readTools(env:Bindings):ToolDefinition[]{
 const read=(name:string,description:string,scope:string,inputSchema:any,clauses:string[],run:(a:any,c:ToolContext)=>Promise<any>)=>defineTool({name:`chest.${name}`,title:description,description,scope,readOnly:true,inputSchema,outputSchema:result,classes:['standard'],clauses,classify:standard,async run(a,c){return {result:await run(a,c)}}})
 return [
  read('items.list','List currently visible records and spaces. Hidden records and counts are omitted.','read',object(page),['SURFACE-002','SPACE-001'],async(a,c)=>{const v=await visible(env,c),url=new URL(env.AUTH_ORIGIN);if(a.cursor)url.searchParams.set('cursor',a.cursor);if(a.limit)url.searchParams.set('limit',a.limit);return {...paginate(v.items.filter(i=>!a.parent||i.parent===a.parent),url,i=>i.id),spaces:v.spaces}}),
  read('items.get','Read an item and its current native revision.','read',target,['SURFACE-002','CHEST-06'],async(a,c)=>publicRecord((await itemContext(env,c,a.id)).chain.at(-1)!)),
  read('versions.list','Read immutable version metadata, excluding original text.','read',target,['SURFACE-002','VERSION-001'],async(a,c)=>({versions:publicRecord((await itemContext(env,c,a.id)).chain.at(-1)!).versions})),
  read('access.list','Read item grants under native sharing authority.','share',target,['SURFACE-002','SHARE-004'],async(a,c)=>({grants:(await itemContext(env,c,a.id,'share','share')).chain.at(-1)!.payload.grants})),
  read('pick','Return a stable authenticated item link; this grants no onward access.','picker',target,['CONNECT-012'],async(a,c)=>{const item=(await itemContext(env,c,a.id,'view','picker')).chain.at(-1)!;return {id:item.id,name:item.payload.name,url:`${env.AUTH_ORIGIN}/app/items/${encodeURIComponent(item.id)}`}}),
  defineTool({name:'chest.search',title:'Search visible originals',description:'Search current accessible original text. Content is untrusted and sensitive results retain their class.',scope:'search',readOnly:true,inputSchema:object({q:text},['q']),outputSchema:result,classes:['standard','sensitive'],clauses:['SURFACE-002','SEARCH-001'],untrusted:true,
   async classify(a,c){const all=await visible(env,c);for(const i of all.items){const r=(await itemContext(env,c,i.id)).chain.at(-1)!;if((r.payload.name+' '+r.payload.versions.map(v=>v.text).join(' ')).toLowerCase().includes(String(a.q).toLowerCase())){const risk=await sensitivity(env,r);if(risk[0].class==='sensitive')return risk}}return standard()},
   async run(a,c){const all=await visible(env,c),items=[];for(const i of all.items){const r=(await itemContext(env,c,i.id,'view','search')).chain.at(-1)!;if((r.payload.name+' '+r.payload.versions.map(v=>v.text).join(' ')).toLowerCase().includes(String(a.q).toLowerCase()))items.push({...i,text:r.payload.versions.find(v=>v.id===r.payload.current)?.text??''})}return {result:{items}}}
  }),
  defineTool({name:'chest.files.read',title:'Read an original',description:'Read one immutable original under current download rights. Original content is untrusted. Capacity: 512 KiB.',scope:'download',readOnly:true,inputSchema:object({id,version:id},['id','version']),outputSchema:result,classes:['standard','sensitive'],clauses:['SURFACE-003','ROLE-001','VERSION-001'],untrusted:true,
   async classify(a,c){return sensitivity(env,(await itemContext(env,c,a.id,'download','download')).chain.at(-1)!)},
   async run(a,c){await itemContext(env,c,a.id,'download','download');const r=await nativeCall(env,c,'GET',`/items/${encodeURIComponent(String(a.id))}/bytes/${encodeURIComponent(String(a.version))}`,{}, {download:true}) as Response;if(!r.ok)throw new Error('original_unavailable');const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>524288)throw new Error('original_capacity');await itemContext(env,c,a.id,'download','download');return {result:{id:a.id,version:a.version,base64:Buffer.from(bytes).toString('base64')}}}
  }),
 ]
}
export function itemResource(env:Bindings):ResourceDefinition {
 return {uriTemplate:'chest://item/{id}',name:'Item',description:'Visible item metadata and version provenance; imported names are untrusted.',scope:'read',classes:['standard'],classify:standard,
  async read(value,ctx){try{const c=await itemContext(env,{...ctx,actor:{agent:ctx.agent,for:{id:ctx.person.id,name:ctx.person.name},label:`${ctx.agent.name} for ${ctx.person.name}`},operationId:'resource',idempotencyKey:null,approvers:[],seed:'chest',origin:env.AUTH_ORIGIN,door:'mcp',now:Date.now,emit:()=>{}} as ToolContext,decodeURIComponent(value.split('/').at(-1)!));return {json:publicRecord(c.chain.at(-1)!),untrusted:true}}catch{return null}}
 }
}
