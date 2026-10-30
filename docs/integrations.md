# Scoped apps, MCP and the file picker

Chest serves OAuth authorization-code grants with S256 PKCE, a scoped HTTP API, a JSON-RPC MCP server and an embeddable JavaScript file picker. Open **Connected apps** at `/app/integrations` to register an app, inspect its users, resources, actions, budgets and last use, revoke it or inspect webhook delivery outcomes. The same controls are available to admins with the relevant ADMIN-003 sharing and security scope; a group-scoped admin manages only their groups.

Every call uses the authorizing person's current identity, groups, file permissions and sharing policy. A grant never adds file access. Its explicit roots include only descendants the person can currently open. A moved-out, restricted, trashed or otherwise inaccessible item is refused. Download restrictions also apply to originals, including range requests, and each original stream chunk rechecks live authority. Revoking a grant or blocking its app stops its next request. Imported people have no authentication authority.

## Register and authorize

Register using an ordinary signed-in session and the same-origin rules:

```http
POST /api/chest/integrations/clients
Content-Type: application/json

{"name":"Partner attachments","redirects":["https://partner.example/oauth/callback"],"pickerOrigins":["https://partner.example"],"actions":["read","search","picker","upload"],"confidential":false}
```

Registration returns `client.id`. Redirect URLs match exactly, including path and query; wildcards and fragments are refused. Picker origins are exact HTTPS origins. A confidential server client gets a secret once and sends it as `client_secret` during token exchange. Public browser clients use PKCE without a client secret. Do not put client secrets in browser code. Registration itself does not authorize access or bypass an app allowlist.

Generate a random verifier of 43–128 URL-safe characters, its base64url SHA-256 challenge and an unpredictable `state`. Open:

```text
/oauth/chest/authorize?client_id=CLIENT&redirect_uri=EXACT_REGISTERED_URL
  &response_type=code&code_challenge_method=S256&code_challenge=CHALLENGE
  &state=UNPREDICTABLE_STATE&scope=read%20search%20upload
  &resource=FOLDER_ID&budget_requests=1000&budget_mutations=100&budget_bytes=1073741824
```

Repeat `resource` for each root. The consent screen names the app, person, allowed roots and actions, policy and budget. A denied app receives a policy refusal with no authorize button. The resulting one-use code expires after five minutes; verify `state` at the callback and exchange it:

```http
POST /oauth/chest/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&client_id=CLIENT&redirect_uri=EXACT_REGISTERED_URL&code=CODE&code_verifier=VERIFIER
```

The response contains a bearer `access_token`, grant ID, scopes and expiry. Grants last 24 hours and do not silently refresh. Codes, client secrets, bearer credentials, signing keys and cached capability-bearing responses are encrypted with the installation's own secret and stored outside portable product records. A restored installation requires fresh authorization. Identity erasure physically deletes the person’s codes, tokens, app secrets, webhook signing keys and cached capability responses, and removes integration MFA proofs. There is no client-credentials impersonation flow. OAuth metadata is at `/.well-known/oauth-authorization-server`; MCP protected-resource metadata is at `/.well-known/oauth-protected-resource/mcp/chest`.

Budgets cap calls, mutations and original bytes. API calls spend one request, including idempotent replays; original reads charge the selected original's full size even when requesting a range. Mutations charge newly admitted or restored version sizes. A successful webhook attempt spends a request before sending. A limit refusal is HTTP 429. A concurrent change can refuse a request rather than exceed its budget; reusing the same mutation key is safe.

## HTTP API

Use `Authorization: Bearer TOKEN`. The base is `/api/chest/integrations/v1`. Reads paginate with `limit` (1–100, default 25) and opaque `cursor`; follow `nextCursor` until null. Cursors are positions, never access grants. No inaccessible item contributes a result or a count.

