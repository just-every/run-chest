import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, type Row } from '../model'
import { decode } from '../store'
import { commit } from '../files/repo'
import { stillSharing } from '../files/access'
import { linkState } from '../files/public-links'
import { linkedVersion } from '../files/link-versions'
import { creatorLinkPolicy } from '../files/link-policy'
import { publicPolicyReason } from '../files/sharing-policy'
import type { PublicLink } from '../files/model'
import { identityRedactor, viewFilter } from '../audit/privacy'
import { contentCondition, reportScope } from './report-scope'
import { csvCell } from './reports'

type GuestRow = { source: 'shared link'|'file request'; sourceId: string; item: string; identity: string; evidence: string; recordedAt: string|null; state: string; expires: string|null; custodian: string }
type LinkRow = Row<PublicLink> & { space: string }
const basis = 'Current link audiences and retained file-request submitter evidence, scoped by content custody. Configured recipients are not proof of a visit. Email verification is a historical event, not a current sign-in or live-session count. Anonymous and domain audiences have no known person count. Self-reported submitter addresses are unverified. Activity date filters do not apply.'
export async function administrativeGuests(env: Bindings, s: Session, params: URLSearchParams) {
 const scope = await reportScope(env,s,params.get('group')), allowed = contentCondition(scope,'r')
 const links = (await env.DB.prepare(`SELECT l.*,json_extract(r.payload,'$.space') space FROM chest_records l JOIN chest_records r ON r.id=json_extract(l.payload,'$.item') WHERE l.kind='public-link' AND r.kind='item' AND ${allowed.sql} ORDER BY l.id`).bind(...allowed.params).all()).results.map(row=>({...decode<PublicLink>(row),space:String(row.space)}))
 const visible = await viewFilter(env,true,true), redact = await identityRedactor(env), rows: GuestRow[] = []
 for (const link of links as LinkRow[]) {
  const p=link.payload, custodian=p.custodian??p.createdBy
  let state:string=linkState(p)
  if(state==='active') {
   let ctx=null
   try{ctx=await stillSharing(env,custodian,p.item)}catch(error){if(!(error instanceof ChestError)||!['not_found','access_required'].includes(error.code))throw error}
   const rules=(await creatorLinkPolicy(env,custodian,link.space)).rules
   if(!ctx || ctx.chain.at(-1)!.payload.type==='file'&&!linkedVersion(ctx.chain.at(-1)!.payload,p))state='unavailable'
   else if(publicPolicyReason(rules,p))state='policy blocked'
  }
  const base={source:'shared link' as const,sourceId:link.id,item:p.item,state,expires:p.expires,custodian:await redact(custodian)}
  // Read only the used evidence, never an outstanding challenge's token/hash or address.
  const used=(await env.DB.prepare("SELECT json_extract(payload,'$.email') email,MAX(json_extract(payload,'$.used')) at FROM chest_records WHERE kind='guest-challenge' AND json_extract(payload,'$.link')=? AND json_extract(payload,'$.used') IS NOT NULL GROUP BY json_extract(payload,'$.email')").bind(link.id).all<{email:string;at:string}>()).results.filter(r=>visible({actor:r.email,action:'link.guest.verified'}))
  if(p.audience==='guests') {
   for(const email of p.guests??[]) {const evidence=used.find(r=>r.email===email);rows.push({...base,identity:await redact(email),evidence:evidence?'email verified':'configured recipient',recordedAt:evidence?.at??null})}
  } else {
   rows.push({...base,identity:p.audience==='domain'?`@${p.domain}`:'Anyone with the link',evidence:p.audience==='domain'?'domain audience':'anonymous audience',recordedAt:null})
   for(const evidence of used)rows.push({...base,identity:await redact(evidence.email),evidence:'email verified',recordedAt:evidence.at})
  }
 }
 // A receipt records the submitter's evidence at submission, never ongoing guest authority.
 const submissions=(await env.DB.prepare(`SELECT json_extract(r.payload,'$.request') sourceId,json_extract(q.payload,'$.folder') item,json_extract(r.payload,'$.submitter.email') email,json_extract(r.payload,'$.submitter.verified') verified,MAX(json_extract(r.payload,'$.at')) at,json_extract(q.payload,'$.custodian') custodian,json_extract(q.payload,'$.createdBy') createdBy FROM chest_records r JOIN chest_records q ON q.id=json_extract(r.payload,'$.request') AND q.kind='file-request' WHERE r.kind='request-submission' AND ${allowed.sql} GROUP BY sourceId,email,verified`).bind(...allowed.params).all<{sourceId:string;item:string;email:string;verified:number;at:string;custodian:string|null;createdBy:string}>()).results
 for(const row of submissions) rows.push({source:'file request',sourceId:row.sourceId,item:row.item,identity:row.email?await redact(row.email):'Anonymous submitter',evidence:row.verified?'verified submission':'self-reported submitter',recordedAt:row.at,state:'historical submission',expires:null,custodian:await redact(row.custodian??row.createdBy)})
 const email=params.get('email')?.trim().toLowerCase(),evidence=params.get('evidence')
 const filtered=rows.filter(r=>(!email||r.identity.toLowerCase().includes(email))&&(!evidence||r.evidence===evidence)).sort((a,b)=>a.identity.localeCompare(b.identity)||a.sourceId.localeCompare(b.sourceId)||a.evidence.localeCompare(b.evidence))
 await commit(env,s,[],{audits:[{action:'admin.guests.read',object:'administration',detail:{records:filtered.length}}]})
 return {rows:filtered,basis,asOf:new Date().toISOString(),groups:scope.groups}
}
export async function administrativeGuestsCsv(env:Bindings,s:Session,params:URLSearchParams) {
 const d=await administrativeGuests(env,s,params),header=['Source','Source ID','Item ID','Identity or audience','Evidence','Evidence recorded at','State','Link expiry','Custodian']
 const lines=d.rows.map(r=>[r.source,r.sourceId,r.item,r.identity,r.evidence,r.recordedAt,r.state,r.expires,r.custodian].map(csvCell).join(','))
 return new Response([header.join(','),...lines].join('\r\n')+'\r\n',{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="chest-external-guests.csv"','cache-control':'no-store','x-content-type-options':'nosniff'}})
}
