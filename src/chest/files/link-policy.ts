import { canAdmin,canAdminGroup,requireAdmin,requireAdminGroup,isAdministrator } from '../administration/roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { suspendedGrants } from './policy-suspensions'
import { list } from '../store'
import { insist, type Group, type Row } from '../model'
import { commit, fresh, maybe, next } from './repo'
import type { Who } from './access'
import type { Link, Space } from './model'
export type LinkPolicy = { allowPublic: boolean; allowOrganisation: boolean; allowDiscovery: boolean; defaultAudience: 'restricted'|'organisation'|'public'; defaultRole: 'viewer'|'commenter'|'editor'; allowExternal?: boolean; allowNonMembers?: boolean; allowEditors?: boolean; warnExternal?: boolean; trustedDomains?: string[] | null; organizationDomains?: string[] }
const defaults: LinkPolicy = { allowPublic: true, allowOrganisation: true, allowDiscovery: true, defaultAudience: 'organisation', defaultRole: 'viewer' }
const order = { restricted: 0, organisation: 1, public: 2 }, ranks = { viewer: 0, commenter: 1, editor: 2 }
const key = (scope: string) => `link-policy:${scope}`
// The most restrictive organization, space and creator-group rule wins. Defaults are read only at creation;
// the permission switches are read on every subsequent request, including already-issued original URLs.
export async function effectiveLinkPolicy(env: Bindings, w: Pick<Who,'groups'>, space: string) {
 const scopes = ['organisation', `space:${space}`, ...w.groups.map(g => `group:${g.id}`)], records = (await Promise.all(scopes.map(scope => maybe<LinkPolicy>(env, 'link-policy', key(scope))))).filter((r): r is Row<LinkPolicy> => !!r)
 const spaceRow=await maybe<Space>(env,'space',space)
 const base = records.find(r => r.id === key('organisation'))?.payload ?? defaults
 const result = { allowExternal:true, allowNonMembers:true, allowEditors:true, warnExternal:false, trustedDomains:null as string[]|null, organizationDomains: [String(env.OWNER_EMAIL).split('@')[1]], ...base }
 const overrides=records.filter(r => r.id !== key('organisation'))
 if(overrides.length){result.defaultAudience=overrides[0].payload.defaultAudience;result.defaultRole=overrides[0].payload.defaultRole}
 for (const row of overrides) {
  for(const flag of ['allowExternal','allowNonMembers','allowEditors'] as const)result[flag] &&= row.payload[flag]!==false
  result.warnExternal ||= row.payload.warnExternal===true
  if(row.payload.trustedDomains)result.trustedDomains=result.trustedDomains===null?row.payload.trustedDomains:result.trustedDomains.filter(d=>row.payload.trustedDomains!.includes(d))
  for (const flag of ['allowPublic','allowOrganisation','allowDiscovery'] as const) result[flag] &&= row.payload[flag]
  if (order[row.payload.defaultAudience] < order[result.defaultAudience]) result.defaultAudience = row.payload.defaultAudience
  if (ranks[row.payload.defaultRole] < ranks[result.defaultRole]) result.defaultRole = row.payload.defaultRole
 }
 if(spaceRow?.payload.kind==='team'){
  const settings=spaceRow.payload.settings
  result.allowExternal &&= settings.externalAccess!==false
  result.allowNonMembers &&= settings.nonMemberAccess!==false
  result.allowPublic &&= result.allowExternal && result.allowNonMembers
  if(settings.defaultLinkAudience && (!overrides.length || order[settings.defaultLinkAudience]<order[result.defaultAudience]))result.defaultAudience=settings.defaultLinkAudience
 }
 if(spaceRow?.payload.kind==='personal')result.allowNonMembers=true
 if (result.defaultAudience === 'public' && !result.allowPublic || result.defaultAudience === 'organisation' && !result.allowOrganisation) result.defaultAudience = 'restricted'
 return { rules: result, fences: [...records,...(spaceRow?[spaceRow]:[])] }
}
export async function creatorLinkPolicy(env: Bindings, email: string, space: string) {
 const groups = (await list<Group>(env, 'group')).filter(g => g.payload.members.includes(email))
 return effectiveLinkPolicy(env, { groups }, space)
}
export function demandLinkPolicy(p: LinkPolicy, audience: string, discoverable = false) {
 insist(audience === 'public' ? p.allowPublic : audience === 'organisation' ? p.allowOrganisation && (!discoverable || p.allowDiscovery) : audience === 'restricted', 'link_policy_refused', 403)
}
export async function permittedLinks(env: Bindings, links: Row<Link>[], itemSpaces: Map<string,string>, viewer?:Who) {
 const groups = await list<Group>(env, 'group'), records = await list<LinkPolicy>(env, 'link-policy')
 const kept: Row<Link>[] = [], policies = new Map<string, LinkPolicy>()
 for (const link of links) {
  if(link.payload.limit!=null&&(link.payload.downloads??0)>=link.payload.limit)continue
  if(link.payload.password&&!viewer?.linkSessions?.some(r=>r.payload.link===link.id&&r.payload.passwordHash===link.payload.password?.hash))continue
  if (link.payload.audience !== 'organisation' || link.payload.expires && Date.parse(link.payload.expires)<=Date.now()) continue
  const space = itemSpaces.get(link.payload.item);if(!space)continue
  const cacheKey = `${link.payload.createdBy}:${space}`
  let rules = policies.get(cacheKey)
  if(!rules){
   const applicable = records.filter(r => r.id === key('organisation') || r.id === key(`space:${space}`) || groups.some(g => g.payload.members.includes(link.payload.createdBy) && r.id === key(`group:${g.id}`)))
   rules = {...defaults}
   for(const row of applicable)for(const flag of ['allowPublic','allowOrganisation','allowDiscovery'] as const)rules[flag] &&= row.payload[flag]
   policies.set(cacheKey,rules)
  }
  const effective=await creatorLinkPolicy(env,link.payload.createdBy,space),team=await maybe<Space>(env,'space',space)
  const member=viewer && team?.payload.members.some(g=>viewer.principals.includes(g.principal)&&(!g.expires||Date.parse(g.expires)>Date.now()))
  const creatorGroups=groups.filter(g=>g.payload.members.includes(link.payload.createdBy)),manager=team?.payload.kind==='personal'?team.payload.owner===link.payload.createdBy:team?.payload.members.some(g=>g.role==='manager'&&(g.principal===link.payload.createdBy||creatorGroups.some(r=>r.id===g.principal)))
  if (rules.allowOrganisation && (!link.payload.discoverable || rules.allowDiscovery) && (effective.rules.allowNonMembers || team?.payload.kind!=='team' || member) && (effective.rules.allowEditors || manager)) kept.push(link)
 }
 return kept
}
export async function linkPolicies(env: Bindings, s: Session) {
 insist(await isAdministrator(env,s), 'admin_required', 403)
 const spaces = (await list<Space>(env,'space')).filter(s=>s.payload.kind==='team'), groups = await list<Group>(env,'group'), rows = await list<LinkPolicy>(env,'link-policy')
 const scopes:{id:string;label:string}[]=[];if(await canAdmin(env,s,'sharing-security'))scopes.push({id:'organisation',label:'Whole organization'});for(const space of spaces)if(await canAdmin(env,s,'sharing-security',space.payload.owner||space.payload.createdBy))scopes.push({id:`space:${space.id}`,label:`Space · ${s.operator.role==='owner'?space.payload.name:space.id}`});for(const g of groups)if(await canAdminGroup(env,s,'sharing-security',g.id))scopes.push({id:`group:${g.id}`,label:`Group · ${g.payload.name}`});insist(scopes.length,'admin_required',403)
 return { suspended:await suspendedGrants(env,s), organizationDomains:[String(env.OWNER_EMAIL).split('@')[1]], scopes, rows: scopes.map(scope=>({ ...scope, rules: rows.find(r=>r.id===key(scope.id))?.payload ?? null })), defaults: rows.find(r=>r.id===key('organisation'))?.payload ?? defaults }
}
export async function saveLinkPolicy(env: Bindings, s: Session, input: any) {
 const view = await linkPolicies(env,s), scope = view.scopes.find(v=>v.id===input.scope);insist(scope,'invalid_policy_scope')
 if(scope.id.startsWith('group:'))await requireAdminGroup(env,s,'sharing-security',scope.id.slice(6));else if(scope.id.startsWith('space:')){const space=await maybe<Space>(env,'space',scope.id.slice(6));insist(space,'not_found',404);await requireAdmin(env,s,'sharing-security',space.payload.owner||space.payload.createdBy)}else await requireAdmin(env,s,'sharing-security')
 const old = await maybe<LinkPolicy>(env,'link-policy',key(scope.id))
 if (input.remove === true && scope.id !== 'organisation') { if(old)await commit(env,s,[{row:old,previous:old,remove:true}],{audits:[{action:'policy.links',object:key(scope.id),detail:{before:old.payload,after:null}}]});return {removed:true} }
 for(const flag of ['allowPublic','allowOrganisation','allowDiscovery'])insist(typeof input[flag]==='boolean','invalid_policy')
 insist(['restricted','organisation','public'].includes(input.defaultAudience) && ['viewer','commenter','editor'].includes(input.defaultRole),'invalid_policy')
 const extra:Partial<LinkPolicy>={}
 for(const flag of ['allowExternal','allowNonMembers','allowEditors','warnExternal'] as const){if(input[flag]!==undefined){insist(typeof input[flag]==='boolean','invalid_policy');extra[flag]=input[flag]}}
 for(const field of ['trustedDomains','organizationDomains'] as const)if(input[field]!==undefined){const values=input[field]===null?null:(Array.isArray(input[field])?input[field]:String(input[field]).split(/[;,\s]+/)).map((v:unknown)=>String(v).trim().toLowerCase()).filter(Boolean);insist(values===null&&field==='trustedDomains'||Array.isArray(values)&&values.length<=100&&values.every((d:string)=>/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)),'invalid_policy_domain');if(field==='organizationDomains'){insist(scope.id==='organisation'&&values?.length,'organization_domains_required');extra.organizationDomains=values!}else extra.trustedDomains=values}
 const payload: LinkPolicy = {...old?.payload,...extra,allowPublic:input.allowPublic,allowOrganisation:input.allowOrganisation,allowDiscovery:input.allowDiscovery,defaultAudience:input.defaultAudience,defaultRole:input.defaultRole}
 demandLinkPolicy(payload,payload.defaultAudience)
 const row=old?next(old,payload):fresh('link-policy',payload,key(scope.id))
 await commit(env,s,[{row,...(old?{previous:old}:{})}],{audits:[{action:'policy.links',object:key(scope.id),detail:{scope:scope.label,before:old?.payload ?? null,after:payload}}]})
 return payload
}
