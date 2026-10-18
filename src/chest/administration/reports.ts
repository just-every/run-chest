import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { commit } from '../files/repo'
import { canAdmin,requireAdmin } from './roles'
// Administrative reporting has its own metadata-only door. It never joins file names or returns audit detail.
export async function administrativeAudit(env:Bindings,s:Session,params:URLSearchParams){
 const people=(await env.DB.prepare('SELECT email FROM oa_operators').all<{email:string}>()).results;let authorized=false
 for(const p of people)if(await canAdmin(env,s,'audit-reporting',p.email)){await requireAdmin(env,s,'audit-reporting',p.email);authorized=true;break}
 insist(authorized,'admin_required',403)
 const conditions=[],values:unknown[]=[]
 for(const [field,operator] of [['from','>='],['to','<=']] as const)if(params.get(field)){const time=Date.parse(params.get(field)!);insist(Number.isFinite(time),'invalid_date');conditions.push(`at${operator}?`);values.push(new Date(time).toISOString())}
 if(params.get('actor')){conditions.push('actor=?');values.push(params.get('actor'))}if(params.get('action')){conditions.push('action=?');values.push(params.get('action'))}
 const raw=(await env.DB.prepare(`SELECT id,actor,action,object_id,at,json_extract(detail,'$.outcome') AS outcome FROM chest_audit ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY at DESC,id DESC LIMIT 300`).bind(...values).all<{id:string;actor:string;action:string;object_id:string;at:string;outcome:string|null}>()).results,rows=[]
 for(const row of raw)if(await canAdmin(env,s,'audit-reporting',row.actor))rows.push({...row,outcome:row.outcome??'succeeded'})
 await commit(env,s,[],{audits:[{action:'admin.audit.read',object:'administration',detail:{count:rows.length}}]});return {rows,limited:raw.length===300}
}
export async function administrativeAuditCsv(env:Bindings,s:Session,params:URLSearchParams){const result=await administrativeAudit(env,s,params),cell=(v:unknown)=>{let text=String(v??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};return new Response(['At,Actor,Action,Object ID,Outcome',...result.rows.map(r=>[r.at,r.actor,r.action,r.object_id,r.outcome].map(cell).join(','))].join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="chest-administration.csv"','cache-control':'no-store'}})}
