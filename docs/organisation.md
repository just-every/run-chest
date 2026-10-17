# Organisation sign-in, provisioning and space storage

The installation owner opens **People & settings**. All setup forms work without JavaScript.

## Single sign-on

Under **Company sign-in**, copy the callback address into the identity provider's application, then paste the provider settings into Chest:

- **OpenID Connect:** the exact issuer, client ID and client secret. Choose the provider's client-secret authentication method. Use authorization code, PKCE S256, and `openid email profile`. The provider must sign ID tokens with RS256 or ES256 and provide a verified email claim matching an existing Chest identity.
- **SAML 2.0:** Chest shows the entity ID and HTTP-POST ACS address. Paste the provider's entity ID, single sign-on URL and PEM signing certificate. Choose persistent NameID, map `email`, and sign both the response and assertion with SHA-256. HTTPS is required for the browser correlation cookie. Chest also serves SP metadata at `/auth/company/metadata` after SAML is saved.

Assign people to the provider app and provision or invite their Chest accounts. **Test company sign-in** completes a real provider sign-in and ends on the sign-in confirmation page. The owner can then set **Email-link sign-in → Off**. Other local sessions and unused email links are revoked. The current owner session is retained; the install operator can use `rer signin --environment NAME` for owner recovery if the provider is down.

A changed provider configuration must be tested again. Client secrets are encrypted at rest and never returned by the settings API. Transactions are browser-bound, expire after ten minutes and can be consumed once. OIDC verifies the signature, issuer, audience, nonce, times and access-token hash; SAML verifies signatures, audience, time and request correlation. Inactive identities cannot acquire a new session.

RER Managed has no seed-integration egress relay yet. Provider connections there say **not available yet**. Self-hosted installations can connect to their provider. HTTP loopback OIDC providers are allowed only in local development.

## Automatic user setup

In the provider application, choose SCIM 2.0 and paste the base URL shown in Chest (`/scim/v2`). **Issue SCIM token** shows the bearer token once. Paste it into the provider. The owner can name, issue and revoke tokens; only token digests are stored.

Enable user creation, profile updates, deactivation and group push. SCIM users are ordinary members. Group membership becomes the existing Chest group membership used for grants. Provider app role labels are retained for reconciliation and grant no Chest authority. Deactivation immediately denies browser sessions and device credentials; reactivation requires a fresh sign-in. SCIM cannot adopt an existing local identity or change an owner. Email renaming is refused: create a separate identity so existing grants stay with their original person.

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
