import type { Bindings } from '../../auth.server'
import { context, demand, stillSharing, type Who } from '../files/access'
import { where } from '../files/repo'
import { linkedVersion } from '../files/link-versions'
import { creatorLinkPolicy } from '../files/link-policy'
import { linkState } from '../files/public-links'
import type { Link, PublicLink } from '../files/model'
import type { Row } from '../model'
import type { Finding } from './link-model'
// A scan starts at one explicit item grant. It reads link metadata and ACLs on that item, never the contents of
// unrelated files or a global file inventory. Every action repeats this check against live permissions.
export async function scanLinks(env: Bindings, w: Who, item: string, intended: string[] = []) {
 const ctx = await context(env, w, item); demand(ctx, 'share')
 const node = ctx.chain.at(-1)!, findings: Finding[] = []
 const links: Row<PublicLink|Link>[] = [...await where<PublicLink>(env,'public-link','$.item',item),...await where<Link>(env,'link','$.item',item)]
 for (const row of links) {
  const pub = row.kind === 'public-link', p = row.payload as PublicLink, m = row.payload as Link
  if (pub && p.revokedAt) continue
  const audience: string = pub ? p.audience ?? 'public' : m.audience, affected = audience === 'guests' ? p.guests ?? [] : audience === 'domain' ? [`Everyone verified at ${p.domain}`] : audience === 'organisation' ? ['Every staff member with this link'] : audience === 'restricted' ? ['Only people with existing access'] : ['Anyone with this link']
  const reasons: string[] = [], repairs = ['revoke']
  const custodian = p.custodian ?? p.createdBy, active = !!await env.DB.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(custodian).first()
  const custody = active ? await stillSharing(env,custodian,item) : null
  if (!custody) { reasons.push('The link custodian has left or no longer has sharing access'); repairs.push('adopt') }
  const policy = await creatorLinkPolicy(env,custodian,ctx.space.id)
  if (pub ? !policy.rules.allowPublic : audience === 'organisation' && (!policy.rules.allowOrganisation || m.discoverable && !policy.rules.allowDiscovery)) reasons.push('The current sharing policy blocks this audience')
  if (p.expires && Date.parse(p.expires) <= Date.now()) { reasons.push('The link has expired'); repairs.push('renew') }
  if (pub && linkState(p) === 'limit reached') reasons.push('The download limit has been reached')
  let version: string|null = null
  if (node.payload.type === 'file') {
   const v = pub ? linkedVersion(node.payload,p) : node.payload.versions.find(v=>v.id===node.payload.current)
   version = v?.id ?? null
   if (!v) reasons.push('The intended version is unavailable; no replacement is silently exposed')
   if (pub && node.payload.versions.some(v=>v.review?.state==='approved' && v.id===node.payload.approved)) repairs.push('pin-approved')
  }
  if (audience === 'public') reasons.push('Anyone with the link can open it without signing in')
  if (audience === 'organisation' && m.discoverable) reasons.push('Every staff member can discover it in search')
  if (audience === 'guests') {
   const departed: string[] = []
   for (const email of p.guests ?? []) {
    const person = await env.DB.prepare('SELECT payload FROM chest_records WHERE kind=\'person\' AND id=?').bind(email).first<{payload:string}>()
    // Unknown external guests are not called departed. Only explicit local lifecycle evidence establishes that.
    if (person && JSON.parse(person.payload).status === 'inactive') departed.push(email)
   }
   if (departed.length) reasons.push(`Departed collaborators: ${departed.join(', ')}`)
   if (intended.length) { const extras=(p.guests??[]).filter(email=>!intended.includes(email)); if(extras.length){reasons.push(`Outside the intended collaborator list: ${extras.join(', ')}`);repairs.push('restrict-guests')} }
  } else if (intended.length && ['public','organisation','domain'].includes(audience)) reasons.push(`The audience exceeds the intended collaborators: ${intended.join(', ')}`)
  if (!p.expires && audience !== 'restricted') reasons.push('The link never expires')
  const result = await env.DB.prepare("SELECT json_extract(detail,'$.outcome') outcome,COUNT(*) n FROM chest_audit WHERE json_extract(detail,'$.link')=? GROUP BY outcome").bind(row.id).all<{outcome:string;n:number}>()
  const outcomes={succeeded:0,refused:0,failed:0}
  for(const r of result.results)if(r.outcome in outcomes)outcomes[r.outcome as keyof typeof outcomes]=r.n
  if(outcomes.refused || outcomes.failed)reasons.push('Recorded requests include refusals or failures')
  if(reasons.length)findings.push({id:row.id,kind:row.kind as Finding['kind'],revision:row.revision,item,name:node.payload.name,audience,affected,reasons,version,folder:node.payload.type==='folder',outcomes,repairs})
 }
 return { item: node.id, name: node.payload.name, findings, fences:ctx.fences }
}
