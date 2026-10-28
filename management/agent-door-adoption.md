# Agent-door adoption preparation — blocked

Brief date: 28 October 2026. Seed main and contract surface:
`61988404ee980320a98249f9997273465ac6d4e7`.

## Source prepared

Base runtime source is pinned to `d555e789cffb744a9f83d76ebe42a2e3bdd7a055`.
The npm version check returned a latest published version of `0.2.85`, below
`0.2.86`. The conformance supplier is therefore the unreleased pinned checkout,
`node ../base-agent-door/global/rer.mjs`, rather than the installed Chest CLI
`@runeditrun/rer@0.2.80`. No release/runtime repin was available.

This change copies runtime source for agent-door and business-settings and adds
migrations `0029_business_settings.sql`, `0030_business_people.sql` and
`0031_agent_door.sql`. It records the copies with the installed authoring tool,
including the one Business settings import adaptation to Chest's existing theme
helper. Test signers, fixtures, module tests and conformance code stay in the
supplier checkout. Applied migrations and existing tests are unchanged.

The copied door is not mounted. There is no claimed agent registry, policy
adoption or conformance success. The current application continues to use its
existing integration door until a complete compatible adoption can replace it.
No CONTRACT.md clause or generated acceptance status changes in this preparation.

## Supplier changes required

1. **Opaque native revisions.** Chest `Row.revision` is a UUID string
   (`src/chest/model.ts`, `files/repo.ts` and `store.ts`). Base's
   `ToolDefinition.revision` allows only `number | null`; `registry.ts` reserves
   `expected_revision` and injects an integer schema. `pipeline.ts` validates
   before comparing it and saves a numeric revision into `approvals.ts`.
   `approval-execution.ts` compares it again. A direct native revision hook
   fails TypeScript with TS2322 (`Promise<string>` is not assignable to
   `Promise<number | null>`). Hashing, truncating, casting or omitting the
   revision cannot preserve the actual native witness. Base needs to carry an
   opaque string revision through validation, admission and pending execution,
   separately from numeric company-policy revisions.
2. **Contract tool names.** SURFACE-001 requires the table's exact names. Base's
   runtime registry and static surface validator demand three segments and
   reject `chest.search`, `chest.ask`, `chest.pick`, `chest.share`, `chest.send`,
   `chest.rewind` and `chest.sign`. The 48-name contract inventory contains
   seven rejected names. No contract permission exists to rename them.
3. **Retained MCP era.** SURFACE-001 acceptance 6 requires `2025-03-26` on
   `/mcp/chest`. Pinned Base exports only `2026-07-28` and `2025-11-25`.
   A seed-side parallel transport would contradict the one-door requirement.

Default: obtain a corrected Base pin supporting these native revisions and
contract names/era; preserve Chest's existing schema and contract. Do not add
an alternate transport, numeric shadow revision, raw-SQL bootstrap or synthetic
capability. Native receipt recovery also needs design: Base strips the caller's
idempotency key before native execution and exposes no execution identity;
Chest's existing atomic receipts use that identity in `integrations/mutations.ts`.
Base's durable call claim prevents blind resend but does not reconcile an
interrupted native commit to its existing receipt.

## Contract inventory, not an installed registry

Every row below comes verbatim from the accepted Agent surface table's names,
classes and clause references. These are planned mappings, not tools installed
by this preparation. The current nine MCP tools remain the legacy underscore
names in `src/chest/integrations/mcp.ts`; no resource registry exists yet.

