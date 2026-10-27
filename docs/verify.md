# Verify a Chest installation

The acceptance text and status live in [CONTRACT.md](../CONTRACT.md), and [ACCEPTANCE.md](../ACCEPTANCE.md) is generated from it. This page keeps the source-verification steps.

- Use the pinned Node and pnpm versions and frozen dependencies in a fresh clone.
- Run `rer verify` for build, typecheck and current public HTTP flows.
- Run `CHEST_TEST_CHECKOUT=1 pnpm run test:journey` only in a disposable genuine fresh clone: it exercises ordinary identities, responsive browser pages at 1440 and 390 and complete export/restore.
- Never use that switch on owner data.
- See [README.md](../README.md) and [RUN-LOCALLY.md](../RUN-LOCALLY.md) for setup and commands.
- Check the Verify workflow on the exact source revision you intend to adopt.
- CI remains the full source wall.
- Read [ARCHIVE.md](../ARCHIVE.md) for current bounded move-in and legacy-backup limitations.
