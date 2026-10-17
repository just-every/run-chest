import type { Bindings } from '../../auth.server'
import type { Ctx } from '../files/access'
import type { Item, PublicLink } from '../files/model'
import { linkState } from '../files/public-links'
import { insist, type Row } from '../model'
import { list } from '../store'
// A folder's public link reaches newly filed descendants even when there is no named grant. Treat each such
// capability as an audience, including password-protected links; automation cannot broaden it.
export async function preservePublicAudience(env:Bindings,source:Ctx,destination:Ctx,item:Row<Item>){
 const links=await list<PublicLink>(env,'public-link')
 const reaches=(chain:Row<Item>[])=>new Set(links.filter(r=>{
  const index=chain.findIndex(n=>n.id===r.payload.item)
  return index>=0&&linkState(r.payload)==='active'&&!chain.slice(index+1).some(n=>n.payload.restricted||n.payload.trash)
 }).map(r=>r.id))
 const before=reaches(source.chain),after=reaches([...destination.chain,item])
 insist([...after].every(id=>before.has(id)),'filing_would_broaden_public_access',409)
 return {links,count:links.length}
}