| Door | Grant action | Behavior |
| --- | --- | --- |
| `GET /items?parent=ID` | `read` | List permitted descendants, or direct children when `parent` is present. |
| `GET /items/:id` | `read` | Stable ID, name, kind, parent, current version, size and original hash. |
| `GET /items/:id/versions` | `read` | Retained version metadata with immutable IDs and hashes. |
| `GET /items/:id/bytes/:version` | `download` | Original bytes; current no-download policy wins. Supports `Range`. |
| `GET /devices` | `devices:self` | Read only the sponsor’s own device inventory and last contact, even for an administrator. |
| `GET /search` | `search` | Scoped text search; named parameters `q`, `type`, `owner`, `creator`, `sharedBy`, `modifiedFrom`, `modifiedTo`, `location`, `versions` and `timeZone`. |
| `POST /items` | `upload` or `folder` | Create a file (`parent`, `name`, `base64`) or a folder (`parent`, `name`, `type:"folder"`). The parent must be inside the grant. |
| `POST /new-files` | `upload` | Create a valid blank document, spreadsheet or presentation, or use an accessible template; accepts the existing Chest creation fields. |
| `POST /items/:id/versions` | `versions` | Add an immutable original using `base64` and optional `filename`. |
| `POST /items/:id/versions/:version/name` | `versions` | Name a version with `name`. |
| `POST /items/:id/versions/:version/restore` | `versions` | Create a new attributed version from an earlier original. |
| `POST /items/:id/rename` | `upload` | Rename within the same parent. |
| `GET /items/:id/shares` | `share` | Paginated current grants, when the user can currently share. |
| `POST /items/:id/shares` | `share` | Share using `principal`, `role` and normal expiry/message fields. |
| `POST /items/:id/unshare` | `share` | Remove one `principal`. |
| `POST /items/:id/links` | `share` | Create a link with the normal policy-controlled audience, version and download controls. |
| `GET /items/:id/requests` | `request` | Paginated upload-only requests for a folder the user may share. |
| `GET /requests/:id` | `request` | One request's settings, scoped by its destination folder. |
| `POST /items/:id/requests` | `request` | Create an upload-only file request using normal request fields. |
| `POST /items/:id/pick` | `picker` | Return stable ID, name, kind and the authenticated Chest item URL. Creates no onward grant. |

Every product mutation needs `Idempotency-Key` (8–240 characters). Its receipt and mutation publish in the same database transaction. Reusing the key with the same input returns the recorded outcome; different input is HTTP 409. A lost response cannot duplicate an upload or grant. If a process stops after commit but before recording a capability-bearing response, the replay explicitly reports `state:"committed"` and the stable result IDs instead of manufacturing another link/request or claiming the response was delivered. Revoke that link/request and create another only with a new key if its one-time URL was lost.

ROLE-001 and POLICY-001 remain authoritative: an app's `share` action does not make a viewer a sharer, and public links or external sharing are refused where current policy forbids them. Authenticated app and MCP shares are agent-initiated. External actions carry risk class `external-share` through one agent policy hook; its compatibility policy currently returns `allow`, preserving autonomous sharing while Base policy integration is pending. The company policy can later choose allow, review, approve or block. Audit names the authenticated agent, its sponsor and grant, the risk class and policy decision. An app's `confirmExternal` flag is never human confirmation: these actions record `humanConfirmed:false` and need no confirmation flag. The browser still warns a person about external recipients where configured; internal shares are unchanged. Tokens cannot expand their own resources, scopes, budgets or expiry.

## Read your own devices

Register and request the separate `devices:self` action. A device-only grant needs no `resource`; a grant with file actions still needs explicit file roots. Consent requires the unchecked **Allow reading my own devices** choice as well as **Authorize app**. An existing `read` grant conveys no device authority. Read-only app policy permits this read capability.

`GET /api/chest/integrations/v1/devices` uses the usual pagination and request budget. It returns only the authenticated sponsor’s devices, including when that sponsor is an administrator; caller-supplied owner, user or scope filters cannot widen it. Fields are `id`, `owner`, `name`, `platform`, `createdAt`, `revokedAt` and `lastSeen`, matching the current browser inventory. A device with no contact has `lastSeen:null`. Device credentials and their hashes are never returned. Client version is `null`; `work.state` is `unavailable`, with reason `client_reporting_unavailable` and null unfinished, failed and conflicted work. Enrollment and protocol contact do not establish a signed client or queue telemetry.

The current sponsor identity, MFA, OAuth grant and app policy are checked on each page. Revoking a grant, blocking its app or deactivating its sponsor refuses further reads after restart too. This capability adds no device mutations, administrative inventory, queue execution or wipe claims. The shared Base Agent surface and canonical device tools remain unimplemented.

## MCP

