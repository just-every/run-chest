# Verify a Chest installation

[CONTRACT.md](CONTRACT.md) is the 16 October 2026 target product, including work not delivered today. The status of each journey below describes current code/test coverage at `2f3bbf6c237545b96c6f072de2507074535d7565`; it is not a claim that future clients, providers or AI workflows passed. All existing CHEST IDs are retained.

## Source verification

Use the pinned Node and pnpm versions and frozen dependencies in a fresh clone. Run `rer verify` for build, typecheck and current public HTTP flows. Run `CHEST_TEST_CHECKOUT=1 pnpm run test:journey` only in a disposable genuine fresh clone: it exercises ordinary identities, responsive browser pages at 1440 and 390 and complete export/restore. Never use that switch on owner data. See [README.md](README.md) and [RUN-LOCALLY.md](RUN-LOCALLY.md) for setup and commands. Check the Verify workflow on the exact source revision you intend to adopt.

For a document-only contract change, check clause uniqueness, preservation of existing IDs, one-to-one acceptance/status coverage and cited paths, plus any repository document checks; do not invent implementation results. CI remains the full source wall. Public-door tests for new work should be added when that workflow is built, with fakes only at a paid/network boundary; real-provider acceptance remains separately identified.

## Installation acceptance

Before moving records, reconcile representative incumbent originals, folders, versions, people, timestamps, rights and missing history. Source fixtures do not establish proprietary export fidelity or reduced costs. Each required provider/device journey below needs real test tenants/devices and recorded outcomes before being called accepted; deterministic fixtures can prove error behavior, not live integration availability. Use authorized test data with realistic US business folders, ordinary Office files, scans, a multi-GB creative asset, a vendor guest and a departing employee, and run size-sensitive journeys at the SCALE-001 reference size or the buyer's MIGRATE-001 inventory plus 25% headroom, whichever is larger. Platform and format journeys run every cell of the matrix their clause names (TRANSFER-001, SYNC-001, SYNC-007, MOBILE-001, PREVIEW-001, SEARCH-001); a cell not run is not accepted. Never place private archives or credentials in source/served assets.

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

**CHEST-13 — Self-service reversible trash and mutation audit (partial).** Through the API and browser at 1440 and 390, a staff editor trashes a nested folder of their own in a team space and restores it from their own trash view, tree, hashes, version IDs and stable links identical, with no owner session involved. A space reader is refused restore (403) of that folder and a contributor is refused trash; a space manager restores an item another member trashed; a manager's permanent-delete request goes through ERASE-001 while an editor's is refused. The trashed item disappears from a reviewer's list/search/download, and each trash/restore appears once in the audit with actor and outcome.

