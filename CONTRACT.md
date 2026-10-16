# Chest target product contract

Target approved **16 October 2026**. Chest is an owned **business cloud file system: storage, sync and sharing** for a US operations lead at a 10–100 person business. A team can replace Google Drive (Google Workspace), Dropbox Business, Box or Microsoft OneDrive / SharePoint for its everyday store, sync, open, search, edit, share and recover work. Egnyte, LucidLink and Nextcloud set the bar for governed collaboration, streamed creative assets and owner-controlled deployment. Exact-version approvals remain a useful option inside that complete job.

This is the product we are building towards. The status table measures current implementation, not a release promise. Existing `CHEST-01` through `CHEST-13` IDs are retained. Round 1 of the independent buyer review (16 October 2026) added ROLE-001, BULK-001, SYNC-006, SHARE-004/005, POLICY-001, ADMIN-003/004, SECURITY-003, SCALE-001 and CONNECT-008/009 and sharpened CHEST-01/10/13, TRANSFER-001, SYNC-001/003, MOBILE-001, SHARE-001, PREVIEW-001, SEARCH-001, RECOVER-001, MIGRATE-002 and OPS-001. New stable IDs use area numbering. The current source is `2f3bbf6c237545b96c6f072de2507074535d7565`, identical to the 16 October code-audit baseline; no intervening code required reclassification. Inventory rows judged done/partial seed the evidence below, with broader target behavior marked partial or missing. Existing manifests, homepage and installation limits describe the current edition and are not changed by this document.

The primary journey is: create a team space, migrate originals and rights, install staff clients, upload/open/edit ordinary files, collaborate and share outside the team, find the right version, and recover it independently. Each named clause states an observable outcome and its acceptance journey through a public UI, HTTP, client, command or provider door. `done` requires implementing source and an existing exercising test; `partial` names the delivered subset and remaining work; `missing` has no delivered product workflow. Acceptance journeys for future work are requirements, not tests claimed to have run.

## Identity, original custody and governed records

### CHEST-01 — Owner and ordinary staff identity.

An installation has one initial owner claim, invited staff, email-link return and revocable sessions. Development personas are separately gated and confer no production authority. The initial claim is a setup step, not a single point of failure: several admins, delegated admin roles and owner transfer are ADMIN-003, and enforced multi-factor sign-in is ADMIN-004.

**Acceptance evidence:** Through setup, invitation, sign-in and the library API, reject a second claim, revoke a live session, deactivate/reactivate staff and prove prior sessions stay invalid. Exercise owner and reviewer in the built browser journey.

### CHEST-02 — Typed filing without lost values.

Owners manage collections, editable typed schemas, required fields, accountable people and groups. Schema edits preserve authoritative stored values, diagnose missing/invalid fields only on accessible records, and validate new filings and uploads against current definitions.

**Acceptance evidence:** Create and edit a type through the owner form/API; preserve an old record unchanged while diagnosing it, reject invalid new values and hide diagnostics from an outsider.

### CHEST-03 — Validate before publishing originals.

Uploads validate actual bytes, SHA-256 and size. Durable original-object custody precedes atomic record admission; invalid or failed uploads never appear as successful library files.

**Acceptance evidence:** Upload an original through the document API, compare its retained hash/size and download bytes, and submit bad checksum, size and filing values without creating a visible record.

### CHEST-04 — Accountable filing and safe moves.

Supplier, customer and project filing retains original names, typed values and responsibility. Moves require current source-record and destination-collection editor access; inherited access follows the destination while versions and review history remain intact.

**Acceptance evidence:** Move a reviewed file through the filing API between differently shared collections; reject a source-only editor, then prove new readers gain access and former readers lose search/download access without changed versions.

### CHEST-05 — Safe basic previews.

Signature-classified PDF/raster and escaped UTF-8 text can be previewed. Unknown formats remain downloadable; active HTML/SVG is sandboxed plain text. Broader rendering is PREVIEW-001.

**Acceptance evidence:** Open text, PDF and raster previews from the built document page at 1440 and 390; download an unknown original, and verify sandbox/no-store/nosniff headers and inactive SVG.

### CHEST-06 — Current access governs every private door.

Current access filters lists, counts, title/metadata/admitted-text search, detail, preview, download and mutations. Derived text records parser provenance and exact version identity; it never creates access of its own.

**Acceptance evidence:** Search distinctive admitted text as owner, reviewer and outsider, then revoke a group grant and repeat list/count/detail/preview/download/mutation requests, including old version URLs.

### CHEST-07 — Immutable versions and precise approved pointers.

Every replacement is a new immutable original. For a governed file, approved A remains current while B/C await review; approving B never selects pending C. Ordinary file editing also retains history without requiring a review workflow (SPACE-001).

**Acceptance evidence:** Upload A, B and C through the versions API, approve B explicitly and download each original, proving the approved pointer and earlier bytes never silently change.

### CHEST-08 — Exact-version human decisions.

Assignment, comments, requested changes and approval record actor and version. Assignment grants no access. Requested changes require a new immutable submission; only the assigned reviewer with current reviewer access can approve it.

**Acceptance evidence:** Request changes, reject approval of the rejected version and an unassigned actor, submit corrected bytes, and approve that exact version while preserving prior events and the earlier approved pointer until approval.

### CHEST-09 — Review and expiry work retain evidence.

Separate review and expiry dates create due/upcoming work. Completion records its actor, date and investigation evidence without destroying the file or treating an expiry as a deletion instruction. Automated follow-up is FOLLOW-001.

**Acceptance evidence:** Create both dates, inspect the work list, reject an empty completion and complete only review with evidence; expiry and originals remain.

### CHEST-10 — People and group grants.

The owner grants/revokes reader, editor and reviewer access for people/groups. Effective readers need active local identities; current group membership governs access, and imported people alone have no authentication authority. The full five-level space role model, delegated granting by space managers and policy-bound sharing by editors are ROLE-001 and SHARE-004; these grant rules continue to hold under them.

**Acceptance evidence:** Grant a group, inspect effective readers, remove its member and revoke collection access through the API; prove denial of details, search, previews, downloads and review mutations.

### CHEST-11 — Reviewed reversible archive admission.

Archive preview writes no documents and lists every item, hash, duplicate, mapping and gap. Apply binds the reviewed fingerprint and current authority; Base D1 journal/native target publish inert records, resume after restart and undo only untouched batches. Unsafe paths or corrupt bytes publish no documents.

**Acceptance evidence:** Preview/apply a bounded archive through the archive API, reject changed fingerprint/traversal/corruption, restart and resume, undo untouched records and preserve a conflicting native edit. Source decisions never become new Chest approvals.

### CHEST-12 — Complete independent local recovery.

Local RER export and empty-target restore retain the semantic graph, portable people/groups/roles/grants, all original version bytes, derived provenance, decisions, completions, trash, audit and import custody. Credentials and dispatch outbox are excluded; setup regenerates secrets and old credentials fail. Nonempty/corrupt restore is atomic refusal. Private archives cannot be exported into served assets and archive-bearing public assets block build/setup.

**Acceptance evidence:** Use real RER export/import in a fresh target, compare all portable cells and original chunks, reject corrupt/nonempty/tampered metadata restores and public-asset exposure, then sign in afresh and recheck private imported records and trash.

### CHEST-13 — Self-service reversible trash and mutation audit.

Every user has a trash view of the items they trashed and restores any of them, files or whole folder trees, with no owner or admin involved, provided they still hold the role that let them trash it. Space managers and content managers (ROLE-001) see and restore every trashed item in their space whoever trashed it; admins with content-recovery scope (ADMIN-003) restore across spaces. Viewers, commenters and contributors cannot trash shared-space items and cannot restore someone else's. A restored folder returns with its tree, versions, stable IDs, comments and inherited permissions; restoring never re-enables a revoked link or identity. Trash retains originals and history indefinitely until a separately authorized erasure; no age or expiry silently destroys them. Permanent removal from trash belongs only to space managers and admins under ERASE-001. Mutations are audited, and current access filters activity views. Point-in-time folder/account rewind is RECOVER-001.

**Acceptance evidence:** Through the API and browser at 1440 and 390, a staff editor trashes a nested folder of their own in a team space and restores it from their own trash view, tree, hashes, version IDs and stable links identical, with no owner session involved. A space reader is refused restore (403) of that folder and a contributor is refused trash; a space manager restores an item another member trashed; a manager's permanent-delete request goes through ERASE-001 while an editor's is refused. The trashed item disappears from a reviewer's list/search/download, and each trash/restore appears once in the audit with actor and outcome.

## The everyday business file system

### SPACE-001 — Team spaces and ordinary files.

Staff store everyday files in personal areas and team-owned hierarchical shared folders, create/rename/move/copy folders and mixed Office/PDF/Google content, star/recently open files and transfer content ownership when staff leave. Stable IDs survive moves. Ordinary upload/edit/open works without mandatory schema, reviewer or approval; owners opt selected folders into CHEST-02/07/08 governance. Space managers set membership and inherited/restricted subfolder roles from the ROLE-001 levels with an effective-access explanation. Each space serves at least the SCALE-001 reference size (500,000 items, 100 nested folder levels, 600 direct members) without changed behavior.

