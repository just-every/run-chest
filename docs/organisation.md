# Organisation sign-in, provisioning and space storage

The installation owner opens **People & settings**. All setup forms work without JavaScript.

## Company sign-in

**Company sign-in** lets people sign in with their work account from your
company's sign-in service, called the *identity provider* (Okta, Google
Workspace, Microsoft Entra ID and others), instead of an emailed link. Chest lets
in only people who already have a Chest account with the same email: invite them
under **People**, or turn on automatic user setup below. Company sign-in needs
Chest hosted at an https address (see [Host Chest](/docs/hosting)).

Open **People & settings › Company sign-in › Set up company sign-in**. It shows:

- **Chest's details for your provider**: the addresses your provider asks for
  when you create an app for Chest (the sign-in redirect URI for OpenID Connect;
  the reply URL and identifier for SAML; the SCIM base URL).
- **Step-by-step guides** for **Okta** and **Google Workspace** (OpenID Connect)
  and **Microsoft Entra ID** (SAML), naming each provider screen and which value
  goes where.
- **Your provider's details**, each with a line saying what it is: sign-in
  method, button name, provider address, client ID and client secret (OpenID
  Connect), how Chest sends the secret, the provider sign-in page and the
  provider certificate (SAML).

After **Save identity provider**, **Test company sign-in** signs you in through
the provider and comes back to Chest. Then you may set **Email-link sign-in →
Off**: everyone else is signed out and unused links stop working. You stay signed
in, and `rer signin --environment NAME --env-file chest.env` on the computer that
deployed Chest still gets the owner in if the provider is down.

What Chest checks, for your security team: OpenID Connect uses the authorization
code flow with PKCE (S256) and `openid email profile`, ID tokens signed RS256 or
ES256, and needs `email_verified` true. SAML needs a persistent NameID, an `email`
(or the standard emailaddress) attribute, and both the response and the assertion
signed with SHA-256. Client secrets are stored encrypted and never returned.
Sign-in attempts are tied to the browser, expire after ten minutes and work once.
A changed provider configuration must be tested again. Chest also serves its
SAML metadata at `/auth/company/metadata` once SAML is saved.

RER Managed has no seed-integration egress relay yet, so provider connections
there say **not available yet**.

The provider guides follow each provider's admin pages as of October 2026. The
OpenID Connect, SAML and SCIM flows are proven end to end against Run Edit Run's
own identity provider (see the integration test below), not against live Okta,
Google or Microsoft tenants.

## Automatic user setup

With **automatic user setup (SCIM)**, your provider adds people to Chest,
updates their names and turns them off when they leave. Okta and Microsoft Entra
ID can do this (their guides include it); Google Workspace cannot for apps like
Chest, so invite people under **People**.

In the provider's app, turn on SCIM provisioning and paste the SCIM base URL
shown in Chest (`/scim/v2`). **Issue SCIM token** shows a token once: paste it
where the provider asks for a bearer or secret token. Turn on creating users,
updating them, deactivating them and pushing groups. Use each person's email as
their username. The owner can name, issue and revoke tokens; only token digests
are stored.

SCIM users are ordinary members. Group membership becomes the existing Chest
group membership used for grants. Provider app role labels are retained for
reconciliation and grant no Chest authority. Deactivation immediately denies
browser sessions and device credentials; reactivation requires a fresh sign-in.
SCIM cannot adopt an existing local identity or change an owner. Email renaming
is refused: add the new address as a separate person so existing grants stay
with the original one.

Users and groups support creation, reads, replacement, PATCH and deletion. User deletion deactivates and reserves the identity; group deletion removes effective membership. Discovery, equality filters, pagination, resource locations and ETags are available. Provisioning mutations and token actions appear in the audit.

## Space storage

Under **Space storage → Manage space storage**, open a space or personal area and enter a limit in bytes. Leave it blank for unlimited storage; zero permits no new retained bytes. Only the installation owner sets a limit.

Usage counts actual retained original bytes, including earlier versions and trash. Identical originals count once per space; the total counts them once across spaces and the library. Lowering a limit preserves existing content and prevents growth. Uploads, multipart completion, copies, moves and public file requests all check the limit in the same database transaction as admission, so concurrent uploads cannot both consume the last capacity. A refused multipart completion can finish after the limit is raised.

Organisation defaults, group-based limit precedence and delegated service-settings administrators remain future work. Storage costs, egress costs and other provider charges are not estimated here.

## Reproducing the core integration test

Build Chest. Clone `just-every/run-auth` separately, install its locked dependencies and run `pnpm exec vite build`. Then run:

```sh
CHEST_AUTH_CHECKOUT=/path/to/run-auth pnpm run test:organisation
node tests/chest/quota.mjs
```

The integration test runs both real built Workers on separate listeners and D1 stores. Only mail delivery is received at the network test edge. It creates an Auth company app, provisions Chest through Auth's SCIM connector, signs in through OIDC and SAML, and proves deactivation and token revocation. The test ages Auth's stored key publication timestamps; signatures and token expiration use the real clock. Live checks wait for the provider's normal key publication window and read real QA mail through the fleet receipt endpoint.