Current evidence: `src/chest/documents.ts`; `src/chest/store.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-13); `tests/chest/journey.mjs`. Remaining: Reversible indefinite trash, identical-version restore and audit exist, but trash and restore are owner-only (`src/chest/documents.ts` `owner_required`); self-service user restore, space-manager restore and folder-tree trash do not.

### The everyday business file system

**SPACE-001 — Team spaces and ordinary files (partial).** As two staff and an admin, build a nested project tree, upload an ordinary file with no review configuration, edit/move it, restrict a subfolder and offboard its creator; the team retains content and stable links while the former user is denied. A staff member offers ownership of a personal-area file to a colleague: before acceptance the sender is still owner; after acceptance the file sits in the recipient's area with the same stable ID, versions and share link, the sender is editor, and a declined offer changes nothing; each step is audited. Repeat browser navigation at 1440 and 390, then repeat listing, move and restriction in a space loaded to the SCALE-001 reference size and record the SCALE-001 timings.

Current evidence: `src/chest/metadata.ts`; `src/chest/access.ts`; `tests/chest/flows.mjs` (CHEST-02, CHEST-04). Remaining: Collections and access exist; folder trees, ordinary untyped files, team ownership and delegation do not.

**SPACE-002 — Space creation control and new-space defaults (missing).** Limit space creation to the group "Ops leads". A staff member outside it sees no create action, and a direct form post and an API call are each refused with the rule named; their space request reaches an admin. A group member creates a space. Set the defaults to external access off, non-member file access off, viewer and commenter download off and manager override off, then create a new space: it starts with those settings, and a space created earlier is unchanged. That space's manager tries to turn external access on through the UI and the API and is refused with the rule named; an admin changes it successfully. Turn manager override on and see the manager's change succeed. Inspect the audit with before and after values. Run the browser steps at 1440 and 390.

Current evidence: —.

**ROLE-001 — Five-level roles and delegated sharing (partial).** For each role, one public-door test through the HTTP API and one through the browser UI attempts open, download, comment, view version history, upload a new version, restore an earlier version, move, copy out, trash, restore, share and change membership on a space folder and a file; each permitted action succeeds and each other is refused with 403 and no state change. Turn on the no-download setting and prove viewer and commenter downloads, range requests, archive inclusion (BULK-001), sync hydration and API reads of the original are refused while pages still preview. Switch editor sharing off and prove an editor's share is refused while a manager's succeeds. Downgrade a role mid-session and prove the next request uses the new role.

Current evidence: `src/chest/access.ts`; `src/chest/metadata.ts`; `tests/chest/flows.mjs` (CHEST-10). Remaining: Reader/editor/reviewer collection grants exist; commenter, contributor, content-manager and manager levels, file-level roles, delegated and editor sharing and no-download settings do not.

**VERSION-001 — File version history and restore by editors (partial).** In a team space, staff A uploads an XLSX as version 1 and edits it to version 2; colleague B replaces it with version 3. Through the API and the browser at 1440 and 390, contributor C opens the version history and sees the author, time and size of each version. C downloads version 2 and checks its SHA-256, names it "Before Q3 edits" and restores it. Version 4 is created by C with bytes equal to version 2; versions 1, 2 and 3 remain downloadable; the stable ID and an existing share link are unchanged and now serve version 4. A synced client receives version 4 as a remote change. A viewer and a commenter see the history and download version 1, but their restore and rename are refused with 403 and no new version. With the no-download setting on, the viewer's download of version 1 is refused. On a governed file whose version 2 is approved, a restore of version 1 enters as a new submitted version while the approved pointer stays on version 2 until approval. The audit records each restore once with actor and source version.

Current evidence: `src/chest/model.ts` (`Version` actor, time, size, checksum); `src/chest/api.ts` (per-version `bytes` route); `tests/chest/flows.mjs` (CHEST-07). Remaining: Immutable versions with author, time, size and per-version download exist; a version-history view, restore as current, version naming and the per-role restore rules do not.

**TRANSFER-001 — Resumable files and whole-folder uploads (partial).** Upload a nested folder containing a 50 GB video and duplicate names, interrupt connectivity and restart the client, then resume and compare hashes/tree/counts; cancel another transfer and prove no false success or half-visible file. Through the public API, upload a 5 TB sparse-pattern test object with resumable parts and verify its SHA-256; a 5 TB + 1 byte declaration is refused before any bytes are stored. Upload a 100,000-item folder and reconcile the per-item results. Test a QUOTA-001 storage-limit refusal and retain completed files.

Current evidence: `src/chest/blobs.ts`; `src/chest/documents.ts`; `src/chest/archive.ts`; `tests/chest/flows.mjs` (CHEST-03, CHEST-11). Remaining: Single bounded originals/archive admission only; no folder or resumable large transfer.

**BULK-001 — Multi-select actions and archive download (missing).** Multi-select 200 files across two subfolders, including 5 the actor may not download under a no-download setting, and download one archive in the browser at 1440 and on the mobile app; unzip it and reconcile tree, names and SHA-256 hashes against the manifest, with the 5 listed as excluded and absent. Bulk-move and bulk-share the same selection where 3 items are refused by role or policy and see 197 successes plus 3 per-item refusals. Restart the server mid-job and see it complete once without duplicate moves or audit entries. Download a 6 GB folder as a guest through a folder link and verify the ZIP64 archive.

Current evidence: —.

**SYNC-001 — Windows and macOS filesystem clients (missing).** Run the full journey on every matrix cell: macOS 13 and the current macOS release on Apple silicon, macOS 13 on Intel, Windows 10 22H2 x64, Windows 11 x64 and Windows 11 ARM64. On each, install (including one silent MDM install per OS), sign in, open an online-only Office file from Finder/Explorer, save and observe its new server version from a second device. Switch mirror/stream modes, pin a folder, sign out and uninstall with unsent edits; show exact disposition of local work.

Current evidence: —.

**SYNC-002 — Offline edits and lossless conflict reconciliation (missing).** Edit a pinned file offline while another staff member changes it remotely, switch sync mode and reconnect; inspect both originals and resolve explicitly. Repeat delete-versus-edit, case rename and permission revocation, proving no silent overwrite or unauthorized remote write.

Current evidence: —.

**SYNC-003 — Visible sync operations and device control (partial).** Disconnect a device during transfer, exceed its cache/disk quota and revoke it; its tray and admin console show accurate unfinished work and last contact. Resolve the cause and verify hashes before showing up-to-date; an unreachable wipe stays unconfirmed. On macOS and Windows behind an authenticating proxy with direct egress blocked, the client syncs through the proxy; a wrong proxy password shows the proxy as the reason. Set an upload limit of 1,000 KB/s and measure sustained upload at or below it; an MDM cap of 500 KB/s overrides a user setting of 2,000 KB/s. In the SCALE-001 reference installation, take a device offline, apply 10,000 remote changes, reconnect and record catch-up time against the SCALE-001 target with final hashes matching.

Current evidence: `src/chest/blobs.ts`; `src/chest/ui.ts`; `tests/chest/flows.mjs` (CHEST-03). Remaining: Upload success/error exists; device fleet, progress and sync queues are absent.

**SYNC-004 — Creative assets stream and lock safely (missing).** Open and seek a large video in Final Cut Pro, save a Photoshop asset and AutoCAD drawing from two clients, record transferred ranges and verify final checksums/version IDs. Compete for a lock, kill its holder and recover without losing either writer; open the same file from its browser page.

Current evidence: —.

**SYNC-005 — Hybrid local cache and storage (missing).** Connect two office clients and a remote client to a scoped cache, disconnect WAN and expire offline authorization, edit permitted pinned files, then reconcile conflicts and verify all final hashes and access. Replace the cache and recover from owner storage.

Current evidence: —.

**SYNC-006 — Computer folder backup (missing).** On macOS 13+ and Windows 11 from the SYNC-001 matrix, enrol Desktop and Documents (one by user choice, one by an enforced admin policy), create, edit and delete local files and see new versions and trashed items on the server with the device-named folder. Try to un-enrol the enforced folder as the user and be refused; block `*.tmp` and prove it is not uploaded. Wipe the laptop, sign in on a second computer, restore both folders to their original paths and reconcile tree and SHA-256 hashes, and restore a deleted file from trash. The admin console shows enrolled folders and last success for both devices.

Current evidence: —.

**SYNC-007 — Office desktop presence, newer-version alerts and locks (missing).** Two staff open the same XLSX from the mount, one on macOS (Microsoft 365 Apps) and one on Windows (Office 2016), and each run is repeated with the operating systems swapped. The second sees the first named under "Also open by" within 10 seconds. The first saves; the second is told a newer version exists, naming the first, before saving, and reloading keeps the second's unsaved changes as a named copy. On the lock path, the first takes the lock and the second's save is refused naming the holder, with no conflict copy created. Kill the holder's client: the lock lapses through SYNC-004 recovery with the holder's unsent changes retained. Open the file in an EDIT-001 browser session and see that person in desktop presence. Under the "lock on first open" policy, the second opener is offered read-only or browser co-authoring only.

Current evidence: —.

**MOBILE-001 — Native iOS and Android file access (partial).** Run the journey on an iPhone on iOS 17, an iPhone on the current iOS release, an iPad on the current iPadOS, an Android 10 device and an Android device on the current release. On each, capture a multi-page scan, upload photos, share with a permitted recipient, open/save through a system picker, create a blank spreadsheet from the New menu and co-edit it with a browser user (EDIT-001) until both edits appear as attributed versions, and edit a pinned file offline while another device changes it. Reconnect, resolve the conflict and revoke the device; show the limit of an unreachable cache wipe.

Current evidence: `src/chest/ui-library.ts`; `src/chest/documents.ts`; `tests/chest/journey.mjs`. Remaining: Responsive browser browse/upload exists; native apps, camera, background/offline sync and mobile sharing do not.

### External exchange, previews and collaboration

**SHARE-001 — Policy-controlled external links (partial).** Share a restricted folder and pinned approved file with an external recipient; try wrong password, wrong domain, guessed child URLs, expired/revoked links and parallel downloads at the count limit. Confirm approved-only never reveals pending replacements and a revoked link fails on the next request. A staff member sets a team-space file to organisation-with-link at commenter, not discoverable. A colleague with no grant opens it and comments, while a guest and a signed-out browser are refused. Before opening the link, that colleague's search does not show the file; after opening, it does. Switch the link to discoverable and see a third colleague find it by search. With the no-download setting on, the colleague's download is refused while the preview works. Remove the link and see the colleague refused on the next request. Change the admin default link audience from restricted to organisation and see the next new link start at organisation while existing links keep their audience. Run the browser steps at 1440 and 390.

Current evidence: `src/chest/access.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-06, CHEST-10). Remaining: Private identity ACLs exist; external links and per-link policies are absent.

