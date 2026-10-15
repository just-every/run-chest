# Chest source ownership

Chest adopts Base revision `10e569948863b7050e6645b7219b56007953b232` for its
runtime, operator-auth, mail, dependencies, owner-claim, import-kit and
edition-authoring source. `base-copies.json` records verbatim copies;
`edition.json`, `.edition/sources` and `sources.lock.json` retain comparison
provenance. The hydration README is adapted for package-mode commands, with its
original path mapped in `edition.json`; it makes no claim of byte equality.

The published `@runeditrun/rer` 0.2.19 is pinned exactly in `package.json` and
`pnpm-lock.yaml`. It owns command execution and archive format v2, whose integrity
digest binds the manifest, including source identity, erasure epoch and journal.
Version 1 archives require the acknowledged, backup-only recovery procedure in
[ARCHIVE.md](ARCHIVE.md#legacy-rer-backup-recovery); upgrading the source
installation and making a new export is preferred.

Chest owns `src/chest`, its UI/CSS, domain migrations, tests, installer adapter,
archive policy and consumer documentation. Its native import target uses
current-session SQL predicates, actor binding, atomic publication and exact
payload/revision snapshots. The command adapter retains original R2 objects and
the credential-free semantic graph; public-asset checks prevent private archives
entering built assets.

Preserve previously applied numbered migrations. Migrations `0001` through
`0007` retain their original schema; `0008` through `0015` adopt Base auth and
import-custody additions without rewriting existing records. The original auth
migration derives from `modules/operator-auth/accounts/schema/operator-auth.sql`
at Base `3d643dda1d203d36e3fa57e8e5ba14e414bba6f9`. Current additive schema copies
are recorded at the current adopted Base revision.

The installed root uses Base's Lobby and real `oa_first_run` claim state.
Chest adopts hydration helpers, document `no-transform`, static-asset routing
and deployment health. Chest owns `src/base/font-head.ts`, its font definitions,
`public/brand/mark.svg`, `public/rer-theme.css`, `public/chest.css` and
`public/chest-app.css`. Archivo, IBM Plex Mono and Caveat retain their licences.
The run site in `src/site` renders the landing page, `/run` and `docs/*.md`.

MIT applies to eligible source; adopted Base modules, fonts and dependencies
retain their licences. Logical edition, package and infrastructure identities
remain `documents/chest`, `@documents/chest`, `documents-chest`, `foundation` and
`chest-originals`. The public repository is
[just-every/run-chest](https://github.com/just-every/run-chest).
