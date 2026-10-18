import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, type Group, type Row } from '../model'
import { get, list } from '../store'
import { commit, next } from '../files/repo'
import { canAdmin, canAdminGroup, requireAdmin } from '../administration/roles'
import { registerClient } from './clients'
import { savePolicy } from './policy'
import { revokeGrant } from './auth'
import { replayDelivery } from './webhooks'
import type { Client, Grant, Subscription, Delivery, AppPolicy } from './model'
export async function management(env: Bindings,s: Session) {
 const admin=await canAdmin(env,s,'sharing-security'),groups=await list<Group>(env,'group'),adminGroups:Row<Group>[]=[];for(const group of groups)if(await canAdminGroup(env,s,'sharing-security',group.id))adminGroups.push(group);const managedUsers=new Set(adminGroups.flatMap(g=>g.payload.members)),clients=await list<Client>(env,'integration-client'),grants=await list<Grant>(env,'integration-grant'),own=grants.filter(g=>admin||managedUsers.has(g.payload.user)||g.payload.user===s.operator.email),visible=new Set(own.map(g=>g.payload.client))
 return {admin:admin||adminGroups.length>0,organizationAdmin:admin,adminGroups,clients:clients.filter(c=>admin||adminGroups.length>0||c.payload.owner===s.operator.email||visible.has(c.id)),grants:own,policies:(await list<AppPolicy>(env,'integration-policy')).filter(p=>admin||p.payload.scope==='organization'||adminGroups.some(g=>g.id===p.payload.group)),subscriptions:(await list<Subscription>(env,'integration-subscription')).filter(h=>h.payload.owner===s.operator.email),deliveries:await deliveriesFor(env,s)}
}
async function deliveriesFor(env: Bindings,s: Session) {const ids=new Set((await list<Subscription>(env,'integration-subscription')).filter(h=>h.payload.owner===s.operator.email).map(h=>h.id));return (await list<Delivery>(env,'integration-delivery')).filter(d=>ids.has(d.payload.subscription)).sort((a,b)=>b.payload.at.localeCompare(a.payload.at)).slice(0,100)}
export async function integrationsExecute(env: Bindings,_request: Request,s: Session,method: string,parts: string[],input: any,_url: URL): Promise<unknown> {
 if(parts[0]!=='integrations'||parts[1]==='v1')return undefined
 const [,head,key,verb]=parts
 if(method==='GET'&&!head)return management(env,s)
 if(method==='POST'&&head==='clients'&&!key)return registerClient(env,s,input)
 if(method==='POST'&&head==='policy')return savePolicy(env,s,input)
 if(method==='POST'&&head==='grants'&&key&&verb==='revoke')return revokeGrant(env,s,key)
 if(method==='POST'&&head==='clients'&&key&&verb==='revoke'){const row=await get<Client>(env,'integration-client',key);if(row.payload.owner!==s.operator.email)await requireAdmin(env,s,'sharing-security');await commit(env,s,[{row:next(row,{...row.payload,revokedAt:now()}),previous:row}],{audits:[{action:'integration.client.revoke',object:key}]});return {revoked:key}}
 if(method==='POST'&&head==='webhooks'&&key&&verb==='replay')return replayDelivery(env,s,key)
 if(method==='POST'&&head==='webhooks'&&key&&verb==='revoke'){const row=await get<Subscription>(env,'integration-subscription',key);insist(row.payload.owner===s.operator.email,'not_found',404);await commit(env,s,[{row:next(row,{...row.payload,revokedAt:now()}),previous:row}],{audits:[{action:'integration.webhook.revoke',object:key}]});return {revoked:key}}
 insist(false,'not_found',404)
}
