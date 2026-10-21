# Independent hosted recovery modules

Run with the checkout's Node (22.20+; built-in `node:sqlite`) and installed Wrangler:

```
node scripts/backup/cli.mjs backup --environment production --env-file /private/chest-backup.env --retention-days 30
node scripts/backup/cli.mjs list --environment production --env-file /private/chest-backup.env
node scripts/backup/cli.mjs verify --environment production --env-file /private/chest-backup.env --key chest-independent/production/KEY.chestenc
node scripts/backup/cli.mjs restore --environment recovery --env-file /private/recovery.env --input /private/archive.chestenc --erasure-journal /private/later-journal.json
```

The private env file needs live `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`, plus `CHEST_BACKUP_ACCOUNT_ID`,
`CHEST_BACKUP_API_TOKEN`, `CHEST_BACKUP_BUCKET`, `CHEST_BACKUP_KEY`.
Generate the encryption key from 32 cryptographically random bytes, encoded as
64 hex characters. Retain it outside both the live deployment and backup bucket;
losing it makes recovery impossible. Never put the key on the command line.
The destination bucket must already exist and be private. Its credentials must
differ from the live credentials, and the bucket must differ from the live
bucket when using the same account. Restrict the live Worker's bindings and API
token to its live resources; restrict the backup credential to the owner bucket.
A distinct owner account also protects against loss of the live account. These
modules do not provision resources or deploy Workers.

`hosted.mjs` exports:

- `configuration(options)`: loads the private configuration; `environment`
  defaults to production. `key` is the encryption key only for callers using the
  module API; CLI `--key` always means the archive object key.
- `hostedEdge(config)`: production D1 export/query/execute and existing R2 client.
- `createBackup(config, edge, {retentionDays?})`: exports a real D1 snapshot,
  sanitizes a private SQLite copy, downloads and verifies every original, encrypts
  bounded AES-256-GCM frames, uploads and reads back the independent copy. Returns
  `{key, at, sha256, bytes, objects, removed}` only after readback succeeds.
- `listBackups(config, edge)`: newest-first `{key,size,at}` for the environment.
- `pruneBackups(config, edge, {retentionDays,now?})`: deletes expired backups from
  this environment's exact archive namespace, always retaining the newest one.
- `recoverBackup(config, edge, {key? ,input?,apply?,erasureJournal?,acknowledgeOfflineErasures?})`: authenticates every frame,
  validates manifest paths, lengths, hashes, SQLite integrity, sanitization,
  migration ledger and every referenced original. Default verifies only.
  `apply:true` additionally requires the same schema/migrations and empty product
  tables and R2 bucket before writing originals, verifies their readback, then
  publishes data with target-owned triggers. `input` permits restoring into a
  differently named clean environment. A listed `key` is scoped to its environment.
  Restore requires a source JSON journal path or explicit offline-erasure
  acknowledgment. A journal with a mismatched/missing archived source or later
  entries absent from archived `erasure-journal` records refuses the entire
  restore before target writes. `verify` without a journal checks integrity only.

The product schedule and status view in `src/chest/backups` integrate with
`scripts/backup/schedule.mjs`. Scheduling keeps secrets in the host's private
environment. Persist the returned nonsecret receipt as last success; catch a
failure as a failed run and alert through the currently authorized mail route.
Call the modules in a single serialized host job, outside the live Worker and its
sync authority. Do not overlap restores or allow user writes during a restore.
Call `verify` as a nondestructive archive check; a full drill calls restore into a
separately provisioned clean environment, then checks the real product API. These
modules expose no HTTP endpoint and grant no admin authority themselves.

Archive details: the encrypted payload contains a length-prefixed authenticated
manifest, sanitized `database.sqlite` and content-addressed originals. Each archive
gets a fresh HKDF key; each bounded frame gets sequence/length/header-bound GCM
authentication and an authenticated end marker. Plaintext authority is temporary
in a mode-700 OS scratch directory and removed in `finally`; a crash may require
removing an abandoned private `chest-independent-*` directory. `VACUUM INTO`
prevents deleted credential bytes from surviving in archived SQLite free pages.
No plaintext is placed in the checkout, assets or destination bucket.

Policies preserve product rows, IDs, revision strings, history, import mappings,
original checksums and bytes. Authentication/session/device/SCIM/MFA enrollment,
reader/provider credentials, setup/dependency authority and mail queues are
excluded. Public/member links and file requests retain definitions but lose old
capabilities; notice and send-job execution is suppressed; collection reminder
sending is disabled until explicitly authorized again. Backup schedules restore
disabled, outstanding requests/leases are cleared, and pending/running backup
execution records become interrupted history. Providers, MFA and devices must
be enrolled anew in the recovery deployment, whose env secrets remain its
own. Bootstrap/dependency IDs are newly minted during restore.
Source identity and erasure epoch remain in sanitized `rer_portability_state`;
its active import job and applying flag are cleared. Older archives which omitted
that row cannot establish a supplied source journal match. Product erasure
journal records and native portability fences are retained.

The public CLI supports R2 and Amazon S3/S3-compatible destinations. Set
`CHEST_BACKUP_PROVIDER=s3`, `CHEST_BACKUP_S3_REGION`,
`CHEST_BACKUP_S3_ACCESS_KEY_ID`, `CHEST_BACKUP_S3_SECRET_ACCESS_KEY`, and optionally
`CHEST_BACKUP_S3_SESSION_TOKEN`. Amazon S3's regional endpoint is the default;
`CHEST_BACKUP_S3_ENDPOINT` selects another provider's HTTPS origin. The bucket
and encryption key settings are unchanged. See `docs/independent-backups.md`.
`scripts/hosted/s3.mjs` shares the signed, bounded multipart object transport
with R2; completion must return success, and failed uploads are aborted. The owner console and
independent schedule runner record outcomes, and the live application sends
failure notices. Full recovery and upgrade drill evidence is tracked in
CONTRACT.md rather than inferred from an archive verification. Retention is deletion-based, with no provider object lock. Separate
credentials/bucket do not prove the Cloudflare token's actual scope; enforce and
audit scopes in owner infrastructure. R2 and D1 have no shared snapshot transaction:
quiesce writes for a strict point-in-time drill. Missing referenced bytes fail the
backup, and the database snapshot precedes the bucket listing. A failed restore
may leave verified originals in the previously empty bucket; it never publishes
the database after a failed object check. D1's multi-statement execution behavior
and interrupted publication require the real-provider drill before claiming
atomic recovery. Future authority tables/kinds need this policy updated; unknown
product tables are retained and their JSON secret fields sanitized.
