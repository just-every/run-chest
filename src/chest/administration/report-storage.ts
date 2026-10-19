import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Space } from '../files/model'
import { list } from '../store'
import { commit } from '../files/repo'
import { effectiveQuota, quotaRules } from '../quota/rules'
import { contentCondition, reportScope } from './report-scope'
import { canAdmin } from './roles'
import { costSettings, storageEstimate } from './costs'
import { csvCell } from './reports'

type Totals = { retainedBytes: number; currentBytes: number; previousBytes: number; trashBytes: number; quarantineBytes: number }
type Area = Totals & { id: string; kind: string; owner: string | null; limitBytes: number | null }
const sum = `COALESCE(SUM(bytes),0) retainedBytes,COALESCE(SUM(CASE WHEN priority=0 THEN bytes ELSE 0 END),0) currentBytes,COALESCE(SUM(CASE WHEN priority=1 THEN bytes ELSE 0 END),0) previousBytes,COALESCE(SUM(CASE WHEN priority=2 THEN bytes ELSE 0 END),0) trashBytes,COALESCE(SUM(CASE WHEN priority=3 THEN bytes ELSE 0 END),0) quarantineBytes`
const basis = 'Retained original bytes, deduplicated by SHA-256. Each original is assigned once: live current, else live previous, else trash (including children of trashed folders), else quarantined/rejected request. Areas can share an original, so their totals must not be added to get the deduplicated total. Derived files, staging and backups are excluded. This is a current snapshot; activity date filters do not apply.'
export async function administrativeStorage(env: Bindings, s: Session, params: URLSearchParams) {
 const scope = await reportScope(env,s,params.get('group')), allowed = contentCondition(scope)
 const cte = `WITH RECURSIVE trashed(id) AS (
  SELECT id FROM chest_records WHERE kind='item' AND json_extract(payload,'$.trash') IS NOT NULL
  UNION SELECT r.id FROM chest_records r JOIN trashed t ON json_extract(r.payload,'$.parent')=t.id WHERE r.kind='item'
 ), refs AS (
  SELECT CASE WHEN r.kind='document' THEN 'library' ELSE json_extract(r.payload,'$.space') END area,
   json_extract(v.value,'$.checksum') checksum,json_extract(v.value,'$.size') bytes,
   CASE WHEN (r.kind='item' AND r.id IN (SELECT id FROM trashed)) OR (r.kind='document' AND json_extract(r.payload,'$.trash')=1) THEN 2
    WHEN json_extract(v.value,'$.id')=COALESCE(json_extract(r.payload,'$.current'),json_extract(r.payload,'$.approved'),json_extract(r.payload,'$.versions[#-1].id')) THEN 0 ELSE 1 END priority
  FROM chest_records r,json_each(r.payload,'$.versions') v WHERE r.kind IN ('item','document') AND ${allowed.sql}
  UNION ALL SELECT json_extract(r.payload,'$.space'),json_extract(f.value,'$.version.checksum'),json_extract(f.value,'$.version.size'),3
  FROM chest_records r,json_each(r.payload,'$.files') f WHERE r.kind='request-submission' AND json_extract(r.payload,'$.status') IN ('quarantined','rejected') AND ${allowed.sql}
 )`
 const paramsSql = [...allowed.params,...allowed.params]
 const [areas,total] = await Promise.all([
  env.DB.prepare(`${cte} SELECT area,${sum} FROM (SELECT area,checksum,MAX(bytes) bytes,MIN(priority) priority FROM refs GROUP BY area,checksum) GROUP BY area ORDER BY area`).bind(...paramsSql).all<Totals & {area:string}>(),
  env.DB.prepare(`${cte} SELECT ${sum} FROM (SELECT checksum,MAX(bytes) bytes,MIN(priority) priority FROM refs GROUP BY checksum)`).bind(...paramsSql).first<Totals>(),
 ])
 const state = await quotaRules(env), spaces = await list<Space>(env,'space')
 const rows: Area[] = areas.results.map(area=>{
  const space=spaces.find(r=>r.id===area.area)
  return { id:area.area,kind:space?.payload.kind??'library',owner:space?.payload.owner||space?.payload.createdBy||null,limitBytes:space?effectiveQuota(space,state.rules,state.groups).limitBytes:null,retainedBytes:area.retainedBytes,currentBytes:area.currentBytes,previousBytes:area.previousBytes,trashBytes:area.trashBytes,quarantineBytes:area.quarantineBytes }
 })
 // Empty spaces still have reportable limits and must not disappear from capacity reports.
 for(const space of spaces) if(!rows.some(r=>r.id===space.id)){
  const owner=space.payload.formerOwner??(space.payload.owner||space.payload.createdBy)
  if(scope.global||scope.emails.includes(owner))rows.push({id:space.id,kind:space.payload.kind,owner,limitBytes:effectiveQuota(space,state.rules,state.groups).limitBytes,retainedBytes:0,currentBytes:0,previousBytes:0,trashBytes:0,quarantineBytes:0})
 }
 let costs=null
 if(await canAdmin(env,s,'audit-reporting')){const settings=await costSettings(env,s);costs={...settings,estimate:storageEstimate(total!.retainedBytes,settings.rates)}}
 await commit(env,s,[],{audits:[{action:'admin.storage.read',object:'administration',detail:{areas:rows.length}}]})
 return { rows:rows.sort((a,b)=>a.id.localeCompare(b.id)),total:total!,basis,costs,asOf:new Date().toISOString(),groups:scope.groups }
}
export async function administrativeStorageCsv(env:Bindings,s:Session,params:URLSearchParams){
 const d=await administrativeStorage(env,s,params)
 const headers=['Area ID','Kind','Custodian','Retained bytes','Current bytes','Previous bytes','Trash bytes','Quarantine bytes','Limit bytes'],rows=d.rows.map(r=>[r.id,r.kind,r.owner,r.retainedBytes,r.currentBytes,r.previousBytes,r.trashBytes,r.quarantineBytes,r.limitBytes??'unlimited'])
 rows.push(['DEDUPLICATED TOTAL','all','',d.total.retainedBytes,d.total.currentBytes,d.total.previousBytes,d.total.trashBytes,d.total.quarantineBytes,''])
 return new Response([headers.join(','),...rows.map(r=>r.map(csvCell).join(','))].join('\r\n')+'\r\n',{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="chest-storage.csv"','cache-control':'no-store','x-content-type-options':'nosniff'}})
}
