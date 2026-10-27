# Changelog

## Unreleased

- **Contract page.** run-chest.com/contract takes Base's rer 0.2.72 header: the bar and nav wrap, so the page no longer scrolls sideways at 320 px (and none from 300 to 1600). Every Base copy is refreshed to rer-v0.2.72 (with the pin moved to `@runeditrun/rer` 0.2.72), which also brings Base's chunked import-door job creation for multi-MB sources.
- **Run page.** run-chest.com/run takes Base's rer 0.2.71 /run page: the install command never runs under the Copy button, and the page does not scroll sideways at any width from 320 to 1600 px. Every Base copy is refreshed to rer-v0.2.71 (with the pin moved to `@runeditrun/rer` 0.2.71), and the run site keeps Chest's own favicons.
- **Homepage.** run-chest.com follows the owner-approved page structure (page-s1): after the hero, one supplier's folder from the move-in on Sat, Sep 26 to the renewal (Follow one folder, Files that file themselves, On every desk and phone, Open it and edit together, Share out. Collect in., Every version, kept., The right version reached everyone., Find the sentence inside the file.), then the closing. The shared twelve-section skeleton is gone. `docs/CLAIMS.md` maps every claim on the new page to its clauses and code.

## 0.2.0 (18 Oct 2026)

Chest 0.2.0 is a team file store you own: a free, open source (MIT) replacement for the everyday file storage and sharing of Google Drive, Dropbox or Box. It runs on your own computer or in your own Cloudflare account, keeps every file and record in your own storage, and charges nothing. The governed records Library from 0.1.0 is still there, at **Library**.

### What an owner gets

- **Team spaces and folders.** Make team spaces and folders inside folders, each with a breadcrumb, and upload by picking files or, on a phone, with **Take a photo**. Everyone also has their own area, **My files**.
- **Large uploads that resume.** Big files go up in parts with a progress bar. If the page reloads or the connection drops, the folder shows the unfinished upload and how much arrived; choose the same file again and it carries on from there. The stored file is checked against its SHA-256.
- **Versions and restore.** Every replacement keeps the earlier versions with author, time, size and SHA-256. Restore any version as the current one; it comes back as a new version and nothing later is lost.
- **Restore a folder to a date.** Pick a date and time and see every change first (renamed back, brought back from trash, added since); nothing happens until you apply it, and the receipt has **Undo this restore**.
- **Links for anyone.** Share a file or folder with a link that can have a password, an expiry date and a download limit; revoke it at any time. **Links › Shared too widely** lists links that never expire or are past their limit, with **Make private** to turn them off in one step.
- **File requests.** Give anyone a link to upload into a folder without an account. A hosted Chest emails you when files arrive.
- **Search inside files.** Search finds words inside PDFs and Office files and only shows what the searcher may open. Scans and photos are read too once you add your own AI model key under People & settings.
- **People and roles.** Add people to a space as viewer, commenter, contributor, content manager or manager. Viewers open files but cannot upload, share, rename or trash; items outside their spaces show **Request access** without their names; only the owner opens People & settings. Share single items with a person or group, approve access requests from the email, and see why someone has access on each file page.
- **Hosting on your own Cloudflare account.** `rer deploy` puts Chest on your Cloudflare account with your own SendGrid or Resend sender ([Host Chest on Cloudflare](docs/hosting.md)). People sign in by an emailed link and invited people get an invitation email.
- **Backups.** `rer export` and `rer import` back up and restore Chest on your computer. `rer run hosted-backup` saves a hosted Chest's database and every original into a private folder, and `rer run hosted-restore` puts it back into a freshly deployed Chest.
- Also in this release: moving files in from Google Takeout, Dropbox and Box `.zip` downloads; company sign-in (Okta, Google Workspace, Microsoft Entra ID) with SCIM user setup; storage limits per space; trash you can undo; an activity log and audit trail; ownership hand-over of personal files with the recipient's consent; filing rules and email intake for a hosted Chest on a Cloudflare domain; in-browser DOCX text and XLSX value editing that saves new versions.
- Runs on `@runeditrun/rer` 0.2.51.

### Not in this release

The homepage describes some things Chest does not do yet:

- **Sync apps.** There is no desktop or phone sync app, and no files open on demand from Finder or Explorer. Use the browser, phone uploads or Move in. **Sync devices** says so.
- **Office in the browser.** Word, Excel and PowerPoint files are previewed and downloaded; there is no full Office editor and no editing together at the same time. Only DOCX text and XLSX cell values can be edited in Chest.
- **Moving in everything.** Move in brings folders and files from Google Drive, Dropbox and Box downloads, but not their sharing, shared links, comments or earlier versions, and old links from those services do not forward to Chest.
- **Single sign-on certified against real tenants.** Company sign-in is set up by hand per provider and has not been certified against live Okta, Google Workspace or Entra tenants.
- **Scheduled off-site backups, retention rules and legal hold.** Backups are run by you, by command.

### Back up first

Chest holds your team's files. Make a backup before you change anything and keep it private.

**On your computer**, in your `run-chest` folder, stop Chest and export:

```sh
rer export --output exports/chest-before-0.2.0.rer
```

**Hosted**, from the folder you deploy from (with its `.rer/deploy` folder and your settings file):

```sh
rer run hosted-backup --environment production --env-file chest.env
```

`rer export` saves only the copy on your computer and refuses a hosted address. [Back up and restore](docs/backup-and-restore.md) and [Host Chest on Cloudflare](docs/hosting.md) show how to restore either into a fresh copy.

**Upgrading from 0.1.0 or from `main`:** back up as above, then in the same checkout `git pull`, `rer install` and `rer dev` (on your computer) or `rer deploy --environment production --env-file chest.env` (hosted). Migrations apply forward only and only add tables; a 0.1.0 copy upgraded this way kept every earlier row and original unchanged in the release check.

### Migrations

`migrations/core/0001_owner.sql` to `0015_import_custody.sql` came with 0.1.0. This release adds `0016_owner_signin.sql` (one-time owner sign-in links), `0017_files.sql` (the change journal and sync device keys), `0018_reading.sql` (the sealed AI model key for reading scans), `0019_organisation.sql` (company sign-in and the storage-limit check) and `0020_scim.sql` (SCIM user setup). All five only create tables.

### Known issues

- **A hosted owner is called "Owner".** `rer deploy` makes your setup email the hosted owner but does not carry the name you gave `rer setup`, so the top bar shows "Owner"; invitations and notices then name you by your email address.
- **People & settings says restored people need a fresh invitation.** After `rer run hosted-restore` the page says "Someone restored from a backup needs a fresh invitation". Only invitations not yet accepted stop working; people who had accepted sign in by email as before, as the hosting guide says.
- **A restore turns company sign-in off without a notice on the page.** The restore's own output and the hosting guide say so; People & settings › Company sign-in just shows an empty provider form. Enter the provider again and test it.
- **Link passwords need 8 characters or more**, and the form does not say so: a shorter one ends on "That was not done … Code: invalid_password".
- **File requests take files up to 8 MB each.**
- A hosted backup counts database rows ("Backed up 249 database row(s) and 9 original file(s)") and the restore counts entries ("Restored 42 file and record entries and 9 original file(s)"); nothing is missing. Written to a log, their progress lines carry raw terminal codes.
- A file's Activity lists each open twice and shows people by email.
- The `chest.env` file the hosting guide suggests is not covered by `.gitignore`; keep it out of commits.
- Words in scans and photos are found only after you add your own AI model key, which the provider charges for per page.

### Changes since 0.1.0

**Personal files change hands with consent, and each file explains its access.**

- The owner of a file or folder in their personal area can offer it to a colleague. The colleague gets an email and
  a notice and accepts or declines; until then nothing moves. On acceptance the item moves to the recipient's area
  with its ID, versions, links, file requests and grants, and the sender keeps editor access unless they chose not to.
  Changed content or a name clash at the destination stops an old offer instead of completing it.
- The file page's **Your access** card says where each person's access comes from: the space, a named share, a group
  or an organization link.

**A restored hosted Chest lets everyone sign in, and the Google Workspace guide works (stranger journey 3).**