**Acceptance evidence:** As two staff and an admin, build a nested project tree, upload an ordinary file with no review configuration, edit/move it, restrict a subfolder and offboard its creator; the team retains content and stable links while the former user is denied. Repeat browser navigation at 1440 and 390, then repeat listing, move and restriction in a space loaded to the SCALE-001 reference size and record the SCALE-001 timings.

### ROLE-001 — Five-level roles and delegated sharing.

Spaces, folders and files grant one of five cumulative roles to people, groups and guests (SHARE-005): **viewer** (open, preview, download unless restricted); **commenter** (viewer plus comment, mention and annotate under EDIT-003); **contributor** (add files and new versions and edit content, but not move, trash or share); **content manager** (contributor plus move, copy out, trash/restore and share items within policy); **manager** (content manager plus membership and role changes, permanent delete under ERASE-001, space settings and deleting the space). The CHEST-10 reviewer duty is an attribute that combines with any level from commenter up and never implies more access. File-level grants on personal-area items use viewer, commenter and editor (editor = contributor plus move/trash/share of that item). Editors and content managers share items to people and groups when POLICY-001 allows it, and a manager can switch editor sharing off per space. A per-space and per-file setting stops viewers and commenters from downloading, printing and copying; previews then stream rendered pages only and every original door (download, range, sync, API, archive, link) refuses them. Role changes take effect on the next request through every door.

**Acceptance evidence:** For each role, one public-door test through the HTTP API and one through the browser UI attempts open, download, comment, upload a new version, move, copy out, trash, restore, share and change membership on a space folder and a file; each permitted action succeeds and each other is refused with 403 and no state change. Turn on the no-download setting and prove viewer and commenter downloads, range requests, archive inclusion (BULK-001), sync hydration and API reads of the original are refused while pages still preview. Switch editor sharing off and prove an editor's share is refused while a manager's succeeds. Downgrade a role mid-session and prove the next request uses the new role.

### TRANSFER-001 — Resumable files and whole-folder uploads.

Browser, desktop and mobile upload whole folder trees and multi-GB originals with durable progress, pause/cancel/resume and per-item results. The maximum single file is **5 TB** (5,000,000,000,000 bytes) through the desktop client, mobile app, public API and resumable browser upload; one folder upload accepts at least 100,000 items. Resumption survives network/process loss, verifies bytes before publication and never duplicates a completed file. Invalid names, case collisions, path lengths, quotas, files above 5 TB and unsupported files have actionable item-level errors without losing other successes.

**Acceptance evidence:** Upload a nested folder containing a 50 GB video and duplicate names, interrupt connectivity and restart the client, then resume and compare hashes/tree/counts; cancel another transfer and prove no false success or half-visible file. Through the public API, upload a 5 TB sparse-pattern test object with resumable parts and verify its SHA-256; a 5 TB + 1 byte declaration is refused before any bytes are stored. Upload a 100,000-item folder and reconcile the per-item results. Test a quota refusal and retain completed files.

### BULK-001 — Multi-select actions and archive download.

In the browser, desktop client and mobile app, users multi-select files and folders, including across subfolders and search results, and move, copy, share, trash, restore or download them in one action. Each item is checked against the actor's current role (ROLE-001) and POLICY-001; refused items are reported per item without blocking the rest, and a partial result is never shown as complete. Downloading a folder or selection streams one ZIP archive (ZIP64 for archives over 4 GB, original names and folder tree preserved) containing only items the actor may download, with a manifest listing each path, version ID, size and SHA-256 and each excluded item with its reason. Guests on a folder link (SHARE-001/005) and request recipients get the same archive download within their grant. Bulk operations are durable jobs that survive restart and are audited once per item.

**Acceptance evidence:** Multi-select 200 files across two subfolders, including 5 the actor may not download under a no-download setting, and download one archive in the browser at 1440 and on the mobile app; unzip it and reconcile tree, names and SHA-256 hashes against the manifest, with the 5 listed as excluded and absent. Bulk-move and bulk-share the same selection where 3 items are refused by role or policy and see 197 successes plus 3 per-item refusals. Restart the server mid-job and see it complete once without duplicate moves or audit entries. Download a 6 GB folder as a guest through a folder link and verify the ZIP64 archive.

### SYNC-001 — Windows and macOS filesystem clients.

Signed, installable macOS and Windows clients mount Chest in Finder/Explorer for existing applications. Users choose on-demand virtual files or mirrored folders per space; selective offline pinning, local cache budgets and visible hydration state let them open/save/rename/move files as local files. Client updates, sign-out and uninstall preserve unsent work and expose what remains locally. Supported matrix: **macOS 13 Ventura or later on Apple silicon (arm64) and Intel (x86_64)** through Apple's File Provider framework, and **Windows 10 22H2 and Windows 11 23H2 or later on x64 and ARM64** through the Windows Cloud Files API; each new major OS release joins the matrix within 90 days of general availability. Installers are signed and notarized (Apple Developer ID) or Authenticode-signed, and deploy silently through MDM (Jamf, Microsoft Intune).

**Acceptance evidence:** Run the full journey on every matrix cell: macOS 13 and the current macOS release on Apple silicon, macOS 13 on Intel, Windows 10 22H2 x64, Windows 11 x64 and Windows 11 ARM64. On each, install (including one silent MDM install per OS), sign in, open an online-only Office file from Finder/Explorer, save and observe its new server version from a second device. Switch mirror/stream modes, pin a folder, sign out and uninstall with unsent edits; show exact disposition of local work.

### SYNC-002 — Offline edits and lossless conflict reconciliation.

Pinned files open/edit offline and reconcile automatically on reconnect. Divergent local/cloud copies, case-only renames, moved parents, delete-versus-edit and mirror/stream cutover preserve both conflicting byte versions with named conflicts for human resolution. A reconnect never uses an outdated permission grant; denied uploads preserve a private local recovery copy without republishing remotely.

**Acceptance evidence:** Edit a pinned file offline while another staff member changes it remotely, switch sync mode and reconnect; inspect both originals and resolve explicitly. Repeat delete-versus-edit, case rename and permission revocation, proving no silent overwrite or unauthorized remote write.

### SYNC-003 — Visible sync operations and device control.

Users see queued/uploading/downloading/conflicted/paused/failed/up-to-date states, byte progress, last successful contact and an actionable reason per file. Admins see stale devices, client versions and unresolved errors; they can revoke a device, pause a folder and request a scoped cache wipe. Wipe status distinguishes requested, acknowledged and unreachable; downloaded copies cannot be promised remotely erased. At the SCALE-001 reference size, a device that was offline for 7 days catches up on 10,000 remote changes within the SCALE-001 sync target, and the admin console lists every device in the installation.

**Acceptance evidence:** Disconnect a device during transfer, exceed its cache/disk quota and revoke it; its tray and admin console show accurate unfinished work and last contact. Resolve the cause and verify hashes before showing up-to-date; an unreachable wipe stays unconfirmed. In the SCALE-001 reference installation, take a device offline, apply 10,000 remote changes, reconnect and record catch-up time against the SCALE-001 target with final hashes matching.

### SYNC-004 — Creative assets stream and lock safely.

Byte-range streaming opens/seeks multi-GB video/design assets without full predownload, with explicit pinned ranges and cache use. Adobe Creative Cloud, AutoCAD and Final Cut Pro work through the mounted filespace with tested save/rename semantics and app-aware locks; a second writer sees the lock, and stale leases require explicit recovery with unsent changes retained. Browser open-in-native-app saves a new version to the same identity.

**Acceptance evidence:** Open and seek a large video in Final Cut Pro, save a Photoshop asset and AutoCAD drawing from two clients, record transferred ranges and verify final checksums/version IDs. Compete for a lock, kill its holder and recover without losing either writer; open the same file from its browser page.

### SYNC-005 — Hybrid local cache and storage.

An owner can deploy an on-premises cache/storage connector for branch-office shared files, with encrypted credentials, configured folder scope, quotas and health reporting. LAN and cloud clients use the same IDs, permissions and history; an offline cache does not turn stale ACLs into unlimited authority, and conflicts survive reconnection.

**Acceptance evidence:** Connect two office clients and a remote client to a scoped cache, disconnect WAN and expire offline authorization, edit permitted pinned files, then reconcile conflicts and verify all final hashes and access. Replace the cache and recover from owner storage.

### SYNC-006 — Computer folder backup.

The SYNC-001 client also backs up folders that already live on the computer: Desktop, Documents, Pictures, Downloads and any other local folder the user adds, as Google Drive for desktop and OneDrive Known Folder Move do. Each backed-up folder becomes a folder in the user's personal area named for the device, keeps its local path, and syncs two ways or uploads only, as the user or policy chooses. Admins enforce known-folder backup for a group, prevent it, or leave it to users, and can block named paths or file types; the client shows per-folder status (scanning, backing up, up to date, paused, error with reason) and the admin console shows each device's enrolled folders and last success. Local deletions follow CHEST-13 trash rules and stay recoverable; versions follow CHEST-07. On a new or wiped computer, the user signs in and restores any device's backed-up folders to their original paths or to a chosen location.

**Acceptance evidence:** On macOS 13+ and Windows 11 from the SYNC-001 matrix, enrol Desktop and Documents (one by user choice, one by an enforced admin policy), create, edit and delete local files and see new versions and trashed items on the server with the device-named folder. Try to un-enrol the enforced folder as the user and be refused; block `*.tmp` and prove it is not uploaded. Wipe the laptop, sign in on a second computer, restore both folders to their original paths and reconcile tree and SHA-256 hashes, and restore a deleted file from trash. The admin console shows enrolled folders and last success for both devices.

