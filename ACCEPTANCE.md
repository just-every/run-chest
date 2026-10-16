# Verify a Chest installation

[CONTRACT.md](CONTRACT.md) is the 16 October 2026 target product, including work not delivered today. The status of each journey below describes current code/test coverage at `2f3bbf6c237545b96c6f072de2507074535d7565`; it is not a claim that future clients, providers or AI workflows passed. All existing CHEST IDs are retained.

## Source verification

Use the pinned Node and pnpm versions and frozen dependencies in a fresh clone. Run `rer verify` for build, typecheck and current public HTTP flows. Run `CHEST_TEST_CHECKOUT=1 pnpm run test:journey` only in a disposable genuine fresh clone: it exercises ordinary identities, responsive browser pages at 1440 and 390 and complete export/restore. Never use that switch on owner data. See [README.md](README.md) and [RUN-LOCALLY.md](RUN-LOCALLY.md) for setup and commands. Check the Verify workflow on the exact source revision you intend to adopt.

For a document-only contract change, check clause uniqueness, preservation of existing IDs, one-to-one acceptance/status coverage and cited paths, plus any repository document checks; do not invent implementation results. CI remains the full source wall. Public-door tests for new work should be added when that workflow is built, with fakes only at a paid/network boundary; real-provider acceptance remains separately identified.

## Installation acceptance

Before moving records, reconcile representative incumbent originals, folders, versions, people, timestamps, rights and missing history. Source fixtures do not establish proprietary export fidelity or reduced costs. Each required provider/device journey below needs real test tenants/devices and recorded outcomes before being called accepted; deterministic fixtures can prove error behavior, not live integration availability. Use authorized test data with realistic US business folders, ordinary Office files, scans, a multi-GB creative asset, a vendor guest and a departing employee. Never place private archives or credentials in source/served assets.

Before upgrading, back up privately and test the candidate on a populated prior-release copy. Check ordinary sessions, owner/settings, source records, history, rights and original bytes, then exercise rollback. Empty-target restore alone does not establish an in-place upgrade. For new browser/mobile/admin screens, use the full journey at 1440 and 390, keyboard/screen reader, and honest loading/failure/end states; desktop/native device behavior requires supported OS devices as well. Hosted mail, processing, identity, provider limits and independent backup acceptance use the owner's infrastructure/accounts. Read [ARCHIVE.md](ARCHIVE.md) for current bounded move-in and legacy-backup limitations.

## Clause acceptance journeys

Each entry is the public evidence required for its matching clause. `done` entries cite current source and tests; `partial` entries identify the incomplete portion; `missing` entries are build targets, not successful checks. Repeat an access-sensitive journey after revocation and a durable workflow after restart where specified.

### Identity, original custody and governed records

**CHEST-01 — Owner and ordinary staff identity (done).** Through setup, invitation, sign-in and the library API, reject a second claim, revoke a live session, deactivate/reactivate staff and prove prior sessions stay invalid. Exercise owner and reviewer in the built browser journey.

Current evidence: `src/chest/identity.ts`; `tests/chest/flows.mjs` (CHEST-01); `tests/chest/journey.mjs`.

**CHEST-02 — Typed filing without lost values (done).** Create and edit a type through the owner form/API; preserve an old record unchanged while diagnosing it, reject invalid new values and hide diagnostics from an outsider.

Current evidence: `src/chest/metadata.ts`; `src/chest/fields.ts`; `tests/chest/flows.mjs` (CHEST-02).

**CHEST-03 — Validate before publishing originals (done).** Upload an original through the document API, compare its retained hash/size and download bytes, and submit bad checksum, size and filing values without creating a visible record.

Current evidence: `src/chest/blobs.ts`; `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-03).

**CHEST-04 — Accountable filing and safe moves (done).** Move a reviewed file through the filing API between differently shared collections; reject a source-only editor, then prove new readers gain access and former readers lose search/download access without changed versions.

Current evidence: `src/chest/metadata.ts`; `tests/chest/flows.mjs` (CHEST-04).

**CHEST-05 — Safe basic previews (done).** Open text, PDF and raster previews from the built document page at 1440 and 390; download an unknown original, and verify sandbox/no-store/nosniff headers and inactive SVG.

Current evidence: `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-05); `tests/chest/browser-flow.mjs`.

**CHEST-06 — Current access governs every private door (done).** Search distinctive admitted text as owner, reviewer and outsider, then revoke a group grant and repeat list/count/detail/preview/download/mutation requests, including old version URLs.