**SHARE-002 — Upload-only file requests (missing).** Send a vendor request, submit from a signed-out phone, interrupt/resume a large upload and receive its receipt. Try another submitter’s files, path traversal, disallowed content and an expired/closed request; verify none grants library access.

Current evidence: —.

**SHARE-003 — Delivery receipts and large-file transfers (missing).** Send a multi-GB package to an invited recipient and a public recipient; interrupt/resume download, exercise the limit and inspect view/download/confirmation events. A mail scanner GET and successful email API response must not set human receipt; expiry stops new range requests.

Current evidence: —.

**SHARE-004 — Item sharing, Shared with me and access requests (missing).** Share a personal-area file with a colleague at commenter; they receive the notice and email, find it under Shared with me and can comment but not edit. An unauthorised colleague opens the link, sees Request access without the title, requests editor; the owner approves at viewer from the email link and the requester is told and can now view. A second request is declined from the share dialog and the requester is told. Deactivate the owner of a third file and request access; the request reaches the new content owner, and with none, a space manager. Grant a colleague commenter on a space file with a 2-day expiry and advance a controlled clock. The one-day notice reaches the sharer and the grantee, and an extend from the notice moves the date once; let the new date pass. List, preview, download, sync hydration on the colleague's client, and comment are each refused on the next request, and the audit records the expiry. Repeat at 1440 and 390 and inspect the audit entries.

Current evidence: —.

