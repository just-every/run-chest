# Independent hosted recovery modules

Run with the checkout's Node (22.20+; built-in `node:sqlite`) and installed Wrangler:

```
node scripts/backup/cli.mjs backup --environment production --env-file /private/chest-backup.env --retention-days 30
node scripts/backup/cli.mjs list --environment production --env-file /private/chest-backup.env
node scripts/backup/cli.mjs verify --environment production --env-file /private/chest-backup.env --key chest-independent/production/KEY.chestenc
node scripts/backup/cli.mjs restore --environment recovery --env-file /private/recovery.env --input /private/archive.chestenc
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
- `recoverBackup(config, edge, {key? ,input?,apply?})`: authenticates every frame,
  validates manifest paths, lengths, hashes, SQLite integrity, sanitization,
  migration ledger and every referenced original. Default verifies only.
  `apply:true` additionally requires the same schema/migrations and empty product
  tables and R2 bucket before writing originals, verifies their readback, then
  publishes data with target-owned triggers. `input` permits restoring into a
  differently named clean environment. A listed `key` is scoped to its environment.

Scheduling/admin integration should keep secrets in the host's private
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

Limits requiring integration/evidence: there is no scheduler/admin view or alert
sender here, no upgrade/rollback automation, no real-provider recovery drill, and
no S3 adapter. Retention is deletion-based, with no provider object lock. Separate
credentials/bucket do not prove the Cloudflare token's actual scope; enforce and
audit scopes in owner infrastructure. R2 and D1 have no shared snapshot transaction:
quiesce writes for a strict point-in-time drill. Missing referenced bytes fail the
backup, and the database snapshot precedes the bucket listing. A failed restore
may leave verified originals in the previously empty bucket; it never publishes
the database after a failed object check. D1's multi-statement execution behavior
and interrupted publication require the real-provider drill before claiming
atomic recovery. Future authority tables/kinds need this policy updated; unknown
product tables are retained and their JSON secret fields sanitized.
