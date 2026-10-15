# Chest demo

After the ordinary `rer setup`, run `rer demo` (`rer dev --demo`) and open its
private `RER_OPEN` link. It opens signed in as the saved owner, on a finished
first run, in a lived-in sample library. `rer demo --stop`, Ctrl-C or the
demo's end (one hour) deletes its folder `.rer/demo/<start>/`; a new demo starts
afresh. The checkout's own `.wrangler/state` is never opened.

## Sample library

`src/demo.ts` (`seedDemo`, run once by Base's `withDemo` after the owner exists)
loads `src/demo-sample.ts`: Harbourworks, a small fit-out contractor, using the
names from the run-chest.com drawings. Every date is relative to the demo's
start.

- Five teammates (Maria Chen, Dan Hale, Priya Natarajan, Tom Okafor, and Elena
  Rossi still invited) as operator identities, mirrored into the library's
  people, plus the *Accounts team* and *Site leads* groups.
- Four document types (insurance certificate, supplier contract, procedure,
  permit or licence) and five collections with group and person grants.
- Fourteen records with their originals (PDFs, plain-text and Markdown
  procedures): approved versions, a renewal awaiting the owner's approval, a
  replacement with changes requested, one awaiting another reviewer, a private
  record, one in trash, review and expiry work that is upcoming, due, overdue or
  completed with evidence, and the audit trail that history leaves.

Originals go through Chest's own byte inspection and R2 custody
(`src/chest/blobs.ts`); records go into the same tables with fixed IDs and
`ON CONFLICT DO NOTHING`. Sample audit rows carry `{"sample":true}` as their
detail.

## What a demo sends

Chest's only outbound effect is operator mail (sign-in links and staff
invitations; Resend, SendGrid or Cloudflare in production). A demo sets
`MAIL_PROVIDER=development`, so nothing is sent: locally the development outbox
keeps it; on the hosted demo the development outbox is local-only, so mail is
unconfigured. Base's guard (`src/modules/demo`, `withDemo` first in
`src/server.ts`) answers loopback only for any other request, and the hosted
container has no internet. The vendored OIDC and dependency modules are not
wired into Chest.

## Hosted demo

`deploy-demo.json` puts the demo at `https://demo.run-chest.com/`;
`.github/workflows/run-demo.yml` deploys it on manual dispatch (or each push to
`main` once `RUN_DEMO_DEPLOY` is `true`) from the `run-demo` environment. With
`test_only` it deploys the separate test host `demo.test.run-chest.com` with
Turnstile's test keys; `test_only` with `remove_test` removes that host and
reads back that it is gone. Each visitor gets their own container running
Chest's image (`deploy.json` `platforms` includes `container`, workerd engine),
signed in through the signed owner claim at `/auth/owner-claim`, which
`src/auth.server.ts` serves only when `RER_OWNER_CLAIM_PUBLIC_KEYS` is set.
`rer deploy` refuses any declaration or settings carrying `RER_DEMO`.

## Base copy

`src/modules/demo` is Base `modules/demo` at tag `rer-v0.2.19`
(`e17843562355e1b6e5068289c8e037951fbc8d3d`) with Base's
`modules/operator-auth/csp.mjs` beside it as `csp.mjs`: Chest's operator-auth
copy predates that file, so `index.mjs` imports `./csp.mjs` (its only change).
`edition.json` maps both; the other files are unchanged.
