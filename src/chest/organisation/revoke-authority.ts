import { id, now } from '../model'
import { sql, type Sql } from './scim-common'

// Identity suspension must not become a temporary pause of externally exercisable or unattended authority.
// Definitions and evidence remain, but a later active status cannot resurrect the old capability or agent grant.
export function deprovisionAuthority(email: string, actor: string): Sql[] {
 const at = now(), revision = id()
 return [
  sql("UPDATE chest_records SET payload=json_set(payload,'$.revokedAt',?,'$.revokedBy',?),revision=? WHERE kind='public-link' AND COALESCE(json_extract(payload,'$.custodian'),json_extract(payload,'$.createdBy'))=? AND json_extract(payload,'$.revokedAt') IS NULL", at, actor, revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.expires',?),revision=? WHERE kind='link' AND json_extract(payload,'$.createdBy')=? AND (json_extract(payload,'$.expires') IS NULL OR json_extract(payload,'$.expires')>?)", at, revision, email, at),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.closedAt',?,'$.closedBy',?),revision=? WHERE kind='file-request' AND COALESCE(json_extract(payload,'$.custodian'),json_extract(payload,'$.createdBy'))=? AND json_extract(payload,'$.closedAt') IS NULL", at, actor, revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.revokedAt',?,'$.reason','identity_deactivated'),revision=? WHERE kind='integration-grant' AND json_extract(payload,'$.user')=? AND json_extract(payload,'$.revokedAt') IS NULL", at, revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.revokedAt',?),revision=? WHERE kind='integration-client' AND json_extract(payload,'$.owner')=? AND json_extract(payload,'$.revokedAt') IS NULL", at, revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.enabled',json('false'),'$.problem','identity_deactivated'),revision=? WHERE kind IN ('filing_scope','intake') AND json_extract(payload,'$.by')=? AND json_extract(payload,'$.enabled')=1", revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.enabled',json('false')),revision=? WHERE kind='filing_rule' AND json_extract(payload,'$.createdBy')=? AND json_extract(payload,'$.enabled')=1", revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.automatic',json('false')),revision=? WHERE kind='link-scope' AND json_extract(payload,'$.by')=? AND json_extract(payload,'$.automatic')=1", revision, email),
  sql("UPDATE chest_records SET payload=json_set(payload,'$.enabled',json('false'),'$.sendReminders',json('false')),revision=? WHERE kind='collection-checklist' AND json_extract(payload,'$.owner')=? AND json_extract(payload,'$.enabled')=1", revision, email),
  sql('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)', id(), actor, 'organisation.identity.authority-revoke', email, JSON.stringify({ externalLinks: 'revoked', agentGrants: 'disabled', reactivation: 'fresh_authorization_required' }), at),
 ]
}
