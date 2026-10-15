# Run it locally

```sh
npx -y @runeditrun/rer cli install
rer install
rer setup --owner-email you@example.com
rer dev
```

Read [README.md](README.md), [CONTRACT.md](CONTRACT.md), [ACCEPTANCE.md](ACCEPTANCE.md)
and [RUN-LOCALLY.md](RUN-LOCALLY.md). Chest owns its source and product policy.
[Source provenance](SOURCE.md) identifies the pinned foundation and adopted D1
import runtime. Preserve migrations already applied by an owner.

Local runs suppress mail: the email-link path is proven by `tests/chest/flows.mjs`
against the built Worker with mail received at the provider edge. Locally, staff
roles use the separately gated `dev --as` personas.
Never print dev keys, sign-in URLs, cookies or private settings.
Stop `dev`/`preview` before build, verification and transfer. No provider accounts
are needed for local product work. Real deployment and external mail are separate
owner-account operations.

Keep identity, blob custody, metadata, ACL, review and archives separate under
`src/chest`. Every private HTTP mutation checks its current session and origin.
Review decisions bind exact version IDs; assignment grants no access. Immutable
original bytes and approved pointers must survive replacements. Grant changes
apply to list/search/count/detail/preview/download and mutations. Trash is owner
only, reversible and never auto-destroyed. Imported history grants neither access
nor a new Chest approval. Portable people are distinct from authentication state.

The native import adapter and Base D1 journal share atomic SQL publication and
exact payload/revision snapshots. Preserve current-session SQL predicates and
actor binding; do not substitute cached authorization or mock targets. Full
archives include original R2 objects and the semantic graph while excluding
credentials. Never write private archives into public/source/build asset paths.

Run touched public flow tests and typecheck while iterating, then full verify
once on the accepted final source. Browser/recovery tests run from a genuine
fresh clone with `CHEST_TEST_CHECKOUT=1`; never use that switch on owner data.
No donor tests are copied. Keep tests small, public-door based and adversarial.
Do not introduce mock application code or AI stubs. Phase two is unimplemented.

Before heavy work check `sysctl -n vm.loadavg`; above 36 do light work and recheck.
Use `nice -n 15`, at most two workers and one heavy job at a time across agents.
Stop all owned servers and browsers. Do not read or print global secret files.
No automatic public release, repository visibility change or provider deployment.
