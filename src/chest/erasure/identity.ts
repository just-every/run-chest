import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { digest } from '../blobs'
import { insist } from '../model'
import { list } from '../store'
import { next, type Op } from '../files/repo'
import { eraseAuditIdentity } from '../audit/privacy'
const quote = (s:string) => '"'+s.replaceAll('"','""')+'"'
export async function identityPlan(env: Bindings, s: Session, email: string) {
 insist(email!==s.operator.email,'cannot_erase_current_owner',403)
 const person=await env.DB.prepare('SELECT id,email,role FROM oa_operators WHERE email=?').bind(email).first<{id:string;email:string;role:string}>()
 insist(person&&person.role!=='owner','person_not_erasable',409)
 const hash=await digest(new TextEncoder().encode(email)), alias=`Erased person ${hash.slice(0,12)}`, statements:{sql:string;params:unknown[]}[]=[], ops:Op[]=[]
 // Discover current authentication tables by schema. Revocation also covers factors and sessions added later.
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'oa_%' OR name LIKE 'chest_mfa_%' OR name IN ('chest_device_credentials','chest_scim_resources','chest_integration_secrets'))").all<{name:string}>()).results
 statements.push({sql:"DELETE FROM chest_mfa_verified WHERE session_id IN (SELECT 'integration:'||id FROM chest_records WHERE kind='integration-grant' AND json_extract(payload,'$.operator')=?)",params:[person.id]})
 const sessions=(await env.DB.prepare('SELECT id FROM oa_sessions WHERE operator_id=?').bind(person.id).all<{id:string}>()).results.map(r=>r.id)
 for(const {name} of tables){
  if(name==='oa_operators')continue
  const columns=(await env.DB.prepare(`PRAGMA table_info(${quote(name)})`).all<{name:string}>()).results.map(c=>c.name)
  if(columns.includes('session_id')&&sessions.length)statements.push({sql:`DELETE FROM ${quote(name)} WHERE session_id IN (SELECT value FROM json_each(?))`,params:[JSON.stringify(sessions)]})
  if(columns.includes('operator_id'))statements.push({sql:`DELETE FROM ${quote(name)} WHERE operator_id=?`,params:[person.id]})
  else if(columns.includes('email'))statements.push({sql:`DELETE FROM ${quote(name)} WHERE email=?`,params:[email]})
 }
 // Delete sessions before their source tokens (foreign keys); keep an inert anonymous operator ID for
 // external records with referential constraints. No login address or credential remains on that row.
 statements.sort((a,b)=>Number(b.sql.includes('oa_sessions'))-Number(a.sql.includes('oa_sessions')))
 statements.push({sql:"UPDATE oa_tokens SET issuer_id=NULL,issuer_version=NULL WHERE issuer_id=? AND kind='magic'",params:[person.id]})
 // Invitations issued by this person carry identifying authority too; remove dependent sessions first.
 statements.unshift({sql:'DELETE FROM oa_sessions WHERE source_token_id IN (SELECT id FROM oa_tokens WHERE issuer_id=?)',params:[person.id]})
 statements.push({sql:'DELETE FROM oa_tokens WHERE issuer_id=?',params:[person.id]})
 statements.push({sql:'UPDATE oa_auth_audit SET actor_id=CASE WHEN actor_id=? THEN ? ELSE actor_id END,value=replace(value,?,?)',params:[person.id,alias,email,alias]})
 statements.push({sql:"UPDATE oa_operators SET email=?,display_name=?,status='inactive',version=version+1 WHERE id=?",params:[`erased-${hash}@deleted.invalid`,alias,person.id]})
 const redact=(value:any):any=>{
  if(Array.isArray(value))return value.filter(x=>x!==email&&x?.principal!==email).map(redact)
  if(value&&typeof value==='object'){
   // Source attribution is personal data too. Keep the inert source record IDs and
   // replay fingerprint, but erase the matched person's source name and mapping notes.
   if(value.author===email&&value.imported)value={...value,imported:{...value.imported,authorName:alias,mappingEvidence:undefined}}
   return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]))
  }
  return typeof value==='string'?value.replaceAll(email,alias):value
 }
 for(const r of (await env.DB.prepare('SELECT * FROM chest_records').all<any>()).results){const row={...r,payload:JSON.parse(r.payload)}
  if(row.kind.startsWith('erasure')||row.kind==='audit-erased'||row.kind==='person'||row.kind==='extract')continue
  const payload=redact(row.payload)
  if(JSON.stringify(payload)!==r.payload)ops.push({row:next(row,payload),previous:row})
 }
 // Audit redaction is also re-applied after native deletion; its one-way tombstone covers future events.
 return {person,hash,alias,statements,ops,redactAudit:()=>eraseAuditIdentity(env,s,{email,confirm:email})}
}