**SHARE-005 — External collaborators who edit, comment and upload (missing).** Invite a guest at another domain with no Google or Microsoft account as editor on a DOCX and contributor on a folder, with a 3-day expiry and re-sharing off. The guest signs in by PIN, co-edits the DOCX with a staff member through EDIT-001 and uploads two files into the folder; version history and audit attribute each change to the guest's email. The guest's attempts to share onward, open a sibling folder, search the library and use the PIN from a second email address are refused. Advance a controlled clock past re-verification and see a new PIN required, then past expiry and see every door, including an open editor session's next save and a range request, refused.

Current evidence: —.

**POLICY-001 — Organisation sharing policy (missing).** Set an allowlist of one partner domain with public links off. As staff, a share to a non-allowlisted domain and a public link are refused in the UI and API with the policy named; a share to the allowlisted domain succeeds after the external-recipient warning. Create a public link and a non-allowlisted guest grant under a looser policy, tighten the policy and prove both are refused on the next request and listed as suspended. Set a space override that blocks sharing outside its members while the organisation allows it, and see a member's share to another colleague refused. Confirm the same refusals through the CONNECT-007 API and a CONNECT-009 action. Set the organisation default link audience to restricted and a group default to organisation-with-link at viewer. A group member's new link starts at organisation viewer and a non-member's at restricted; links created before the change keep their audience. Turn organisation-link discovery off and see a request for a discoverable organisation link refused with the policy named.

Current evidence: —.

**PREVIEW-001 — Office, Google, video and design previews (partial).** Open one fixture per matrix format from the file page in the browser at 1440 and 390 and in both mobile apps, checking page count, first-page thumbnail and, for video/audio, seek to a mid-file timestamp; a format outside the matrix shows the unsupported state with download. Revoke access while a preview is open and request fresh pages/ranges; deny them. Test corrupt/malicious files and processor outage, expose the exact failure and keep the original downloadable to an authorized user.

Current evidence: `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-05); `tests/chest/browser-preview.mjs`. Remaining: Only basic PDF/raster/text previews exist; no broad renderer or processor.

**SEARCH-001 — Full-text and scanned-content search (partial).** Upload one fixture per matrix format, each holding a distinctive phrase (including a scanned English invoice, a scanned Spanish receipt, an Office spreadsheet, a Google document, an MSG with a DOCX attachment, a spoken-phrase MP4 and an encrypted PDF), find every phrase and filter by folder/version. Show OCR provenance and the encrypted-file gap; revoke a group before index refresh and prove zero leaked snippets/counts/autocomplete through search API and UI. Repeat a fixed query set in the SCALE-001 reference installation and record latency against the SCALE-001 search target.

Current evidence: `src/chest/api.ts`; `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-06). Remaining: Title/metadata and bounded admitted UTF-8 search only; OCR/broad extraction/indexing are absent.

**EDIT-001 — Office and independent browser co-authoring (missing).** Two real accounts co-edit a document, spreadsheet and slide deck through Chest, verify concurrent changes and saved versions, then revoke one user mid-session and reject their next save. Round-trip tables/formulas/comments and test a provider outage and a review-gated file whose approved version must remain unchanged. Repeat one co-edit with one participant on the iOS app and one on the Android app, each save appearing as a version attributed to that participant, and revoke the Android participant mid-session to see their next save refused.

Current evidence: —.

**EDIT-002 — Google-format collaboration without hidden loss (missing).** Create and co-edit each Google type from Chest with two accounts, then export/convert a file containing comments, formulas and embedded content. Reconcile unsupported features, revoke source access and prove that accepted Chest-held originals/derivatives remain accessible with accurate source and revision labels.

Current evidence: —.

**EDIT-003 — Contextual comments and collaborative tasks (partial).** Annotate page 2 of a PDF, mention an authorized colleague and an outsider, resolve a thread and upload a changed-page replacement. The old annotation remains anchored to its original, notifications contain no forbidden text and the outsider gains no access.

