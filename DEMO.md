# Chest demo

After the ordinary `rer setup`, run `rer demo` (`rer dev --demo`) and open its
private `RER_OPEN` link. It opens signed in as the saved owner, on a finished
first run, in a lived-in sample library. The product name in the nav and the
page title read **Chest Demo** (**Chest Dev** under `rer dev`); nothing else is
added to the page. `rer demo --stop`, Ctrl-C or the demo's end (one hour)
deletes its folder `.rer/demo/<start>/`; a new demo starts afresh. The
checkout's own `.wrangler/state` is never opened.

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

Every feature works in a demo. Chest's only outbound effect is operator mail
(sign-in links and staff invitations; Resend, SendGrid or Cloudflare in
production). Under `RER_DEMO`, `src/mail.server.mjs` uses Base mail's
development sender, which validates each message and suppresses it silently:
an invitation completes as it would in production and nothing is sent. Chest
reads nothing from the public internet; Base's guard (`src/modules/demo`,
`withDemo` first in `src/server.ts`) lets any public read run for real and
answers any external write with a provider success. The vendored OIDC and
dependency modules are not wired into Chest.

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

`src/modules/demo` is Base `modules/demo` at tag `rer-v0.2.24`
(`1ee378e41142c673a9098f60af21664c6d8477d1`), unchanged. It uses
`src/modules/operator-auth/http.mjs` and `csp.mjs`, recorded with the other
operator-auth copies in `base-copies.json` at the same revision.