Current evidence: `src/chest/access.ts`; `src/chest/api.ts`; `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-06, CHEST-10); `tests/chest/browser-flow.mjs`.

**CHEST-07 — Immutable versions and precise approved pointers (done).** Upload A, B and C through the versions API, approve B explicitly and download each original, proving the approved pointer and earlier bytes never silently change.

Current evidence: `src/chest/documents.ts`; `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-07); `tests/chest/journey.mjs`.

**CHEST-08 — Exact-version human decisions (done).** Request changes, reject approval of the rejected version and an unassigned actor, submit corrected bytes, and approve that exact version while preserving prior events and the earlier approved pointer until approval.

Current evidence: `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-08, CHEST-10); `tests/chest/journey.mjs`.

**CHEST-09 — Review and expiry work retain evidence (done).** Create both dates, inspect the work list, reject an empty completion and complete only review with evidence; expiry and originals remain.

Current evidence: `src/chest/documents.ts`; `src/chest/ui-library.ts`; `tests/chest/flows.mjs` (CHEST-09); `tests/chest/browser-flow.mjs`.

**CHEST-10 — People and group grants (done).** Grant a group, inspect effective readers, remove its member and revoke collection access through the API; prove denial of details, search, previews, downloads and review mutations.

Current evidence: `src/chest/access.ts`; `src/chest/metadata.ts`; `tests/chest/flows.mjs` (CHEST-10); `tests/chest/restore.mjs`.

**CHEST-11 — Reviewed reversible archive admission (done).** Preview/apply a bounded archive through the archive API, reject changed fingerprint/traversal/corruption, restart and resume, undo untouched records and preserve a conflicting native edit. Source decisions never become new Chest approvals.

Current evidence: `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs` (CHEST-11); `tests/chest/journey.mjs`.

**CHEST-12 — Complete independent local recovery (done).** Use real RER export/import in a fresh target, compare all portable cells and original chunks, reject corrupt/nonempty/tampered metadata restores and public-asset exposure, then sign in afresh and recheck private imported records and trash.

Current evidence: `scripts/installer/local.mjs`; `scripts/check-public-assets.mjs`; `tests/chest/restore.mjs`; `tests/chest/journey.mjs`.

**CHEST-13 — Reversible trash and mutation audit (done).** Trash and restore through the API and browser; prove disappearance for a reviewer, owner-only recovery with identical versions and a visible audit action.

Current evidence: `src/chest/documents.ts`; `src/chest/store.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-13); `tests/chest/journey.mjs`.

### The everyday business file system

**SPACE-001 — Team spaces and ordinary files (partial).** As two staff and an admin, build a nested project tree, upload an ordinary file with no review configuration, edit/move it, restrict a subfolder and offboard its creator; the team retains content and stable links while the former user is denied. Repeat browser navigation at 1440 and 390.

Current evidence: `src/chest/metadata.ts`; `src/chest/access.ts`; `tests/chest/flows.mjs` (CHEST-02, CHEST-04). Remaining: Collections and access exist; folder trees, ordinary untyped files, team ownership and delegation do not.

**TRANSFER-001 — Resumable files and whole-folder uploads (partial).** Upload a nested folder containing a large video and duplicate names, interrupt connectivity and restart the client, then resume and compare hashes/tree/counts; cancel another transfer and prove no false success or half-visible file. Test a quota refusal and retain completed files.

Current evidence: `src/chest/blobs.ts`; `src/chest/documents.ts`; `src/chest/archive.ts`; `tests/chest/flows.mjs` (CHEST-03, CHEST-11). Remaining: Single bounded originals/archive admission only; no folder or resumable large transfer.

**SYNC-001 — Windows and macOS filesystem clients (missing).** Install on real supported macOS and Windows devices, sign in, open an online-only Office file from Finder/Explorer, save and observe its new server version from a second device. Switch mirror/stream modes, pin a folder, sign out and uninstall with unsent edits; show exact disposition of local work.

Current evidence: —.

**SYNC-002 — Offline edits and lossless conflict reconciliation (missing).** Edit a pinned file offline while another staff member changes it remotely, switch sync mode and reconnect; inspect both originals and resolve explicitly. Repeat delete-versus-edit, case rename and permission revocation, proving no silent overwrite or unauthorized remote write.

Current evidence: —.

