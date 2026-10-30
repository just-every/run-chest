# Agent adoption and limits

Chest uses one shared agent door at `/mcp`, with `/mcp/chest` as an alias. Open **Agents** to choose local policy, inspect decisions, pause agents, review work or decide exact pending approvals. A paired Business sends signed policy and stable people bindings; an email address alone grants no authority. Unanswered policy refuses effects.

The records clerk can inspect accessible originals and metadata, organize files, manage versions, propose and apply deterministic filing, review exposure, narrow grants, manage space membership, inspect storage and native device state, record version-review decisions, release quarantine under native authority, and prepare/send parallel signature envelopes. Every call uses the sponsor’s current native rights. Assignment grants no access; an agent cannot act as a human signer or claim a human confirmation.

## Declared registry

The live schemas and catalogue are generated at `/docs/agents` and returned by discovery. This implementation declares core tools, policy, Pause, audit and idempotency. Resource templates describe sanitized native metadata. Optional subscriptions, resource refresh, multi-sponsor journeys, mail-event edges and the expanded native event catalogue are undeclared; Base’s built-in `chest.events.list` remains present. The pinned Base runtime still advertises subscription support unconditionally; honoring this declared subset in discovery is a Base edge for the next pin, and Chest does not claim that optional family. Native OAuth webhooks retain their separate connector purpose and uncertain-delivery controls.

| Tool | Possible classes | Contract clauses |
| --- | --- | --- |
| `chest.spaces.create` | standard | SURFACE-004, SPACE-001 |
| `chest.files.create` | standard, external | SURFACE-004, EDIT-004, EDIT-013 |
| `chest.folders.create` | standard, external | SURFACE-004, SPACE-001 |
| `chest.files.upload` | standard, external | SURFACE-004, CHEST-03, VERSION-001 |
| `chest.items.update` | standard, external | SURFACE-004, CHEST-04 |
| `chest.versions.name` | standard | SURFACE-005, VERSION-001 |
| `chest.versions.restore` | standard, external | SURFACE-005, VERSION-001 |
| `chest.items.trash` | standard | SURFACE-005, CHEST-13 |
| `chest.items.untrash` | standard, external | SURFACE-005, CHEST-13 |
| `chest.share` | standard, external | SURFACE-006, SHARE-004, POLICY-001 |
| `chest.links.create` | standard, external | SURFACE-006, SHARE-001, POLICY-002 |
| `chest.access.narrow` | standard | SURFACE-007, SHARE-007 |
| `chest.requests.create` | standard | SURFACE-008, SHARE-002 |
| `chest.comments.add` | standard, external | SURFACE-004, EDIT-003, FOLLOW-001 |
| `chest.members.update` | access, external | SURFACE-010, SPACE-001, ROLE-001 |
| `chest.items.list` | standard | SURFACE-002, SPACE-001 |
| `chest.items.get` | standard | SURFACE-002, CHEST-06 |
| `chest.versions.list` | standard | SURFACE-002, VERSION-001 |
| `chest.access.list` | standard | SURFACE-002, SHARE-004 |
| `chest.pick` | standard | CONNECT-012 |
| `chest.search` | standard, sensitive | SURFACE-002, SEARCH-001 |
| `chest.files.read` | standard, sensitive | SURFACE-003, ROLE-001, VERSION-001 |
| `chest.activity.list` | standard | SURFACE-002, AUDIT-001 |
| `chest.requests.list` | standard | SURFACE-002, SHARE-002 |
| `chest.reports.get` | standard | SURFACE-002, QUOTA-001, ADMIN-002, ADMIN-005 |
| `chest.exposure.list` | standard | SURFACE-002, SHARE-007, AGENT-005 |
| `chest.devices.list` | standard | SURFACE-009, SYNC-003 |
| `chest.movein.status` | standard | SURFACE-002, MIGRATE-001, AGENT-006, CHEST-11 |
| `chest.duplicates.propose` | standard | AGENT-002, SURFACE-004 |
| `chest.devices.revoke` | access | SURFACE-009, SYNC-003 |
| `chest.limits.set` | standard | SURFACE-010, QUOTA-001 |
| `chest.settings.update` | security | SURFACE-010, POLICY-001, POLICY-002 |
| `chest.decisions.record` | standard, commitment | SURFACE-011, CHEST-08 |
| `chest.filing.propose` | standard | SURFACE-004, AGENT-001, RULE-001 |
| `chest.filing.apply` | standard, external | SURFACE-004, AGENT-001, RULE-001 |
| `chest.duplicates.apply` | standard | SURFACE-004, AGENT-002 |
| `chest.rewind` | standard, external | SURFACE-005, RECOVER-001, ADMIN-006 |
| `chest.send` | standard, external, sensitive | SURFACE-008, SIGN-001 |
| `chest.quarantine.list` | standard | SURFACE-010, SECURITY-002 |
| `chest.quarantine.release` | security | SURFACE-010, SECURITY-002 |
| `chest.events.list` | standard | BASE-AGENT-010 |

