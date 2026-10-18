import type { Bindings } from '../../auth.server'
import { insist } from '../model'
import { fromBase64 } from '../blobs'
import { commit } from '../files/repo'
import { demand, who } from '../files/access'
import { addVersion, createItem, nameVersion, rename, restoreVersion, bytes as original } from '../files/items'
import { createFile } from '../office/create-service'
import { createLink } from '../files/links'
import { share, unshare } from '../files/shares'
import { createFileRequest, requestsOn, describeRequest } from '../files/file-requests'
import { get } from '../store'
import type { FileRequest } from '../files/model'
import { action, live, resource, spend, type Authorized } from './auth'
import { brief, listItems, scopedSearch, versions, paginate } from './reads'
import { hash } from './secrets'
import { mutate } from './mutations'
export async function resourceCall(env: Bindings,auth: Authorized,method: string,path: string,input: any,url: URL,idempotency: string) {
 const [head,key,sub,version,verb]=path.split('/').filter(Boolean),w=await who(env,auth.session)
 if(method==='GET'&&head==='items'&&!key)return listItems(env,auth,url)
 if(method==='GET'&&head==='search')return scopedSearch(env,auth,url)
 if(method==='GET'&&head==='requests'&&key){const request=await get<FileRequest>(env,'file-request',key);await resource(env,auth,request.payload.folder,'request');return describeRequest(request)}
 if(method==='POST'&&head==='items'&&!key){insist(typeof input.parent==='string'&&input.parent,'oauth_parent_required');const destination=await resource(env,auth,input.parent,input.type==='folder'?'folder':'upload');demand(destination,'contribute');const size=input.type==='folder'?0:fromBase64(input.base64).length;return mutate(env,auth,idempotency,path,input,size,s=>createItem(env,s,w,{...input,device:undefined}))}
 if(method==='POST'&&head==='new-files'){const destination=await resource(env,auth,input.parent,'upload');demand(destination,'contribute');if(input.template&&!String(input.template).startsWith('builtin:')){const template=await get<any>(env,'office-template',input.template);await resource(env,auth,template.payload.source,'read');}return mutate(env,auth,idempotency,path,input,0,async s=>createFile(env,s,w,{...input,key:`${auth.grant.id}:${await hash(idempotency)}`}))}
 if(head==='items'&&key){
  if(method==='GET'&&!sub){const ctx=await resource(env,auth,key,'read');return {...brief(ctx.chain.at(-1)!),canDownload:((await import('../files/access')).allowed(ctx,'download'))}}
  if(method==='GET'&&sub==='versions'){const ctx=await resource(env,auth,key,'read');return versions(ctx.chain.at(-1)!,url)}
  if(method==='GET'&&sub==='shares'){const c=await resource(env,auth,key,'share');demand(c,'share');return paginate(c.chain.at(-1)!.payload.grants,url,g=>g.principal)}
  if(method==='GET'&&sub==='requests'){await resource(env,auth,key,'request');const c=await resource(env,auth,key,'request');demand(c,'share');const all=await requestsOn(env,key);return paginate(all.map(({submissions,...r})=>r),url,r=>r.id)}
  if(method==='POST'&&sub==='pick'){const c=await resource(env,auth,key,'picker');return {id:key,name:c.chain.at(-1)!.payload.name,type:c.chain.at(-1)!.payload.type,url:`${env.AUTH_ORIGIN}/app/items/${encodeURIComponent(key)}`}}
  if(method==='GET'&&sub==='bytes'&&version){const c=await resource(env,auth,key,'download');demand(c,'download');const v=c.chain.at(-1)!.payload.versions.find(v=>v.id===version);insist(v,'version_not_found',404)
   await commit(env,auth.session,[spend(auth,{bytes:v.size})],{fences:c.fences});const current=await live(env,auth) as Authorized,response=await original(env,current.session,await who(env,current.session),key,version,true,auth.request.headers.get('range'))
   if(!response.body)return response;const reader=response.body.getReader();return new Response(new ReadableStream({async pull(controller){try{const next=await reader.read();await live(env,current,key,'download');if(next.done){controller.close();reader.releaseLock()}else controller.enqueue(next.value)}catch(error){await reader.cancel();controller.error(error)}},async cancel(){await reader.cancel()}}),{status:response.status,headers:response.headers})
  }
  if(method==='POST'){
   const scope=sub==='versions'?'versions':sub==='rename'?'upload':sub==='requests'?'request':'share';const current=await resource(env,auth,key,scope);demand(current,scope==='versions'||scope==='upload'?'contribute':'share')
   const size=sub==='versions'&&!version?fromBase64(input.base64).length:0
   const run=(s:Authorized['session'])=>{if(sub==='versions'&&!version)return addVersion(env,s,w,key,fromBase64(input.base64),{...input,device:undefined});if(sub==='versions'&&version&&verb==='restore')return restoreVersion(env,s,w,key,version);if(sub==='versions'&&version&&verb==='name')return nameVersion(env,s,w,key,version,input);if(sub==='rename')return rename(env,s,w,key,input);if(sub==='shares')return share(env,s,w,key,input);if(sub==='unshare')return unshare(env,s,w,key,input);if(sub==='links')return createLink(env,s,w,key,input);if(sub==='requests')return createFileRequest(env,s,w,key,input);insist(false,'not_found',404)}
   return mutate(env,auth,idempotency,path,input,size,run)
  }
 }
 insist(false,'not_found',404)
}