### MOBILE-001 — Native iOS and Android file access.

Native iOS/Android apps browse/search team folders, preview/share, scan with camera, upload photos automatically from selected albums and receive the user-approved background upload queue. They integrate system Files/document pickers, open files in other apps and save new versions. Users pin selected files for offline edits; device locks, local encryption, revocation and explicit offline-grant expiry protect cached business data. Supported matrix: **iOS and iPadOS 17 or later** (arm64, iPhone and iPad) with a File Provider extension, and **Android 10 (API level 29) or later** on arm64-v8a with a Storage Access Framework DocumentsProvider; each new major OS release joins the matrix within 90 days of general availability. Apps ship through the Apple App Store and Google Play, with managed configuration through Microsoft Intune and Jamf.

**Acceptance evidence:** Run the journey on an iPhone on iOS 17, an iPhone on the current iOS release, an iPad on the current iPadOS, an Android 10 device and an Android device on the current release. On each, capture a multi-page scan, upload photos, share with a permitted recipient, open/save through a system picker, and edit a pinned file offline while another device changes it. Reconnect, resolve the conflict and revoke the device; show the limit of an unreachable cache wipe.

## External exchange, previews and collaboration

### SHARE-001 — Policy-controlled external links.

Create file/folder links for named invited guests, authenticated domains or a public audience, each only where the POLICY-001 sharing policy in force for that space and sharer allows it. Sharers choose password, expiry, allowed versions (current, approved-only or pinned), the link's role (viewer with or without download, commenter, or for named guests the SHARE-005 editor/contributor roles) and download-count limits; revocation and policy changes apply to every request, including old preview URLs. Folder changes cannot expose restricted descendants. Only password hashes are stored; link capabilities never appear in logs, public exports or chat previews.

**Acceptance evidence:** Share a restricted folder and pinned approved file with an external recipient; try wrong password, wrong domain, guessed child URLs, expired/revoked links and parallel downloads at the count limit. Confirm approved-only never reveals pending replacements and a revoked link fails on the next request.

### SHARE-002 — Upload-only file requests.

Staff issue upload-only request links for a destination, checklist, allowed types/sizes, deadline and submitter verification policy. A recipient without a Chest seat can send resumable large files, receive a receipt and replace their own submission when allowed, without listing/downloading others or choosing a destination outside the grant. Quarantine and late/duplicate handling are visible; closing the request stops new acceptance.

**Acceptance evidence:** Send a vendor request, submit from a signed-out phone, interrupt/resume a large upload and receive its receipt. Try another submitter’s files, path traversal, disallowed content and an expired/closed request; verify none grants library access.

### SHARE-003 — Delivery receipts and large-file transfers.

Create a version-pinned large-file transfer package with resumable downloads, expiry, count limits and optional receipt confirmation. Link owners see attributed authenticated views, anonymous views, completed byte transfers and explicit recipient confirmations as distinct events. Notifications never label provider acknowledgment or a preview-bot request as proof a human received the file.

**Acceptance evidence:** Send a multi-GB package to an invited recipient and a public recipient; interrupt/resume download, exercise the limit and inspect view/download/confirmation events. A mail scanner GET and successful email API response must not set human receipt; expiry stops new range requests.

### SHARE-004 — Item sharing, Shared with me and access requests.

Any staff member shares a file or folder from their personal area, and any editor or content manager shares a space item (ROLE-001), with named colleagues or groups at viewer, commenter or editor, with an optional message, subject to POLICY-001. Recipients get an in-app notice and an email, and Slack/Teams where connected (FOLLOW-001), and find the item under **Shared with me**, filterable by sharer and date, with add-to-my-area shortcuts that grant nothing further. A signed-in person who opens a link they cannot use sees **Request access** with an optional message and requested role, never the item's name or contents beyond what the link already reveals. The request goes to the item's sharers with share rights (owner, file editors, then space managers); each can approve at the requested or a lower role, or decline, from the email, the in-app notice or the share dialog, and the requester is told the outcome. A request whose owner has left or been deactivated routes to the new content owner set at offboarding (SPACE-001), then to the space managers, then to admins with content-recovery scope (ADMIN-003); it never stalls silently. Requests expire after 30 days with the requester notified, and each request, decision and grant is audited.

**Acceptance evidence:** Share a personal-area file with a colleague at commenter; they receive the notice and email, find it under Shared with me and can comment but not edit. An unauthorised colleague opens the link, sees Request access without the title, requests editor; the owner approves at viewer from the email link and the requester is told and can now view. A second request is declined from the share dialog and the requester is told. Deactivate the owner of a third file and request access; the request reaches the new content owner, and with none, a space manager. Repeat at 1440 and 390 and inspect the audit entries.

### SHARE-005 — External collaborators who edit, comment and upload.

Named guests outside the organisation, with or without a Google or Microsoft account, receive viewer, commenter, editor or contributor roles on a file or folder (ROLE-001) where POLICY-001 allows external sharing to their domain. Guests sign in with a one-time PIN sent to the invited email address or with a verified Google/Microsoft identity matching it, and re-verify after an admin-set interval (default 7 days, range 1–30); a forwarded invitation alone admits no one else. Sharers set a guest expiry date per grant and admins set a maximum; on expiry every door refuses the guest on the next request. A sharer setting, defaulting on for external guests, stops guests re-sharing or inviting others. Guests co-edit Office files through EDIT-001 and upload into folders they hold contributor or editor on, and every guest edit, upload, comment and version carries the guest's verified email in version history, comments and audit. Guests hold no seat, see only what they are granted and cannot browse, search or list anything else.

**Acceptance evidence:** Invite a guest at another domain with no Google or Microsoft account as editor on a DOCX and contributor on a folder, with a 3-day expiry and re-sharing off. The guest signs in by PIN, co-edits the DOCX with a staff member through EDIT-001 and uploads two files into the folder; version history and audit attribute each change to the guest's email. The guest's attempts to share onward, open a sibling folder, search the library and use the PIN from a second email address are refused. Advance a controlled clock past re-verification and see a new PIN required, then past expiry and see every door, including an open editor session's next save and a range request, refused.

### POLICY-001 — Organisation sharing policy.

Admins with sharing-policy scope (ADMIN-003) set an organisation sharing policy, with overrides per space and per group, that states: whether sharing outside the organisation is allowed at all; a trusted-domain allowlist that, when on, limits external grants and links to listed domains; whether public (anyone-with-the-link) links are allowed; whether shared-space content may be shared with people who are not members of that space; whether editors (not only managers) may share; and whether users see a warning naming the external recipients before sharing outside the organisation. The most restrictive applicable rule wins where space and group overrides conflict, and the share dialog explains which rule refused or warned. Policy is enforced at every share door: share dialog, API, SHARE-001–005, Slack/Teams (CONNECT-001/002), email add-ins (CONNECT-008), automation apps (CONNECT-009) and agents. Tightening the policy applies to existing grants and links on their next request: out-of-policy links stop working with a policy-refusal page, out-of-policy guests are suspended rather than deleted, and the admin sees the list of suspended grants to remove or re-allow. Every policy change is audited with before and after values.

**Acceptance evidence:** Set an allowlist of one partner domain with public links off. As staff, a share to a non-allowlisted domain and a public link are refused in the UI and API with the policy named; a share to the allowlisted domain succeeds after the external-recipient warning. Create a public link and a non-allowlisted guest grant under a looser policy, tighten the policy and prove both are refused on the next request and listed as suspended. Set a space override that blocks sharing outside its members while the organisation allows it, and see a member's share to another colleague refused. Confirm the same refusals through the CONNECT-007 API and a CONNECT-009 action.

### PREVIEW-001 — Office, Google, video and design previews.

Permission-checked browser/mobile previews, with pages, thumbnails and seek controls where applicable, cover this named matrix: **documents** PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, RTF, Apple Pages/Numbers/Keynote, Google Docs/Sheets/Slides/Drawings, EML/MSG; **text** TXT, CSV, TSV, MD, JSON, XML and common source code; **images** JPEG, PNG, GIF, WebP, HEIC/HEIF, TIFF, BMP, SVG (rendered as a sanitized raster) and camera RAW (DNG, CR2/CR3, NEF, ARW); **video** MP4 and MOV in H.264, HEVC/H.265 and Apple ProRes 422/4444, plus WebM (VP9/AV1) and AVI, played through a transcoded H.264 streaming proxy with seek; **audio** MP3, WAV, AAC/M4A, FLAC, AIFF and OGG; **design and CAD** PSD/PSB, AI, EPS, INDD (embedded preview), Sketch, DWG and DXF (AutoCAD 2000 through 2018 formats), STL and OBJ; **archives** ZIP listing without extraction. Formats outside the matrix show a named unsupported state. Separate bounded processing services retain original bytes, exact source-version identity, renderer provenance and visible pending/failed/unsupported states; rendering does not execute file macros or widen permissions.

**Acceptance evidence:** Open one fixture per matrix format from the file page in the browser at 1440 and 390 and in both mobile apps, checking page count, first-page thumbnail and, for video/audio, seek to a mid-file timestamp; a format outside the matrix shows the unsupported state with download. Revoke access while a preview is open and request fresh pages/ranges; deny them. Test corrupt/malicious files and processor outage, expose the exact failure and keep the original downloadable to an authorized user.

