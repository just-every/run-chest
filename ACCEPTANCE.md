# Verify a Chest installation

[CONTRACT.md](CONTRACT.md) defines Chest's supported behavior and maps each
requirement to the public HTTP and browser/recovery journeys.

## Source verification

Use the pinned Node and pnpm versions and install frozen dependencies in a fresh
clone. Run `rer verify` for the build, typecheck and public HTTP flows. Run
`CHEST_TEST_CHECKOUT=1 pnpm run test:journey` only in a disposable fresh clone:
it exercises ordinary identities, responsive browser pages and complete
export/restore. Never use that switch with owner data. See [README.md](README.md)
and [RUN-LOCALLY.md](RUN-LOCALLY.md) for setup and commands.

Check the Verify workflow on the exact source revision you intend to adopt.
A passing source check does not establish hosted operation or migration fidelity
for an archive the tests did not exercise.

## Installation acceptance

Before moving real records, reconcile a representative archive's originals,
versions, people, timestamps and missing history. Confirm current access grants,
exact-version review, archive reconciliation and recovery with your own records.
Documented-shape test fixtures do not establish compatibility with every vendor
export or prove reduced administration costs.

Before upgrading an existing installation, preserve a private backup and test
the candidate against a copy of its data. Verify ordinary sessions, private
settings, first-run state, access rules, records and original bytes survive.
A fresh installation or empty-target restore does not prove an in-place upgrade.

Remote hosting, external email, operational backups and provider limits require
separate checks with the owner's infrastructure and accounts. Keep credentials
and records outside the source tree and served assets.

## Scope limits

Chest supplies browser PDF/raster viewing and bounded UTF-8 text search. It does
not supply universal rendering, OCR, an accessibility audit, statutory retention,
WORM, legal hold, certification, e-signature validity, a sync client, Office editing
or AI jobs. Read [ARCHIVE.md](ARCHIVE.md) before data transfer and recovery.
