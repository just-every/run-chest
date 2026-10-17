import type { Bindings } from './auth.server'
import type { Document, Person, Version } from './chest/model'
import { schemaDefinition, validateFields } from './chest/fields'
import { inspect, retain } from './chest/blobs'
import { collections, documents, groups, schemas, team } from './demo-sample'

/** Demo data for `rer demo` and the hosted demo (Base modules/demo runs it once,
 * after the owner exists): a lived-in Harbourworks library with its team, groups,
 * document types, collections, records with version histories, review and expiry
 * work, and the audit trail that history leaves. Originals go through Chest's own
 * byte inspection and R2 custody; every insert uses a fixed ID with ON CONFLICT DO
 * NOTHING, so a repeat changes nothing. */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE email = ? AND role = 'owner'").bind(ownerEmail.toLowerCase()).first<{ id: string }>()
  if (!owner) throw new Error('The demo owner does not exist yet')
  const me = ownerEmail.toLowerCase(), at = (days: number, minutes = 0) => new Date(now.getTime() + days * 86_400_000 - minutes * 60_000).toISOString()
  const statement = (sql: string, ...params: unknown[]) => env.DB.prepare(sql).bind(...params)
  const record = (id: string, kind: string, payload: unknown) => statement('INSERT INTO chest_records(id, kind, payload, revision) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', id, kind, JSON.stringify(payload), crypto.randomUUID())
  const audit: unknown[][] = []
  const log = (actor: string, action: string, object: string, when: string) => audit.push([`demo-audit-${audit.length + 1}`, actor, action, object, JSON.stringify({ sample: true }), when])

  // The owner claim leaves the default name 'Owner'; name the demo owner from their email as the team are named.
  const ownerName = me.split('@')[0].split(/[._-]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(' ')
  if (ownerName) await statement("UPDATE oa_operators SET display_name = ? WHERE id = ? AND display_name = 'Owner'", ownerName, owner.id).run()

  // The team are real operator identities, as an accepted invitation leaves them; the
  // library's people mirror them the way Chest's identity sync does.
  await env.DB.batch(team.map(person => statement('INSERT INTO oa_operators(id, email, display_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', person.id, person.email, person.name, person.role, person.status, now.getTime() - 200 * 86_400_000)))
  const operators = (await env.DB.prepare('SELECT email, display_name, role, status FROM oa_operators').all<{ email: string; display_name: string; role: string; status: string }>()).results
  const records = operators.map(o => record(o.email, 'person', { email: o.email, name: o.display_name, role: o.role, status: o.status, development: o.email.endsWith('@dev.localhost') } satisfies Person))

  for (const [index, group] of groups.entries()) { records.push(record(group.id, 'group', { name: group.name, members: group.members })); log(me, 'group.create', group.id, at(-200, index)) }
  const types = new Map(schemas.map(({ id, ...input }) => [id, schemaDefinition(input)]))
  for (const [id, schema] of types) { records.push(record(id, 'schema', schema)); log(me, 'schema.create', id, at(-199, records.length)) }
  for (const { id, ...collection } of collections) { records.push(record(id, 'collection', collection)); log(me, 'collection.create', id, at(-198, records.length)); log(me, 'access.change', id, at(-198, records.length - 1)) }

  for (const sample of documents(me, now)) {
    const versions: Version[] = []
    for (const [index, input] of sample.versions.entries()) {
      const version = await inspect(input.bytes, input.filename, input.by, input.reviewer)
      await retain(env, input.bytes, version)
      const events = input.events.map(event => ({ action: event.action, actor: event.by, at: at(event.days), message: event.message ?? '' }))
      const state = events.some(event => event.action === 'approve') ? 'approved' : events.some(event => event.action === 'changes') ? 'changes' : 'submitted'
      versions.push({ ...version, id: `${sample.id}-v${index + 1}`, at: at(input.days, 30), state, events })
      log(input.by, index ? 'version.submit' : 'document.upload', sample.id, at(input.days, 30))
      for (const event of input.events) log(event.by, `review.${event.action}`, sample.id, at(event.days))
    }
    const reviewDate = sample.review === null ? '' : at(sample.review).slice(0, 10), expiryDate = sample.expiry === null ? '' : at(sample.expiry).slice(0, 10)
    const completions = sample.completed ? [{ actor: sample.completed.by, at: at(sample.completed.days), evidence: sample.completed.evidence, kind: sample.completed.kind, date: sample.completed.kind === 'review' ? reviewDate : expiryDate }] : []
    if (sample.completed) log(sample.completed.by, 'document.complete', sample.id, at(sample.completed.days))
    if (sample.trash !== undefined) log(me, 'document.trash', sample.id, at(sample.trash))
    const document: Document = {
      title: sample.title, collection: sample.collection, schema: sample.schema, fields: validateFields(types.get(sample.schema)!, sample.fields),
      owner: sample.owner, reviewer: sample.reviewer, reference: sample.reference, reviewDate, expiryDate,
      approved: versions.findLast(version => version.state === 'approved')?.id ?? null, versions,
      private: sample.private ?? false, grants: sample.grants ?? [], trash: sample.trash !== undefined, completions,
    }
    records.push(record(sample.id, 'document', document))
  }

  await env.DB.batch([
    ...records,
    ...audit.map(row => statement('INSERT INTO chest_audit(id, actor, action, object_id, detail, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', ...row)),
    statement('INSERT INTO oa_first_run (singleton, completed_by, completed_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO NOTHING', owner.id, now.getTime()),
  ])
}
