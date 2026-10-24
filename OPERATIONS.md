# Chest operations

Run all first-party operations from the composed, runnable edition checkout
with the shared RER command path. The detailed flags and effects are in
`RUN-LOCALLY.md` and `SEED-COMMAND-CONTRACT.md`.

```sh
rer install
rer setup --owner-email you@example.com
rer dev
```

Use the setup prompt instead of the owner-email flag when entering the real
mailbox. Open the printed `RER_OPEN` link on this computer; no email is sent.
Stop `dev` with
`rer dev --stop` or Ctrl-C, and stop `preview` with
`rer preview --stop` before build or verification.

```sh
rer verify
rer reset --yes
rer export --output exports/installation.rer
rer import --input exports/installation.rer --yes
rer deploy
rer describe
```

Use `rer describe` to inspect the checkout's actual
capabilities. `rer check --profile first-party` validates the
declared command contract; it does not run application journeys or contact a
provider.

## Local data and recovery

Setup and development use explicit owner identity and real local migrations.
Dev and preview use the same owner and canonical `.wrangler/state`. Any process
that can read the checkout's dev key can sign in as the owner. Private settings are
kept in `.dev.vars` with mode 0600 and are not copied into build output.

Local export creates a private archive with an integrity receipt and explicit
exclusions. Chest includes its native records, portable people and grants, audit,
import journal and all checksum-addressed R2 originals. Authentication state,
private settings and transient runtime state are excluded. Portable
people preserve attribution without granting a fresh authenticated session. Import validates and restores atomically
into an empty destination; confirmed reset preserves export archives. Run setup
after restore to establish a fresh owner. Each first-party seed verifies local
export/import/export equivalence across its supported resources. Remote transfer
is available only when the adapter declares complete resource coverage.

Preserve ambiguous state and applied migration history. Never place a remote
credential, owner secret or local resource ID in source. A schema change needs
a forward migration and verified transition/recovery.

## Deployment

`rer deploy --dry-run` validates the real owner-account
deployment declaration and builds locally without provider requests. Real
deployment requires privately supplied `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`, the declared owner/session/setup secrets, and a real
verified mail sender in `deploy.json`. Follow the owner-account deploy-kit
instructions under `node_modules/@runeditrun/rer/modules/deploy-kit`; account scope,
resource ownership, migrations, receipt and health checks are defined there.
Local validation does not prove hosted acceptance, provider delivery or remote
health.

## Reading scans

PDF and Office text is read inside the Worker with no outside service. Scans
and photos are read by the AI provider whose key the owner saves on People &
settings (Reading scans); see [docs/reading.md](docs/reading.md). The key is
sealed under `SESSION_SECRET` in the `chest_reader` table, which exports
exclude, so a restored or moved Chest needs the key entered again. Reading runs
in the background after requests, a page at a time, and needs the Workers paid
plan's CPU allowance for large PDFs and HEIC photos. On RER Managed hosting the
card says reading scans is not available yet, because Managed has no outbound
connection for AI providers.

## Hosted installation package

`packaging.json` declares Chest's existing build, verification, migration and
recovery commands. After the real build, run `pnpm delivery:spec` to refresh
`management/integration/deployment-spec.json`; `pnpm check:deployment-spec`
refuses a stale projection. The delivery producer packages the Worker, assets
and unchanged SQL with `node scripts/delivery/base/cli.mjs package --config
packaging.json --output rer-package`. Generated package and artifact folders
are disposable build output.

Managed hosting supplies the RER mail relay and its private installation key.
Assisted hosting asks for the selected provider, verified sender and provider
key, plus the relay URL or Cloudflare account where required. Local development
continues to suppress outbound email. Archive identity stays `documents/chest`.
