# Chest target product contract

Chest is the owned business cloud file system (storage, sync and sharing) that a US operations lead at a 10-100 person business buys instead of Google Drive (Google Workspace), Dropbox Business, Box or Microsoft OneDrive / SharePoint, for the team's everyday store, sync, open, search, edit, share and recover work. It must also beat Egnyte, LucidLink and Nextcloud, which set the bar for governed collaboration, streamed creative assets and owner-controlled deployment. Exact-version approvals stay a useful option inside that complete job.

## Product target

| | |
| --- | --- |
| Category | Business cloud file storage, sync and sharing |
| Incumbents a buyer switches from | Google Drive (Google Workspace), Dropbox Business, Box, Microsoft OneDrive / SharePoint |
| Up-and-comers it must also beat | Egnyte, LucidLink, Nextcloud |
| First buyer | A US operations lead at a 10-100 person business replacing its everyday file store, sync and sharing; costs and estimates in USD; dates unambiguous; stored times keep UTC plus the chosen US business time zone; guest collection and signature flows serve US business counterparties |

The primary journey: create a team space, move originals and rights in, install staff clients, upload, open and edit ordinary files, collaborate and share outside the team, find the right version, and recover it independently.

## How to read this contract

- **The standard.** This contract follows the RER contract standard. It is the product we are building towards, measured clause by clause against what the code and tests prove today, not a release promise; incomplete status never removes a clause from the job. Existing manifests, homepage and installation limits describe the current edition and are not changed by this document. A clause keeps its id for life, and a split keeps it for its first part.
- **Tiers.** Core is what a buyer switching from the named incumbents uses in the first week, plus push-further work. The Agent surface offers the same jobs to agents over MCP, each agent acting for a named person in that person's role; the company's own policy, not this contract, decides what agents do alone, what a person reviews or approves, and what is off. Later holds premium, enterprise, rare or non-US items, which keep their ids, text and status.
- **Done.** Each clause states an observable outcome and its acceptance journey through a public browser, HTTP, client, command or provider door. Done means every acceptance point passes through those doors: public-door tests with fakes only at the paid or network edge, browser journeys at 1440 and 390, provider sandboxes or official-schema fakes, and seeded scale runs. Partial names the delivered part and its gap; missing has no delivered workflow; acceptance journeys for future work are requirements, not tests claimed to have run.
- **Field proof.** Proof Chest cannot produce in its own repository (a reference install at full size, a store approval, a live vendor tenant, a licensed app, a certification, a human pass, elapsed months) is a Field proof register row: visible, dated when run, never blocking done. Vendor adapters and connectors are proven against official-schema fakes built from each vendor's published API and export formats, or the vendor's free developer sandbox; source fixtures do not establish proprietary export fidelity or reduced costs, and hosted acceptance uses the owner's own infrastructure and accounts. No unmeasured price, storage capacity, throughput, vendor fidelity, legal sufficiency, accessibility certification or compliance outcome is claimed, and an unreachable device, missing source revision, unconfirmed provider outcome or incomplete erasure stays visibly unresolved.
- **One source.** This file holds the only acceptance text and status. ACCEPTANCE.md and docs/CLAIMS.md are generated from it; rulings live in RULINGS.md, history in CHANGELOG.md and mechanism in `docs/`.

## Door rules

- **D-1.** Every door, present or future (browser, API, MCP, sync protocol, native client, connector, agent), enforces current access (CHEST-06), the ROLE-001 role and no-download setting, the sharing policy (POLICY-001, POLICY-002), quarantine (SECURITY-002) and upload protection (SECURITY-003, SECURITY-005) before it ships, and records paid provider work in the provider cost records (ADMIN-005).
- **D-2.** Access changes, revocations and policy tightening apply on the next request through every door, including old preview, range and version URLs; an access-sensitive journey is repeated after revocation, and a durable one after restart.
- **D-3.** A mention, assignment, link insertion, meeting invitation, chat membership or CRM record never grants access by itself; a grant is always an explicit, audited step.
- **D-4.** Text inside a file, message or vendor record is data, never an instruction to an agent.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | CHEST-01 | not run |
| BASE-ACCESS-002 | Sessions | CHEST-01, ADMIN-004 | not run |
| BASE-ACCESS-003 | Public endpoints | SHARE-001, SHARE-002 | not run |
| BASE-ACCESS-004 | Server-side authorisation | CHEST-06, SECURITY-001 | not run |
| BASE-INPUT-001 | Validation | none | not run |
| BASE-INPUT-002 | HTML | CHEST-05 | not run |
| BASE-INPUT-003 | Uploads | CHEST-03, TRANSFER-001 | not run |
| BASE-SECRET-001 | No leakage | SECURITY-001 | not run |
| BASE-SECRET-002 | Startup | SECURITY-001 | not run |
| BASE-DATA-001 | Export and import | CHEST-12 | not run |
| BASE-DATA-002 | Retention | CHEST-13, VERSION-001, SURFACE-005 | not run |
| BASE-DATA-003 | Erasure | ERASE-001 | not run |
| BASE-DATA-004 | Outbound flows | SEARCH-002, AGENT-007 | not run |
| BASE-DATA-005 | Independence | OPEN-001, OWN-001 | not run |
| BASE-PUBLIC-001 | Privacy | SHARE-001, SHARE-002 | not run |
| BASE-PUBLIC-002 | Origins | CONNECT-012 | not run |
| BASE-PUBLIC-003 | Accessibility | OPS-001 | not run |
| BASE-OPS-001 | Health | SCALE-002, OPS-004 | not run |
| BASE-OPS-002 | Migrations | RECOVER-002 | not run |
| BASE-OPS-003 | Idempotency | MIGRATE-001, CONNECT-006, CONNECT-007, CONNECT-009 | not run |
| BASE-OPS-004 | Failure is visible | BULK-001, AUDIT-001, OPS-001, FOLLOW-001 | not run |
| BASE-OPS-005 | Audit | CHEST-13, AUDIT-001 | not run |
| BASE-ROLE-001 | Roles through every door | ROLE-001, ADMIN-003, SURFACE-010 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | AUDIT-001 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | RECOVER-002 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ERASE-001 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | ADMIN-001 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | ADMIN-004 | not run |
| BASE-INSTALL-001 | Free self-host and removal | OWN-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | SHARE-003, FOLLOW-001, SURFACE-008 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | OPS-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | CONNECT-007, SURFACE-001 | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | SURFACE-001, SURFACE-004, AGENT-008 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-002, SURFACE-003, SURFACE-009 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | CONNECT-007, SURFACE-012 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | SURFACE-002, SURFACE-006, SURFACE-010, AGENT-008 | not run |
| BASE-AGENT-006 | Every action declares its risk class | SURFACE-001, SURFACE-002, SURFACE-004, SURFACE-005, SURFACE-006, SURFACE-007, SURFACE-008, SURFACE-009, SURFACE-010, SURFACE-011 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | SURFACE-005, SURFACE-006, SURFACE-008, SURFACE-010, SURFACE-011, SURFACE-013 | not run |
| BASE-AGENT-008 | Truthful attribution | SURFACE-006, SURFACE-008, SURFACE-011, AGENT-008 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | SURFACE-007, SURFACE-013 | not run |
| BASE-AGENT-010 | Agents can follow changes | CONNECT-007, SURFACE-002 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | SURFACE-003, SURFACE-012 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | CONNECT-007, SURFACE-004 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-013 | not run |

## Published clauses

- `CHEST-01`: *Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002
- `CHEST-02`: *Tier:* Core
- `CHEST-03`: *Tier:* Core · *Cites:* BASE-INPUT-003
- `CHEST-04`: *Tier:* Core
- `CHEST-05`: *Tier:* Core · *Cites:* BASE-INPUT-002
- `CHEST-06`: *Tier:* Core · *Cites:* BASE-ACCESS-004 · *Rules:* D-1, D-2
- `CHEST-07`: *Tier:* Core
- `CHEST-08`: *Tier:* Core · *Rules:* D-3
- `CHEST-09`: *Tier:* Core
- `CHEST-10`: *Tier:* Core
- `CHEST-11`: *Tier:* Core
- `CHEST-12`: *Tier:* Core · *Cites:* BASE-DATA-001
- `CHEST-13`: *Tier:* Core · *Cites:* BASE-DATA-002, BASE-OPS-005

### Identity, original custody and governed records

#### CHEST-01 — Owner claim and staff identity

**Requirement.** Chest's delta on Base sign-in: an installation has exactly one initial owner claim, then invited staff who return by email link. Deactivating a person ends their sessions, and reactivation never revives them. Development personas are separately gated and confer no production authority. Several admins and owner transfer are ADMIN-003; enforced MFA is ADMIN-004.

**Acceptance.** Through setup, invitation, sign-in and the library API:
1. A second owner claim is refused.
2. A live session is revoked, and staff are deactivated and reactivated with their prior sessions still invalid.
3. The owner and a reviewer complete the built browser journey.

#### CHEST-02 — Typed filing without lost values

**Requirement.** Owners manage collections, editable typed schemas, required fields, and accountable people and groups. Schema edits keep stored values, diagnose missing or invalid fields only on records the viewer can access, and validate new filings and uploads against the current definitions.

**Acceptance.** Through the owner form and API:
1. Create and edit a type.
2. An old record stays unchanged while it is diagnosed.
3. Invalid new values are refused, and diagnostics are hidden from an outsider.

#### CHEST-03 — Validate before publishing originals

**Requirement.** Uploads validate actual bytes, SHA-256 and size. Durable original custody comes before atomic record admission, so an invalid or failed upload never appears as a library file.

**Acceptance.** Through the document API:
1. An uploaded original's retained hash, size and downloaded bytes match.
2. Bad checksum, size and filing values create no visible record.

#### CHEST-04 — Accountable filing and safe moves

**Requirement.** Supplier, customer and project filing keeps original names, typed values and responsibility. A move needs current editor access at both source and destination; access follows the destination while versions and review history stay intact.

**Acceptance.** Through the filing API, between differently shared collections:
1. A source-only editor's move is refused.
2. After the move, new readers gain access and former readers lose search and download, with versions unchanged.

#### CHEST-05 — Safe basic previews

**Requirement.** Signature-classified PDF and raster images and escaped UTF-8 text preview in the browser. Unknown formats stay downloadable, and active HTML or SVG is shown as sandboxed plain text. Broader rendering is PREVIEW-001.

**Acceptance.** From the built document page at 1440 and 390:
1. Text, PDF and raster previews open.
2. An unknown original downloads.
3. Responses carry sandbox, no-store and nosniff headers, and SVG stays inactive.

#### CHEST-06 — Current access governs every private door

**Requirement.** Current access filters lists, counts, title, metadata and admitted-text search, detail, preview, download and mutation. Derived text records its parser and exact version and never creates access of its own.

**Acceptance.**
1. A distinctive admitted phrase is found by the owner and a reviewer, and not by an outsider.
2. After a group grant is revoked, list, count, detail, preview, download and mutation requests are refused, including old version URLs.

#### CHEST-07 — Immutable versions and exact approved pointers

**Requirement.** Every replacement is a new immutable original. On a governed file, approved A stays current while B and C await review, and approving B never selects pending C. Ordinary files keep history without any review workflow; version browsing and restore are VERSION-001.

**Acceptance.** Through the versions API:
1. Upload A, B and C and approve B explicitly.
2. Each original downloads unchanged, and the approved pointer never moves silently.

#### CHEST-08 — Exact-version human decisions

**Requirement.** Assignment, comments, requested changes and approval record actor and version. Requested changes need a new immutable submission, and only the assigned reviewer with current reviewer access can approve it.

**Acceptance.**
1. After changes are requested, approval of the rejected version and approval by an unassigned actor are refused.
2. Corrected bytes are submitted and that exact version is approved, keeping earlier events and the earlier approved pointer until approval.

#### CHEST-09 — Review and expiry work keep evidence

**Requirement.** Separate review and expiry dates create due and upcoming work. Completion records actor, date and evidence, never destroys the file, and never treats an expiry as a deletion. Automated reminders are FOLLOW-001.

**Acceptance.**
1. Both dates appear in the work list.
2. An empty completion is refused, and completing only the review with evidence leaves the expiry and the original in place.

#### CHEST-10 — People and group grants

**Requirement.** The owner grants and revokes reader, editor and reviewer access for people and groups. Effective readers need active local identities, current group membership governs access, and imported people have no sign-in authority. These rules keep holding under the five-level roles (ROLE-001) and item sharing (SHARE-004).

**Acceptance.** Through the API:
1. A group grant shows its effective readers.
2. After a member is removed and collection access revoked, details, search, previews, downloads and review mutations are refused.

#### CHEST-11 — Reviewed, reversible archive admission

**Requirement.** An archive preview writes nothing and lists every item, hash, duplicate, mapping and gap. Apply binds the reviewed fingerprint and current authority, publishes inert records, resumes after restart, and undoes only untouched batches. Unsafe paths or corrupt bytes publish nothing. Source decisions never become new Chest approvals. The import journal is described in `docs/move-in.md`.

**Acceptance.** Through the archive API:
1. A bounded archive previews and applies; a changed fingerprint, path traversal and corruption are refused.
2. After a restart the apply resumes, untouched records undo, and a conflicting native edit is kept.

#### CHEST-12 — Complete independent local export and restore

**Requirement.** Chest's delta on Base export and import: `rer export` and an empty-target `rer import` keep the semantic graph, portable people, groups, roles and grants, every original version's bytes, derived provenance, decisions, completions, trash, audit and import custody. Credentials and the dispatch outbox are excluded; setup regenerates secrets, and old credentials fail. A non-empty or corrupt restore is refused atomically. Private archives can never be exported into served assets, and an archive-bearing public asset blocks build and setup. An archive digest proves byte consistency, not provenance.

**Acceptance.**
1. A real export and import into a fresh target matches every portable cell and original chunk.
2. Corrupt, non-empty and tampered-metadata restores and public-asset exposure are refused.
3. After signing in afresh, private imported records and trash recheck correctly.

#### CHEST-13 — Self-service reversible trash

**Requirement.** Every user has a trash view and restores what they trashed, files or whole trees, with no admin involved, while they still hold the role that let them trash it. Space and content managers restore anything trashed in their space; admins with content-recovery scope restore across spaces. Viewers, commenters and contributors cannot trash shared-space items or restore someone else's. A restored folder returns with its tree, versions, stable IDs, comments and inherited permissions, and never re-enables a revoked link or identity. Trash keeps originals and history until an authorized erasure (ERASE-001), and trashed bytes count towards storage limits. Trash is never a substitute for erasure or a legal hold. Mutations are audited. Point-in-time rewind is RECOVER-001.

**Acceptance.** Through the API and the browser at 1440 and 390:
1. A staff editor trashes a nested folder in a team space and restores it from their own trash with tree, hashes, version IDs and stable links identical, and no owner session involved.
2. A space reader's restore is refused with 403, and a contributor's trash is refused.
3. A space manager restores an item another member trashed.
4. A manager's permanent delete goes through ERASE-001, and an editor's is refused.
5. The trashed item leaves a reviewer's list, search and download.
6. Each trash and restore appears once in the audit with actor and outcome.

## Target clauses

### The everyday file system

#### SPACE-001 — Team spaces, personal areas and ordinary files

*Tier:* Core · *From:* SPACE-001, CHEST-14

**Requirement.** Staff keep everyday files in personal areas and in team spaces with nested folders shown by breadcrumb. They create, rename, move and copy folders and mixed Office, PDF and Google content, star and reopen recent files, and upload by drop, picker or, at phone width, **Take a photo**. Stable IDs survive moves. Ordinary upload, edit and open need no schema, reviewer or approval; owners can opt selected folders into CHEST-02, CHEST-07 and CHEST-08 governance. Space managers set membership and inherited or restricted subfolder roles from ROLE-001 and see an effective-access explanation. When staff leave, content ownership transfers to a successor. New documents come from the New menu (EDIT-004).

**Acceptance.** As two staff and an admin, in the browser at 1440 and 390:
1. Build a nested project tree (for example Clients › Harbor Freight › Contracts) and upload an ordinary file with no review configuration; each file opens on its own page inside the breadcrumb.
2. At 390, upload an image through **Take a photo** into the innermost folder.
3. Edit and move the file; its stable ID is unchanged.
4. Restrict a subfolder and see the effective-access explanation.
5. Offboard the tree's creator: the team keeps the content and stable links, and the former user is denied.

#### SPACE-003 — Hand ownership of one file to a colleague

*Tier:* Later · *From:* SPACE-001

**Requirement.** Outside offboarding, a user can hand ownership of one personal-area file or folder to a colleague, who gets an in-app and email request and accepts or declines. Until acceptance the sender stays owner. On acceptance the item moves to the recipient's area with its stable ID, versions, links and grants, and the sender stays editor unless they choose otherwise. Each step is audited.

**Acceptance.**
1. Before acceptance the sender is still owner.
2. After acceptance the file sits in the recipient's area with the same ID, versions and share link, and the sender is editor.
3. A declined offer changes nothing, and each step is audited.

#### SPACE-002 — Who creates spaces, and new-space defaults

*Tier:* Core

**Requirement.** Admins with service-settings scope choose who may create team spaces: everyone, named groups or admins only. Anyone else sees no create action, is refused with the rule named in the UI and API, and can send an audited space request to those admins. Admins set organization-wide defaults for new spaces, with overrides per creator group: external access, non-member access to items, content-manager folder sharing, viewer and commenter download, default link audience and starting storage limit. A further default decides whether space managers may override them. Defaults apply only to spaces created afterwards, and the console says so before saving. POLICY-001 still wins. Every change is audited with before and after values.

**Acceptance.** In the browser at 1440 and 390 and through the API:
1. With creation limited to the group "Ops leads", an outsider sees no create action, a direct form post and an API call are refused with the rule named, and their request reaches an admin.
2. A group member creates a space.
3. With external access, non-member access, viewer and commenter download and manager override all off, a new space starts with those settings, and an earlier space is unchanged.
4. That space's manager is refused turning external access on through the UI and API, with the rule named; an admin succeeds.
5. With manager override on, the manager's change succeeds.
6. The audit shows before and after values.

#### ROLE-001 — Five-level roles and delegated sharing

*Tier:* Core · *From:* ROLE-001, CHEST-22 · *Cites:* BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Spaces, folders and files grant one of five cumulative roles to people, groups and guests.

| Role | Adds to the role above it |
| --- | --- |
| viewer | open, preview, version history, download unless restricted, and read-only office files in the editor |
| commenter | comment, mention, assign, annotate, and suggest edits as tracked changes |
| contributor | new files and versions, name and restore versions, edit content, and accept or reject suggestions |
| content manager | move, copy out, trash, restore and share within policy |
| manager | membership and roles, permanent delete under ERASE-001, space settings and deleting the space |

The CHEST-10 reviewer duty combines with any role from commenter up and adds no access. Personal-area items use viewer, commenter and editor (editor is contributor plus move, trash and share of that item). Editors and content managers share where POLICY-001 allows, and a manager can turn editor sharing off per space. A no-download setting per space and per file limits viewers and commenters to rendered pages: every original door refuses them (download, range, sync, API, archive, link).

**Acceptance.**
1. For each role, an HTTP and a browser test attempt open, download, comment, open in the editor, suggest, accept a suggestion, view history, upload a version, restore, move, copy out, trash, restore, share and change membership on a space folder and a file: permitted actions succeed, others return 403 with no state change.
2. With no-download on, viewer and commenter downloads, range requests, archive inclusion, sync hydration and API original reads are refused while pages still preview.
3. With editor sharing off, an editor's share is refused and a manager's succeeds.
4. In the shipped editor, a commenter's DOCX typing is recorded as tracked changes attributed to them, a save with a direct edit is refused with `suggest_only`, a viewer's session is read-only, and a contributor accepts the suggestion as an attributed version.
5. A space viewer sees no upload, new folder, share, rename or trash action, a rename request returns 403, a file in another space shows **Request access** without its name, and People & settings returns 403.

#### VERSION-001 — Version history and restore by editors

*Tier:* Core · *From:* VERSION-001, CHEST-16 · *Cites:* BASE-DATA-002

**Requirement.** Every file lists each retained version with author, time, size, SHA-256, how it arrived (upload, sync, editor save, restore, migration, signature) and an optional name. Anyone with viewer access sees the history, and anyone allowed to download downloads any retained version; no-download refuses older versions too. Contributors, content managers and managers on space items, and file editors on personal items, restore any version as current, upload a replacement, and name versions; viewers and commenters cannot. A restore adds a new attributed version with the chosen bytes, keeps every later version, and keeps the stable ID, links, grants and threads, so existing links serve the restored content. Versions are kept until an authorized erasure. On a governed file a restore is a new submission, and the approved pointer moves only by approval. A restore reaches open editor sessions as a remote change. Every restore, upload and rename is audited. Guest version operations are SHARE-010; restores reaching sync clients are SYNC-008.

**Acceptance.** Through the API and the browser at 1440 and 390, with versions 1 and 2 by staff A and version 3 by B:
1. Contributor C sees each version's author, time and size.
2. C downloads version 2, checks its SHA-256, names it "Before Q3 edits" and restores it: version 4 by C equals version 2, versions 1 to 3 stay downloadable, and the stable ID and an existing link now serve version 4.
3. A viewer and a commenter see the history and download version 1; their restore and rename return 403 with no new version.
4. With no-download on, the viewer's download of version 1 is refused.
5. On a governed file with version 2 approved, restoring version 1 creates a submission, and the pointer stays on version 2.
6. A restore reaches an already-open editor session with exact bytes.
7. The audit records each restore once with actor and source version.

#### TRANSFER-001 — Resumable uploads in the browser and API

*Tier:* Core · *From:* TRANSFER-001, CHEST-15 · *Cites:* BASE-INPUT-003

**Requirement.** Browser and API uploads take several files at once in parts, with per-file progress, pause, cancel and per-item results. After a reload, a lost connection or a restart, the folder lists the file under **Unfinished uploads** with the share received, and choosing the same file again continues from the stored parts. Every byte is SHA-256 verified before the file appears, and a completed file is never duplicated. Invalid names, case collisions, path lengths, QUOTA-001 limits, over-size and unsupported files each get an actionable item error without losing other successes. Desktop and mobile upload doors are SYNC-008 and MOBILE-001.

**Acceptance.** In the browser at 1440 and 390 and through the API:
1. A 150 MB upload reloaded past a quarter shows "Unfinished uploads · N% of 150.0 MB received", resumes above zero when chosen again, and its stored and downloaded SHA-256 equal the original's.
2. An upload interrupted by lost connectivity and a server restart resumes without resending stored parts.
3. A cancelled upload leaves no false success and no half-visible file.
4. A QUOTA-001 refusal keeps the completed files.
5. A name taken, a case collision, an over-long path and an over-size file each return an actionable item error.

#### TRANSFER-002 — Whole folders and large originals

*Tier:* Core · *From:* TRANSFER-001 · *Register:* R-3

**Requirement.** Browser, API, desktop and mobile uploads take whole folder trees of at least 100,000 items with per-item results, and single files above today's 4 GB step up to a design maximum of 5 TB (5,000,000,000,000 bytes) through resumable parts. A declaration above 5 TB is refused before any byte is stored.

**Acceptance.** As seeded runs through the public API and browser:
1. A nested folder with a 50 GB video and duplicate names uploads, survives a connectivity loss and client restart, and reconciles hashes, tree and counts.
2. A 100,000-item folder upload reconciles every per-item result.
3. A 6 GB file uploads and verifies, and a 5 TB + 1 byte declaration is refused before storage.
4. Part-size arithmetic for a 5 TB file stays within the object store's multipart limits.

#### BULK-001 — Multi-select actions and ZIP downloads in the browser

*Tier:* Core · *Cites:* BASE-OPS-004

**Requirement.** Users multi-select files and folders, across subfolders and search results, and move, copy, share, trash, restore or download them in one action. Each item is checked against the actor's role and POLICY-001; refused items are reported per item, and a partial result never shows as complete. A folder or selection downloads as one streamed ZIP (ZIP64 above 4 GB) with original names and tree, only items the actor may download, and a manifest of path, version ID, size and SHA-256 plus each exclusion with its reason. Bulk operations are durable jobs that survive restart and audit once per item. Mobile selection is MOBILE-001; on the desktop the SYNC-008 mount gives Finder and Explorer selection.

**Acceptance.** In the browser at 1440 and 390:
1. 200 files across two subfolders, 5 of them under no-download, download as one archive whose tree, names and hashes match the manifest, with the 5 listed as excluded.
2. A bulk move and bulk share where 3 items are refused by role or policy reports 197 successes and 3 refusals.
3. A server restart mid-job completes the job once, with no duplicate moves or audit entries.

#### BULK-002 — Archives for guests and request recipients

*Tier:* Core · *From:* BULK-001

**Requirement.** Guests on a folder link (SHARE-001, SHARE-005) and request recipients get the same archive download within their grant.

**Acceptance.**
1. A guest downloads a 6 GB folder through a folder link as a valid ZIP64 archive containing only granted items.
2. A request recipient's archive holds only what their grant covers.

#### SYNC-001 — Sync protocol for clients

*Tier:* Core · *Rules:* D-1

**Requirement.** The server gives clients device keys, the tree, a change journal with cursors, ranged hydration, create and upload against a base version, and rename, move and delete. Restores, revocations and policy changes appear in the change feed.

**Acceptance.** Through the device protocol:
1. A device enumerates the exact accessible tree, with restricted descendants excluded.
2. A cursor returns every change once, including a restore with its new version ID.
3. An upload against an outdated base files a named conflict instead of overwriting.
4. A revoked device key is refused at once.

#### SYNC-008 — macOS and Windows clients

*Tier:* Core · *From:* SYNC-001, TRANSFER-001, BULK-001

**Requirement.** Installable macOS and Windows clients mount Chest in Finder and Explorer for existing applications. Users choose on-demand files or mirrored folders per space, pin folders offline, set cache budgets and see hydration state. An on-demand file takes no local space for its content until opened, opening it downloads only that file, and **Free up space** returns it to online-only while it stays listed. A VERSION-001 restore reaches each client as a remote change to the same file. Updates, sign-out and uninstall keep unsent work and show what remains locally.

**Acceptance.** On current macOS (Apple silicon) and Windows 11 x64:
1. Install, sign in, open an online-only Office file, save it, and see the new server version from a second device.
2. Restore version 2 as version 4 in the browser; each client receives version 4 with the same file identity and bytes equal to version 2.
3. Switch mirror and stream modes, pin a folder, and sign out and uninstall with unsent edits, showing exactly what happens to local work.
4. A 10 GB online-only folder lists every file while local disk use grows by under 100 MB; opening one 1 GB file downloads only it, and **Free up space** returns the disk use.

#### SYNC-009 — Supported platforms and managed install

*Tier:* Core · *From:* SYNC-001 · *Register:* R-4, R-5

**Requirement.** Supported matrix: macOS 13 Ventura or later on Apple silicon and Intel through Apple's File Provider framework, and Windows 11 23H2 or later on x64 and ARM64 through the Windows Cloud Files API. Each new major OS release joins the matrix within 90 days of general availability (a stated policy, not a test). Installers are signed (Apple Developer ID with notarization, Authenticode) and install silently from a documented command that MDM tools run.

**Acceptance.**
1. SYNC-008's journey passes on its two cells.
2. On Intel macOS, the oldest macOS runner available and Windows 11 ARM64, the client builds, installs from the silent-install command and completes a sign-in, open and save smoke run.
3. A release build produces signed installers.

#### SYNC-010 — Windows 10 22H2

*Tier:* Later · *From:* SYNC-001

**Requirement.** The desktop client also supports Windows 10 22H2 x64 through the Cloud Files API, for installations still on Microsoft's extended security updates.

**Acceptance.**
1. SYNC-008's journey passes on Windows 10 22H2 x64.

#### SYNC-002 — Offline edits and lossless conflicts

*Tier:* Core · *Rules:* D-2

**Requirement.** Pinned files open and edit offline and reconcile on reconnect. Divergent copies, case-only renames, moved parents, delete versus edit and mirror-to-stream switches keep both versions' bytes as named conflicts for a person to resolve. A reconnect never uses an outdated grant; a denied upload keeps a private local recovery copy and publishes nothing.

**Acceptance.**
1. A pinned file edited offline while a colleague changes it remotely, with a sync-mode switch before reconnecting, keeps both originals for explicit resolution.
2. Delete versus edit and a case-only rename each keep both sides.
3. After a permission revocation, the reconnect writes nothing remotely and keeps the local copy.

#### SYNC-003 — Sync status and device control

*Tier:* Core

**Requirement.** Users see each file's state (queued, uploading, downloading, conflicted, paused, failed, up to date), byte progress, last successful contact and an actionable reason. Admins see stale devices, client versions and unresolved errors, and can revoke a device, pause a folder and request a scoped cache wipe. Wipe status distinguishes requested, acknowledged and unreachable; downloaded copies are never promised erased remotely.

**Acceptance.**
1. A device disconnected mid-transfer, over its cache quota and then revoked shows accurate unfinished work and last contact in its tray and in the admin console.
2. After the cause is fixed, hashes are verified before "up to date" shows.
3. A wipe sent to an unreachable device stays unconfirmed.