### SEARCH-001 — Full-text and scanned-content search.

Extract searchable text from every admitted file in this named matrix, retaining source version, parser/language, confidence and extraction state: **OCR** of image-only PDF pages and JPEG, PNG, TIFF, HEIC and WebP images in English and Spanish (other languages indexed with their detected language recorded); **text extraction** from PDF text layers, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, RTF, Apple Pages/Numbers/Keynote, Google Docs/Sheets/Slides via export, EML/MSG bodies and attachments, TXT, CSV, MD, HTML, JSON and XML; **transcripts** of English and Spanish speech in MP4, MOV, MP3, WAV and M4A. The full extracted text of each version is indexed; any truncation is shown as partially indexed with the offset reached. Search spans names, content, typed metadata, owners, dates, folders and versions with snippets and filters, and meets the SCALE-001 search target at the reference size. Unsupported or encrypted files visibly remain unindexed. Current permissions govern hits, snippets, counts, suggestions and AI retrieval; revocation supersedes stale indexes.

**Acceptance evidence:** Upload one fixture per matrix format, each holding a distinctive phrase (including a scanned English invoice, a scanned Spanish receipt, an Office spreadsheet, a Google document, an MSG with a DOCX attachment, a spoken-phrase MP4 and an encrypted PDF), find every phrase and filter by folder/version. Show OCR provenance and the encrypted-file gap; revoke a group before index refresh and prove zero leaked snippets/counts/autocomplete through search API and UI. Repeat a fixed query set in the SCALE-001 reference installation and record latency against the SCALE-001 search target.

### EDIT-001 — Office and independent browser co-authoring.

Microsoft 365/Office web and desktop integration and an owner-deployable Collabora Online or ONLYOFFICE-class editor let staff co-author DOCX/XLSX/PPTX without rebuilding an office engine. Current file grants, including SHARE-005 guest editor grants, scope editor sessions; saves keep format fidelity, stable identity, immutable revisions and attributed edits. Owners choose providers, data disclosure and licensing; loss of provider/license is visible and originals remain portable.

**Acceptance evidence:** Two real accounts co-edit a document, spreadsheet and slide deck through Chest, verify concurrent changes and saved versions, then revoke one user mid-session and reject their next save. Round-trip tables/formulas/comments and test a provider outage and a review-gated file whose approved version must remain unchanged.

### EDIT-002 — Google-format collaboration without hidden loss.

Google Workspace Docs, Sheets and Slides integration opens/co-edits native content with explicit source custody and granted scopes, saves revision provenance and exports portable Office/PDF derivatives. Migration can convert to Chest-hosted editable formats with a fidelity report; a shortcut alone never counts as a migrated original. Provider-required features remain disclosed until the owner accepts conversion or continued provider use.

**Acceptance evidence:** Create and co-edit each Google type from Chest with two accounts, then export/convert a file containing comments, formulas and embedded content. Reconcile unsupported features, revoke source access and prove that accepted Chest-held originals/derivatives remain accessible with accurate source and revision labels.

### EDIT-003 — Contextual comments and collaborative tasks.

Files support threaded comments, mentions, resolved tasks and PDF page/region annotations, bound to the exact version. Users can compare versions, navigate unresolved comments and carry a thread forward only with an explicit link to its original. Mentioning or assigning a person never grants them access.

**Acceptance evidence:** Annotate page 2 of a PDF, mention an authorized colleague and an outsider, resolve a thread and upload a changed-page replacement. The old annotation remains anchored to its original, notifications contain no forbidden text and the outsider gains no access.

## Recovery, administration and operational trust

### RECOVER-001 — Folder and account point-in-time recovery.

A user rewinds their own files and folders; a space manager rewinds any file, folder tree or the whole space they manage; an admin with content-recovery scope (ADMIN-003) rewinds a departed user's account or any space. Each previews and restores to a chosen recorded point after accidental deletion, overwrite or ransomware, with no installation owner required. Bulk restore after a detected incident is SECURITY-003. The preview lists changed originals, names, hierarchy, memberships and sharing effects; restoring content cannot silently re-enable revoked shares or users. Recovery creates an attributed new state while retaining later recoverable history and conflict copies.

**Acceptance evidence:** Make a folder with multiple versions, rename/delete it and overwrite sibling files, then, as the space manager (not the installation owner), preview a time-based rewind and restore selected content. Compare every restored byte/path, retain later history and prove a formerly revoked external link and staff identity remain denied. A space viewer is refused the rewind; an editor rewinds only their own files.

### RECOVER-002 — Scheduled independent backups and upgrade recovery.

Owners schedule encrypted independent backups to Amazon S3, Cloudflare R2 or an S3-compatible owner account outside the live sync authority, with retention, last success, failure alerts and a recovery drill. Archives cover all new product records, originals, comments, links as inert definitions, rules, migration mappings and sanitized execution history; secrets/devices/sessions never transfer and sending jobs never replay. Upgrades preserve configured settings and data; a failed upgrade has a documented rollback from a private backup.

**Acceptance evidence:** Back up a populated installation, corrupt the live store and restore into a clean instance, reconcile the complete graph and hashes, reauthorize providers and prove no old device/link authority or queued message replays. Upgrade a copy of a populated prior release, inspect identity/settings/history, and recover from an interrupted upgrade.

### ADMIN-001 — Federation and lifecycle provisioning.

Okta, Microsoft Entra ID (Azure AD) and Google Workspace identity support SAML/OIDC SSO with enforced domain policy, group mapping and SCIM or the provider’s supported directory lifecycle API. Owners preview destructive group changes, retain a protected break-glass path and transfer content/assignments before deprovisioning; disabling a user revokes web/mobile/editor/device/agent authority and external grants that depend on that identity.

**Acceptance evidence:** In each provider test tenant, provision a user/group, sign in, change membership and deactivate the user. Confirm all public doors/devices/editor sessions lose authority, team content remains owned, and a bad mapping/IdP outage does not strand the protected owner recovery path.

### ADMIN-002 — Admin reporting and legible USD costs.

Admins filter/export user/content activity, access and sharing changes, external guests, downloads, storage by team/version/trash, sync failures, transfer usage and extraction/AI spend. Capacity/seat limits, retention and US-dollar storage/egress/provider charges are explicit before enabling paid work; estimates are distinguished from invoices. Quotas warn early and refuse excess writes without deleting retained records.

**Acceptance evidence:** Create activity from staff, guest, client and agent; reconcile a permission-scoped CSV report with source events and bytes including old versions/trash. Reach a test quota and trigger an estimated provider cost; show the warning and preserved originals, with no invented savings or live-price claim.

### ADMIN-003 — Several admins, delegated admin roles and owner transfer.

The installation owner promotes any number of staff to **super admin** (every admin action, including other admins' roles) and assigns delegated admin roles, alone or combined, each scoped to the whole organisation or to named groups: **user management** (invite, deactivate, reactivate, change groups, transfer content at offboarding); **help desk** (resend invitations, revoke sessions and devices, reset a user's sign-in factors under ADMIN-004); **sharing and security policy** (POLICY-001, SECURITY-002/003 settings); **service settings** (integrations, backup, sync and mobile policy); **content recovery** (restore across spaces under CHEST-13/RECOVER-001); and **audit and reporting** (read-only ADMIN-002/AUDIT-001). Admins can also define custom roles from these privileges. An admin role confers no access to file contents, names, previews or search results unless that person also holds a content role (ROLE-001); content recovery restores items without opening them. The owner role transfers to another super admin with the recipient's acceptance and a fresh sign-in; afterwards the former owner keeps only the roles explicitly left to them. At least two super admins are recommended and the console warns while only one exists; the last super admin cannot be demoted or deactivated. Every role grant, change and use is audited.

**Acceptance evidence:** As owner, promote a second super admin and grant a staff member help desk scoped to one group. The help-desk admin revokes a group member's sessions and resets their second factor, then is refused that member's file list, previews, downloads and search hits, a reset for a user outside the group, and a policy change. Transfer ownership to the second super admin; the former owner is refused owner-only actions (installation settings, owner transfer, super-admin changes) on the next request while the new owner succeeds. Try to demote the last super admin and be refused. Inspect the audit of each step.

### ADMIN-004 — Enforced multi-factor sign-in without an identity provider.

Installations that do not federate through ADMIN-001 enforce two-step verification natively. Factors are TOTP authenticator apps, WebAuthn security keys (FIDO2) and passkeys, with one-time recovery codes; SMS is not offered. Admins enforce MFA for the organisation or chosen groups, set an enrolment grace period for new staff (0–30 days) during which each sign-in requires enrolment before content opens, may require phishing-resistant factors (security keys or passkeys) for admins, and set session length and idle timeout for web, desktop and mobile. When MFA is enforced an email sign-in link alone never opens a session: the second factor is always required, and a stolen link fails without it. A user who loses every factor recovers through a recovery code or through a help-desk admin (ADMIN-003) who verifies them and issues a single-use enrolment link that expires in 24 hours; every reset is audited and notifies the user. Federated sign-ins rely on the IdP's MFA, which admins can require.

