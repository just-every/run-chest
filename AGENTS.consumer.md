# Working on Chest

The public source is [just-every/run-chest](https://github.com/just-every/run-chest).
Read [AGENTS.md](AGENTS.md) for local commands, source ownership and the security
invariants to preserve, and [README.md](README.md) for supported product behavior.

Use Node 22.20.0 and pnpm 10.12.4. Run affected public flow tests and typecheck
when changing behavior. Exercise recovery only in a disposable fresh clone;
never enable `CHEST_TEST_CHECKOUT=1` on an installation containing owner data.

Preserve existing numbered migrations, immutable originals, current-session
access checks and exact-version review decisions. Keep private archives and
credentials outside source and served assets. Do not infer provider acceptance
from local verification; hosting and external mail require the owner's accounts.

Owners may modify the MIT source independently. Read [SOURCE.md](SOURCE.md) for
adopted source provenance and [ARCHIVE.md](ARCHIVE.md) before moving data.