**SYNC-003 — Visible sync operations and device control (partial).** Disconnect a device during transfer, exceed its cache/disk quota and revoke it; its tray and admin console show accurate unfinished work and last contact. Resolve the cause and verify hashes before showing up-to-date; an unreachable wipe stays unconfirmed.

Current evidence: `src/chest/blobs.ts`; `src/chest/ui.ts`; `tests/chest/flows.mjs` (CHEST-03). Remaining: Upload success/error exists; device fleet, progress and sync queues are absent.

**SYNC-004 — Creative assets stream and lock safely (missing).** Open and seek a large video in Final Cut Pro, save a Photoshop asset and AutoCAD drawing from two clients, record transferred ranges and verify final checksums/version IDs. Compete for a lock, kill its holder and recover without losing either writer; open the same file from its browser page.

Current evidence: —.

**SYNC-005 — Hybrid local cache and storage (missing).** Connect two office clients and a remote client to a scoped cache, disconnect WAN and expire offline authorization, edit permitted pinned files, then reconcile conflicts and verify all final hashes and access. Replace the cache and recover from owner storage.

Current evidence: —.

**MOBILE-001 — Native iOS and Android file access (partial).** On real iOS and Android devices, capture a multi-page scan, upload photos, share with a permitted recipient, open/save through a system picker, and edit a pinned file offline while another device changes it. Reconnect, resolve the conflict and revoke the device; show the limit of an unreachable cache wipe.

Current evidence: `src/chest/ui-library.ts`; `src/chest/documents.ts`; `tests/chest/journey.mjs`. Remaining: Responsive browser browse/upload exists; native apps, camera, background/offline sync and mobile sharing do not.

### External exchange, previews and collaboration

**SHARE-001 — Policy-controlled external links (partial).** Share a restricted folder and pinned approved file with an external recipient; try wrong password, wrong domain, guessed child URLs, expired/revoked links and parallel downloads at the count limit. Confirm approved-only never reveals pending replacements and a revoked link fails on the next request.

Current evidence: `src/chest/access.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-06, CHEST-10). Remaining: Private identity ACLs exist; external links and per-link policies are absent.

**SHARE-002 — Upload-only file requests (missing).** Send a vendor request, submit from a signed-out phone, interrupt/resume a large upload and receive its receipt. Try another submitter’s files, path traversal, disallowed content and an expired/closed request; verify none grants library access.

Current evidence: —.

**SHARE-003 — Delivery receipts and large-file transfers (missing).** Send a multi-GB package to an invited recipient and a public recipient; interrupt/resume download, exercise the limit and inspect view/download/confirmation events. A mail scanner GET and successful email API response must not set human receipt; expiry stops new range requests.

Current evidence: —.

**PREVIEW-001 — Office, Google, video and design previews (partial).** Open representative Office, native Google, video, Photoshop and CAD files from the file page. Revoke access while a preview is open and request fresh pages/ranges; deny them. Test corrupt/malicious files and processor outage, expose the exact failure and keep the original downloadable to an authorized user.

Current evidence: `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-05); `tests/chest/browser-preview.mjs`. Remaining: Only basic PDF/raster/text previews exist; no broad renderer or processor.

**SEARCH-001 — Full-text and scanned-content search (partial).** Upload a scanned invoice, Office spreadsheet, Google document and encrypted PDF, find distinctive contents and filter by folder/version. Show OCR provenance and the encrypted-file gap; revoke a group before index refresh and prove zero leaked snippets/counts/autocomplete through search API and UI.

Current evidence: `src/chest/api.ts`; `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-06). Remaining: Title/metadata and bounded admitted UTF-8 search only; OCR/broad extraction/indexing are absent.

**EDIT-001 — Office and independent browser co-authoring (missing).** Two real accounts co-edit a document, spreadsheet and slide deck through Chest, verify concurrent changes and saved versions, then revoke one user mid-session and reject their next save. Round-trip tables/formulas/comments and test a provider outage and a review-gated file whose approved version must remain unchanged.

Current evidence: —.

**EDIT-002 — Google-format collaboration without hidden loss (missing).** Create and co-edit each Google type from Chest with two accounts, then export/convert a file containing comments, formulas and embedded content. Reconcile unsupported features, revoke source access and prove that accepted Chest-held originals/derivatives remain accessible with accurate source and revision labels.

Current evidence: —.

**EDIT-003 — Contextual comments and collaborative tasks (partial).** Annotate page 2 of a PDF, mention an authorized colleague and an outsider, resolve a thread and upload a changed-page replacement. The old annotation remains anchored to its original, notifications contain no forbidden text and the outsider gains no access.

Current evidence: `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-08). Remaining: Exact-version review comments exist; annotation geometry, mentions, threads and task resolution do not.