Current evidence: `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-08). Remaining: Exact-version review comments exist; annotation geometry, mentions, threads and task resolution do not.

**EDIT-004 — New documents, spreadsheets and presentations from blank or templates (missing).** Through the browser at 1440 and 390 and in the iOS and Android apps on the MOBILE-001 current-release devices:
- A contributor creates a blank spreadsheet in a restricted team-space folder. It opens in the EDIT-001 editor at once, and after two saved edits its version history shows versions 1–3 (created, then two editor saves) attributed to them. A colleague with folder access finds it in search and opens it; a staff member outside the folder finds nothing in search and gets 403 on its URL.
- Create a blank document and a blank presentation; download each version 1 and open it in desktop Word, Excel or PowerPoint and in LibreOffice without a repair prompt. Switch the organisation creation format to ODF and see the next new document created as ODT; set a group override to Google types under EDIT-002 and see a group member's new document open as a Google Doc.
- An admin publishes a DOCX organisation template to one group. A group member creates a document from it; a user outside the group does not see the template in the New menu, the gallery or the API listing. Editing the new document leaves the template's bytes and version unchanged, editing the template afterwards leaves the new document unchanged, and the new document's version 1 names the template and its version. A space manager publishes a space template that only that space's members see. Unpublish the organisation template and see documents made from it unchanged.
- A viewer and a commenter see no New action, and their direct API create returns 403 with no file created. A guest contributor on a folder creates a blank document there, attributed to the guest's email.
- An over-limit user's create in their personal area is refused with `storage_limit_exceeded` naming the limit in the browser, the mobile app and the API.
- Repeat an API create with the same caller key and get one file. Inspect the audit entry for each create, publish and unpublish.

Current evidence: —.

**SIGN-001 — Built-in eSignature on PDF and DOCX files (missing).** Through the browser at 1440 and 390 and the mobile app, send a two-signer PDF in order: first an external signer with no Chest or Google/Microsoft account, then a staff member. A reminder reaches the first signer on the set cadence. The external signer verifies by PIN, sees the consent disclosure and is refused any other file. Both sign. The signed PDF and the certificate appear as new versions linked to the source version, with before and after hashes and the full event log; the PAdES signature validates, and validation fails after one byte of the signed PDF is altered. Reminders stop. Send a DOCX request and see the fidelity report before sending. A declined request and an expired request each leave the source version unchanged and unsigned, with no signed version filed and the outcome recorded. A voided request stops further signing.

Current evidence: —.

### Recovery, administration and operational trust

**RECOVER-001 — Folder and account point-in-time recovery (partial).** Make a folder with multiple versions, rename/delete it and overwrite sibling files, then, as the space manager (not the installation owner), preview a time-based rewind and restore selected content. Compare every restored byte/path, retain later history and prove a formerly revoked external link and staff identity remain denied. A space viewer is refused the rewind. An editor's folder rewind is limited to their own files, while the same editor restores a single earlier version of a colleague's file under VERSION-001.

Current evidence: `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-07, CHEST-13). Remaining: Document versions/trash restore exist; folder/account rewind does not.

**RECOVER-002 — Scheduled independent backups and upgrade recovery (partial).** Back up a populated installation, corrupt the live store and restore into a clean instance, reconcile the complete graph and hashes, reauthorize providers and prove no old device/link authority or queued message replays. Upgrade a copy of a populated prior release, inspect identity/settings/history, and recover from an interrupted upgrade.

Current evidence: `scripts/installer/local.mjs`; `tests/chest/restore.mjs`. Remaining: Manual complete local recovery exists; schedules, remote targets, new-model archives and in-place upgrade drill are absent.

**ADMIN-001 — Federation and lifecycle provisioning (missing).** In each provider test tenant, provision a user/group, sign in, change membership and deactivate the user. Confirm all public doors/devices/editor sessions lose authority, team content remains owned, and a bad mapping/IdP outage does not strand the protected owner recovery path.

Current evidence: —.

**ADMIN-002 — Admin reporting and legible USD costs (partial).** Create activity from staff, guest, client and agent; reconcile a permission-scoped CSV report with source events and bytes including old versions/trash. Reach a QUOTA-001 test limit and trigger an estimated provider cost; show the warning and preserved originals, with no invented savings or live-price claim.

Current evidence: `src/chest/api.ts`; `src/chest/store.ts`; `tests/chest/flows.mjs` (CHEST-13). Remaining: Activity endpoint and logical byte total exist; comprehensive reports, cost/usage attribution and quotas do not.

**ADMIN-003 — Several admins, delegated admin roles and owner transfer (partial).** As owner, promote a second super admin and grant a staff member help desk scoped to one group. The help-desk admin revokes a group member's sessions and resets their second factor, then is refused that member's file list, previews, downloads and search hits, a reset for a user outside the group, and a policy change. Transfer ownership to the second super admin; the former owner is refused owner-only actions (installation settings, owner transfer, super-admin changes) on the next request while the new owner succeeds. Try to demote the last super admin and be refused. Inspect the audit of each step.

Current evidence: `src/chest/identity.ts`; `src/chest/access.ts`; `tests/chest/flows.mjs` (CHEST-01). Remaining: One owner with owner-only administration and invited member staff exist; additional super admins, delegated or custom admin roles, content-free admin scope and owner transfer do not.

**ADMIN-004 — Enforced multi-factor sign-in without an identity provider (missing).** Enforce MFA for everyone with a 0-day grace period. An unenrolled staff member's next email-link sign-in is held at enrolment, enrols a TOTP factor and then opens the library; a second user enrols a passkey. Replay a captured valid email link from another browser without the factor and be refused. Require security keys for admins and prove an admin with only TOTP is refused the console. Set a 1-hour session length and see a session end. A user who has lost their factor is reset by a help-desk admin, enrols again through the single-use link, and the link fails on second use and after 24 hours.

Current evidence: —.

**QUOTA-001 — Storage limits for users and spaces (missing).** Set a group user limit and a space limit below current usage; before saving, the console lists the affected users and spaces with their usage, and saving needs confirmation. Show that a group limit beats the organisation default, and that a user in two limited groups gets the larger. For the over-limit user, an upload is refused in the browser at 1440 and 390, in the SYNC-001 client on macOS and Windows and in the mobile app, and through the API with `storage_limit_exceeded`, each naming the limit; view, preview and download still work, and the client keeps the unsent file queued. In the over-limit space, a content manager trashes content and usage does not drop until a space manager erases it under ERASE-001; writes then resume on the next request, and the queued client upload completes without user action. Inspect the 90% warning emails and the audit entries for each limit change.

