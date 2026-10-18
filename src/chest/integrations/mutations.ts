import type { Bindings } from '../../auth.server'
import { insist, now } from '../model'
import { commit, fresh, maybe, withCommitAttachment, type Op } from '../files/repo'
import { hash, insertSecret, seal, secret } from './secrets'
import { live, spend, type Authorized } from './auth'
type Receipt = { grant: string; fingerprint: string; at: string; result: { id: string; kind: string; version: string|null }[] }
function stable(value: unknown): unknown {if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));return value}
export async function mutate(env: Bindings,auth: Authorized,key: string,path: string,input: any,bytes: number,run: (s: Authorized['session'])=>Promise<unknown>) {
 insist(typeof key==='string'&&key.length>=8&&key.length<=240,'idempotency_key_required');const id=`integration-receipt:${auth.grant.id}:${await hash(key)}`,fingerprint=await hash(JSON.stringify(stable({path,input})))
 const prior=await maybe<Receipt>(env,'integration-receipt',id)
 if(prior){insist(prior.payload.fingerprint===fingerprint,'idempotency_key_reused',409);const response=await secret<any>(env,`response:${id}`);return response?.value??{receipt:id,state:'committed',result:prior.payload.result,response:'The mutation committed; its original response was not recorded. Reusing this key never repeats it.'}}
 const receipt=fresh<Receipt>('integration-receipt',{grant:auth.grant.id,fingerprint,at:now(),result:[]},id)
 const scoped=withCommitAttachment(auth.session,{accept:ops=>ops.some(o=>['item','file-request','link','public-link','integration-subscription'].includes(o.row.kind)),ops:ops=>{receipt.payload.result=ops.filter(o=>o.row.kind==='item'||o.row.kind==='file-request'||o.row.kind==='link'||o.row.kind==='public-link'||o.row.kind==='integration-subscription').map(o=>({id:o.row.id,kind:o.row.kind,version:o.row.payload.current??null}));const admitted=ops.filter(o=>o.row.kind==='item').reduce((n,o)=>n+o.row.payload.versions.filter((v:any)=>!o.previous?.payload.versions.some((old:any)=>old.id===v.id)).reduce((n:number,v:any)=>n+v.size,0),0);return [{row:receipt},spend(auth,{mutations:1,bytes:Math.max(bytes,admitted)})]},audits:[{action:'integration.mutation',object:auth.grant.id,detail:{receipt:id,path}}]})
 try {
  const raw=await run(scoped),result=raw&&typeof raw==='object'&&'kind' in raw&&(raw as any).kind==='item'?publicItem(raw as any):raw;insist(await maybe(env,'integration-receipt',id),'integration_mutation_not_atomic',503)
  const current=await live(env,auth) as Authorized
  await commit(env,current.session,[],{statements:[insertSecret(`response:${id}`,await seal(env,`response:${id}`,result),current.session.operator.email)]});return result
 } catch(error) {
  const saved=await maybe<Receipt>(env,'integration-receipt',id)
  if(saved){await live(env,auth);insist(saved.payload.fingerprint===fingerprint,'idempotency_key_reused',409);const response=await secret<any>(env,`response:${id}`);return response?.value??{receipt:id,state:'committed',result:saved.payload.result,response:'The mutation committed; its original response was not recorded. Reusing this key never repeats it.'}}
  throw error
 }
}

function publicItem(row:any){const p=row.payload,v=p.versions.find((v:any)=>v.id===p.current);return {id:row.id,name:p.name,type:p.type,parent:p.parent,current:p.current,updatedAt:p.updatedAt,size:v?.size??null,sha256:v?.checksum??null}}