### Recovery, administration and operational trust

**RECOVER-001 — Folder and account point-in-time recovery (partial).** Make a folder with multiple versions, rename/delete it and overwrite sibling files, then preview a time-based rewind and restore selected content. Compare every restored byte/path, retain later history and prove a formerly revoked external link and staff identity remain denied.

Current evidence: `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-07, CHEST-13). Remaining: Document versions/trash restore exist; folder/account rewind does not.

**RECOVER-002 — Scheduled independent backups and upgrade recovery (partial).** Back up a populated installation, corrupt the live store and restore into a clean instance, reconcile the complete graph and hashes, reauthorize providers and prove no old device/link authority or queued message replays. Upgrade a copy of a populated prior release, inspect identity/settings/history, and recover from an interrupted upgrade.

Current evidence: `scripts/installer/local.mjs`; `tests/chest/restore.mjs`. Remaining: Manual complete local recovery exists; schedules, remote targets, new-model archives and in-place upgrade drill are absent.

**ADMIN-001 — Federation and lifecycle provisioning (missing).** In each provider test tenant, provision a user/group, sign in, change membership and deactivate the user. Confirm all public doors/devices/editor sessions lose authority, team content remains owned, and a bad mapping/IdP outage does not strand the protected owner recovery path.

Current evidence: —.

**ADMIN-002 — Admin reporting and legible USD costs (partial).** Create activity from staff, guest, client and agent; reconcile a permission-scoped CSV report with source events and bytes including old versions/trash. Reach a test quota and trigger an estimated provider cost; show the warning and preserved originals, with no invented savings or live-price claim.

Current evidence: `src/chest/api.ts`; `src/chest/store.ts`; `tests/chest/flows.mjs` (CHEST-13). Remaining: Activity endpoint and logical byte total exist; comprehensive reports, cost/usage attribution and quotas do not.

**SECURITY-001 — Scoped encryption and secret custody (partial).** Inspect public API, logs and archive output using a test canary credential, rotate/revoke a provider and device key, and retry old access. Submit a cross-origin mutation, unauthenticated request and stale grant race; all fail closed while authorized originals remain recoverable under the documented key policy.

Current evidence: `src/chest/api.ts`; `src/chest/access.ts`; `scripts/installer/local.mjs`; `tests/chest/flows.mjs`; `tests/chest/restore.mjs`. Remaining: Private HTTP/ACL and archive exclusions exist; complete device/provider encryption and key rotation coverage does not.

**SECURITY-002 — Content threats and classification policy (missing).** Submit a standard harmless malware-test specimen and a labeled sensitive document, simulate a burst through a test client and inspect quarantine/alert history. Try all preview/download/link/device doors, release only as an authorized reviewer and prove policy changes do not erase originals or silently expand access.

Current evidence: —.

**GOVERN-001 — Retention, legal hold and discovery integrations (missing).** Place a test project on provider-confirmed hold, request deletion, export a discovery package and reconcile hashes, versions and audit at the provider. Attempt deletion before release; show the hold/refusal and then an authorized release/erasure with the provider outcome.

Current evidence: —.

**AUDIT-001 — Durable complete action history (partial).** Create success, refusal, provider failure and interrupted execution through public doors, restart and inspect/export more events than one UI page. Reconcile action/version IDs and outcomes and then erase an actor without losing the fact of their actions or exposing personal/secret fields.

Current evidence: `src/chest/store.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-13). Remaining: Read/mutation activity exists but endpoint is bounded; full execution history, durable jobs and anonymization are absent.

**ERASE-001 — Deliberate erasure separate from trash (missing).** Through an owner erasure workflow remove a populated file and a staff identity, inspect each storage/index/import/backup target and audit anonymization, restart and attempt search/download and restore of an older archive with the later erasure journal. Refuse resurrection; show an unreachable backup or held object as pending rather than complete.

Current evidence: No Chest permanent-erasure public workflow; `src/chest/documents.ts` provides reversible trash only..

**OPS-001 — Responsive accessible and observable operation (partial).** Use realistic nested project data through store/open/share/search/recover at 1440 and 390, keyboard and a screen reader; disconnect each service and recover without fake success or lost edits. Install the documented stack in an owner test account and record its measured limits and actionable health signals.