Current evidence: —.

**SECURITY-001 — Scoped encryption and secret custody (partial).** Inspect public API, logs and archive output using a test canary credential, rotate/revoke a provider and device key, and retry old access. Submit a cross-origin mutation, unauthenticated request and stale grant race; all fail closed while authorized originals remain recoverable under the documented key policy.

Current evidence: `src/chest/api.ts`; `src/chest/access.ts`; `scripts/installer/local.mjs`; `tests/chest/flows.mjs`; `tests/chest/restore.mjs`. Remaining: Private HTTP/ACL and archive exclusions exist; complete device/provider encryption and key rotation coverage does not.

**SECURITY-002 — Content threats and classification policy (missing).** Submit a standard harmless malware-test specimen and a labeled sensitive document, simulate a burst through a test client and inspect quarantine/alert history. With the defaults, download 501 files in 10 minutes from one account and see the alert; trash 199 items and see none. Lower a group's download threshold to 100 files with pause on and see the 101st download in the window refused while the alert names the rule. Try all preview/download/link/device doors, release only as an authorized reviewer and prove policy changes do not erase originals or silently expand access.

Current evidence: —.

**SECURITY-003 — Ransomware and mass-corruption protection (missing).** From a test client, rewrite 500 synced files with high-entropy content in under a minute. Upload pauses before any server current-version ID changes; the client, email and admin console show the event with device and file list. While paused, another device's legitimate edit to a different file syncs normally. Run the one-action restore and verify every affected file's current version and SHA-256 equals its last pre-incident version, with the 500 suspect versions retained as quarantined history. Repeat through the public API with a token and see the token paused. Release a deliberate false positive and see uploads resume with no loss.

Current evidence: —.

**GOVERN-001 — Retention, legal hold and discovery integrations (missing).** Place a test project on provider-confirmed hold, request deletion, export a discovery package and reconcile hashes, versions and audit at the provider. Attempt deletion before release; show the hold/refusal and then an authorized release/erasure with the provider outcome.

Current evidence: —.

**AUDIT-001 — Durable complete action history (partial).** Create success, refusal, provider failure and interrupted execution through public doors, restart and inspect/export more events than one UI page. Reconcile action/version IDs and outcomes and then erase an actor without losing the fact of their actions or exposing personal/secret fields. On a space file, two colleagues view it; a contributor sees both names and times in the file's activity panel and a viewer sees edits but no view history. A colleague who hides their views disappears from the list, and turning view history off for the group removes it from the panel.