#### SYNC-011 — Storage-limit refusals in the client

*Tier:* Core · *From:* SYNC-003

**Requirement.** When a QUOTA-001 limit refuses an upload, the tray and each held file name the limit's scope, the limit and current usage. Unsent changes stay queued and upload without user action once usage is under the limit.

**Acceptance.** On macOS and Windows:
1. Saving a new file while over a limit shows the refusal with scope, limit and usage, and the file stays queued.
2. After a manager erases content or an admin raises the limit, the queued upload completes without user action and its hash matches.

#### SYNC-012 — Proxy and bandwidth settings

*Tier:* Later · *From:* SYNC-003

**Requirement.** The client uses the system proxy by default and accepts a manual HTTP(S) proxy or PAC URL with basic, NTLM or Kerberos authentication. Users set upload and download limits (unlimited, automatic or fixed), and admins set or cap them per group through managed configuration that users cannot exceed. The client shows the active proxy and limits and names a proxy failure as the reason a file waits.

**Acceptance.** On macOS and Windows:
1. Behind an authenticating proxy with direct egress blocked, the client syncs; a wrong proxy password shows the proxy as the reason.
2. A 1,000 KB/s upload limit holds, and an admin cap of 500 KB/s overrides a user setting of 2,000 KB/s.

#### SYNC-004 — Streamed creative assets and safe locks

*Tier:* Core · *Register:* R-9

**Requirement.** Byte-range streaming opens and seeks multi-GB video and design files without downloading them first, with explicit pinned ranges and cache use. Applications that save by writing a temporary file and renaming it keep the file's identity and history through the mount. App-aware locks show a second writer who holds the file; a stale lease needs explicit recovery that keeps unsent changes. Opening a file in a native app from its browser page saves a new version of the same file.

**Acceptance.**
1. A multi-GB video opens and seeks in QuickTime Player (macOS) and a standard Windows player through the mount, with transferred ranges recorded.
2. Temp-and-rename saves from two clients keep one identity and record version IDs and checksums.
3. Two clients compete for a lock; the holder is killed and recovered without losing either writer's work.
4. Opening the file from its browser page in a native app and saving creates a new version of the same file.

#### SYNC-005 — Hybrid local cache and storage

*Tier:* Later

**Requirement.** An owner can deploy an on-premises cache and storage connector for branch-office files, with encrypted credentials, folder scope, quotas and health reporting. LAN and cloud clients share IDs, permissions and history; an offline cache never turns stale ACLs into unlimited authority, and conflicts survive reconnection.

**Acceptance.**
1. Two office clients and a remote client on a scoped cache edit permitted pinned files with the WAN down and offline authorization expired, then reconcile conflicts with all final hashes and access correct.
2. A replaced cache recovers from owner storage.

#### SYNC-006 — Computer folder backup

*Tier:* Core

**Requirement.** The desktop client also backs up folders already on the computer (Desktop, Documents, Pictures, Downloads and any folder the user adds), as Google Drive for desktop and OneDrive Known Folder Move do. Each becomes a device-named folder in the user's personal area that keeps its local path and syncs two ways or uploads only, as the user or policy chooses. Admins enforce, prevent or leave backup to users per group and can block paths or file types. The client shows per-folder status, and the console shows each device's folders and last success. Local deletions follow CHEST-13 and stay recoverable. On a new or wiped computer the user restores any device's folders to their original paths or a chosen place.

**Acceptance.** On the SYNC-008 cells:
1. Desktop (by user choice) and Documents (by enforced policy) are enrolled; local creates, edits and deletes appear as server versions and trashed items in the device-named folder.
2. Un-enrolling the enforced folder is refused, and a blocked `*.tmp` file is not uploaded.
3. After a wipe, both folders restore on a second computer to their original paths with matching tree and hashes, and a deleted file restores from trash.
4. The console shows enrolled folders and last success for both devices.

#### SYNC-007 — Office presence and newer-version alerts

*Tier:* Core · *Register:* R-8

**Requirement.** When staff open Word, Excel or PowerPoint files (including legacy DOC, XLS and PPT) from the mount in Microsoft 365 Apps on Windows or macOS, a Chest add-in that installs with the client shows "Also open by" with everyone else holding the file, in desktop Office or a browser editor session. The list updates within 10 seconds of an open or close, a holder who stops sending heartbeats drops off within 2 minutes, and names show only to people who can see the file. When another holder's save becomes a new server version, everyone else is told within 30 seconds, naming who saved, and can reload (keeping unsaved changes as a named copy) or keep editing. Presence also shows on the file's browser page and in the mobile app.

**Acceptance.** Through the add-in's server protocol with two holders, and in an official Office.js harness:
1. The second holder sees the first named within 10 seconds, and a holder who stops heartbeats drops off within 2 minutes.
2. The first saves; the second is told before saving, naming the first, and reloading keeps their unsaved changes as a named copy.
3. A browser editor session appears in desktop presence.

#### SYNC-013 — Office edit locks and policy

*Tier:* Core · *From:* SYNC-007

**Requirement.** On open, a user can open read-only, move to browser co-authoring (EDIT-005) or take an edit lock. While the lock is held, others' saves are refused naming the holder and no conflict copy is made; the lock releases on close or by lease expiry with SYNC-004 recovery. Admin policy per organization or group: off, presence only, presence with an offered lock, or lock on first open. A save without a lock after a newer version arrived still keeps both versions (SYNC-002).

**Acceptance.**
1. The first holder takes the lock; the second's save is refused naming the holder, with no conflict copy.
2. Killing the holder's client lapses the lock through SYNC-004 recovery, keeping their unsent changes.
3. Under "lock on first open", the second opener is offered read-only or browser co-authoring only.
4. A save without the lock after a newer version keeps both as a named conflict.

#### SYNC-014 — Perpetual Office versions

*Tier:* Core · *From:* SYNC-007 · *Register:* R-5, R-8

**Requirement.** The SYNC-007 add-in also covers Office 2016, 2019, 2021 and LTSC 2024 on Windows and macOS, and deploys silently by MDM.

**Acceptance.**
1. SYNC-007 and SYNC-013 pass with one holder on each perpetual version, repeated with the operating systems swapped.

#### MOBILE-001 — iOS and Android apps for everyday files

*Tier:* Core · *From:* MOBILE-001, TRANSFER-001, BULK-001 · *Register:* R-7

**Requirement.** Native iOS and Android apps browse and search team folders, preview and share, scan with the camera, upload photos from chosen albums in a user-approved background queue, multi-select and download archives, integrate with the system Files and document pickers, open files in other apps and save new versions. Every writable folder has the **New** menu (EDIT-004). The upload queue shows each file's percentage received and resumes after the app is killed. A QUOTA-001 refusal shows on each held item with scope, limit and usage.

**Acceptance.** In the iOS simulator and Android emulator on the current releases:
1. A multi-page scan and album photos upload; a killed app resumes from its stored percentage.
2. A file is shared with a permitted recipient, and opened and saved through the system picker as a new version.
3. Multi-select downloads an archive of only permitted items.
4. Over a QUOTA-001 limit, a photo upload shows the refusal with scope, limit and usage.

#### MOBILE-002 — Offline files and device protection on phones

*Tier:* Core · *From:* MOBILE-001

**Requirement.** Users pin files for offline edits. Device lock, local encryption, revocation and an explicit offline-grant expiry protect cached business data; an unreachable wipe is shown as such.

**Acceptance.**
1. A pinned file edited offline while another device changes it reconciles as a SYNC-002 conflict on reconnect.
2. A revoked device loses access, and an unreachable cache wipe is shown as unconfirmed.
3. After the offline-grant expiry, cached files no longer open.

#### MOBILE-003 — Mobile platforms and distribution

*Tier:* Core · *From:* MOBILE-001 · *Register:* R-5, R-6, R-7

**Requirement.** Supported: iOS and iPadOS 17 or later (iPhone and iPad) with a File Provider extension, and Android 10 (API 29) or later on arm64-v8a with a Storage Access Framework DocumentsProvider. Each new major OS release joins within 90 days (a stated policy). The apps ship through the App Store and Google Play and accept managed configuration from Intune and Jamf.

**Acceptance.**
1. MOBILE-001's journey passes on iOS 17, current iOS and current iPadOS simulators, and Android 10 and current Android emulators.
2. Chest files appear in the iOS Files app and the Android system picker, and a save there creates a version.
3. Release builds are signed for both stores.

#### MOBILE-004 — Chromebooks through the Android app

*Tier:* Later · *From:* MOBILE-001 · *Register:* R-24

**Requirement.** On Chromebooks with Google Play (current ChromeOS stable) the Android app installs and its DocumentsProvider appears in the ChromeOS Files app, so ChromeOS apps open and save Chest files. Chest ships no separate ChromeOS client; other Chromebook users use the browser.

**Acceptance.**
1. A Chest file opened from the ChromeOS Files app in a ChromeOS app and saved becomes a new attributed version.

### Sharing and exchange

#### SHARE-001 — External links with password, expiry, versions and limits

*Tier:* Core · *From:* SHARE-001, CHEST-18 · *Cites:* BASE-ACCESS-003, BASE-PUBLIC-001 · *Rules:* D-2

**Requirement.** File and folder links go to named guests, authenticated domains or a public audience, each only where POLICY-001 allows it for that space and sharer. Sharers set a password (8 characters or more), expiry, allowed versions (current, approved-only or pinned), the link's role (viewer with or without download, commenter, or for named guests editor or contributor) and a download limit. A folder link never exposes restricted descendants. Only password hashes are stored, and link capabilities never appear in logs, public exports or chat previews. Someone without an account is asked for the password, the link shows "Download limit reached" once used up, and **Revoke** ends it at once ("Link turned off").

**Acceptance.** In the browser at 1440 and 390 and through the API:
1. A restricted folder and a pinned approved file shared externally refuse a wrong password, a wrong domain, guessed child URLs, and expired and revoked links, and parallel downloads stop at the limit.
2. An approved-only link never reveals a pending replacement, and a revoked link fails on the next request.
3. A link with a password, tomorrow's expiry and a limit of 2 refuses a wrong password in a browser with no account, serves two downloads, and then shows "Download limit reached".
4. A second link, opened and then revoked, shows "Link turned off".

#### SHARE-006 — Organization links and discovery

*Tier:* Core · *From:* SHARE-001

**Requirement.** An organization link admits any signed-in staff member at viewer, commenter or editor without naming them, and refuses guests and signed-out browsers. It obeys no-download. Opening it records the item in the colleague's recent items but creates no grant, so changing or removing the link removes their access on the next request. A discoverable organization link lets any staff member find the item in search; a non-discoverable one appears in a colleague's search, recent items and Shared with me only after they open it. New links start at the audience and role POLICY-002 sets for the sharer's group, and a changed default affects only later links.

**Acceptance.** In the browser at 1440 and 390:
1. A team-space file set to organization-with-link at commenter, not discoverable, lets a colleague with no grant open and comment, and refuses a guest and a signed-out browser.
2. That colleague's search finds the file only after opening the link.
3. Switched to discoverable, a third colleague finds it by search.
4. With no-download on, the colleague's download is refused while the preview works.
5. Removing the link refuses the colleague on the next request.
6. Changing the default audience from restricted to organization makes the next new link start at organization, and existing links keep theirs.

#### SHARE-007 — Link list, Shared too widely and one-click revoke

*Tier:* Core · *From:* SHARE-001, CHEST-19

**Requirement.** Each item's link list and the sharer's Links view show every link's audience, role, expiry and downloads used against the limit (for example "Expires Nov 30 · 3 of 10 downloads"), with **Revoke** as one action. **Links › Shared too widely** lists items with a public link that never expires, or one past its expiry or limit, with the reason; **Make private** turns off every link on the item.

**Acceptance.** In the browser at 1440 and 390:
1. A link with a 10-download limit and a 30 November expiry, downloaded three times, shows "Expires Nov 30 · 3 of 10 downloads".
2. One Revoke click, with no further step, makes the next request fail.
3. A public link with no expiry puts its folder under Shared too widely with "Never expires"; Make private removes it from the list and the link stops opening.

#### SHARE-002 — Upload-only file requests

*Tier:* Core · *From:* SHARE-002, CHEST-20 · *Cites:* BASE-ACCESS-003, BASE-PUBLIC-001

**Requirement.** Staff issue upload-only request links with a destination, checklist, allowed types and sizes, deadline and submitter verification. A recipient without an account sends resumable large files with their name and email, gets a receipt, and replaces their own submission when allowed, without seeing others' files or choosing another destination. Quarantine and late or duplicate handling are visible, and closing the request stops new uploads. On a hosted Chest the requester is emailed "New files from your file request" naming uploader, file and folder.

**Acceptance.**
1. A vendor request is submitted from a signed-out phone; a large upload is interrupted and resumed, the submitter sees "Files received" and a receipt, and the file is in the folder.
2. On a hosted Chest the requester receives the notice email.
3. Another submitter's files, path traversal, disallowed content and an expired or closed request are refused, and none grants library access.

#### SHARE-003 — Large-file transfers and delivery receipts

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Chest's delta on Base mail outcomes: a version-pinned transfer package has resumable downloads, expiry, count limits and optional receipt confirmation, and owners see authenticated views, anonymous views, completed byte transfers and explicit confirmations as distinct events.

**Acceptance.**
1. A multi-GB package sent to an invited and a public recipient resumes after interruption and a server restart, reconciles its SHA-256, and enforces the limit.
2. Expiry stops new range requests.

#### SHARE-004 — Item sharing and Shared with me

*Tier:* Core

**Requirement.** Any staff member shares a personal-area item, and editors and content managers share space items, with colleagues or groups at viewer, commenter or editor, with an optional message, under POLICY-001. Recipients get an in-app notice and an email (and Slack or Teams where connected) and find the item under **Shared with me**, filterable by sharer and date, with add-to-my-area shortcuts that grant nothing more.

**Acceptance.** In the browser at 1440 and 390:
1. A personal-area file shared at commenter reaches the colleague by notice and email; they find it under Shared with me and can comment but not edit.
2. The audit records the share.

#### SHARE-008 — Access requests

*Tier:* Core · *From:* SHARE-004

**Requirement.** A signed-in person who opens a link they cannot use sees **Request access** with an optional message and role, never the item's name or contents. The request goes to the item's sharers with share rights (owner, file editors, then space managers), who approve at the requested or a lower role, or decline, from the email, the notice or the share dialog; the requester is told. If the owner has left, the request goes to the successor set at offboarding, then space managers, then content-recovery admins; it never stalls silently. Requests expire after 30 days with the requester told. Each request, decision and grant is audited.

**Acceptance.** In the browser at 1440 and 390:
1. An unauthorized colleague sees Request access without the title and requests editor; the owner approves at viewer from the email and the requester is told and can view.
2. A second request is declined from the share dialog and the requester is told.
3. With the owner of a third file deactivated, the request reaches the successor, and with none, a space manager.

#### SHARE-009 — Expiring grants

*Tier:* Core · *From:* SHARE-004 · *Rules:* D-2

**Requirement.** Any person or group grant can carry an expiry, set when sharing or later, within an admin maximum. The sharer and the grantee are told one day before, and either notice offers the sharer a one-step extend. From the first request after expiry every door refuses the grant (list, Shared with me, search, preview, download, sync hydration, editor sessions, comment, API). The expiry is audited, and other grants the person holds stay.

**Acceptance.** With a controlled clock, a commenter grant on a space file with a 2-day expiry:
1. The one-day notice reaches sharer and grantee, and extending from it moves the date once.
2. After the new date, list, preview, download, sync hydration and comment are each refused on the next request, and the audit records the expiry.

#### SHARE-005 — Guests: sign-in, scope and expiry

*Tier:* Core

**Requirement.** Named guests outside the organization, with or without a Google or Microsoft account, get viewer, commenter, editor or contributor roles where POLICY-001 allows their domain. Guests sign in with a one-time PIN sent to the invited address, or a verified Google or Microsoft identity matching it, and re-verify after an admin interval (default 7 days, 1-30). A forwarded invitation admits no one else. Each guest grant expires, within an admin maximum. Guests hold no seat, cannot share onward or invite (there is no setting for it), and cannot browse, search or list beyond their grant.

**Acceptance.**
1. A guest at another domain with no Google or Microsoft account signs in by PIN; a PIN used from a second address is refused.
2. Their onward share, a sibling folder and a library search are refused.
3. Past the re-verification time on a controlled clock a new PIN is required; past expiry every door refuses them, including an open editor's next save and a range request.

#### SHARE-010 — Guests edit, upload and manage versions

*Tier:* Core · *From:* SHARE-005

**Requirement.** Guests co-edit Office files in the shipped Collabora Online editor (EDIT-005) with no Microsoft or Google licence, and upload into folders where they hold contributor or editor. Every guest edit, upload, comment and version carries the guest's verified email. Guest editors and contributors download, restore, replace and name retained versions under VERSION-001 (on a governed file a restore is a submission); guest viewers and commenters cannot.

**Acceptance.** A guest editor on a DOCX and contributor on a folder, on an installation with no Microsoft or Google provider:
1. The guest co-edits with a staff member, and uploads two files, including one above the 8 MB direct-form limit by resumable upload; history and audit name the guest's email.
2. As editor and as contributor, the guest restores version 2 as version 4 with equal bytes, earlier versions kept and the stable ID and link serving version 4.
3. On a governed file the guest's restore is a submission and the approved pointer stays.
4. Guest viewers and commenters are refused restore, replacement and naming, and a revoked editor's next restore is refused.

#### POLICY-001 — Organization sharing policy

*Tier:* Core · *Rules:* D-1, D-2

**Requirement.** Admins with sharing-policy scope set an organization policy, with space and group overrides: whether external sharing is allowed, a trusted-domain allowlist, whether public links are allowed, whether space content may go to non-members, whether editors may share, and whether sharers see a warning naming external recipients. The most restrictive rule wins, and the share dialog names the rule that refused or warned. Tightening applies to existing grants and links on their next request: out-of-policy links show a policy page, out-of-policy guests are suspended (not deleted), and admins see suspended grants to remove or re-allow. Every change is audited with before and after values. Each connector enforces this policy in its own acceptance (D-1).

**Acceptance.** In the UI and through the CONNECT-007 API:
1. With one allowlisted partner domain and public links off, a share to another domain and a public link are refused with the policy named; a share to the partner succeeds after the warning.
2. A public link and an outside guest made under a looser policy are refused on the next request after tightening and listed as suspended.
3. A space override blocking non-members refuses a member's share to another colleague.

#### POLICY-002 — Default link audience and discovery

*Tier:* Core · *From:* POLICY-001

**Requirement.** The policy sets the default audience and role for new links (restricted, organization-with-link, or public where allowed) per organization and group, which the share dialog, API and every connector start from, and whether organization links may be discoverable. A changed default applies only to later links.

**Acceptance.**
1. With the organization default restricted and a group default of organization viewer, a group member's new link starts at organization viewer and a non-member's at restricted, and older links keep their audience.
2. With discovery off, a request for a discoverable organization link is refused with the policy named.

### Previews, search and editing

#### PREVIEW-001 — Previews for everyday formats

*Tier:* Core · *Rules:* D-1

**Requirement.** Permission-checked previews, with pages, thumbnails and seek where they apply, cover: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, RTF, Apple Pages, Numbers and Keynote, Google Docs, Sheets, Slides and Drawings, EML and MSG; TXT, CSV, TSV, MD, JSON, XML and common source code; JPEG, PNG, GIF, WebP, HEIC/HEIF, TIFF, BMP and SVG (as a sanitized raster); MP4 and MOV in H.264 and HEVC and WebM through a transcoded H.264 stream with seek; MP3, WAV, AAC/M4A, FLAC, AIFF and OGG; and ZIP listings without extraction. Other formats show a named unsupported state with download. Rendering runs in separate bounded services, keeps the original and exact source version, records the renderer, shows pending, failed and unsupported states, never runs macros and never widens access.

**Acceptance.** In the browser at 1440 and 390:
1. One fixture per listed format opens with its page count and first-page thumbnail, and audio and video seek to a mid-file point.
2. A format outside the list shows the unsupported state with download.
3. Revoking access while a preview is open denies fresh pages and ranges.
4. Corrupt and malicious files and a renderer outage show the exact failure, and the original stays downloadable to an authorized user.

#### PREVIEW-002 — Previews for creative and CAD formats

*Tier:* Core · *From:* PREVIEW-001

**Requirement.** The same bounded preview service covers camera RAW (DNG, CR2/CR3, NEF, ARW), Apple ProRes 422/4444 and AVI through the streaming proxy, PSD/PSB, AI, EPS, INDD (embedded preview), Sketch, DWG and DXF (AutoCAD 2000 to 2018 formats), STL and OBJ. The mobile apps hand these formats to the system viewer.

**Acceptance.** In the browser at 1440 and 390:
1. One fixture per listed format shows a first-page or first-frame thumbnail and its page or frame count.
2. A corrupt fixture of each family shows its failure state with the original still downloadable.

#### SEARCH-001 — Text and scans become searchable

*Tier:* Core · *From:* SEARCH-001, CHEST-21 · *Rules:* D-1, D-2

**Requirement.** Chest extracts searchable text from every admitted file and records source version, parser, language, confidence and state: OCR of image-only PDF pages and JPEG, PNG, TIFF, HEIC and WebP in English and Spanish (other languages indexed with the detected language); and text from PDF text layers, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, RTF, iWork, Google files via export, EML and MSG bodies and attachments, TXT, CSV, MD, HTML, JSON and XML. The full text of each version is indexed, and any truncation shows as partially indexed with the offset reached. Search spans names, content, typed metadata, owners, dates, folders and versions, with snippets. Unsupported and encrypted files visibly stay unindexed. Current access governs hits, snippets, counts, suggestions and AI retrieval, and a revocation beats a stale index.

**Acceptance.**
1. A fixture per listed format with a distinctive phrase (a scanned English invoice, a scanned Spanish receipt, a spreadsheet, a Google document, an MSG with a DOCX attachment) is found, and an encrypted PDF shows as unread.
2. A word only inside an uploaded PDF and inside a PDF from a file request finds both.
3. A member outside a space finds nothing inside its files, and the owner's same search finds them.
4. OCR provenance shows the version, language and confidence.
5. A group revoked before the index refreshes leaks no snippet, count or autocomplete through the UI or API.

#### SEARCH-003 — Search filters

*Tier:* Core · *From:* SEARCH-001

