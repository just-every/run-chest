# Changelog

## Unreleased

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