| Required tool | Required classes | Native clause references |
| --- | --- | --- |
| `chest.items.list` | standard | SPACE-001, CHEST-06, CHEST-13, SHARE-004 |
| `chest.items.get` | standard | CHEST-06, ROLE-001, SECURITY-002 |
| `chest.search` | standard (+ sensitive) | SEARCH-001, SEARCH-003, SEARCH-002 |
| `chest.versions.list` | standard | VERSION-001, CHEST-07 |
| `chest.files.read` | standard (+ sensitive) | VERSION-001, ROLE-001, CHEST-06 |
| `chest.access.list` | standard | SHARE-007, SHARE-004, SHARE-008, SHARE-009, SHARE-005, CHEST-10 |
| `chest.activity.list` | standard | AUDIT-001 |
| `chest.requests.list` | standard | SHARE-002 |
| `chest.reports.get` | standard | QUOTA-001, ADMIN-002, ADMIN-005 |
| `chest.exposure.list` | standard | SHARE-007, AGENT-005 |
| `chest.events.list` | standard | CONNECT-007, CONNECT-006 |
| `chest.devices.list` | standard | SYNC-003 |
| `chest.movein.status` | standard | MIGRATE-001, AGENT-006, CHEST-11 |
| `chest.ask` | standard (+ sensitive) | AGENT-007 |
| `chest.pick` | standard | CONNECT-012 |
| `chest.files.upload` | standard or external | CHEST-03, TRANSFER-001, TRANSFER-002, VERSION-001 |
| `chest.files.create` | standard or external | EDIT-004, EDIT-013 |
| `chest.folders.create` | standard | SPACE-001 |
| `chest.items.update` | standard or external | CHEST-02, CHEST-04, CHEST-09, BULK-001 |
| `chest.versions.restore` | standard or external | VERSION-001 |
| `chest.versions.name` | standard | VERSION-001, CHEST-07 |
| `chest.items.trash` | standard | CHEST-13 |
| `chest.items.untrash` | standard or external | CHEST-13 |
| `chest.comments.add` | standard or external | EDIT-003, FOLLOW-001 |
| `chest.share` | standard or external | SHARE-004, SHARE-008, SHARE-009, SHARE-005, SHARE-010, CHEST-10, ROLE-001, POLICY-001 |
| `chest.links.create` | standard or external | SHARE-001, SHARE-006, POLICY-002 |
| `chest.access.narrow` | standard | SHARE-007, AGENT-005 |
| `chest.requests.create` | standard | SHARE-002 |
| `chest.send` | standard or external (+ sensitive) | SHARE-002, SHARE-003, SIGN-001, AGENT-004 |
| `chest.filing.propose` | standard | AGENT-001, RULE-001 |
| `chest.filing.apply` | standard or external | AGENT-001, RULE-001 |
| `chest.duplicates.propose` | standard | AGENT-002 |
| `chest.duplicates.apply` | standard or external | AGENT-002 |
| `chest.rewind` | standard or external | RECOVER-001, ADMIN-006 |
| `chest.devices.repair` | standard | AGENT-003, SYNC-003 |
| `chest.limits.set` | standard | QUOTA-001 |
| `chest.erasure.prepare` | standard | ERASE-001 |
| `chest.erasure.run` | destructive | ERASE-001 |
| `chest.trash.purge` | destructive | CHEST-13 |
| `chest.devices.revoke` | access (+ destructive, + security) | SYNC-003 |
| `chest.spaces.create` | standard or access | SPACE-001, SPACE-002 |
| `chest.members.update` | access (+ external) | CHEST-01, ROLE-001, ADMIN-003 |
| `chest.settings.update` | security | POLICY-001, POLICY-002, SPACE-002, ADMIN-001, ADMIN-004, SECURITY-001, SECURITY-002, SECURITY-004, SECURITY-003, SECURITY-005 |
| `chest.quarantine.release` | security | SECURITY-002 |
| `chest.backup.run` | security | CHEST-12, RECOVER-002 |
| `chest.backup.restore` | destructive · security | CHEST-12, RECOVER-002 |
| `chest.decisions.record` | standard or commitment | CHEST-08 |
| `chest.sign` | commitment | SIGN-001 |

The required resources are `chest://item/{id}`,
`chest://item/{id}/version/{n}`, `chest://space/{id}`,
`chest://request/{id}`, `chest://link/{id}`, `chest://device/{id}` and
`chest://approval/{id}`. None is declared by this preparation. Their readers
must reuse current native ACL/download/admin checks, return indistinguishable
missing/restricted results, classify the record and mark external text untrusted.
They must strip secret tokens, PIN/password hashes, credentials and bearer URLs.

