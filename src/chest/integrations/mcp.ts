import type { Bindings } from '../../auth.server'
import { ChestError, insist } from '../model'
import { action, type Authorized } from './auth'
import { resourceCall } from './resources'
const object=(properties:Record<string,unknown>,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false}),string={type:'string'},id={type:'string',minLength:1},limit={type:'integer',minimum:1,maximum:100}
const tools=[
 {name:'chest_list',description:'List currently accessible files and folders inside the grant; follow nextCursor.',inputSchema:object({parent:id,cursor:string,limit})},
 {name:'chest_search',description:'Search originals inside the grant with current ACL and named filters.',inputSchema:object({q:string,type:string,owner:string,creator:string,sharedBy:string,modifiedFrom:string,modifiedTo:string,location:string,versions:{enum:['current','any']},cursor:string,limit})},
 {name:'chest_get',description:'Read metadata for one stable item ID.',inputSchema:object({id},['id'])},
 {name:'chest_versions',description:'Read retained immutable versions for one file.',inputSchema:object({id,cursor:string,limit},['id'])},
 {name:'chest_upload',description:'Upload an original into an allowed folder, idempotent on caller key.',inputSchema:object({parent:id,name:string,base64:string,key:string},['parent','name','base64','key'])},
 {name:'chest_create_folder',description:'Create a folder within the grant.',inputSchema:object({parent:id,name:string,key:string},['parent','name','key'])},
 {name:'chest_share',description:'Share an item with a person under current sharing policy.',inputSchema:object({id,principal:string,role:{enum:['viewer','commenter','editor']},confirmExternal:{type:'boolean'},key:string},['id','principal','role','key'])},
 {name:'chest_create_request',description:'Create an upload-only request for an allowed folder.',inputSchema:object({id,title:string,message:string,key:string},['id','title','key'])},
 {name:'chest_pick',description:'Return the stable ID and authenticated Chest link under current policy; grants no onward access.',inputSchema:object({id},['id'])},
]
export async function mcp(env: Bindings,auth: Authorized,payload: any) {
 insist(payload&&payload.jsonrpc==='2.0'&&typeof payload.method==='string'&&!Array.isArray(payload),'invalid_json_rpc')
 const id=payload.id??null,reply=(result:unknown)=>({jsonrpc:'2.0',id,result})
 if(payload.method==='notifications/initialized')return undefined
 if(payload.method==='initialize')return reply({protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'Chest',version:'1.0'}})
 if(payload.method==='ping')return reply({})
 if(payload.method==='tools/list')return reply({tools})
 if(payload.method!=='tools/call')return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}}
 const name=payload.params?.name,a=payload.params?.arguments??{},tool=tools.find(t=>t.name===name)
 if(!tool)return {jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}}
 try {
  const props=tool.inputSchema.properties;insist(a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).every(k=>k in props)&&tool.inputSchema.required.every(k=>a[k]!==undefined),'invalid_tool_arguments')
  let method='GET',path='',input:any={},query=new URLSearchParams()
  for(const [k,v] of Object.entries(a))if(!['id','key','base64'].includes(k))query.set(k,String(v))
  if(name==='chest_list')path='/items';if(name==='chest_search')path='/search';if(name==='chest_get')path=`/items/${encodeURIComponent(a.id)}`;if(name==='chest_versions')path=`/items/${encodeURIComponent(a.id)}/versions`
  if(name==='chest_upload'||name==='chest_create_folder'){method='POST';path='/items';input={parent:a.parent,name:a.name,type:name==='chest_create_folder'?'folder':'file',...(name==='chest_upload'?{base64:a.base64}:{})}}
  if(name==='chest_share'){method='POST';path=`/items/${encodeURIComponent(a.id)}/shares`;input={principal:a.principal,role:a.role,confirmExternal:a.confirmExternal}}
  if(name==='chest_create_request'){method='POST';path=`/items/${encodeURIComponent(a.id)}/requests`;input={title:a.title,message:a.message}}
  if(name==='chest_pick'){method='POST';path=`/items/${encodeURIComponent(a.id)}/pick`}
  const result=await resourceCall(env,auth,method,path,input,new URL(`${env.AUTH_ORIGIN}/?${query}`),String(a.key??''));return reply({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false})
 }catch(error){return reply({content:[{type:'text',text:JSON.stringify({error:error instanceof ChestError?error.code:'service_unavailable'})}],isError:true})}
}