**Acceptance evidence:** Enforce MFA for everyone with a 0-day grace period. An unenrolled staff member's next email-link sign-in is held at enrolment, enrols a TOTP factor and then opens the library; a second user enrols a passkey. Replay a captured valid email link from another browser without the factor and be refused. Require security keys for admins and prove an admin with only TOTP is refused the console. Set a 1-hour session length and see a session end. A user who has lost their factor is reset by a help-desk admin, enrols again through the single-use link, and the link fails on second use and after 24 hours.

### SECURITY-001 — Scoped encryption and secret custody.

Transport, owner-selected storage and device caches use encryption with explicit installation/provider key custody, rotation and recovery procedures. Provider credentials, link capabilities and signing keys remain secret, encrypted at rest and absent from source, served assets, product archives, logs and AI prompts. Server-side current-session/origin checks cover every mutation; integrations use least scopes and revocation, and exported portable grants confer no login authority.

**Acceptance evidence:** Inspect public API, logs and archive output using a test canary credential, rotate/revoke a provider and device key, and retry old access. Submit a cross-origin mutation, unauthenticated request and stale grant race; all fail closed while authorized originals remain recoverable under the documented key policy.

### SECURITY-002 — Content threats and classification policy.

Separately deployed malware scanning and classification detect infected uploads, suspicious mass downloads/deletes and sensitive content. Owners configure classification-based access, external sharing restrictions and quarantine/release roles, see reasons and false-positive handling, and can pause a device/token without destroying evidence. Original bytes never bypass a pending quarantine via an alternate preview, range or sync door.

**Acceptance evidence:** Submit a standard harmless malware-test specimen and a labeled sensitive document, simulate a burst through a test client and inspect quarantine/alert history. Try all preview/download/link/device doors, release only as an authorized reviewer and prove policy changes do not erase originals or silently expand access.

### SECURITY-003 — Ransomware and mass-corruption protection.

The SYNC-001/006 clients watch outgoing changes for mass encryption or corruption: bursts of rewrites whose content entropy jumps toward random, file signatures that no longer match their extensions, mass renames to new extensions and known ransom-note files. On detection the client pauses upload from that device before the server's current versions change, keeps downloading paused for affected folders, and holds the suspect changes locally. The same detection runs server-side on public API and browser uploads, pausing the token or session. The user and admins with security scope (ADMIN-003) are alerted at once in the client, by email and in the admin console, which names the device, account, first detection time and affected files. One action restores every affected file to its last version before the incident (or a chosen point under RECOVER-001), keeps the suspect versions as quarantined history, and leaves later legitimate edits by other devices untouched; a false positive is released with one action and uploads resume. The device stays paused until a user or admin resumes it.

**Acceptance evidence:** From a test client, rewrite 500 synced files with high-entropy content in under a minute. Upload pauses before any server current-version ID changes; the client, email and admin console show the event with device and file list. While paused, another device's legitimate edit to a different file syncs normally. Run the one-action restore and verify every affected file's current version and SHA-256 equals its last pre-incident version, with the 500 suspect versions retained as quarantined history. Repeat through the public API with a token and see the token paused. Release a deliberate false positive and see uploads resume with no loss.

### GOVERN-001 — Retention, legal hold and discovery integrations.

Owners configure retention classes, holds and erasure conflicts with a qualified immutable archive/eDiscovery service such as Amazon S3 Object Lock and Microsoft Purview. Export includes scoped originals, versions, chain of custody and activity; hold status names the provider’s acknowledgment, policy and retained scope. Chest does not call ordinary R2 storage certified WORM or invent legal sufficiency.

**Acceptance evidence:** Place a test project on provider-confirmed hold, request deletion, export a discovery package and reconcile hashes, versions and audit at the provider. Attempt deletion before release; show the hold/refusal and then an authorized release/erasure with the provider outcome.

### AUDIT-001 — Durable complete action history.

A searchable, exportable audit attributes reads/downloads, sharing/admin mutations, device actions and every automation/provider attempt to actor, exact version, authority and outcome. Failed/uncertain/crashed jobs retain durable outcomes and cannot disappear on restart or become success by timeout. Pagination/export includes all retained history beyond UI limits; audit payloads omit secrets and anonymize erased identities without deleting the action record.

**Acceptance evidence:** Create success, refusal, provider failure and interrupted execution through public doors, restart and inspect/export more events than one UI page. Reconcile action/version IDs and outcomes and then erase an actor without losing the fact of their actions or exposing personal/secret fields.

### ERASE-001 — Deliberate erasure separate from trash.

Authorized permanent erasure removes selected originals, all versions, derived text/thumbnails/embeddings, guest/link authority, import staging/custody and affected backup copies under disclosed provider retention. It revokes identities and credentials where requested, writes a durable per-store receipt and source erasure fence, and preserves a minimized anonymized action audit. Legal holds produce explicit refusal/pending provider outcomes. Offline historical copies cannot be recalled: restores must apply the later source journal or disclose the inability to know later erasures.

**Acceptance evidence:** Through an owner erasure workflow remove a populated file and a staff identity, inspect each storage/index/import/backup target and audit anonymization, restart and attempt search/download and restore of an older archive with the later erasure journal. Refuse resurrection; show an unreachable backup or held object as pending rather than complete.

### OPS-001 — Responsive accessible and observable operation.

Browser, native and admin paths expose loading, empty, failed and permission-denied states in words, preserve unfinished input and support keyboard/screen-reader operation with WCAG 2.2 AA as a tested target. Operators see health and stale/background jobs, configured US time zones, capacity, backup failures and measured deployment limits. Hosted mail, clients, processing and storage use named real accounts and reproducible install/update steps; no demo or provider stub counts as production acceptance.

**Acceptance evidence:** Use realistic nested project data through store/open/share/search/recover at 1440 and 390, keyboard and a screen reader; disconnect each service and recover without fake success or lost edits. Install the documented stack in an owner test account and record its measured limits and actionable health signals; the SCALE-001 run supplies the size and timings.

### SCALE-001 — Stated operating scale and responsiveness.

Chest serves a **reference installation** of 150 users, 300 synced devices, 10 TB of current originals plus version history, 2,000,000 items in total, a largest space of 500,000 items with 100 nested folder levels and 600 direct members, and a largest folder of 20,000 direct children. When a buyer's MIGRATE-001 inventory is larger in any dimension, acceptance runs at that inventory plus 25% growth headroom instead. At that size, measured at the 95th percentile from a US region on a 100 Mbps connection: the first page of a folder listing returns within 1 second and a 20,000-child folder scrolls without a full reload; full-text search across the user's accessible items returns first results within 2 seconds; a permission change is enforced on the next request through every door; a device offline for 7 days catches up on 10,000 remote changes within 15 minutes; a new device's initial on-demand enumeration of a 500,000-item space completes within 30 minutes without hydrating file bytes. Measured figures are published in the operator console, and a deployment that misses a target reports it as a failing health check rather than silently degrading.

