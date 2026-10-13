# Owner-created archive format

This parser supports documented shape `chest-archive-1`. It has synthetic-fixture
acceptance only; no real owner export or proprietary vendor parser is claimed.
A JSON archive contains exact original bytes as base64 with a SHA-256 and byte
count for every item. Keep the source archive and source system until acceptance.

```json
{
  "format": "chest-archive-1",
  "source": "supplier-records-2026-10",
  "items": [{
    "path": "Acme/certificate.txt",
    "title": "Acme certificate",
    "base64": "aGVsbG8=",
    "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    "size": 5,
    "fields": {"reference": "CERT-1"},
    "reference": {"kind": "supplier", "name": "Acme"},
    "reviewDate": "2026-12-01",
    "expiryDate": "2027-01-01",
    "sourceId": "source-document-42",
    "format": "original",
    "timestamp": "2026-10-01T00:00:00Z",
    "principals": ["unresolved@example.test"],
    "decisions": [{"actor": "source reviewer", "decision": "approved"}]
  }]
}
```

Select the target collection, document type, responsible owner and reviewer.
Fields must satisfy that schema. Every item is reconciled as admitted, skipped
(explicit `skip: true`), or rejected with a reason. Repeated paths are rejected;
identical hashes are reported but retain distinct document identities. Absolute,
empty, backslash and traversal paths reject the entire archive. Corrupt bytes,
size or checksum reject before any library record is written. Limits: 100 items,
16 MB JSON, 8 MB per original and 500 kB for searchable UTF-8 text.

Preview is read-only. Apply recomputes the exact reviewed fingerprint, checks
current owner authority inside journal transactions, retains original bytes and
publishes private/unapproved documents in bounded batches. Save the returned job
ID. **Move-in → Resume or undo** exposes progress across process restarts and
explicit resume. Undo removes only untouched import-created records. If an owner
edited any target, the conflict preserves that edit. Originals and history stay
in retained import custody. Recover edited batches using an independently restored
pre-import snapshot; there is no force-delete operation.

Source people and decisions remain attributed source history with visible gaps;
they are not invitations, ACLs or Chest approvals. Source timestamps and native
format/source IDs are retained separately from Chest decisions. This format
imports one original per record; version history requires explicit subsequent
replacement uploads. Office export derivatives must describe their source format.
Plain folder downloads supply no inferred historical rights or approvals.

## Legacy RER backup recovery

A full-installation `.rer` backup is separate from the `chest-archive-1` move-in
format above. Published rer 0.2.0 writes version 2 backups and refuses ordinary
version 1 import with `legacy_archive_unverifiable`. Prefer upgrading the original
Chest installation and exporting a new v2 backup while its writers are stopped.

If the original installation is unavailable and only a v1 backup remains, use a
fresh, empty Chest checkout with rer 0.2.0 and the same archive policy. Its schema
must match or differ only by supported later additive migrations. Run `rer install`,
but do not run setup or claim an owner before recovery. Keep dev and preview
stopped. Preserve the original backup and copy it to
`exports/backup-v1.rer` as a regular, private, single-link file (on macOS/Linux,
`chmod 600 exports/backup-v1.rer`). Then run:

```sh
rer import --input exports/backup-v1.rer --legacy-v1 --yes --acknowledge-unverified-metadata --output exports/recovered-v2.rer
```

`--yes` confirms restoring data; the separate
`--acknowledge-unverified-metadata` acknowledges that **all v1 manifest metadata
is unverified** by the complete archive binding available in v2. This includes
claimed source identity, export time, schema and object metadata, and erasure
epoch/journal; missing or altered erasure history and later deletions cannot be
reconstructed. Existing checksums establish consistency, not authorship.
Recovery retains the v1 checksum, content, schema, erasure, foreign-key and
product checks and refuses damaged archives or a populated destination. It is
local backup recovery only; it does not merge, overwrite or support remote or
container recovery.

The output must be a new safe path. The command restores the backup and writes
and verifies `exports/recovered-v2.rer`. That v2 archive binds the recovered data
and metadata from recovery onward; it cannot authenticate the original v1
metadata. Keep it under private backup custody. If its final export fails, the
restore and recovery audit remain: preserve that checkout and rerun
`rer export --output exports/recovered-v2.rer` to a new safe path.

After successful recovery, run `rer setup --owner-email you@example.com`, then
`rer dev --login` and use the ordinary local sign-in flow. Invite staff again
using the same portable email identities. Old sessions, sign-in links and
private settings do not travel in backups. Check the recovered records,
originals and access before returning to normal use. The new v2 backup can also
be restored with ordinary `rer import` into another empty installation.