**Requirement.** Filter chips under the search box work alone, together or with text: **Type** (folders, documents, spreadsheets, presentations, PDFs, images, videos, audio, archives, other; matched on detected content, so a PDF renamed `.txt` is a PDF; several at once), **People** (owned by me, owned by, created by, or shared with me by a named person), **Modified** (today, 7 days, 30 days, this year, last year, or a custom range in the user's US time zone), **Location** (anywhere, a space or folder with subfolders, my area, Shared with me, Starred, or Trash where allowed) and **Version** (current only by default, or any retained version, with earlier-version matches labelled). Filters AND across chips and OR within one, and a filter with no text lists matches newest first. The CONNECT-007 API takes them as named parameters (`docs/search.md`). Counts and suggestions follow current access exactly as hits do.

**Acceptance.** With seeded PDFs, spreadsheets and images from two owners, modified 3 and 40 days ago, one PDF renamed `.txt`, and one match in a folder the test user cannot open, in the browser at 1440 and 390 and through the API:
1. Type = PDF, People = the second owner and Modified = 30 days return exactly the matching files, including the renamed PDF.
2. Each of Type, People, Modified and Version combined with Location = Shared with me, and again with one space, matches the seed.
3. A custom date range and a filter-only search match the seed.
4. The test user never sees the hidden PDF, or a count or suggestion that includes it.

#### SEARCH-004 — Audio and video transcripts

*Tier:* Later · *From:* SEARCH-001

**Requirement.** English and Spanish speech in MP4, MOV, MP3, WAV and M4A is transcribed and indexed under SEARCH-001's provenance and access rules.

**Acceptance.**
1. A spoken phrase in an MP4 fixture is found, with the transcript's provenance shown.

#### SEARCH-002 — Typed fields read from scans

*Tier:* Core · *Cites:* BASE-DATA-004 · *Rules:* D-4

**Requirement.** When a scan or photo arrives (an image-only PDF page or a JPEG, PNG, TIFF, HEIC or WebP image read by SEARCH-001), Chest reads the CHEST-02 fields its type defines: for an NDA the parties, effective date, term and governing state; for a W-9 the legal name, business type and the masked last four digits of the TIN; for an invoice the vendor, number, date and USD total. The file page shows a box around the source words of each value with its page and confidence. Writing read values into typed fields is standard: the company's policy decides whether readings fill fields alone or wait for an editor, and under the held policy an editor confirms, corrects or rejects each one. Confirmed values become typed fields with version, page, region and reader provenance. Chest never overwrites a person's value (a differing reading shows beside it), rereads only on a new version, and shows low-confidence and unreadable fields as such. Read values follow CHEST-06. Automatic reading runs under its own scan policy, off until the owner activates it and bound to the current reader configuration (provider terms, access and consent are AGENT-007's): each identical original has a durable call allowance and each call an output ceiling, every failed or interrupted call counts against the allowance, and copying or editing the policy never resets it. Readings stay in Chest until the original is erased, and the policy says so; switching reading off stops new calls and keeps earlier originals and decisions.

**Acceptance.** In the browser at 1440 and 390:
1. A two-page scanned NDA in a typed folder and a phone photo of a W-9 show every proposed value with page, box and confidence.
2. Under the held policy, an editor confirms two NDA values, corrects one and rejects one; typed fields, search and audit show the confirmed values with provenance, and the rejected one is not stored.
3. A value already typed by a person is left unchanged, with the differing reading beside it.
4. A blurred field shows as unreadable and stays empty.
5. A viewer sees confirmed values with no confirm control, and their API confirm returns 403; an outsider's search for a read value returns nothing.
6. A new version with a changed date proposes only that field again, and earlier confirmations stay on the earlier version.

#### EDIT-001 — The shipped independent editor

*Tier:* Core

**Requirement.** Chest ships Collabora Online as its included office editor, so staff and guests co-author DOCX, XLSX and PPTX (and ODT, ODS and ODP) with no Microsoft 365 or Google Workspace licence. The installer deploys it as a separately run service with Chest as its WOPI host, and once the owner confirms it at setup it is the default for opening and creating office files. A file is open in one provider at a time, and Chest never rebuilds an office engine. Acceptance is pinned to the Collabora version Chest ships. An editor outage or lapsed subscription is named on the file and in the console; originals stay downloadable, and nothing unsaved is shown as saved.

**Acceptance.** On an installation with no Microsoft or Google provider:
1. `rer install` and `rer setup` deploy the editor, and after the owner confirms it, office files open in it by default.
2. Stopping the editor service names the outage on the file and in the console, and the original still downloads.

#### EDIT-005 — Co-authoring sessions

*Tier:* Core · *From:* EDIT-001 · *Register:* R-8

**Requirement.** Current grants, including guest editor and contributor grants, scope every editing session. Each save keeps format fidelity and the stable identity and is an immutable version attributed to its author (arrival "editor save"). Revoking a grant refuses that person's next save and ends their session. Everyone in a session sees the others' names, on the document and the file page. Co-authors edit one file: a session never creates a copy, conflict file or second stable ID. A review-gated file's approved version never changes by an edit.

**Acceptance.** Two staff and one PIN-verified guest, in the browser at 1440 and 390:
1. They co-edit a DOCX, an XLSX and a PPTX; concurrent changes reach everyone, and each save is a version attributed to its author (the guest by verified email).
2. Each participant sees the other two as present in the editor and on the file page.
3. Afterwards the folder holds one file with one stable ID and no copy or conflict file.
4. The guest, revoked mid-session, has their next save refused.
5. Tables, formulas and comments round-trip in all three formats and open intact in LibreOffice and validate against the ECMA-376 schemas.
6. Editing a review-gated file leaves its approved version unchanged.

#### EDIT-006 — Editor capacity and cost

*Tier:* Core · *From:* EDIT-001 · *Register:* R-11

**Requirement.** Before an editor provider is enabled, at setup or later, the ADMIN-005 console shows its edition (Collabora Online Development Edition, a Collabora subscription, or for Microsoft the licence each editor needs), its limits on concurrent documents and connections, and its USD cost ($0 for CODE, or the owner-entered price from a quote, labelled as an estimate). Chest enforces the configured limits itself: a session past a limit is refused with `editor_capacity_reached`, naming the limit and current use, the file opens read-only, and open sessions continue. Usage and refusals appear in ADMIN-005 reports.

**Acceptance.**
1. At setup the console shows the edition, limits and USD cost before the owner confirms.
2. With the connection limit at 3, a fourth session is refused with `editor_capacity_reached` in the browser and the API; the file opens read-only and the three sessions continue.
3. The refusal is counted in the report.

#### EDIT-002 — Google-format files without hidden loss

*Tier:* Core · *From:* EDIT-002, EDIT-001 · *Register:* R-12

**Requirement.** A Google Workspace integration opens and co-edits native Docs, Sheets and Slides with explicit source custody and granted scopes, saves revision provenance, and exports Office and PDF derivatives. Migration can convert to Chest-hosted formats with a fidelity report; a shortcut alone never counts as a migrated original. Features that need the provider stay disclosed until the owner accepts conversion or continued provider use. A conversion, at migration or later, carries open review work under MIGRATE-012: comments become EDIT-003 threads with authors, states and assignees, and pending suggestions become tracked changes. A file kept native keeps its comments in Google, shown as provider-held without duplicates.

**Acceptance.** Against an official-schema fake built from Google's published Drive and Docs API discovery documents:
1. Each Google type is created and co-edited from Chest by two accounts.
2. A file with comments, formulas and embedded content converts; comments are threads under MIGRATE-012's author rule with their states, assigned comments are tasks, and pending suggestions are tracked changes a contributor decides as versions; the fidelity report counts each.
3. After source access is revoked, accepted Chest-held originals and derivatives stay accessible with accurate source and revision labels.

#### EDIT-003 — Comments, annotations and tasks on files

*Tier:* Core · *Rules:* D-3

**Requirement.** Files carry threaded comments, mentions, tasks and PDF page and region annotations bound to the exact version. Users compare versions, move between unresolved comments, and carry a thread forward only with a link to its original. In-document comments in the shipped editor are threads too, kept in step under EDIT-008. An assigned comment is a task in the assignee's list until resolved. Threads migrated from an incumbent keep their original times, source IDs and state, show an unmatched author as "Former collaborator (name as in source)", keep the quoted text of a comment whose anchor was not found, and then behave like any other thread.

**Acceptance.** In the browser at 1440 and 390:
1. Page 2 of a PDF is annotated with a mention of a colleague and of an outsider; the outsider gains no access and notifications carry no forbidden text.
2. After a thread is resolved and a changed-page replacement uploaded, the old annotation stays anchored to its original.
3. Versions compare side by side, and unresolved comments are navigable in order.
4. On a migrated file, threads show original times and states, a former collaborator's comment cannot be re-attributed by a save, an "anchor not found" thread shows its quoted text, and reply and resolve work.

#### EDIT-007 — Review loop: attribution and @mentions

*Tier:* Core · *From:* EDIT-001 · *Rules:* D-3

**Requirement.** In the shipped editor, for DOCX, XLSX, PPTX, ODT, ODS and ODP, Chest is the integrator of the review loop that Google Docs users run: it supplies the people list, records every comment, mention, assignment and tracked change against Chest identities, and sends every notification, without relying on a format's own mention markup. Every comment, reply, resolve and tracked change carries the author's Chest name or a guest's verified email; a save that adds or alters one under any other author is refused with `author_mismatch`, creates no version and is audited. Typing `@` suggests only people and groups the author may share with under POLICY-001, those with access first. Posting sends FOLLOW-001's mention notification, with the comment text and a link, to each mentioned person who can open the file. A mentioned person without access gets nothing; the author is offered a one-step commenter or viewer grant where they may share, or the refusal with the rule named and an offer to send a SHARE-008 access request. An address on a domain POLICY-001 refuses is refused with the policy named.

**Acceptance.** In the browser at 1440 and 390, on the same installation:
1. A comments "@B please check clause 4" in a DOCX; B gets the notice and email with the text, and the comment shows A and B by Chest name in the editor and on the file page.
2. A mentions C, who has no access; A is offered a commenter grant, and C is sent nothing until A accepts, then is notified and opens the file.
3. A contributor in a space with editor sharing off mentions D, who has no access; the refusal names the rule and the access request reaches the managers.
4. A mention of an address outside the allowlist is refused with the policy named, and autocomplete never offered it.
5. A save adding a comment under B's name is refused with `author_mismatch` and creates no version.
6. The mention steps repeat with an XLSX, a PPTX and an ODT comment.

#### EDIT-008 — Review loop: assigned comments and one thread everywhere

*Tier:* Core · *From:* EDIT-001, EDIT-003

**Requirement.** A comment can be assigned to one person who can open the file, or to someone without access after the EDIT-007 grant step. The assignee is notified, and the comment is an open task in their EDIT-003 and FOLLOW-001 lists, with reminders, until resolved in the document, on the file page, in the apps or from the email. Reassigning moves the task and notifies both people. Each in-document comment is one EDIT-003 thread on the file page and in the apps, anchored to the version and to the commented text, cell or slide. A comment, reply, resolve or reopen made in the editor reaches its thread and notifications within 60 seconds without anyone closing the document. A reply or resolve made outside the editor appears in every open session within 60 seconds and in the file as a version attributed to that person (arrival "comment reply" or "comment resolved"). Where a format cannot store resolved state, Chest keeps it on the thread and shows it in the editor.

**Acceptance.** In the browser at 1440 and 390:
1. A mentions B in a new in-document comment and assigns it; the comment appears in B's task list.
2. B's reply from the notification email appears in A's open session within 60 seconds, attributed to B, and the file gains a "comment reply" version.
3. B resolves the comment on the file page; it shows resolved inside the document and leaves B's task list.
4. A's reply inside the document shows on the file-page thread within 60 seconds.
5. Reassigning moves the task and notifies both people.

#### EDIT-009 — Review loop: commenters suggest, contributors decide

*Tier:* Core · *From:* EDIT-001

**Requirement.** A commenter (space, file or guest) opens the editor in a comment-and-suggest session. In DOCX and ODT, change tracking is on and locked: their typing is recorded as tracked changes attributed to them, and they cannot accept, reject or stop tracking. In spreadsheets and presentations, as in Google Sheets and Slides, the session is comment-only. Chest checks every save from such a session against the version it opened and refuses with `suggest_only`, creating no version, anything other than comments and that person's own tracked changes. Pending suggestions are listed on the file page with author and age, and the owner or space managers are notified. Contributors and above, file editors and guest editors accept or reject each suggestion in the editor; each decision is its own version naming the decider, the suggestion's author and the decision. A viewer's session is read-only, and any save from it is refused.

**Acceptance.** In the browser at 1440 and 390:
1. A guest commenter types a change in a DOCX; it is a tracked change attributed to their verified email, and the owner is notified.
2. A save from that session carrying a direct edit is refused with `suggest_only` and creates no version.
3. A contributor accepts one suggestion and rejects another; each decision is a version naming the contributor, the guest and the decision.
4. The pending list shows each suggestion's author and age.
5. In an XLSX and a PPTX, a commenter's comment posts and their cell or slide edit is refused with `suggest_only`; the guest suggestion step repeats in an ODT.
6. A viewer's session is read-only and its save is refused.

#### EDIT-010 — Chest commands inside the editor

*Tier:* Later · *From:* EDIT-001

**Requirement.** Inside the editor's comment box, as with Google Docs' "Assign to", the author assigns a comment by mentioning one person and choosing **Assign**. An **Insert Chest link** command in the toolbar and Insert menu, with a shortcut, searches files the author can open and inserts a stable Chest link with the item's name. A link opens under the reader's access, and a reader without access sees Request access. When readers of the document cannot open the linked item, the author is told who and offered a one-step grant where they may share, or the refusal with the rule named. A pasted Chest URL behaves the same.

**Acceptance.** In the browser at 1440 and 390:
1. Assign inside the comment box puts the comment in the assignee's task list.
2. Insert Chest link finds a contract in a restricted folder the author can open, and finds nothing the author cannot open.
3. The author is told that colleague B cannot open the link and offered a viewer grant; declined, B following the link sees Request access.

#### EDIT-011 — Download as another format

*Tier:* Later · *From:* EDIT-001

**Requirement.** Anyone allowed to download an office file gets its current or any listed version as PDF, DOCX or ODT, XLSX or ODS, or PPTX or ODP, from the file page, the apps and the API. Chest converts through the shipped editor service, names the source version in the file name and the audit, and never stores the converted copy as a version. No-download refuses every format.

**Acceptance.**
1. A viewer downloads a DOCX as PDF and as ODT from the file page and the API, each named for its source version, with no new version.
2. With no-download on, each format is refused.

#### EDIT-012 — CODE production notice

*Tier:* Later · *From:* EDIT-001

**Requirement.** When Collabora Online Development Edition is chosen, the console states before confirmation that Collabora positions CODE for development and home use, not supported business production, shows the limits CODE reports, and lists what a subscription adds per the owner's quote. The owner must acknowledge this to enable CODE, and the notice stays on show while CODE is in use.

**Acceptance.**
1. Choosing CODE shows the notice and the subscription additions, and enabling is refused until the owner acknowledges.
2. The notice stays on show while CODE is in use.

#### EDIT-004 — New files from the New menu

*Tier:* Core · *From:* EDIT-004, EDIT-001 · *Register:* R-8

**Requirement.** Every writable folder has a **New** menu beside New folder and Upload. It creates a blank document, spreadsheet or presentation that opens at once in the user's editor (Collabora by default; Microsoft 365 where enabled and licensed; a native Google file where EDIT-002 is the organization's choice). The same create is in the API, idempotent on a caller key. Service-settings admins set the creation format with group overrides: DOCX, XLSX and PPTX by default, ODF as an option, or Google types. A blank file is a valid empty file that opens without repair. The new file is named "Untitled document" (and so on), is version 1 attributed to its creator with arrival "created", inherits the folder's access and no-download setting, and appears at once in recent items, search and sync. Contributors and above, owners and editors of personal folders, and guests with contributor or editor on the folder may create; viewers and commenters see no New action and get 403 from the API. QUOTA-001 refuses an over-limit create with `storage_limit_exceeded`, and the folder's POLICY-001 and GOVERN-001 rules apply as to an upload. Creates are audited.

**Acceptance.** In the browser at 1440 and 390 and the API:
1. A contributor creates a blank spreadsheet in a restricted folder; it opens in the editor, and after two saves its history shows versions 1-3 attributed to them.
2. A colleague with access finds and opens it; a staff member outside the folder finds nothing and gets 403 on its URL.
3. A blank document and presentation open in LibreOffice without a repair prompt and validate against ECMA-376.
4. With the format switched to ODF the next document is ODT, and a group override to Google types opens a Google Doc.
5. A viewer and a commenter see no New action and their API create returns 403; a guest contributor's document is attributed to their email.
6. An over-limit create is refused with `storage_limit_exceeded`, and a repeated API create with the same key makes one file.

#### EDIT-013 — Templates

*Tier:* Core · *From:* EDIT-004

**Requirement.** A built-in gallery in each format (at least letter, memo, meeting notes, project proposal, invoice, budget, project tracker, schedule and two presentation designs) sits beside organization templates. A service-settings admin, or a space manager for their space, publishes any office file they can view as a template to the organization, named groups or one space, with name, category and thumbnail. Only that audience sees it, in the New menu, the gallery and the API. Publishing grants no access to the source. Creating from a template makes an independent copy whose version 1 names the template and its version; edits on either side never reach the other. Unpublishing hides the template and leaves copies untouched. Publishing and unpublishing are audited.

**Acceptance.**
1. An admin publishes a DOCX template to one group; a member creates from it and an outsider sees it nowhere.
2. Editing the copy leaves the template unchanged, editing the template leaves the copy unchanged, and the copy's version 1 names the template version.
3. A space manager's space template is seen only by that space's members.
4. Unpublishing leaves earlier copies unchanged, and the audit holds each publish and unpublish.

#### EDIT-014 — Microsoft 365 as an optional editor

*Tier:* Core · *From:* EDIT-001, EDIT-004 · *Register:* R-10

**Requirement.** Microsoft 365 (Office for the web and desktop Office) is an optional second provider through Microsoft's WOPI integration, enabled by a service-settings admin for the organization or named groups. Chest uses the business-user flow with WOPI licence checking on, so each editor must hold a Microsoft 365 licence that includes Office for the web. A user without one gets the read-only view with "Editing needs a Microsoft 365 license that includes Office for the web"; never a broken editor or an unlicensed session. Where Collabora is enabled, that view offers **Edit in Collabora Online** when no Microsoft session holds the file. Users whose provider is Microsoft 365 open the Microsoft 365 mobile apps or Office for the web.

**Acceptance.**
1. Chest's WOPI host passes Microsoft's WOPI validator for view, edit and co-authoring.
2. Against an official-schema fake of the licence check, a licensed user's sessions save attributed versions and a revoked user's next save is refused.
3. An unlicensed user gets the read-only view with the licence named, no session and no accepted save, and with no Microsoft session open can choose Edit in Collabora Online with attributed saves.
4. A licensed contributor's new file from the New menu opens in Office for the web.

#### SIGN-001 — Built-in eSignature

*Tier:* Core

**Requirement.** A staff member with contributor or higher access (or editor on a personal file), and download allowed, requests signatures on the exact current version of a PDF or DOCX, with no third-party signature account. A DOCX is rendered to PDF with a fidelity report the requester sees before sending. The requester adds staff or external signers by email, sets an order or parallel signing, places signature, initials, date, text and checkbox fields, and sets an expiry and a reminder cadence (FOLLOW-001) that stops on completion, decline, void or expiry. Signers verify by emailed PIN (as SHARE-005) or staff sign-in, accept an electronic-records consent disclosure that explains withdrawal and paper copies, adopt a signature and sign by explicit action, or decline with a reason; they see only that document. On completion Chest files two immutable versions linked to the source: the signed PDF, sealed with a PAdES signature under the installation's key (SECURITY-001), and an audit certificate with each signer's email, verification method, IP and user agent per event, timestamps, and SHA-256 before and after. Every signer receives the completed copy. A declined, voided or expired request leaves the source unsigned and files nothing partial. Signing approves nothing (CHEST-08). The flow implements the US ESIGN Act and UETA mechanics (intent, consent, association with the exact record, retention with accurate reproduction), warns on documents in ESIGN's excluded categories, and claims no legal sufficiency. Notarization and EU qualified signatures go through CONNECT-004.

**Acceptance.** In the browser at 1440 and 390:
1. A two-signer PDF goes in order to an external signer with no account, then a staff member, and a reminder reaches the first on the cadence.
2. The external signer verifies by PIN, sees the consent disclosure, and is refused every other file.
3. Both sign; the signed PDF and certificate appear as versions linked to the source with both hashes and the full event log.
4. The PAdES signature validates, and fails after one byte is altered.
5. Reminders stop, and every signer gets the completed copy.
6. A DOCX request shows its fidelity report before sending.
7. A declined and an expired request each leave the source unsigned with the outcome recorded, and a voided request stops signing.

#### PREVIEW-003 — Feature doors in the mobile apps

*Tier:* Core · *From:* PREVIEW-001, SEARCH-001, SEARCH-002, EDIT-003, EDIT-004, SIGN-001

**Requirement.** The apps carry these feature doors with the same authority as the browser (D-1): previews of the PREVIEW-001 formats, search with its filters (SEARCH-003), scan field proposals with source boxes (SEARCH-002), signature requests and signing (SIGN-001), the New menu and templates (EDIT-004, EDIT-013), and comment threads and tasks (EDIT-003).

**Acceptance.** In the iOS simulator and Android emulator, each step repeats its parent clause's browser journey:
1. A filtered search returns only permitted files, with counts that never include a hidden file.
2. A scanned NDA shows proposed values with page, box and confidence; an editor confirms one and a viewer has no confirm control.
3. A two-signer request is sent and signed from the app, and the signed PDF validates.
4. A blank spreadsheet is created from the New menu.
5. A thread on a PDF region is replied to and resolved.
6. One fixture per PREVIEW-001 format previews with its page count, first-page thumbnail and mid-file seek, and a PREVIEW-002 format opens in the system viewer.

#### MOBILE-005 — Co-authoring in the mobile apps

*Tier:* Later · *From:* MOBILE-001, EDIT-001

**Requirement.** Office files open for co-authoring inside the apps in Collabora Online's touch interface on the same WOPI session, grants and attributed saves as the browser; Microsoft 365 users open the Microsoft 365 apps or Office for the web, and Google files follow EDIT-002.

**Acceptance.**
1. One participant in the iOS app and one in the Android app co-edit with a browser user, with no Microsoft or Google licence, until both edits are attributed versions.
2. The Android participant, revoked mid-session, has their next save refused.

### Recovery, administration and trust

#### RECOVER-001 — Point-in-time folder and space rewind

*Tier:* Core · *From:* RECOVER-001, CHEST-17

**Requirement.** A user rewinds their own files and folders, and a space manager rewinds any file, folder tree or whole space they manage, to a chosen recorded point after accidental deletion, overwrite or ransomware, with no installation owner needed. **Restore to a date** takes a date and time with its time zone and first previews each change (renamed back, brought back, moved to trash), including names, hierarchy, memberships and sharing effects; nothing changes until **Restore selected items**, and the receipt offers **Undo this restore**. Recovery creates an attributed new state, keeps later history and conflict copies, and never re-enables a revoked share or user. One file's version restore is VERSION-001; incident-wide restore is SECURITY-003; admin rewind is ADMIN-006.

**Acceptance.** In the browser at 1440 and 390:
1. After a rename, a trash and an addition in a folder, a preview to the minute before lists the three changes with the folder unchanged; applying it restores the earlier contents, and Undo returns the renamed, trashed and added state.
2. As a space manager (not the owner), a time-based rewind of a renamed, deleted and overwritten folder restores every byte and path, keeps later history, and leaves a revoked external link and a revoked staff identity denied.
3. A space viewer is refused the rewind.
4. An editor's folder rewind covers only their own files, while the same editor restores one version of a colleague's file under VERSION-001.

#### RECOVER-002 — Scheduled independent backups and upgrade recovery

*Tier:* Core · *From:* RECOVER-002, CHEST-24 · *Cites:* BASE-BACKUP-001, BASE-OPS-002

**Requirement.** Chest's delta on Base backup: owners schedule backups to Amazon S3, Cloudflare R2 or an S3-compatible account, with retention, last success and failure alerts. Archives cover all records, originals, comments, links as inert definitions, rules, migration mappings and sanitized job history; secrets, devices and sessions never transfer, and sending jobs never replay. An in-place upgrade keeps settings and every earlier row and original, and an interrupted upgrade recovers from a private backup.

**Acceptance.**
1. A restored instance has its providers reauthorized and replays no old device or link authority and no queued message.
2. The owner-only schedule, retention, manual run, pause, last success and failure notice work at 1440 and 390.
3. A populated 0.1.0 copy upgraded in place (`rer install`, `rer dev`) keeps every earlier table row and stored object, every version downloads with its SHA-256, people remain, and a team space can be created.
4. An interrupted upgrade recovers cleanly from a private backup.

#### ADMIN-001 — Single sign-on and directory lifecycle

*Tier:* Core · *Cites:* BASE-SIGNIN-001 · *Register:* R-17

**Requirement.** Chest's delta on Base federation, for Okta, Microsoft Entra ID and Google Workspace (SCIM or the provider's lifecycle API): enforced domain policy, group mapping, a protected break-glass path, and transfer of content and assignments before deprovisioning. Disabling a user revokes web, mobile, editor, device and agent authority and the external grants that depend on that identity. A destructive group change denies removed members at once, while the whole new group snapshot waits for the owner to preview and confirm; additions and renames wait too, and declining never restores revoked access.

**Acceptance.** Against run-auth running locally as the live OIDC, SAML and SCIM provider:
1. A deactivated user loses authority at every door, device and editor session, and team content stays owned.
2. A bad mapping or an IdP outage never strands the owner's recovery path.
3. A provider change that removes one member and adds another denies the removed member at once, gives the added member nothing until the owner confirms, and declining leaves the removed member denied.

#### ADMIN-002 — Admin reports

*Tier:* Core

**Requirement.** Admins filter and export user and content activity, access and sharing changes, external guests, downloads, storage by team, version and trash, sync failures and transfer usage. CSV exports include every matching row under the admin's scope. Storage is a snapshot of retained originals, deduplicated by SHA-256; overlapping area totals are never summed. Guest reports show link audiences and request submissions, never claiming a visit or a person count that is not known. Each user's and space's usage against its storage limit appears (limits are QUOTA-001). Reporting rules are in `docs/administration.md`.

**Acceptance.** In the browser at 1440 and 390:
1. Activity from staff, a guest, a client and an agent reconciles with a permission-scoped CSV, including old versions and trash.
2. A scoped admin's report shows only their scope.
3. Usage against a QUOTA-001 limit shows per user and per space.

#### ADMIN-005 — Provider-only USD cost view

*Tier:* Core · *From:* ADMIN-002 · *Register:* R-11

**Requirement.** The cost view shows only the owner's own provider costs (hosting, storage, mail, editor subscriptions or licences, AI spend) in USD with each provider named, never as a Chest charge. Rates are owner-entered estimates from a named quote, labelled as estimates and never shown as invoices, live prices or permission to start paid work; capacity, retention and USD charges are shown before paid work is enabled. A licensed editor's edition, limits and USD estimate are recorded by an administrator from a named quote, and an explicit, audited capability probe reports only the product and version; Chest's own admission reservations and refusals are labelled separately from provider outcomes, which show as matched or unmatched. Anything Chest cannot determine (missing units, unmatched models, provider-side capacity or enforcement, licensed limits not independently qualified) shows as unknown. The editor's edition, limits, cost, usage and `editor_capacity_reached` refusals appear here (EDIT-006). Every paid producer records its usage before it ships (D-1). Accounting rules are in `docs/administration.md`.

**Acceptance.**
1. Enabling Collabora shows its edition, limits and USD cost before confirming, and driving it to its connection limit counts the refusal.
2. A QUOTA-001 test limit and an estimated provider cost show the warning and preserved originals, with no invented savings or live-price claim.
3. The cost view lists only provider costs, each labelled with its provider, and no Chest charge.
4. A provider call with missing or malformed usage shows its cost as unknown.

#### ADMIN-003 — Several admins, delegated roles and owner transfer

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** The owner promotes any number of super admins and assigns delegated roles, alone or combined, scoped to the organization or named groups: user management, help desk (resend invitations, revoke sessions and devices, reset sign-in factors), sharing and security policy, service settings (integrations, backup, sync and mobile policy, space creation and defaults, storage limits), content recovery, and read-only audit and reporting. Admins can define custom roles from these privileges. File names, previews and search hits count as content under BASE-ROLE-001, and content recovery restores items without opening them. The owner role transfers to another super admin with acceptance and a fresh sign-in, and the former owner keeps only roles left to them. The console warns while only one super admin exists, and the last cannot be demoted or deactivated. Every role grant, change and use is audited.

**Acceptance.** In the browser at 1440 and 390:
1. The owner promotes a second super admin and gives a staff member help desk for one group.
2. The help-desk admin revokes a group member's sessions and resets their factor, and is refused that member's files, previews, downloads and search hits, a reset outside the group, and a policy change.
3. After ownership moves to the second super admin, the former owner is refused owner-only actions on the next request and the new owner succeeds.
4. Demoting the last super admin is refused, and the audit records each step.

#### ADMIN-006 — Admin rewind without content access

*Tier:* Core · *From:* ADMIN-003

**Requirement.** An admin with content-recovery scope rewinds a departed user's account or any space to a recorded point without the owner, previewing changed originals, names, hierarchy, memberships and sharing effects, and restores selected content without opening it or gaining a content role. Recovery keeps later history and conflict copies and never re-enables revoked shares or identities.

**Acceptance.**
1. A staff member with content-recovery scope and no content role previews and restores selected content in a departed user's account and a team space, without the owner.
2. A content-authorized colleague confirms every restored byte and path, with later history and conflict copies kept.
3. The preview accounts for membership and sharing changes, revoked links and the departed identity stay denied, and the admin still cannot list names, preview, search or download the content.
4. With the scope removed, the next preview and restore are refused.

#### ADMIN-004 — Enforced multi-factor sign-in

*Tier:* Core · *Cites:* BASE-SIGNIN-002, BASE-ACCESS-002

**Requirement.** Chest's delta on Base MFA: Chest offers no SMS factor, and on installations that do not federate admins enforce MFA per organization or group with an enrollment grace of 0-30 days, may require phishing-resistant factors for admins, and set session length and idle timeout for web, desktop and mobile. Under enforcement an email link alone never opens a session. A user who loses every factor recovers by recovery code or through a help-desk admin's single-use enrollment link that expires in 24 hours; every reset is audited and notifies the user. Federated sign-ins rely on the IdP's MFA, which admins can require.

**Acceptance.**
1. With MFA enforced and no grace, an unenrolled user's email-link sign-in is held until they enroll TOTP, and a second user enrolls a passkey.
2. A captured email link replayed without the factor is refused.
3. With security keys required for admins, an admin with only TOTP is refused the console.
4. A 1-hour session ends on time.
5. A help-desk reset's enrollment link fails on second use and after 24 hours.

#### QUOTA-001 — Storage limits for users and spaces

*Tier:* Core

**Requirement.** Service-settings admins set byte limits at two scopes. Per-user limits cover a personal area, with an organization default, per-group limits (a user in several groups gets the largest) and per-user overrides; the console shows each user's effective limit and the rule it came from. Per-space limits have an organization default and per-space overrides, and SPACE-002 can set a different starting limit. A limit counts current and retained versions plus trash; shared items never count against the recipient, and bytes stop counting only when an erasure completes. Before a new or lowered limit is saved, the console lists every user and space already over it and requires confirmation. Users and space managers are warned in-app and by email at 90%. Over the limit, uploads, new versions, copies or moves in, sync uploads, editor saves and byte-adding restores are refused with the scope, limit and usage named (`storage_limit_exceeded` in the API); viewing, downloading, searching, sharing, commenting, trashing and erasing keep working. Writes resume on the next request once under the limit. Every limit change is audited. The client and mobile displays are SYNC-011 and MOBILE-001.

**Acceptance.** In the browser at 1440 and 390 and through the API:
1. A group user limit and a space limit set below current usage list the affected users and spaces and need confirmation.
2. A group limit beats the organization default, and a user in two limited groups gets the larger.
3. The over-limit user's upload is refused with `storage_limit_exceeded` naming the limit, while view, preview and download still work.
4. In an over-limit space, trashing does not drop usage until a space manager erases, and writes then resume on the next request.
5. The 90% warning emails and the audit of each limit change exist.

#### SECURITY-001 — Encryption and secret custody

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-SECRET-002, BASE-ACCESS-004

**Requirement.** Chest's delta on Base secrets: transport, owner-selected storage and device caches are encrypted, with documented installation and provider key custody, rotation and recovery. Provider credentials, link capabilities and signing keys stay secret, encrypted at rest and absent from source, served assets, archives, logs and AI prompts. Integrations use least scopes and revocation, and exported grants confer no sign-in authority. Current-session and origin checks cover every mutation.

**Acceptance.**
1. A canary credential never appears in API responses, settings pages, logs, prompts or archive output.
2. Rotating or revoking a provider key and a device key makes the old one fail, while authorized originals stay recoverable under the documented key policy.
3. A cross-origin mutation, an unauthenticated request and a stale-grant race all fail closed.

#### SECURITY-002 — Malware scanning and classification

*Tier:* Core · *Rules:* D-1

**Requirement.** Separately deployed scanning and classification detect infected uploads and sensitive content. Owners configure classification-based access, external-sharing restrictions and quarantine and release roles, see reasons and false-positive handling, and can pause a device or token without destroying evidence. Original bytes never bypass a pending quarantine through another door. Processing needs the owner's confirmation; a release needs a recorded reason and the owner or a selected reviewer with current security scope; pending or failed verdicts and sensitive external sharing deny access, and ordinary roles still apply. Originals up to 1 GiB are processed, and larger ones stay quarantined.

**Acceptance.**
1. A harmless malware-test specimen and a labelled sensitive document are quarantined with reasons.
2. Every preview, download, link and device door refuses quarantined originals.
3. Only an authorized reviewer releases, and policy changes never erase originals or silently widen access.

#### SECURITY-004 — Mass-activity alerts

*Tier:* Core · *From:* SECURITY-002

**Requirement.** One account, device or token downloading more than 500 files or 5 GB, or trashing or deleting more than 200 items, within 10 minutes raises an alert (defaults that security admins tune per organization and group). Admins can also choose to pause the account's downloads or the device or token at the threshold. Threshold changes are audited with before and after values.

**Acceptance.**
1. With the defaults, 501 downloads in 10 minutes alert, and 199 trashes do not.
2. A group threshold lowered to 100 with pause on refuses the 101st download in the window, and the alert names the rule.

#### SECURITY-003 — Server-side ransomware protection

*Tier:* Core

**Requirement.** Replacements arriving through the browser, the API and the device protocol are checked before publication for entropy jumps, file signatures that no longer match, mass renames to new extensions and ransom-note files. On detection the session, token or device pauses before current versions change, and the user and security admins are alerted in the app, by email and in the console with device, account, first detection and affected files. One action restores every affected file to its last pre-incident version (or a RECOVER-001 point), keeps suspect versions as quarantined history and leaves other sources' legitimate edits alone. A false positive is released with one action. The source stays paused until resumed.

**Acceptance.**
1. A burst of high-entropy rewrites through the API pauses the token before any current version changes, and the alert names it.
2. A legitimate edit from another source continues while paused.
3. The one-action restore returns each file to its pre-incident SHA-256, with suspect versions kept as quarantined history.
4. A mass rename to a new extension is detected.
5. A deliberate false positive is released and uploads resume with no loss.

