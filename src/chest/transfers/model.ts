import type { Bindings } from '../../auth.server'
import { now } from '../model'
import { commit, fresh } from '../files/repo'
export type Package = { link:string; item:string; title:string; createdBy:string; at:string; receipt:boolean; limit:number|null; started:number }
export type Ticket = { transfer:string; tokenHash:string; actor:string; at:string; ranges:Record<string,[number,number][]>; completed:Record<string,string>; confirmed?:string }
export type Event = { transfer:string; session?:string; actor:string; kind:'view'|'scanner_view'|'started'|'bytes_completed'|'confirmed'|'mail_accepted'; item?:string; version?:string; at:string; bytes?:number }
export const event = (transfer:string,actor:string,kind:Event['kind'],details:Partial<Event>={}) => fresh<Event>('transfer-event',{transfer,actor,kind,at:now(),...details})
export async function record(env:Bindings,transfer:string,actor:string,kind:Event['kind'],details:Partial<Event>={}) {await commit(env,null,[{row:event(transfer,actor,kind,details)}],{by:actor})}
export function mergeRanges(ranges:[number,number][],part:[number,number]):[number,number][] {
 const out:[number,number][]=[]
 for(const r of [...ranges,part].sort((a,b)=>a[0]-b[0])) {const last=out.at(-1);if(last&&r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else out.push([...r])}
 return out
}
