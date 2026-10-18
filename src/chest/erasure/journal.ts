import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { tombstone } from '@runeditrun/rer/modules/portability/journal'
import { state } from '@runeditrun/rer/modules/portability/storage'
import { owner } from '../access'
import { list } from '../store'
import type { JournalEntry } from './model'
// Both the ordinary rer archive and Chest's hosted archive carry the same installation identity.
export async function sourceIdentity(env: Bindings) { return (await state(env.DB)).source_identity as string }
export async function erasureJournal(env: Bindings, s: Session) {
 owner(s); return { format:'chest-erasure-journal-1', source:await sourceIdentity(env), entries:(await list<JournalEntry>(env,'erasure-journal')).map(r=>r.payload) }
}
export async function portableFences(env: Bindings, records: {id:string}[], identity = false) {
 const source=await sourceIdentity(env), out:{sql:string;params:unknown[]}[]=[]
 for(const row of records)out.push({sql:'INSERT OR IGNORE INTO rer_portability_journal VALUES(?,?)',params:[source,await tombstone(source,'chest_records',{id:row.id})]})
 if(identity)out.push({sql:'INSERT OR IGNORE INTO rer_portability_journal VALUES(?,?)',params:[source,await tombstone(source,'rer_portability_state',{id:1})]})
 out.push({sql:'UPDATE rer_portability_state SET epoch=epoch+1 WHERE id=1',params:[]},{sql:'INSERT INTO rer_portability_epochs SELECT source_identity,epoch FROM rer_portability_state WHERE id=1 ON CONFLICT(source) DO UPDATE SET epoch=MAX(epoch,excluded.epoch)',params:[]})
 return out
}
