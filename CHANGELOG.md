# Changelog

## Unreleased

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
