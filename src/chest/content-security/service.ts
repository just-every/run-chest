import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, type Row } from '../model'
import { list } from '../store'
import { requireAdmin, canAdmin } from '../administration/roles'
import { policy, rules, savePolicy, saveRule, ownerOnly } from './policy'
import { scanUpload, releaseScan, type Scan } from './scan'
import { resumeActivity } from './activity'
export async function securityView(env:Bindings,s:Session) {
 const owner=!!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active'").bind(s.operator.id).first(),scans:Row<Scan>[]=[]
 // Security administration grants metadata-only activity access, never file names or quarantined contents.
 const all=(await env.DB.prepare('SELECT * FROM chest_activity_alerts ORDER BY at DESC LIMIT 500').all<any>()).results,alerts=[],pauses=[]
 for(const a of all)if(await canAdmin(env,s,'sharing-security',a.actor))alerts.push({...a,detail:JSON.parse(a.detail)})
 for(const a of (await env.DB.prepare('SELECT * FROM chest_activity_pauses ORDER BY at DESC').all<any>()).results)if(await canAdmin(env,s,'sharing-security',a.actor))pauses.push(a)
 if(owner)scans.push(...await list<Scan>(env,'content-scan'))
 else insist(alerts.length||pauses.length||await canAdmin(env,s,'sharing-security'),'admin_required',403)
 return {owner,policy:owner?await policy(env):null,configured:owner?!!(env.CONTENT_SCANNER_URL&&env.CONTENT_SCANNER_TOKEN):false,rules:await rules(env,s.operator.email),scans,alerts,pauses}
}
export async function contentExecute(env:Bindings,s:Session,method:string,parts:string[],input:any) {
 if(parts[0]!=='content-security')return undefined
 if(method==='GET'&&!parts[1])return securityView(env,s)
 insist(method==='POST','method_not_allowed',405)
 if(parts[1]==='policy')return savePolicy(env,s,input)
 if(parts[1]==='rule')return saveRule(env,s,input)
 if(parts[1]==='resume')return resumeActivity(env,s,String(input.subject),input)
 if(parts[1]==='release')return releaseScan(env,s,String(input.checksum),input)
 if(parts[1]==='scan'){
  await ownerOnly(env,s)
  if(input.checksum){const row=(await list<Scan>(env,'content-scan')).find(r=>r.payload.checksum===input.checksum);insist(row,'not_found',404);await scanUpload(env,row.payload);return {scanned:row.payload.checksum}}
  insist(typeof input.item==='string','item_required')
  const {context,demand,who}=await import('../files/access'),ctx=await context(env,await who(env,s),input.item,false);demand(ctx,'view')
  for(const v of ctx.chain.at(-1)!.payload.versions)await scanUpload(env,v)
  return {scanned:input.item}
 }
 insist(false,'not_found',404)
}