Current evidence: `src/chest/ui-shell.ts`; `src/chest/ui.ts`; `tests/chest/browser-flow.mjs`; `tests/chest/journey.mjs`. Remaining: Current library has responsive journeys; native/admin expansion, accessibility conformance and hosted acceptance are unproven.

### Move-in from incumbents and challenger filespaces

**MIGRATE-001 — Reconciled migration and controlled cutover (partial).** Through the migration wizard, inventory a representative source, change the source after preview, reject stale plans, resume an interrupted batch and reconcile every item and version. Approve delta/cutover, test internal and external collaborators and old-to-new links, then undo untouched work and preserve native edits as conflicts.

Current evidence: `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs` (CHEST-11). Remaining: Reviewed bounded synthetic archive import exists; vendor discovery, complete histories and delta/cutover do not.

**MIGRATE-002 — Google Drive and Shared Drives migration (missing).** Migrate a real test Workspace with Shared Drives, a departed owner, native Docs/Sheets/Slides, shortcuts, nested restricted folders and historical versions. Compare inventory, byte hashes, exported/native fidelity, principals and links; prove an external collaborator can use the replacement without access to forbidden folders.

Current evidence: —.

**MIGRATE-003 — Dropbox Business migration (missing).** Migrate a real Dropbox Business test team containing a team folder, personal folder, revisions, deleted file and expiring links. Reconcile every source item/version and rights, perform a delta import, reissue controlled links and validate recipient workflows before cutover.

Current evidence: —.

**MIGRATE-004 — Box migration (missing).** Migrate a real Box test space with custom metadata, a limited collaborator, versioned file and shared link; reconcile counts/hash/history and rights, report provider-held or unavailable items, test a guest and reconcile signed-off cutover/rollback.

Current evidence: —.

**MIGRATE-005 — OneDrive and SharePoint migration (missing).** Migrate a real Microsoft 365 test tenant with a SharePoint library, OneDrive user, restricted subfolder, versions and guest link. Reconcile records/bytes/ACLs and unsupported pages/workflows, run a delta, offboard the source owner and validate the replacement links as staff and guest.

Current evidence: —.

**MIGRATE-006 — Egnyte, LucidLink, Nextcloud and file shares (missing).** Inventory a test filespace from each named challenger plus a NAS share, hydrate placeholders, migrate and reconcile hashes and rights; open a large creative file from the replacement mount and test a revoked collaborator. Any unexportable history remains a named gap requiring owner sign-off.

Current evidence: —.

### Integrations, rules and follow-up

**CONNECT-001 — Slack file collaboration (missing).** Connect a real Slack test workspace, search/share as two users with different rights, change a folder grant and inspect channel unfurls/notifications. Revoke the app and prove it can no longer search/send; existing Chest links still enforce their own audience.

Current evidence: —.

**CONNECT-002 — Microsoft Teams file collaboration (missing).** Connect a real Teams test tenant, share a restricted file into a mixed-membership channel, open/edit as an authorized user and deny another. Revoke a group/app and verify search, cards, previews and queued notifications stop exposing content.

Current evidence: —.

**CONNECT-003 — Salesforce record-linked files (missing).** Connect a Salesforce test org, attach a file to an opportunity, replace/approve it, change record/folder access and delete the CRM link; the original and provenance remain while unauthorized CRM users see no file content.

Current evidence: —.

**CONNECT-004 — Docusign execution and return custody (missing).** Send an approved test agreement in a Docusign sandbox, complete and decline envelopes, replay a signed callback and simulate an uncertain send. Retain signed bytes/certificate, verify no duplicate envelope/version and never mark the pending source file signed on provider acknowledgment alone.

Current evidence: —.

**CONNECT-005 — Zoom meeting file exchange (missing).** In a Zoom test account, share a restricted deck with a guest and file an authorized recording/transcript after the meeting. Deny an unrelated participant and a revoked integration, inspect exact version/provenance and ensure a canceled recording job reports its real state.

Current evidence: —.

**CONNECT-006 — Email and app intake (missing).** Connect real test Gmail and Microsoft 365 mailboxes, ingest an attachment once despite duplicate delivery, inspect source message/version provenance and reject a disallowed folder/sender. Revoke one source and verify queued jobs and sends stop at the authorization boundary.

Current evidence: —.

