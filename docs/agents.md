Chest’s existing integration API and legacy MCP tools act for a named person under their current file permissions and app policy. The shared Base Agent runtime, company-controlled Ask spend caps and reporting, decisions by class per agent, and a global **Pause agents** control are not implemented yet. Connected apps supports individual grant revocation and app-policy refusal.

## Choose grant budgets

The real OAuth consent screen names the app, person, roots and actions. It shows requested budgets and lets the granter choose a request total, mutation total and original-byte total before authorizing. Leave any field blank for **No grant limit** on that dimension. Omitting a budget parameter has the same meaning. There is no implicit daily request, mutation or byte cap on a new grant. Setting a field to **0** refuses that work with HTTP 429. Explicit finite limits remain enforced. Previously saved grants keep their existing limits and usage; authorizing a new grant does not widen them.

Budgets cover the grant’s 24-hour lifetime and do not reset at midnight. A grant expires after 24 hours; another grant needs fresh consent. Connected apps shows each saved grant’s budget and usage. Revocation, current access, app policy, storage quotas and security pauses still apply when a budget has no limit.

Each integration API call consumes one request, including a refused operation or idempotent replay after request admission. A committed mutation consumes one mutation; replaying its idempotency key never files it again. Uploads charge newly admitted original bytes. Downloads charge the selected original’s full size, including a range read. Webhook attempts also use the grant’s request budget. A budget refusal returns HTTP 429 with an error identifying the exhausted dimension and produces no new file or original download.

## Installation capacity and pacing

Capacity bounds protect the installation independently of a person’s grant choices:

- The existing inline integration upload door accepts originals up to **8,000,000 bytes**. Plain-text originals have a separate **500,000-byte** inspection bound. Larger originals need Chest’s resumable browser upload door; the integration door does not yet expose it.
- Integration request bodies must be below **20,000,000 bytes** and inline base64 must be valid. File names and normal quota and content-security rules still apply.
- Read pages contain at most **100 items**. Follow the opaque `nextCursor` until it is null and reconcile stable item and version IDs and original SHA-256 hashes.
- This edition configures **no fixed requests-per-minute throttle** for integration calls. Send requests **one at a time**, wait for each response and back off on capacity or transport refusals. Respect any provider or hosting rate limits. This is pacing guidance, not a measured throughput promise or a grant budget.

For 500 internal-folder arrivals, authorize the destination and the needed upload, read and download actions, leave budgets blank, and file sequentially with a distinct idempotency key per arrival. Retain returned IDs and source hashes; after an interruption reuse the same keys, then reconcile every listed ID and downloaded original. A no-limit grant never bypasses a revoked credential, a restricted folder or a blocked app.