**Acceptance evidence:** Generate the reference installation (or the buyer's inventory plus 25%) with a seeded generator that records item, byte, depth, member and device counts. Run a fixed script of folder listings, deep-path opens, 50 search queries, a revocation and an offline-device catch-up, and publish the counts and p50/p95 timings for each against the targets above. Revoke a group during the run and prove the next request through list, search, download and sync is refused. Rerun against a buyer's MIGRATE-001 inventory and show the size used.

## Move-in from incumbents and challenger filespaces

### MIGRATE-001 — Reconciled migration and controlled cutover.

Every source adapter inventories all files/folders, owners, principals, versions, timestamps, comments, links and unsupported records with counts/bytes/hashes and a reason for each gap. The owner previews identity/permission mappings, approves the exact plan and runs resumable idempotent batches plus a delta catch-up before cutover. Unmapped rights fail closed; imported approvals remain source history. Old vendor URLs require repointing or source-controlled redirects, never an invented ability to own their domains. A cutover manifest tracks replacement URLs and collaborator tests; rollback retains source read access and an independent archive.

**Acceptance evidence:** Through the migration wizard, inventory a representative source, change the source after preview, reject stale plans, resume an interrupted batch and reconcile every item and version. Approve delta/cutover, test internal and external collaborators and old-to-new links, then undo untouched work and preserve native edits as conflicts.

### MIGRATE-002 — Google Drive and Shared Drives migration.

Import Google Drive personal/shared drives using authorized APIs/export, preserving folder IDs/mapping, team ownership, file and revision bytes, shortcuts, native Google types and explicit user/group/domain ACLs. Reconcile comments/approvals and unavailable revisions as sourced history/gaps. Google conversion fidelity and source link repointing require owner acceptance before declaring Drive replaced. The adapter also carries:

- **Drive labels:** each label becomes a CHEST-02 type and each field a typed field (text, number, date, selection with its options, user), with applied values copied per file and the label/field IDs kept as provenance; badged labels and disabled options are inventoried, and any field type without an equivalent is a named gap.
- **Shared-drive roles:** Manager, Content manager, Contributor, Commenter and Viewer map one-to-one to the ROLE-001 manager, content manager, contributor, commenter and viewer roles; My Drive file roles Editor/Commenter/Viewer map to file editor/commenter/viewer; the shared-drive "allow viewers and commenters to download" and "sharing outside the drive" settings map to the ROLE-001 no-download and POLICY-001 space overrides. No mapping widens a role.
- **Google Vault:** retention rules and holds covering migrating accounts, shared drives or files are inventoried from the Vault API with matter, scope and dates; content under a hold or a retention rule migrates only after the owner acknowledges a receiving GOVERN-001 policy for it, and the migration report lists each one with its receiving policy.
- **Externally owned files:** files owned outside the domain that staff rely on (Shared with me, shortcuts to them and externally owned items in shared drives) are inventoried with owner, sharing and the staff who use them. For each, the owner chooses to copy it in with the source owner's consent recorded, keep it as a labelled external link, or request transfer from the source owner; none is silently copied or dropped.

**Acceptance evidence:** Migrate a real test Workspace with Shared Drives, a departed owner, native Docs/Sheets/Slides, shortcuts, nested restricted folders and historical versions, plus: a labelled file with a date field and a selection field; a shared drive with one member at each of the five roles and download-restricted viewers; a Vault hold and a retention rule over one shared drive; and an externally owned file shared into a shared drive and another in a staff member's Shared with me. Compare inventory, byte hashes, exported/native fidelity, principals and links; verify the label values as typed fields, run the ROLE-001 role tests against each migrated member, see the held content blocked until a GOVERN-001 policy is acknowledged, and see both external files reconciled by the chosen option or reported as named gaps requiring owner sign-off. Prove an external collaborator can use the replacement without access to forbidden folders.

### MIGRATE-003 — Dropbox Business migration.

Import member folders and team spaces through Dropbox APIs/export with revisions, deleted-file history where available, metadata, shared-folder membership and external links mapped under current Chest policy. Preserve distinct file IDs for equal hashes, account for selective-sync placeholders and report missing revision/transfer history explicitly.

**Acceptance evidence:** Migrate a real Dropbox Business test team containing a team folder, personal folder, revisions, deleted file and expiring links. Reconcile every source item/version and rights, perform a delta import, reissue controlled links and validate recipient workflows before cutover.

### MIGRATE-004 — Box migration.

Import Box folders, original/version bytes, metadata templates, collaborators, shared links and comments/tasks through authorized APIs/export. Preserve source legal-hold/retention/approval provenance separately and require an acknowledged receiving governance policy where relevant; never turn a source role into broader Chest rights.

**Acceptance evidence:** Migrate a real Box test space with custom metadata, a limited collaborator, versioned file and shared link; reconcile counts/hash/history and rights, report provider-held or unavailable items, test a guest and reconcile signed-off cutover/rollback.

### MIGRATE-005 — OneDrive and SharePoint migration.

Import OneDrive for Business and SharePoint document libraries through Microsoft Graph/export, preserving sites/library folder structure, originals/revisions, owners, groups, unique item permissions, metadata/content types and sharing-link mappings. Pages/lists and suite-specific workflows are inventoried with explicit handoff rather than silently called files or dropped.

**Acceptance evidence:** Migrate a real Microsoft 365 test tenant with a SharePoint library, OneDrive user, restricted subfolder, versions and guest link. Reconcile records/bytes/ACLs and unsupported pages/workflows, run a delta, offboard the source owner and validate the replacement links as staff and guest.

### MIGRATE-006 — Egnyte, LucidLink, Nextcloud and file shares.

Move Egnyte folders, LucidLink filespaces, Nextcloud/WebDAV libraries and SMB/NAS trees through documented APIs or mounted originals with a source manifest. Preserve names, bytes, times, rights and available history and report unavailable streamed ranges, encrypted content or vendor-only data. Hybrid cache and creative-workflow acceptance must succeed before retiring those source systems.

**Acceptance evidence:** Inventory a test filespace from each named challenger plus a NAS share, hydrate placeholders, migrate and reconcile hashes and rights; open a large creative file from the replacement mount and test a revoked collaborator. Any unexportable history remains a named gap requiring owner sign-off.

## Integrations, rules and follow-up

### CONNECT-001 — Slack file collaboration.

A scoped Slack app finds Chest files, shares policy-checked links and delivers subscribed comments, requests and review notifications in approved channels/DMs. Searches and link previews use the requesting user’s current access; channel membership is not a library grant. Admins control installation, scopes and revocation.

**Acceptance evidence:** Connect a real Slack test workspace, search/share as two users with different rights, change a folder grant and inspect channel unfurls/notifications. Revoke the app and prove it can no longer search/send; existing Chest links still enforce their own audience.

### CONNECT-002 — Microsoft Teams file collaboration.

A Microsoft Teams app supports file search/pick/open, controlled links and collaboration notifications under Entra-linked user identity and current Chest grants. Channel/private-chat content does not inherit broad storage access; tenant admins can restrict and revoke the app.

**Acceptance evidence:** Connect a real Teams test tenant, share a restricted file into a mixed-membership channel, open/edit as an authorized user and deny another. Revoke a group/app and verify search, cards, previews and queued notifications stop exposing content.

### CONNECT-003 — Salesforce record-linked files.

Salesforce account/contact/opportunity records link to scoped Chest folders and versions; authorized users file arrivals and see current approved content without duplicating CRM ownership. Mapping changes retain provenance and never grant every CRM user Chest access.

**Acceptance evidence:** Connect a Salesforce test org, attach a file to an opportunity, replace/approve it, change record/folder access and delete the CRM link; the original and provenance remain while unauthorized CRM users see no file content.

### CONNECT-004 — Docusign execution and return custody.

Send a human-selected exact version to Docusign, track envelope state and receive signed originals plus completion evidence as new immutable linked versions. Verify callback authenticity, reconcile uncertain submissions and deduplicate repeated callbacks; Chest approval is distinct from legal signature validity.

**Acceptance evidence:** Send an approved test agreement in a Docusign sandbox, complete and decline envelopes, replay a signed callback and simulate an uncertain send. Retain signed bytes/certificate, verify no duplicate envelope/version and never mark the pending source file signed on provider acknowledgment alone.

### CONNECT-005 — Zoom meeting file exchange.

Zoom integration lets authorized meeting participants pick permitted Chest files, share controlled links and file authorized cloud recordings/transcripts into a selected folder with source consent/provenance. A meeting invitation alone grants no file access; recording retention follows configured owner policy.

**Acceptance evidence:** In a Zoom test account, share a restricted deck with a guest and file an authorized recording/transcript after the meeting. Deny an unrelated participant and a revoked integration, inspect exact version/provenance and ensure a canceled recording job reports its real state.

### CONNECT-006 — Email and app intake.

Gmail/Google Workspace and Microsoft Outlook/Exchange Online connectors ingest only owner-approved mailboxes, labels/folders, senders and attachments into selected Chest destinations. Authorized Salesforce/Slack/Teams/Zoom app arrivals use the same provenance and deduplication rules. Reply/forward or external collection messages require a preview or narrowly granted standing recipient/cadence policy; revocation stops subsequent reads and sends.

**Acceptance evidence:** Connect real test Gmail and Microsoft 365 mailboxes, ingest an attachment once despite duplicate delivery, inspect source message/version provenance and reject a disallowed folder/sender. Revoke one source and verify queued jobs and sends stop at the authorization boundary.

### CONNECT-007 — Public API, webhooks and scoped agents.

Documented file/folder/version/search/share/request APIs and an MCP server provide user/agent-scoped access, pagination, stable IDs, idempotent mutations and signed event delivery. Grants name allowed resources/actions and budgets; secrets are installation-local. Webhook consumers deduplicate event IDs, see delivery failure/uncertainty and control replay; imported events do not send automatically.

**Acceptance evidence:** Authorize a third-party test client and MCP agent for one folder, exercise paginated reads and idempotent upload, then attempt another folder and permission expansion. Revoke the grant mid-job, fail a signed webhook and inspect its durable outcome/manual replay without duplicated product mutations.

### CONNECT-008 — Gmail and Outlook compose and save add-ins.

A Google Workspace add-on for Gmail and a Microsoft 365 add-in for Outlook (web, Windows, Mac and mobile) let each user, under their own Chest identity: pick a Chest file or folder while composing and insert it as a link at a chosen role; have any attachment over a set size (default 25 MB) turned into a SHARE-003 transfer link automatically; and save an incoming attachment, or the whole message as EML, to a Chest folder they choose. Before sending, the add-in checks every recipient against each inserted item's current access and warns naming who cannot open it, offering a one-step grant at viewer or commenter that POLICY-001 permits (or explaining the refusal); the user can also send without granting. Saves are idempotent per message and attachment, carry the message ID, sender and date as provenance, and are audited. Admins install, scope and revoke the add-ins for the organisation; the admin intake pipeline remains CONNECT-006.

**Acceptance evidence:** In real Google Workspace and Microsoft 365 test tenants, insert a restricted file into a message to an allowlisted external recipient; see the warning naming them, grant viewer in one step, send, and find the grant and audit entry; repeat to a non-allowlisted recipient and see the grant refused with the policy named. Attach a 200 MB file and see it replaced by a transfer link that the recipient downloads. Save the same attachment twice from Gmail and from Outlook and find one Chest file each with message provenance. Revoke the add-in and see the next insert and save refused.

### CONNECT-009 — Zapier and Make automation apps.

Published Zapier and Make apps let non-developers automate Chest without code, authorized through a CONNECT-007 grant naming the allowed spaces/folders and actions. Triggers: new file, new file in folder (including subfolders by option), updated file (new version), new folder, file moved or trashed, new file-request submission (SHARE-002) and new comment. Actions: upload file, create folder, move, copy, rename, share with a person or create a link (POLICY-001 enforced), remove permission, update typed metadata, find file or folder by path or search, and download file content for a later step. Triggers deliver each event once with a stable event ID; actions are idempotent on a caller key. Revoking or narrowing the grant stops triggers and refuses actions on the next call, and each Zap/scenario run appears in the audit under the grant.

**Acceptance evidence:** In real Zapier and Make test accounts, connect Chest with a grant for one folder and build "new file in folder → move to a subfolder and share with a colleague"; drop a file in and see it moved and shared once, with audit entries under the grant. Replay the trigger and see no duplicate move. Point an action at a folder outside the grant and see it refused; attempt a public link with public links off under POLICY-001 and see the policy refusal. Revoke the grant and see the next trigger stop and the next action fail.

### RULE-001 — Reversible arrival rules.

Owners preview naming, sorting, tagging, conversion and safe-unzip rules over selected arrivals/folders. Rules execute idempotently with original bytes, conversion lineage, policy version, item results and an undo plan; changed permissions, unsafe archives or conflicts stop affected items visibly. Rules cannot broaden sharing, bypass exact-version approval or delete originals.

**Acceptance evidence:** Preview a rename/tag/move/convert/unzip rule over real-format test files, approve it, replay the same event and inspect one result per original. Submit a traversal/archive bomb and alter a destination grant between preview and execution; retain originals and show blocked items, then undo an untouched move.

### FOLLOW-001 — Persistent collaboration follow-up.

Subscriptions and assigned tasks notify through email, Slack, Teams and mobile push for comments, review/change requests, approaching review/expiry dates, file-request deadlines, transfer receipts and unresolved sync failures. Owners choose US timezone, cadence, escalation recipient and quiet hours; completion, revoked access or canceled work suppresses future reminders. Job history separates queued, submitted, provider-acknowledged, failed, uncertain and person-confirmed outcomes with authorized retry/reconciliation.

**Acceptance evidence:** Assign a dated request and review, subscribe a collaborator, advance a controlled clock through due/reminder/escalation states and complete the exact task. Fail a provider, restart the worker and inspect the durable result; there is no duplicate reminder or forbidden content after completion/revocation.

## Push further: agents that maintain the file system

### AGENT-001 — File and classify authorized arrivals.

An agent reads granted file contents, OCR/extracted text, email/app provenance and project metadata to propose taxonomy, identify responsible people and file arrivals. It explains each suggestion with exact-version evidence and uncertainty. Standing folder grants allow reversible rename/tag/move only; new external access, destructive cleanup and uncertain classification require human approval. Document instructions are untrusted data and cannot expand tools or scope.

**Acceptance evidence:** Give the agent a project inbox containing ambiguous and malicious-instruction documents, preview its cited classification plan, allow one scoped move and reject another. Revoke source/destination access before execution; preserve originals and prove the denied/ambiguous action waits without extra reads or messages.

### AGENT-002 — Reconcile duplicates and superseded versions.

An agent correlates hashes, source IDs, content changes, version history and approvals to find exact/near duplicates and stale copies, propose canonical files and repair authorized internal references. Equal bytes never imply equal access or identity. Owners approve merges, overwrites, external link repointing and deletion; reversible consolidation retains originals, old-version references and separate source approvals.

**Acceptance evidence:** Seed duplicate bytes under different ACLs and a near-duplicate with a different signature/date; inspect the proposed version lineage and references. Approve a safe canonical-link change, reject a merge and verify no access union, lost original or reassigned approval.

### AGENT-003 — Repair permitted synchronization and verify bytes.

An agent correlates device sync queues, hashes, conflict copies, cache health and permission changes to diagnose incomplete files and repair explicitly granted device/folder settings. It compares both ends before declaring recovery, quarantines uncertain conflicts and requests approval before overwrite, cache deletion or permission expansion.

**Acceptance evidence:** Interrupt a device transfer, create a divergent offline copy and revoke a folder grant. The agent explains the cause, repairs a permitted paused queue, proves final hashes on both ends and leaves conflict/denied work waiting for the human rather than overwriting or widening access.

### AGENT-004 — Finish collection and prove the right version arrived.

For an owner-defined checklist the agent matches request submissions, approvals, transfer receipts and explicit collaborator confirmations to exact requirements/versions. It identifies missing/superseded evidence, drafts or sends narrowly authorized reminders to approved recipients at the approved cadence, and stops when the correct material is accepted. A later replacement or permission change reopens the mismatch; views/provider receipts alone do not prove the intended human has the right version.

**Acceptance evidence:** Request two vendor records, receive a stale file and then the correct approved replacement, confirm it as the intended recipient and inspect reminders stopping. Later revoke access or supersede the version; show the reopened issue and a proposed new delivery, without broadening recipients or auto-approving evidence.

### AGENT-005 — Continuously repair broken and over-shared links.

An agent checks current ACLs, guest lifecycle, link policies, intended collaborator lists and actual link outcomes to identify broken, orphaned, stale or excessive shares. It proposes exact version/audience repairs and explains affected people. Owners approve new/expanded access and external messages; preauthorized restrictive revocations can run with a reversible record and notification. It cannot rewrite a vendor-owned URL without control of that source.

**Acceptance evidence:** Create an expired link, departed guest, overshared subfolder and inaccessible approved replacement; run a scan as a restricted agent. Approve one repair and one restrictive revoke, deny an expansion and confirm destination access and the intended version while unrelated files stay unread.

### AGENT-006 — Build and validate a trustworthy move-in.

An agent constructs source-to-Chest identity/folder/version/link mappings using authorized incumbent inventories, reconciles every item/hash/gap and drafts a cutover plan with collaborator journeys. It can run approved read-only sampling and reversible staging; the owner signs permission mapping, conversion losses, delta boundary and cutover. It retains source read access and rollback archive until the owner accepts the move.

**Acceptance evidence:** Run against a representative incumbent test tenant with unavailable history, unmapped groups and native files. Inspect the generated mapping and unresolved gaps, reject an unsafe mapping, approve staging and validate staff/guest open-edit-share workflows before explicitly accepting cutover; exercise rollback.

### AGENT-007 — Evidence-grounded questions and custom jobs.

Users ask questions, extract fields and define bounded custom document agents over expressly granted folders/versions. Answers cite accessible original passages and extraction provenance, distinguish missing/uncertain evidence and retain the model/tool/data policy used. Owners select provider, data retention/residency, spend budget and human approval points; tool calls obey the same current ACLs and never autonomously approve/sign/delete or expand permissions.

**Acceptance evidence:** Ask a cross-file question with a contradictory revision and an inaccessible answer-bearing file, inspect exact citations and uncertainty, then run a schema extraction under a small approved budget. Change access mid-run and inject document tool instructions; deny forbidden retrieval/actions and expose provider failure/cost without fabricated answers or fallback success.

## Honest boundaries and delivery responsibilities

Chest owns the file-system job, native clients, sync, external exchange, search, integration experience and recovery. Native filesystem drivers run in maintained signed macOS/Windows clients; heavy OCR, rendering, media conversion and malware scanning run in separately deployed bounded services. Worker limits are an engineering deployment boundary, not a reason to omit these capabilities (SYNC-001/004, PREVIEW-001, SEARCH-001, SECURITY-002). iOS/Android distribution, OS entitlements, provider app registrations, API scopes, licensing, agreements and real-account acceptance are delivery work in the named clauses.

Chest integrates Microsoft 365, Google Workspace and Collabora/ONLYOFFICE-class editing engines rather than building another office suite. CAD/video/design creation remains in Adobe Creative Cloud, AutoCAD and Final Cut Pro, supported through SYNC-004. Salesforce owns CRM; Slack/Teams own chat; Zoom owns meetings; Docusign owns signature execution and its legal evidence. Chest keeps their files, pointers, version provenance and custody synchronized through CONNECT-001–007. It does not merge those products or absorb unassigned categories. Legal hold, certified regulated custody and discovery require a qualified provider and verified policy under GOVERN-001, not a marketing claim about generic object storage. Any BAA or regulated-data provider agreement needed for a buyer is acceptance work before that workload is enabled, not permission to remove the capability.

The first buyer operates in the United States. Commercial costs and estimates are USD, dates are unambiguous, stored times retain UTC plus the selected US business time zone, and guest collection/signature flows support US business counterparties. Chest does not replace payroll, tax, accounting or payment products; it stores their files and integrates authorized sources. No unmeasured price, storage capacity, throughput, vendor fidelity, accessibility certification or compliance outcome is claimed.

Today, searchable extraction admits UTF-8 text up to 500 kB; other originals have an 8 MB admission limit; move-in archives have 100-item/16 MB JSON bounds. Current PDF/raster viewing uses the browser. These are implementation gaps against TRANSFER-001, PREVIEW-001 and SEARCH-001, not target exclusions. Native clients, computer-folder backup, external links, item sharing and access requests, guest collaborators, organisation sharing policy, the five-level role model, delegated admin roles, native MFA, ransomware protection, bulk archive download, OCR, broad editors, mail add-ins, Zapier/Make apps and AI jobs are not implemented today, and no SCALE-001 run has been made; trash and restore are owner-only today (CHEST-13 partial). Real vendor accounts, production email/hosting, representative migrations and operational backups need the acceptance below before a buyer relies on them. Sync is never the only backup.

CHEST-12 and RECOVER-002 specify Chest's product-specific Base portability replacement: credential-free semantic data plus original objects, local integrity-bound empty-target restore and regenerated installation authority, with no dispatch replay. CHEST-11 preserves reviewed Base D1 import publication and conflict-safe undo. These are the recorded implementation policies, not an assertion of equivalence to every Base clause. New records and background outcomes must join the same portable graph; erasure fencing/minimized permanent audit remain explicit target work in ERASE-001/AUDIT-001. An archive digest proves byte consistency, not provenance; an old offline archive cannot reveal later erasure without the later journal. Trash is reversible; it is never a substitute for erasure or a legal hold.

## Status per clause

Evidence paths are repository-relative at the source commit above. Missing future test paths are deliberately not invented. A cited test establishes only the stated delivered subset; installation acceptance must exercise the complete target journey in [ACCEPTANCE.md](ACCEPTANCE.md).

| Clause | Status | Evidence path and remaining scope |
| --- | --- | --- |
| CHEST-01 | done | `src/chest/identity.ts`; `tests/chest/flows.mjs` (CHEST-01); `tests/chest/journey.mjs` |
| CHEST-02 | done | `src/chest/metadata.ts`; `src/chest/fields.ts`; `tests/chest/flows.mjs` (CHEST-02) |
| CHEST-03 | done | `src/chest/blobs.ts`; `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-03) |
| CHEST-04 | done | `src/chest/metadata.ts`; `tests/chest/flows.mjs` (CHEST-04) |
| CHEST-05 | done | `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-05); `tests/chest/browser-flow.mjs` |
| CHEST-06 | done | `src/chest/access.ts`; `src/chest/api.ts`; `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-06, CHEST-10); `tests/chest/browser-flow.mjs` |
| CHEST-07 | done | `src/chest/documents.ts`; `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-07); `tests/chest/journey.mjs` |
| CHEST-08 | done | `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-08, CHEST-10); `tests/chest/journey.mjs` |
| CHEST-09 | done | `src/chest/documents.ts`; `src/chest/ui-library.ts`; `tests/chest/flows.mjs` (CHEST-09); `tests/chest/browser-flow.mjs` |
| CHEST-10 | done | `src/chest/access.ts`; `src/chest/metadata.ts`; `tests/chest/flows.mjs` (CHEST-10); `tests/chest/restore.mjs` |
| CHEST-11 | done | `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs` (CHEST-11); `tests/chest/journey.mjs` |
| CHEST-12 | done | `scripts/installer/local.mjs`; `scripts/check-public-assets.mjs`; `tests/chest/restore.mjs`; `tests/chest/journey.mjs` |
| CHEST-13 | partial | `src/chest/documents.ts`; `src/chest/store.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-13); `tests/chest/journey.mjs` — Reversible indefinite trash, identical-version restore and audit exist, but trash and restore are owner-only (`src/chest/documents.ts` `owner_required`); self-service user restore, space-manager restore and folder-tree trash do not. |
| SPACE-001 | partial | `src/chest/metadata.ts`; `src/chest/access.ts`; `tests/chest/flows.mjs` (CHEST-02, CHEST-04) — Collections and access exist; folder trees, ordinary untyped files, team ownership and delegation do not. |
| ROLE-001 | partial | `src/chest/access.ts`; `src/chest/metadata.ts`; `tests/chest/flows.mjs` (CHEST-10) — Reader/editor/reviewer collection grants exist; commenter, contributor, content-manager and manager levels, file-level roles, delegated and editor sharing and no-download settings do not. |
| TRANSFER-001 | partial | `src/chest/blobs.ts`; `src/chest/documents.ts`; `src/chest/archive.ts`; `tests/chest/flows.mjs` (CHEST-03, CHEST-11) — Single bounded originals/archive admission only; no folder or resumable large transfer. |
| BULK-001 | missing | — |
| SYNC-001 | missing | — |
| SYNC-002 | missing | — |
| SYNC-003 | partial | `src/chest/blobs.ts`; `src/chest/ui.ts`; `tests/chest/flows.mjs` (CHEST-03) — Upload success/error exists; device fleet, progress and sync queues are absent. |
| SYNC-004 | missing | — |
| SYNC-005 | missing | — |
| SYNC-006 | missing | — |
| MOBILE-001 | partial | `src/chest/ui-library.ts`; `src/chest/documents.ts`; `tests/chest/journey.mjs` — Responsive browser browse/upload exists; native apps, camera, background/offline sync and mobile sharing do not. |
| SHARE-001 | partial | `src/chest/access.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-06, CHEST-10) — Private identity ACLs exist; external links and per-link policies are absent. |
| SHARE-002 | missing | — |
| SHARE-003 | missing | — |
| SHARE-004 | missing | — |
| SHARE-005 | missing | — |
| POLICY-001 | missing | — |
| PREVIEW-001 | partial | `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-05); `tests/chest/browser-preview.mjs` — Only basic PDF/raster/text previews exist; no broad renderer or processor. |
| SEARCH-001 | partial | `src/chest/api.ts`; `src/chest/blobs.ts`; `tests/chest/flows.mjs` (CHEST-06) — Title/metadata and bounded admitted UTF-8 search only; OCR/broad extraction/indexing are absent. |
| EDIT-001 | missing | — |
| EDIT-002 | missing | — |
| EDIT-003 | partial | `src/chest/reviews.ts`; `tests/chest/flows.mjs` (CHEST-08) — Exact-version review comments exist; annotation geometry, mentions, threads and task resolution do not. |
| RECOVER-001 | partial | `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-07, CHEST-13) — Document versions/trash restore exist; folder/account rewind does not. |
| RECOVER-002 | partial | `scripts/installer/local.mjs`; `tests/chest/restore.mjs` — Manual complete local recovery exists; schedules, remote targets, new-model archives and in-place upgrade drill are absent. |
| ADMIN-001 | missing | — |
| ADMIN-002 | partial | `src/chest/api.ts`; `src/chest/store.ts`; `tests/chest/flows.mjs` (CHEST-13) — Activity endpoint and logical byte total exist; comprehensive reports, cost/usage attribution and quotas do not. |
| ADMIN-003 | partial | `src/chest/identity.ts`; `src/chest/access.ts`; `tests/chest/flows.mjs` (CHEST-01) — One owner with owner-only administration and invited member staff exist; additional super admins, delegated or custom admin roles, content-free admin scope and owner transfer do not. |
| ADMIN-004 | missing | — |
| SECURITY-001 | partial | `src/chest/api.ts`; `src/chest/access.ts`; `scripts/installer/local.mjs`; `tests/chest/flows.mjs`; `tests/chest/restore.mjs` — Private HTTP/ACL and archive exclusions exist; complete device/provider encryption and key rotation coverage does not. |
| SECURITY-002 | missing | — |
| SECURITY-003 | missing | — |
| GOVERN-001 | missing | — |
| AUDIT-001 | partial | `src/chest/store.ts`; `src/chest/api.ts`; `tests/chest/flows.mjs` (CHEST-13) — Read/mutation activity exists but endpoint is bounded; full execution history, durable jobs and anonymization are absent. |
| ERASE-001 | missing | No Chest permanent-erasure public workflow; `src/chest/documents.ts` provides reversible trash only. |
| OPS-001 | partial | `src/chest/ui-shell.ts`; `src/chest/ui.ts`; `tests/chest/browser-flow.mjs`; `tests/chest/journey.mjs` — Current library has responsive journeys; native/admin expansion, accessibility conformance and hosted acceptance are unproven. |
| SCALE-001 | missing | — |
| MIGRATE-001 | partial | `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs` (CHEST-11) — Reviewed bounded synthetic archive import exists; vendor discovery, complete histories and delta/cutover do not. |
| MIGRATE-002 | missing | — |
| MIGRATE-003 | missing | — |
| MIGRATE-004 | missing | — |
| MIGRATE-005 | missing | — |
| MIGRATE-006 | missing | — |
| CONNECT-001 | missing | — |
| CONNECT-002 | missing | — |
| CONNECT-003 | missing | — |
| CONNECT-004 | missing | — |
| CONNECT-005 | missing | — |
| CONNECT-006 | missing | — |
| CONNECT-007 | partial | `src/chest/api.ts`; `tests/chest/flows.mjs` — Private session-bound Chest HTTP API exists; delegated public API/MCP and webhook product integration do not. |
| CONNECT-008 | missing | — |
| CONNECT-009 | missing | — |
| RULE-001 | missing | — |
| FOLLOW-001 | partial | `src/chest/ui-library.ts`; `src/chest/documents.ts`; `tests/chest/flows.mjs` (CHEST-09) — Due/upcoming work and evidence completion exist; background reminders, mobile push and provider outcomes do not. |
| AGENT-001 | missing | — |
| AGENT-002 | missing | — |
| AGENT-003 | missing | — |
| AGENT-004 | missing | — |
| AGENT-005 | missing | — |
| AGENT-006 | partial | `src/chest/archive.ts`; `tests/chest/flows.mjs` (CHEST-11) — Manual hash/gap reconciliation and reversible staging exist; agent/provider mappings and collaborator validation do not. |
| AGENT-007 | missing | — |

**73 clauses: 12 done / 21 partial / 40 missing.**
