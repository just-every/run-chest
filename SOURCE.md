# Chest source ownership

Chest adopts Base revision `f96363bf919ea3e7ed1837daba6894810a50e4a6` (tag `rer-v0.2.86`) for its
runtime, operator-auth, mail, dependencies, owner-claim, import-kit and
edition-authoring source. `base-copies.json` records verbatim copies;
`edition.json`, `.edition/sources` and `sources.lock.json` retain comparison
provenance, including their historical comparison origins. The hydration README is adapted for package-mode commands, with its
original path mapped in `edition.json`; it makes no claim of byte equality.

The published `@runeditrun/rer` 0.2.86 is pinned exactly in `package.json` and
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
`public/brand/` (the mark, favicons and run-site art), `public/rer-theme.css`, `public/chest.css`,
`public/chest-app.css`, `public/chest-files.css` and `public/chest-tools.css`. Inter, IBM Plex Mono and Caveat
retain their licenses.
The run site in `src/site` renders the landing page, `/run` and `docs/*.md`.

MIT applies to eligible source; adopted Base modules, fonts and dependencies
retain their licences. Reading (`src/chest/read`) bundles pdf.js through unpdf (Apache-2.0
and MIT), jpeg-js (BSD-3-Clause) and libheif-js (LGPL-3.0). libheif ships as its own
WebAssembly module (`libheif.wasm`), loaded unchanged, so it can be replaced. Logical edition, package and infrastructure identities
remain `documents/chest`, `@documents/chest`, `documents-chest`, `foundation` and
`chest-originals`. The public repository is
[just-every/run-chest](https://github.com/just-every/run-chest).

The demo, operator-auth, owner-claim, mail, dependencies and import-kit modules
are refreshed together from `rer-v0.2.86` (f96363bf919ea3e7ed1837daba6894810a50e4a6) with the edition-authoring tool's `refresh-base`,
including import-kit’s shared d1-transport dependency. Their exact copies are
recorded in `base-copies.json`; applied migrations remain unchanged.

Chest owns the reversible arrival-rule planner and executor in `src/chest/filing/batch-*.ts`,
its bounded Office-to-text and ZIP transforms, and the exercising HTTP and browser journeys.
The command package is pinned to `@runeditrun/rer` 0.2.86; copied Base modules retain
their separately recorded revisions.

The arrival agent uses explicit inbox/destination grants and the installation reader provider.
`src/chest/filing/agent-*.ts` owns classification plans, standing execution and current-access
notices; classification never grants permissions or assigns ownership.

Chest owns two-step sign-in under `src/chest/security`; it uses SimpleWebAuthn Server (MIT) for WebAuthn verification. TOTP secrets and public credential records are sealed to this installation. Portable archives exclude factor secrets, recovery codes, challenges, resets and proof sessions; sign-in policy remains, so a restored installation requires fresh enrollment. Hosted restore clears the deployment-bound factors without transferring their authority.

Chest owns delegated administrative authority, ownership offers and content-free recovery in `src/chest/administration`. Migration `0022_admin_roles.sql` preserves earlier native admins as explicit super-admin grants while removing their native content role; operator-auth remains an unmodified Base copy.

Chest owns the scoped integration protocol, OAuth/PKCE consent, native agent adapters, picker component and durable signed webhook queue in `src/chest/integrations/` and `public/chest-picker.js`. Migration `0023_integrations.sql` stores sealed installation-only credentials and event publication proofs; portable archives exclude this table and hosted restore clears it. Product records retain grants and outcomes without transferring their authentication authority.

The agent door, Business settings/people, operator-auth and theme/icon dependencies are recorded from Base `f96363bf919ea3e7ed1837daba6894810a50e4a6` (release `rer-v0.2.86`). `record-base --base-archive` recorded the immutable source without changing applied migrations; new core migrations 0029–0031 install the door and signed Business people mapping. `base-copies.json` records each independent revision. Migration 0032 is Chest’s native erasure/admission custody fence. The runtime remains an unmodified Base copy; Chest owns `src/chest/agent-door` and the public-door fixtures in `tests/agent-door`. Installation-only door/Business tables are excluded from portable and independent backups and cleared by hosted restore; product activity keeps attribution and a restored installation must pair again.
