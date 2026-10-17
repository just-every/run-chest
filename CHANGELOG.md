# Changelog

## Unreleased

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
- `@runeditrun/rer` is pinned at 0.2.45, whose `rer export --origin <hosted>` refuses and names the hosted export.
