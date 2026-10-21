Chest can keep encrypted recovery copies in an owner's private Amazon S3,
Cloudflare R2 or S3-compatible bucket, separate from the live Worker's bucket and sync authority. The live
application stores only the schedule and outcomes. A separate machine holds the
backup credentials and the encryption key and performs the work.

In **Administration › Independent backups**, enter the independent bucket, choose
an interval and retention, and enable the schedule. Start the runner below: until
it contacts Chest the console says **Never**, and does not claim a backup exists.
**Request backup now** requests another run. Pausing a schedule prevents future
scheduled runs; it does not interrupt a run already writing an archive.

On the independent machine, use the same Chest revision and install dependencies.
Put these names in a private file, such as `/private/chest-backup.env` (mode 600).
Replace the synthetic credential examples with your private credentials:

```
CLOUDFLARE_ACCOUNT_ID=live-owner-account-id
CLOUDFLARE_API_TOKEN=synthetic-chest-1
CHEST_BACKUP_ACCOUNT_ID=backup-owner-account-id
CHEST_BACKUP_API_TOKEN=synthetic-chest-2
CHEST_BACKUP_BUCKET=independent-private-bucket
CHEST_BACKUP_KEY=64-hex-characters-from-32-cryptographically-random-bytes
```

The backup token must differ from the live token. For one account, the buckets
must also differ. Restrict the live credential to the live resources, and the
backup credential to its bucket. A different owner-controlled account also
protects against loss of the live account. Do not bind the backup bucket or put
its token or key in the live Worker. Keep a private copy of the encryption key
outside both stores: without it, recovery is impossible. Provider storage charges
belong to the owner's storage provider account; Chest charges nothing.

For Amazon S3 or an S3-compatible destination, keep the live Cloudflare settings
and encryption key above, and replace the backup account/token settings with:

```
CHEST_BACKUP_PROVIDER=s3
CHEST_BACKUP_S3_REGION=us-east-1
CHEST_BACKUP_S3_ACCESS_KEY_ID=synthetic-chest-3
CHEST_BACKUP_S3_SECRET_ACCESS_KEY=synthetic-chest-4
CHEST_BACKUP_BUCKET=independent-private-bucket
```

Amazon S3 uses `https://s3.REGION.amazonaws.com` by default. For another provider,
set `CHEST_BACKUP_S3_ENDPOINT` to its HTTPS origin (without a bucket, path, query
or embedded credentials), and use that provider's signing region. Requests use
path-style bucket addressing and AWS Signature V4. Temporary credentials also
need `CHEST_BACKUP_S3_SESSION_TOKEN`; replace them on the independent host and
restart the runner before expiry. With `CHEST_BACKUP_PROVIDER=r2` (the default), the original R2 account and
API-token configuration applies. Never place any destination credential in the
live application. The owner must enforce the separate account/bucket permissions
at the provider; the runner cannot certify IAM policy or account ownership.
Both destinations support multipart archives, readback, listing and retention.
Failed multipart uploads are aborted; failed readback removes only the newly
created archive. Provider retention or object lock can prevent deletion and
makes the run fail visibly rather than claiming retention succeeded.

Run the worker on the independent machine:

```sh
rer run backup-schedule --environment production --env-file /private/chest-backup.env --watch
```

Use your deployment's environment name instead of `production`. A service manager
can keep this running; alternatively run the same command without `--watch` once
per minute from cron. Work is serialized, and a durable claim prevents two runners
from publishing the same scheduled attempt. A runner that disappears mid-run
leaves **running**, never success. Inspect the private archive and runner before
clearing that uncertain attempt. A stopped runner cannot report its own outage;
the console exposes its last contact. Keep an external monitor on that service.

A successful run reads the encrypted object back, authenticates its archive and
checks every original's hash and size. Only then does the console show a verified
backup, with its date, object count, encrypted bytes and checksum. Retention
removes older archives after successful readback, always retaining the newest.
Failed runs stay visible and generate an in-app and email notice through the
installation's configured mail provider when Chest next processes its scheduled
work or a private request.

The archive includes current records, retained versions, original bytes,
comments, rules, migration mappings, audit and sanitized execution history.
Sessions, devices, provider secrets, MFA enrollments and reader keys do not
transfer. Link and request definitions are inert; old URLs and queued sending
jobs do not resume. Restored backup schedules are paused. Sign in anew and
reauthorize providers, devices, factors, sharing and sending after recovery.

To list and check an archive:

```sh
rer run backup-archive list --environment production --env-file /private/chest-backup.env
rer run backup-archive verify --environment production --env-file /private/chest-backup.env --key chest-independent/production/ARCHIVE.chestenc
```

For a recovery drill, stop writes, save the encrypted archive privately, and
deploy the **same Chest revision** into a separate empty environment. Use its
Cloudflare credential in a new private configuration file, preserving the
backup account and encryption key. Download the archive from the independent
bucket to a private path and run:

```sh
rer run backup-archive restore --environment recovery --env-file /private/recovery.env --input /private/archive.chestenc --erasure-journal /private/later-journal.json
```

Restore authenticates the entire archive, checks the migration ledger and all
referenced originals, requires empty product tables and original storage, then
writes and verifies originals before publishing the database. It refuses corrupt
or incomplete archives and populated targets. If an interrupted restore leaves
objects in the empty target, inspect and remove that disposable target and start
with a new empty one; never restore over owner data. Sign in through real mail,
compare record/version counts and downloaded SHA-256 values, inspect comments
and mappings, and confirm old sessions, device keys and shared links fail.
Record the drill outcome in your operating records. An archive check is not a
full recovery drill.

