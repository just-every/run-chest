# Permanently erase files or a departed identity

Open **Administration → Permanent erasure** as the installation owner. Trash is reversible; erasure is a separate, deliberate action. Space managers and personal-area owners can also erase their own trashed trees from Trash.

Register known private backup locations before erasing. The registry stores a location reference and provider retention description, never credentials or an authenticated URL. An offline copy cannot be recalled. Known independent backup runs are also listed as pending in the operation outcome until their storage operator confirms removal. A result is never complete merely because a provider is unreachable.

Select a trashed file, folder or Library record. Every retained version, its derived readings, comments, related link/guest/request authority and operation snapshots are removed. Imported records additionally withdraw their retained source originals, staging, provenance and reversal copies, with source/target fences against re-import. An original still independently required by another record remains in storage; the receipt counts it as shared. While object deletion is pending, admission of the same original is fenced to prevent a concurrent publication losing its bytes.

For a departed person, select their address and type it again. The owner cannot erase their own active identity. Chest revokes authentication, sessions, tokens, external identities, factors and device credentials, removes their personal area and direct grants, withdraws import custody containing the address, and anonymizes retained team authors and audit events with a one-way alias. Team file originals remain unchanged. Audit details for erased content are minimized.

Record a preservation instruction for a file, Library record or person to refuse erasure of that subject or any selected containing tree. A held operation changes no originals. Release the instruction and make a new deliberate erasure request when authorized. These are explicit owner/provider preservation outcomes, not a certification of regulated legal-hold services.

Each operation persists a per-store outcome. Original deletion can be retried after an interruption. If a request stops before metadata publication, it remains pending: inspect it and request the same still-present subject again. Nothing is reported complete by elapsed time.

## Private backup copies

Export registered locations from `/api/chest/erasure/backups`, saving the JSON privately. Use the deletion tool on the computer holding the copies:

```sh
node scripts/erasure/backups.mjs --registry exports/copies.json --backup BACKUP_ID --erasure OPERATION_ID --receipt exports/deletion.json --yes
```

The tool authenticates a private regular archive, verifies its identity before unlinking, and reads back its absence. Unreachable copies stay pending; policy-retained copies stay held. It does not erase filesystem snapshots, another person's copies or provider-retained generations. For an encrypted independent archive, provide `CHEST_BACKUP_KEY` in the environment.

An owner may submit each saved receipt target to `POST /api/chest/erasure/OPERATION_ID/backup-result` using an authenticated same-origin session. The target must name a registered copy and its exact location digest; a complete result requires `verified: true` and the deleted archive's SHA-256. Chest labels this as an **owner-confirmed** result; the Worker cannot independently inspect a private computer. Provider restrictions and other copies remain separate outcomes.

## Restore after erasure

Download the current source journal from **Export the later erasure journal**, and keep it beside private backups. Chest's restore wrapper validates the complete archive and its source identity and refuses an older archive missing any supplied later erasure, before changing the destination:

```sh
node scripts/erasure/restore.mjs --input exports/before.rer --erasure-journal exports/later-journal.json --yes
```

The ordinary `rer import --input before.rer --journal later.rer --yes` also enforces the native source tombstones and redaction epoch when given a later full export. A historical archive alone cannot tell you about subsequent erasures. Recovery without a later journal requires explicitly acknowledging that unknown in Chest's wrapper and hosted recovery tools. See [archive recovery](../ARCHIVE.md) and [independent backups](independent-backups.md).
