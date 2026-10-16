# Run it locally

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
rer dev just-every/run-chest
```

The first line installs `rer` for you alone, with its own Node if you have none. It changes no shell settings: if it prints an `export PATH=…` line, run that line before the second. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-chest` does both lines in one.

To start it again later, run `cd run-chest && rer dev`. To be the owner under your own address, run these from the checkout instead:

```sh
rer install
rer setup --owner-email you@example.com
rer dev
```

Chest is a private, owner-operated document library for supplier, customer and
project evidence. It keeps immutable originals, an exact approved version,
accountable review, typed metadata and enforced collection/document access.
Phase one needs no provider account. Local D1 and R2 persist under
`.wrangler/state`; local runs send no email.

The project site is at https://run-chest.com.

Open the `RER_OPEN` link on this computer and finish first-run setup. Treat that
link as a credential. Create staff from **People & settings**; with outbound
email configured they follow the emailed invitation and return through **Sign in**.
Deactivation revokes their sessions; session inspection also supports individual
revocation. Locally, `rer dev --as member` signs in as a separately gated
development persona to try a staff role.

Create a collection and a document type, then upload a record. The forms
accept typed fields as JSON. Owners can edit document types in **People & settings**;
saved values remain unchanged, and affected records show missing or invalid fields.
New uploads, replacements and filing changes validate against the current type.
Moving a record requires editor access to both its current record and destination
collection; collection access then follows its destination. Grant `reader`, `editor` and/or `reviewer` roles by
person email or group ID. A reviewer must be assigned to the exact version and
have current reviewer access. Uploading B leaves approved A current; approving
B cannot approve a later C. Requested changes remain attached to their original
version; resubmit by uploading a replacement, which needs its own exact approval. Review and expiry dates have separate completion
evidence. Only the owner moves records to trash or restores them; trash retains
all originals and history.

PDF and raster previews use browser viewers. UTF-8 text is served as sandboxed
plain text and searched with version/parser provenance. Unknown formats download
only; no Office renderer or OCR is claimed. Original files are limited to 8 MB,
searchable text to 500 kB. HTML and SVG never render as active content.

## Move-in and recovery

[ARCHIVE.md](ARCHIVE.md) describes the supported owner-created archive. Preview
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
recovery. Real deployment requires owner infrastructure and mail configuration;
local checks and dry-run are not provider acceptance.

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
and dependencies retain their licences.

The public source is [just-every/run-chest](https://github.com/just-every/run-chest).
