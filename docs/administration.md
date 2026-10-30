Use **Administration** in the app navigation. Administrative grants are independent of file access: a help-desk or recovery role does not reveal file names, previews, bytes or search results. A person still needs an ordinary space or item role to open content.

The owner can appoint any number of super admins. Super admins manage delegated grants and custom combinations; only the owner changes super-admin grants or offers installation ownership. The console recommends a second super admin, and the live owner cannot be demoted or deactivated. Administrators created through the earlier native auth API become super admins on upgrade and sign in again.

The six delegated privileges are user management, help desk, sharing and security policy, service settings, content recovery, and audit and reporting. Grants cover the whole organization or named groups. Group grants apply to those groups’ people, personal areas and team spaces they own. Organization settings require organization scope; group-specific sharing rules and new-space defaults can be changed within the assigned group. Custom roles combine privileges. Every mutation checks the current identity, role definitions, grants and groups in its database transaction. Administrative changes and uses are audited.

Help desk can inspect or revoke sessions and devices and, after independently verifying a person, send a one-use factor enrollment reset valid for 24 hours. It cannot change policy without the corresponding privilege. User management can invite, change group membership, deactivate/reactivate, or offboard a person to an active successor. Offboarding leaves team content in place and hands the departed personal area to the successor without changing file IDs or versions. Reactivation does not revive old sessions or devices.

Content recovery prepares a plan for a space or a person’s personal areas, including a transferred departed account. It lists opaque record IDs, exact version changes, rename and hierarchy effects, and sharing/membership changes. A content-authorized colleague can identify the IDs to select. Recovery creates attributed new states, retains later versions and conflict names, and keeps revoked identities and sharing denied. A completed selection distinguishes restored records from records not selected. Removing the recovery grant refuses the next preview or apply. Recovery does not confer content access.

Administrative reporting opens from Administration. Activity filters cover team group, actor, exact action, opaque object ID, outcome, inclusive UTC dates and sharing/guest/download/sync/transfer/AI/editor categories. Cursor pages apply current scope before pagination; the CSV includes all matching pages up to the report time. A revoked grant refuses the next page or export. Activity for a file follows its area’s administrative custody, so guests and automation are included without granting content access. The existing audit view-hiding rules still apply. Audit events have no automatic expiry; erasure anonymizes identities. The file activity log remains a separate content-authorized door.

Storage report shows each selected personal/team area’s retained original bytes against its effective limit and a separate Library row. Duplicate SHA-256 originals count once across the selected scope. Current, previous, trash and quarantined/rejected request bytes form nonoverlapping buckets, with priority in that order; an original still used live never appears again in trash. Descendants of trashed folders count as trash. Per-area totals overlap when areas share originals; use the separately deduplicated total. Derived copies, staging, backups and unreferenced provider objects are excluded. This is a current snapshot, independent of activity date filters. Both activity and storage exports carry metadata, never file names or contents.

Organization service-settings administrators record a named provider, quote or source and decimal-GB storage and egress USD rates at Provider rates; confirmation is required and before and after values are audited. Organization reporting administrators can read the rates; group-only roles cannot. Storage estimates use current retained bytes / 1,000,000,000 × the recorded GB-month rate, rounded to six decimal USD places. They describe a current monthly run rate, not historical usage, a provider invoice or live pricing. Saving rates enables no provider work. Complete billed egress, dated AI and provider spend, and real Collabora edition, capacity and refusal accounting remain ADMIN-002 work. The guest inventory is delivered; original-stream estimates are described below. Other costs remain unknown.

For ownership transfer, the owner signs in freshly and offers ownership to an active super admin. Choose explicitly which administrative grants the former owner should retain; none means ordinary staff. The recipient signs in again after the offer, then accepts or declines in Administration. Acceptance is atomic, invalidates both participants’ sessions and pending old-owner authority, and notifies both people by email and in-app. Both sign in again. File ownership, versions, grants and content roles remain separate from installation ownership. The freshly signed-in new owner can change super-admin grants; the former owner cannot. Direct role changes through the earlier identity endpoint remain refused, including demotion of the last administrator. That refusal records its actor, target, requested role and outcome in the public owner audit history, with existing identity-erasure redaction.

