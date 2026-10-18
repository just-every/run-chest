import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { insist, now } from '../model'
import { context, demand, who, type Who } from '../files/access'
import { commit, fresh, where } from '../files/repo'
import { createPublicLink, revokePublicLink, describePolicy } from '../files/public-links'
import type { Item, PublicLink } from '../files/model'
import { operatorMail } from '../../mail.server.mjs'
import { esc } from '../ui-shared'
import { event, type Package, type Event } from './model'
export async function transferView(env:Bindings,s:Session,w:Who,id:string) {
 const row=await get<Package>(env,'transfer-package',id)
 insist(row.payload.createdBy===s.operator.email,'transfer_owner_required',403)
 const ctx=await context(env,w,row.payload.item);demand(ctx,'share')
 const link=await get<PublicLink>(env,'public-link',row.payload.link)
 return {id:row.id,...row.payload,link:await describePolicy(env,link,ctx.space.id),events:(await where<Event>(env,'transfer-event','$.transfer',id)).map(e=>e.payload).sort((a,b)=>a.at.localeCompare(b.at))}
}
export async function transfersExecute(env:Bindings,_request:Request,s:Session,method:string,parts:string[],input:any) {
 if(parts[0]!=='transfers')return undefined
 const w=await who(env,s),id=parts[1]
 if(method==='GET'&&id)return transferView(env,s,w,id)
 if(method==='GET') {
  const rows=(await list<Package>(env,'transfer-package')).filter(r=>r.payload.createdBy===s.operator.email),out=[]
  for(const r of rows){const ctx=await context(env,w,r.payload.item);try{demand(ctx,'share')}catch{continue};out.push({id:r.id,...r.payload})}
  return out
 }
 if(method==='POST'&&id&&parts[2]==='revoke'){const view=await transferView(env,s,w,id);return revokePublicLink(env,s,w,view.link.id)}
 insist(method==='POST'&&!id,'not_found',404)
 const ctx=await context(env,w,String(input.item));demand(ctx,'share');demand(ctx,'download')
 const item=ctx.chain.at(-1)!,title=String(input.title??item.payload.name).trim();insist(title.length>0&&title.length<=240,'invalid_title')
 const limit=input.limit===undefined||input.limit===''?null:Number(input.limit);insist(limit===null||Number.isInteger(limit)&&limit>=1&&limit<=100000,'invalid_download_limit')
 const receipt=input.receipt===true||input.receipt==='true'
 if(input.sendTo){const to=String(input.sendTo).trim().toLowerCase();insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)&&to.length<=254,'invalid_email');insist(operatorMail(env)&&env.MAIL_FROM,'mail_not_configured',503)}
 const created=await createPublicLink(env,s,w,item.id,{audience:input.audience??'public',guests:input.guests,confirmExternal:input.confirmExternal,versionMode:'pinned',...(item.payload.type==='file'?{version:item.payload.current}:{}),expires:input.expires,zone:input.zone,password:input.password})
 const row=fresh<Package>('transfer-package',{link:created.link.id,item:item.id,title,createdBy:s.operator.email,at:now(),receipt,limit,started:0})
 await commit(env,s,[{row}],{fences:ctx.fences,audits:[{action:'transfer.create',object:item.id,detail:{transfer:row.id,link:created.link.id}}]})
 let email='not_requested'
 if(input.sendTo){
  const to=String(input.sendTo).trim().toLowerCase();insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)&&to.length<=254,'invalid_email')
  if(input.audience==='guests')insist((Array.isArray(input.guests)?input.guests:String(input.guests??'').split(/[;,\n]/)).map((e:string)=>e.trim().toLowerCase()).includes(to),'recipient_not_invited')
  const sender=operatorMail(env);insist(sender&&env.MAIL_FROM,'mail_not_configured',503)
  const result=await sender.send({deliveryId:row.id,from:env.MAIL_FROM,to:[to],subject:`Chest delivery: ${title}`,text:`${s.operator.email} sent you ${title}. Open the package to download its pinned versions.\n\n${created.url}\n\nEmail delivery acknowledgment does not confirm that you received the files.`,html:`<p>${esc(s.operator.email)} sent you ${esc(title)}.</p><p><a href="${esc(created.url)}">Open delivery package</a></p>`,headers:{'Auto-Submitted':'auto-generated'}})
  email=result.status
  if(result.status==='accepted')await commit(env,s,[{row:event(row.id,to,'mail_accepted')}])
 }
 return {id:row.id,url:created.url,email}
}
