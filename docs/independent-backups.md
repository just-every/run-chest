Chest can keep encrypted recovery copies in an owner's private Cloudflare R2
bucket, separate from the live Worker's bucket and sync authority. The live
application stores only the schedule and outcomes. A separate machine holds the
backup credentials and the encryption key and performs the work.

In **Administration › Independent backups**, enter the independent bucket, choose
an interval and retention, and enable the schedule. Start the runner below: until
it contacts Chest the console says **Never**, and does not claim a backup exists.
**Request backup now** requests another run. Pausing a schedule prevents future
scheduled runs; it does not interrupt a run already writing an archive.

On the independent machine, use the same Chest revision and install dependencies.
Put these names in a private file, such as `/private/chest-backup.env` (mode 600):

```
CLOUDFLARE_ACCOUNT_ID=live-owner-account-id
CLOUDFLARE_API_TOKEN=live-d1-and-original-bucket-credential
CHEST_BACKUP_ACCOUNT_ID=backup-owner-account-id
CHEST_BACKUP_API_TOKEN=separate-backup-bucket-credential
CHEST_BACKUP_BUCKET=independent-private-bucket
CHEST_BACKUP_KEY=64-hex-characters-from-32-cryptographically-random-bytes
```

The backup token must differ from the live token. For one account, the buckets
must also differ. Restrict the live credential to the live resources, and the
backup credential to its bucket. A different owner-controlled account also
protects against loss of the live account. Do not bind the backup bucket or put
its token or key in the live Worker. Keep a private copy of the encryption key
outside both stores: without it, recovery is impossible. Provider storage charges
belong to the owner's Cloudflare account; Chest charges nothing.

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
rer run backup-archive restore --environment recovery --env-file /private/recovery.env --input /private/archive.chestenc
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

Before upgrading, stop writes and make a verified private backup. Keep the old
Chest revision, its configuration and key privately. Upgrade a copy first. If
an upgrade fails, deploy the previous revision into a clean recovery environment
and restore its pre-upgrade archive using the steps above. Do not apply an old
archive over the changed schema. Check the restored product and originals
before directing staff to it.

D1 and R2 do not have a shared snapshot transaction. Quiesce writes for a strict
point-in-time backup/drill; missing referenced originals fail the backup. Restoration is ordered: verified originals first, then the database. There is
no cross-service transaction. If publication is interrupted, keep the archive,
discard the disposable incomplete target and restore into another empty target
using the prior revision and private backup. Never treat an incomplete target
as the only surviving copy.