#### SECURITY-005 — Client-side ransomware protection

*Tier:* Core · *From:* SECURITY-003

**Requirement.** The SYNC-008 and SYNC-006 clients watch outgoing changes for the same signals and pause upload from the device before server versions change, keep downloads paused for affected folders, hold suspect changes locally and show the event in the tray.

**Acceptance.** From a real client:
1. Rewriting 500 synced files with high-entropy content in under a minute pauses upload before any current version changes, and the tray, email and console show the device and file list.
2. Another device's legitimate edit syncs while paused, and the one-action restore recovers all 500.

#### GOVERN-001 — Retention, legal hold and discovery providers

*Tier:* Later · *Register:* R-22, R-23

**Requirement.** Owners configure retention classes, holds and erasure conflicts with a qualified immutable archive or eDiscovery service such as Amazon S3 Object Lock or Microsoft Purview. Export includes scoped originals, versions, chain of custody and activity, and hold status names the provider's acknowledgment, policy and scope. Chest never calls plain R2 certified WORM or claims legal sufficiency.

**Acceptance.**
1. A test project on a provider-confirmed hold refuses deletion, and a discovery package reconciles hashes, versions and audit at the provider.
2. After an authorized release, erasure completes with the provider's outcome shown.

#### AUDIT-001 — Complete, durable action history

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-OPS-005, BASE-OPS-004

**Requirement.** Chest's delta on Base audit: the trail also attributes reads and downloads, sharing and admin changes, device actions and every automation and provider attempt to actor, exact version, authority and outcome, and its payloads omit secrets.

**Acceptance.** On Chest's own records:
1. A share whose notice mail the provider fails leaves a provider attempt against the item marked uncertain, and a notice mail that a restart interrupts stays uncertain, with its reason.
2. After an actor is erased, no exported record of their actions exposes a secret field.

#### AUDIT-002 — File activity and view history for collaborators

*Tier:* Later · *From:* AUDIT-001

**Requirement.** Each file's activity panel shows everyone with viewer access its edits, versions, comments, moves and sharing changes, and shows people who can edit it which colleagues viewed it and when, as Drive's activity dashboard does. Admins turn view history on or off per organization or group, each user can hide their own views, and guests' and link visitors' views appear only as counts unless the viewer is a manager. The panel follows current access and never reveals a viewer of something the requester cannot see.

**Acceptance.**
1. Two colleagues view a space file; a contributor sees both names and times, and a viewer sees edits but no view history.
2. A colleague who hides their views leaves the list, and turning view history off for the group removes it.

#### ERASE-001 — Deliberate erasure, separate from trash

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006

**Requirement.** Chest's delta on Base erasure: an authorized erasure removes the selected originals, all versions, derived text, thumbnails and embeddings, guest and link authority, import staging and custody, and affected backup copies under disclosed provider retention. It revokes identities and credentials where requested, writes a durable per-store receipt and a source erasure fence, and keeps a minimized anonymized audit. A preservation instruction or legal hold produces an explicit refusal or pending outcome. Offline copies cannot be recalled, so a restore must apply the later erasure journal or say it cannot know later erasures.

**Acceptance.**
1. Erasing a populated file and a staff identity clears every storage, index, import and backup target and anonymizes the audit; after a restart, search, download and restore of an older archive with the later journal refuse resurrection.
2. An unreachable backup or held object shows as pending, never complete.

#### OPS-001 — Clear, accessible and observable operation

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-PUBLIC-003, BASE-OPS-004 · *Register:* R-21

**Requirement.** Browser, native and admin screens show loading, empty, failed and permission-denied states in words, keep unfinished input, and are the screens the BASE-ACCESSIBILITY-001 journey covers. Operators see health, stale and background jobs, configured US time zones, capacity, backup failures and measured deployment limits. Install and update steps are reproducible from the docs. Production installs use the owner's named real accounts; a fake proves behaviour, never a provider's availability.

**Acceptance.** With realistic nested project data, at 1440 and 390:
1. The BASE-ACCESSIBILITY-001 journey runs on Chest's store, open, share, search and recover screens.
2. Disconnecting each service shows its state in words and recovers without fake success or lost edits.
3. The documented stack installed in an owner test account shows its measured limits and actionable health signals.

#### SCALE-001 — Seeded scale run

*Tier:* Core · *From:* SCALE-001, SPACE-001, SYNC-003, SEARCH-001, OPS-001 · *Register:* R-1, R-2

**Requirement.** A seeded generator builds the metadata reference (sparse or deduplicated bytes allowed): 2,000,000 items, a largest space of 500,000 items with 100 nested levels and 600 direct members, a largest folder of 20,000 children, and 300 device credentials. At that size, at p95: a folder's first page lists within 1 second and a 20,000-child folder scrolls without a full reload; search across the user's accessible items returns first results within 2 seconds; a permission change applies on the next request through every door; a device offline for 7 days on a controlled clock, under the current device session policy, catches up on 10,000 remote changes within 15 minutes; and a new device enumerates a 500,000-item space within 30 minutes without hydrating bytes. Counts and p50 and p95 timings are published in the operator console.

**Acceptance.** One combined seeded run on declared CI hardware:
1. The generator records item, byte, depth, member and device counts at or above the reference.
2. A fixed script of listings, deep-path opens, 50 searches and 20,000-child scrolling meets each target.
3. A group revoked mid-run is refused on the next list, search, download and sync request.
4. The offline catch-up and the enumeration meet their targets with final hashes matching.
5. The console publishes the counts and timings.

#### SCALE-002 — Honest scale health

*Tier:* Core · *From:* SCALE-001 · *Cites:* BASE-OPS-001

**Requirement.** An installation not yet measured at the reference size reports "unmeasured" as a warning, not a failure. A measured run that misses a target reports a failing health check rather than degrading silently.

**Acceptance.**
1. With no reference-size measurement, scale health returns 200 with "unmeasured".
2. A recorded run that misses a p95 target returns 503 naming the target.

#### OPS-002 — Availability probes and measurement

*Tier:* Core · *Register:* R-20

**Requirement.** Chest measures each door (web, API, sync and links) against a configurable monthly target, 99.9% by default; the owner's hosting decides the actual availability. Probes from at least two locations exercise each door every minute with a real signed-in or link request. A minute is down for a door when probes from two locations fail it. Planned maintenance is announced 72 hours ahead and counts as downtime. The console shows each door's monthly percentage and minute history, and a month falling below target raises an admin alert. A hosted operator's service credits are set by its own terms.

**Acceptance.**
1. Deployed probes record a minute history for each door.
2. One door taken down for a measured interval is counted as down, and the monthly figure computed on a controlled clock matches.
3. A month below target raises the alert.

#### OPS-003 — Second copies and scrubs

*Tier:* Core · *From:* OPS-002

**Requirement.** Every original version is held as at least two independent copies in separate failure domains (for example R2 plus S3 or another region). The second copy is written within 15 minutes of admission, and anything still waiting shows in the console. A scrub rereads every copy at least every 30 days against the CHEST-03 checksum; a bad or missing copy is repaired from a verified good one with an audit entry, and a file with no good copy is shown as damaged and never served as intact. A monthly report gives objects and bytes verified, mismatches, repairs and losses. RECOVER-002 backups are in addition.

**Acceptance.**
1. One copy corrupted and another file's second copy deleted are both found by the next scrub and repaired, with audit entries and the report.
2. An object with no good copy shows as damaged and is never served.

#### OPS-004 — Incident status

*Tier:* Core · *From:* OPS-002 · *Cites:* BASE-OPS-001

**Requirement.** Probes open incidents automatically, and operators open or update them, naming the doors, start time and updates. A banner appears in the browser, the desktop tray, the mobile app and the console within 2 minutes of detection, admins get an email, and a status page is served independently of the app. Clearing an incident removes the banners and records its duration. A client that cannot reach Chest shows "Chest unreachable" with its last contact, distinct from a local network failure where it can tell.

**Acceptance.**
1. Stopping the API opens an incident automatically, and the banner shows in the browser at 1440 and 390 within 2 minutes, the independent status page reports it, and admins get the email.
2. Restoring the API clears the banners and records the duration.
3. The desktop and mobile banners show once those clients exist.

#### OPEN-001 — Free MIT-licensed source with no charges

*Tier:* Core · *Cites:* BASE-DATA-005

**Requirement.** Chest is free, open-source software: the whole product ships as MIT-licensed source with the licence at the repository root and in every release. There is no licence key, seat count, user cap, paid edition, trial or feature gate, and Chest never charges for or meters people, storage or features. Costs from the owner's own providers are never a Chest charge (ADMIN-005). Every production dependency, direct and transitive, is listed with its licence in each release.

**Acceptance.**
1. A release from a fresh clone has the MIT licence at its root and a list naming every production dependency with version and licence.
2. With 150 staff invited through the public API, every delivered capability works with no licence key, payment, seat prompt, user cap or feature lock.
3. A source scan of the release finds no licence-key, seat-limit or paywall check.

#### OWN-001 — Runs on the owner's computer, server or cloud

*Tier:* Core · *From:* OWN-001, CHEST-23 · *Cites:* BASE-INSTALL-001, BASE-DATA-005

**Requirement.** Chest's delta on Base install: no Chest-operated service is in the path, originals and metadata stay in owner storage, and people sign in by emailed link. A server install uses the owner's domain, mail provider and object storage. On Cloudflare (a Worker, a D1 database and an R2 bucket, as `deploy.json` describes), `rer run hosted-backup` saves the database and every original privately and `rer run hosted-restore` restores them into a fresh deployment. Installs move between targets by CHEST-12 export and restore. A computer install says when other devices cannot reach it.

**Acceptance.**
1. On an owner-controlled Linux VM, an invited staff member's link arrives through the owner's mail provider.
2. A shared file's bytes are in the owner's storage and download exactly through both identities.
3. A hosted backup holds data made only there; after removal, redeploy and restore, both people sign in again by email and find folders, trashed versions, the link's download count, the file request and a 150 MB original byte for byte.
4. The server install exported with `rer export` and imported into the cloud install with `rer import` reconciles every original and record.
5. With outbound access to every Run Edit Run host blocked, each install keeps serving staff.

### Move-in from incumbents

#### MIGRATE-001 — Inventory, approved plan and resumable batches

*Tier:* Core · *Cites:* BASE-OPS-003 · *Register:* R-2

**Requirement.** Every source adapter inventories all files and folders, owners, principals, versions, timestamps, comments, links and unsupported records, with counts, bytes, hashes and a reason for each gap. The owner previews identity and permission mappings and approves the exact plan; a changed source makes the plan stale. Batches are resumable and idempotent. Unmapped rights fail closed, and imported approvals stay source history. Names a target cannot hold (for example too long for Windows) are renamed and retried, and reported.

**Acceptance.** Through the migration wizard on a representative source:
1. The inventory reconciles every item and version with counts, bytes, hashes and gap reasons.
2. A source change after preview makes the plan stale, and it is refused.
3. An interrupted batch resumes without duplicates.
4. Unmapped rights fail closed.
5. Over-long names are renamed, retried and reported.

#### MIGRATE-008 — Delta catch-up, cutover and rollback

*Tier:* Core · *From:* MIGRATE-001

**Requirement.** A delta catch-up runs before cutover. A cutover manifest tracks replacement URLs and collaborator tests. Rollback keeps source read access and an independent archive. Undo applies only to untouched work, and native edits made since are kept as conflicts. Chest never claims to own the vendors' domains; redirects there stay with the source.

**Acceptance.**
1. A delta pass after the main batch carries only the changes since.
2. Internal and external collaborators test the cutover manifest, including old-to-new links (MIGRATE-007).
3. Undo reverses untouched work and keeps native edits as conflicts, and rollback keeps source read access and the archive.

#### MIGRATE-002 — Google Drive files, revisions and permissions

*Tier:* Core · *Register:* R-12

**Requirement.** Drive personal and shared drives import through authorized APIs or export, keeping folder IDs and mapping, team ownership, file and revision bytes, shortcuts, native Google types and explicit user, group and domain ACLs. Imported approvals and unavailable revisions become sourced history or named gaps. Drive is declared replaced only after the owner accepts the Google conversion fidelity and the MIGRATE-014 unresolved-link report.

**Acceptance.** Against an official-schema Drive fake and a Takeout export, with shared drives, a departed owner, native files, shortcuts, nested restricted folders and history:
1. Inventory, byte hashes, native and exported fidelity, principals and links reconcile.
2. An external collaborator uses the replacement without reaching forbidden folders.
3. A rerun skips what already arrived.

#### MIGRATE-009 — Drive labels and shared-drive roles

*Tier:* Core · *From:* MIGRATE-002

**Requirement.** Each Drive label becomes a CHEST-02 type and each field a typed field (text, number, date, selection with options, user), with values copied per file and label and field IDs kept; badged labels and disabled options are inventoried, and a field with no equivalent is a named gap. Shared-drive Manager, Content manager, Contributor, Commenter and Viewer map one-to-one to the ROLE-001 roles, My Drive Editor, Commenter and Viewer to the file roles, and the drive's download and outside-sharing settings to no-download and POLICY-001 space overrides. No mapping widens a role.

**Acceptance.**
1. A labelled file with a date and a selection field arrives with both as typed fields.
2. A shared drive with one member at each role and download-restricted viewers passes the ROLE-001 role tests for each migrated member.

#### MIGRATE-010 — Vault holds and externally owned files

*Tier:* Core · *From:* MIGRATE-002

**Requirement.** Vault retention rules and holds over migrating accounts, shared drives or files are inventoried with matter, scope and dates. Held content arrives under a Chest preservation instruction (erasure refused, ERASE-001) and is listed in the report; a GOVERN-001 provider policy can take it over later. Files owned outside the domain that staff rely on (Shared with me, shortcuts, external items in shared drives) are inventoried with owner, sharing and the staff who use them; for each, the owner copies it in with the source owner's consent recorded, keeps a labelled external link, or requests transfer. None is silently copied or dropped.

**Acceptance.**
1. A Vault hold and a retention rule over a shared drive are inventoried, the held content arrives with erasure refused, and the report lists it.
2. An externally owned file in a shared drive and one in a user's Shared with me are each reconciled by the chosen option or reported as a named gap.

#### MIGRATE-011 — Drive comments, action items and suggestions

*Tier:* Core · *From:* MIGRATE-002

**Requirement.** MIGRATE-012 applies to every Drive file with comments: native Docs, Sheets and Slides, Drive-hosted Office files, and PDFs and images commented in Drive's preview. Authors are matched in this order: each domain user's own comments listed under domain-wide delegation; Drive Activity actors resolved through the directory; then a display-name proposal that the owner confirms. External authors become guest identities without access unless migrated permissions grant it. When a Doc is converted to DOCX or ODT, each pending suggestion becomes a tracked change, reconciled by suggestion ID so none is dropped or doubled. A file kept native keeps its comments in Google, shown as provider-held with counts and a link, with no duplicate threads. API fields used are listed in `docs/move-in.md`.

**Acceptance.** Against the Drive fake, with a Doc holding three open threads (one with two replies, one assigned to B), a resolved thread, two pending suggestions by C, a comment by an external collaborator and one by a deleted user, a Sheet cell comment and a PDF region comment, converted to DOCX:
1. The DOCX opens in the editor with the four threads in their states and anchors, attributed to the mapped people; the external comment carries the guest's email and the deleted user's shows as a former collaborator.
2. B finds the assigned comment in their task list.
3. C's suggestions are tracked changes attributed to C, and a contributor's accept and reject are decision versions.
4. The cell and region comments are threads on the right cell and on the right page and region.
5. Kept native instead, the Doc's comments stay in Google and are reported as provider-held with no duplicates.

#### MIGRATE-012 — Open review work moves as live state

*Tier:* Core · *From:* MIGRATE-001, MIGRATE-002 · *Rules:* D-3

**Requirement.** Every adapter inventories, per file, comments, replies, open and resolved threads, assigned comments or tasks, and pending suggestions or tracked changes, and moves whatever the source exposes into EDIT-003 threads, tasks and tracked changes. These rules apply to every adapter and are stated only here. Each thread keeps its replies in order, original times, state and source IDs ("migrated from …"), anchored to its text, cell, slide or page region, or flagged "anchor not found" with its quoted text kept. Each author is matched by evidence in a named order, never guessed: the owner confirms proposals in the mapping preview, an unmatched author shows as "Former collaborator (name as in source)", and nothing is written under a guessed author (`author_mismatch`). Mentions become mentions without access (D-3); an assignee who was not migrated or cannot open the file is named in the report, the task goes to the file's owner or space managers, and the owner is offered the one-step grant. The migration and every delta pass send no notification; a delta pass carries new replies, resolves, reopens and reassignments idempotently by source ID, and reminders for migrated tasks start one full reminder interval after cutover, unless the owner chooses one summary email per assignee (off by default). Anything a source cannot expose is a named per-file gap; the report counts each item in source and Chest and gives every difference a reason, and the source is not declared replaced while any difference lacks one.

**Acceptance.** For any adapter's fixture with open review work:
1. Threads arrive with their replies, times, states and anchors, and a removed anchor is flagged with its quoted text.
2. An injected unmatched author shows as a former collaborator and is listed; no comment is attributed to another person.
3. An assignment to a user who cannot open the file goes to the owner with no access granted, and is listed.
4. Nothing is sent during the migration, a delta pass or on cutover day, and the first reminder comes one interval after cutover.
5. A reply and a resolve made in the source arrive once through the delta pass.
6. The report's per-file counts match the source, with every difference reasoned.

#### MIGRATE-003 — Dropbox Business

*Tier:* Core · *Register:* R-14

**Requirement.** Member folders and team folders import through Dropbox APIs or export, with revisions, deleted-file history where available, metadata, shared-folder membership and external links mapped under current policy. Equal hashes keep distinct file IDs, selective-sync placeholders are accounted for, and missing revision or transfer history is reported. Comments move under MIGRATE-012 wherever Dropbox exposes them; otherwise the file's comments are a named gap.

**Acceptance.** Against an official-schema Dropbox fake with a team folder, a personal folder, revisions, a deleted file, expiring links and an open comment thread:
1. Every item, version and right reconciles, and a delta import runs.
2. Links are reissued under policy, and recipients' workflows pass before cutover.
3. The comment arrives as an attributed thread with no notification, or is a named gap.

#### MIGRATE-004 — Box

*Tier:* Core · *Register:* R-15

**Requirement.** Box folders, original and version bytes, metadata templates, collaborators, shared links, and comments and tasks import through authorized APIs or export. Source legal-hold, retention and approval provenance stay separate, held content arrives under a preservation instruction as in MIGRATE-010, and a source role never becomes broader Chest rights. Box comments become threads and Box tasks become tasks with assignees, due dates and completion state under MIGRATE-012.

**Acceptance.** Against an official-schema Box fake with custom metadata, a limited collaborator, a versioned file, a shared link, a comment thread and an open task:
1. Counts, hashes, history and rights reconcile, and provider-held or unavailable items are reported.
2. The thread arrives attributed and the task sits in the assignee's list with its due date, with no notification.
3. A guest passes the replacement test, and a signed-off cutover and rollback reconcile.

#### MIGRATE-005 — OneDrive and SharePoint

*Tier:* Core · *Register:* R-13

**Requirement.** OneDrive for Business and SharePoint libraries import through Microsoft Graph or export, keeping site and library structure, originals and revisions, owners, groups, unique item permissions, metadata and content types, and sharing-link mappings. Pages, lists and suite workflows are inventoried with an explicit hand-off, never silently called files or dropped. Comments stored in Office files become threads under MIGRATE-012, with authors matched from the Entra ID identity Office records and confirmed in the preview.

**Acceptance.** Against an official-schema Graph fake with a SharePoint library, a OneDrive user, a restricted subfolder, versions, a guest link and a DOCX with an open and a resolved comment by different users:
1. Records, bytes and ACLs reconcile, and pages and workflows are reported.
2. The comments arrive as threads attributed to the mapped people, in their states, with no notification.
3. After a delta and offboarding the source owner, the replacement links work for staff and a guest.

#### MIGRATE-006 — File shares and Nextcloud

*Tier:* Core

**Requirement.** SMB and NAS trees and Nextcloud or WebDAV libraries move through mounted originals or documented APIs with a source manifest, keeping names, bytes, times, rights and available history, and reporting encrypted content or anything unexportable as a named gap the owner signs off.

**Acceptance.**
1. A NAS share and a Nextcloud test library are inventoried, migrated and reconciled by hash and rights.
2. A revoked collaborator is refused in the replacement.
3. Unexportable history shows as a named gap needing owner sign-off.

#### MIGRATE-013 — Egnyte and LucidLink

*Tier:* Later · *From:* MIGRATE-006 · *Register:* R-16

**Requirement.** Egnyte folders and LucidLink filespaces move through documented APIs or mounted originals with a source manifest, keeping names, bytes, times, rights and available history and reporting unavailable streamed ranges, encrypted content or vendor-only data. Those sources are retired only after SYNC-005 and SYNC-004 acceptance passes.

**Acceptance.**
1. A test filespace from each is inventoried, placeholders hydrated, and migrated with hashes and rights reconciled.
2. A large creative file opens from the replacement mount, and a revoked collaborator is refused.

#### MIGRATE-007 — Source map and link rewriting

*Tier:* Core · *From:* MIGRATE-007, MIGRATE-001, MIGRATE-002

**Requirement.** Every migration keeps a persistent map from each source ID (file, folder, shared drive or site, and revision where available) to its Chest stable ID, after cutover and in CHEST-12 and RECOVER-002 archives. During the job and again after the last delta, Chest rewrites source URLs that point at migrated items (Drive, Docs, Sheets, Slides and Forms URLs including `open?id=` and shared-drive URLs; Dropbox links and paths; Box links; OneDrive and SharePoint links and paths) inside DOCX, XLSX, PPTX and ODF files (hyperlinks, `HYPERLINK` formulas, linked objects, external workbook references), Google files kept native or converted (an `IMPORTRANGE` points at the migrated spreadsheet, or becomes an external workbook link after conversion where the editor supports one, otherwise it is reported with cached values kept), PDF link annotations, Drive shortcuts, `.url` and `.webloc` files, and item descriptions. Each rewrite is a new attributed "migration link rewrite" version with the source bytes kept as the prior version.

**Acceptance.** With a Doc linking to a Sheet in another shared drive, a Sheet with `IMPORTRANGE` (kept native in one run, converted in another), a PPTX and a PDF with Drive links, a shortcut and a `.url` file:
1. Every link opens the matching Chest item, and each rewritten file's prior version still matches the source hash.
2. A file linked in a delta is rewritten by the final pass.
3. Equivalent Dropbox, Box and SharePoint link fixtures pass through their adapters.

#### MIGRATE-014 — Unresolved-link report and old-URL resolver

*Tier:* Core · *From:* MIGRATE-001, MIGRATE-007

**Requirement.** Every link not rewritten is listed with its file, location (page, sheet and cell, or slide), source URL, intended target and reason (excluded, not found, no access, externally owned, unsupported or encrypted), and the report counts every rewritten link by vendor and location; the owner accepts it before cutover. A staff-only resolver page and API, also used by the mail add-ins and chat unfurls, turns an old source URL pasted from mail, a calendar or another system into the migrated item: a user with access gets it, one without gets Request access without the title, an unmigrated URL is reported as not migrated, and guests and signed-out browsers are refused. Historical mail and calendar content are not rewritten, because the source vendor controls them.

**Acceptance.**
1. A link to an excluded file appears in the report with file, location, target and reason, and the summary's counts equal the rewritten fixtures per vendor.
2. An old Drive URL in the resolver opens the item for a member, shows Request access without the title to a non-member, and is refused for a guest.

### Integrations and follow-up

#### CONNECT-001 — Slack

*Tier:* Core · *Rules:* D-1, D-3 · *Register:* R-18

**Requirement.** A scoped Slack app finds Chest files, shares policy-checked links, and delivers subscribed comment, request and review notifications in approved channels and DMs. Searches and unfurls use the requesting user's current access, and channel membership is never a library grant. Arrivals from Slack follow CONNECT-006's provenance and dedup rules. Admins control installation, scopes and revocation.

**Acceptance.** In a Slack developer workspace:
1. Two users with different rights search and share, and a changed folder grant changes their unfurls and notifications.
2. A share that POLICY-001 refuses is refused with the policy named.
3. After the app is revoked it can no longer search or send, and existing Chest links still enforce their own audience.

#### CONNECT-002 — Microsoft Teams

*Tier:* Core · *Rules:* D-1, D-3 · *Register:* R-13, R-18

**Requirement.** A Teams app supports file search, pick and open, controlled links and collaboration notifications under the user's Entra-linked identity and current Chest grants. Channel and private-chat content never inherits broad storage access, and tenant admins can restrict and revoke the app.

**Acceptance.** Against the Bot Framework emulator and an official-schema Teams fake:
1. A restricted file shared into a mixed channel opens and edits for an authorized user and is denied to another.
2. A share that POLICY-001 refuses is refused with the policy named.
3. After a group or the app is revoked, search, cards, previews and queued notifications stop exposing content.

#### CONNECT-003 — Salesforce and HubSpot record files

*Tier:* Later · *Rules:* D-3 · *Register:* R-19

**Requirement.** Salesforce accounts, contacts and opportunities and HubSpot companies, contacts and deals link to scoped Chest folders and versions through a Salesforce app and a HubSpot app with a record card listing the folder's files. Authorized users file arrivals and see current approved content without duplicating CRM ownership. Mapping changes keep provenance and never grant every CRM user Chest access.

**Acceptance.** In a Salesforce developer org and a HubSpot developer portal:
1. A file attached to an opportunity is replaced and approved; after the record and folder access change and the link is deleted, the original and provenance remain and unauthorized CRM users see nothing.
2. A deal's record card lists the folder's files for a user with Chest access and none for one without.

#### CONNECT-004 — Docusign

*Tier:* Later

**Requirement.** A person sends an exact version to Docusign, Chest tracks the envelope and receives signed originals and completion evidence as new immutable linked versions. Callbacks are verified, uncertain sends reconciled and repeats deduplicated; Chest approval stays separate from signature validity. This serves firms standardized on Docusign or needing its notarization and qualified signatures; everyday signing is SIGN-001.

**Acceptance.** In a Docusign developer sandbox:
1. Completed and declined envelopes, a replayed signed callback and an uncertain send leave the signed bytes and certificate, with no duplicate envelope or version.
2. A pending source is never marked signed on provider acknowledgment alone.

#### CONNECT-005 — Zoom

*Tier:* Later · *Rules:* D-3 · *Register:* R-19

**Requirement.** Authorized meeting participants pick permitted Chest files and share controlled links, and authorized cloud recordings and transcripts are filed into a chosen folder with consent and provenance. An invitation alone grants no file access, and recording retention follows owner policy. Meet filing is CONNECT-010.

**Acceptance.** In a Zoom developer account:
1. A restricted deck is shared with a guest, and an authorized recording and transcript are filed after the meeting.
2. An unrelated participant and a revoked integration are denied, and a cancelled recording job reports its real state.

#### CONNECT-006 — Mail arrives in folders

*Tier:* Core · *Cites:* BASE-OPS-003 · *Rules:* D-4

**Requirement.** Mail reaching a space's intake address, or an owner-approved mailbox (CONNECT-011), files attachments into the chosen folder once, with message, sender and date provenance, from allowed senders only. App arrivals (Slack, Teams) use the same provenance and dedup rules. Replies, forwards and outbound collection messages need a preview, or a recipient and cadence policy the owner grants narrowly. Revocation stops later reads and sends. The setup page names what intake needs (Chest on Cloudflare with Email Routing, or a subdomain) and points others to file requests.

**Acceptance.**
1. An attachment delivered twice is filed once with message provenance.
2. A disallowed sender and a disallowed folder are refused.
3. Pausing intake or losing manager access stops queued jobs at the authorization boundary.

#### CONNECT-011 — Gmail and Outlook mailbox intake

*Tier:* Core · *From:* CONNECT-006 · *Register:* R-12, R-13

**Requirement.** Gmail (Google Workspace) and Outlook (Exchange Online) connectors read only owner-approved mailboxes, labels or folders, senders and attachments into chosen destinations under CONNECT-006.

**Acceptance.** Against official-schema Gmail and Graph mail fakes:
1. An approved label's attachment is filed once, and a disallowed folder or sender is refused.
2. Revoking the source stops queued jobs.

#### CONNECT-007 — API, MCP and webhooks for apps and agents

*Tier:* Core · *Cites:* BASE-AGENT-001, BASE-AGENT-004, BASE-AGENT-010, BASE-AGENT-012, BASE-OPS-003

**Requirement.** Chest's delta on the Base agent door: documented file, folder, version, search, share and request APIs and an MCP server give user- and agent-scoped access with pagination, stable IDs, idempotent mutations on a caller key, and signed event delivery. Grants name allowed resources, actions and budgets, and secrets stay installation-local. Webhook consumers deduplicate event IDs, see failure and uncertainty, and control replay; imported events never send automatically. The tool list and endpoints are in `docs/integrations.md`.

