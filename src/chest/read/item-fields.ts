import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, type Schema } from '../model'
import { get } from '../store'
import { context, demand, type Who } from '../files/access'
import { effectiveGovernance } from '../files/folder-metadata'
import { fieldIssues } from '../fields'
import { commit, maybe, next } from '../files/repo'
import { readingId, type Reading } from './jobs'
import { decidedValue, emptyValue } from './field-values'

export async function decideItemField(env: Bindings, s: Session, w: Who, key: string, version: string, input: any) {
 const ctx = await context(env,w,key); demand(ctx,'contribute')
 const item = ctx.chain.at(-1)!, r = await maybe<Reading>(env,'reading',readingId(key,version))
 insist(r?.payload.state === 'done', 'reading_not_found',404)
 const proposal = r.payload.proposals.find(p => p.field === input.field); insist(proposal,'field_not_found',404); insist(!proposal.decision,'already_decided',409)
 const schemaId = effectiveGovernance(ctx,item.payload)?.schema ?? item.payload.filing?.schema
 insist(schemaId && schemaId === r.payload.schema, 'reading_type_changed',409)
 const schema = await get<Schema>(env,'schema',schemaId); insist(schema.revision === r.payload.schemaRevision,'reading_type_changed',409)
 const field = schema.payload.fields.find(f => f.name === proposal.field); insist(field,'field_not_in_type',409)
 const v = item.payload.versions.find(v => v.id === version); insist(v?.checksum === r.payload.checksum,'reading_version_changed',409)
 insist(input.decision === 'accept' || input.decision === 'reject','invalid_decision')
 const at = now(), detail = {version,field:field.name,page:proposal.page,box:proposal.box,reader:r.payload.model,confidence:proposal.confidence}, fields = item.payload.filing?.fields ?? {}
 const reject = input.decision === 'reject'
 // An old scan may be inspected, but cannot write values into a newer original or a different type.
 if (!reject) {
  insist(item.payload.versions.at(-1)?.id === version,'reading_version_changed',409)
  insist(emptyValue(fields[field.name]),'field_has_value',409)
  insist(proposal.found || !emptyValue(input.value),'nothing_to_accept',409)
 }
 const corrected = !emptyValue(input.value) && String(input.value).trim() !== String(proposal.value ?? ''), value = reject ? null : decidedValue(schema.payload.name,field,corrected ? input.value : proposal.value), status = reject ? 'rejected' as const : corrected ? 'corrected' as const : 'accepted' as const
 const done = next(r,{...r.payload,proposals:r.payload.proposals.map(p => p.field === field.name ? {...p,decision:{status,value,by:s.operator.email,at}} : p),updatedAt:at})
 const writes: any[] = [{row:done,previous:r}]
 if (!reject) {
  const updated = {...fields,[field.name]:value}, issues = fieldIssues({...schema.payload,fields:schema.payload.fields.map(f => ({...f,required:false}))},updated)
  insist(!issues.length,issues[0]?.code || 'invalid_field_value')
  writes.push({row:next(item,{...item.payload,filing:{schema:schemaId,owner:item.payload.filing?.owner ?? s.operator.email,fields:updated},updatedAt:at}),previous:item})
 }
 await commit(env,s,writes,{fences:[...ctx.fences,schema,item],changes:reject ? [] : [{item:key,space:item.payload.space,kind:'metadata'}],audits:[{action:reject ? 'field.reject' : corrected ? 'field.correct' : 'field.accept',object:key,detail:{...detail,...(reject ? {} : {value})}}]})
 return {field:field.name,status,...(reject ? {} : {value})}
}