An old offline archive cannot reveal later erasures. Export the latest private
JSON journal from the source owner's `/api/chest/erasure/journal` before recovery.
Restore compares its `source` with the identity inside the archived database and
requires every supplied entry to exist unchanged in that archive's product
journal. A later erasure refuses the entire archive before any target writes;
partial filtering of retained import custody is not claimed. A post-erasure backup
can be restored with that journal. Early independent backups omitted their source
state and cannot pass a source-journal check: recover from a newer backup where
possible. A supplied journal with the wrong or missing source is always refused.

Without a journal, restore refuses unless the owner explicitly substitutes
`--acknowledge-offline-erasures`, accepting that unknown later erasures may return.
Journal freshness and provenance are the source owner's responsibility. `verify`
without a journal checks integrity only; it does not establish erasure safety.
The historical `hosted-restore` command takes the same two options. For local
`.rer` / `.chest` recovery use `node scripts/erasure/restore.mjs` as documented in
[ARCHIVE.md](../ARCHIVE.md).

Register known independent copies under **Administration → Permanent erasure**
before erasing. A registry entry identifies a location and retention terms; it
does not authorize the live Worker to access an independent filesystem. Erasure
receipts keep those targets pending until their removal is reported. Historical
backup-run keys and unknown/offline copies may require separate follow-up.

For owner-selected local copies, create a private registry file using the exact
registered IDs and location strings. `held: true` records a known preservation or
provider retention restriction and prevents deletion:

```json
{"format":"chest-erasure-backups-1","backups":[{"id":"registered-backup-id","name":"Recovery drive","locator":"/private/old-backup.rer","retention":"Owner controlled"},{"id":"retained-copy-id","name":"Retained copy","locator":"/private/held-backup.rer","retention":"Preservation hold","held":true}]}
```

Then select only the copies to delete and a new private receipt path:

```sh
node scripts/erasure/backups.mjs --registry /private/copies.json --backup registered-backup-id --backup retained-copy-id --erasure ERASURE_RECEIPT_ID --receipt /private/backup-deletion.json --yes
```

The CLI accepts absolute paths to private, owner-held, regular single-link
`.rer`, `.chest` and `.chestenc` archives. The archive itself cannot be a symlink;
parent directory aliases are resolved before checking the selected file. It authenticates each
selected archive before unlinking it, records its original SHA-256 and checks
that the registered path is absent. Encrypted copies require `CHEST_BACKUP_KEY`
in the environment. Pending outcomes are durably written before deletion begins.
Unavailable, unsafe or unverifiable copies remain pending; held copies remain
held. Exit 0 means all selected locations were verified removed; exit 2 means at
least one remains pending or held. A crash can leave a pending result even if the
file was removed: inspect it rather than inferring completion from absence.

The saved receipt contains `targets` with `backup`, `store`, `status`, `detail`,
`verified`, `locatorSha256` and (for a deleted copy) `sha256`. The source owner may
report each target to `POST /api/chest/erasure/ERASURE_RECEIPT_ID/backup-result`
through an authenticated same-origin request. Chest records the submitting owner
and verifies the registered locator hash. This is an explicit owner attestation
of local deletion; the Worker cannot independently inspect that filesystem. Do
not relabel it as independently confirmed provider removal.

Deletion removes the selected filesystem entry. It cannot recall other copies,
filesystem snapshots, offline drives or provider-retained objects, and does not
claim secure overwriting of physical media. Those stores keep their own pending
or held outcomes until the responsible owner/provider confirms their disposition.

Before upgrading, stop writes and make a verified private backup. Keep the old
Chest revision, its configuration and key privately. Upgrade a copy first. If
an upgrade fails, deploy the previous revision into a clean recovery environment
and restore its pre-upgrade archive using the steps above. Do not apply an old
archive over the changed schema. Check the restored product and originals
before directing staff to it.

For a local installation, stop its own server process and run
`rer export --output exports/pre-upgrade.rer` before upgrading. Keep that private
archive and the previous release. After an interrupted upgrade, leave the changed
store untouched, install the previous release in a new directory, place the
archive in its private `exports` directory and run
`rer import --input exports/pre-upgrade.rer --yes`, then `rer setup`. Sign in
afresh and confirm **Finish setup** in the browser. Reenter
private mail/provider settings from the owner's private configuration; the
archive carries no session secret. Sign in afresh, reconcile people, permissions,
settings, approval/comment history and every original before using the recovery
installation. The committed `tests/chest/upgrade.mjs` journey performs this drill
against the genuine prior release, interrupting the real upgrade after a migration
commits and before the new application becomes ready.

Cloudflare D1 export can briefly pause database requests. Schedule backups for
a quiet period; if a page reports a database error during export, reload it
after export finishes. D1 and R2 do not have a shared snapshot transaction. Quiesce writes for a strict
point-in-time backup/drill; missing referenced originals fail the backup. Restoration is ordered: verified originals first, then the database. There is
no cross-service transaction. If publication is interrupted, keep the archive,
discard the disposable incomplete target and restore into another empty target
using the prior revision and private backup. Never treat an incomplete target
as the only surviving copy.