Send JSON-RPC 2.0 POST requests to `/mcp/chest` with the same bearer token. The server supports `initialize`, `notifications/initialized`, `ping`, `tools/list` and `tools/call` using MCP protocol `2025-03-26`. Tools are `chest_list`, `chest_search`, `chest_get`, `chest_versions`, `chest_upload`, `chest_create_folder`, `chest_share`, `chest_create_request` and `chest_pick`. Their input schemas are returned by `tools/list`; mutation tools require a caller `key`. Tool outcomes include text and structured content, and refusals are `isError:true`. Tools reach exactly the same scoped, budgeted product operations as HTTP calls.

## Embed the picker

Register the web app's callback URL and picker origin, then load the component:

```html
<script src="https://chest.example/chest-picker.js"></script>
<button id="attach">Attach from Chest</button>
<script>
  const picker = new ChestPicker({
    chestOrigin: 'https://chest.example',
    clientId: 'REGISTERED_CLIENT_ID',
    redirectUri: 'https://partner.example/oauth/callback',
    resources: ['ALLOWED_FOLDER_ID']
  });
  document.querySelector('#attach').onclick = async () => {
    const item = await picker.pick();
    // { id, name, type, url }; persist the stable ID and link in your app.
  };
</script>
```

Load `chest-picker.js` on the registered callback page too. It returns the code to the initiating window after validating the exact callback origin and state. The component exchanges PKCE, retains the credential in memory and uses one popup for consent and selection. It sends the token to the Chest picker through checked `postMessage`, never in a URL. A supplied `accessToken` can reuse an existing browser grant. Picker scopes default to `read search picker`.

The picker lists and searches only current accessible items within the OAuth roots. Every pick rechecks the grant and current file policy. Its link is the stable, authenticated Chest item URL: forwarding it grants no one access. Use the separate `share` API only when a person explicitly requests sharing and current policy permits it. The script checks both message origin and originating window and binds each flow to random state.

## Webhooks

Create a subscription with `POST /webhooks`, an idempotency key and `{"endpoint":"https://receiver.example/chest","events":["file.upload","version.upload"]}`. The `webhook` action is required. The response returns a signing secret; store it privately. `GET /webhooks` lists subscriptions, and `GET /webhooks/:subscription/deliveries` lists durable outcomes. New subscriptions start after existing live events.

Normal product publication writes live events atomically with its mutation. The event allowlist covers file/folder creation, new/restored/named versions, rename, move, trash/restore, sharing, comments and accepted file-request uploads. Imported audit history and events marked imported never start delivery. Subscription signing credentials are installation-local; importing a subscription cannot reconnect it.

Each POST body contains `id`, `type`, `at`, `item` and `version`. Headers include `X-Chest-Event`, `X-Chest-Delivery` and `X-Chest-Signature: t=UNIX_SECONDS,v1=HEX_HMAC`. Verify HMAC-SHA256 over `timestamp + "." + exact_request_body`, reject stale timestamps and compare signatures in constant time. Deduplicate `id` durably before processing it. Replay preserves that ID; a receiver must return success for an already processed event without processing it again.

The queue sends pending events only while the original grant, current resources/actions, app policy and budget permit them. A 2xx response is `delivered`; other HTTP responses are `failed`. A connection loss or interrupted runner is `uncertain`, since the receiver may already have accepted it. Neither failure nor uncertainty is automatically retried. Inspect the outcome in Connected apps and choose **Replay same event**, or POST `/webhooks/:delivery/replay`. Replay resends the event; it never repeats the Chest mutation. Closing/revoking a grant stops new delivery attempts. A response already in flight can still be recorded honestly after revocation.

The Worker calls `sweepIntegrations` from its scheduled handler and request continuation. It scans bounded queue pages and sends a bounded pending batch each time; no dev server or independent process is required.

## Evidence

`tests/chest/integrations.mjs` exercises OAuth/PKCE and exact redirects, scoped pagination/search, idempotent upload across restart, original downloads, MCP mutations/refusals, signed failed/uncertain webhook replay with receiver deduplication, imported-event suppression, budgets, revocation and allowlist/read-only/block policy. `tests/chest/browser-integrations.mjs` exercises consent, the real picker in an embedded consumer, scoped search, stable IDs/links, next-pick revocation the policy console and failed-webhook manual replay at 1440 and 390. `tests/chest/integration-client.mjs` serves the real HTTPS test consumer. The OAuth test client and webhook receiver are the network edges; product authorization, storage and mutation paths are real.
