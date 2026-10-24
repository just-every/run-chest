import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { commit, fresh, maybe, next } from './repo'
import type { PublicLink } from './model'
import { canAdmin, requireAdmin } from '../administration/roles'
export type GuestPolicy={reverifyDays:number;maxDays:number}
export const guestPolicy=async(env:Bindings)=>{const p=(await maybe<GuestPolicy>(env,'guest-policy','guest-policy:organization'))?.payload??{reverifyDays:7,maxDays:30},sharing=await maybe(env,'policy','policy:sharing');return {...p,maxDays:sharing?.payload.maxGrantDays??p.maxDays}}
export async function saveGuestPolicy(env:Bindings,s:Session,input:any){
 await requireAdmin(env,s,'sharing-security');const value={reverifyDays:Number(input.reverifyDays),maxDays:Number(input.maxDays)}
 insist(Number.isInteger(value.reverifyDays)&&value.reverifyDays>=1&&value.reverifyDays<=30&&Number.isInteger(value.maxDays)&&value.maxDays>=1&&value.maxDays<=3650,'invalid_guest_policy')
 insist(input.confirm===true,'explicit_guest_policy_confirmation_required')
 const previous=await maybe<GuestPolicy>(env,'guest-policy','guest-policy:organization'),row=previous?next(previous,value):fresh('guest-policy',value,'guest-policy:organization')
 const sharing=await maybe(env,'policy','policy:sharing'),shared=sharing?next(sharing,{...sharing.payload,maxGrantDays:value.maxDays}):fresh('policy',{maxGrantDays:value.maxDays},'policy:sharing')
 await commit(env,s,[{row,previous:previous??undefined},{row:shared,previous:sharing??undefined}],{audits:[{action:'policy.guests',object:row.id,detail:{before:previous?.payload??{reverifyDays:7,maxDays:30},after:value}}]});return value
}
export async function guestExpiry(env:Bindings,link:Pick<PublicLink,'at'|'expires'>){const p=await guestPolicy(env);return Math.min(link.expires?Date.parse(link.expires):Infinity,Date.parse(link.at)+p.maxDays*86400000)}
export async function newGuestExpiry(env:Bindings,expires:string|null){const max=Date.now()+(await guestPolicy(env)).maxDays*86400000;insist(!expires||Date.parse(expires)<=max,'guest_expiry_above_maximum');return expires??new Date(max).toISOString()}

export async function guestPolicyCard(env:Bindings,s:Session){
 if(!await canAdmin(env,s,'sharing-security'))return ''
 const {card,form,field,select}=await import('../ui-shared'),p=await guestPolicy(env)
 return card('External guest verification',`<p>Guests verify again every ${p.reverifyDays} days. Grants expire within ${p.maxDays} days of creation. Current limits apply on every request. Organization sharing/security admins set this policy; group-only delegates cannot change the organization default.</p>${form('/guest-policy',field('Re-verification interval (1–30 days)','reverifyDays',String(p.reverifyDays),'number')+field('Maximum grant lifetime (days)','maxDays',String(p.maxDays),'number')+select('Confirm guest policy','confirm',[{id:'false',label:'Choose confirmation'},{id:'true',label:'I confirm this guest verification and expiry policy'}]),'Save guest policy','/app/links')}`)
}
