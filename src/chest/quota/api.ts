import { canAdmin, canAdminGroup, requireAdmin, requireAdminGroup, requireAnyAdmin } from '../administration/roles'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { insist, type Person, type Group, type Row } from '../model'
import { commit, fresh, maybe, next, type Op } from '../files/repo'
import { personalId, type Space } from '../files/model'
import { storage, storageView } from './storage'
import { effectiveQuota, quotaRules, ruleId, type QuotaRule } from './rules'
import { QuotaConfirmation } from './errors'

export async function quotaView(env: Bindings, s: Session, key: string) {
 const row = (await areas(env)).find(r=>r.id===key);insist(row,'not_found',404); await requireAdmin(env,s,'service-settings',row.payload.owner||row.payload.createdBy)
 return { name:s.operator.role==='owner'?row.payload.name:row.id, kind:row.payload.kind, owner:row.payload.owner, ...await storageView(env,row) }
}
async function areas(env: Bindings) {
 const spaces=await list<Space>(env,'space'), people=await list<Person>(env,'person')
 for(const p of people) if(!spaces.some(s=>s.id===personalId(p.id))) spaces.push(fresh<Space>('space',{name:'My files',kind:'personal',owner:p.id,members:[],settings:{noDownload:false,editorSharing:true},createdBy:p.id,createdAt:''},personalId(p.id)))
 return spaces
}
export async function quotas(env: Bindings, s: Session) {
 const rows=[],global=await canAdmin(env,s,'service-settings'),state=await quotaRules(env)
 for(const row of await areas(env)) if(global||await canAdmin(env,s,'service-settings',row.payload.owner||row.payload.createdBy)) rows.push({name:s.operator.role==='owner'?row.payload.name:row.id,kind:row.payload.kind,owner:row.payload.owner,...await storageView(env,row,state)})
 insist(rows.length||await canAdmin(env,s,'service-settings'),'admin_required',403);return rows
}
export async function quotaPolicyView(env: Bindings,s: Session) {
 await requireAnyAdmin(env,s,'service-settings')
 const organizationAllowed=await canAdmin(env,s,'service-settings'),state=await quotaRules(env),groups:Row<Group>[]=[],people:Row<Person>[]=[]
 for(const group of state.groups) if(organizationAllowed||await canAdminGroup(env,s,'service-settings',group.id)) groups.push(group)
 for(const person of await list<Person>(env,'person')) if(organizationAllowed||await canAdmin(env,s,'service-settings',person.id)) people.push(person)
 const rules=state.rules.filter(r=>organizationAllowed||r.payload.scope==='group'&&groups.some(g=>g.id===r.payload.target)||r.payload.scope==='user'&&people.some(p=>p.id===r.payload.target))
 return {organizationAllowed,rows:await quotas(env,s),rules,groups,people}
}
async function fingerprint(value: unknown) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function saveQuotaPolicy(env: Bindings,s: Session,input: any) {
 const {scope}=input,target=typeof input.target==='string'?input.target:'',limit=input.limitBytes
 insist(['personal-default','space-default','group','user','space'].includes(scope),'invalid_quota_scope')
 insist(limit===null||Number.isSafeInteger(limit)&&limit>=0,'invalid_storage_limit')
 if(scope==='group') await requireAdminGroup(env,s,'service-settings',target)
 else if(scope==='user'){await get(env,'person',target);await requireAdmin(env,s,'service-settings',target)}
 else if(scope==='space'){const space=await get<Space>(env,'space',target);await requireAdmin(env,s,'service-settings',space.payload.owner||space.payload.createdBy)}
 else await requireAdmin(env,s,'service-settings')
 const kinds="'space','item','request-submission','quota-rule','group','person'",read=(await env.DB.prepare(`SELECT id,kind,revision FROM chest_records WHERE kind IN (${kinds}) ORDER BY id`).all()).results
 const all=await areas(env),state=await quotaRules(env),ops:Op[]=[],changedId=scope==='space'?target:ruleId(scope,target)
 let before: unknown=null
 if(scope==='space') {
  const old=await get<Space>(env,'space',target);before={storageLimitBytes:old.payload.storageLimitBytes??null,storageLimitOverride:old.payload.storageLimitOverride??false}
  ops.push({row:next(old,{...old.payload,storageLimitBytes:limit,storageLimitOverride:true}),previous:old})
 } else {
  const old=await maybe<QuotaRule>(env,'quota-rule',changedId),payload={scope,target:target||undefined,limitBytes:limit} as QuotaRule;before=old?.payload??null
  ops.push({row:old?next(old,payload):fresh('quota-rule',payload,changedId),previous:old??undefined})
 }
 const proposed=state.rules.filter(r=>r.id!==changedId);if(scope!=='space')proposed.push(ops[0].row)
 const affected=[]
 for(const area of all){
  const updated=scope==='space'&&area.id===target?ops[0].row:area,oldLimit=effectiveQuota(area,state.rules,state.groups).limitBytes,q=effectiveQuota(updated,proposed,state.groups)
  if(q.limitBytes===null||oldLimit!==null&&q.limitBytes>=oldLimit)continue
  const usedBytes=(await storage(env,area.id)).usedBytes
  if(usedBytes>q.limitBytes) affected.push({id:area.id,name:s.operator.role==='owner'?area.payload.name:area.id,owner:area.payload.owner,...q,usedBytes})
 }
 const confirmation=await fingerprint({scope,target,limit,before,affected})
 if(affected.length && (input.confirmOverLimit!==true||input.confirmation!==confirmation)) throw new QuotaConfirmation(affected,confirmation)
 // Fence the preview's complete read set: an upload, new area or changed group cannot slip into a confirmed save.
 const predicate={sql:`INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records WHERE kind IN (${kinds}))=? AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE r.kind IN (${kinds}) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND r.kind=json_extract(j.value,'$.kind') AND r.revision=json_extract(j.value,'$.revision'))) THEN 1 ELSE 0 END`,params:[read.length,JSON.stringify(read)]}
 await commit(env,s,ops,{preconditions:[predicate],audits:[{action:scope==='space'?'space.quota':'quota.policy',object:changedId,detail:{scope,target,before,after:ops[0].row.payload,confirmedOverLimit:affected}}]})
 return quotaPolicyView(env,s)
}
export async function setQuota(env: Bindings,s: Session,key: string,input: any) {
 const area=(await areas(env)).find(r=>r.id===key);insist(area,'not_found',404)
 await saveQuotaPolicy(env,s,{...input,scope:area.payload.kind==='personal'?'user':'space',target:area.payload.kind==='personal'?area.payload.owner:key,limitBytes:input.storageLimitBytes})
 return quotaView(env,s,key)
}
// SPACE-002's settings door changes the same per-space limit and uses the same confirmation contract.
export async function confirmSpaceLimit(env: Bindings,s: Session,space: Row<Space>,updated: Row<Space>,input: any) {
 const reads=(await env.DB.prepare("SELECT id,revision FROM chest_records WHERE kind IN ('space','item','request-submission','quota-rule','group') ORDER BY id").all()).results
 const state=await quotaRules(env),before=effectiveQuota(space,state.rules,state.groups),after=effectiveQuota(updated,state.rules,state.groups),usedBytes=(await storageView(env,space)).usedBytes
 const affected=after.limitBytes!==null&&(before.limitBytes===null||after.limitBytes<before.limitBytes)&&usedBytes>after.limitBytes?[{id:space.id,name:s.operator.role==='owner'?space.payload.name:space.id,owner:space.payload.owner,...after,usedBytes}]:[]
 const confirmation=await fingerprint({space:space.id,before,after,affected})
 if(affected.length&&(input.confirmOverLimit!==true||input.confirmation!==confirmation))throw new QuotaConfirmation(affected,confirmation)
 return [{sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records WHERE kind IN ('space','item','request-submission','quota-rule','group'))=? AND NOT EXISTS(SELECT 1 FROM chest_records r WHERE r.kind IN ('space','item','request-submission','quota-rule','group') AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND r.revision=json_extract(j.value,'$.revision'))) THEN 1 ELSE 0 END",params:[reads.length,JSON.stringify(reads)]}]
}