- `rer run hosted-restore` into a freshly deployed Chest no longer leaves **Sign in** and **People & settings**
  answering "Company sign-in did not finish … service_unavailable". Company sign-in is locked to the deployment that
  saved it, so the restore switches it off and says so; people sign in by email and the owner enters the provider
  again. SCIM tokens, links and file requests keep working. A saved provider that cannot be opened (for example
  after the deployment's secret changed) never blocks email sign-in or People & settings, which asks for it again.
- Company sign-in with OpenID Connect uses the endpoints the provider's discovery document names, each https and on
  the public internet, instead of requiring them on the provider address's own domain. Google's are on four
  domains, so the "Google Workspace, step by step" guide stopped at `provider_endpoint_origin_mismatch`; it now
  sends people to Google. ID tokens Google issues as `accounts.google.com` are accepted.
- **Save identity provider** reads the provider's settings at once and confirms ("Identity provider saved … Chest
  reached https://accounts.google.com"), or says in plain words what is wrong with the address. Company sign-in
  errors name what to check instead of always blaming "your administrator".
- An expiry or deadline picked as a date (links for anyone, file requests, shares) ends at the end of that day on
  the creator's clock, not in UTC. Public link and file request pages show it, and the "Files received" time, on
  the visitor's own clock.
- Shared with me shows when each item was last updated. Storage reads in KB, MB and GB instead of raw bytes.
  Search says when words in scans and photos are not searchable yet and why. A filing rule's file type field
  explains what a type such as application/pdf is.

**Hosted backup, company sign-in and email intake work from their pages alone (stranger journey 2).**

- The hosting guide backs up, restores and removes with `rer run hosted-backup` and `rer run hosted-restore`, which
  use rer's own Node, so they work right after the `install.sh` install. Any failure ends in one plain line.
- **People & settings › Company sign-in** uses plain field names with a line beside each, shows Chest's values for
  the provider in one place, and has step-by-step guides for Okta and Google Workspace (OpenID Connect) and
  Microsoft Entra ID (SAML), with automatic user setup (SCIM) for Okta and Entra.
- **Filing agents › Email intake** says what it needs (Chest hosted on Cloudflare, a domain on Cloudflare with Email
  Routing, or a subdomain when the domain already gets mail), gives the Cloudflare steps screen by screen, names the
  Worker, and points people without such a domain to file requests. The unexplained "Containers" sentence is gone.
- File versions are numbered oldest 1 to newest, and a number never moves after a new version or a restore.
- Folder lists, search, Shared with me, Links, file requests, access requests, trash, comments and settings show
  times on your own clock with its zone, like file pages.
- Filing agents' folder pickers and rule lines show full folder paths.
- Access requests name the item for the people who decide; the person asking sees a link, and the name once they
  have access.
- The hosting guide says that `MAIL_API_KEY`, which `rer setup` lists, is the same key as `SENDGRID_API_KEY` or
  `RESEND_API_KEY`.

**People are named, and the stranger's smaller notes are fixed (stranger journey 1, notes).**

- Finish setup asks for your name. Invitation emails say who invited you ("Rosa Diaz (rosa@…) invited you to
  Chest"). File request pages, share, access-request and comment emails, and the Audit trail use that name too, or
  the email address until a name is set, never "Owner". Chest has no organisation name, so none is shown.
- A resumed upload drops its "Unfinished uploads" line once it starts, so only the live progress shows. "Checking
  every byte" shows the time so far and an estimate for the file's size.
- The Audit trail's Who column shows names, and sizes read as KB or MB. On a phone, rows without details leave out
  the empty label.
- The Files and Library search placeholders fit on a 390-pixel phone ("Search names and text", "Search titles,
  fields, text").
- Runs on `@runeditrun/rer` 0.2.47, with every Base copy at rer-v0.2.47 (this includes dm's 0.2.45 refresh). The run
  site's licence-to-license rewrite is gone, because Base's Run page now says "license" itself.

**Setup pages work on their own (stranger journey 1).**

- Team space members are added by email with a role, given another role or removed on their row; when the owner
  adds someone new, Chest invites them. Groups (add or remove a member by email, rename), collection and document
  access (person or group with a role) and document types (one row per field) are forms. No page asks for JSON.
- **Sync devices** says plainly that no desktop or phone sync app exists yet and points to browser, phone and
  move-in uploads. The page no longer makes device keys; keys made through the API are still listed and revoked.
- **Move in** (for everyone, in the top bar) gives the exact Google Takeout, Dropbox and Box download steps and
  imports those `.zip` files (several parts, zip64, CRC-checked) or a chosen folder into any space or folder with the
  folder tree, through the resumable upload. A rerun skips what already arrived. Sharing, shared links, comments and
  earlier versions from those services are named as not carried yet. The Library's JSON archive importer moves to
  **Move in › Library archive move-in**.
- Chest opens on **Files**; the Library is at `/app/library`.
- Restore to a date takes the time on your own clock with its time zone (preselected from the browser); times show
  in the viewer's zone. Refused actions explain themselves in plain words and go back to where you were.
- Activity, Notices, the Audit trail and version history read as words and names instead of event codes and IDs.
- The storage total counts the bytes actually stored, across Files and the Library.
- Locally, People & settings says invitations are not delivered and how to use Chest as an invited person
  (`rer dev --as their@email`).

**Hosting is documented and hosted backups are real.**

- [docs/hosting.md](docs/hosting.md) and the README cover deploying to your own Cloudflare account, choosing the mail
  provider and sender, signing in, where files are kept, backup, restore and removal.
- Mail for a hosted Chest is chosen with deploy settings: `MAIL_PROVIDER` (`sendgrid` or `resend`) and `MAIL_FROM`,
  with `SENDGRID_API_KEY`/`RESEND_API_KEY` or `MAIL_API_KEY`. With only one provider's key set, that provider is used.
  `deploy.json` is never edited; it names the guide (`deployGuide`).
- `node scripts/hosted-backup.mjs` saves the hosted database (`wrangler d1 export --remote`) and every original from
  R2 into an owner-only folder; `node scripts/hosted-restore.mjs` restores it into a fresh deployment.
- `rer export --origin <hosted>` (rer 0.2.45 and later) refuses and names the hosted export.

## Contract history

Moved out of CONTRACT.md in the 28 October 2026 contract cleanup. Old clause ids map to current ones through `docs/contract/ID-MAP.json`.

### 28 Oct 2026 — contract cleanup

- CONTRACT.md now follows the RER contract standard: one template per clause (a Requirement and at most eight acceptance points), Core, Agent surface and Later tiers, a Field proof register, door rules, Base duty citations and a Retired clauses table. ACCEPTANCE.md and docs/CLAIMS.md are generated from it by `src/base/contract-docs.mjs`.
- The 0.2.0 release clauses CHEST-14 to CHEST-24 were folded into the clauses they restated (see Retired clauses). Large clauses were split into one-capability parts with new ids; the Agent surface (SURFACE-001 to SURFACE-013) was added. Rulings moved to RULINGS.md, accounting and import mechanism to `docs/`, and history here.
- Statuses were carried part by part from the 21 October 2026 judgement, with no part promoted; `docs/contract/COVERAGE.json` gives every earlier sentence its place.
- After the fresh judge's first reading: the mobile feature doors are PREVIEW-003 (numbered in their first source's prefix) and mobile co-authoring is MOBILE-005; perpetual Office versions (SYNC-014) stay Core as part of a day-one gap; ADMIN-001, AUDIT-001, OWN-001, RECOVER-002, SHARE-003, ADMIN-003 and ROLE-001 keep only Chest's delta on their Base duties; SEARCH-002, AGENT-001, AGENT-004 and AGENT-005 leave each agent decision to the company's policy (RL-23). Statuses are unchanged.
- After the fresh judge's second reading: AUDIT-001's first point states what its evidence asserts for Chest's delta (a failed or interrupted share-notice mail leaves an uncertain provider attempt against the item); the export reconciliation it named is BASE-AUDIT-001's. SURFACE-001, -002, -003, -004, -008, -010, -011 and -012 keep only Chest's delta on the Base agent duties they cite, dropping the sentences and points that restated BASE-AGENT-002, -003, -005, -008, -011 and -012. Statuses are unchanged.

### Earlier contract history

- Target approved **16 October 2026**.
- Round 1 of the independent buyer review (16 October 2026) added ROLE-001, BULK-001, SYNC-006, SHARE-004/005, POLICY-001, ADMIN-003/004, SECURITY-003, SCALE-001 and CONNECT-008/009 and sharpened CHEST-01/10/13, TRANSFER-001, SYNC-001/003, MOBILE-001, SHARE-001, PREVIEW-001, SEARCH-001, RECOVER-001, MIGRATE-002 and OPS-001.
- Round 2 of that review (16 October 2026) added VERSION-001, SPACE-002, QUOTA-001, SYNC-007, SIGN-001, MIGRATE-007 and OPS-002 and sharpened CHEST-07/13, ROLE-001, SHARE-001, SHARE-004, POLICY-001, RECOVER-001, ADMIN-002/003, TRANSFER-001, CONNECT-004, MIGRATE-001/002 and OPS-001.
- Round 3 of that review (16 October 2026) added EDIT-004 and CONNECT-010 and sharpened SPACE-001, MOBILE-001, EDIT-001, SYNC-003, SECURITY-002, AUDIT-001, CONNECT-003, CONNECT-005, CONNECT-007, POLICY-001 and FOLLOW-001.
- Round 4 of that review (16 October 2026) named Collabora Online as the shipped editor in EDIT-001 with a no-Microsoft, no-Google acceptance journey, named the SEARCH-001 filters, and sharpened EDIT-004, SHARE-005, MOBILE-001, ADMIN-002, CONNECT-007, CONNECT-010 and FOLLOW-001.
- Round 5 of that review (16 October 2026) gave EDIT-001 the review loop inside the shipped editor (attributed comments, @mentions with grant-or-refuse, assigned comments, one thread across the editor, file page and email, and commenter suggestions as tracked changes that contributors decide), a CODE production warning and download-as conversion, and sharpened EDIT-003, ROLE-001, FOLLOW-001 (personal notification settings and resolve from email) and CONNECT-010.
- Round 6 of that review (17 October 2026) gave MIGRATE-002 the move-in of open review work (Drive comments, replies, assigned action items and pending suggestions arrive as live EDIT-003 threads, tasks and tracked changes, with a named author-matching method, no move-in notifications and per-file reconciliation), carried the same rules through MIGRATE-001, MIGRATE-003–005, EDIT-002, EDIT-003 and FOLLOW-001, and added in-editor assignment and Chest file links to EDIT-001 and file and folder Ask panels to AGENT-007.
- The homepage claims pass (17 October 2026) gave every capability claim on the approved homepage a clause: it added SEARCH-002, OPEN-001 and OWN-001 and sharpened SHARE-001, TRANSFER-001, SYNC-001, EDIT-001, MIGRATE-007, AGENT-001 and AGENT-005 (## Homepage claims).
- On 19 October 2026 two clause boundaries were drawn on the planning defaults accepted for the builders: the macOS/Windows tray and mobile upload-queue display of a storage-limit refusal moved from QUOTA-001 to SYNC-003 and MOBILE-001, and the provider-only cost view that OPEN-001 relies on is ADMIN-002's.
- These clauses are what Chest 0.2.0 promises.
- Each states only what the 0.2.0 release gate (18 October 2026) saw working, in a browser at 1440 and 390 pixels on a local copy and in a Chest deployed to its own Cloudflare account with real email.
- Broader target behavior stays in the target clauses below.
- Hosted Cloudflare operation, email, backup, restore, removal and the 0.1.0 upgrade were exercised manually by the 0.2.0 release gate.
- The explicit repository hosted lifecycle journey now proves real email, hosted-only backup, fresh restore, every retained original including 150 MiB, both identities and complete removal (CHEST-23).
- The CHEST-24 upgrade is exercised by the tagged-source journey in `tests/chest/upgrade.mjs`.
- `src/site/landing/`), and this table was rebuilt for it on 19 October 2026 from `docs/CLAIMS.md`, which carries the same rows with each claim's evidence files.
- SEARCH-002, OPEN-001 and OWN-001 were added and judged from the code at `22da3fcdc21765b16c26362a20f3d1f1a24cd530` (17 October 2026) for this table; every status is from the Status table below.
- The clause rows below include the 18 October filing, sharing, audit and file-request work.
- RECOVER-001 and VERSION-001 were re-judged at their own scope against main `27ee65afd77da074650d16f4501166166ed3eb49`; the moved requirements remain in ADMIN-003, SHARE-005 and SYNC-001.
- Published clauses CHEST-14 to CHEST-24 were added for Chest 0.2.0 from its release gate on commit `3c4e0660ee31121eb3cec22053eff21b329a1e9c` (18 October 2026).
- ADMIN-001 was updated on 19 October 2026 with the real Auth provider acceptance directed by the owner and the lifecycle journeys named in its row.
- Ownership, new-file creation, folder version review, link version and link-policy rows updated on 18 October 2026.
- Delivery-package and exact-version collection rows were built and exercised on 18 October 2026.
- Office preview, editing and comment rows updated on 17 October 2026; see `docs/office.md`.

### Status notes on done clauses (main a8e0f6f)

Delivered-work notes that sat in the Gap cells of done Status rows; done rows now carry an empty Gap.

- **CHEST-01.** The owner sets their name at Finish setup; invitations, file requests, notice emails and the audit trail name people by it (by email until a name is set), never by the placeholder "Owner".
- **CHEST-15.** The retained real-browser journey uploads 150 MB at 1440/390, interrupts after 26%, reloads, checks the persisted unfinished percentage, rechooses the same file, verifies resumed progress without resending stored parts, and compares both stored and downloaded SHA-256 with the original.
- **CHEST-24.** The repository journey installs genuine v0.1.0 source, bootstraps its owner without mail using the supported installer, and populates it through its original development runtime. It checks out the candidate in that same installation, runs pinned install/dev and compares every earlier application/auth/import table, schema and row, including the migration ledger, plus every original object hash and metadata. SQLite/D1 engine bookkeeping is outside application state. Every retained Library version downloads with its admitted SHA-256, people remain and a team space is created and opened at 1440/390. Clone/upgrade coverage runs on release tags and nightly, preserving push Verify speed.
- **ROLE-001.** None for ROLE-001. Commenter DOCX typing is tracked before the first keystroke and every save checks current authority, authorship and unchanged base content. PDF regions stay bound to their retained original; restricted previews return raster pages and suppress copy and printing. EDIT-001 and EDIT-003 retain the broader shared engine thread, task, notification and email loop, other format and native acceptance; EDIT-002 and MIGRATE-002 through MIGRATE-006 retain imported-review fidelity.
- **VERSION-001.** None. Chest hosts the configured Collabora editor in a frame and checks for a new restore every 12 seconds with the editor token and current file authority. Only messages from that frame at the configured editor origin are accepted. The host sends the Collabora version-restore handshake; the engine saves, closes and reloads its document. Chest never discards the frame on a timer, and a pending reconciliation keeps the editor and its unsaved work available while stale writes remain refused. This proves the VERSION-001 restore door without claiming EDIT-001's broader review, packaging, provider or native acceptance. MIGRATE-002 through MIGRATE-006 inherit migration provenance; SIGN-001 retains its separate native acceptance.
- **SHARE-003.** Version-pinned packages, byte-range resumption after restart, limits, expiry/revocation and separate scanner, provider, byte-completion and verified-recipient confirmation events are exercised through HTTP and browser journeys. The public upload and transfer journey stores a 2,155,872,256-byte original, sends it to both an invited email-verified recipient and a public recipient, interrupts each response, restarts the server, resumes from the retained offset and reconciles the complete SHA-256, count limit and distinct explicit confirmations. Browser creation, recipient download, evidence, confirmation and revocation are exercised at 1440/390.
- **ADMIN-001.** OIDC/PKCE, signed SAML and SCIM lifecycle are exercised against both real Chest and Auth Workers under the recorded owner direction to use run-auth as the live provider. Exact sign-in domain allow/require rules revoke disallowed sessions and preserve the installation owner recovery path. Destructive provider group changes immediately deny removed members, return an explicit review-required 409 and retain a durable before/after preview; only the owner confirms additions, renames or deletion, with stale and replay refusals. Provisioning transfers personal-area custody and current ownership/pending review assignments atomically before deactivation, to an owner-selected successor or the explicit current-owner default; IDs, hashes, historical authors and approved decisions survive. Browser, preview/download, device, OAuth-agent and identity-dependent external capabilities lose authority and do not revive on reactivation. Named ADMIN-001 journeys exercise the console and end states at 1440/390.
- **ADMIN-003.** Multiple super admins, six delegated privileges, custom combinations and live organization/group scopes are separate from content ACLs. Scoped people/session/device/factor administration, service and sharing settings, metadata reporting and selected content-free account/space rewind are implemented. Ownership offers require a fresh recipient sign-in and explicit acceptance, invalidate both old sessions, retain only selected former-owner grants and notify both people. The console recommends a second super admin and protects the last owner/admin. HTTP and browser journeys at 1440/390 exercise departed-account recovery, stable bytes/history, revoked sharing, scope removal and accepted ownership.
- **ADMIN-004.** Browser and API sessions require TOTP, verified WebAuthn security keys/passkeys or one-use recovery codes after email proof; enforced enrollment, group policy, key-only admin access, absolute and idle timeouts, device admission and provider MFA evidence are implemented. Secrets are installation-sealed and excluded from portable archives. Owner and scoped help-desk authorized single-use 24-hour enrollment resets notify the person and revoke other sessions/devices. HTTP and browser journeys cover the boundary and replay refusals at 1440/390.
- **QUOTA-001.** Organization personal/space defaults, largest limited group precedence, user/space overrides and effective-rule display are implemented. Scoped service-settings admins manage only their areas/groups. Every new/lowered over-limit rule requires an exact affected-area confirmation; changed usage invalidates it. Atomic byte admission reads live rules, retains versions/trash and reports scope/limit/usage. Transactional 90% crossing notices reach users or space managers in-app and by email once per crossing. HTTP and 1440/390 browser journeys name QUOTA-001 and prove refusals, retained reads/downloads and resumed writes after a raise or erasure, with before/after audit.
- **ERASE-001.** Owner and scoped trash erasure removes originals, retained versions, readings, authority, import custody and restoration snapshots, with current publication fences and durable per-store outcomes. Identity erasure revokes credentials and anonymizes retained team authors/audit. Preservation instructions refuse deletion; registered and independent backups remain explicitly pending until a verified owner-confirmed deletion result, with provider retention disclosed. Native source tombstones and later-journal preflight refuse historical resurrection; recovery without a later journal explicitly discloses the unknown. Public HTTP/CLI and browser paths exercise restart, holds, pending copies, real archive deletion and denied re-import at 1440/390.
- **OPEN-001.** The real source-release tar contains the MIT license and a generated inventory of every production dependency in the archived lock, including transitive/peer/optional versions with exact distribution integrity and license declarations. The named OPEN-001 journey scans source and exported application code for charge gates, invites 150 staff through the public API, and has the last person upload, share through the browser form, search, download and connect a device without a seat or feature refusal. Existing delivered-feature journeys remain ungated.
- **CONNECT-007.** OAuth/PKCE grants bound current users, resources, actions and budgets across documented paginated file/folder/version/search/share/request APIs and MCP. Idempotent mutations commit durable receipts atomically. The embedded picker returns stable IDs and authenticated links under live access. Installation-local secrets and publication proofs exclude imported authority/events. Signed webhook outcomes retain failure/uncertainty and explicit same-event replay. Organization/group app allowlists, read-only limits, blocks and scoped administration revoke live grants and audit policy changes. HTTP and real third-party HTTPS consumer browser journeys exercise consent, picker, refusal, revocation and webhook replay at 1440/390.
- **AGENT-002.** Current and retained hashes, complete text changes, actual email/archive source identities and separate approval histories inform canonical-file proposals. Owners may choose either canonical original, durably decline a version pair, preview and approve selected bookmark/shortcut and Chest-controlled link repairs, and undo unchanged repairs. Live source/destination/custodian rights and policy fence each change; external capability repointing requires separate owner approval. Pinned old-version references, originals, distinct grants and source approvals remain separate. Merge and reference Undo preserve intervening changes by refusing stale rows. HTTP flows cover actual intake provenance, supersession, different signature dates, governed decisions, separate ACLs, owner-only repair, pinned refusal, decline persistence and Undo; browser journeys cover lineage, reference repair/Undo, merge/Undo and decline at 1440 and 390.
- **AGENT-003.** A real file-backed Node companion persists queues and partial downloads, resumes exact immutable byte ranges, compares local and downloaded original SHA-256 values, and reports cache health. Browser diagnosis rechecks live folder/file access and exact current versions; a one-use, report-bound grant resumes only the selected owned device and folder. Stale, denied and uncertain work never becomes recovery by timeout. Divergent local bytes become a separate server conflict original while both local and current remote work are retained. Overwrite, cache deletion and permission expansion remain human decisions. Public-door product journeys interrupt a real download, restart, reconcile hashes, authorize a paused queue through the browser and retain divergent/revoked work at 1440 and 390. This bounded companion is not a signed filesystem or phone client under SYNC-001/MOBILE-001.
- **AGENT-005.** Explicit file/folder scan grants check current ACL and custodian access, departed collaborator evidence, intended audiences, live policies, exact versions and recorded link outcomes without reading unrelated file contents. Owners approve expiry, custodian, approved-version and guest-subset repairs; restrictive revocation is available to sharers. Standing grants run every 15 minutes on hosted Chest and on traffic, rechecking live authority; every action is reversible through stale-safe owner-approved Undo and sends an in-app/email notice. Make private keeps named grants. HTTP and browser flows exercise scoped refusal, decline, repair, revocation, retained named access and Undo at 1440 and 390; hosted sign-in and repair mail use the installation provider.

### Homepage claims evidence (docs/CLAIMS.md before 28 Oct 2026)

The hand-written claims file that docs/CLAIMS.md replaces, kept as it stood on main `c498000`.

#### Chest homepage: every capability claim and the code behind it

Maintained from `CONTRACT.md` on `just-every/run-chest` (19 Oct 2026) for the owner-approved page structure page-s1
(the hero, then one supplier's folder from the move-in on Sat, Sep 26 to the renewal, then the closing). Each row's
status and code come from the clause rows of CONTRACT.md's Status table. Every file named below exists on this checkout.

Status, from the clauses the claim maps to:
- **code**: every clause is done (implementing source and an exercising test).
- **partly**: some of it is in code; the clause's gap in `CONTRACT.md` names the rest.
- **contract, not yet in code**: no delivered product workflow yet; the page shows the product we are building toward
  (SEED-HOMEPAGE-PROCESS principle 12), and the clause is a build priority.

"Code" lists the evidence files of the claim's done and partial clauses. A claim's wording on the page lives in
`src/site/landing/copy.ts` and the drawings under `src/site/landing/`.

##### Summary

40 claim rows on the page-s1 homepage: **17 code**, **22 partly**, **1 contract, not yet in code**.

The page's one limit, "Not in Chest yet. No Linux desktop app, and no editor for CAD, video or design files.", states
what the contract leaves out (SYNC-001 names macOS and Windows clients only; SYNC-004 streams creative files to their
own desktop apps rather than editing them in Chest). It is not a capability claim and has no row.

##### Claims

| # | Section | Claim | Status | Clauses | Code |
| --- | --- | --- | --- | --- | --- |
| 1 | Hero | "Chest stores … your team's files" | partly | SPACE-001 (partial), CHEST-03 (done) | `src/chest/files/spaces.ts`; `src/chest/files/items.ts`; `src/chest/files/uploads.ts`; `src/chest/files/ui-item.ts`; `src/chest/files/ownership.ts`; `src/chest/files/ui-ownership.ts`; `src/chest/files/access-explanation.ts`; `tests/chest/ownership.mjs`; `tests/chest/browser-ownership.mjs`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/office/create-service.ts`; `src/chest/office/create-templates.ts`; `src/chest/office/create-settings.ts`; `src/chest/office/new-ui.ts`; `src/chest/files/governance.ts`; `src/chest/files/ui-governance.ts`; `tests/chest/new-files.mjs`; `tests/chest/governance.mjs`; `tests/chest/browser-new-files.mjs`; `src/chest/files/folder-metadata.ts`; `src/chest/files/ui-folder-metadata.ts`; `tests/chest/browser-governance.mjs`; `src/chest/blobs.ts`; `src/chest/documents.ts`; `tests/chest/flows.mjs` |
| 2 | Hero | "syncs" | partly | SYNC-001 (partial), SYNC-002 (partial) | `src/chest/files/sync.ts`; `src/chest/files/devices.ts`; `tests/chest/files.mjs` |
| 3 | Hero | "shares your team's files" | code | SHARE-004 (done), SHARE-001 (done), CHEST-10 (done) | `src/chest/files/shares.ts`; `src/chest/files/notify.ts`; `src/chest/files/people.ts`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/files/links.ts`; `src/chest/files/public-links.ts`; `src/chest/files/link-versions.ts`; `src/chest/files/link-policy.ts`; `src/chest/files/public.ts`; `src/chest/files/ui-link-form.ts`; `src/chest/files/ui-links.ts`; `tests/chest/link-versions.mjs`; `tests/chest/link-policy.mjs`; `tests/chest/browser-links.mjs`; `src/chest/files/governance.ts`; `tests/chest/browser-approved-links.mjs`; `src/chest/files/guest-links.ts`; `tests/chest/guest-links.mjs`; `tests/chest/browser-guest-links.mjs`; `src/chest/files/link-snapshots.ts`; `src/chest/files/link-comments.ts`; `tests/chest/link-discussions.mjs`; `tests/chest/browser-link-discussions.mjs`; `src/chest/access.ts`; `src/chest/metadata.ts`; `tests/chest/flows.mjs`; `tests/chest/restore.mjs`; `tests/chest/organization-link-controls-flow.mjs`; `src/chest/files/member-link-controls.ts` |
| 4 | Hero | "reads every scan" | partly | SEARCH-001 (partial) | `src/chest/read/rtf.ts`; `src/chest/read/jobs.ts`; `src/chest/read/pdf.ts`; `src/chest/read/office.ts`; `src/chest/read/heic.ts`; `src/chest/read/provider.ts`; `src/chest/files/views.ts`; `src/chest/api.ts`; `tests/chest/reading.mjs` (SEARCH-001 access: real RTF Unicode and code-page originals, excluded payloads, exact downloads, malformed input and truncation); `tests/chest/files.mjs` ; `src/chest/files/search.ts`; `src/chest/files/search-filters.ts`; `src/chest/files/ui-search.ts`; `tests/chest/search.mjs` (SEARCH-001 combined filters: current and retained RTF snippets and identities, content category and live revocation); `tests/chest/browser-search.mjs` (SEARCH-001 browser filters: RTF current and retained hits, reading states and tooltips at 1440 and 390, revoked snippets and suggestions); `src/chest/read/tiff.ts`; `tests/chest/scan-fields.mjs` (typed-folder TIFF text, page provenance, search and current access) |
| 5 | Hero | "quietly files what arrives" | partly | AGENT-001 (done), RULE-001 (done), CONNECT-006 (partial) | `src/chest/filing/agent.ts`; `src/chest/filing/agent-plan.ts`; `src/chest/filing/agent-scope.ts`; `src/chest/filing/agent-arrivals.ts`; `src/chest/filing/agent-notify.ts`; `src/chest/filing/provider.ts`; `src/chest/filing/shared.ts`; `src/chest/filing/ui-agent.ts`; `src/chest/files/notify.ts`; `src/chest/files/shares.ts`; `src/chest/files/ui-pages.ts`; `src/server.ts`; `tests/chest/filing.mjs`; `tests/chest/agent-filing.mjs`; `tests/chest/browser-agent-filing.mjs`; `src/chest/filing/rules.ts`; `src/chest/filing/batch-model.ts`; `src/chest/filing/batch-plan.ts`; `src/chest/filing/batch-apply.ts`; `src/chest/filing/batches.ts`; `src/chest/filing/transforms.ts`; `src/chest/filing/ui-batches.ts`; `tests/chest/arrival-rules.mjs`; `tests/chest/browser-arrival-rules.mjs`; `src/chest/filing/intake.ts`; `src/chest/filing/ui.ts`; `src/chest/filing/ui-intake.ts` |
| 6 | Hero | "100% free, open source" | code | OPEN-001 (done) | `LICENSE`; `THIRD-PARTY-LICENSES.md`; `scripts/third-party-licenses.mjs`; `tests/chest/open-source.mjs`; `docs/open-source.md` |
| 7 | Hero | "alternative to Google Drive, Dropbox and Box" | partly | SPACE-001 (partial), SYNC-001 (partial), SHARE-001 (done), MIGRATE-002 (partial), MIGRATE-003 (partial), MIGRATE-004 (partial) | `src/chest/files/spaces.ts`; `src/chest/files/items.ts`; `src/chest/files/uploads.ts`; `src/chest/files/ui-item.ts`; `src/chest/files/ownership.ts`; `src/chest/files/ui-ownership.ts`; `src/chest/files/access-explanation.ts`; `tests/chest/ownership.mjs`; `tests/chest/browser-ownership.mjs`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/office/create-service.ts`; `src/chest/office/create-templates.ts`; `src/chest/office/create-settings.ts`; `src/chest/office/new-ui.ts`; `src/chest/files/governance.ts`; `src/chest/files/ui-governance.ts`; `tests/chest/new-files.mjs`; `tests/chest/governance.mjs`; `tests/chest/browser-new-files.mjs`; `src/chest/files/folder-metadata.ts`; `src/chest/files/ui-folder-metadata.ts`; `tests/chest/browser-governance.mjs`; `src/chest/files/sync.ts`; `src/chest/files/devices.ts`; `src/chest/files/links.ts`; `src/chest/files/public-links.ts`; `src/chest/files/link-versions.ts`; `src/chest/files/link-policy.ts`; `src/chest/files/public.ts`; `src/chest/files/ui-link-form.ts`; `src/chest/files/ui-links.ts`; `tests/chest/link-versions.mjs`; `tests/chest/link-policy.mjs`; `tests/chest/browser-links.mjs`; `tests/chest/browser-approved-links.mjs`; `src/chest/files/guest-links.ts`; `tests/chest/guest-links.mjs`; `tests/chest/browser-guest-links.mjs`; `src/chest/files/link-snapshots.ts`; `src/chest/files/link-comments.ts`; `tests/chest/link-discussions.mjs`; `tests/chest/browser-link-discussions.mjs`; `src/chest/files/ui-movein.ts`; `public/chest-zip.js`; `public/chest-movein.js`; `tests/chest/organization-link-controls-flow.mjs`; `src/chest/files/member-link-controls.ts` |
| 8 | Hero collage | Contract co-edited by Dana and Luis | partly | EDIT-001 (partial) | `src/chest/office/service.ts`; `src/chest/office/codec.ts`; `src/chest/office/presence.ts`; `src/chest/office/ui.ts`; `src/chest/files/items.ts`; `tests/chest/office.mjs`; `docs/office.md` |
| 9 | Hero collage | Receipt 2026-10-09.jpg "Uploading 62%" | partly | TRANSFER-001 (partial), MOBILE-001 (partial) | `src/chest/files/uploads.ts`; `src/chest/blobs.ts`; `public/chest-upload.js`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/ui-library.ts`; `src/chest/files/ui-item.ts`; `tests/chest/journey.mjs` |
| 10 | Hero collage | Share link "expires Oct 31 · 3 of 10 downloads" | code | SHARE-001 (done) | `src/chest/files/links.ts`; `src/chest/files/public-links.ts`; `src/chest/files/link-versions.ts`; `src/chest/files/link-policy.ts`; `src/chest/files/public.ts`; `src/chest/files/ui-link-form.ts`; `src/chest/files/ui-links.ts`; `tests/chest/files.mjs`; `tests/chest/link-versions.mjs`; `tests/chest/link-policy.mjs`; `tests/chest/browser-links.mjs`; `src/chest/files/governance.ts`; `tests/chest/browser-approved-links.mjs`; `src/chest/files/guest-links.ts`; `tests/chest/guest-links.mjs`; `tests/chest/browser-guest-links.mjs`; `src/chest/files/link-snapshots.ts`; `src/chest/files/link-comments.ts`; `tests/chest/link-discussions.mjs`; `tests/chest/browser-link-discussions.mjs`; `tests/chest/organization-link-controls-flow.mjs`; `src/chest/files/member-link-controls.ts` |
| 11 | Hero collage | Version stack v7 (approved), v6, v5 | code | CHEST-07 (done), VERSION-001 (done) | `src/chest/documents.ts`; `src/chest/reviews.ts`; `tests/chest/flows.mjs`; `tests/chest/journey.mjs`; `src/chest/files/items.ts`; `src/chest/files/views.ts`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/office/ui.ts`; `public/chest-office.js`; `tests/chest/browser-new-files.mjs`; `tests/chest/office-restore-flow.mjs`; `src/chest/office/wopi.ts`; `public/chest-collabora.js`; `tests/chest/wopi-flow.mjs` |
| 12 | Hero collage | Scanned NDA with its date, party and amount boxed | partly | SEARCH-002 (partial) | `src/chest/read/jobs.ts`; `src/chest/read/decide.ts`; `src/chest/read/provider.ts`; `src/chest/read/ui.ts`; `src/chest/ui-document.ts`; `tests/chest/reading.mjs`; `src/chest/read/field-values.ts`; `src/chest/read/item-fields.ts`; `src/chest/files/folder-metadata.ts`; `src/chest/files/views.ts`; `src/chest/files/ui-item.ts`; `tests/chest/scan-fields.mjs`; `tests/chest/browser-scan-fields.mjs`; `src/chest/files/governance.ts`; `src/chest/files/ui-governance.ts`; `src/chest/files/ui-folder-metadata.ts`; `tests/chest/governance.mjs`; `src/chest/files/uploads.ts`; `tests/chest/files.mjs`; `src/chest/read/tiff.ts`; `src/chest/read/scan-policy.ts`; `tests/chest/ask-live.mjs`; `docs/ask.md` |
| 13 | Hero collage | "Filed W-9 Acme Supply.pdf → Vendors / Acme Supply / Tax · Undo" | code | AGENT-001 (done), RULE-001 (done) | `src/chest/filing/agent.ts`; `src/chest/filing/agent-plan.ts`; `src/chest/filing/agent-scope.ts`; `src/chest/filing/agent-arrivals.ts`; `src/chest/filing/agent-notify.ts`; `src/chest/filing/provider.ts`; `src/chest/filing/shared.ts`; `src/chest/filing/ui-agent.ts`; `src/chest/files/notify.ts`; `src/chest/files/shares.ts`; `src/chest/files/ui-pages.ts`; `src/server.ts`; `tests/chest/filing.mjs`; `tests/chest/agent-filing.mjs`; `tests/chest/browser-agent-filing.mjs`; `src/chest/filing/rules.ts`; `src/chest/filing/batch-model.ts`; `src/chest/filing/batch-plan.ts`; `src/chest/filing/batch-apply.ts`; `src/chest/filing/batches.ts`; `src/chest/filing/transforms.ts`; `src/chest/filing/ui-batches.ts`; `tests/chest/arrival-rules.mjs`; `tests/chest/browser-arrival-rules.mjs` |
| 14 | Move in | "Move from Dropbox, Google Drive or Box. Folders, permissions, versions and shared links come across." (import ledger: 48,212 files, 3,906 folders, 1,104 permissions kept, 61,870 versions) | partly | MIGRATE-001 (partial), MIGRATE-002 (partial), MIGRATE-003 (partial), MIGRATE-004 (partial) | `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs`; `src/chest/files/ui-movein.ts`; `public/chest-zip.js`; `public/chest-movein.js`; `tests/chest/browser-files.mjs` |
| 15 | Move in | Import ledger "Links inside files · 312 rewritten" | contract, not yet in code | MIGRATE-007 (missing) | — |
| 16 | Move in | "7 file names too long for Windows" · "Renamed and retried · 7 of 7 imported" | partly | MIGRATE-001 (partial) | `src/chest/archive.ts`; `src/chest/archive-target.ts`; `tests/chest/flows.mjs` |
| 17 | Move in | Terminal: `curl -fsSL https://runeditrun.com/install.sh \| sh -s -- dev just-every/run-chest`, then the comment `# Already have Node 22 or later? npx -y @runeditrun/rer dev just-every/run-chest` · "Chest is ready" | code | OWN-001 (done) | `docs/getting-started.md`; `docs/hosting.md`; `docs/server.md`; `scripts/server.mjs`; `scripts/portability/remote.mjs`; `src/chest/outbound.ts`; `tests/chest/owner-prepare.mjs`; `scripts/installer/local.mjs`; `scripts/installer/deploy.mjs`; `scripts/hosted-backup.mjs`; `scripts/hosted-restore.mjs`; `deploy.json`; `tests/chest/first-run.mjs`; `tests/chest/owner-computer.mjs`; `tests/chest/owner-server.mjs`; `tests/chest/owner-migration.mjs`; `tests/chest/owner-cloud.mjs`; `tests/chest/owner-cloud-restore.mjs`; `tests/chest/owner-egress.mjs`; `tests/chest/hosted-screens.mjs` |
| 18 | Follow one folder | The company drive: My files, Shared with me, Recent, team spaces Finance, Ops, Sales, Vendors | partly | SPACE-001 (partial), SHARE-004 (done) | `src/chest/files/spaces.ts`; `src/chest/files/items.ts`; `src/chest/files/uploads.ts`; `src/chest/files/ui-item.ts`; `src/chest/files/ownership.ts`; `src/chest/files/ui-ownership.ts`; `src/chest/files/access-explanation.ts`; `tests/chest/ownership.mjs`; `tests/chest/browser-ownership.mjs`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/office/create-service.ts`; `src/chest/office/create-templates.ts`; `src/chest/office/create-settings.ts`; `src/chest/office/new-ui.ts`; `src/chest/files/governance.ts`; `src/chest/files/ui-governance.ts`; `tests/chest/new-files.mjs`; `tests/chest/governance.mjs`; `tests/chest/browser-new-files.mjs`; `src/chest/files/folder-metadata.ts`; `src/chest/files/ui-folder-metadata.ts`; `tests/chest/browser-governance.mjs`; `src/chest/files/shares.ts`; `src/chest/files/notify.ts`; `src/chest/files/people.ts` |
| 19 | Follow one folder | Role chips "Dana · manager", "Luis · contributor", "Priya · guest"; "Shared with 4 people" | partly | ROLE-001 (done), SHARE-005 (partial) | `src/chest/files/access.ts`; `tests/chest/files.mjs`; `src/chest/files/guest-mutations.ts`; `src/chest/office/wopi.ts`; `tests/chest/guest-editing-flow.mjs`; `tests/chest/wopi-flow.mjs`; `tests/chest/collabora-live.mjs`; `tests/chest/role-review-flow.mjs`; `tests/chest/role-browser-matrix.mjs`; `tests/chest/annotation-flow.mjs`; `tests/chest/restriction-flow.mjs`; `tests/chest/browser-new-files.mjs` |
| 20 | Files that file themselves | "The Chest agent reads what arrives by email and from apps, names it, files it" (NDA.pdf from legal@acme.example, insurance certificate, Invoice-0042, scan_0931.pdf renamed W-9 Acme Supply.pdf; each with Undo) | partly | AGENT-001 (done), CONNECT-006 (partial), SEARCH-002 (partial) | `src/chest/filing/agent.ts`; `src/chest/filing/agent-plan.ts`; `src/chest/filing/agent-scope.ts`; `src/chest/filing/agent-arrivals.ts`; `src/chest/filing/agent-notify.ts`; `src/chest/filing/provider.ts`; `src/chest/filing/shared.ts`; `src/chest/filing/ui-agent.ts`; `src/chest/files/notify.ts`; `src/chest/files/shares.ts`; `src/chest/files/ui-pages.ts`; `src/server.ts`; `tests/chest/filing.mjs`; `tests/chest/agent-filing.mjs`; `tests/chest/browser-agent-filing.mjs`; `src/chest/filing/intake.ts`; `src/chest/filing/ui.ts`; `src/chest/filing/ui-intake.ts`; `src/chest/read/jobs.ts`; `src/chest/read/decide.ts`; `src/chest/read/provider.ts`; `src/chest/read/ui.ts`; `src/chest/ui-document.ts`; `tests/chest/reading.mjs`; `src/chest/read/field-values.ts`; `src/chest/read/item-fields.ts`; `src/chest/files/folder-metadata.ts`; `src/chest/files/views.ts`; `src/chest/files/ui-item.ts`; `tests/chest/scan-fields.mjs`; `tests/chest/browser-scan-fields.mjs`; `src/chest/files/governance.ts`; `src/chest/files/ui-governance.ts`; `src/chest/files/ui-folder-metadata.ts`; `tests/chest/governance.mjs`; `src/chest/files/uploads.ts`; `tests/chest/files.mjs`; `src/chest/read/tiff.ts`; `src/chest/read/scan-policy.ts`; `tests/chest/ask-live.mjs`; `docs/ask.md` |
| 21 | Files that file themselves | Insurance certificate "expires Sep 30, 2027 · reminder set" | code | CHEST-09 (done) | `src/chest/documents.ts`; `src/chest/ui-library.ts`; `tests/chest/flows.mjs`; `tests/chest/browser-flow.mjs` |
| 22 | Files that file themselves | "and closes links shared too widely" (Rate card.xlsx public link "limited to the Acme team", Undo) | code | AGENT-005 (done) | `src/chest/filing/link-model.ts`; `src/chest/filing/link-scan.ts`; `src/chest/filing/link-repair-actions.ts`; `src/chest/filing/link-repairs.ts`; `src/chest/filing/ui-link-repairs.ts`; `src/chest/files/exposure.ts`; `src/chest/files/ui-links.ts`; `src/chest/files/notify.ts`; `src/server.ts`; `deploy.json`; `tests/chest/link-repairs.mjs`; `tests/chest/browser-link-repairs.mjs` |
| 23 | On every desk and phone | "Files open on demand on Mac and Windows" (Finder with Chest, on-demand and downloaded states, "Free up space") | partly | SYNC-001 (partial) | `src/chest/files/sync.ts`; `src/chest/files/devices.ts`; `tests/chest/files.mjs` |
| 24 | On every desk and phone | "photos upload from the phone" ("45 of 48 uploaded · 3 waiting for Wi-Fi") | partly | MOBILE-001 (partial), TRANSFER-001 (partial) | `src/chest/ui-library.ts`; `src/chest/files/ui-item.ts`; `public/chest-upload.js`; `tests/chest/journey.mjs`; `tests/chest/browser-files.mjs`; `src/chest/files/uploads.ts`; `src/chest/blobs.ts`; `tests/chest/files.mjs` |
| 25 | On every desk and phone | "edits made offline come home safely" ("Conflict: Dana changed it too" · "Kept both · Luis chose v5") | partly | SYNC-002 (partial) | `src/chest/files/sync.ts`; `tests/chest/files.mjs` |
| 26 | Open it and edit together | "Word, Excel and PowerPoint files open in the browser" | partly | PREVIEW-001 (partial), EDIT-001 (partial) | `src/chest/office/codec.ts`; `src/chest/office/word.ts`; `src/chest/office/sheets.ts`; `src/chest/office/slides.ts`; `src/chest/office/service.ts`; `tests/chest/office.mjs`; `docs/office.md`; `src/chest/blobs.ts`; `tests/chest/browser-preview.mjs`; `src/chest/files/archive-preview.ts`; `tests/chest/archive-preview.mjs`; `tests/chest/browser-files.mjs`; `src/chest/office/presence.ts`; `src/chest/office/ui.ts`; `src/chest/files/items.ts` |
| 27 | Open it and edit together | "Edit at the same time, comment" (Pricing.xlsx with Dana and Luis, a resolved thread, "Saved · 2 people editing") | partly | EDIT-001 (partial), EDIT-003 (partial) | `src/chest/office/service.ts`; `src/chest/office/codec.ts`; `src/chest/office/presence.ts`; `src/chest/office/ui.ts`; `src/chest/files/items.ts`; `tests/chest/office.mjs`; `docs/office.md`; `src/chest/files/comments.ts`; `src/chest/files/ui-comments.ts`; `src/chest/files/api.ts`; `src/chest/files/views.ts`; `src/chest/files/notify.ts`; `src/chest/reviews.ts`; `tests/chest/files.mjs`; `tests/chest/annotation-flow.mjs`; `tests/chest/role-review-flow.mjs`; `tests/chest/browser-new-files.mjs` |
| 28 | Open it and edit together | "and keep one copy" | partly | EDIT-001 (partial) | `src/chest/office/service.ts`; `src/chest/office/codec.ts`; `src/chest/office/presence.ts`; `src/chest/office/ui.ts`; `src/chest/files/items.ts`; `tests/chest/office.mjs`; `docs/office.md` |
| 29 | Share out. Collect in. | "Send a link with a password and an expiry" (Contract pack: password on, expires Oct 31, 3 of 10 downloads, opened by priya@acme.example, Revoke) | code | SHARE-001 (done) | `src/chest/files/links.ts`; `src/chest/files/public-links.ts`; `src/chest/files/link-versions.ts`; `src/chest/files/link-policy.ts`; `src/chest/files/public.ts`; `src/chest/files/ui-link-form.ts`; `src/chest/files/ui-links.ts`; `tests/chest/files.mjs`; `tests/chest/link-versions.mjs`; `tests/chest/link-policy.mjs`; `tests/chest/browser-links.mjs`; `src/chest/files/governance.ts`; `tests/chest/browser-approved-links.mjs`; `src/chest/files/guest-links.ts`; `tests/chest/guest-links.mjs`; `tests/chest/browser-guest-links.mjs`; `src/chest/files/link-snapshots.ts`; `src/chest/files/link-comments.ts`; `tests/chest/link-discussions.mjs`; `tests/chest/browser-link-discussions.mjs`; `tests/chest/organization-link-controls-flow.mjs`; `src/chest/files/member-link-controls.ts` |
| 30 | Share out. Collect in. | "and ask for files back without an account" (file request to Vendors / Acme Supply / Onboarding, 2 of 2 received) | code | SHARE-002 (done) | `src/chest/files/file-requests.ts`; `src/chest/files/request-model.ts`; `src/chest/files/request-identity.ts`; `src/chest/files/request-uploads.ts`; `src/chest/files/request-submissions.ts`; `src/chest/files/request-public.ts`; `src/chest/files/request-panel.ts`; `src/chest/files/ui-public.ts`; `public/chest-request.js`; `src/chest/quota/storage.ts`; `tests/chest/file-requests.mjs`; `tests/chest/browser-file-requests.mjs`; `tests/chest/request-browser-flow.mjs` |
| 31 | Share out. Collect in. | Site survey.mp4 · 4.2 GB: "Connection dropped at 61%" · "Resumed where it stopped" | partly | TRANSFER-001 (partial) | `src/chest/files/uploads.ts`; `src/chest/blobs.ts`; `public/chest-upload.js`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs` |
| 32 | Every version, kept. | "Restore any earlier version in one click." (Restore v7; "v7 is current again · v8 kept in history") | code | CHEST-16 (done), VERSION-001 (done) | `src/chest/files/items.ts`; `src/chest/files/ui-item.ts`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/documents.ts`; `src/chest/files/views.ts`; `src/chest/office/ui.ts`; `public/chest-office.js`; `tests/chest/browser-new-files.mjs`; `tests/chest/office-restore-flow.mjs`; `src/chest/office/wopi.ts`; `public/chest-collabora.js`; `tests/chest/wopi-flow.mjs` |
| 33 | Every version, kept. | "A sign-off stays with the exact version that was approved." (v7 signed off by Dana and Priya; v8 not approved) | code | CHEST-07 (done), CHEST-08 (done) | `src/chest/documents.ts`; `src/chest/reviews.ts`; `tests/chest/flows.mjs`; `tests/chest/journey.mjs` |
| 34 | The right version reached everyone. | "The agent checks that everyone has the signed version" (v7 reached Dana, Luis, Priya, accounts@acme.example and the warehouse; the warehouse sent v7) | code | AGENT-004 (done) | `src/chest/collection/model.ts`; `src/chest/collection/api.ts`; `src/chest/collection/evidence.ts`; `src/chest/collection/reminders.ts`; `src/chest/collection/ui.ts`; `src/server.ts`; `tests/chest/collection.mjs`; `tests/chest/browser-collection.mjs`; `docs/collections.md` |
| 35 | The right version reached everyone. | "and that nothing is left open" (2 links open to a former contractor revoked; broken link in Ops handbook.docx points to v7; 63 files · 0 public links) | code | AGENT-005 (done) | `src/chest/filing/link-model.ts`; `src/chest/filing/link-scan.ts`; `src/chest/filing/link-repair-actions.ts`; `src/chest/filing/link-repairs.ts`; `src/chest/filing/ui-link-repairs.ts`; `src/chest/files/exposure.ts`; `src/chest/files/ui-links.ts`; `src/chest/files/notify.ts`; `src/server.ts`; `deploy.json`; `tests/chest/link-repairs.mjs`; `tests/chest/browser-link-repairs.mjs` |
| 36 | The right version reached everyone. | "3 invoices filed · 0 duplicates" | code | AGENT-002 (done) | `src/chest/filing/duplicates.ts`; `src/chest/filing/duplicate-authority.ts`; `src/chest/filing/duplicate-evidence.ts`; `src/chest/filing/duplicate-proposals.ts`; `src/chest/filing/duplicate-references.ts`; `src/chest/filing/duplicate-repair.ts`; `src/chest/filing/duplicate-view.ts`; `src/chest/filing/ui-duplicates.ts`; `tests/chest/filing.mjs`; `tests/chest/duplicate-reconciliation.mjs`; `tests/chest/browser-duplicates.mjs` |
| 37 | Find the sentence inside the file. | "Chest reads every document and scan, so search finds the words inside" ("net 30 acme": 3 results) | partly | SEARCH-001 (partial) | `src/chest/read/rtf.ts`; `src/chest/read/jobs.ts`; `src/chest/read/pdf.ts`; `src/chest/read/office.ts`; `src/chest/read/heic.ts`; `src/chest/read/provider.ts`; `src/chest/files/views.ts`; `src/chest/api.ts`; `tests/chest/reading.mjs` (SEARCH-001 access: real RTF Unicode and code-page originals, excluded payloads, exact downloads, malformed input and truncation); `tests/chest/files.mjs` ; `src/chest/files/search.ts`; `src/chest/files/search-filters.ts`; `src/chest/files/ui-search.ts`; `tests/chest/search.mjs` (SEARCH-001 combined filters: current and retained RTF snippets and identities, content category and live revocation); `tests/chest/browser-search.mjs` (SEARCH-001 browser filters: RTF current and retained hits, reading states and tooltips at 1440 and 390, revoked snippets and suggestions); `src/chest/read/tiff.ts`; `tests/chest/scan-fields.mjs` (typed-folder TIFF text, page provenance, search and current access) |
| 38 | Find the sentence inside the file. | "and only shows what you are allowed to see" | code | CHEST-06 (done) | `src/chest/access.ts`; `src/chest/api.ts`; `src/chest/blobs.ts`; `tests/chest/flows.mjs`; `tests/chest/browser-flow.mjs` |
| 39 | Closing | "Open source file storage for your whole team." | partly | OPEN-001 (done), SPACE-001 (partial) | `LICENSE`; `THIRD-PARTY-LICENSES.md`; `scripts/third-party-licenses.mjs`; `tests/chest/open-source.mjs`; `docs/open-source.md`; `src/chest/files/spaces.ts`; `src/chest/files/items.ts`; `src/chest/files/uploads.ts`; `src/chest/files/ui-item.ts`; `src/chest/files/ownership.ts`; `src/chest/files/ui-ownership.ts`; `src/chest/files/access-explanation.ts`; `tests/chest/ownership.mjs`; `tests/chest/browser-ownership.mjs`; `tests/chest/files.mjs`; `tests/chest/browser-files.mjs`; `src/chest/office/create-service.ts`; `src/chest/office/create-templates.ts`; `src/chest/office/create-settings.ts`; `src/chest/office/new-ui.ts`; `src/chest/files/governance.ts`; `src/chest/files/ui-governance.ts`; `tests/chest/new-files.mjs`; `tests/chest/governance.mjs`; `tests/chest/browser-new-files.mjs`; `src/chest/files/folder-metadata.ts`; `src/chest/files/ui-folder-metadata.ts`; `tests/chest/browser-governance.mjs` |
| 40 | Closing | "Free and open source, MIT licensed." | code | OPEN-001 (done) | `LICENSE`; `THIRD-PARTY-LICENSES.md`; `scripts/third-party-licenses.mjs`; `tests/chest/open-source.mjs`; `docs/open-source.md` |

##### Browser contract catch-up

The aggregate homepage rows above retain their incomplete dependencies. The
following browser clauses now have their own delivered workflows and exercising
public-door tests; their status matches the CONTRACT.md Status cell.

| Capability | Clause | Status | Code |
| --- | --- | --- | --- |
| Version-pinned delivery packages, resumable original downloads and distinct receipt events | SHARE-003 | done | `src/chest/transfers/service.ts`; `src/chest/transfers/public.ts`; `src/chest/transfers/ui.ts`; `tests/chest/transfers.mjs`; `tests/chest/transfer-large-flow.mjs`; `tests/chest/browser-transfers.mjs` |
| Match requested records to exact approvals and intended-recipient confirmations, with scoped reminders and reopening | AGENT-004 | done | `src/chest/collection/api.ts`; `src/chest/collection/evidence.ts`; `src/chest/collection/reminders.ts`; `src/chest/collection/ui.ts`; `tests/chest/collection.mjs`; `tests/chest/browser-collection.mjs` |

| External-sharing, trusted-domain and member/editor policy with recipient confirmation and reversible grant suspension | POLICY-001 | partial | `src/chest/files/sharing-policy.ts`; `src/chest/files/policy-suspensions.ts`; `src/chest/files/link-policy.ts`; `src/chest/files/ui-link-policy.ts`; `tests/chest/link-policy.mjs`; `tests/chest/browser-sharing-policy.mjs` |

| Independent encrypted S3/R2 backups, retention, status and upgrade recovery | RECOVER-002 | done | `scripts/backup/hosted.mjs`; `scripts/hosted/s3.mjs`; `tests/chest/backup-archive.mjs`; `tests/chest/browser-backups.mjs`; `tests/chest/backup-sandbox.mjs`; `tests/chest/upgrade.mjs` |

SHARE-003 was selected because sending originals and distinguishing delivery from
human receipt is central to browser file exchange. Signed sync/mobile clients
(SYNC-001/002, MOBILE-001, and dependent SPACE-001/SHARE-001 sentences) and direct
provider migrations/connectors were skipped: the former need the owner's signing
credentials, and the latter need provider developer applications or test tenants.

AGENT-004 was selected because browser teams need to finish collecting the right
approved material, rather than treating an upload or an email acknowledgment as
completion. It uses existing request, approval and staff identity workflows and
needs no native client, signing credential or provider developer application.

##### Additional delivered contract workflows

CHEST-23 is done. `tests/chest/hosted-lifecycle.mjs` (Hosted Chest email backup restore and removal), with `tests/chest/hosted-mail.mjs`, `tests/chest/hosted-data.mjs` and `tests/chest/hosted-screens.mjs`, proves real Cloudflare deployment, delivered owner and invitation email, private hosted-only backup, fresh deployment restore, both fresh email identities, exact graph and retained-original reconciliation including the full 150 MiB SHA-256 for both people, restored pages and tooltips at 1440 and 390, and both complete removals. CONTRACT.md records the live mail receipt identifiers and exact-candidate scale run sx-chest-c-i812-final. OWN-001 and all homepage claim statuses are unchanged.

AGENT-003 is done: `src/chest/sync-repair/service.ts`, `src/chest/sync-repair/ui.ts`, `scripts/sync-companion/run.mjs`, `tests/chest/browser-sync-repair.mjs` and `docs/sync-repair.md` deliver scoped sync diagnosis, authorized queue resume and byte verification with a real file-backed companion. The homepage sync rows remain partial because signed desktop and phone clients are still required.

CHEST-24 is done: `tests/chest/upgrade.mjs` and `tests/chest/upgrade-local.mjs` prove a populated genuine 0.1.0 installation upgrades in place with all earlier application rows and original objects preserved, every Library version downloadable by its original hash, and Files usable at 1440/390. This upgrade clause has no separate homepage claim; broader own-server and native-client claims retain their existing status.

ADMIN-003 and ADMIN-004 are done: `src/chest/administration/`, `src/chest/security/`, `tests/chest/administration.mjs` and `tests/chest/security.mjs` deliver enforced TOTP/WebAuthn, single-use recovery and help-desk resets, live delegated scopes, custom roles, content-free account/space recovery and accepted ownership transfer. Both browser journeys run at 1440/390. ADMIN-004 was selected because email verification alone should not open a team's browser file store; ADMIN-003 reduces dependence on one owner. Neither needs signing credentials or a provider developer application. Native-client clauses, provider migrations/connectors and signature-provider integrations were skipped because they require the owner's signing credentials, consented provider tenants or developer applications. These clauses have no separate homepage row; aggregate homepage rows retain their incomplete dependencies.


POLICY-001 was selected because browser teams must prevent unintended external
access and apply tighter rules to grants already issued. The browser and API
workflow needs no new provider account. It remains partial because the contract
also requires the same acceptance in provider connectors that have not shipped.
Signed native clients and direct provider migrations remain skipped for signing
credentials and provider developer applications respectively.

RECOVER-002 is done. The owner schedules and inspects independent encrypted
backups in Administration. The CLI supports Amazon S3, Cloudflare R2 and custom
S3-compatible HTTPS endpoints, including multipart archives and temporary
credentials. `tests/chest/backup-archive.mjs` exercises the complete recovery,
retention, scheduling and refusal paths at the provider boundary;
`tests/chest/browser-backups.mjs` proves owner controls, status and single failure
notices at 1440/390. `tests/chest/backup-sandbox.mjs` passed against the held
RunEditRun account's real R2 S3 API with independent bucket credentials, recovered
a clean target after corrupting live originals, and removed all its resources.
`tests/chest/upgrade.mjs` interrupted the genuine populated v0.1.0 upgrade after a
migration committed, recovered its private pre-upgrade archive into the prior
release, reconciled graph/originals/settings/identity/history and refused old
sessions. Recovered and upgraded pages passed at 1440/390. This supporting clause
changes no homepage wording or aggregate homepage claim.

##### Additional browser contract delivery

`SECURITY-003` is **partial**: browser/API suspect-upload quarantine, source pause, scoped notifications, keep/release/resume and stale-version protection are implemented in `src/chest/upload-protection/` and exercised by `tests/chest/browser-upload-protection.mjs`. See `docs/upload-protection.md` and the exact remaining scope in CONTRACT.md. This supporting clause does not make any additional homepage claim done.

`BULK-001` is **partial**: browser selections across folders/search, durable per-item move/copy/share/trash/restore jobs and streaming ZIP64 archives are implemented in `src/chest/bulk/`, with `tests/chest/bulk.mjs` and `tests/chest/browser-bulk.mjs` exercising them. See `docs/bulk.md` for the native/guest/large-download gaps. Homepage claim statuses remain unchanged.

`ERASE-001` is **done**: permanent file/record and departed-identity erasure, import-custody withdrawal, source fences, preservation refusals and per-store backup outcomes are implemented in `src/chest/erasure/` and `scripts/erasure/`. `tests/chest/erasure.mjs`, `tests/chest/erasure-archive.mjs` and `tests/chest/browser-erasure.mjs` exercise the public workflows. See `docs/erasure.md`. This supporting clause changes no homepage wording or aggregate homepage status.

`CONNECT-007` is **done**: documented scoped APIs, OAuth/PKCE, MCP, the embeddable picker, signed durable webhook delivery and organization/group app control are implemented in `src/chest/integrations/` and `public/chest-picker.js`. Public HTTP and real third-party HTTPS consumer journeys are in `tests/chest/integrations.mjs`, `tests/chest/browser-integrations.mjs` and `tests/chest/integration-client.mjs`; see `docs/integrations.md`. This supporting clause changes no homepage wording or aggregate homepage status.

ADMIN-001 is done under the owner-directed real Auth provider acceptance (question/default recorded with ct). Domain rules, owner-reviewed group changes and atomic offboarding are exercised through the real built Workers and the console at 1440/390. This does not claim certification against live Okta, Entra or Google tenants.

ADMIN-002 remains partial after the reporting slice: scoped activity/storage CSV and owner-entered USD storage estimates are delivered in `src/chest/administration/` and exercised by `tests/chest/administration.mjs`. Complete billed egress/AI and real Collabora capacity reporting remain required. Homepage row 37 keeps its partial status.

ADMIN-002 remains partial after external-guest inventory delivery: `src/chest/administration/report-guests.ts` and `tests/chest/administration-guest-flow.mjs` add scoped, filterable shared-link audiences and retained file-request identity evidence, current link policy/revocation states and complete CSV export. Configured recipients, historical verification and self-reported submission addresses have distinct labels; anonymous/domain audiences claim no known person count or live sessions. Existing privacy and erasure rules remain effective. Complete egress/AI attribution and Collabora reporting are still missing, so homepage row 37 stays partial.

VERSION-001 is done. Chest hosts the configured Collabora editor in a frame and checks for a new restore every 12 seconds with the editor token and current file authority. Only messages from that frame at the configured editor origin are accepted. The host sends the Collabora version-restore handshake; the engine saves, closes and reloads its document. Chest never discards the frame on a timer, and a pending reconciliation keeps the editor and its unsaved work available while stale writes remain refused. This proves the VERSION-001 restore door without claiming EDIT-001's broader review, packaging, provider or native acceptance. MIGRATE-002 through MIGRATE-006 inherit migration provenance; SIGN-001 retains its separate native acceptance. Version history, author, time, size, checksum, naming, retained downloads, contributor restore, stable links, viewer and commenter refusal, no-download enforcement, governed submission and once-only restore audit: `tests/chest/files.mjs` (VERSION-001) and `tests/chest/browser-files.mjs` (VERSION-001 browser journey at 1440 and 390). Built-in editor remote restores and preserved unsaved input: `tests/chest/office-restore-flow.mjs` (officeRestoreJourney, through `tests/chest/browser-new-files.mjs`). Collabora current-authority state, stale-write refusal and host protocol: `tests/chest/wopi-flow.mjs` (wopiFlow and collaboraRestoreJourney). Live Collabora receives restored DOCX and XLSX originals in already-open sessions at 1440 and 390: `tests/chest/wopi-flow.mjs` (liveCollaboraRestoreFlow), asserting the engine's post-restore WOPI original read in the public audit, exact bytes and unchanged retained history. Migration arrival and restored lineage: `tests/chest/flows.mjs` (CHEST-11) and `tests/chest/office-restore-flow.mjs` (migrationArrivalJourney). Signature arrival and source version: `tests/chest/signatures.mjs` (signed result flow).

The browser sharing and signing screens and the content-quarantine console provide icon-only control tooltips after 300 ms hover and immediately on keyboard focus. The existing organization-link, signing and content-security journeys audit these controls at 1440/390. SHARE-001 is done with the approved admission and equal-rights charging riders; SHARE-005 and SIGN-001 retain their implementation gaps. SIGN-001 now separates signing-key wrapping from session secrets and supports explicit owner-confirmed re-sealing without changing the certificate identity (`tests/chest/signatures.mjs`). SECURITY-002 streams originals to its bounded processor, with full-original 64 MiB resume and retry with tail-label proof in `tests/chest/content-security-flow.mjs`. No homepage claim status changes.

ADMIN-002 remains partial after dated original-stream egress delivery. Scoped emitted-byte receipts and CSV preserve confirmed provider quotes without historical repricing. Complete billed egress, AI spend and Collabora reports remain open. SECURITY-002 is done under the adopted policy, with contentSecurityFlow proving the real maintained-definition processor on a 64 MiB original, quarantine, retry, restart and exact hashes. Homepage claim statuses are unchanged.

SHARE-001 now applies the ct-approved password-session and equal-rights download rules through ordinary link and editor doors. Existing sharing journeys prove capped and revocable admission, PIN invalidation and send limits, shared guest expiry policy, and 1440 and 390 sign-out screens. SHARE-005 remains partial for its named larger-upload and native gaps; ROLE-001 and ADMIN-002 retain their unfinished implementation points.

ROLE-001 remains partial. The built-in DOCX editor now retains attributed tracked changes and contributor decision versions; file comments include access-checked mentions and assignment. The role review flow in `tests/chest/role-review-flow.mjs` runs through the built Worker and at 1440 and 390 through `tests/chest/browser-new-files.mjs`. The full folder role matrix, Collabora review parity, anchored annotations and print and copy restriction proof remain open. EDIT-001 and EDIT-003 remain partial; this does not claim their complete collaborative review loop.

ADMIN-002 remains partial after durable stream and dated provider accounting: rendered previews, selection archives and signing PDFs now join original receipts, and confirmed Collabora configuration, atomic reservation limits and scoped refusal CSV are delivered. The remaining contract Gap covers backup and portability billing, cached price tiers and live provider-side Collabora reconciliation. Homepage row 37 stays partial.

ADMIN-002 remains partial after scoped ZIP output accounting. The existing accountingJourney reconciles cancelled member bytes to the enclosing archive output and preserves those receipts across restart. Backup and portability billing, cached AI tiers and live Collabora reconciliation remain open; homepage row 37 stays partial.

ADMIN-002 remains partial after independent backup object-store receipts, quoted provider-specific cached AI tiers and observed Collabora product and version with browser-reported refusals. Restore billing and full portability reconciliation and provider-side licensed capacity remain open. Homepage row 37 stays partial.

ADMIN-002 remains partial under the conservative Collabora default: accountingJourney now proves legacy and independent portability receipts, immutable operation quotes and both provider transfer directions, with edition and limits explicitly administrator-recorded, an audited probe and refusal-to-admission reconciliation at 1440 and 390. Trusted provider-side licensed limits, live capacity and completeness of refusal reporting remain unknown. Homepage row 37 stays partial.

OWN-001 is done. `tests/chest/owner-computer.mjs` proves fresh macOS and Ubuntu libraries; `tests/chest/owner-server.mjs` and `tests/chest/owner-migration.mjs` prove Linux serving a second computer over owner-domain HTTPS, real staff invitation delivery, upload, sharing and retained-original downloads. `tests/chest/owner-cloud.mjs` and its continuation `tests/chest/owner-cloud-restore.mjs` deploy the same release, import the actual server archive, compare every portable record and original hash, and admit the same staff email only after a fresh owner invitation. `tests/chest/owner-egress.mjs` proves live egress denial and continued downloads on server and cloud. `tests/chest/hosted-screens.mjs` proves the restored owner and staff pages and tooltips at 1440 and 390. CONTRACT.md names the live jobs and mail receipts. The tunnel, test DNS record and cloud resources were removed, the whole zone diff is empty and the temporary deployment token is revoked. Homepage row 17 now has code; other claim statuses are unchanged.