## External guest evidence

The administrative activity page includes a current guest-evidence snapshot. Select a team group and optionally filter Guest email or audience, then use Export guest CSV for every matching record. The API doors are `GET /api/chest/administration/guests` and `/api/chest/administration/guests/export`, with `group`, `email` (case-insensitive identity/audience substring) and `evidence` filters. They use the current audit-and-reporting grant and content-custody scope on every request; that role grants no file contents or names.

External-guest reporting is a current snapshot of shared-link audiences and retained file-request submission evidence under the same content-custody administrative scope. Configured recipient addresses prove no visit; completed email verification is historical evidence, never a live-session count. Domain and anonymous audiences have no known person count, and self-reported submitter addresses remain unverified. Existing view-history privacy choices and identity-erasure redaction apply; activity date filters do not apply to this snapshot.

Each row identifies its source and item by opaque ID, evidence kind and recorded time, link state/expiry and custodian. Pending verification mail does not prove verification. A revoked link can retain historical verification evidence while granting no current access. File-request rows describe historical submissions, not ongoing access to the library. Neither report nor CSV includes link tokens, password material or outstanding challenge secrets. The page shows up to 100 matching records and explicitly directs larger inventories to the complete CSV.

## Measured original egress

Administrative activity includes measured original egress and a complete CSV for the selected group and inclusive UTC request-start dates. File originals, Library originals, device hydration, shared-link originals and delivery packages record bytes emitted by their response streams. Repeated requests and overlapping ranges count again. A cancelled stream records only its emitted prefix. Refusals emit no original bytes. The report obeys current custody scope, view-history privacy and identity erasure; it contains opaque item IDs and no file names, content, link credentials or visitor identities.

Each receipt snapshots the confirmed provider, quote, rate date and USD rate per decimal GB before streaming. Its estimated USD amount is rounded to nine decimal places, then summed; changing rates never reprices an old receipt. Bytes without a rate remain explicitly unknown. Dates select the recorded request start; the CSV also preserves that timestamp. These estimates do not establish provider billing or human receipt. A process crash leaves the last durable confirmed prefix and reserved upper bound; unfinished reservations become uncertain. Rendered previews, selection archives and signing PDFs also have stream receipts. Provider calls have separate dated receipts described below. Restore and other portability billing and live Collabora reconciliation remain ADMIN-002 gaps; the current backup and AI coverage is described below.

## Dated usage and editor capacity

The activity report exports dated provider requests and emitted response streams separately. Each receipt retains its confirmed quote when work starts, so replacing a rate never reprices earlier work. AI quotes match the configured provider identifier and model exactly; use `request` as the model for a non-AI request fee. Missing usage and unquoted cached price tiers stay unknown. Outbound request bytes have a separate estimate from the named network provider. These estimates are not invoices.

Stream checkpoints precede each chunk. Cancellation records the emitted prefix; an interrupted receipt retains confirmed bytes and the uncertain reserved upper bound. Organization selection totals include ZIP framing. Scoped selection totals count original member bytes at the enclosing ZIP output checkpoint. Preparing chunks during ZIP assembly does not count as output. Earlier assembly-only member receipts retain that historical basis in their rows and CSV; they are not relabeled as emitted output. Each member retains a confirmed prefix and uncertain reserved bytes; headers, paths, framing and the manifest remain organization-only. Member chunks remain in current custody, without shared framing or another area's contents. Historical traffic before instrumentation is excluded.

Under Provider rates, confirm the Collabora edition, reported limit source, document and connection ceilings and annual provider quote before enabling new sessions. CODE costs USD 0 and requires its development and home-use warning to be acknowledged. A subscription quote is an owner-entered per-user annual estimate. Admission checks both limits atomically. A reservation lasts at most 30 minutes and is released by an acknowledged close; a lost close waits for expiry. Lowering limits or disabling new admissions preserves open sessions. Reports count every Chest capacity refusal and export the limit and current use. They do not claim provider-side connection measurement.