## People, records and proof

Signed Business `owner_id` binds the native setup owner ID. Signed team IDs bind existing native operator IDs; no email-derived shadow accounts are created. Business owner is owner, a signed team admin is a Business editor, and a member is not a Business editor. A locally promoted native administrator gains no Business policy role. Native operator admission, organization domains, current role/grants, app allowlists, source pauses and MFA remain authoritative. Unknown, inactive and excluded sponsors refuse authentication; matching an administrator email cannot repair an unknown subject. Credentials require the originating consent, and its revocation stops the next effect.

Resources: `chest://item/{id}`, `chest://item/{id}/version/{n}`, `chest://space/{id}`, `chest://request/{id}`, `chest://link/{id}`, `chest://device/{id}`, and `chest://approval/{id}`. The last is an exact-version native review, not a company policy approval. Visibility follows current native access; a restricted record and a missing record both return unavailable. Imported names and external/file text are untrusted. Catalogue metadata omits original text, credential values and bearer URLs.

Company approvals retain the exact server summary and native revision, and execute only after a real named person decides. Filing plans expose their real native Undo; the signed-in reviewer reverses them under current native permission and stale-state guards. The native audit records that reversal as the person with no agent actor. New versions and native activity name the agent and sponsor; mail preparation identifies the agent for the person.

## Capacity and unavailable work

Base protects this installation with 600 requests per minute and a 1 MiB MCP body. Direct original upload/read is limited to 512 KiB; immutable reads support Range and charge the full selected original against any explicit OAuth byte cap. Listing pages hold at most 100 items. These bound request rate and size, not business volume. OAuth grants expire after 24 hours. Their request/mutation/byte caps are optional and apply only if set when granting; pre-existing recorded caps remain in force.

No tool registers provider `cost`, and the journey declares `spend:{none:true}`. Paid Ask, model filing/classification and provider spend caps are unavailable through this door until Base supplies enforceable reservations. Uploading into an enabled native arrival-rule or standing model-filing scope refuses with `agent_arrival_continuation_unavailable` before admitting bytes: it cannot silently authorize a second effect at another destination. Existing human/native automation retains its original policy and is not claimed as adopted by this subset.

The target surface remains wider than this registry. Device queue repair executes in the companion; installation backup/restore requires its independent runner/CLI and a verified continuation binding. Agent signature application needs the native signer-consent lifecycle and completion bridge. Erasure prepare/run and permanent trash purge are undeclared. Search uses native filters and download-safe snippets; access reads show native item grants; request reads omit submissions; member changes cover space membership; settings cover sharing policy; duplicate apply merges a native pair without repointing outside references; sends cover parallel signature envelopes without automatic reminders. Full resumable originals, bulk edits, wipe, staff/admin lifecycle and all other security settings remain gaps.

## Retained decision custody

The door retains arguments, original results, pending approvals, review summaries, trace/audit and events. Once these stores or registered agents exist, native erasure records a visible installation-wide **agent decision custody** hold and retains selected originals and identities. The native pending-erasure publication atomically requires empty agent custody, and an additive SQL admission trigger prevents first agent capture while erasure is pending. A new registration that wins that race refuses erasure instead. This deliberately does not claim client-scoped erasure: retained-artifact mapping, permitted evidence redaction and a complete concurrent-capture fence remain a Base boundary. An owner must not treat a held result as erased. Native audit-identity anonymization also refuses with `agent_decision_custody_held` for an admitted sponsor, rather than leaving retained agent labels behind while claiming anonymization.

Portable and independent archives exclude `agent_door_*` and `bs_*` installation tables. Hosted restore clears them. Product history keeps agent attribution; the restored installation must pair and receive policy again. Old pending actions, decision capabilities and paired identity authority never transfer.

## Verification

Normal `rer verify` runs the production Worker, additive schema, signed native owner claim, real invited reviewers, the declared journey under autonomous and held policies, native filing Undo, policy/refusal/audit checks and read-only native witnesses. `tests/agent-door/network.mjs` is a test-only exact-origin content-scanner edge: it validates native payload size, SHA-256 and a per-run authentication value, then returns realistic clean/infected receipts. All native authorization, persistence, outbox, quarantine and audit paths run for real. Built-in mail edges supply captured invitation/envelope outcomes. No live provider credential is used.