The eventual notTools declaration must retain the contract's device, screen,
import-door, connector and installation clause groups. High risk is not a
reason to exclude an implemented native verb.

## Native authority and lifecycle decisions

Authentication authority is `oa_operators.id`; portable `chest_records.person`
rows are an email-keyed projection and cannot authenticate sponsors. The
PeopleAdapter must resolve `sub` only through signed `bs_settings.owner_id`
or `bs_team.business_id -> operator_id`, then reread native status/admission.
Business owner maps to the current native owner; Business admin maps to its
bound native operator and Business editor; Business member maps to its bound
native operator with no Business policy role. Chest administrative authority
comes from current `admin-grant`, role and group records, not OA `admin` alone.
A local promotion must not create a Business editor.

Native session reads must use `operatorAuth(env).getSession(request)`, keeping
company-domain and MFA checks. Chest currently declares no AUTH_ALLOW_LIST;
there must be no separate agent-only admission list. Future native mutation
principals must carry the real SQL credential predicate into `commit`, preserve
resource snapshots and call the same services as the UI. Local integration
credentials retain their grant folders/actions/budgets and cannot be widened
by converting them into a person-wide session.

The required refusals (unknown subject despite matching owner email, inactive or
inadmissible native person, and exclusion by a configured native allowlist)
are not verified by this preparation. Neither are consent revocation, scoped
Business calls, queued execution or owner/admin/member binding. They remain
acceptance work after the hook blockers are removed.

The manifest declares **setup-token** bootstrap: production `POST /auth/bootstrap`
uses `OWNER_EMAIL` and `SETUP_TOKEN` and atomically creates the owner/session.
It also has a real `/setup` confirmation form. `/auth/owner-claim` separately
supports signed managed admission when configured; a raw setup token must never
be posted there. No initializer, direct SQL or verification-only route is added.

## Providers and unsupported targets

Reachable native providers include configured OpenAI-compatible/Anthropic
classification, reading and Ask, an external content scanner, installation mail
and signed webhook receivers. A future journey needs exact test-only provider
origins and request/signature validation for each reached non-built-in edge;
none is declared or falsely exercised here. R2 blob bindings are native custody,
not a substitute provider adapter. Full backup execution uses the independent
runner's Cloudflare/R2/S3 authority rather than a browser session.

The supported code is narrower than several contract targets: general device
pause/retry/cache wipe, provider-spend accounting, a custom model tool loop and
agent-driven full backup restore are absent. The public signature flow binds
signer session, PIN/consent and a secret invitation; an MCP tool cannot replace
that authority with agent confirmation. The erasure and send targets need
native service decomposition, not mocked execution. Existing filing, duplicate,
collection and exposure workflows do exist but have not entered the shared
registry. Their current native permission and approval checks remain binding.

No provider `cost` is registered. The eventual journey must use
`spend: {none: true}` and state Base's unenforced spend/byte limits. No new
money, accounts, gated or live classification is justified by this seed's code.

## Verification status

The one-off compatibility probes are retained outside source under the run's
`probes` and evidence directory. The seven `BASE-AGENT-013.surface.*.name`
failures are static declaration checks, not successful native journey points.

Required command after the supplier fixes:

```sh
node ../base-agent-door/global/rer.mjs verify
```

That full command is not run on this blocked, unmounted preparation: there is
no truthful native agent-surface journey to execute. **Executed normal
BASE-AGENT point list: empty; point count: 0. Specialist journey: BLOCKED.**
An undeclared check is a failure of the adoption outcome even if ordinary CI
passes for this source preparation. No CI result may be cited as door adoption.

Touched validation uses the existing production build and public integration
journey with all migrations, plus typecheck and source/copy integrity checks.
No existing assertion is weakened, skipped, removed, retried or given a longer
timeout. No new permanent test is added. No native screen changes in this change.
