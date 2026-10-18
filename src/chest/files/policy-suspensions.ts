import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list,get } from '../store'
import { insist,type Group } from '../model'
import { canAdmin,requireAdmin } from '../administration/roles'
import { creatorLinkPolicy } from './link-policy'
import { externalReason,publicPolicyReason } from './sharing-policy'
import type { Item,Space,PublicLink } from './model'
import { commit,next } from './repo'

// Administrative metadata only: policy administration does not grant access to file names or contents.
export async function suspendedGrants(env:Bindings,s:Session){
 const items=await list<Item>(env,'item'),spaces=await list<Space>(env,'space'),groups=await list<Group>(env,'group'),out:{item:string;principal:string;by:string;reason:string;kind:string;id:string}[]=[]
 for(const item of items){
  const space=spaces.find(r=>r.id===item.payload.space);if(!space || !await canAdmin(env,s,'sharing-security',space.payload.owner||space.payload.createdBy))continue
  for(const grant of item.payload.grants){
   const p=(await creatorLinkPolicy(env,grant.by,space.id)).rules,emails=grant.principal.includes('@')?[grant.principal]:groups.find(g=>g.id===grant.principal)?.payload.members??[]
   const sourceManager=space.payload.kind==='personal'?grant.by===space.payload.owner:space.payload.members.some(g=>g.role==='manager'&&(g.principal===grant.by||groups.some(r=>r.id===g.principal&&r.payload.members.includes(grant.by)))&&(!g.expires||Date.parse(g.expires)>Date.now()))
   for(const email of emails){const member=space.payload.members.some(g=>(g.principal===email||groups.some(r=>r.id===g.principal&&r.payload.members.includes(email)))&&(!g.expires||Date.parse(g.expires)>Date.now())),external=!p.organizationDomains.includes(email.split('@')[1]),reason=!p.allowEditors&&!sourceManager?'sharing_policy_managers_only':!p.allowNonMembers&&space.payload.kind==='team'&&!member?'sharing_policy_non_members_disabled':external?externalReason(p,'named',[email]):null
    if(reason)out.push({item:item.id,principal:grant.principal,by:grant.by,reason,kind:'grant',id:item.id})
   }
  }
 }
 for(const link of await list<PublicLink>(env,'public-link')){if(link.payload.revokedAt)continue;const item=items.find(r=>r.id===link.payload.item),space=spaces.find(r=>r.id===item?.payload.space);if(!space||!await canAdmin(env,s,'sharing-security',space.payload.owner||space.payload.createdBy))continue;const p=await creatorLinkPolicy(env,link.payload.custodian??link.payload.createdBy,space.id),reason=publicPolicyReason(p.rules,link.payload);if(reason)out.push({item:link.payload.item,principal:link.payload.audience==='guests'?(link.payload.guests??[]).join(', '):link.payload.domain??'Anyone with the link',by:link.payload.createdBy,reason,kind:'public-link',id:link.id})}
 return [...new Map(out.map(r=>[r.kind+':'+r.id+':'+r.principal,r])).values()]
}
export async function removeSuspendedGrant(env:Bindings,s:Session,input:any){
 const item=await get<Item>(env,'item',String(input.item)),space=await get<Space>(env,'space',item.payload.space);await requireAdmin(env,s,'sharing-security',space.payload.owner||space.payload.createdBy)
 insist((await suspendedGrants(env,s)).some(r=>r.kind==='grant'&&r.item===item.id&&r.principal===input.principal),'grant_not_suspended',409)
 await commit(env,s,[{row:next(item,{...item.payload,grants:item.payload.grants.filter(g=>g.principal!==input.principal)}),previous:item}],{fences:[space],changes:[{item:item.id,space:space.id,kind:'access'}],audits:[{action:'policy.grant.remove',object:item.id,detail:{principal:input.principal}}]})
 return {removed:true}
}
