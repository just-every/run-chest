import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get } from '../store'
import { insist, now, type Row } from '../model'
import { context, demand, type Who } from '../files/access'
import { commit, fresh, next, type Op } from '../files/repo'
import { creatorLinkPolicy, demandLinkPolicy } from '../files/link-policy'
import { normalizeLinkVersion } from '../files/link-versions'
import { linkDate } from '../files/public-links'
import { notice, deliver } from '../files/notify'
import type { Link, PublicLink } from '../files/model'
import type { LinkScope, Repair } from './link-model'
import { scanLinks } from './link-scan'
export async function repairLink(env:Bindings,s:Session|null,w:Who,input:any,scope?:Row<LinkScope>) {
 const item=String(input.item), scan=await scanLinks(env,w,item,scope?.payload.intended??[]), ctx=await context(env,w,item);demand(ctx,'share')
 const finding=scan.findings.find(f=>f.id===input.link);insist(finding,'repair_not_found',404)
 const row=await get<PublicLink|Link>(env,finding.kind,finding.id),p=row.payload as PublicLink
 insist(input.revision===row.revision,'repair_stale',409)
 const action=String(input.action),automatic=!!scope
 insist(['revoke','renew','adopt','pin-approved','restrict-guests','decline'].includes(action),'repair_expansion_requires_owner_approval',403)
 if(action!=='revoke' && action!=='decline')insist(s?.operator.role==='owner','owner_approval_required',403)
 if(automatic)insist(scope!.payload.automatic && scope!.payload.item===item && scope!.payload.by===w.email && action==='revoke','repair_scope_refused',403)
 const key=fresh<Repair>('link-repair',{item,link:row.id,kind:finding.kind,action,by:w.email,at:now(),automatic,before:row,afterRevision:row.revision,undone:null,notice:''})
 let payload:any={...row.payload}
 if(action==='revoke') payload=finding.kind==='public-link'?{...p,revokedAt:now(),revokedBy:w.email}:{...row.payload,expires:now()}
 if(action==='renew'){insist(finding.repairs.includes('renew'),'repair_unavailable',409);payload.expires=linkDate(input.expires,input.zone);insist(payload.expires,'expiry_required')}
 if(action==='adopt'){insist(finding.kind==='public-link' && finding.repairs.includes('adopt'),'repair_unavailable',409);payload.custodian=w.email;delete payload.custodyRevokedAt;delete payload.custodyRevokedBy}
 if(action==='pin-approved'){const node=ctx.chain.at(-1)!;payload={...payload,...normalizeLinkVersion(node.payload,{versionMode:'pinned',version:node.payload.approved})};insist(finding.repairs.includes('pin-approved'),'repair_unavailable',409)}
 if(action==='restrict-guests'){const intended=scope?.payload.intended??input.intended;insist(Array.isArray(intended)&&intended.length>0 && intended.every((email:unknown)=>typeof email==='string' && p.guests?.includes(email)),'repair_cannot_expand_audience',403);insist(p.audience==='guests','repair_unavailable');payload.guests=[...new Set(intended)]}
 const fences=[...ctx.fences,...scan.fences,...scope?[scope]:[]]
 if(!['revoke','decline'].includes(action)){
  const policy=await creatorLinkPolicy(env,payload.custodian??payload.createdBy,ctx.space.id);demandLinkPolicy(policy.rules,finding.kind==='public-link'?'public':payload.audience,payload.discoverable);fences.push(...policy.fences)
  insist(await (await import('../files/access')).stillSharing(env,payload.custodian??payload.createdBy,item),'repair_custodian_unavailable',409)
 }
 const updated=action==='decline'?row:next(row,payload),message=`${ctx.chain.at(-1)!.payload.name}: ${automatic?'Preauthorized ':''}${action==='decline'?'repair declined':action==='revoke'?'link revoked':`link repair ${action}`} for ${finding.affected.join(', ')}. Original audience and version are kept in the repair record.`,n=notice(w.email,'link.repair',item,w.email,message,key.id)
 key.payload.afterRevision=updated.revision;key.payload.notice=n.id
 const statements=automatic?[{sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND status='active') THEN 1 ELSE 0 END",params:[w.email]}]:[]
 const ops:Op[]=[{row:key},{row:n},...(action==='decline'?[]:[{row:updated,previous:row}])]
 await commit(env,s,ops,{fences,statements,by:w.email,changes:action==='decline'?[]:[{item,space:ctx.space.id,kind:'access'}],audits:[{action:'link.repair',object:item,detail:{repair:key.id,link:row.id,action,automatic,audience:finding.audience,affected:finding.affected,version:finding.version}}]})
 await deliver(env,s,[n]);return {id:key.id,action,automatic}
}
export async function undoRepair(env:Bindings,s:Session,w:Who,key:string){
 insist(s.operator.role==='owner','owner_approval_required',403)
 const r=await get<Repair>(env,'link-repair',key),p=r.payload;insist(!p.undone && p.action!=='decline','repair_closed',409)
 const ctx=await context(env,w,p.item);demand(ctx,'share');const live=await get(env,p.kind,p.link)
 insist(live.revision===p.afterRevision,'repair_changed_since_apply',409)
 const original=p.before.payload as PublicLink,policy=await creatorLinkPolicy(env,original.custodian??original.createdBy,ctx.space.id)
 demandLinkPolicy(policy.rules,p.kind==='public-link'?'public':(p.before.payload as Link).audience,(p.before.payload as Link).discoverable)
 insist(await (await import('../files/access')).stillSharing(env,original.custodian??original.createdBy,p.item),'repair_custodian_unavailable',409)
 const n=notice(w.email,'link.repair',p.item,w.email,`${ctx.chain.at(-1)!.payload.name}: link repair undone with owner approval. The prior audience, expiry and version selection were restored.`,r.id)
 await commit(env,s,[{row:next(live,p.before.payload),previous:live},{row:next(r,{...p,undone:now()}),previous:r},{row:n}],{fences:[...ctx.fences,...policy.fences],changes:[{item:p.item,space:ctx.space.id,kind:'access'}],audits:[{action:'link.repair.undo',object:p.item,detail:{repair:r.id,link:p.link}}]})
 await deliver(env,s,[n]);return {undone:true}
}