Current evidence: `src/chest/store.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-13). Remaining: Read/mutation activity exists but endpoint is bounded; full execution history, durable jobs and anonymization are absent.

**ERASE-001 — Deliberate erasure separate from trash (missing).** Through an owner erasure workflow remove a populated file and a staff identity, inspect each storage/index/import/backup target and audit anonymization, restart and attempt search/download and restore of an older archive with the later erasure journal. Refuse resurrection; show an unreachable backup or held object as pending rather than complete.

Current evidence: No Chest permanent-erasure public workflow; `src/chest/documents.ts` provides reversible trash only.

**OPS-001 — Responsive accessible and observable operation (partial).** Use realistic nested project data through store/open/share/search/recover at 1440 and 390, keyboard and a screen reader; disconnect each service and recover without fake success or lost edits. Install the documented stack in an owner test account and record its measured limits and actionable health signals; the SCALE-001 run supplies the size and timings.

Current evidence: `src/chest/ui-shell.ts`; `src/chest/ui.ts`; `tests/chest/browser-flow.mjs`; `tests/chest/journey.mjs`. Remaining: Current library has responsive journeys; native/admin expansion, accessibility conformance and hosted acceptance are unproven.

**SCALE-001 — Stated operating scale and responsiveness (missing).** Generate the reference installation (or the buyer's inventory plus 25%) with a seeded generator that records item, byte, depth, member and device counts. Run a fixed script of folder listings, deep-path opens, 50 search queries, a revocation and an offline-device catch-up, and publish the counts and p50/p95 timings for each against the targets above. Revoke a group during the run and prove the next request through list, search, download and sync is refused. Rerun against a buyer's MIGRATE-001 inventory and show the size used.

Current evidence: —.

**OPS-002 — Availability target, durability of originals and incident status (partial).** Run the probes for 30 days against the SCALE-001 reference installation and publish each door's availability and minute history against the 99.9% target. Take one door down for a measured interval and see it counted. Corrupt one stored copy of an original and delete the second copy of another: the next scrub detects both, repairs each from its good copy, and records audit entries and the durability report. Make one object unrecoverable in both copies and see it shown as damaged, never served. Stop the API: an incident opens automatically, the banner shows in the browser at 1440 and 390, the macOS and Windows clients and both mobile apps within 2 minutes, the independent status page reports it and admins receive the email. Restore the API and see the banners clear and the duration recorded.

Current evidence: `src/server.ts` (`/health`); `src/chest/blobs.ts` (SHA-256 verified at admission); `tests/chest/journey.mjs` (health check); `tests/chest/flows.mjs` (CHEST-03). Remaining: A health endpoint and admission checksums exist; external probes, availability measurement, second copies, scrubs and incident notices do not.

### Move-in from incumbents and challenger filespaces

**MIGRATE-001 — Reconciled migration and controlled cutover (partial).** Through the migration wizard, inventory a representative source, change the source after preview, reject stale plans, resume an interrupted batch and reconcile every item and version. Approve delta/cutover, test internal and external collaborators and old-to-new links (rewritten links and the resolver, under MIGRATE-007), then undo untouched work and preserve native edits as conflicts.

Current evidence: `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs` (CHEST-11). Remaining: Reviewed bounded synthetic archive import exists; vendor discovery, complete histories and delta/cutover do not.

**MIGRATE-002 — Google Drive and Shared Drives migration (missing).** Migrate a real test Workspace with Shared Drives, a departed owner, native Docs/Sheets/Slides, shortcuts, nested restricted folders and historical versions, plus: a labelled file with a date field and a selection field; a shared drive with one member at each of the five roles and download-restricted viewers; a Vault hold and a retention rule over one shared drive; and an externally owned file shared into a shared drive and another in a staff member's Shared with me. Compare inventory, byte hashes, exported/native fidelity, principals and links; verify the label values as typed fields, run the ROLE-001 role tests against each migrated member, see the held content blocked until a GOVERN-001 policy is acknowledged, and see both external files reconciled by the chosen option or reported as named gaps requiring owner sign-off. Prove an external collaborator can use the replacement without access to forbidden folders. Include the MIGRATE-007 link fixtures in the same tenant and pass that clause's acceptance.

Current evidence: —.

**MIGRATE-003 — Dropbox Business migration (missing).** Migrate a real Dropbox Business test team containing a team folder, personal folder, revisions, deleted file and expiring links. Reconcile every source item/version and rights, perform a delta import, reissue controlled links and validate recipient workflows before cutover.

Current evidence: —.

**MIGRATE-004 — Box migration (missing).** Migrate a real Box test space with custom metadata, a limited collaborator, versioned file and shared link; reconcile counts/hash/history and rights, report provider-held or unavailable items, test a guest and reconcile signed-off cutover/rollback.

Current evidence: —.

**MIGRATE-005 — OneDrive and SharePoint migration (missing).** Migrate a real Microsoft 365 test tenant with a SharePoint library, OneDrive user, restricted subfolder, versions and guest link. Reconcile records/bytes/ACLs and unsupported pages/workflows, run a delta, offboard the source owner and validate the replacement links as staff and guest.

Current evidence: —.

**MIGRATE-006 — Egnyte, LucidLink, Nextcloud and file shares (missing).** Inventory a test filespace from each named challenger plus a NAS share, hydrate placeholders, migrate and reconcile hashes and rights; open a large creative file from the replacement mount and test a revoked collaborator. Any unexportable history remains a named gap requiring owner sign-off.

Current evidence: —.

**MIGRATE-007 — Embedded link rewriting and old-URL resolution (missing).** The MIGRATE-002 test tenant includes:
- a Doc linking to a Sheet in another shared drive;
- a Sheet with `IMPORTRANGE`, kept native in one run and converted to XLSX in another;
- a PPTX and a PDF with Drive links;
- a Drive shortcut and a `.url` file;
- a link to a file excluded from the migration.

After migration, every link except the excluded one opens the matching Chest item, and each rewritten file's prior version still matches the source hash. The excluded link appears in the unresolved report with file, location, target and reason. Migrate a newly linked file in a delta and see the final pass rewrite its link. An old Drive URL pasted into the resolver opens the item for a member, shows Request access without the title to a non-member, and is refused for a guest. Run an equivalent Dropbox, Box and SharePoint link fixture through MIGRATE-003–005.

Current evidence: —.

### Integrations, rules and follow-up

**CONNECT-001 — Slack file collaboration (missing).** Connect a real Slack test workspace, search/share as two users with different rights, change a folder grant and inspect channel unfurls/notifications. Revoke the app and prove it can no longer search/send; existing Chest links still enforce their own audience.

Current evidence: —.

**CONNECT-002 — Microsoft Teams file collaboration (missing).** Connect a real Teams test tenant, share a restricted file into a mixed-membership channel, open/edit as an authorized user and deny another. Revoke a group/app and verify search, cards, previews and queued notifications stop exposing content.

Current evidence: —.

**CONNECT-003 — Salesforce and HubSpot record-linked files (missing).** Connect a Salesforce test org, attach a file to an opportunity, replace/approve it, change record/folder access and delete the CRM link; the original and provenance remain while unauthorized CRM users see no file content. Repeat with a HubSpot test portal on a deal: the record card lists the linked folder's files for a user with Chest access and shows none to a HubSpot user without it.

Current evidence: —.

**CONNECT-004 — Docusign execution and return custody (missing).** Send an approved test agreement in a Docusign sandbox, complete and decline envelopes, replay a signed callback and simulate an uncertain send. Retain signed bytes/certificate, verify no duplicate envelope/version and never mark the pending source file signed on provider acknowledgment alone.

Current evidence: —.

**CONNECT-005 — Zoom meeting file exchange (missing).** In a Zoom test account, share a restricted deck with a guest and file an authorized recording/transcript after the meeting. Deny an unrelated participant and a revoked integration, inspect exact version/provenance and ensure a canceled recording job reports its real state.

Current evidence: —.

**CONNECT-006 — Email and app intake (missing).** Connect real test Gmail and Microsoft 365 mailboxes, ingest an attachment once despite duplicate delivery, inspect source message/version provenance and reject a disallowed folder/sender. Revoke one source and verify queued jobs and sends stop at the authorization boundary.

Current evidence: —.

**CONNECT-007 — Public API, webhooks and scoped agents (partial).** Authorize a third-party test client and MCP agent for one folder, exercise paginated reads and idempotent upload, then attempt another folder and permission expansion. Revoke the grant mid-job, fail a signed webhook and inspect its durable outcome/manual replay without duplicated product mutations. Embed the file picker in a test web app: a user picks an accessible file and the app receives its stable ID and a link; a file the user cannot open never appears, and a revoked picker grant fails the next pick.

Current evidence: `src/chest/api.ts`; `tests/chest/flows.mjs`. Remaining: Private session-bound Chest HTTP API exists; delegated public API/MCP and webhook product integration do not.

**CONNECT-008 — Gmail and Outlook compose and save add-ins (missing).** In real Google Workspace and Microsoft 365 test tenants, insert a restricted file into a message to an allowlisted external recipient; see the warning naming them, grant viewer in one step, send, and find the grant and audit entry; repeat to a non-allowlisted recipient and see the grant refused with the policy named. Attach a 200 MB file and see it replaced by a transfer link that the recipient downloads. Save the same attachment twice from Gmail and from Outlook and find one Chest file each with message provenance. Revoke the add-in and see the next insert and save refused.

Current evidence: —.

**CONNECT-009 — Zapier and Make automation apps (missing).** In real Zapier and Make test accounts, connect Chest with a grant for one folder and build "new file in folder → move to a subfolder and share with a colleague"; drop a file in and see it moved and shared once, with audit entries under the grant. Replay the trigger and see no duplicate move. Point an action at a folder outside the grant and see it refused; attempt a public link with public links off under POLICY-001 and see the policy refusal. Revoke the grant and see the next trigger stop and the next action fail.

Current evidence: —.

**CONNECT-010 — Google Meet, Calendar and Chat file companion (missing).** In a real Google Workspace test tenant with the connection covering one group:
- A group member schedules an event linked through the Calendar add-on to a restricted team-space folder, with one internal attendee and one external attendee from an allowlisted domain, and records the Meet with transcript and notes on. The recording, transcript and notes document each appear once in the folder with meeting code, organizer, event ID and source Drive file ID. The internal attendee opens them, the external attendee opens them as a guest viewer, and a staff member who was not invited and has no folder access gets 403.
- Replay the Workspace event notification and run the reconciliation sweep: there is no duplicate.
- With "remove source after verification" on, the Drive copy goes to Drive trash only after the SHA-256 check passes. With the destination over its QUOTA-001 limit, the filing is refused with `storage_limit_exceeded`, the organizer and an admin are told, and the Drive copy is kept. An organizer outside the covered group has nothing filed.
- Through the Calendar add-on, attach a restricted Chest file to an event with one guest who has access and one who doesn't. On save, the guest without access is named, gets viewer in one step, and the audit entry exists. Add a guest from a domain that isn't on the POLICY-001 allowlist: the grant is refused with the policy named.
- Through the Chat app, share a restricted file into a space with mixed membership. The card shows no title. A member with access presses Preview and sees the file; a member without access sees Request access without the title. The sharer's private prompt names the members without access, and a one-step grant lets them open it. A subscribed comment notification reaches the space. Search through the app as two users returns only what each can open. Repeat the share in the Chat mobile app.
- Revoke Meet filing, the Calendar add-on and the Chat app one at a time, then the whole connection. The next filing, attachment check, share and search are each refused, and files already filed keep their Chest permissions.

Current evidence: —.

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

The target includes sync/streaming clients and computer-folder backup, native mobile apps, external links, item sharing with access requests, guest collaborators under an organisation sharing policy, organisation links, expiring grants, version restore by editors, space-creation control, storage limits, Office desktop presence, built-in eSignature, migration link rewriting, an availability target with durability scrubs, new files from blank or templates, the Google Meet, Calendar and Chat companion, file requests, broad previews/OCR/search, co-authoring, automation and AI; their incomplete status never removes them from the job. Office, third-party signature (Docusign), CRM, chat, meeting, regulated archive and creative authoring engines are integrated under the named clauses with explicit licensing/data control. No source check alone proves legal sufficiency, certification, hosted delivery, human receipt or vendor migration fidelity. An unreachable device, missing source revision, unconfirmed provider outcome or incomplete erasure must remain visibly unresolved.

Status total: **82 clauses — 12 done / 23 partial / 47 missing.**
