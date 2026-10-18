import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { documents } from '../access'
import type { Item } from '../files/model'
import { list } from '../store'
import type { Row } from '../model'
import type { IntakeReceipt } from './intake'
import { current, fileBrief, type Match } from './duplicate-model'
import { evidence, match, type Evidence } from './duplicate-match'

type Source = { kind: 'email'|'archive'; identity: string; description: string; checksum: string; association: 'arrival receipt'|'matching retained original'; row: Row }
export type Candidate = { row: Row<Item>; versions: Evidence[]; sources: Source[] }
export async function sourceInventory(env: Bindings, s: Session) {
 const sources: Source[] = (await list<IntakeReceipt>(env, 'intake-receipt')).map(row => ({ kind:'email', identity:JSON.stringify([row.payload.sender.toLowerCase(),row.payload.messageId,row.payload.filename]), description:`Email ${row.payload.messageId} · ${row.payload.filename} · ${row.payload.sender}`, checksum:row.payload.checksum, association:'arrival receipt', row }))
 // Imported source identities remain untrusted provenance. A byte association is evidence for a proposal,
 // never a grant or an identity assertion. Only documents this session can open contribute evidence.
 for (const row of await documents(env, s)) {
  const source = row.payload.source as {archive?:unknown;sourceId?:unknown;path?:unknown;decisions?:unknown}|undefined
  if (!source || typeof source.sourceId !== 'string' || !source.sourceId) continue
  for (const version of row.payload.versions) sources.push({kind:'archive',identity:JSON.stringify([source.archive,source.sourceId]),description:`Imported ${String(source.archive ?? 'archive')} · ${source.sourceId} · ${String(source.path ?? '')}`,checksum:version.checksum,association:'matching retained original',row})
 }
 return sources
}
export async function candidate(env: Bindings, row: Row<Item>, sources: Source[]): Promise<Candidate> {
 return {row, versions:await Promise.all(row.payload.versions.map(v=>evidence(env,v))), sources:sources.filter(p=>p.kind==='email'?p.row.payload.item===row.id:row.payload.versions.some(v=>v.checksum===p.checksum))}
}
export function reconcile(a: Candidate, b: Candidate) {
 const av=current(a.row.payload)!, bv=current(b.row.payload)!, ac=a.versions.find(v=>v.version.id===av.id)!, bc=b.versions.find(v=>v.version.id===bv.id)!
 const direct=match(ac,bc), sharedSources=a.sources.filter(x=>b.sources.some(y=>x.kind===y.kind&&x.identity===y.identity))
 const retained=a.versions.flatMap(x=>b.versions.filter(y=>x.version.checksum===y.version.checksum).map(y=>({keepVersion:x.version.id,duplicateVersion:y.version.id,checksum:x.version.checksum})))
 const comparison:Match|null=direct ?? (retained.length?{reason:'retained_version',similarity:1}:sharedSources.length?{reason:'source_identity',similarity:0}:null)
 if(!comparison)return null
 const aHasB=a.row.payload.versions.some(v=>v.checksum===bv.checksum), bHasA=b.row.payload.versions.some(v=>v.checksum===av.checksum)
 const supersession=av.checksum===bv.checksum?'Current originals match':aHasB&&!bHasA?'The other current original occurs in the canonical history':bHasA&&!aHasB?'The canonical current original occurs in the other history':'Different current originals; choose a canonical file after reviewing the changes'
 const words=(value:string)=>value.split(' ').filter(Boolean), ax=words(ac.text.value), bx=words(bc.text.value)
 let prefix=0;while(prefix<Math.min(ax.length,bx.length)&&ax[prefix]===bx[prefix])prefix++
 return {...comparison,evidence:{currentVersionsOnly:false,differentBytes:av.checksum!==bv.checksum,originalLinksRetained:true,approvalsCombined:false,
  supersession,retainedMatches:retained,sharedSources:sharedSources.map(p=>({kind:p.kind,description:p.description,association:p.association})),
  changes:av.checksum===bv.checksum?null:{keep:ax.slice(Math.max(0,prefix-8),prefix+35).join(' '),duplicate:bx.slice(Math.max(0,prefix-8),prefix+35).join(' '),available:!!ac.text.value&&!!bc.text.value,notice:'Text differences are evidence, not proof of a newer signature or authority.'},
  approvals:[approval(a.row),approval(b.row)]}}
}
function approval(row:Row<Item>) {return {item:row.id,approved:row.payload.approved??null,decisions:row.payload.versions.filter(v=>v.review).map(v=>({version:v.id,...v.review})),importedDecisionsAreNotChestApprovals:true}}
export function lineageBrief(c:Candidate){return {...fileBrief(c.row),approved:c.row.payload.approved??null,versions:c.row.payload.versions.map(v=>({id:v.id,checksum:v.checksum,at:v.at,actor:v.actor,arrival:v.arrival,restoredFrom:v.restoredFrom??null,review:v.review??null})),sources:c.sources.map(p=>({kind:p.kind,description:p.description,association:p.association,...(p.kind==='archive'?{importedDecisions:(p.row.payload.source as {decisions?:unknown}).decisions??[],notice:'Imported decisions are source history and confer no Chest approval.'}:{})}))}}
export function evidenceFences(...candidates:Candidate[]){return candidates.flatMap(c=>[...c.sources.map(s=>s.row),...c.versions.flatMap(v=>v.text.row?[v.text.row]:[])])}
