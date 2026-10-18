import type { Bindings } from '../../auth.server'
import { id, now } from '../model'
import { decode } from '../store'
import type { Op } from '../files/repo'
import { chargedSpaces, originals } from './storage'
import { limitSQL } from './rules'

// Publish the notice and crossing state atomically with the bytes/rule change. Concurrent admissions
// cannot both send a warning; falling below 90% arms the next crossing, including after a limit raise.
export async function warningPublication(env: Bindings, ops: Op[]) {
 const policyChanged = ops.some(o => ['quota-rule','group'].includes(o.row.kind))
 const spaces = new Set(chargedSpaces(ops))
 for (const o of ops) if (o.row.kind === 'space') spaces.add(o.row.id)
 if (policyChanged) for (const r of (await env.DB.prepare("SELECT id FROM chest_records WHERE kind='space'").all<{id:string}>()).results) spaces.add(r.id)
 const prefix = `quota-notice:${id()}:`, statements: {sql:string;params:unknown[]}[] = []
 for (const space of spaces) {
  const q = `WITH quota AS (SELECT s.payload,${limitSQL()} limitBytes,(SELECT COALESCE(SUM(bytes),0) FROM (${originals})) usedBytes FROM chest_records s WHERE s.kind='space' AND s.id=?)`
  const above = 'limitBytes IS NOT NULL AND (usedBytes>0 OR limitBytes=0) AND usedBytes*10>=limitBytes*9'
  const recipients = `SELECT json_extract(payload,'$.owner') email FROM quota WHERE json_extract(payload,'$.kind')='personal'
   UNION SELECT m.value->>'$.principal' FROM quota,json_each(quota.payload,'$.members') m WHERE m.value->>'$.role'='manager' AND instr(m.value->>'$.principal','@')>0
   UNION SELECT member.value FROM quota,json_each(quota.payload,'$.members') m JOIN chest_records g ON g.kind='group' AND g.id=m.value->>'$.principal',json_each(g.payload,'$.members') member WHERE m.value->>'$.role'='manager'`
  statements.push({sql:`${q} INSERT INTO chest_records(id,kind,payload,revision) SELECT ?||r.email,'notice',json_object('to',r.email,'type','storage.warning','item',NULL,'from','chest:storage','message',printf('%s storage %s: %d bytes used of %d bytes. At least 90%% of the storage limit is retained. Versions and trash count.',CASE WHEN json_extract(q.payload,'$.kind')='personal' THEN 'Personal' ELSE 'Space' END,json_extract(q.payload,'$.name'),q.usedBytes,q.limitBytes),'at',?,'read',json('false'),'email','queued'),? FROM (${recipients}) r CROSS JOIN quota q WHERE r.email<>'' AND ${above} AND NOT EXISTS(SELECT 1 FROM chest_records WHERE id=? AND json_extract(payload,'$.above')=1)`,params:[space,space,space,prefix,now(),id(),`quota-warning:${space}`]})
  statements.push({sql:`${q} INSERT INTO chest_records(id,kind,payload,revision) SELECT ?,'quota-warning',json_object('above',CASE WHEN ${above} THEN 1 ELSE 0 END),? FROM quota WHERE 1 ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision`,params:[space,space,space,`quota-warning:${space}`,id()]})
 }
 return {statements,async deliver(){if(!spaces.size)return;const rows=(await env.DB.prepare("SELECT * FROM chest_records WHERE kind='notice' AND id>=? AND id<?").bind(prefix,prefix+'\uffff').all()).results.map(r=>decode<any>(r));if(rows.length)await (await import('../files/notify')).deliver(env,null,rows)}}
}
