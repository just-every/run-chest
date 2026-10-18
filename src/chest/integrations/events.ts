import { id, now } from '../model'
import type { Op, Change, Audit } from '../files/repo'
import type { Event } from './model'
export const eventKinds = ['file.upload','file.create','folder.create','version.upload','version.restore','version.name','item.rename','item.move','item.trash','item.restore','share.grant','share.remove','comment.add','comment.reply','comment.resolve','file-request.upload'] as const
// Called inside the normal product commit, never by an audit/history importer. Imported history is not an
// instruction to contact a third party. New events and their product mutations share one database transaction.
export function integrationEventOps(ops: Op[],_changes: Change[],audits: Audit[]): Op[] {
 return audits.filter(a=>(eventKinds as readonly string[]).includes(a.action)&&a.detail?.imported!==true&&a.detail?.arrival!=='import').map(a=>{
  const item=ops.find(o=>o.row.id===a.object&&o.row.kind==='item'),payload:Event={source:a.action,kind:a.action,item:a.object,version:typeof a.detail?.version==='string'?a.detail.version:item?.row.payload.current??null,at:now(),imported:false}
  return {row:{id:id(),kind:'integration-event',revision:id(),payload}}
 })
}
// The proof lives outside portable records and binds the actual local row identity. An imported event may
// retain its old imported:false field and ID, but cannot manufacture this installation's publication proof.
export function integrationEventStatements(events: Op[]) {
 return events.flatMap(({row})=>[
  {sql:"INSERT INTO chest_integration_secrets(id,value) VALUES('event-clock','0') ON CONFLICT(id) DO NOTHING",params:[] as unknown[]},
  {sql:"UPDATE chest_integration_secrets SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) WHERE id='event-clock'",params:[] as unknown[]},
  {sql:"INSERT INTO chest_integration_secrets(id,value) SELECT ?,json_object('position',(SELECT CAST(value AS INTEGER) FROM chest_integration_secrets WHERE id='event-clock'),'row',rowid,'revision',revision,'payload',payload) FROM chest_records WHERE id=? AND kind='integration-event'",params:[`event:${row.id}`,row.id]},
 ])
}
export const liveEventPredicate = "EXISTS(SELECT 1 FROM chest_integration_secrets p WHERE p.id='event:'||r.id AND json_extract(p.value,'$.row')=r.rowid AND json_extract(p.value,'$.revision')=r.revision AND json_extract(p.value,'$.payload')=r.payload)"
