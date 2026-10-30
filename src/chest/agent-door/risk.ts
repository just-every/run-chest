import type { ClassAndFacts, ToolContext } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'
import { list } from '../store'
import { context, allowed, whoFor, type Ctx } from '../files/access'
import { effectiveLinkPolicy } from '../files/link-policy'
import { scanRecord } from '../content-security/scan'
import type { Group, Row } from '../model'
import type { Item, PublicLink } from '../files/model'
export const standard=():ClassAndFacts[]=>[{class:'standard',facts:{measure:1}}]
export async function sensitivity(env:Bindings,row:Row<Item>):Promise<ClassAndFacts[]> {
 for(const v of row.payload.versions){const scan=await scanRecord(env,v.checksum)
  if(scan?.payload.sensitive||/\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b|\b(?:bank|account|routing|tax|passport)\s*(?:number|no\.?|#|:)\s*\d{6,}\b/i.test(v.text))return [{class:'sensitive',facts:{measure:1,kind:'document'}}]
 }
 return standard()
}
export async function recipientRisk(env:Bindings,c:Ctx,principals:string[]):Promise<ClassAndFacts[]> {
 const groups=await list<Group>(env,'group'),emails=[...new Set(principals.flatMap(p=>p.includes('@')?[p]:groups.find(g=>g.id===p)?.payload.members??[]))]
 const rules=(await effectiveLinkPolicy(env,{groups:[]},c.space.id)).rules
 const external=emails.filter(e=>!rules.organizationDomains.includes(e.split('@')[1]))
 return external.length?[{class:'external',facts:{measure:external.length,counterparty:external.every(e=>rules.trustedDomains?.includes(e.split('@')[1]))?'known':'new'}}]:standard()
}
export async function exposure(env:Bindings,c:Ctx):Promise<ClassAndFacts[]> {
 const ids=new Set(c.chain.map(r=>r.id)),links=await list<PublicLink>(env,'public-link')
 if(links.some(r=>ids.has(r.payload.item)&&!r.payload.revokedAt&&(!r.payload.expires||Date.parse(r.payload.expires)>Date.now())&&r.payload.versionMode!=='pinned'&&!r.payload.snapshot))return [{class:'external',facts:{measure:1,counterparty:'public'}}]
 const people=(await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active'").all<{email:string}>()).results
 const outsiders:string[]=[]
 const domains=(await effectiveLinkPolicy(env,{groups:[]},c.space.id)).rules.organizationDomains
 for(const {email}of people)if(!domains.includes(email.split('@')[1])){
  try{const other=await context(env,await whoFor(env,email),c.chain.at(-1)!.id);if(allowed(other,'view')&&!other.state.trash)outsiders.push(email)}catch{}
 }
 return recipientRisk(env,c,outsiders)
}
