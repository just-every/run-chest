import { editorObservation } from './editor-observation'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now, text, type Row } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
import { requireAdmin, canAdmin } from './roles'
import { reportScope, eventCondition } from './report-scope'
import { eventFilters, csvCell } from './reports'

export type EditorSettings={enabled:boolean;edition:'CODE'|'subscription';documents:number;connections:number;annualUsd:number;quote:string;updatedAt:string;updatedBy:string;codeAcknowledged:boolean;limitAuthority?:'administrator-recorded'}
const key='admin-editor-settings'
export const editorSettings=(env:Bindings)=>maybe<EditorSettings>(env,key,key)
export async function requireEditorEnabled(env:Bindings){const setting=await editorSettings(env);insist(setting?.payload.enabled,setting?'collabora_disabled':'editor_confirmation_required',409);return setting}
export const codeNotice='Collabora positions CODE for development and home use, not supported business production. A Collabora Online subscription adds vendor support and maintained releases as specified in your quote.'
export async function editorConfiguration(env:Bindings,s:Session){
 await requireAdmin(env,s,await canAdmin(env,s,'service-settings')?'service-settings':'audit-reporting')
 const row=await editorSettings(env)
 return {settings:row?.payload??null,observation:(await editorObservation(env))?.payload??null,notice:codeNotice,basis:'Owner-confirmed document and connection limits. A connection is an unexpired Chest editor session reservation, for at most 30 minutes. An acknowledged close releases the Chest reservation; a lost close waits for token expiry. This does not measure provider disconnection. Existing sessions continue after a lower limit or disabled new admissions.'}
}
export async function saveEditorConfiguration(env:Bindings,s:Session,input:any){
 await requireAdmin(env,s,'service-settings');insist(input.confirm===true,'editor_confirmation_required')
 insist(input.edition==='CODE'||input.edition==='subscription','invalid_editor_edition')
 const integer=(v:unknown)=>{const n=Number(v);insist(Number.isSafeInteger(n)&&n>0,'invalid_editor_capacity');return n}
 const annualUsd=Number(input.annualUsd);insist(Number.isFinite(annualUsd)&&annualUsd>=0,'invalid_editor_price')
 insist(input.edition!=='CODE'||annualUsd===0&&input.codeAcknowledged===true,'code_acknowledgement_required')
 const quote=text(input.quote,'editor_quote',300);insist(!/[<>\p{Cc}\p{Cf}]/u.test(quote),'invalid_editor_quote')
 const payload:EditorSettings={limitAuthority:'administrator-recorded',enabled:input.enabled===true,edition:input.edition,documents:integer(input.documents),connections:integer(input.connections),annualUsd,quote,codeAcknowledged:input.codeAcknowledged===true,updatedAt:now(),updatedBy:s.operator.email}
 const before=await editorSettings(env)
 await commit(env,s,[{row:before?next(before,payload):fresh(key,payload,key),previous:before??undefined}],{audits:[{action:'office.configuration.save',object:key,detail:{before:before?.payload??null,after:payload}}]})
 return editorConfiguration(env,s)
}
const live="kind='editor-session' AND json_extract(payload,'$.expires')>?"
export async function editorUsage(env:Bindings){
 return (await env.DB.prepare(`SELECT COUNT(*) connections,COUNT(DISTINCT json_extract(payload,'$.item')) documents FROM chest_records WHERE ${live}`).bind(Date.now()).first<{connections:number;documents:number}>())!
}
export class EditorCapacityRefusal extends ChestError{
 constructor(public limit:'connections'|'documents',public currentUse:number,public maximum:number,public preview:string){super('editor_capacity_reached',409)}
}
export async function admitEditor(env:Bindings,s:Session,item:string,session:Row,fences:Row[],version:string){
 const setting=await requireEditorEnabled(env)
 const config=setting.payload
 const preconditions=[{sql:`INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records WHERE ${live})<? AND ((SELECT COUNT(DISTINCT json_extract(payload,'$.item')) FROM chest_records WHERE ${live})<? OR EXISTS(SELECT 1 FROM chest_records WHERE ${live} AND json_extract(payload,'$.item')=?)) THEN 1 ELSE 0 END`,params:[Date.now(),config.connections,Date.now(),config.documents,Date.now(),item]}]
 try{await commit(env,s,[{row:session}],{fences:[...fences,setting],preconditions,audits:[{action:'office.collabora.open',object:item,detail:{session:session.id,version,edition:config.edition,limits:{documents:config.documents,connections:config.connections},quote:config.quote}}]})}
 catch(error){
  if(!String(error).includes('CHECK constraint failed'))throw error
  const use=await editorUsage(env),existing=await env.DB.prepare(`SELECT 1 FROM chest_records WHERE ${live} AND json_extract(payload,'$.item')=?`).bind(Date.now(),item).first()
  const limit=use.connections>=config.connections?'connections':!existing&&use.documents>=config.documents?'documents':null
  if(!limit)throw error
  await commit(env,s,[],{fences,audits:[{action:'office.capacity.refused',object:item,detail:{code:'editor_capacity_reached',limit,currentUse:use[limit],maximum:config[limit],edition:config.edition,quote:config.quote}}]})
  throw new EditorCapacityRefusal(limit,use[limit],config[limit],`/app/items/${item}`)
 }
}
export async function administrativeEditorReport(env:Bindings,s:Session,p:URLSearchParams){
 const scope=await reportScope(env,s,p.get('group')),fence=eventCondition(scope),dates=new URLSearchParams();for(const k of ['from','to'])if(p.get(k))dates.set(k,p.get(k)!)
 const f=eventFilters(dates),global=await canAdmin(env,s,'audit-reporting')
 const result=await env.DB.prepare(`SELECT id,object_id,at,detail FROM chest_audit a WHERE action IN ('office.capacity.refused','office.provider.refused') AND ${fence.sql}${f.conditions.length?' AND '+f.conditions.join(' AND '):''} ORDER BY at,id`).bind(...fence.params,...f.values).all<{id:string;object_id:string;at:string;detail:string}>()
 const admissions=await env.DB.prepare(`SELECT detail FROM chest_audit a WHERE action='office.collabora.open' AND ${fence.sql}`).bind(...fence.params).all<{detail:string}>()
 const admitted=new Set(admissions.results.map(r=>JSON.parse(r.detail).session))
 const rows=result.results.map(r=>{const d=JSON.parse(r.detail);return {receipt:r.id,session:d.session??null,reconciliation:d.source==='Browser-reported provider outcome'?(admitted.has(d.session)?'Matched Chest admission':'Admission unavailable'):'Chest admission refused',item:r.object_id,at:r.at,limit:d.limit,currentUse:d.currentUse,maximum:d.maximum??null,source:d.source??'Chest admission',code:d.code??'editor_capacity_reached'}})
 await commit(env,s,[],{audits:[{action:'admin.editor.read',object:'administration',detail:{count:rows.length}}]})
 return {providerCapacity:{documents:null,connections:null,licensedLimits:null},reconciliation:{matchedProviderOutcomes:rows.filter(r=>r.reconciliation==='Matched Chest admission').length,unmatchedProviderOutcomes:rows.filter(r=>r.reconciliation==='Admission unavailable').length},rows,refusals:rows.filter(r=>r.code==='editor_capacity_reached').length,providerRefusals:rows.filter(r=>r.source==='Browser-reported provider outcome').length,usage:scope.global?await editorUsage(env):null,configuration:global?(await editorSettings(env))?.payload??null:null,basis:'Current unexpired Chest session reservations and every recorded capacity refusal in the selected date and custody scope. Licensed limits are administrator-recorded from the quote, not independently verified. Provider-side live capacity is unknown. Each browser outcome names its Chest admission when available; historical outcomes without a session remain unmatched. Every Chest refusal is retained separately; browser reports cannot establish every provider refusal.'}
}
export async function administrativeEditorCsv(env:Bindings,s:Session,p:URLSearchParams){const d=await administrativeEditorReport(env,s,p);return new Response(['At,Item ID,Limit,Current use,Maximum,Source,Code,Receipt ID,Chest session,Reconciliation',...d.rows.map(r=>[r.at,r.item,r.limit,r.currentUse,r.maximum,r.source,r.code,r.receipt,r.session,r.reconciliation].map(csvCell).join(','))].join('\r\n')+'\r\n',{headers:{'content-type':'text/csv; charset=utf-8','cache-control':'no-store','content-disposition':'attachment; filename="chest-editor-capacity.csv"'}})}
