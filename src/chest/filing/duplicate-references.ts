import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { context, demand, stillSharing, whoFor, type Ctx, type Who } from '../files/access'
import type { Item, Link, Prefs, PublicLink } from '../files/model'
import { creatorLinkPolicy, demandLinkPolicy } from '../files/link-policy'
import { linkedVersion } from '../files/link-versions'
import { linkState } from '../files/public-links'
import { list } from '../store'
import { ChestError, type Row } from '../model'
import { type Reference } from './duplicate-model'

type Inventory = { references:Reference[]; rows:Row[]; contexts:Ctx[]; fences:Row[]; statements:{sql:string;params:unknown[]}[] }
// Only real Chest reference forms are repairable. Historical byte URLs and pinned links are intentionally
// retained; immutable documents and vendor-owned URLs are never rewritten by consolidation.
export async function referenceInventory(env:Bindings, s:Session, w:Who, source:Row<Item>, destination:Row<Item>):Promise<Inventory> {
 const result:Inventory={references:[],rows:[],contexts:[],fences:[],statements:[]}
 const groups=await list(env,'group'),policies=await list(env,'link-policy')
 result.fences.push(...groups,...policies)
 // Fence absent as well as present rules: a policy/group added during a preview must invalidate execution.
 for(const [kind,rows] of [['group',groups],['link-policy',policies]] as const)
  result.statements.push({sql:'INSERT INTO chest_assert(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM chest_records WHERE kind=?)=? THEN 1 ELSE 0 END',params:[kind,rows.length]})
 for(const row of await list<Prefs>(env,'prefs')) {
  const fields=(['starred','shortcuts'] as const).filter(k=>row.payload[k].includes(source.id))
  if(!fields.length)continue
  const email=row.id.startsWith('prefs:')?row.id.slice(6):''
  const reference:Reference={id:row.id,kind:'prefs',revision:row.revision,label:`${email} · ${fields.join(' and ')}`,audience:email,fields:[...fields],sourceVersion:source.payload.current!,version:destination.payload.current!,blocked:null}
  try {
   const op:any=await env.DB.prepare("SELECT id,version FROM oa_operators WHERE email=? AND status='active'").bind(email).first()
   if(!op)throw new ChestError('reference_owner_inactive')
   const person=await whoFor(env,email),before=await context(env,person,source.id),after=await context(env,person,destination.id)
   demand(before,'view');demand(after,'view')
   result.contexts.push(before,after)
   result.statements.push({sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND status='active') THEN 1 ELSE 0 END",params:[op.id,email,op.version]})
  }catch(error){if(!(error instanceof ChestError))throw error;reference.blocked='The bookmark owner must currently be able to open both files.'}
  result.references.push(reference);result.rows.push(row)
 }
 for(const kind of ['link','public-link'] as const) for(const row of await list<Link|PublicLink>(env,kind)) {
  if(row.payload.item!==source.id)continue
  const publicLink=kind==='public-link'?row.payload as PublicLink:null,member=kind==='link'?row.payload as Link:null
  const reference:Reference={id:row.id,kind,revision:row.revision,label:publicLink?'Chest external link':'Chest member link',audience:publicLink?(publicLink.audience==='guests'?`Named guests: ${(publicLink.guests??[]).join(', ')}`:publicLink.audience==='domain'?`Verified domain: ${publicLink.domain}`:'Anyone with the link'):member!.audience==='organisation'?`Organization · ${member!.role}`:'Existing named access only',sourceVersion:source.payload.current!,version:destination.payload.current!,blocked:null}
  try {
   if(publicLink){
    if(publicLink.versionMode==='pinned'){reference.version=publicLink.version??'Unavailable retained version';reference.sourceVersion=reference.version;throw new ChestError('Retained version links stay on their original file.')}
    if(linkState(publicLink)!=='active')throw new ChestError('Inactive links are retained without reactivation.')
    const original=linkedVersion(source.payload,publicLink),target=linkedVersion(destination.payload,publicLink)
    if(!original||!target)throw new ChestError('The intended current or approved version must exist on both files.')
    reference.version=target.id;reference.sourceVersion=original.id
   }else if(member!.expires&&Date.parse(member!.expires)<=Date.now())throw new ChestError('Expired links are retained without reactivation.')
   const email=publicLink?.custodian??row.payload.createdBy
   const before=await stillSharing(env,email,source.id),after=await stillSharing(env,email,destination.id)
   if(!before||!after)throw new ChestError('The link custodian must currently be allowed to share both files.')
   if(publicLink&&after.state.noDownload&&publicLink.download!==false)throw new ChestError('The destination forbids original downloads through this link.')
   const policy=await creatorLinkPolicy(env,email,destination.payload.space)
   demandLinkPolicy(policy.rules,publicLink?'public':member!.audience,member?.discoverable)
   result.contexts.push(before,after);result.fences.push(...policy.fences)
   const op:any=await env.DB.prepare("SELECT id,version FROM oa_operators WHERE email=? AND status='active'").bind(email).first()
   if(!op)throw new ChestError('The link custodian is inactive.')
   result.statements.push({sql:"INSERT INTO chest_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active') THEN 1 ELSE 0 END",params:[op.id,op.version]})
  }catch(error){if(!(error instanceof ChestError))throw error;reference.blocked=error.code.includes('_')?'The destination sharing policy or current access refuses this repair.':error.code}
  result.references.push(reference);result.rows.push(row)
 }
 return result
}
export function referencePatch(reference:Reference,row:Row,from:string,to:string) {
 if(reference.kind==='prefs')return Object.fromEntries(reference.fields!.map(field=>[field,[...new Set((row.payload[field] as string[]).map(id=>id===from?to:id))]]))
 return {item:to}
}
