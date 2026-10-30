import type { Bindings } from '../../auth.server'
import { ChestError, insist } from '../model'
import { chestAgentDoor } from '../agent-door/index.ts'
import { fromBase64 } from '../blobs'
import { action, resource, type Authorized } from './auth'
import { listItems, scopedSearch, brief, versions, paginate } from './reads'
import { get } from '../store'
import { requestsOn, describeRequest } from '../files/file-requests'
import type { FileRequest } from '../files/model'
// OAuth APIs retain their native credential purpose and read formats. Mutations
// enter the same policy, approval, audit and native service path as MCP.
export async function resourceCall(env:Bindings,auth:Authorized,method:string,path:string,input:any,url:URL,key:string){
 const [head,id,sub,version,verb]=path.split('/').filter(Boolean)
 const invoke=async(tool:string,args:Record<string,unknown>)=>{
  const answer=await chestAgentDoor(env).invoke(`chest.${tool}`,args,{person:{id:auth.session.operator.id},agent:{id:auth.client.id,name:auth.client.payload.name,specialist:'records clerk'},scopes:auth.grant.payload.actions,clientId:auth.tokenId})
  if(answer.outcome==='refused')throw new ChestError(answer.code??'agent_refused',typeof answer.fields?.native_status==='number'?answer.fields.native_status:answer.code==='resource_unavailable'?403:answer.code?.includes('conflict')?409:answer.code?.includes('budget')?429:403)
  if(answer.outcome==='pending')throw new ChestError('approval_required',403)
  return answer
 }
 // SDK read formats remain stable, after the same classified, audited native
 // read tool has received the current company policy decision.
 if(method==='GET'){
  if(head==='items'&&!id)await invoke('items.list',{limit:Math.min(Number(url.searchParams.get('limit')||100),100)})
  if(head==='search')await invoke('search',{q:url.searchParams.get('q')??''})
  if(head==='items'&&id&&!sub)await invoke('items.get',{id})
  if(head==='items'&&sub==='shares')await invoke('access.list',{id})
  if(head==='items'&&sub==='requests')await invoke('requests.list',{id})
  if(head==='items'&&sub==='versions')await invoke('versions.list',{id})
  if(head==='requests'&&id){const row=await get<FileRequest>(env,'file-request',id);await resource(env,auth,row.payload.folder,'request');await invoke('requests.list',{id:row.payload.folder})}
 }

 if(method==='GET'&&head==='items'&&!id)return listItems(env,auth,url)
 if(method==='GET'&&head==='search')return scopedSearch(env,auth,url)
 if(method==='GET'&&head==='requests'&&id){const row=await get<FileRequest>(env,'file-request',id);await resource(env,auth,row.payload.folder,'request');return describeRequest(row)}
 if(method==='GET'&&head==='items'&&id&&!sub){const c=await resource(env,auth,id,'read');return {...brief(c.chain.at(-1)!),canDownload:(await import('../files/access')).allowed(c,'download')}}
 if(method==='GET'&&head==='items'&&sub==='shares'){const c=await resource(env,auth,id,'share');(await import('../files/access')).demand(c,'share');return paginate(c.chain.at(-1)!.payload.grants,url,g=>g.principal)}
 if(method==='GET'&&head==='items'&&sub==='requests'){const c=await resource(env,auth,id,'request');(await import('../files/access')).demand(c,'share');return paginate((await requestsOn(env,id)).map(({submissions,...r})=>r),url,r=>r.id)}
 if(method==='GET'&&head==='items'&&sub==='versions'){const c=await resource(env,auth,id,'read');return versions(c.chain.at(-1)!,url)}
 let tool:string|undefined,args:Record<string,unknown>={...input,...(id?{id}:{}),...(method==='POST'?{idempotency_key:key}:{})}
 if(head==='items'&&!id&&method==='POST')tool=input.type==='folder'?'folders.create':'files.upload'
 if(head==='new-files'&&method==='POST')tool='files.create'
 if(head==='items'&&id){
  if(method==='GET'&&sub==='bytes'&&version){tool='files.read';args={id,version,...(auth.request.headers.get('range')?{range:auth.request.headers.get('range')}: {})}}
  if(method==='POST'&&sub==='versions'){tool=verb==='restore'?'versions.restore':verb==='name'?'versions.name':'files.upload';args={...args,...(version?{version}: {})}}
  if(method==='POST'&&sub==='rename')tool='items.update'
  if(method==='POST'&&sub==='shares')tool='share'
  if(method==='POST'&&sub==='unshare')tool='access.narrow'
  if(method==='POST'&&sub==='links')tool='links.create'
  if(method==='POST'&&sub==='requests')tool='requests.create'
  if(method==='POST'&&sub==='pick'){tool='pick';args={id}}
 }
 insist(tool,'not_found',404)
 const answer=await chestAgentDoor(env).invoke(`chest.${tool}`,args,{person:{id:auth.session.operator.id},agent:{id:auth.client.id,name:auth.client.payload.name,specialist:'records clerk'},scopes:auth.grant.payload.actions,clientId:auth.tokenId})
 if(answer.outcome==='refused')throw new ChestError(answer.code??'agent_refused',typeof answer.fields?.native_status==='number'?answer.fields.native_status:answer.code==='resource_unavailable'?403:answer.code?.includes('conflict')?409:answer.code?.includes('budget')?429:403)
 if(answer.outcome==='pending')return {state:'pending',approval:answer.approval,decision:answer.decision}
 const result=answer.result as any
 if(tool==='files.read')return new Response(fromBase64(result.base64),{status:result.status,headers:{'content-type':result.mediaType??'application/octet-stream',...(result.contentRange?{'content-range':result.contentRange}:{})}})
 return result
}
