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

**Save identity provider** checks the provider address at once: for OpenID
Connect, Chest reads the provider's published sign-in settings (its discovery
document) and says so, or says what is wrong with the address. Then **Test
company sign-in** signs you in through
the provider and comes back to Chest. Then you may set **Email-link sign-in →
Off**: everyone else is signed out and unused links stop working. You stay signed
in, and `rer signin --environment NAME --env-file chest.env` on the computer that
deployed Chest still gets the owner in if the provider is down.

What Chest checks, for your security team: OpenID Connect uses the authorization
code flow with PKCE (S256) and `openid email profile` at the endpoints the
provider's discovery document names (each https and on the public internet; they
may be on different domains, as Google's are), ID tokens signed RS256 or
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
Google or Microsoft tenants. Google's live discovery document and the sign-in
request Chest sends to Google were checked against a hosted Chest.

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

## Sign-in domains

Under **People & settings → Sign-in domains**, list exact work-email domains allowed to use company sign-in. Blank allows every already-provisioned account. Subdomains need their own entries. Separately list domains that must use company sign-in; email links and existing local sessions for those domains are refused. Test the saved provider before requiring it. A change immediately ends company sessions outside the allowed list. A normal owner email session obeys the same rules; the installation's one-use `rer signin` recovery path remains available if a mapping or provider fails.

## Provider group changes

A SCIM change that removes members or deletes a group first removes only the affected effective memberships. It returns **409, owner review required**, so the provider never mistakes a pending change for a completed write. The complete change appears in **Provider group changes**, with the old name and removed/added people. Additions, renames and final deletion wait for the owner's **Apply reviewed group change**. A repeated provider request keeps the same review; a newer request supersedes it. Confirmation refuses changed group state or a revoked provisioning credential. **Decline group change** keeps removals denied and does not restore access. Retry provisioning after review when the provider reports its pending 409.

## Content when staff leave

Before SCIM deactivation or deletion changes identity status, Chest atomically transfers personal-area custody, Library responsible ownership, pending reviewers and typed-folder/file review assignments. The explicit default successor is the current installation owner. In **Content when staff leave**, the owner chooses another active successor for a person. Unavailable successors stop deactivation with a clear refusal. Existing team files stay in their space; originals, stable IDs, approved decisions and historical attribution do not change. Review assignment confers no file access. Manual offboarding uses the same transfer plan and retains delegated scope checks.

Web, editor/presence, device and scoped OAuth-agent doors recheck the current identity; deactivation also revokes device credentials. Public links and file requests that depend on that person's sharing authority stop working. Reactivation requires new sign-in, device and app authorization. Dependent public/organization links, file requests, app clients/grants, unattended filing/intake rules, automatic link scopes and collection reminders are explicitly revoked or disabled; changing the account back to active never resumes them. Installation-bound successor selections from another deployment require owner reconfirmation. If retained domain rules require a provider after restore, use the protected installation owner recovery path to configure the provider or allow email sign-in again.

## Space storage

Under **Space storage → Manage space storage**, service-settings admins set the organization personal-area and team-space defaults, group user limits and individual user or space overrides in bytes. A limited group beats the personal default; the largest limited group wins when a person belongs to several. A user override beats both. The console shows each area's effective limit and its rule. A blank user or space override explicitly permits unlimited storage; a blank group rule removes that group's limit. Zero permits no new retained bytes. Delegated admins see only areas and groups in their administrative scope, without gaining access to file contents.

Spaces inherit the current organization space default unless they have an override. SPACE-002 may give a new space a different starting limit. Current files, all retained versions and trash count; shared files count in their owning area. Identical originals count once per area; total storage counts them once across spaces and the library. Bytes are freed only by permanent erasure of the last retained reference.

Before saving a new or lower limit, Chest lists every affected area already above it, with usage and the proposed limit. Confirm that list before saving; a stale confirmation cannot authorize a changed list. Existing originals remain intact. Uploads, multipart completion, copies, moves and public file requests check live effective limits in the same database transaction as admission, so concurrent uploads cannot both consume the last capacity. A refused multipart completion can finish after the limit is raised, or after retained bytes are erased.

At 90% of a limit, the personal-area owner or space managers receive an in-app notice and email through the configured mail provider. Each crossing sends once; going below 90% rearms it. Local email remains suppressed. File and folder pages show the scope, exact usage, limit and effective rule. API refusals return `storage_limit_exceeded`, `scope`, `space`, `limitBytes` and `usedBytes`; every limit change records before/after values in the audit. Storage and other provider costs remain ADMIN-002 work. Native tray and mobile queue presentation belong to SYNC-003/MOBILE-001.

## Reproducing the core integration test

Build Chest. Clone `just-every/run-auth` separately, install its locked dependencies and run `pnpm exec vite build`. Then run:

```sh
CHEST_AUTH_CHECKOUT=/path/to/run-auth pnpm run test:organisation
node tests/chest/quota.mjs
```

The integration test runs both real built Workers on separate listeners and D1 stores. Only mail delivery is received at the network test edge. It creates an Auth company app, provisions Chest through Auth's SCIM connector, signs in through OIDC and SAML, and proves domain enforcement, reviewed destructive group changes, atomic content/assignment transfer, owner recovery, deactivation and token revocation. The test ages Auth's stored key publication timestamps; signatures and token expiration use the real clock. Live checks wait for the provider's normal key publication window and read real QA mail through the fleet receipt endpoint.