**Acceptance.**
1. A third-party client and an MCP agent authorized for one folder read with pagination and upload idempotently, and are refused another folder and any permission expansion.
2. A grant revoked mid-job refuses the next call.
3. A failed signed webhook keeps a durable outcome and replays manually without duplicate product mutations.

#### CONNECT-012 — Embeddable file picker

*Tier:* Core · *From:* CONNECT-007 · *Cites:* BASE-PUBLIC-002

**Requirement.** A documented JavaScript picker with an OAuth grant lets third-party web apps offer "attach from Chest" under the user's current access, returning stable IDs and policy-checked links only.

**Acceptance.** In a test web app over HTTPS:
1. A user picks an accessible file and the app receives its stable ID and a link.
2. A file the user cannot open never appears, and a revoked grant fails the next pick.

#### CONNECT-013 — Admin control of third-party apps

*Tier:* Later · *From:* CONNECT-007

**Requirement.** A sharing and security admin sets, for the organization or groups, whether staff may authorize any app, only allowlisted apps, or none. Each app (OAuth client, MCP agent, picker origin, automation app) can be trusted, limited to read-only or blocked. Staff cannot authorize a disallowed app, and the consent screen names the policy. Blocking or tightening revokes existing grants on the next request. The console lists every app with users, scopes and last use, and policy changes are audited.

**Acceptance.**
1. Under allowlist-only, authorizing an unlisted app is refused naming the policy.
2. A read-only app cannot upload, and blocking an authorized app refuses its next call.
3. The console lists each app with its users and scopes.

#### CONNECT-008 — Gmail and Outlook compose and save add-ins

*Tier:* Core · *Rules:* D-1 · *Register:* R-12, R-13, R-18

**Requirement.** A Gmail add-on and an Outlook add-in (web, Windows, Mac, mobile) let each user, as themselves, insert a Chest file or folder link at a chosen role while composing, turn attachments over a set size (default 25 MB) into SHARE-003 transfer links, and save an attachment or the whole message as EML to a folder they choose. Before sending, the add-in checks every recipient against each item's access, names who cannot open it, and offers a one-step viewer or commenter grant POLICY-001 permits, or explains the refusal; the user can send without granting. Saves are idempotent per message and attachment, carry message ID, sender and date, and are audited. Admins install, scope and revoke the add-ins.

**Acceptance.** Against manifests that pass the official Workspace and Office add-in validators, and official-schema mail fakes:
1. Inserting a restricted file for an allowlisted external recipient names them; a one-step viewer grant is made and audited, and a non-allowlisted recipient's grant is refused with the policy named.
2. A 200 MB attachment becomes a transfer link the recipient downloads.
3. Saving the same attachment twice from each client makes one file with message provenance.
4. After revocation, the next insert and save are refused.

#### CONNECT-009 — Zapier and Make apps

*Tier:* Core · *From:* CONNECT-009, POLICY-001 · *Cites:* BASE-OPS-003 · *Rules:* D-1 · *Register:* R-18

**Requirement.** Zapier and Make apps let non-developers automate Chest through a CONNECT-007 grant naming spaces, folders and actions. Triggers: new file, new file in folder (with subfolders by option), new version, new folder, file moved or trashed, new file-request submission and new comment. Actions: upload, create folder, move, copy, rename, share with a person or create a link (POLICY-001 enforced), remove permission, update typed metadata, find by path or search, and download content for a later step. Each event is delivered once with a stable ID, and actions are idempotent on a caller key. Revoking or narrowing the grant stops triggers and refuses actions on the next call, and every run is audited under the grant.

**Acceptance.** As private apps in Zapier and Make test accounts:
1. "New file in folder → move to a subfolder and share with a colleague" moves and shares a dropped file once, audited under the grant, and a replayed trigger makes no duplicate.
2. An action on a folder outside the grant is refused, and a public link with public links off is refused with the policy named.
3. After revocation the next trigger stops and the next action fails.

#### CONNECT-010 — Google Workspace connection and Meet filing

*Tier:* Core · *Rules:* D-1, D-3 · *Register:* R-12, R-18

**Requirement.** Organizations that keep Google Workspace for mail and meetings get Chest as the file store behind Meet, Calendar and Chat. A super admin or service-settings admin authorizes one Workspace connection with the named scopes, chooses the organizers or groups it covers, and installs, scopes and revokes each part separately. For each covered organizer, every Meet recording, transcript and Gemini notes document is filed once, keyed on the conference record and artifact ID (event notifications plus an hourly sweep), into the folder linked through the Calendar add-on, a folder an admin rule sets, or "Meet recordings" in the organizer's area, with meeting code, conference ID, organizer, times, event ID and title, and source Drive file ID. Notes and transcripts follow the EDIT-002 choice. The organizer becomes file editor; attendees Meet would have given access get viewer (external ones as guests only where POLICY-001 allows), anyone excluded is listed as not granted, and access never widens beyond Meet's audience and the folder's members. The admin chooses whether the Drive copy is kept or moved to Drive trash after its SHA-256 matches; a QUOTA-001 or POLICY-001 refusal keeps the Drive copy and is reported. Recordings already in Drive move under MIGRATE-002 on the same keys. Every action is audited with the Workspace actor, and revoking a part refuses its next action while filed files keep their permissions.

**Acceptance.** Against an official-schema Workspace fake (Meet, Calendar, Drive and event notifications):
1. A recorded event linked to a restricted folder files the recording, transcript and notes once each with provenance; the internal attendee opens them, the external attendee opens them as a guest viewer, and an uninvited staff member gets 403.
2. A replayed notification and the sweep make no duplicate.
3. With source removal on, the Drive copy is trashed only after the hash check; over QUOTA-001 the filing is refused with `storage_limit_exceeded`, the organizer and an admin are told, and the Drive copy stays.
4. An organizer outside the covered group has nothing filed.
5. Revoking Meet filing refuses the next filing, and filed files keep their permissions.

#### CONNECT-014 — Google Calendar add-on

*Tier:* Core · *From:* CONNECT-010 · *Rules:* D-3

**Requirement.** A Calendar add-on on the web attaches a Chest file or folder link at a chosen role to an event, and links the event to a folder for its Meet files. On save it checks each guest against each item's access as CONNECT-008 checks recipients, names those who cannot open it, and offers a one-step viewer or commenter grant POLICY-001 permits, or explains the refusal; the user can save without granting. Guests added later are checked at the next save. A guest who gets the invitation another way gains nothing and sees Request access.

**Acceptance.**
1. Attaching a restricted file to an event with one guest who has access and one who doesn't names the second, grants viewer in one step, and audits it.
2. A guest from a non-allowlisted domain is refused the grant with the policy named.
3. A forwarded invitation's recipient sees Request access.

#### CONNECT-015 — Google Chat app

*Tier:* Core · *From:* CONNECT-010 · *Rules:* D-3

**Requirement.** A Chat app for spaces and DMs, on the web and in the Chat mobile apps, searches Chest and shares policy-checked links with results limited to the user's access. A shared-link card shows the title and a preview only when every member can open the item; otherwise it shows neither, and a member who presses Preview gets a dialog under their own access (the preview, or Request access without the title). The sharer gets a private prompt naming members who lack access, with a one-step grant POLICY-001 permits. Subscribed notifications (comments, access requests, review requests, file-request arrivals) reach chosen spaces or DMs. Space membership is never a library grant.

**Acceptance.** Against an official-schema Chat fake:
1. A restricted file shared into a mixed space shows a card with no title; a member with access sees the preview and one without sees Request access without the title.
2. The sharer's private prompt names the members without access, and its grant lets them open it.
3. A subscribed comment notification reaches the space, and searches by two users return only what each can open.
4. The share repeats in the Chat mobile client, and revoking the app refuses the next share and search.

#### CONNECT-016 — Google Forms file uploads

*Tier:* Later · *From:* CONNECT-010

**Requirement.** For forms owned by covered users, files submitted through a file-upload question are filed once (keyed on form, response and file ID, from notifications plus an hourly sweep) into a folder the form owner maps, or "Form uploads" in their area, with form, question, response, time, respondent email where collected, and source file ID. The form owner becomes editor, respondents gain no access, and the CONNECT-010 source-copy and refusal rules apply. The responses spreadsheet stays a Google Sheet: Chest links it from the folder, opens it under EDIT-002 and copies no rows.

**Acceptance.**
1. Two respondents' files each appear once with provenance, neither respondent can open them, and a replayed notification and the sweep make no duplicate.
2. The folder links the responses Sheet, which opens under EDIT-002, and no rows are copied.

#### RULE-001 — Reversible arrival rules

*Tier:* Core

**Requirement.** Owners preview naming, sorting, tagging, conversion and safe-unzip rules over selected arrivals and folders. Rules run idempotently, keeping original bytes, conversion lineage, policy version, per-item results and an undo plan; changed permissions, unsafe archives or conflicts stop affected items visibly. Rules cannot widen sharing, bypass exact-version approval or delete originals.

**Acceptance.**
1. A rename, tag, move, convert and unzip rule previews over real-format files, is approved, and a replayed event gives one result per original.
2. A traversal archive and an archive bomb, and a destination grant changed between preview and run, keep originals and show the blocked items.
3. An untouched move is undone.

#### FOLLOW-001 — Reminders and durable notifications

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-OPS-004

**Requirement.** Subscriptions and assigned tasks notify by email, Slack, Teams, Google Chat and mobile push for comments, review and change requests, approaching review and expiry dates, file-request deadlines, transfer receipts and unresolved sync failures. Owners choose the US time zone, cadence, escalation recipient and quiet hours, and completion, revoked access or cancelled work stops future reminders. Job history keeps BASE-MAIL-001's outcomes for every channel, with authorized retry. In-document comments notify through these channels (EDIT-008), and migrated work notifies no one (MIGRATE-012).

**Acceptance.** On a controlled clock:
1. A dated request and review move through due, reminder and escalation states, and completing the exact task stops reminders.
2. A failed provider and a worker restart leave a durable outcome, with no duplicate reminder and no forbidden content after completion or revocation.
3. A migrated assigned comment sends nothing during migration or on cutover day, and its first reminder arrives one interval after cutover.

#### FOLLOW-002 — Reply and resolve from email

*Tier:* Later · *From:* FOLLOW-001

**Requirement.** Replying to a comment or mention email posts the reply to the thread as the replier. Each notification has its own signed reply address, and Chest accepts a reply only from the notified address with an aligned SPF or DKIM pass and only while that person can still comment; quoted history and signatures are stripped. A reply from someone who lost access, another address or a forwarded copy posts nothing and bounces with the reason. Comment emails carry a **Resolve** action that opens a signed-in confirmation and applies only while the person can still comment.

**Acceptance.**
1. An email reply appears in the thread, attributed and without quoted history.
2. The same reply from another address, and from the original address after revocation, posts nothing and bounces.
3. Resolve from the email resolves the comment on the file page.

#### FOLLOW-003 — Personal notification settings

*Tier:* Later · *From:* FOLLOW-001

**Requirement.** Each person chooses, per channel, which comment notifications they get (all on files they own or follow; only mentions, assignments and replies; or none), mutes a file or thread, and can switch email to a daily digest at a chosen US time. Mentions and assignments on a muted file still appear in their task list. Service-settings admins set organization and group defaults that people can change.

**Acceptance.**
1. A person set to "only mentions, assignments and replies" gets nothing for a plain comment and a notice for a mention; a mention on a muted file sends nothing but appears in their task list.
2. A daily-digest person gets one email at their chosen time listing the day's comments.

### Agent surface (Base-delivered)

#### BASE-AGENT-001 — One MCP door per seed

*Tier:* Agent surface

**Requirement.** Every seed, hosted or self-hosted, serves one remote MCP endpoint at `/mcp` over Streamable HTTP. It speaks the current revision (2026-07-28) and accepts 2025-11-25 clients through the twelve-month deprecation window. It implements `server / discover`, tools, resources and prompts. Lists are deterministic and carry `ttlMs` and `cacheScope: "private"`. Roots, Sampling and Logging are not served.

**Acceptance.**
1. `server / discover` returns the supported versions, capabilities, `serverInfo` and instructions.
2. A 2026-07-28 request works with no handshake, and a 2025-11-25 client completes `initialize` and lists the same tools.
3. An unsupported version returns `UnsupportedProtocolVersion`.
4. Two `tools / list` calls return the same order, with cache fields.
5. A foreign Origin returns 403, and a header and body method mismatch returns `HeaderMismatch`.
6. An oversized body returns 413 with no effect.

#### BASE-AGENT-002 — The seed's jobs are tools, through the UI's own actions

*Tier:* Agent surface

**Requirement.** Each Core job a person does in the product is a tool. Where one is not, the Agent surface says why: it runs on a device, it is a person's interactive screen, it belongs to a connector or the import door, or it is an installation fact. Risk is never the reason: a risky job is a tool with its class (BASE-AGENT-006). Tools are named `<seed>.<area>.<verb>` and declare input and output schemas and truthful annotations. Each calls the same server action as the UI, so validation and authorization are written once, and the seed's embedded agents use the same registry. A business refusal returns `isError` with the seed's stable error code.

**Acceptance.**
1. The Core clause ids in each tool's `_meta`, with the not-a-tool reasons that `server / discover` serves, cover every Core clause in the contract, and no reason is risk; the harness and `rer check` fail on a gap.
2. Each tool's fixture result validates against its `outputSchema`.
3. Read tools declare `readOnlyHint`; tools that can carry destructive declare `destructiveHint`, and tools that can carry external declare `openWorldHint`.
4. A refusal returns the same error code the UI gets for the same action.
5. The UI action and its tool, on the same fixture, give the same record state and the same audit event type.
6. The seed's embedded agents appear in the audit as calls to the same tools.

#### BASE-AGENT-003 — Records are resources

*Tier:* Agent surface

**Requirement.** Each primary record type has a URI template, and tools return `resource_link`s to the records they touch. A read returns exactly the fields the caller's role sees in the UI. File bytes count against any byte budget on the grant. A record the caller cannot open reads as not found, identical to a missing id. Text from customers, imports or files carries an untrusted marker in `_meta`.

**Acceptance.**
1. `resources / templates / list` names every record type in the Agent surface.
2. Reads as two roles return exactly what the UI shows each.
3. An out-of-scope id and a missing id give identical responses.
4. A write's `resource_link` reads back the new state.
5. Bytes over budget return `budget_exhausted` and no partial content.
6. Customer-sourced text carries the untrusted marker.

#### BASE-AGENT-004 — Business identity and short-lived, audience-bound tokens

*Tier:* Agent surface

**Requirement.** The door is an OAuth 2.1 resource server. Its RFC 9728 metadata names the authorization servers this installation trusts. That is the paired Business when Business provisioned it, verified with the owner-claim trust the installation already holds for its import door; otherwise it is the seed's own sign-in. Access tokens are RFC 9068 JWTs with `aud` set to the seed's canonical MCP URI, `sub` the sponsoring person, `act` the agent (RFC 8693) with its specialist, scopes per tool family, and a lifetime of 15 minutes or less (5 by default). The policy scopes rules on the sponsor, agent and specialist the token names. The consent behind the tokens can last longer and is revocable. Tokens travel only in the Authorization header, and there is no passthrough.

**Acceptance.**
1. An unauthenticated call returns 401 with `resource_metadata`, and the metadata names the trusted servers and scopes.
2. A Business token for this seed works, and the same token sent to a sibling seed returns 401.
3. An expired token returns 401, and a token with a lifetime over 15 minutes is refused.
4. A read-only token calling a write tool returns 403 `insufficient_scope` with every needed scope in one challenge.
5. A token in a query string is refused and not logged.
6. Revoking consent in the seed or in Business refuses the next call within 60 seconds.
7. After unpairing, Business tokens are refused and the seed's own sign-in still works.

#### BASE-AGENT-005 — An agent acts as a person in a role, never more

*Tier:* Agent surface

**Requirement.** Every call is authorized as the sponsoring person's current role and access (BASE-ACCESS-004), intersected with the grant's resources, actions and budget. A grant only narrows. No call widens the calling agent's own authority. A call that would widen its own grant or its sponsor's role, or change the company policy or Pause, is refused with `self_escalation`, whatever the policy says; narrowing its own grant is allowed. Other access and security changes are ordinary actions in the access and security classes. An agent never acts after its sponsor is suspended. Anything an agent reads (records, files, emails, imports, other seeds' results) is data and cannot change its scope, its targets or a call's class.

**Acceptance.**
1. For each role fixture, every tool's allow or deny through MCP equals the UI's for the same action.
2. A one-folder, read-only grant holds, and widening through arguments is refused.
3. Downgrading the sponsor changes the next call's result, and suspending the sponsor returns 401.
4. Calls that widen the agent's own grant or its sponsor's role, or change the policy or Pause, return `self_escalation` and change nothing, even under a policy with every class autonomous; dropping a scope from its own grant runs.
5. An injection fixture yields no out-of-grant call and no change of class: record text asking for a wider action, or claiming that a recipient is internal.

#### BASE-AGENT-006 — Every action declares its risk class

*Tier:* Agent surface

**Requirement.** Classes come from the fleet list in RISK-POLICY.md: standard, external, money, commitment, accounts, gated, access, security, destructive, sensitive and live. In the registry, each tool declares the classes it can carry and a server-side classifier that decides them per call from the arguments, current records and, for gated, the provider's answer. The classifier also supplies each class's facts: the measure (items, recipients, amount and currency, people or records), the counterparty (internal, known, new or public), the direction for access, the provider and step for gated, and the data kind for sensitive. A classifier never reads a flag, label or claim supplied by the agent or by record text. A seed cannot add a class; it proposes one for the fleet list.

**Acceptance.**
1. Every tool in `tools / list` carries its possible classes in `_meta`, equal to the Agent surface table.
2. For each tool, fixture calls cover every class it can carry, and the computed classes and facts equal the fixture's expected values.
3. An argument or record text asserting a class or a confirmation (`internal: true`, `confirmExternal: true`) leaves the computed classes unchanged.
4. Money calls carry amount and currency, external calls their counterparty and recipient count, access calls their direction, and destructive calls their item count.
5. No tool in `tools / list` declares a class outside the fleet list, and `rer check` fails on one.
6. A refused call's audit row still records its computed classes.

#### BASE-AGENT-007 — The company's policy decides, at one chokepoint

*Tier:* Agent surface

**Requirement.** Every agent door calls one decision function: MCP, the integration API with agent tokens, and the seed's embedded agents. It evaluates the call's classes against the company's policy, as above. The seed ships no dispositions and fills no gap with one: agent access opens only under a complete policy that setup has asked for (RISK-POLICY.md), and before then every agent call returns `policy_unset` with the setup link and changes nothing. *Autonomous* runs the call. *Review* runs it and adds it to the review feed. *Approval* saves a pending action with server-computed facts and returns `input_required`, with a URL-mode elicitation to the seed's approval page and a pending handle. Each person the rule names approves the exact saved revision in a signed-in browser, and changed inputs need a new approval. The retried call returns the result and a receipt. A rejection returns `approval_rejected`, and a lapse past the wait the rule sets returns `approval_expired`. *Blocked* returns `policy_blocked`, naming the class, rule and revision.

**Acceptance.**
1. The Base harness runs each tool under each disposition for every class it can carry, and sees it run, run and enter the review feed, wait with no effect, or be refused.
2. Before setup is complete, the setup page lists every class the seed's tools carry with examples and no answer pre-selected, an agent call returns `policy_unset` with the setup link and changes nothing, and an incomplete revision cannot be confirmed; a `*` rule completes it, and a tool an upgrade adds with an unanswered class appears in `tools / list` once that class is answered, while the other tools keep running.
3. Under "money autonomous up to $500, approval up to $10,000, blocked above", calls of $400, $600 and $20,000 run, wait and are refused; a per-day cap sends the call that crosses it to the next rule.
4. A call carrying two classes takes the stricter disposition.
5. An approval shows server-computed facts and an expiry, returns the URL elicitation and a handle, and completes once after the named approver approves; a changed input needs a new approval, and a rejection or lapse leaves no effect.
6. The same call through MCP, the integration API and an embedded agent gets the same decision.
7. A policy change applies to the next call within 60 seconds, and the audit cites the new revision.
8. A policy document with a bad signature or another Business's id is rejected, and the door keeps the last valid revision.

#### BASE-AGENT-008 — Truthful attribution

*Tier:* Agent surface

**Requirement.** Every agent act is recorded and shown as `"<agent> for <person>"`, and mail and messages an agent sends outside name it that way as their sender. An approval, a review mark, a confirmation (a warning dialog, a typed-field confirmation, a delivery confirmation), a decision or a signature attributed to a person comes only from that person's signed-in session. When an agent does the equivalent act, the record names the agent, and the act carries its own class; a binding decision or a signature is commitment. Agent doors ignore arguments that stand for a person's confirmation. No tool solves a bot check, or enters a person's own password or 2FA code at an outside service. A provider step that demands a person goes to a person, whatever the policy says; the gated class marks such steps before they run.

**Acceptance.**
1. An agent call carrying a person-confirmation flag is classified and decided exactly as without it.
2. Approving, marking reviewed or answering a policy question with an agent or device token returns 403 and changes nothing.
3. A form-mode elicitation "accept" never completes an approval.
4. Where an agent's decision, signature or field confirmation runs without a person, it reads `"<agent> for <person>"` in the record, the activity view, exports and any certificate, never as the person's own act.
5. After a person approves an agent's prepared action, the record shows the person as approver and the agent as preparer.
6. Activity and exports at 1440 and 390 show `"<agent> for <person>"` for every agent act.
7. Mail an agent sends to an outside address names `"<agent> for <person>"` as its sender.

#### BASE-AGENT-009 — Every agent action is audited with its class and decision

*Tier:* Agent surface

**Requirement.** Extending BASE-OPS-005, each call that reads private data or changes anything records the agent client, name and specialist, and the run or task id (`traceparent` when sent); the sponsoring person, the grant, the tool and the targets; the classes and their facts, and the policy revision and rule; the decision (autonomous, review, approval, blocked, unset or self_escalation) and the outcome (done, refused, pending or failed); the approval or review id and person, and the idempotency key. For a period, the seed's Agents page shows actions by class and decision with the notable ones, the review feed (Mark reviewed, Flag, and Undo where reversible), pending approvals, steps waiting for a person and setup questions. Business shows the same across seeds.

**Acceptance.**
1. One write leaves a complete audit row.
2. Refused, pending, unset and self-escalation calls are audited.
3. The Agents page's counts by class and decision equal the audit rows on a fixture week.
4. The review feed lists exactly the calls decided as review; Mark reviewed records the person, and Undo restores a reversible one.
5. Filtering by agent or class lists only those rows, and export includes every field.
6. Removing the agent keeps its rows and its name.
7. The Agents page works at 1440 and 390 with no serious or critical axe findings.

#### BASE-AGENT-010 — Agents can follow changes

*Tier:* Agent surface

**Requirement.** The seed emits a typed event for every record change and for every approval, review and policy decision. Each event carries a stable id, a type, the record URI, the actor (a person, or an agent acting for a person) and a time. Events never carry secrets or more than the subscriber may read. Agents can read events three ways: `subscriptions / listen`, an `events.list` tool with a cursor, and signed webhooks from Base `integrations` using the same ids. Every channel delivers at least once and filters by access at delivery.

**Acceptance.**
1. A subscribed record changed in the UI produces a notification within 10 seconds.
2. `events.list` returns the same event id the webhook carries.
3. Replaying from a cursor returns the same ids in order.
4. After access is revoked, no channel delivers events about that record.
5. A failed webhook is visible and replays without duplicate effects.
6. `approval.pending`, `approval.decided`, `review.flagged` and `policy.adopted` carry the class and decision and nothing the subscriber may not read.

#### BASE-AGENT-011 — Limits are policy, and Pause stops everything

*Tier:* Agent surface

**Requirement.** Business limits are rules in the company's policy: per-call and per-day thresholds on any class's measure, such as money moved, outside recipients or items destroyed; spend caps on provider cost (models, SMS, email) per seed, specialist or agent, which setup asks with the classes; "no cap" is an answer. Tools with provider cost declare an estimate before they run, and an exhausted cap returns `budget_exhausted` before any partial effect. The seed's capacity limits (request rate, body and byte sizes) protect the installation: they bound rate and size, never daily business volume, are documented and are not policy. A grant carries budgets only when the person granting it sets them. A **Pause agents** control in the seed, and Pause all agents in Business when paired, refuses every agent token within 60 seconds until a person resumes; browser sessions and devices keep working.

**Acceptance.**
1. A rate overrun returns 429 with `Retry-After`.
2. A per-day cap of three outside recipients sends the fourth to the rule that applies past the cap.
3. An exhausted spend cap returns `budget_exhausted` with no partial effect and shows the spend.
4. Under the answer "no cap", a spending call runs and its spend shows in usage; a call that spends nothing is unaffected by any cap.
5. The usage view shows calls, decisions by class, money moved and provider spend per agent.
6. Pause and Pause all agents each stop the next call within 60 seconds, and resume restores access.
7. An agent token cannot resume.

#### BASE-AGENT-012 — Writes are idempotent and conflict-safe

*Tier:* Agent surface

**Requirement.** Every mutating tool requires an idempotency key and takes an optional expected revision. The same key with the same arguments returns the first outcome for at least 24 hours; the same key with different arguments returns `idempotency_conflict`; a stale revision returns `revision_conflict` with the current revision. Long work returns a job handle and a status tool, with no dependence on the Tasks extension.

**Acceptance.**
1. Two calls with one key give one effect and equal results.
2. A retry with a new JSON-RPC id and the same key, after a dropped stream, returns the recorded outcome.
3. The same key with different arguments returns a conflict and no effect.
4. A stale revision returns a conflict naming the current revision.
5. A job handle used by another person's token reads as not found.

#### BASE-AGENT-013 — Manifest, docs and the conformance journey

*Tier:* Agent surface

**Requirement.** `server / discover` instructions and an on-site `/docs/agents` page are generated from the action registry. The page lists tools by job, with each tool's classes, the test that adds each computed class, its scopes, resource templates, event types, capacity limits and error codes, and the specialist role. `prompts / list` carries the specialist's jobs. Base ships the conformance journey, a harness that `rer verify` runs against `rer dev` and seeds run in CI. It is an MCP client; a signed-in test person takes a person's steps (setup answers, approvals, review marks, resume) through the URLs the door returns, and the same browser leg runs the UI-parity actions and the page checks at 1440 and 390. It runs every acceptance point of BASE-AGENT-001 to 012 and of the seed's SURFACE clauses under two company policies: *all autonomous* (`*`), and *held* (standard review, every other class the seed declares approval, which the test person grants), plus the single-class variants a point names. A point that names no disposition passes under both.

**Acceptance.**
1. The docs list exactly the names in `tools / list` and `resources / templates / list`.
2. Each tool's classes, and the test behind each computed one, are documented.
3. The harness fails on any of: a tool without a schema; an effect under approval or blocked, or before setup is complete; a computed class that differs from its fixture; a flag that changes a class or completes a person's step; a role-parity mismatch; a wrong-audience token being accepted; a duplicate effect on retry.
4. Every acceptance point runs under both policies, every decision matches the policy in force, and under all autonomous no call waits for a person or is refused by policy.
5. A stranger agent given only the seed URL completes the specialist journey through MCP.

### Agent surface

**Specialist: Records clerk.** It keeps the company's files filed, shared correctly and complete, collects documents from outside people, and fetches documents for other specialists.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call.

Chest writes only its delta here. An agent always acts for a named person, its sponsor, in that person's current role and never beyond it, and the surface builds on CONNECT-007's folder-scoped grants, idempotent writes and signed webhooks. Chest's own agents (AGENT-001 to AGENT-008) call the same tools and get the same decisions. Chest presets nothing: each tool declares the classes it can carry, Chest's server computes them for every call from the arguments and current records, never from the agent's flags or from file text, and the company's policy, from the paired Business or from Chest's own Agents settings, decides each call.

**Delivered subset.** The production registry currently contains 42 tools (41 native and Base’s built-in event read), matching 40 of this target table’s 48 names, plus seven metadata resources. The extra native `chest.versions.upload` alias preserves the existing version-only OAuth scope instead of widening it to upload. Core tools, policy, Pause, audit and idempotency are declared. Optional subscriptions, expanded native events, resource refresh, multi-sponsor journeys and new mail-event edges are undeclared; each affected status remains partial. The Today column is implementation scope, not a change to the requirements. See `docs/agent-adoption.md` for precise verb and capacity limits.


**How Chest computes each class.**

- *Standard:* everything below that none of the other tests raises: reading, filing, versions, trash and untrash, rewinds with Undo, internal shares, comments, drafts and proposals.
- *External* (the exposure rule): a message to an address outside the company, or any call that leaves an item newly visible to someone outside it. That covers a share or access grant to an outside person or guest, a public link or a link widened to public, and an upload, new file, move, filing, version restore, untrash, rewind, duplicate repoint or comment that lands where outside people can already see. The counterparty is *known* when the address's domain is trusted under POLICY-001, the person is a customer or vendor in the paired Business, or Chest holds a completed exchange with them; *public* for anyone with a link; *new* otherwise. Measure: recipients.
- *Sensitive:* returning or sending content that SECURITY-002 classified as sensitive, or a full tax, ID or bank number from a file or its OCR text. The masked typed fields of SEARCH-002 do not count. Measure: records, with the data kind.
- *Access:* staff accounts and invitations, roles and admin roles, space membership and devices. Direction: widens or narrows. Item-level sharing is standard or external, never access.
- *Security:* the installation's protection settings, quarantine release and backups.
- *Destructive:* emptying trash, permanent delete, erasure, a device wipe and a restore over current data. Measure: items.
- *Commitment:* approving an exact version under CHEST-08 and applying a signature under SIGN-001. Value and counterparty are recorded where the document states them.

Chest declares no money, accounts, gated or live class. In the Risk class column, a single class is always declared, *a · b* means always both, *a or b* means one of them, decided per call, and *(+ c)* means c is added when the call meets c's test.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `chest.items.list` | A folder, trash, Shared with me or recent view, paginated | SPACE-001, CHEST-06, CHEST-13, SHARE-004 | standard | native visible folders; trash/Shared/recent views pending |
| `chest.items.get` | One item's metadata, the caller's rights and quarantine state | CHEST-06, ROLE-001, SECURITY-002 | standard | native visible metadata; rights/quarantine detail pending |
| `chest.search` | Text and scans with every search filter, under current access | SEARCH-001, SEARCH-003, SEARCH-002 | standard (+ sensitive) | native filters and download-safe snippets |
| `chest.versions.list` | Version history with author, time, size, SHA-256 and arrival | VERSION-001, CHEST-07 | standard | native shared-door tool |
| `chest.files.read` | A version's original bytes, within download rights | VERSION-001, ROLE-001, CHEST-06 | standard (+ sensitive) | native immutable bytes and Range; 512 KiB capacity |
| `chest.access.list` | Grants, guests, links and pending access requests on an item | SHARE-007, SHARE-004, SHARE-008, SHARE-009, SHARE-005, CHEST-10 | standard | native grants; combined links/requests view pending |
| `chest.activity.list` | One item's history | AUDIT-001 | standard | native shared-door tool |
| `chest.requests.list` | File requests and their submissions | SHARE-002 | standard | native request metadata; submissions omitted |
| `chest.reports.get` | The sponsor's storage use; for an admin sponsor, admin reports and CSV in scope | QUOTA-001, ADMIN-002, ADMIN-005 | standard | native admin reports; CSV/self-use view pending |
| `chest.exposure.list` | Links shared too widely, expired guests, broken links | SHARE-007, AGENT-005 | standard | native shared-door tool |
| `chest.events.list` | Change feed with a cursor, the same ids as webhooks | CONNECT-007, CONNECT-006 | standard | Base door events; native webhook ID alignment undeclared |
| `chest.devices.list` | Devices with last contact, client version and unfinished, failed or conflicted work | SYNC-003 | standard | native devices; companion queue diagnostics pending |
| `chest.movein.status` | A move-in's inventory, gaps and progress | MIGRATE-001, AGENT-006, CHEST-11 | standard | native shared-door tool |
| `chest.ask` | Cited answers and field extraction over granted folders; provider cost counts against the company's spend cap | AGENT-007 | standard (+ sensitive) | undeclared: Base spend reservations unavailable |
| `chest.pick` | Stable id and a policy-checked link | CONNECT-012 | standard | native shared-door tool |
| `chest.files.upload` | Add an original or a new version; resumable over 10 MB | CHEST-03, TRANSFER-001, TRANSFER-002, VERSION-001 | standard or external | native original/version; 512 KiB direct capacity |
| `chest.files.create` | New document from the New menu or a template | EDIT-004, EDIT-013 | standard or external | native shared-door tool |
| `chest.folders.create` | Create a folder | SPACE-001 | standard | native shared-door tool |
| `chest.items.update` | Move, rename or set typed fields (including expiry dates), one item or a selection | CHEST-02, CHEST-04, CHEST-09, BULK-001 | standard or external | native single rename/move/typed filing; bulk pending |
| `chest.versions.restore` | Make an earlier version current as a new version | VERSION-001 | standard or external | native shared-door tool |
| `chest.versions.name` | Name a version | VERSION-001, CHEST-07 | standard | native shared-door tool |
| `chest.items.trash` | Move to trash, keeping originals and history | CHEST-13 | standard | native shared-door tool |
| `chest.items.untrash` | Restore from trash to the original place | CHEST-13 | standard or external | native shared-door tool |
| `chest.comments.add` | Comment, mention or assign a colleague; never grants access (D-3) | EDIT-003, FOLLOW-001 | standard or external | native shared-door tool |
| `chest.share` | Share with a person or group up to the sponsor's role, optionally expiring, or grant a pending access request | SHARE-004, SHARE-008, SHARE-009, SHARE-005, SHARE-010, CHEST-10, ROLE-001, POLICY-001 | standard or external | native shared-door tool |
| `chest.links.create` | Create or widen an organization or public link, with password, expiry and limits | SHARE-001, SHARE-006, POLICY-002 | standard or external | native shared-door tool |
| `chest.access.narrow` | Revoke a link, remove a grant or guest, or Make private | SHARE-007, AGENT-005 | standard | native principal removal; link revoke/Make private pending |
| `chest.requests.create` | Create an upload-only request link without sending it; it exposes no content | SHARE-002 | standard | native shared-door tool |
| `chest.send` | Email a request, a reminder, a transfer or a signature envelope | SHARE-002, SHARE-003, SIGN-001, AGENT-004 | standard or external (+ sensitive) | native parallel signature-envelope draft/send; other deliveries pending |
| `chest.filing.propose` | The filing plan for new arrivals | AGENT-001, RULE-001 | standard | native deterministic bounded plan; paid classification unavailable |
| `chest.filing.apply` | Apply the filing plan: rename, tag and move, with Undo | AGENT-001, RULE-001 | standard or external | native exact plan and human Undo |
| `chest.duplicates.propose` | Canonical-file proposal for duplicates and stale copies | AGENT-002 | standard | native shared-door tool |
| `chest.duplicates.apply` | Merge, overwrite or repoint duplicates, keeping originals and old references | AGENT-002 | standard or external | native pair merge preserving originals; repoint pending |
| `chest.rewind` | Rewind a folder, a space or a departed user's account to a recorded point, with preview and Undo | RECOVER-001, ADMIN-006 | standard or external | native shared-door tool |
| `chest.devices.repair` | Pause, resume or retry a device's queue; a conflict keeps both copies | AGENT-003, SYNC-003 | standard | undeclared: companion execution door |
| `chest.limits.set` | Storage limits for users and spaces, for an admin sponsor | QUOTA-001 | standard | native shared-door tool |
| `chest.erasure.prepare` | Draft an erasure with what it would remove | ERASE-001 | standard | undeclared: client custody boundary |
| `chest.erasure.run` | Run an erasure under ERASE-001's own checks | ERASE-001 | destructive | undeclared: client custody boundary |
| `chest.trash.purge` | Empty trash, or permanently delete one item from it | CHEST-13 | destructive | undeclared: client custody boundary |
| `chest.devices.revoke` | Revoke a device, optionally wiping Chest's cache on it | SYNC-003 | access (+ destructive, + security) | native revoke only; wipe undeclared |
| `chest.spaces.create` | Create a team space with members and its defaults | SPACE-001, SPACE-002 | standard or access | native empty team space; initial members/defaults separate |
| `chest.members.update` | Invite staff, change roles and admin roles, add or remove space members | CHEST-01, ROLE-001, ADMIN-003 | access (+ external) | native space membership; staff/admin edits pending |
| `chest.settings.update` | Sharing policy, space defaults, sign-in and directory, MFA, encryption custody, scanning and quarantine roles, mass-activity and ransomware rules, app policy | POLICY-001, POLICY-002, SPACE-002, ADMIN-001, ADMIN-004, SECURITY-001, SECURITY-002, SECURITY-004, SECURITY-003, SECURITY-005 | security | native sharing policy; other security families pending |
| `chest.quarantine.release` | Release a quarantined original with a recorded reason | SECURITY-002 | security | native shared-door tool |
| `chest.backup.run` | Run an installation export or a scheduled backup now | CHEST-12, RECOVER-002 | security | undeclared: independent backup runner continuation |
| `chest.backup.restore` | Restore from an export or backup, previewing what it replaces | CHEST-12, RECOVER-002 | destructive · security | undeclared: installation restore CLI |
| `chest.decisions.record` | Assign a reviewer, request changes, or approve an exact version | CHEST-08 | standard or commitment | native exact-version review; signature separate |
| `chest.sign` | Apply the sponsor's signature where the sponsor is a signer | SIGN-001 | commitment | undeclared: native signer consent/queued completion |

**Resources.** `chest://item/{id}`, `chest://item/{id}/version/{n}`, `chest://space/{id}`, `chest://request/{id}`, `chest://link/{id}`, `chest://device/{id}`, `chest://approval/{id}`.

**Events.** Today's 16 webhook types (`file.create`, `file.upload`, `folder.create`, `item.move`, `item.rename`, `item.restore`, `item.trash`, `share.grant`, `share.remove`, `version.name`, `version.restore`, `version.upload`, `comment.add`, `comment.reply`, `comment.resolve`, `file-request.upload`), plus `link.created`, `link.revoked`, `request.submitted` (renaming today's `file-request.upload`), `approval.pending`, `approval.decided`, `review.flagged`, `policy.adopted`, `exposure.flagged`, `filing.applied` and `device.stale`.