Restore and other portability billing, operation-specific object-store prices and inbound transfer costs, and live provider-side Collabora licensed edition, capacity and refusal reconciliation remain unfinished under ADMIN-002.

### Dated cache quotes and service observations

Provider rates can quote cache reads, five minute cache writes and one hour cache writes per decimal million tokens. Anthropic input excludes cached units; OpenAI prompt totals include cached reads, so only the remainder uses the ordinary input rate. A reported nonstandard service tier needs an exact service-tier quote. Missing tiers or invalid counts remain unknown. Replacing a quote never reprices retained receipts.

Read service capabilities explicitly queries the configured Collabora service and records only its product name, version and observation time. The public endpoint does not expose licensed edition, connection ceilings or live capacity. Owner-entered limits retain their own label. Browser-reported editor errors are deduplicated by session and kind, carry no provider diagnostic text, and appear separately from Chest admission refusals. They are not a provider-side census.

Independent backup database export and object-store requests retain intent before the network call, response byte checkpoints, outcome and the quote at request start. Listings, original reads, multipart upload bodies and encrypted readbacks are included. Unfinished requests remain uncertain; metadata contains neither signed request details nor object keys. Restoration, other portability traffic, operation-specific object-store prices and inbound transfer prices remain unreconciled, so ADMIN-002 remains partial.

## Portability and object-store estimates

The owner confirms optional object-store rates under Provider rates. Enter USD
per million requests in each named operation field. Missing
operations remain unknown; a quoted zero is different from a missing rate.
Provider inbound means payload bytes sent to the named store; provider outbound
means bytes received from it, using decimal GB. These charges and the separate
network estimate may overlap, so they are not added into a purported invoice.
Each receipt retains its operation, quote date, rates, confirmed bytes and
uncertain response bound even after rates change.

Legacy hosted backup and restore and independent backup, restore, verify, list
and prune commands retain a private metadata journal under the current user's
`~/.rer/chest-accounting` directory. `CHEST_ACCOUNTING_DIR` selects another private
directory. The journal contains no object keys, signed URLs, request bodies or
credentials. It records requests before sending them and response checkpoints
before returning bytes. D1 file imports use the provider's upload and ingestion
protocol, including control calls. Receipts survive audit-table replacement and
are replayed by their IDs after successful commands for that target; completed
replay removes the local pending receipt. An interrupted or refused restore can
leave pending receipts locally; run a successful verification or list command with the same target and journal
directory to reconcile them. Failed validation leaves the remote target unchanged. Keep
the private directory through recovery. Commands on the same computer serialize
per target; a second command is refused until the active command finishes. A
command interrupted by process exit leaves a stale claim that the next command
recovers before reconciling the durable receipt journal. Local exports with no provider traffic
do not establish a provider charge. Historical uninstrumented traffic is unknown.

## Collabora reporting boundary

Licensed edition, document and connection limits and annual USD per user are
administrator-recorded from a named quote. Read service capabilities performs an
explicit audited probe and shows the reported product, version and observation
time. It cannot independently verify a subscription or licensed limits.
Reports retain every Chest admission refusal and match each new browser-reported
provider outcome to its Chest admission. Older outcomes without a session remain
unmatched. Provider-side live capacity and completeness of provider refusal
reporting remain unknown. This is the conservative ADMIN-002 default; it does not
claim provider verification or close that contract gap.

## Accounting and reporting rules moved from the contract

Moved out of CONTRACT.md on 28 October 2026; the contract links here where it needs these rules.

