import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist, now, id } from '../model'
import { list, write } from '../store'
import { adminView } from './roles'
import { card, esc } from '../ui-shared'
const bounds={listing:1000,deepOpen:1000,search:2000,catchUp:900000,enumeration:1800000}
const dimensions=['items','bytes','depth','members','devices','largestSpace','largestFolder','directMembers','changes','offlineDays'] as const
const minimum={items:2000000,bytes:10000000000000,depth:100,members:150,devices:300,largestSpace:500000,largestFolder:20000,directMembers:600,changes:10000,offlineDays:7}
const percentile=(samples:number[],p:number)=>[...samples].sort((a,b)=>a-b)[Math.max(0,Math.ceil(samples.length*p)-1)]
export async function scaleReport(env:Bindings,s:Session,input?:any){
 await adminView(env,s)
 if(input){
  insist(/^[a-f0-9]{40}$/.test(input.head),'scale_head_required')
  insist(typeof input.seed==='string'&&input.seed.length>0&&input.seed.length<=100,'scale_seed_required')
  insist(input.counts&&dimensions.every(k=>Number.isSafeInteger(input.counts[k])&&input.counts[k]>=0),'invalid_scale_counts')
  insist(input.environment&&typeof input.environment.region==='string'&&input.environment.region.length<=100&&Number.isFinite(input.environment.mbps)&&input.environment.mbps>=0,'invalid_scale_environment')
  const timings=Object.fromEntries(Object.entries(bounds).map(([name,target])=>{
   const samples=input.samples?.[name];insist(Array.isArray(samples)&&samples.length>0&&samples.length<=10000&&samples.every(n=>Number.isFinite(n)&&n>=0),'invalid_scale_samples')
   return [name,{count:samples.length,p50:percentile(samples,.5),p95:percentile(samples,.95),target,pass:percentile(samples,.95)<=target}]
  }))
  insist(input.samples.search.length===50,'scale_requires_50_queries')
  insist(input.revocation&&['list','search','download','sync'].every(k=>input.revocation[k]===true),'scale_revocation_unproved')
  const eligible=dimensions.every(k=>input.counts[k]>=minimum[k])&&input.environment.usRegion===true&&input.environment.mbps===100&&input.environment.measuredNetwork===true
  const pass=eligible&&Object.values(timings).every(t=>t.pass)
  const row={id:id(),revision:id(),kind:'scale-report',payload:{head:input.head,seed:input.seed,counts:input.counts,environment:{region:input.environment.region,mbps:input.environment.mbps,usRegion:input.environment.usRegion===true,measuredNetwork:input.environment.measuredNetwork===true},timings,revocation:{list:true,search:true,download:true,sync:true},at:now(),pass,eligible,basis:'Operator-submitted journey measurements. Counts describe admitted data, not requested capacity. Network and source declarations are not independently certified.'}}
  await write(env,s,row,'admin.scale.record');return row.payload
 }
 const rows=await list(env,'scale-report');return rows.sort((a,b)=>b.payload.at.localeCompare(a.payload.at))[0]?.payload??null
}
export async function scaleHealth(env:Bindings,s:Session){const report=await scaleReport(env,s);return new Response(JSON.stringify({status:report?.pass?'ok':'failing',reason:!report?'Scale measurement unavailable':report.pass?'Targets met':report.eligible?'Measured target missed':'Reference size or measured US 100 Mbps network unproved',report}),{status:report?.pass?200:503,headers:{'content-type':'application/json','cache-control':'no-store'}})}
export async function scalePage(env:Bindings,s:Session){
 const r=await scaleReport(env,s)
 return `<header class="page-head"><h1>Operating scale</h1></header>${card('Scale health',r?`<p role="status">${r.pass?'Targets met':'Failing scale health check'}</p><p>${esc(r.basis)}</p><p>Source ${esc(r.head)} · seed ${esc(r.seed)} · ${esc(r.at)}</p><p>${esc(r.environment.region)} · ${r.environment.mbps} Mbps · ${r.environment.measuredNetwork?'Measured network':'Network unproved'}</p><ul class="events">${dimensions.map(k=>`<li>${esc(k)}: ${r.counts[k]} · reference minimum ${minimum[k]}</li>`).join('')}</ul><ul class="events">${Object.entries(r.timings).map(([name,t]:[string,any])=>`<li>${esc(name)}: p50 ${t.p50.toFixed(2)} ms · p95 ${t.p95.toFixed(2)} ms · target ${t.target} ms · ${t.count} samples · ${t.pass?'Within timing target':'Target missed'}</li>`).join('')}</ul><p>Next-request group revocation: list, search, download and sync refused.</p>`:'<p role="status">Failing scale health check: no measurement has been recorded.</p>')}<p><a href="/app/administration">Administration</a></p>`
}