**Prompts.** The records clerk's jobs: weekly filing review (AGENT-001, RULE-001); outside-access review (AGENT-005, SHARE-007); collect a document checklist (AGENT-004, SHARE-002); sync health check (AGENT-003, SYNC-003); storage review (QUOTA-001, ADMIN-002).

**Not tools, and why.** Every Core clause has a tool above or a reason here. Risk is never the reason: high-risk work is a tool with its class, and the company's policy decides it.

- *Device-only* (runs in the person's client; status reads through `chest.devices.list`): SYNC-001, SYNC-008, SYNC-009, SYNC-002, SYNC-011, SYNC-004, SYNC-006, SYNC-007, SYNC-013, SYNC-014, MOBILE-001, MOBILE-002, MOBILE-003, PREVIEW-003.
- *People's screens* (agents read text through `chest.search`, `chest.files.read` and `chest.ask`, and comment through `chest.comments.add`): previews (CHEST-05, PREVIEW-001, PREVIEW-002), editing sessions and the review loop (EDIT-001, EDIT-005, EDIT-007, EDIT-008, EDIT-009, EDIT-014, EDIT-002), and archives for outside recipients (BULK-002).
- *The import door* (move-in runs as Business import tasks through Base's import door, whose steps carry the same classes under the same policy; agents follow it through `chest.movein.status`): CHEST-11, MIGRATE-008, MIGRATE-012, MIGRATE-002, MIGRATE-009, MIGRATE-010, MIGRATE-011, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-007, MIGRATE-014.
- *Connectors* (separate apps under app policy; what they bring arrives as events): CONNECT-001, CONNECT-002, CONNECT-011, CONNECT-008, CONNECT-009, CONNECT-010, CONNECT-014, CONNECT-015.
- *Operation and installation, not jobs:* OPS-001, OPS-002, OPS-003, OPS-004, SCALE-001, SCALE-002, OPEN-001, OWN-001, EDIT-006.
- *Served by the surface itself:* AGENT-008 (a custom document agent is a grant on this registry).

**Limits.** Chest's capacity limits protect the installation and are documented in `/docs/agents`; they bound rate and size, never daily volume, and are not policy. The person who grants an agent may also set request, mutation and byte budgets on that grant (CONNECT-007). Business limits, such as per-day caps on outside recipients or items destroyed and the spend cap that covers `chest.ask`, are rules in the company's policy, which setup asks ("no cap" is an answer); Chest presets none of them. Today's fixed per-grant daily budgets (1,000 requests, 100 mutations, 1 GiB) stop applying unless the person granting sets them.

**Handoffs.** Run by the Business layer; sibling event names are illustrative until each sibling's surface fixes them. In: Inkwell `envelope.completed` files the signed copy (standard); Orbit `deal.won` creates a client folder (standard) and shares it with the client (external, known); Lodge `candidate.hired` or Willow `employee.created` creates an employee folder in the HR space (standard; sensitive once it holds ID documents); Pantry `bill.created` without a W-9 sends the vendor a request (external, known); Auth `person.offboarded` removes that person's outside links (standard) and revokes their devices (access, narrows). Out: `request.submitted` goes to the specialist who asked; `exposure.flagged` goes to the identity admin and the company's overview. Each handoff's actions take whatever the company's policy says for their classes.

#### SURFACE-001 — The Agent surface is Chest's tool registry

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Chest's delta on the Base agent door: the door serves exactly the tools, resource templates, event types and prompts in this section. They are generated from one action registry, which the browser, the integration API and Chest's own agents (AGENT-001 to AGENT-008) all call. `/mcp/chest` stays as an alias of `/mcp`.

**Acceptance.**
1. `tools/list` and `resources/templates/list` return exactly the names in the tool table and the resource list, in a stable order.
2. The Core clause ids in `tools/list` `_meta`, with the reasons `server/discover` serves for what is not a tool, cover every Core clause, and no reason given is risk.
3. Each tool's classes in `_meta` equal its Risk class cell.
4. For upload, move, rename, a colleague share, link revoke, version restore and trash, the browser action and the tool on the same fixture leave the same record state and the same audit event type.
5. AGENT-001's filing apply and AGENT-005's Make private appear in the audit as calls to the same tools an outside agent uses, with their classes and decisions.
6. A 2025-03-26 client on `/mcp/chest` and a 2026-07-28 client on `/mcp` list the same tools.
7. The Base harness passes on Chest's fixtures in CI under both of its policies, all autonomous and held.

#### SURFACE-002 — Find and read what the sponsor can open

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-010 · *Rules:* D-4

**Requirement.** The records clerk finds and reads through the read tools and the `chest://` resources. Reads are standard. A read that returns sensitive content (as Chest computes it above) also declares sensitive, with the data kind.

**Acceptance.**
1. `chest.search` with every SEARCH-003 filter returns the same items in the same order as the sponsor's browser search, and none outside the grant.
2. A restricted file inside a granted folder, an id outside the grant and a missing id return the same not-found result.
3. Reads as a viewer and as a manager of the same space return exactly the fields each sees in the browser.
4. `chest.access.list` answers only for items the sponsor may share, and reads as not found otherwise.
5. `chest.activity.list`, the trash view of `chest.items.list`, `chest.requests.list` and `chest.reports.get` match the sponsor's Activity, Trash, Requests and storage views on the same fixture.
6. `chest.events.list` returns the same event ids as the signed webhook for the same changes, and stops returning events about an item once the sponsor loses access to it.
7. Reading a W-9's bytes or its OCR text declares sensitive with the kind "tax ID"; reading its masked typed fields declares standard only.
8. OCR text and requester messages in results carry the untrusted marker.

#### SURFACE-003 — Original bytes follow download rights

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-011 · *Rules:* D-1

**Requirement.** `chest.files.read` returns a version's original bytes only where the sponsor could download them in the browser: current access, the ROLE-001 no-download setting, quarantine and upload protection all apply. Up to 10 MB it returns the bytes as a blob resource; larger versions return a byte link on the integration API's byte path, valid for 5 minutes, bound to the same grant and carrying no credential in its URL.

**Acceptance.**
1. Under a no-download setting the agent's byte read is refused with 403.
2. A restricted file inside a granted folder is absent from lists, and reading it is refused.
3. A quarantined original is refused with the code the browser gets.
4. A read over the grant's byte budget returns `budget_exhausted` and sends no bytes.
5. A 20 MB version returns a byte link that resumes a range read, expires after 5 minutes and works only with the same grant.
6. Access revoked mid-stream ends the stream before the next chunk.

#### SURFACE-004 — Add and organize files

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-012 · *Rules:* D-1

**Requirement.** Within the grant's folders and the sponsor's role, the records clerk uploads originals and new versions (resumable over 10 MB through TRANSFER-001's session protocol), creates folders and new files, and moves, renames and sets typed fields on one item or a selection. These are standard, because version history, trash or Undo reverses each one, unless the exposure rule makes a call external: an upload, new file or move that lands where outside people can already see. Moves and renames keep stable ids, versions, grants and links (CHEST-04).

**Acceptance.**
1. A 200 MB upload resumes after a dropped connection and produces one version with the client's SHA-256.
2. A new version on an existing file keeps its stable id and links.
3. A move into a folder outside the grant, or one where the sponsor is a viewer, is refused with the browser's error code and changes nothing.
4. Moving a 50-item selection keeps ids, versions and grants, and returns a job handle whose status tool reports completion.
5. A typed field set to a value outside its type is refused, and a valid value is searchable with SEARCH-003.
6. An over-limit upload returns `storage_limit_exceeded` naming the limit, and a malware fixture is quarantined as in the browser.
7. Moving a file into a folder shared with an outside vendor declares external with counterparty known and one recipient; the same move into an internal folder declares standard.

#### SURFACE-005 — Recovery stays standard; destruction is its own class

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-DATA-002

**Requirement.** Version restore and naming, trash and untrash, and rewinding a folder, a space or a departed user's account (RECOVER-001, ADMIN-006) keep every byte and can be undone, so they are standard, subject to the exposure rule. Emptying trash, permanently deleting from it (`chest.trash.purge`) and running an erasure (`chest.erasure.run`, ERASE-001) cannot be undone, so they are destructive, with the item count. An erasure still runs ERASE-001's own checks, such as preservation instructions, whatever the policy says. `chest.erasure.prepare` drafts an erasure and changes nothing.

**Acceptance.**
1. `chest.versions.restore` adds a new version equal to the chosen one and keeps later versions, the stable id and existing links.
2. Trash and untrash of a nested folder return the tree with identical hashes, version ids and links, and a sponsor who is a space reader is refused both.
3. `chest.rewind` previews the changed items, applies the rewind, and its Undo receipt returns the earlier state.
4. With destructive set to approval, `chest.trash.purge` saves a pending action listing every item and deletes nothing until the named approver approves.
5. With destructive set to blocked, purge and erasure return `policy_blocked` and change nothing.
6. With destructive set to autonomous, purge deletes the items, its receipt says it cannot be undone, and the audit row records the class and item count.
7. An erasure that ERASE-001 refuses for held content is refused under every policy.
8. `chest.erasure.prepare` saves a draft that changes nothing.

#### SURFACE-006 — Sharing is classified by its recipient, never by the agent

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-3

**Requirement.** `chest.share` shares with a person or group, or grants a pending access request; `chest.links.create` creates or widens a link. Chest classifies each call from the recipient. A colleague, a group or an organization link is standard. An outside address, a guest or a public link is external, with counterparty known, new or public as computed above. Arguments that stand for a person's confirmation, such as today's `confirmExternal`, are ignored (BASE-AGENT-008). POLICY-001 applies first: a share the organization's sharing policy forbids is refused before the agent policy is consulted. The integration API's `/shares` and `/links` with an agent token reach the same decision.

**Acceptance.**
1. A share with a colleague declares standard. A share with an address at a trusted domain declares external, known. One with an unknown domain declares external, new, and a public link declares external, public.
2. `confirmExternal: true` changes neither the class nor the decision.
3. With external set to approval, an outside share leaves one pending approval and no grant; after approval the retried call shares once and returns a receipt, and a second retry returns the same receipt.
4. With external new set to review, the share happens at once and appears in the review feed, and its Undo removes the grant.
5. With external set to blocked, the share returns `policy_blocked` and nothing is shared.
6. A public link under a sharing policy that forbids public links is refused before any decision or pending action.
7. Approving with the agent's own token returns 403.
8. The integration API's `/shares` and `/links` give an agent token the same class and decision as the tools.

#### SURFACE-007 — Narrowing access and repairing links

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-009

**Requirement.** Revoking a link, removing a grant or guest, and Make private only narrow access to items and leave a record that restores them, so `chest.access.narrow` is standard. Restoring a revoked link or grant widens access and is classified like a new share (SURFACE-006). The AGENT-005 repair loop uses this tool. The people who manage the item are notified.

**Acceptance.**
1. Make private on a folder with a never-expiring public link removes the link and keeps named grants, and a signed-out request is refused next.
2. The record names the link and its audience, and restoring that public link from the record declares external, public.
3. With standard set to review, a revoke runs at once and appears in the review feed.
4. Removing an expired guest notifies the item's manager and shows in activity as "<agent> for <person>".
5. With standard set to autonomous, the AGENT-005 repair loop finds and closes two over-shared links with no person involved.

#### SURFACE-008 — Collect documents in, send files out

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-MAIL-001

**Requirement.** `chest.requests.create` makes an upload-only request link, sends nothing and exposes no content, so it is standard. `chest.send` emails a request, a reminder, a transfer or a signature envelope. To colleagues it is standard; to outside addresses it is external, with counterparty and recipient count, and sensitive as well when an attached file is. Mail outcomes keep BASE-MAIL-001's separate states, and each submission raises `request.submitted` for the agent that asked.

**Acceptance.**
1. `chest.requests.create` returns a request link and sends no mail.
2. Sending that request to a vendor Chest already holds an exchange with declares external, known, one recipient; with that rule set to autonomous one email goes out and its outcome is recorded.
3. The same send with external set to approval waits, and one email goes out after approval.
4. A transfer attaching a W-9 declares external and sensitive and takes the stricter of their dispositions.
5. With a per-day cap of three outside recipients, a fourth reminder that day takes the rule that applies past the cap.
6. A vendor's upload raises `request.submitted` with the request and item URIs, and the agent reads the file through SURFACE-002.
7. The vendor's copy of the request email names "<agent> for <person>" as its sender.

#### SURFACE-009 — Devices and sync

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-006

**Requirement.** `chest.devices.list` returns each device's last contact, client version, unfinished, failed and conflicted work and the actionable reason: the sponsor's own devices, or every device in scope for an admin sponsor (SYNC-003). Pausing, resuming or retrying a queue is standard (AGENT-003), and a conflict keeps both copies. Revoking a device is access, narrowing; asking for a cache wipe adds destructive and security. Downloaded copies are never reported as erased.

**Acceptance.**
1. A staff sponsor sees only their own devices, and an admin sponsor sees every device in scope, matching the admin console.
2. A device disconnected mid-transfer shows its unfinished files and last contact.
3. Pausing and resuming one folder's queue on a device changes only that queue, and a conflicted file keeps both copies.
4. `chest.devices.revoke` declares access, narrows; under an autonomous rule the device is refused on its next contact.
5. A revoke with a wipe declares access, destructive and security and takes the strictest of their dispositions.
6. A wipe result reads "wipe requested", and never says copies downloaded earlier were erased.

#### SURFACE-010 — Administration and security settings are classified, not withheld

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001

**Requirement.** An admin sponsor's agent can do the admin work its sponsor's admin scope allows. Admin reports and CSV (ADMIN-002) and storage limits (QUOTA-001) are standard. A space with members other than the sponsor is access. Staff invitations, roles and admin roles are access, plus external when an invitation goes outside the company. The settings in `chest.settings.update`, quarantine release and backups are security, and a restore is destructive and security too. A staff sponsor's agent gets no admin tool.

**Acceptance.**
1. A scoped admin's agent exports the activity CSV for its scope only, matching the browser report row for row.
2. A staff sponsor's agent asking for an admin report is refused with the browser's error code.
3. A storage limit set below current use declares standard and lists every user or space already over it, as the console does.
4. An invitation to an outside address declares access, direction widens, and external, and with access set to approval no invitation mail goes out before approval.
5. With security set to blocked, `chest.settings.update` and `chest.quarantine.release` return `policy_blocked`; with security set to approval, an MFA change waits and applies once approved.
6. An agent making its own sponsor an admin is refused with `self_escalation`, even with access set to autonomous.
7. `chest.backup.restore` declares destructive and security and previews what it replaces before any decision.
8. `chest.spaces.create` with only the sponsor as a member declares standard; with other members it declares access, direction widens.

#### SURFACE-011 — Decisions and signatures are commitments

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** For a sponsor who is the assigned reviewer, `chest.decisions.record` assigns, requests changes (standard) or approves an exact version under CHEST-08 (commitment). For a sponsor who is a signer, `chest.sign` applies the sponsor's signature under SIGN-001 (commitment), and only after the sponsor has accepted SIGN-001's consent disclosure. An agent's decision or signature always reads "<agent> for <person>" in the version history, the signature certificate and the audit.

**Acceptance.**
1. Requesting changes declares standard and records "<agent> for <reviewer>".
2. Approving a version declares commitment; with commitment set to autonomous the approval is recorded on the exact version as "<agent> for <reviewer>".
3. With commitment set to approval the call waits; after the reviewer approves in the browser, the history shows the reviewer's decision, prepared by the agent.
4. With commitment set to blocked, approving and signing return `policy_blocked`.
5. `chest.sign` for a sponsor who is not a signer, or who has not accepted the consent disclosure, is refused with SIGN-001's code under every policy.
6. With commitment set to autonomous, a completed envelope signed by an agent shows "<agent> for <person>" on its certificate and in its audit trail.
7. An approval or signature on a document that states a value and a counterparty records both with its commitment class.

#### SURFACE-012 — Limits and Pause agents

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-004, BASE-AGENT-011

**Requirement.** The company's policy can cap what `chest.ask` spends. SECURITY-004's mass-activity rules count agent tokens like any token and can pause them. **Pause agents** lives in Connected apps, and while it holds, browser sessions and sync clients keep working.

**Acceptance.**
1. The consent screen and `/docs/agents` show Chest's capacity limits and the grant's budgets.
2. A grant with a mutation budget of 0 is refused with 429 and creates nothing.
3. A token that crosses a download threshold with pause on is refused with 423 on its next call, metadata included, while the sponsor's browser session keeps working, and resuming restores it.
4. Under the company's answer "no cap", `chest.ask` runs and its spend shows; at a set cap it returns `budget_exhausted` with no partial answer and shows the spend.
5. Connected apps shows calls, decisions by class and spend per agent.
6. A grant whose granter set no budget files 500 arrivals in one day, paced within the documented rate limit, with none refused.

#### SURFACE-013 — The records clerk journey under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-013 · *Register:* R-25

**Requirement.** `prompts/list` offers the records clerk's five jobs, each naming its clauses. A stranger agent proves the surface end to end through MCP alone. It runs the same seeded week under two company policies set in Chest's Agents settings, and each step goes as the policy in force says. Policy A: every class autonomous (`*`). Policy B: standard autonomous; sensitive review; external approval by the sponsor; access, security, destructive and commitment blocked.

**Acceptance.** Given only the Chest URL and a staff sponsor's consent:
1. Before setup is answered, the agent's first call returns `policy_unset` with the setup link, and the setup page lists Chest's classes with examples and no answer pre-selected; once policy A is confirmed, the same call runs.
2. The agent connects through standard OAuth discovery with no Chest-specific setup, and `prompts/list` returns the five jobs.
3. Under policy A, it files a week of seeded arrivals (W-9s, invoices, a contract) into the right folders with typed fields, closes two over-shared links, sends a W-9 request to a known vendor, files the vendor's upload on `request.submitted` and shares the signed contract with outside counsel (a new counterparty), with no person involved.
4. Under policy A no step waits or is refused, the review feed stays empty, and the audit records each outside step with its class and counterparty.
5. Under policy B the same week needs exactly two approvals, the vendor request and the counsel share, and the review feed holds exactly the W-9 reads.
6. Under policy B with external set to blocked, both outside steps return `policy_blocked` and every other step completes.
7. Undo works on one filing under each policy.
8. Activity shows every step as "<agent> for <person>" at 1440 and 390, and the audit counts zero calls whose decision differs from the policy revision in force.

## Push further

### Agents that maintain the file system

#### AGENT-001 — File and classify what arrives

*Tier:* Core · *Rules:* D-4

**Requirement.** An agent reads granted contents, OCR text, mail and app provenance and project metadata to propose a taxonomy, identify responsible people and file arrivals, explaining each suggestion with exact-version evidence and uncertainty. A reversible rename, tag or move is standard, new outside access is external and destructive cleanup is destructive; the company's policy decides each, and the owner's folder filing grant is how Chest records that choice today. An uncertain classification carries its evidence and stated uncertainty, and the same policy decides whether it is filed or held. Each filing shows a notice to people who can see the file, naming file and new path (for example "Filed W-9 Acme Supply.pdf → Vendors / Acme / Tax"), with **Undo**, which returns the file with the same stable ID, versions and grants. The activity view counts this week's filings and lists each with evidence and Undo.

**Acceptance.**
1. With a project inbox of ambiguous and malicious-instruction documents and no folder filing grant, the cited plan is previewed and a person allows one scoped move and rejects another.
2. With access revoked before execution, originals stay and the denied action is not attempted, with no extra reads or messages.
3. With the owner's folder filing grant in force, a W-9 that arrived by email is filed with a notice naming its path; Undo returns it with the same ID and versions, and the week's count lists it as undone.

#### AGENT-002 — Reconcile duplicates and superseded versions

*Tier:* Core

**Requirement.** An agent correlates hashes, source IDs, content changes, version history and approvals to find exact and near duplicates and stale copies, propose canonical files and repair authorized internal references. Equal bytes never imply equal access or identity. Merges, overwrites and internal reference repairs are standard, because consolidation is reversible and keeps originals, old-version references and separate source approvals; repointing an outside link is external and deletion is destructive. The company's policy decides each.

**Acceptance.**
1. Duplicate bytes under different ACLs and a near-duplicate with a different signature date produce a proposed lineage with references.
2. A canonical-link change that goes ahead and a merge that is turned down leave no access union, lost original or reassigned approval.

#### AGENT-003 — Repair sync and verify bytes

*Tier:* Core

**Requirement.** An agent correlates device queues, hashes, conflict copies, cache health and permission changes to diagnose incomplete files and repair explicitly granted device and folder settings. It compares both ends before declaring recovery and quarantines uncertain conflicts with both copies kept. An overwrite or cache deletion is destructive and a permission expansion is access; the company's policy decides each.

**Acceptance.** With a real file-backed companion:
1. An interrupted transfer, a divergent offline copy and a revoked folder grant are explained.
2. A permitted paused queue is repaired with final hashes proven on both ends, while conflicted work stays quarantined with both copies and denied work is not attempted.

#### AGENT-004 — Finish collection and prove the right version arrived

*Tier:* Core

**Requirement.** For an owner-defined checklist, the agent matches request submissions, approvals, transfer receipts and explicit confirmations to exact requirements and versions, finds missing or superseded evidence, drafts or sends reminders to the checklist's recipients at its cadence, and stops when the right material is accepted. A reminder to an outside address is external and approving evidence is a commitment; the company's policy decides each. A later replacement or permission change reopens the mismatch; views and provider receipts never prove the intended person has the right version.

**Acceptance.**
1. Two vendor records, a stale file and then the approved replacement are reconciled, the intended recipient confirms, and reminders stop.
2. A later revocation or superseding version reopens the issue with a proposed new delivery to the checklist's recipients only, and binding or delivering the new evidence does not approve it.

#### AGENT-005 — Repair broken and over-shared links

*Tier:* Core

**Requirement.** An agent checks current ACLs, guest lifecycle, link policies, intended collaborators and actual link outcomes to find broken, orphaned, stale or excessive shares, proposes exact version and audience repairs, and explains who is affected. New or wider access and outside messages are external, and a restrictive revocation is standard because it keeps a reversible record and sends a notice; the company's policy decides each. Each flagged item names the link or grant and its audience and offers **Make private**, which removes the broad link or audience and keeps named grants. It never rewrites a vendor-owned URL.

**Acceptance.**
1. A restricted agent scans an expired link, a departed guest, an overshared subfolder and an inaccessible approved replacement, leaving unrelated files unread.
2. One repair and one restrictive revoke go ahead and a repair a person declines changes nothing, with destination access and the intended version confirmed; the repair door widens access for no caller, the owner included, because widening is sharing (SHARE-001).
3. On a public link to a folder two staff use, one Make private click removes the link, the staff keep access, and a signed-out browser is refused next.

#### AGENT-006 — Build and validate a move-in

*Tier:* Core

**Requirement.** An agent builds source-to-Chest identity, folder, version and link mappings from authorized incumbent inventories, reconciles every item, hash and gap, and drafts a cutover plan with collaborator journeys. Its read-only sampling and reversible staging are standard. Accepting the permission mapping, conversion losses, delta boundary and cutover is a commitment, decided by the company's policy and recorded as the person's own act or as "<agent> for <person>". It keeps source read access and the rollback archive until the move is accepted.

**Acceptance.** Against an incumbent fake with unavailable history, unmapped groups and native files:
1. The generated mapping and unresolved gaps are inspected, and an unsafe mapping is rejected.
2. Staging validates staff and guest open, edit and share journeys before cutover is accepted, and rollback works.

#### AGENT-007 — Cited questions and field jobs

*Tier:* Core · *Cites:* BASE-DATA-004 · *Rules:* D-4

**Requirement.** Users ask questions and run bounded field-extraction jobs over expressly granted folders and versions. Answers cite accessible original passages and extraction provenance, separate missing and uncertain evidence, and keep the model, tool and data policy used. The owner activates the reader policy (the provider and its verified retention and residency terms), bound to the current reader. In the browser, the person asking sees and confirms the exact disclosure and quote-based budget before each send; original-text access is checked before dispatch and again on return; questions and answers stay transient, and only content-free policy, version and usage receipts are kept. A restricted file skipped as evidence is noted without revealing that it exists. Provider spend counts against the company's spend cap.

**Acceptance.**
1. A cross-file question with a contradictory revision and an inaccessible answer-bearing file returns exact citations and stated uncertainty.
2. A schema extraction runs within a small confirmed budget.
3. Access changed mid-run and injected document instructions are refused, and a provider failure shows its cost without a fabricated answer.

#### AGENT-008 — Custom document agents with tools

*Tier:* Core · *From:* AGENT-007 · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-008

**Requirement.** Owners define bounded custom document agents over granted folders. Their calls go through the Agent surface's tools and obey current ACLs: an approval or signature is a commitment, a delete is destructive and widening access is external or access, and the company's policy decides each.

**Acceptance.**
1. A custom agent's tool calls succeed inside its grant and are refused outside it.
2. Calls to approve, sign, delete or widen access carry their classes, are refused under a policy that blocks those classes, and are never recorded as a person's own act.

#### AGENT-009 — Ask panels on file and folder pages

*Tier:* Later · *From:* AGENT-007

**Requirement.** As Gemini in Drive offers, an **Ask** panel on every file and folder page, in the browser and the apps, summarizes or answers a question about it using only files the asker can open, cites them, and lists files a folder summary skipped with the reason (no access, unreadable, not yet extracted).

**Acceptance.**
1. A folder summary at 1440 and 390 cites only openable files and lists skipped files with reasons.
2. A question from a PDF's page cites its pages.
3. Both repeat in the iOS and Android apps.

## Field proof register

Proof Chest cannot produce in its own repository. Each row is visible on the /contract page, never blocks done, and reads "not run" until a dated receipt is recorded here.

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Reference installation: 10 TB of originals and history, 150 active users and 300 native synced devices, timed from a US region on 100 Mbps | SCALE-001 | not run | | |
| R-2 | Each buyer's inventory plus 25% headroom, rerun at that install | SCALE-001, MIGRATE-001 | not run | | |
| R-3 | One 5 TB file uploaded through the public API to R2 and verified | TRANSFER-002 | not run | | |
| R-4 | Apple Developer ID notarization and Authenticode signing receipts | SYNC-009 | not run | | |
| R-5 | Silent desktop install and mobile managed configuration through Jamf and Intune | SYNC-009, SYNC-014, MOBILE-003 | not run | | |
| R-6 | App Store and Google Play listings | MOBILE-003 | not run | | |
| R-7 | Journeys on a physical iPhone, iPad and Android phone | MOBILE-001, MOBILE-003 | not run | | |
| R-8 | Round trips and the presence add-in in licensed desktop Word, Excel and PowerPoint on Windows and macOS | EDIT-005, EDIT-004, SYNC-007, SYNC-014 | not run | | |
| R-9 | Save and lock round trips in Final Cut Pro, Photoshop and AutoCAD | SYNC-004 | not run | | |
| R-10 | Microsoft partner approval for WOPI and a live tenant co-editing run | EDIT-014 | not run | | |
| R-11 | A Collabora Online subscription install with its licensed limits verified live | EDIT-006, ADMIN-005 | not run | | |
| R-12 | Google OAuth verification for the needed scopes and a live Workspace tenant run | EDIT-002, MIGRATE-002, CONNECT-011, CONNECT-008, CONNECT-010 | not run | | |
| R-13 | Live Microsoft 365 tenant runs | MIGRATE-005, CONNECT-002, CONNECT-011, CONNECT-008 | not run | | |
| R-14 | Live Dropbox Business team migration | MIGRATE-003 | not run | | |
| R-15 | Live Box enterprise migration | MIGRATE-004 | not run | | |
| R-16 | Live Egnyte and LucidLink migrations | MIGRATE-013 | not run | | |
| R-17 | Okta, Microsoft Entra ID and Google Workspace tenant runs | ADMIN-001 | not run | | |
| R-18 | Slack App Directory, Teams store, Google Workspace Marketplace, Microsoft AppSource, Zapier and Make public listings | CONNECT-001, CONNECT-002, CONNECT-008, CONNECT-009, CONNECT-010 | not run | | |
| R-19 | Live Salesforce, HubSpot and Zoom accounts | CONNECT-003, CONNECT-005 | not run | | |
| R-20 | A measured 30-day month of availability at a deployed install | OPS-002 | not run | | |
| R-21 | A VPAT and a human screen-reader pass (VoiceOver, NVDA) | OPS-001 | not run | | |
| R-22 | A provider-confirmed legal hold (S3 Object Lock or Purview) | GOVERN-001 | not run | | |
| R-23 | A BAA or regulated-data provider agreement, where a buyer needs one | GOVERN-001 | not run | | |
| R-24 | A Play-enabled Chromebook run | MOBILE-004 | not run | | |
| R-25 | The records clerk journey under both company policies (SURFACE-013) from stock Claude, ChatGPT, Codex and Copilot MCP clients, with the approvals that policy B asks for completed through URL elicitation | SURFACE-013 | not run | | |

## Boundaries

- Chest is responsible for the whole file-system job: native clients, sync, external exchange, search, integration experience and recovery. Native filesystem drivers run in maintained signed macOS and Windows clients; heavy OCR, rendering, media conversion, malware scanning and the shipped Collabora Online editor run as separately deployed bounded services. Worker limits are an engineering boundary, not a reason to omit a capability, and store distribution, entitlements, app registrations, scopes, licensing, agreements and real-account acceptance are delivery work inside the named clauses.
- Chest integrates the Collabora Online, Microsoft 365 and Google Workspace editing engines rather than building another office suite, and ships Collabora Online as its default editor so co-authoring needs no Microsoft or Google licence. CAD, video and design creation stay in Adobe Creative Cloud, AutoCAD and Final Cut Pro, supported through SYNC-004.
- Salesforce and HubSpot own CRM; Slack, Teams and Google Chat own chat; Zoom and Google Meet own meetings; Google Calendar and Outlook own scheduling. Chest is the file store behind each: their recordings, attachments and shared files land in and link to Chest, which keeps their files, pointers, version provenance and custody synchronized. Other vendors' "attach from Google Drive" pickers belong to those vendors: Chest offers them the CONNECT-012 picker and API, the CONNECT-009 automation apps and the SYNC-001 mount, and claims no picker inside a product until that vendor ships one. Chest does not merge those products or absorb unassigned categories.
- Chest executes everyday ESIGN and UETA signatures itself (SIGN-001), as Google Workspace does; Docusign stays an integration for firms that standardize on it and for remote online notarization and EU qualified signatures (CONNECT-004). No source check alone proves legal sufficiency, certification, hosted delivery, human receipt or vendor migration fidelity.
- Legal hold, certified regulated custody and discovery need a qualified provider and verified policy under GOVERN-001, never a marketing claim about generic object storage. A BAA or regulated-data provider agreement a buyer needs is acceptance work before that workload is enabled (R-23), never a reason to remove the capability.
- Chest does not replace payroll (the sibling seed Envelope), tax, accounting or payment products; it stores their files and integrates authorized sources.
- Sync is never the only backup, and trash is never a substitute for erasure or a legal hold.

## Homepage claims

The owner-approved page-s1 homepage (the hero, then one supplier's folder from the move-in on Sat, Sep 26 to the renewal, then the closing; `src/site/landing/`) maps every capability claim to the clauses that promise it. The page's one limit ("Not in Chest yet.") states what the contract leaves out and is not a claim.

| # | Section | Claim | Clauses |
| --- | --- | --- | --- |
| 1 | Hero | "Chest stores … your team's files" | SPACE-001, CHEST-03 |
| 2 | Hero | "syncs" | SYNC-001, SYNC-008, SYNC-002 |
| 3 | Hero | "shares your team's files" | SHARE-004, SHARE-001, CHEST-10 |
| 4 | Hero | "reads every scan" | SEARCH-001 |
| 5 | Hero | "quietly files what arrives" | AGENT-001, RULE-001, CONNECT-006 |
| 6 | Hero | "100% free, open source" | OPEN-001 |
| 7 | Hero | "alternative to Google Drive, Dropbox and Box" | SPACE-001, SYNC-008, SHARE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004 |
| 8 | Hero collage | Contract co-edited by Dana and Luis | EDIT-005 |
| 9 | Hero collage | Receipt 2026-10-09.jpg "Uploading 62%" | TRANSFER-001, MOBILE-001 |
| 10 | Hero collage | Share link "expires Oct 31 · 3 of 10 downloads" | SHARE-007 |
| 11 | Hero collage | Version stack v7 (approved), v6, v5 | CHEST-07, VERSION-001 |
| 12 | Hero collage | Scanned NDA with its date, party and amount boxed | SEARCH-002 |
| 13 | Hero collage | "Filed W-9 Acme Supply.pdf → Vendors / Acme Supply / Tax · Undo" | AGENT-001, RULE-001 |
| 14 | Move in | "Move from Dropbox, Google Drive or Box. Folders, permissions, versions and shared links come across." (import ledger: 48,212 files, 3,906 folders, 1,104 permissions kept, 61,870 versions) | MIGRATE-001, MIGRATE-008, MIGRATE-002, MIGRATE-003, MIGRATE-004 |
| 15 | Move in | Import ledger "Links inside files · 312 rewritten" | MIGRATE-007 |
| 16 | Move in | "7 file names too long for Windows" · "Renamed and retried · 7 of 7 imported" | MIGRATE-001 |
| 17 | Move in | Terminal: `rer setup` · "Chest is ready" | OWN-001 |
| 18 | Follow one folder | The company drive: My files, Shared with me, Recent, team spaces Finance, Ops, Sales, Vendors | SPACE-001, SHARE-004 |
| 19 | Follow one folder | Role chips "Dana · manager", "Luis · contributor", "Priya · guest"; "Shared with 4 people" | ROLE-001, SHARE-005 |
| 20 | Files that file themselves | "The Chest agent reads what arrives by email and from apps, names it, files it" (NDA.pdf from legal@acme.example, insurance certificate, Invoice-0042, scan_0931.pdf renamed W-9 Acme Supply.pdf; each with Undo) | AGENT-001, CONNECT-006, SEARCH-002 |
| 21 | Files that file themselves | Insurance certificate "expires Sep 30, 2027 · reminder set" | CHEST-09 |
| 22 | Files that file themselves | "and closes links shared too widely" (Rate card.xlsx public link "limited to the Acme team", Undo) | AGENT-005 |
| 23 | On every desk and phone | "Files open on demand on Mac and Windows" (Finder with Chest, on-demand and downloaded states, "Free up space") | SYNC-008 |
| 24 | On every desk and phone | "photos upload from the phone" ("45 of 48 uploaded · 3 waiting for Wi-Fi") | MOBILE-001, TRANSFER-001 |
| 25 | On every desk and phone | "edits made offline come home safely" ("Conflict: Dana changed it too" · "Kept both · Luis chose v5") | SYNC-002 |
| 26 | Open it and edit together | "Word, Excel and PowerPoint files open in the browser" | PREVIEW-001, EDIT-005 |
| 27 | Open it and edit together | "Edit at the same time, comment" (Pricing.xlsx with Dana and Luis, a resolved thread, "Saved · 2 people editing") | EDIT-005, EDIT-003 |
| 28 | Open it and edit together | "and keep one copy" | EDIT-005 |
| 29 | Share out. Collect in. | "Send a link with a password and an expiry" (Contract pack: password on, expires Oct 31, 3 of 10 downloads, opened by priya@acme.example, Revoke) | SHARE-001, SHARE-007 |
| 30 | Share out. Collect in. | "and ask for files back without an account" (file request to Vendors / Acme Supply / Onboarding, 2 of 2 received) | SHARE-002 |
| 31 | Share out. Collect in. | Site survey.mp4 · 4.2 GB: "Connection dropped at 61%" · "Resumed where it stopped" | TRANSFER-001, TRANSFER-002 |
| 32 | Every version, kept. | "Restore any earlier version in one click." (Restore v7; "v7 is current again · v8 kept in history") | VERSION-001 |
| 33 | Every version, kept. | "A sign-off stays with the exact version that was approved." (v7 signed off by Dana and Priya; v8 not approved) | CHEST-07, CHEST-08 |
| 34 | The right version reached everyone. | "The agent checks that everyone has the signed version" (v7 reached Dana, Luis, Priya, accounts@acme.example and the warehouse; the warehouse sent v7) | AGENT-004 |
| 35 | The right version reached everyone. | "and that nothing is left open" (2 links open to a former contractor revoked; broken link in Ops handbook.docx points to v7; 63 files · 0 public links) | AGENT-005 |
| 36 | The right version reached everyone. | "3 invoices filed · 0 duplicates" | AGENT-002 |
| 37 | Find the sentence inside the file. | "Chest reads every document and scan, so search finds the words inside" ("net 30 acme": 3 results) | SEARCH-001 |
| 38 | Find the sentence inside the file. | "and only shows what you are allowed to see" | CHEST-06 |
| 39 | Closing | "Open source file storage for your whole team." | OPEN-001, SPACE-001 |
| 40 | Closing | "Free and open source, MIT licensed." | OPEN-001 |

## Retired clauses

| ID | Now | Reason |
| --- | --- | --- |
| CHEST-14 | merged into SPACE-001 | A 0.2.0 release-gate snapshot of team spaces, nested folders and phone uploads; it restated SPACE-001, whose acceptance now carries its journey. |
| CHEST-15 | merged into TRANSFER-001 | A 0.2.0 release-gate snapshot of resumable large uploads; it restated TRANSFER-001, whose acceptance now carries its journey. |
| CHEST-16 | merged into VERSION-001 | A 0.2.0 release-gate snapshot of restoring an earlier version; it restated VERSION-001, whose acceptance now carries its journey. |
| CHEST-17 | merged into RECOVER-001 | A 0.2.0 release-gate snapshot of restoring a folder to a date and undoing it; it restated RECOVER-001, whose acceptance now carries its journey. |
| CHEST-18 | merged into SHARE-001 | A 0.2.0 release-gate snapshot of password, expiry and download-limit links and revoke; it restated SHARE-001, whose acceptance now carries its journey. |
| CHEST-19 | merged into SHARE-007 | A 0.2.0 release-gate snapshot of Shared too widely and Make private; it restated SHARE-007, whose acceptance now carries its journey. |
| CHEST-20 | merged into SHARE-002 | A 0.2.0 release-gate snapshot of file requests from anyone; it restated SHARE-002, whose acceptance now carries its journey. |
| CHEST-21 | merged into SEARCH-001 | A 0.2.0 release-gate snapshot of permission-safe PDF text search; it restated SEARCH-001, whose acceptance now carries its journey. |
| CHEST-22 | merged into ROLE-001 | A 0.2.0 release-gate snapshot of read-and-download-only space viewers; it restated ROLE-001, whose acceptance now carries its journey. |
| CHEST-23 | merged into OWN-001 | A 0.2.0 release-gate snapshot of hosted Chest on the owner's Cloudflare account with email sign-in, backup, restore and removal; it restated OWN-001, whose acceptance now carries its journey. |
| CHEST-24 | merged into RECOVER-002 | A 0.2.0 release-gate snapshot of upgrading from 0.1.0 with every record and original kept; it restated RECOVER-002, whose acceptance now carries its journey. |

## Status

Judged from the code and tests at commit `9e923814f40e83242ce8b8e8c6cc73fcae7a8ab7` (21 October 2026).

EDIT-003 runtime source is judged from commit 084c67e0dc9e5ba79703b5acad7e84d3fbfbf114 (28 October 2026). Its final candidate strengthens the preview-authority journey and records the exact candidate in Verify; the runtime bytes are unchanged from that source commit.

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 9 | 4 | 0 | 13 |
| Target and push further | 22 | 82 | 53 | 157 |
| All | 31 | 86 | 53 | 170 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `CHEST-01` | Owner claim and staff identity | published | done | `tests/chest/flows.mjs`; `tests/chest/journey.mjs` |  |
| `CHEST-02` | Typed filing without lost values | published | done | `tests/chest/flows.mjs` |  |
| `CHEST-03` | Validate before publishing originals | published | partial | `tests/chest/flows.mjs` | Point 1 passes, and point 2's bad checksum and bad filing values are asserted to create no visible record (`tests/chest/flows.mjs`); no test submits a mismatched size, so the size refusal is not asserted. |
| `CHEST-04` | Accountable filing and safe moves | published | done | `tests/chest/flows.mjs` |  |
| `CHEST-05` | Safe basic previews | published | done | `tests/chest/flows.mjs`; `tests/chest/browser-flow.mjs` |  |
| `CHEST-06` | Current access governs every private door | published | done | `tests/chest/flows.mjs`; `tests/chest/browser-flow.mjs` |  |
| `CHEST-07` | Immutable versions and exact approved pointers | published | done | `tests/chest/flows.mjs`; `tests/chest/journey.mjs` |  |
| `CHEST-08` | Exact-version human decisions | published | done | `tests/chest/flows.mjs`; `tests/chest/journey.mjs` |  |
| `CHEST-09` | Review and expiry work keep evidence | published | partial | `tests/chest/flows.mjs`; `tests/chest/browser-flow.mjs` | Point 2 passes, and point 1's completion record and expiry date are asserted (`tests/chest/flows.mjs`), with the review work item selected on the document page (`tests/chest/browser-flow.mjs`); no test reads the work list, so both dates appearing there is not asserted. |
| `CHEST-10` | People and group grants | published | partial | `tests/chest/flows.mjs`; `tests/chest/restore.mjs` | After the member is removed and collection access revoked, details, search and review mutations are asserted refused, and readers are listed for a person grant (`tests/chest/flows.mjs`); the group grant's effective readers are never listed, and no preview or download is attempted after the revoke. |
| `CHEST-11` | Reviewed, reversible archive admission | published | partial | `tests/chest/flows.mjs`; `tests/chest/journey.mjs` | Point 1 passes, and point 2's undo of untouched records after a restart and the kept native edit are asserted (`tests/chest/flows.mjs`); the apply completes before the restart, so an interrupted apply resuming after a restart is not asserted. |
| `CHEST-12` | Complete independent local export and restore | published | done | `tests/chest/restore.mjs`; `tests/chest/journey.mjs` |  |
| `CHEST-13` | Self-service reversible trash | published | done | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` |  |
| `SPACE-001` | Team spaces, personal areas and ordinary files | target | partial | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `tests/chest/ownership.mjs`; `tests/chest/governance.mjs`; `tests/chest/browser-governance.mjs` | Fresh-judge candidate: the old gap named only the EDIT-004 provider experience and the SCALE-001 run, both now in their own clauses. |
| `SPACE-003` | Hand ownership of one file to a colleague | target | partial | `tests/chest/ownership.mjs`; `tests/chest/browser-ownership.mjs` | Fresh-judge candidate: the old gap lists ownership offers with acceptance, decline, cancel and notices as delivered. |
| `SPACE-002` | Who creates spaces, and new-space defaults | target | done | `tests/chest/space-policy.mjs`; `tests/chest/browser-space-policy.mjs` |  |
| `ROLE-001` | Five-level roles and delegated sharing | target | partial | `tests/chest/role-review-flow.mjs`; `tests/chest/role-browser-matrix.mjs`; `tests/chest/restriction-flow.mjs`; `tests/chest/annotation-flow.mjs`; `tests/chest/wopi-flow.mjs`; `tests/chest/collabora-live.mjs`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` | Points 1 to 4 pass. Point 5's **Request access** without the name, and the viewer's lack of upload and new-folder rights (no contribute right, folder creation 403), are asserted (`tests/chest/files.mjs`, `tests/chest/browser-files.mjs`); a viewer's rename returning 403, People & settings returning 403, and the absence of the share, rename and trash actions for a viewer are not. |
| `VERSION-001` | Version history and restore by editors | target | done | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `tests/chest/office-restore-flow.mjs`; `tests/chest/wopi-flow.mjs`; `tests/chest/signatures.mjs` |  |
| `TRANSFER-001` | Resumable uploads in the browser and API | target | partial | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `tests/chest/upload-resume-flow.mjs` | Case-collision and path-length errors are not named in the evidence; the old gap listed only name-taken, too-large and no-access refusals. |
| `TRANSFER-002` | Whole folders and large originals | target | missing |  | Whole-folder upload, files above 4 GB and the 5 TB limit do not exist. The 5 TB upload itself is register row R-3. |
| `BULK-001` | Multi-select actions and ZIP downloads in the browser | target | partial | `tests/chest/bulk.mjs`; `tests/chest/browser-bulk.mjs`; `docs/bulk.md` | After a restart a job finishes only on explicit continuation (the old gap's "autonomous server-side execution"); unbounded trees remain. |
| `BULK-002` | Archives for guests and request recipients | target | missing |  | Guest and request-recipient archive grants and the 6 GB guest run do not exist. |
| `SYNC-001` | Sync protocol for clients | target | partial | `tests/chest/files.mjs`; `tests/chest/scale-sync.mjs` | Fresh-judge candidate: the old gap says this protocol exists; only the native clients (SYNC-008) were missing. |
| `SYNC-008` | macOS and Windows clients | target | missing |  | No native client exists. |
| `SYNC-009` | Supported platforms and managed install | target | missing |  | No client exists. Notarization and Authenticode receipts are R-4; Jamf and Intune runs are R-5. |
| `SYNC-010` | Windows 10 22H2 | target | missing |  | No client exists. |
| `SYNC-002` | Offline edits and lossless conflicts | target | partial | `tests/chest/files.mjs` | The server side keeps the remote version current and files the client bytes as a named conflict; the client offline queue, mode switch and private recovery copy do not exist. |
| `SYNC-003` | Sync status and device control | target | partial | `tests/chest/files.mjs` | The device list, last contact, revoke and deactivation exist; client states and wipe do not. |
| `SYNC-011` | Storage-limit refusals in the client | target | missing |  | No native client exists. |
| `SYNC-012` | Proxy and bandwidth settings | target | missing |  | No client exists. |
| `SYNC-004` | Streamed creative assets and safe locks | target | missing |  | No delivered workflow. Final Cut Pro, Photoshop and AutoCAD runs are R-9. |
| `SYNC-005` | Hybrid local cache and storage | target | missing |  | No delivered workflow. |
| `SYNC-006` | Computer folder backup | target | missing |  | No delivered workflow. |
| `SYNC-007` | Office presence and newer-version alerts | target | missing |  | No delivered workflow. Runs in licensed desktop Office are R-8. |
| `SYNC-013` | Office edit locks and policy | target | missing |  | No delivered workflow. |
| `SYNC-014` | Perpetual Office versions | target | missing |  | No delivered workflow (R-5, R-8). |
| `MOBILE-001` | iOS and Android apps for everyday files | target | missing |  | No native app exists; phone-width browser upload is SPACE-001. Physical devices are R-7. |
| `MOBILE-002` | Offline files and device protection on phones | target | missing |  | No native app exists. |
| `MOBILE-003` | Mobile platforms and distribution | target | missing |  | No native app exists. Store listings are R-6, managed configuration R-5, physical devices R-7. |
| `MOBILE-004` | Chromebooks through the Android app | target | missing |  | No native app exists (R-24). |
| `SHARE-001` | External links with password, expiry, versions and limits | target | done | `tests/chest/guest-links.mjs`; `tests/chest/link-versions.mjs`; `tests/chest/files.mjs`; `tests/chest/browser-links.mjs`; `tests/chest/browser-guest-links.mjs`; `tests/chest/link-discussions.mjs` |  |
| `SHARE-006` | Organization links and discovery | target | done | `tests/chest/organization-link-controls-flow.mjs`; `tests/chest/link-policy.mjs`; `tests/chest/browser-links.mjs` |  |
| `SHARE-007` | Link list, Shared too widely and one-click revoke | target | done | `tests/chest/organization-link-controls-flow.mjs`; `tests/chest/browser-links.mjs`; `tests/chest/files.mjs` |  |
| `SHARE-002` | Upload-only file requests | target | done | `tests/chest/file-requests.mjs`; `tests/chest/browser-file-requests.mjs`; `tests/chest/request-browser-flow.mjs`; `tests/chest/files.mjs` |  |
| `SHARE-003` | Large-file transfers and delivery receipts | target | done | `tests/chest/transfers.mjs`; `tests/chest/transfer-large-flow.mjs`; `tests/chest/browser-transfers.mjs`; `docs/deliveries.md` |  |
| `SHARE-004` | Item sharing and Shared with me | target | partial | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` | Point 1 passes (`tests/chest/files.mjs`, `tests/chest/browser-files.mjs`); no test asserts the share's audit row (point 2). |
| `SHARE-008` | Access requests | target | partial | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` | Points 1 and 2 pass, and point 3's routing to a deactivated owner's successor is asserted (`tests/chest/files.mjs`); a file whose deactivated owner has no successor is never routed to a space manager. |
| `SHARE-009` | Expiring grants | target | done | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` |  |
| `SHARE-005` | Guests: sign-in, scope and expiry | target | partial | `tests/chest/guest-editing-flow.mjs`; `tests/chest/guest-links.mjs`; `tests/chest/wopi-flow.mjs`; `docs/guest-collaboration.md` | Guest sign-in with a verified Google or Microsoft identity is not in the evidence, which covers PIN sign-in only. |
| `SHARE-010` | Guests edit, upload and manage versions | target | partial | `tests/chest/guest-editing-flow.mjs`; `tests/chest/wopi-flow.mjs`; `tests/chest/collabora-live.mjs` | Resumable guest uploads above the 8 MB direct-form limit are unproved. Native guest collaboration in the apps and desktop clients (MOBILE-001, SYNC-008) remains. |
| `POLICY-001` | Organization sharing policy | target | partial | `tests/chest/link-policy.mjs`; `tests/chest/browser-links.mjs`; `tests/chest/browser-sharing-policy.mjs` | Fresh-judge candidate: the old gap named only the connector doors, which now carry their own policy point (CONNECT-001, -002, -008, -009, -010). |
| `POLICY-002` | Default link audience and discovery | target | partial | `tests/chest/link-policy.mjs`; `tests/chest/browser-sharing-policy.mjs` | Fresh-judge candidate: the old gap lists new-link defaults and discovery as delivered. |
| `PREVIEW-001` | Previews for everyday formats | target | partial | `tests/chest/office.mjs`; `tests/chest/browser-preview.mjs`; `tests/chest/archive-preview.mjs`; `tests/chest/browser-files.mjs`; `docs/office.md` | DOCX, XLSX and PPTX previews and bounded ZIP directory listings exist; advanced Office layouts, themes and charts, Google formats, iWork, EML/MSG, the rest of the image, audio and video matrix, seek, full-matrix page and thumbnail checks and processor-outage acceptance remain. |
| `PREVIEW-002` | Previews for creative and CAD formats | target | partial | `tests/chest/browser-preview.mjs` | The evidence names no RAW, ProRes, design or CAD renderer ("video and design rendering remain incomplete"). |
| `SEARCH-001` | Text and scans become searchable | target | partial | `tests/chest/reading.mjs`; `tests/chest/files.mjs`; `tests/chest/search.mjs`; `tests/chest/browser-search.mjs`; `tests/chest/scan-fields.mjs` | Legacy Office, iWork, Google export and EML/MSG extraction are missing, and native RTF displayed text is delivered; all other non-RTF matrix acceptance remains unproved, and OCR is unavailable on RER Managed until an egress relay exists. |
| `SEARCH-003` | Search filters | target | partial | `tests/chest/search.mjs`; `tests/chest/browser-search.mjs` | Fresh-judge candidate: the old gap's remaining filter work was the native apps, now PREVIEW-003. |
| `SEARCH-004` | Audio and video transcripts | target | missing |  | No delivered workflow. |
| `SEARCH-002` | Typed fields read from scans | target | partial | `tests/chest/reading.mjs`; `tests/chest/scan-fields.mjs`; `tests/chest/browser-scan-fields.mjs`; `tests/chest/ask-live.mjs`; `tests/chest/governance.mjs` | Readings that fill typed fields without an editor, where the company's policy allows it, are not built: today every reading waits for an editor, which is the held-policy journey. RL-103's rider on human confirmation goes back to ct under the contract standard's Agent surface rule. Uncommon TIFF encodings and age-based expiry stay unavailable, and the native scan panel is PREVIEW-003. |
| `EDIT-001` | The shipped independent editor | target | partial | `services/collabora/compose.yaml`; `tests/chest/collabora-live.mjs` | Installer and default-provider packaging remain; the live runs use a configured CODE service. |
| `EDIT-005` | Co-authoring sessions | target | partial | `tests/chest/collabora-live.mjs`; `tests/chest/wopi-flow.mjs`; `tests/chest/office.mjs`; `docs/office.md` | DOCX co-editing by staff and a verified guest is proven with real CODE; XLSX and PPTX co-authoring and the formula and presentation round trips remain. Licensed desktop Office round trips are R-8. |
| `EDIT-006` | Editor capacity and cost | target | partial | `tests/chest/administration-accounting-flow.mjs` | Fresh-judge candidate: ADMIN-002's evidence shows confirmed edition, price, atomic document and connection reservations and refusal reports implemented, but EDIT-001 never judged this part. Trusted licensed limits are R-11. |
| `EDIT-002` | Google-format files without hidden loss | target | missing |  | No delivered workflow. Google verification and a live tenant are R-12. |
| `EDIT-003` | Comments, annotations and tasks on files | target | done | `tests/chest/annotation-flow.mjs` (annotationFlow and annotationBrowserFlow: PDF mentions and refusal, retained anchors, side-by-side originals, unresolved navigation and linked carry-forward); `tests/chest/annotation-recipients.mjs` (annotationRecipientsFlow: version-scoped recipients); `tests/chest/imported-review-flow.mjs` (importedReviewFlow and importedReviewBrowserFlow: source times, IDs, states, former authors, missing-anchor quotes, replies, resolution, tasks, erasure and reviewed import authority); `tests/chest/role-review-flow.mjs` (roleReviewFlow); `tests/chest/browser-new-files.mjs`; `tests/chest/files.mjs`; `tests/chest/office.mjs` |  |
| `EDIT-007` | Review loop: attribution and @mentions | target | partial | `tests/chest/wopi-flow.mjs`; `tests/chest/collabora-live.mjs`; `tests/chest/role-review-flow.mjs` | Attributed comments and forged-author refusal are proven with real CODE; the mention people list, grant offers and notifications inside the editor remain. |
| `EDIT-008` | Review loop: assigned comments and one thread everywhere | target | partial | `tests/chest/role-review-flow.mjs`; `tests/chest/annotation-flow.mjs` | File-page mentions and assignment exist; the editor-to-thread sync both ways, tasks from in-document comments and email replies reaching the document do not. |
| `EDIT-009` | Review loop: commenters suggest, contributors decide | target | partial | `tests/chest/wopi-flow.mjs`; `tests/chest/collabora-live.mjs`; `tests/chest/role-review-flow.mjs` | DOCX tracked typing, refusals, decisions and read-only viewers are proven with real CODE; the XLSX, PPTX and ODT steps, the pending list and the suggestion notice remain. |
| `EDIT-010` | Chest commands inside the editor | target | missing |  | No in-editor Chest commands exist. |
| `EDIT-011` | Download as another format | target | missing |  | Conversion is not delivered. |
| `EDIT-012` | CODE production notice | target | partial | `tests/chest/administration-accounting-flow.mjs` | Fresh-judge candidate: ADMIN-002's evidence lists the CODE warning as implemented. |
| `EDIT-004` | New files from the New menu | target | partial | `tests/chest/new-files.mjs`; `tests/chest/browser-new-files.mjs`; `docs/office.md` | Browser creation of blank OOXML and ODF files with ACL, quota, audit and idempotency exists; creation into the shipped Collabora editor, provider creation, guests and group-scoped service-settings administration remain. Desktop Office repair-free checks are R-8. |
| `EDIT-013` | Templates | target | partial | `tests/chest/new-files.mjs`; `tests/chest/browser-new-files.mjs` | Templates above the 8 MB Office limit remain. |
| `EDIT-014` | Microsoft 365 as an optional editor | target | missing |  | No Microsoft provider work is in the evidence. Partner approval and a live tenant are R-10. |
| `SIGN-001` | Built-in eSignature | target | partial | `tests/chest/signatures.mjs`; `tests/chest/browser-signatures.mjs`; `tests/chest/backup-archive.mjs`; `docs/signatures.md` | Awaiting a ct ruling on the adopted PIN, session and typed-name defaults (RL-5); otherwise the old gap named only the mobile app door, now PREVIEW-003. |
| `PREVIEW-003` | Feature doors in the mobile apps | target | missing |  | No native app exists. This row replaces the "and in the iOS and Android apps" sentences that held five feature clauses partial. |
| `MOBILE-005` | Co-authoring in the mobile apps | target | missing |  | No native app exists. |
| `RECOVER-001` | Point-in-time folder and space rewind | target | done | `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` |  |
| `RECOVER-002` | Scheduled independent backups and upgrade recovery | target | done | `tests/chest/backup-archive.mjs`; `tests/chest/browser-backups.mjs`; `tests/chest/upgrade.mjs`; `tests/chest/upgrade-local.mjs`; `tests/chest/backup-sandbox.mjs`; `docs/independent-backups.md` |  |
| `ADMIN-001` | Single sign-on and directory lifecycle | target | done | `tests/chest/organisation.mjs`; `tests/chest/organisation-lifecycle.mjs`; `tests/chest/organisation-deprovision.mjs`; `tests/chest/organisation-recovery.mjs`; `docs/organisation.md` |  |
| `ADMIN-002` | Admin reports | target | partial | `tests/chest/administration-report-flow.mjs`; `tests/chest/administration-guest-flow.mjs`; `tests/chest/quota.mjs`; `docs/administration.md` | Transfer and sync-failure reporting are incomplete in the old gap ("complete transfer ... reporting"). |
| `ADMIN-005` | Provider-only USD cost view | target | partial | `tests/chest/administration-accounting-flow.mjs`; `tests/chest/backup-archive.mjs`; `tests/chest/bulk.mjs`; `tests/chest/signatures.mjs` | Fresh-judge candidate: ct ruled on administrator-recorded licence records and probes (RL-101); the old gap's remaining items, trusted live licensed limits, provider-side capacity and complete provider refusal reporting, stay unknown under that ruling and are field proof R-11. |
| `ADMIN-003` | Several admins, delegated roles and owner transfer | target | partial | `tests/chest/administration.mjs`; `docs/administration.md` | Points 1 and 2 pass, point 3's refusal of the former owner's owner-only actions is asserted, and the last super admin cannot be deactivated (`tests/chest/administration.mjs`); the new owner succeeding at an owner-only action, a refused demotion of the last super admin, and the audit of each step are not asserted. |
| `ADMIN-006` | Admin rewind without content access | target | partial | `tests/chest/administration.mjs` | Point 1 passes. Asserted (`tests/chest/administration.mjs`): the account restore's bytes and versions, the team-space restore's name and parent, the moved file among the preview's changes, revoked links and the departed identity denied, the admin refused names, preview and download, and an apply refused after the scope is removed. Not asserted: every restored team-space byte, kept conflict copies, a preview accounting for membership and sharing changes, the admin refused search, and a preview requested after the scope is removed. |
| `ADMIN-004` | Enforced multi-factor sign-in | target | done | `tests/chest/security.mjs`; `tests/chest/administration.mjs` |  |
| `QUOTA-001` | Storage limits for users and spaces | target | done | `tests/chest/quota.mjs`; `tests/chest/browser-quota.mjs`; `tests/chest/space-policy.mjs`; `tests/chest/new-files.mjs` |  |
| `SECURITY-001` | Encryption and secret custody | target | partial | `tests/chest/reading.mjs`; `tests/chest/files.mjs`; `tests/chest/upgrade.mjs`; `tests/chest/restore.mjs` | Transport and owner-storage encryption proof, installation-wide rotation and recovery, runtime-log canaries and the stale-grant race across every mutation door remain, and so does device-cache encryption on the desktop and mobile clients (SYNC-008, MOBILE-002), which do not exist yet. |
| `SECURITY-002` | Malware scanning and classification | target | done | `tests/chest/content-security-flow.mjs`; `tests/chest/integrations.mjs`; `tests/chest/wopi-flow.mjs`; `docs/content-security.md` |  |
| `SECURITY-004` | Mass-activity alerts | target | done | `tests/chest/content-security-flow.mjs` |  |
| `SECURITY-003` | Server-side ransomware protection | target | partial | `tests/chest/browser-upload-protection.mjs`; `docs/upload-protection.md` | Mass rename detection, complete ordinary-version quarantine history and large-original release remain. |
| `SECURITY-005` | Client-side ransomware protection | target | missing |  | No native client exists. |
| `GOVERN-001` | Retention, legal hold and discovery providers | target | missing |  | No delivered workflow (R-22). |
| `AUDIT-001` | Complete, durable action history | target | done | `tests/chest/audit.mjs`; `tests/chest/browser-audit.mjs` |  |
| `AUDIT-002` | File activity and view history for collaborators | target | partial | `tests/chest/audit.mjs`; `tests/chest/browser-audit.mjs` | Point 2 passes, and point 1's one colleague's view shown to a contributor and no view history for a viewer are asserted (`tests/chest/audit.mjs`); the second colleague's name, the view times, and the viewer seeing edits are not. |
| `ERASE-001` | Deliberate erasure, separate from trash | target | partial |`tests/chest/erasure.mjs`; `tests/chest/erasure-archive.mjs`; `tests/chest/browser-erasure.mjs`; `tests/chest/backup-archive.mjs`; `docs/erasure.md`; `agent-surface.json`; `tests/chest/integrations.mjs` | Agent decision custody is conservatively held installation-wide after admission. Selective Base decision redaction and retained-client mapping remain unavailable; erasure is never reported complete for that retained data. |
| `OPS-001` | Clear, accessible and observable operation | target | partial | `tests/chest/browser-flow.mjs`; `tests/chest/journey.mjs`; `docs/hosting.md` | Responsive journeys and a hosted install exist; accessibility checks and per-service disconnect journeys are unproven. The VPAT and a human screen-reader pass are R-21. |
| `SCALE-001` | Seeded scale run | target | partial | `scripts/scale/generator.mjs`; `tests/chest/scale.mjs`; `tests/chest/scale-sync.mjs`; `.github/workflows/scale.yml`; `docs/scale.md` | The bounded journey exercises 100 nested folders and 600 direct members in one populated space, 300 device credentials and 10,000 remote renames; the combined 2,000,000-item run, 20,000-child scrolling and 500,000-item enumeration have not run. The reference install is R-1, and each buyer's inventory rerun is R-2. |
| `SCALE-002` | Honest scale health | target | partial | `tests/chest/scale.mjs`; `src/chest/administration/scale.ts` | Today an unmeasured or undersized install returns 503 "failing" (`docs/scale.md`), so every small real install would show failing. |
| `OPS-002` | Availability probes and measurement | target | missing |  | No probes or availability measurement exist (the old partial rested on the Base health endpoint). A 30-day measured month is R-20. |
| `OPS-003` | Second copies and scrubs | target | missing |  | No second copy or scrub exists. |
| `OPS-004` | Incident status | target | missing |  | No incident notices exist. |
| `OPEN-001` | Free MIT-licensed source with no charges | target | done | `tests/chest/open-source.mjs`; `scripts/third-party-licenses.mjs`; `docs/open-source.md` |  |
| `OWN-001` | Runs on the owner's computer, server or cloud | target | done | `tests/chest/owner-computer.mjs`; `tests/chest/owner-server.mjs`; `tests/chest/owner-migration.mjs`; `tests/chest/owner-cloud.mjs`; `tests/chest/owner-egress.mjs`; `tests/chest/hosted-lifecycle.mjs`; `tests/chest/hosted-mail.mjs`; `tests/chest/hosted-data.mjs`; `tests/chest/hosted-screens.mjs` |  |
| `MIGRATE-001` | Inventory, approved plan and resumable batches | target | partial | `tests/chest/flows.mjs`; `tests/chest/browser-files.mjs` | A reviewed bounded archive import and zip move-in exist; vendor discovery, complete histories and mapping previews do not. |
| `MIGRATE-008` | Delta catch-up, cutover and rollback | target | missing |  | Delta and cutover do not exist. |
| `MIGRATE-002` | Google Drive files, revisions and permissions | target | partial | `tests/chest/browser-files.mjs` | Multi-part Takeout zip import with the folder tree and rerun skipping exists; a direct Drive connection, shared drives, permissions, links, versions and delta do not. A live Workspace run is R-12. |
| `MIGRATE-009` | Drive labels and shared-drive roles | target | missing |  | Labels and role mapping do not exist. |
| `MIGRATE-010` | Vault holds and externally owned files | target | missing |  | No delivered workflow. |
| `MIGRATE-011` | Drive comments, action items and suggestions | target | missing |  | No delivered workflow. |
| `MIGRATE-012` | Open review work moves as live state | target | missing |  | Migrated open review work does not exist. |
| `MIGRATE-003` | Dropbox Business | target | partial | `tests/chest/browser-files.mjs` | Dropbox zip and synced-folder import with the tree exists; a direct connection, team folders, permissions, links, versions and delta do not. A live team run is R-14. |
| `MIGRATE-004` | Box | target | partial | `tests/chest/browser-files.mjs` | Box zip and Box Drive folder import with the tree exists; a direct connection, collaborations, links, versions, metadata and delta do not. A live Box run is R-15. |
| `MIGRATE-005` | OneDrive and SharePoint | target | missing |  | No delivered workflow. A live tenant run is R-13. |
| `MIGRATE-006` | File shares and Nextcloud | target | missing |  | No delivered workflow. |
| `MIGRATE-013` | Egnyte and LucidLink | target | missing |  | No delivered workflow (R-16). |
| `MIGRATE-007` | Source map and link rewriting | target | missing |  | No delivered workflow. |
| `MIGRATE-014` | Unresolved-link report and old-URL resolver | target | missing |  | No delivered workflow. |
| `CONNECT-001` | Slack | target | missing |  | No delivered workflow. App Directory listing is R-18. |
| `CONNECT-002` | Microsoft Teams | target | missing |  | No delivered workflow. A live tenant is R-13; store listing is R-18. |
| `CONNECT-003` | Salesforce and HubSpot record files | target | missing |  | No delivered workflow (R-19). |
| `CONNECT-004` | Docusign | target | missing |  | No delivered workflow. |
| `CONNECT-005` | Zoom | target | missing |  | No delivered workflow (R-19). |
| `CONNECT-006` | Mail arrives in folders | target | partial | `tests/chest/filing.mjs` | Intake addresses with provenance, replay protection and revocation exist, exercised hosted with the installation's SendGrid sender; sender policy scopes and durable queue reconciliation remain. |
| `CONNECT-011` | Gmail and Outlook mailbox intake | target | missing |  | No delivered workflow. Live mailboxes are R-12 and R-13. |
| `CONNECT-007` | API, MCP and webhooks for apps and agents | target | partial |`tests/chest/integrations.mjs`; `tests/chest/browser-integrations.mjs`; `tests/chest/integration-client.mjs`; `docs/integrations.md`; `agent-surface.json`; `tests/chest/integrations.mjs` | Shared company policy now governs SDK/MCP native reads and writes. Expanded event/subscription family remains undeclared; archived authority must pair again. |
| `CONNECT-012` | Embeddable file picker | target | done | `tests/chest/browser-integrations.mjs`; `tests/chest/integration-client.mjs` |  |
| `CONNECT-013` | Admin control of third-party apps | target | done | `tests/chest/integrations.mjs`; `tests/chest/browser-integrations.mjs` |  |
| `CONNECT-008` | Gmail and Outlook compose and save add-ins | target | missing |  | No delivered workflow. Live tenants are R-12 and R-13; listings are R-18. |
| `CONNECT-009` | Zapier and Make apps | target | missing |  | No delivered workflow. Public listings are R-18. |
| `CONNECT-010` | Google Workspace connection and Meet filing | target | missing |  | No delivered workflow. A live tenant, verification and Marketplace listing are R-12 and R-18. |
| `CONNECT-014` | Google Calendar add-on | target | missing |  | No delivered workflow. |
| `CONNECT-015` | Google Chat app | target | missing |  | No delivered workflow. |
| `CONNECT-016` | Google Forms file uploads | target | missing |  | No delivered workflow. |
| `RULE-001` | Reversible arrival rules | target | done | `tests/chest/filing.mjs`; `tests/chest/arrival-rules.mjs`; `tests/chest/browser-arrival-rules.mjs` |  |
| `FOLLOW-001` | Reminders and durable notifications | target | partial | `tests/chest/flows.mjs`; `tests/chest/files.mjs` | Due work, evidence completion and share, request and expiry notices by in-app and email exist; background reminders, push, chat channels and provider outcomes do not. |
| `FOLLOW-002` | Reply and resolve from email | target | missing |  | Replies by email do not exist. |
| `FOLLOW-003` | Personal notification settings | target | missing |  | Personal settings do not exist. |
| `SURFACE-001` | The Agent surface is Chest's tool registry | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared registry: 42 tools (41 native plus Base events), 40 of 48 target names and seven resources. Eight target jobs remain undeclared; embedded native agents and expanded event family have not adopted this registry. See docs/agent-adoption.md. |
| `SURFACE-002` | Find and read what the sponsor can open | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native visible records, versions, filtered search and download-safe snippets, activity, requests, exposure and reports are tools; trash/recent views, combined access detail and optional resource refresh/event subscriptions remain undeclared. |
| `SURFACE-003` | Original bytes follow download rights | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native immutable download and Range, current ACL/no-download/source pause and explicit byte caps are enforced. Direct agent reads have 512 KiB capacity; large/resumable originals and mid-stream erasure/revocation proof remain gaps. |
| `SURFACE-004` | Add and organize files | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Single-item native uploads, folders, Office create, rename/move/typed filing, exact filing plans and pair merge are declared. Resumable/bulk and outside-reference repoint jobs remain gaps; an enabled arrival continuation refuses before admission until it can enter the company door. |
| `SURFACE-005` | Recovery stays standard; destruction is its own class | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native trash/untrash, version restore/name and exact rewind are declared. Erasure and permanent purge remain undeclared while Base decision custody requires client mapping, permitted evidence redaction and a selective capture/execution fence. |
| `SURFACE-006` | Sharing is classified by its recipient, never by the agent | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native recipient/exposure classification and company holds/refusals replace the old allow shim; caller confirmation is ignored. Full target share/link options and browser parity coverage remain incomplete. |
| `SURFACE-007` | Narrowing access and repairing links | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native principal removal and exposure reads are declared; link revoke, Make private and embedded repair continuation remain gaps. |
| `SURFACE-008` | Collect documents in, send files out | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native upload-only requests and parallel signature-envelope prepare/send are declared, including sensitive source classification and named preparer. Request collection, ordinary mail/transfer/reminder operations and new mail-event family are undeclared. |
| `SURFACE-009` | Devices and sync | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native device metadata and revocation/narrowing are declared. Companion queue execution, wipe and end-to-end client repair remain device/continuation gaps. |
| `SURFACE-010` | Administration and security settings are classified, not withheld | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Space membership, storage limits, sharing policy and quarantine release are declared under current native roles. Staff/admin lifecycle and remaining security-setting families are not claimed; backup/restore require independent runner/installation continuation. |
| `SURFACE-011` | Decisions and signatures are commitments | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Native exact-version assignment/approval/change requests declare commitment facts and agent attribution. Applying a signature remains undeclared pending real signer-consent and queued completion binding. |
| `SURFACE-012` | Limits and Pause agents | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Current identity, original scoped OAuth grants, optional grant caps, signed/local Pause, consent revocation and policy decisions are exercised. Provider spend reservations and optional multi-sponsor family are undeclared; no paid tool or hidden default grant cap is registered. |
| `SURFACE-013` | The records clerk journey under two company policies | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | The declared core registry has autonomous/held journeys, native state witnesses, injection, policy, audit and narrowing coverage. Full 48-tool records-clerk/browser/vendor-client journey and undeclared families remain gaps (R-25). |
| `AGENT-001` | File and classify what arrives | push-further | partial |`tests/chest/filing.mjs`; `tests/chest/agent-filing.mjs`; `tests/chest/browser-agent-filing.mjs`; `agent-surface.json`; `tests/chest/integrations.mjs` | Company door covers deterministic exact plans, not the standing paid native arrival agent; automatic company upload continuations refuse before byte admission. |
| `AGENT-002` | Reconcile duplicates and superseded versions | push-further | partial |`tests/chest/duplicate-reconciliation.mjs`; `tests/chest/browser-duplicates.mjs`; `tests/chest/filing.mjs`; `agent-surface.json`; `tests/chest/integrations.mjs` | Company door covers native proposal and pair merge, not outside reference repoint or embedded duplicate continuation. |
| `AGENT-003` | Repair sync and verify bytes | push-further | partial |`tests/chest/browser-sync-repair.mjs`; `scripts/sync-companion/run.mjs`; `scripts/sync-companion/disk.mjs`; `scripts/sync-companion/transfer.mjs`; `docs/sync-repair.md`; `agent-surface.json`; `tests/chest/integrations.mjs` | Device diagnostics/revoke are company tools; companion execution is undeclared. |
| `AGENT-004` | Finish collection and prove the right version arrived | push-further | partial |`tests/chest/collection.mjs`; `tests/chest/browser-collection.mjs`; `docs/collections.md`; `agent-surface.json`; `tests/chest/integrations.mjs` | Company door covers native request creation and parallel envelope send, not autonomous collection/reminder continuations. |
| `AGENT-005` | Repair broken and over-shared links | push-further | partial |`tests/chest/link-repairs.mjs`; `tests/chest/browser-link-repairs.mjs`; `agent-surface.json`; `tests/chest/integrations.mjs` | Company door covers exposure reads and principal narrowing, not Make private/link repair continuation. |
| `AGENT-006` | Build and validate a move-in | push-further | partial |`tests/chest/flows.mjs`; `agent-surface.json`; `tests/chest/integrations.mjs` | Manual hash and gap reconciliation and reversible staging exist; agent mappings and collaborator validation do not. Company door exposes native move-in status; native collaborator mapping remains outside this adoption. |
| `AGENT-007` | Cited questions and field jobs | push-further | partial |`tests/chest/ask-flow.mjs`; `tests/chest/ask-live.mjs`; `docs/ask.md`; `agent-surface.json`; `tests/chest/integrations.mjs` | Fresh-judge candidate: ct ruled on the Ask defaults (RL-102), and the old gap names no other remaining browser work; native-app Ask is AGENT-009's app step. Company paid Ask is undeclared until Base enforces spend reservations; existing native reader consent does not authorize a company call. |
| `AGENT-008` | Custom document agents with tools | push-further | partial |; `agent-surface.json`; `tests/chest/integrations.mjs` | Native scoped custom-agent tools, current ACLs and company policy exist; signing, erasure and wider target jobs remain undeclared. |
| `AGENT-009` | Ask panels on file and folder pages | push-further | partial | `tests/chest/ask-browser-flow.mjs` | Browser Ask panels exist; the native apps do not. |
| `BASE-AGENT-001` | One MCP door per seed | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared production MCP eras/alias and canonical metadata pass. Native browser proof and final normal verification still gate publication. |
| `BASE-AGENT-002` | The seed's jobs are tools, through the UI's own actions | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared native registry is proven; eight target jobs and embedded agent/independent-runner continuations remain undeclared. No target-only service is registered. |
| `BASE-AGENT-003` | Records are resources | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Seven native metadata resource templates are declared, under current visibility with missing/restricted equivalence and no bearer fields. Optional resource refresh and full primary-record parity are undeclared. |
| `BASE-AGENT-004` | Business identity and short-lived, audience-bound tokens | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Owner-bound signed identity and original scoped local credentials are exercised. Optional multi-sponsor family, and separate native team-admin/member lifecycle proof, are undeclared. |
| `BASE-AGENT-005` | An agent acts as a person in a role, never more | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared native grants, role guards, original OAuth fences, narrow-only device authority and record security are exercised. Remaining native role/security families and embedded continuations are not claimed. |
| `BASE-AGENT-006` | Every action declares its risk class | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Every declared tool/class pair has native journey calls and server facts. Wider target jobs and provider-cost classes are not registered. |
| `BASE-AGENT-007` | The company's policy decides, at one chokepoint | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Signed policy receiver, unanswered/invalid/blocked/paused states and exact named approval are exercised for declared tools. Embedded native agents and optional mail-event/continuation families remain undeclared. |
| `BASE-AGENT-008` | Truthful attribution | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared product records/versions/activity and envelope mail name agent for person; native human rename Undo has its own journey. Full wider surface and asynchronous native completion attribution remain gaps. |
| `BASE-AGENT-009` | Every agent action is audited with its class and decision | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared private reads, refusal, policy and native effects have shared audit with zero differs_from_policy in the production harness. Client-scoped retained evidence redaction remains a Base custody boundary. |
| `BASE-AGENT-010` | Agents can follow changes | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Undeclared optional events/subscriptions family: only Base built-in event cursor is retained. Native webhook IDs, expanded native event types, subscriptions and external event handoffs are not claimed. |
| `BASE-AGENT-011` | Limits are policy, and Pause stops everything | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared limits/Pause and optional grant caps are exercised. Undeclared provider-spend reservations and multi-sponsor family; no cost tool is registered and spend is none. |
| `BASE-AGENT-012` | Writes are idempotent and conflict-safe | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Declared writes retain atomic native effect receipts and current admission on replay, conflicts and stale target checks. Trusted queued/embedded continuation proof is not exposed by the installed CLI native-journey hook. |
| `BASE-AGENT-013` | Manifest, docs and the conformance journey | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/network.mjs`; production door conformance 8524/8524 points; `tests/chest/integrations.mjs` | Manifest equals the declared production registry and generated docs; autonomous/held conformance is exercised. Wider target jobs, optional families and stock vendor-client/browser parity remain gaps. |