**CONNECT-007 — Public API, webhooks and scoped agents (partial).** Authorize a third-party test client and MCP agent for one folder, exercise paginated reads and idempotent upload, then attempt another folder and permission expansion. Revoke the grant mid-job, fail a signed webhook and inspect its durable outcome/manual replay without duplicated product mutations.

Current evidence: `src/chest/api.ts`; `tests/chest/flows.mjs`. Remaining: Private session-bound Chest HTTP API exists; delegated public API/MCP and webhook product integration do not.

**RULE-001 — Reversible arrival rules (missing).** Preview a rename/tag/move/convert/unzip rule over real-format test files, approve it, replay the same event and inspect one result per original. Submit a traversal/archive bomb and alter a destination grant between preview and execution; retain originals and show blocked items, then undo an untouched move.

Current evidence: —.

**FOLLOW-001 — Persistent collaboration follow-up (partial).** Assign a dated request and review, subscribe a collaborator, advance a controlled clock through due/reminder/escalation states and complete the exact task. Fail a provider, restart the worker and inspect the durable result; there is no duplicate reminder or forbidden content after completion/revocation.

Current evidence: `src/chest/ui-library.ts`; `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-09). Remaining: Due/upcoming work and evidence completion exist; background reminders, mobile push and provider outcomes do not.

### Push further: agents that maintain the file system

**AGENT-001 — File and classify authorized arrivals (missing).** Give the agent a project inbox containing ambiguous and malicious-instruction documents, preview its cited classification plan, allow one scoped move and reject another. Revoke source/destination access before execution; preserve originals and prove the denied/ambiguous action waits without extra reads or messages.

Current evidence: —.

**AGENT-002 — Reconcile duplicates and superseded versions (missing).** Seed duplicate bytes under different ACLs and a near-duplicate with a different signature/date; inspect the proposed version lineage and references. Approve a safe canonical-link change, reject a merge and verify no access union, lost original or reassigned approval.

Current evidence: —.

**AGENT-003 — Repair permitted synchronization and verify bytes (missing).** Interrupt a device transfer, create a divergent offline copy and revoke a folder grant. The agent explains the cause, repairs a permitted paused queue, proves final hashes on both ends and leaves conflict/denied work waiting for the human rather than overwriting or widening access.

Current evidence: —.

**AGENT-004 — Finish collection and prove the right version arrived (missing).** Request two vendor records, receive a stale file and then the correct approved replacement, confirm it as the intended recipient and inspect reminders stopping. Later revoke access or supersede the version; show the reopened issue and a proposed new delivery, without broadening recipients or auto-approving evidence.

Current evidence: —.

**AGENT-005 — Continuously repair broken and over-shared links (missing).** Create an expired link, departed guest, overshared subfolder and inaccessible approved replacement; run a scan as a restricted agent. Approve one repair and one restrictive revoke, deny an expansion and confirm destination access and the intended version while unrelated files stay unread.

Current evidence: —.

**AGENT-006 — Build and validate a trustworthy move-in (partial).** Run against a representative incumbent test tenant with unavailable history, unmapped groups and native files. Inspect the generated mapping and unresolved gaps, reject an unsafe mapping, approve staging and validate staff/guest open-edit-share workflows before explicitly accepting cutover; exercise rollback.

Current evidence: `src/chest/archive.ts`; `tests/chest/flows.mjs` (CHEST-11). Remaining: Manual hash/gap reconciliation and reversible staging exist; agent/provider mappings and collaborator validation do not.

**AGENT-007 — Evidence-grounded questions and custom jobs (missing).** Ask a cross-file question with a contradictory revision and an inaccessible answer-bearing file, inspect exact citations and uncertainty, then run a schema extraction under a small approved budget. Change access mid-run and inject document tool instructions; deny forbidden retrieval/actions and expose provider failure/cost without fabricated answers or fallback success.

Current evidence: —.

## Scope and acceptance limits

The target includes sync/streaming clients, native mobile apps, external links and file requests, broad previews/OCR/search, co-authoring, automation and AI; their incomplete status never removes them from the job. Office, signature, CRM, chat, meeting, regulated archive and creative authoring engines are integrated under the named clauses with explicit licensing/data control. No source check alone proves legal sufficiency, certification, hosted delivery, human receipt or vendor migration fidelity. An unreachable device, missing source revision, unconfirmed provider outcome or incomplete erasure must remain visibly unresolved.

Status total: **61 clauses — 13 done / 18 partial / 30 missing.**
