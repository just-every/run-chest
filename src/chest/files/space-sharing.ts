import type { Bindings } from '../../auth.server'
import { insist, type Row } from '../model'
import { start, whoFor, type Ctx } from './access'
// A space's member-only setting applies to individual and group grants, including an access-request approval.
// The groups read here are fenced with the eventual grant so concurrent membership changes cannot bypass it.
export async function memberRecipients(env:Bindings,ctx:Ctx,emails:string[]):Promise<Row[]>{
 if(ctx.space.payload.kind!=='team' || ctx.space.payload.settings.nonMemberAccess!==false)return []
 const fences:Row[]=[]
 for(const email of emails){const recipient=await whoFor(env,email);insist(start(ctx.space.payload,recipient).role,'space_non_member_access_disabled',403);fences.push(...recipient.groups)}
 return fences
}
