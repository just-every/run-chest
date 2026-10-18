import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { get, list } from '../store'
import { ChestError, insist, now, type Row } from '../model'
import { commit, fresh, maybe, next } from '../files/repo'
import { action, credentialSession, live, resource, spend, type Authorized } from './auth'
import { endpoint, insertSecret, random, seal, secret, sign } from './secrets'
import { eventKinds, liveEventPredicate } from './events'
import type { Delivery, Event, Subscription } from './model'
type HookSecret = { key: string; tokenId: string }
export async function subscribe(env: Bindings,auth: Authorized,input: any) {
 action(auth,'webhook');const url=endpoint(input.endpoint,env.AUTH_LOCAL==='true');insist(!url.search,'webhook_query_refused');const events=input.events??[];insist(Array.isArray(events)&&events.length>0&&events.every(e=>(eventKinds as readonly string[]).includes(e)),'invalid_webhook_events')
 const latest=await env.DB.prepare("SELECT CAST(value AS INTEGER) n FROM chest_integration_secrets WHERE id='event-clock'").first<{n:number}>(),row=fresh<Subscription>('integration-subscription',{grant:auth.grant.id,owner:auth.session.operator.email,endpoint:url.href,events:[...new Set<string>(events)],after:latest?.n??0,at:now()}),key=random('chest_hook_'),id=`hook:${row.id}`
 await commit(env,auth.session,[{row}],{audits:[{action:'integration.webhook.subscribe',object:row.id,detail:{grant:auth.grant.id,events}}],statements:[insertSecret(id,await seal(env,id,{key,tokenId:auth.tokenId}),auth.session.operator.email)]});return {subscription:{id:row.id,...row.payload},signingSecret:key}
}
async function hookAuth(env: Bindings,subscription: Row<Subscription>) {insist(!subscription.payload.revokedAt,'webhook_revoked',403);const saved=await secret<HookSecret>(env,`hook:${subscription.id}`);insist(saved,'webhook_reauthorization_required',403);const request=new Request(`${env.AUTH_ORIGIN}/api/chest/integrations/v1/webhooks`),auth=await credentialSession(env,request,saved.value.tokenId);insist(auth.grant.id===subscription.payload.grant,'webhook_grant_mismatch',403);action(auth,'webhook');return {auth,key:saved.value.key}}
export async function queueEvents(env: Bindings,subscription: Row<Subscription>) {
 const {auth}=await hookAuth(env,subscription),events=(await env.DB.prepare(`SELECT CAST(json_extract(p.value,'$.position') AS INTEGER) AS position,r.* FROM chest_records r JOIN chest_integration_secrets p ON p.id='event:'||r.id WHERE r.kind='integration-event' AND CAST(json_extract(p.value,'$.position') AS INTEGER)>? AND ${liveEventPredicate} ORDER BY position LIMIT 50`).bind(subscription.payload.after).all()).results as any[];if(!events.length)return
 let after=subscription.payload.after;const ops=[]
 for(const raw of events){after=raw.position;const event=JSON.parse(raw.payload) as Event;if(event.imported||!subscription.payload.events.includes(event.kind))continue
  try{await resource(env,auth,event.item,'webhook')}catch(error){if(error instanceof ChestError&&(error.status===403||error.status===404))continue;throw error}
  const id=`integration-delivery:${subscription.id}:${raw.id}`;if(!await maybe(env,'integration-delivery',id))ops.push({row:fresh<Delivery>('integration-delivery',{subscription:subscription.id,event:raw.id,state:'pending',attempt:0,at:now()},id)})
 }
 await commit(env,auth.session,[...ops,{row:next(subscription,{...subscription.payload,after}),previous:subscription}])
}
export async function deliverEvent(env: Bindings,key: string,replay = false) {
 let delivery=await get<Delivery>(env,'integration-delivery',key),d=delivery.payload
 if(replay)insist(['failed','uncertain','delivered'].includes(d.state),'webhook_delivery_busy',409);else if(d.state!=='pending')return delivery
 const subscription=await get<Subscription>(env,'integration-subscription',d.subscription),event=await get<Event>(env,'integration-event',d.event);insist(!event.payload.imported&&await env.DB.prepare(`SELECT 1 FROM chest_records r WHERE r.id=? AND ${liveEventPredicate}`).bind(event.id).first(),'imported_event_not_deliverable',403)
 const {auth,key:signingKey}=await hookAuth(env,subscription);await resource(env,auth,event.payload.item,'webhook')
 const sending=next(delivery,{...d,state:'sending' as const,attempt:d.attempt+1,startedAt:now(),finishedAt:undefined,status:undefined,reason:undefined})
 await commit(env,auth.session,[{row:sending,previous:delivery},spend(auth,{requests:1})],{fences:[subscription,event],audits:[{action:replay?'integration.webhook.replay':'integration.webhook.attempt',object:delivery.id,detail:{event:event.id,attempt:sending.payload.attempt}}]});delivery=sending;d=sending.payload
 const body=JSON.stringify({id:event.id,type:event.payload.kind,at:event.payload.at,item:event.payload.item,version:event.payload.version}),timestamp=String(Math.floor(Date.now()/1000)),signature=await sign(signingKey,`${timestamp}.${body}`)
 let state:Delivery['state']='uncertain',status:number|undefined,reason:string|undefined
 try {await live(env,auth,event.payload.item,'webhook');const response=await fetch(subscription.payload.endpoint,{method:'POST',redirect:'manual',headers:{'content-type':'application/json','x-chest-event':event.id,'x-chest-delivery':delivery.id,'x-chest-signature':`t=${timestamp},v1=${signature}`},body,signal:AbortSignal.timeout(10000)});status=response.status;state=response.ok?'delivered':'failed';reason=response.ok?undefined:'receiver_refused';await response.body?.cancel()}catch(error){reason=error instanceof ChestError?error.code:'receiver_outcome_unknown';state=error instanceof ChestError?'failed':'uncertain'}
 // Always retain the observed result, including if the grant was revoked while the receiver responded.
 const row=next(delivery,{...d,state,status,reason,finishedAt:now()});await commit(env,null,[{row,previous:delivery}],{by:'chest:webhook',audits:[{action:'integration.webhook.outcome',object:delivery.id,detail:{event:event.id,state,status,attempt:d.attempt}}]});return row
}
export async function replayDelivery(env: Bindings,s: Session,key: string) {const delivery=await get<Delivery>(env,'integration-delivery',key),subscription=await get<Subscription>(env,'integration-subscription',delivery.payload.subscription);insist(subscription.payload.owner===s.operator.email,'not_found',404);return deliverEvent(env,key,true)}
export async function sweepIntegrations(env: Bindings) {
 // No automatic retry after sending started: a dead process may have reached the receiver. The console exposes
 // uncertainty and the human chooses replay with the same event ID, which receivers must deduplicate.
 const stale=new Date(Date.now()-60000).toISOString();for(const row of await list<Delivery>(env,'integration-delivery'))if(row.payload.state==='sending'&&row.payload.startedAt!<stale)try{await commit(env,null,[{row:next(row,{...row.payload,state:'uncertain',reason:'runner_interrupted'}),previous:row}])}catch{}
 for(const subscription of (await list<Subscription>(env,'integration-subscription')).filter(r=>!r.payload.revokedAt))try{await queueEvents(env,subscription)}catch{}
 for(const delivery of (await list<Delivery>(env,'integration-delivery')).filter(r=>r.payload.state==='pending').slice(0,10))try{await deliverEvent(env,delivery.id)}catch(error){if(error instanceof ChestError){try{await commit(env,null,[{row:next(delivery,{...delivery.payload,state:'failed',reason:error.code,finishedAt:now()}),previous:delivery}])}catch{}}}
}