- For reporting, activity dates are inclusive UTC instants;
- CSV exports include every matching page under current administrative scope.
- Storage is a current retained-original snapshot, deduplicated by SHA-256 across selected areas.
- An original is assigned once to live current, otherwise live previous, otherwise trash (including descendants of trashed folders), otherwise quarantined/rejected request custody; per-area totals can overlap and are never summed into an organization total.
- Provider rates are explicitly confirmed owner-entered USD estimates, using decimal GB (1,000,000,000 bytes), a current monthly storage run rate rounded to six decimal places, and a named quote/source; they are not invoices, live prices or authority to enable paid work.
- Stream receipts reserve each output chunk durably before emission.
- A lost completion is uncertain, with confirmed bytes and the reserved upper bound kept separate; no restart fabricates delivery.
- Organization selection totals include ZIP framing, while scoped totals include only original member bytes at the enclosing ZIP output checkpoints under current custody.
- Provider-call receipts snapshot the confirmed quote at request start; reported uncached input and output tokens use decimal millions, and request fees and network estimates remain separate provider charges.
- Anthropic input excludes cache units;
- OpenAI prompt totals include cache reads, which are subtracted before uncached pricing.
- Cache read, five minute write and one hour write quotes use decimal millions; a nonstandard provider service tier requires an exact tier quote.
- Collabora admission counts unexpired Chest session reservations of at most 30 minutes, checks document and connection ceilings atomically and records each Chest refusal; an acknowledged close releases that reservation.
- Provider-side disconnection is not inferred.
- Portability receipts preserve operation-specific confirmed quotes and separate provider inbound and outbound decimal GB estimates.
- Private local receipt journals contain metadata only, survive database replacement and replay idempotently; a lost completion remains uncertain.
- Licensed editor limits are administrator-recorded from the quote, with product and version from an explicit audited probe.
- Provider-side capacity stays unknown; browser outcomes reconcile to Chest admissions and never claim complete provider verification.
- ADMIN-002 reports the configured Collabora edition, administrator-recorded licensed limits and costs, Chest reservations and refusals, and attributed observed provider outcomes.
- Independent provider-side enforcement is not inferred from those records;
- External-guest reporting is a current snapshot of shared-link audiences and retained file-request submission evidence under the same content-custody administrative scope.
- Configured recipient addresses prove no visit; completed email verification is historical evidence, never a live-session count.
- Domain and anonymous audiences have no known person count, and self-reported submitter addresses remain unverified.
- Existing view-history privacy choices and identity-erasure redaction apply; activity date filters do not apply to this snapshot.
- Durable stream receipts now cover original doors, rendered and extracted previews, ZIP64 selections and signing PDFs; cancellation retains emitted prefixes and interrupted checkpoints retain uncertain upper bounds.
- Scoped archive receipts now use the enclosing ZIP output checkpoints, excluding headers, paths, framing and the manifest; generation ahead of output is not counted as emission. tests/chest/administration-accounting-flow.mjs (accountingJourney) reconciles cancelled member bytes to the enclosing ZIP prefix and preserves them across restart.
- Dated AI and provider calls preserve confirmed quotes, reported units and separate network estimates without historical repricing.
- Confirmed Collabora edition, price, CODE warning, atomic document and connection reservations, close and expiry, scoped refusal reports and CSV are implemented.
- Independent backup database export control calls, signed SQL downloads and object-store calls now record durable request reservations and response checkpoints for listings, multipart uploads, original reads and encrypted readbacks, without object keys or credentials.
- AI quotes distinguish Anthropic uncached input from OpenAI inclusive prompt totals, cache reads, five minute and one hour writes, and exact service tiers; missing or malformed units, unmatched tiers and models remain unknown.
- Saved receipts preserve their quote across restart and replacement.
- An explicit audited Collabora capability probe records the service product and version; authenticated editor sessions retain deduplicated browser-reported refusal kinds separately from Chest admission.
- Legacy hosted backup and restore, independent restore, verification and retention now use durable provider transport receipts, including D1 export, private SQL download, SQL upload, import control calls, multipart originals and readbacks.
- A private metadata journal preserves receipts across database replacement and interruption, and replays them by receipt ID after a successful command; validation failure leaves the remote restore target untouched.
- Confirmed object-store quotes distinguish list, read, write, delete and each multipart operation, plus provider inbound and outbound decimal GB estimates, with missing rates unknown. tests/chest/administration-accounting-flow.mjs (accountingJourney, including portabilityJourney) proves those paths, immutable operation quotes, scoped reports and the conservative editor default at 1440 and 390.
