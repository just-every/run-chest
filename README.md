# Run it locally

```sh
npx -y @runeditrun/rer dev just-every/run-chest
```

No Node? `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-chest` does the same and brings its own Node; it changes no shell settings, so if it prints an `export PATH=…` line, run that line to use `rer` again later. To set Chest up without starting it, use `setup` in place of `dev`.

To start it again later, run `cd run-chest && rer dev`. To be the owner under your own address, run these from the checkout instead:

```sh
rer install
rer setup --owner-email you@example.com
rer dev
```

Chest is a private, owner-operated file system for a business's files: a free,
open source alternative to Google Drive, Dropbox and Box that you run yourself.
Phase one needs no provider account. Local D1 and R2 persist under
`.wrangler/state`; local runs send no email.

The project site is live at https://run-chest.com, and https://run-chest.com/run
shows how to run Chest. A local `rer dev` serves the same page at `/run` on the
`RER_SITE` address it prints.

Open the `RER_OPEN` link on this computer and finish first-run setup. Treat that
link as a credential. Create staff from **People & settings**; with outbound
email configured they follow the emailed invitation and return through **Sign in**.
Deactivation revokes their sessions; session inspection also supports individual
revocation. Locally no email is sent: `rer dev --as their@email` opens Chest as
someone you invited, and `rer dev --as member` as a separately gated development
persona. Space members, groups, Library access and document types are all set
with ordinary forms.

**Files.** Team spaces with viewer, commenter, contributor, content manager and
manager roles, each person's **My files**, and nested folders. Uploads are
dropped, picked or photographed on a phone, show progress and resume after a
dropped connection, up to 4 GB per file; every original is SHA-256 checked.
Each new upload over a file keeps the earlier versions, which can be restored
as current, and a folder or space can be restored to a date with undo. Trash is
self-service and reversible.

**Sharing.** Share a file or folder with people or groups at viewer, commenter
or editor, with an optional expiry; organization links; links for anyone with an
optional password, expiry and download limit, each revoked in one click; and
file requests that let anyone upload into a folder. **Links** lists what is
shared too widely, with **Make private**.

**Search and reading.** Search covers file names and the words inside PDFs and
Word, Excel, PowerPoint and OpenDocument files, read in the Worker, and scans
and photos, read by an AI model with the owner's own key. Every result follows
current access.

**The Library.** For records that need sign-off: create a collection and a
document type, then upload a record; the forms show each type's own fields.
Grant `reader`, `editor` and/or `reviewer` roles to people (by email) or groups. A
reviewer must be assigned to the exact version and have current reviewer
access. Uploading B leaves approved A current; approving B cannot approve a
later C. Review and expiry dates have separate completion evidence. Only the
owner moves Library records to trash or restores them; trash retains all
originals and history. Library originals are limited to 8 MB.

PDF and raster previews use browser viewers. UTF-8 text is served as sandboxed
plain text. Other formats, including Office files, download; there is no
in-browser editor and no desktop or phone sync app yet (**Sync devices** says
so and points to browser and phone uploads). HTML and SVG never render as
active content.

## Move-in and recovery

**Move in** brings a folder from your computer, or the `.zip` downloads from
Google Takeout (Drive), Dropbox and Box, into any space or folder with their
folder tree, through the same checked, resumable upload as any file; running it
again skips what arrived. Sharing, shared links, comments and earlier versions
from those services are not carried over yet. Steps for each service:
[docs/move-in.md](docs/move-in.md).

For the Library, [ARCHIVE.md](ARCHIVE.md) describes the supported owner-created archive. Preview
shows exact bytes, hashes, duplicate paths/bytes, mapping and unresolved people
or historical decisions. Applying the reviewed fingerprint creates private,
unapproved records. The Base D1 import journal supports restart, explicit resume,
untouched undo and native-edit conflicts. Existing source grants and approvals are
never activated implicitly.

Stop serving before export, import, build or verification:

```sh
rer dev --stop
rer preview --stop
rer export --output exports/library.rer
rer import --input exports/library.rer --yes
rer verify
rer build
rer preview
rer deploy --dry-run
rer describe
rer check --profile first-party
```

Import requires an empty destination. Full local archives include originals,
all versions, metadata, portable people/groups/roles/grants, responsibilities,
review decisions, evidence, trash, audit and import custody. Authentication
sessions, links, development credentials and provider secrets are
excluded. Run setup after restore to create new local credentials, then invite
staff again using the same portable email identities. Old credentials cannot
open the restored installation. Keep archives under `exports/`, outside served
assets; export refuses public directories and builds refuse archived public data.
Protect host storage and keep a separate backup copy under owner custody.

`rer reset --yes` removes local data and settings; review its inventory and export
first if data should survive. Setup reruns preserve saved identity, private
settings and data. See [RUN-LOCALLY.md](RUN-LOCALLY.md) for command flags and
recovery.

## Host it on Cloudflare

A hosted Chest runs on your own Cloudflare account (a Worker, a D1 database and
an R2 bucket for the originals) and signs people in by email through SendGrid
or Resend. The full guide is [docs/hosting.md](docs/hosting.md)
(https://run-chest.com/docs/hosting). In short, from a checkout set up with
`rer setup --owner-email you@example.com`, put the settings in an owner-only
file (`chmod 600 chest.env`):

```sh
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=             # fill in your Cloudflare token
MAIL_PROVIDER=sendgrid            # or resend; optional when only one key is set
MAIL_FROM=files@example.com   # a sender your provider has verified
SENDGRID_API_KEY=SG.your-key      # or RESEND_API_KEY
```

```sh
rer deploy --environment production --env-file chest.env --dry-run
rer deploy --environment production --env-file chest.env
```

Mail is chosen with these settings, never by editing `deploy.json`. Open the
printed address, **Sign in** with your setup email and follow the emailed link.
Back up the hosted Chest (database and every original) with
`rer run hosted-backup --environment production --env-file chest.env`;
`rer export` saves only the local copy. `rer run hosted-restore` restores a
backup into a fresh deployment. Remove it with
`rer deploy --environment production --env-file chest.env --remove --yes`, after a backup.

## Docs and run site

The owner guides live in [docs/](docs/) and [docs/site.json](docs/site.json)
lists them in order. `rer build --site` renders them with the homepage and the
Run page into `dist/site`, the static site `rer deploy --site` publishes;
`rer dev` serves the same site as `RER_SITE`.

## Verification and source

[CONTRACT.md](CONTRACT.md) maps public behaviors to tests.
`pnpm run test:chest` checks public HTTP flows against the built Worker.
`CHEST_TEST_CHECKOUT=1 pnpm run test:journey` is restricted to a disposable fresh
clone; it uses real RER verbs, two ordinary identities, responsive browser pages
and a second genuine clone for complete export/restore. Install Chromium with
`pnpm exec playwright install chromium` before the browser journey.
[ACCEPTANCE.md](ACCEPTANCE.md) describes verification and the separate acceptance
needed for owner data, upgrades and hosted operation.
[SOURCE.md](SOURCE.md) records pinned Base adoption and
Chest-owned changes. MIT applies to eligible shipped source; third-party fonts
and dependencies retain their licenses.

The public source is [just-every/run-chest](https://github.com/just-every/run-chest).
