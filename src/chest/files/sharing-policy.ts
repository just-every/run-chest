import type { Bindings } from '../../auth.server'
import { list } from '../store'
import { ChestError, insist, type Group, type Row } from '../model'
import type { Ctx, Who } from './access'
import type { Grant, Item, PublicLink, Space } from './model'
import { effectiveLinkPolicy, type LinkPolicy } from './link-policy'

export class SharingConfirmation extends ChestError { constructor(public recipients:string[]){super('sharing_policy_external_confirmation_required',409)} }

export function externalReason(p:LinkPolicy, audience:string, recipients:string[]=[]):string|null {
 if(p.allowExternal===false)return 'sharing_policy_external_disabled'
 if(audience==='public' || audience==='request')return !p.allowPublic || p.trustedDomains!==undefined && p.trustedDomains!==null?'sharing_policy_public_disabled':null
 if(p.trustedDomains && recipients.some(e=>!p.trustedDomains!.includes(e.includes('@')?e.split('@')[1]:e)))return 'sharing_policy_domain_not_trusted'
 return null
}
export function publicPolicyReason(p:LinkPolicy,l:Pick<PublicLink,'audience'|'guests'|'domain'>) {
 return externalReason(p,l.audience??'public',l.audience==='guests'?l.guests:l.audience==='domain'?[l.domain!]:[]) || (p.allowNonMembers===false?'sharing_policy_non_members_disabled':null)
}
export async function sharePolicy(env:Bindings,w:Who,ctx:Ctx,emails:string[],input:any,audience='named') {
 const policy=await effectiveLinkPolicy(env,w,ctx.space.id),p=policy.rules
 insist(p.allowEditors || ctx.state.manager,'sharing_policy_managers_only',403)
 const external=audience==='named'?emails.filter(e=>!p.organizationDomains.includes(e.split('@')[1])):emails
 const reason=audience==='named'&&!external.length?null:audience==='organisation'||audience==='restricted'?null:externalReason(p,audience,external)
 insist(!reason,reason??'sharing_policy_refused',403)
 if(ctx.space.payload.kind==='team' && !p.allowNonMembers){
  insist(!['public','guests','domain','request'].includes(audience),'sharing_policy_non_members_disabled',403)
  for(const email of emails){const groups=(await list<Group>(env,'group')).filter(g=>g.payload.members.includes(email));insist(ctx.space.payload.members.some(g=>(g.principal===email||groups.some(r=>r.id===g.principal))&&(!g.expires||Date.parse(g.expires)>Date.now())),'sharing_policy_non_members_disabled',403);policy.fences.push(...groups as any)}
 }
 if(p.warnExternal && external.length && input.confirmExternal!==true)throw new SharingConfirmation(external)
 return policy
}
const member=(space:Space,email:string,groups:Row<Group>[])=>space.kind==='personal'?email===space.owner:space.members.some(g=>(g.principal===email||groups.some(r=>r.id===g.principal&&r.payload.members.includes(email)))&&(!g.expires||Date.parse(g.expires)>Date.now()))
const manager=(space:Space,email:string,groups:Row<Group>[])=>space.kind==='personal'?email===space.owner:space.members.some(g=>g.role==='manager'&&(g.principal===email||groups.some(r=>r.id===g.principal&&r.payload.members.includes(email)))&&(!g.expires||Date.parse(g.expires)>Date.now()))
// Filter a recipient's effective grants, never the stored definitions. Tightening is immediately reversible;
// the unmodified records and policy rows remain revision fences on mutations.
export async function policyItems(env:Bindings,w:Who,spaces:Row<Space>[],items:Row<Item>[]) {
 const groups=await list<Group>(env,'group'),cache=new Map<string,Awaited<ReturnType<typeof effectiveLinkPolicy>>>(),fences:Row[]=[...groups]
 const policy=async(by:string,space:Row<Space>)=>{const id=by+':'+space.id;let p=cache.get(id);if(!p){p=await effectiveLinkPolicy(env,{groups:groups.filter(g=>g.payload.members.includes(by))},space.id);cache.set(id,p);fences.push(...p.fences)}return p.rules}
 const output:Row<Item>[]=[]
 for(const row of items){const space=spaces.find(s=>s.id===row.payload.space);if(!space){output.push(row);continue}const grants:Grant[]=[]
  for(const grant of row.payload.grants){if(!w.principals.includes(grant.principal)){grants.push(grant);continue}const p=await policy(grant.by,space),external=!(p.organizationDomains??[String(env.OWNER_EMAIL).split('@')[1]]).includes(w.email.split('@')[1]);if(p.allowEditors===false&&!manager(space.payload,grant.by,groups)||p.allowNonMembers===false&&space.payload.kind==='team'&&!member(space.payload,w.email,groups)||external&&externalReason(p,'named',[w.email]))continue;grants.push(grant)}
  output.push({...row,payload:{...row.payload,grants}})
 }
 return {items:output,fences}
}
