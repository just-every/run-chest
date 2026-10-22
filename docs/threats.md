# Content threats (SECURITY-002)

**Files → Content threats** (`/app/threats`) is where security admins see malware quarantine, mass-activity alerts and
pauses, and tune the rules. The owner, super admins and admins holding the **sharing and security policy** privilege
(ADMIN-003) use it; an admin scoped to groups sees and acts only for those groups' members. An admin role alone opens
no file names or contents: quarantined files show as "Restricted item" unless the admin can also open them.

## Malware scanning and quarantine

Malware scanning runs in a separately deployed service. A **service settings** admin connects it with its HTTPS
address and a token; the token is sealed under the installation's `SESSION_SECRET`, is never shown again and never
travels in archives. **Test with the standard test file** sends the industry's harmless EICAR test file and expects
the scanner to detect it.

While a scanner is connected:

- Every new original waits in quarantine until the scanner answers. Originals stored before the scanner was connected
  are scanned before they are next opened.
- A pending or infected original is served by no door: preview, download, range requests, sync clients, app tokens,
  links for anyone or for guests, deliveries, selection archives (listed as excluded with the reason `quarantined`),
  the Office editor, templates, signing, page images, readings and search text. The API answers `423` with
  `scan_pending` or `quarantined`.
- A scanner outage, timeout or malformed answer keeps the original quarantined and retries later; nothing is ever
  released by time.
- The quarantine list shows the scanner's signature name, engine and definitions version, the uploader, the SHA-256
  and every file that holds those bytes. The uploader and the scoped security admins are told in Chest and by email.
- **Release** is the false-positive path: only an admin whose security scope covers the uploader, never the uploader,
  and always with a written reason. Quarantine never deletes an original, so a release serves the same bytes again.
  Release grants no new access.

Disconnecting the scanner stops new scans; every verdict, including quarantines, stays in force.

### Scanner protocol

Chest sends `POST <address>` with `Authorization: Bearer <token>`, `Content-Type: application/octet-stream`,
`X-Chest-SHA256: <hex digest>` and the original as the body, and expects `200` with JSON:

```json
{ "verdict": "clean" | "infected", "signature": "<name when infected>", "engine": "<engine and version>", "definitions": "<database version>" }
```

Anything else counts as a failed attempt. The reference deployment is a ClamAV daemon behind a small HTTP adapter on
a host reachable over HTTPS; Chest itself runs no scanning engine.

## Mass downloads and deletions

Downloads and deletions are counted per account and, separately, per sync device or app token. The defaults:

| Rule | Default |
| --- | --- |
| Downloads | more than **500 files** or **5 GB** (5,000,000,000 bytes) in **10 minutes** |
| Trash or delete | more than **200 items** in **10 minutes** |
| At the threshold | alert security admins |

A file counts once per window however many range requests carry it; range requests count their own bytes. Selection
archives count each file they include.

- Admins with organization-wide security scope change the organization rules; an admin scoped to groups sets rules
  for those groups. A group rule replaces the organization rule for its members; for someone in several groups with
  rules, the most restrictive value applies and pause outranks alert. Every change is audited with its before and
  after values.
- **Alert admins** sends one alert per account, device or token per window, naming the rule.
- **Alert admins and pause** also refuses the request that crosses the rule (`423 activity_paused`, naming the rule)
  and keeps the device or token (checked first) or the account paused until an admin resumes it. A paused account
  cannot download or delete; a paused device or token is refused on every request. Resuming starts a fresh count.
- Admins can pause a sync device, an app token (by its grant ID) or an account by hand, for example while
  investigating. A pause deletes nothing: files, versions, audit history and alerts all stay as evidence.

## Sensitivity labels

Chest reads the sensitivity label a document already carries: a Microsoft Purview (MIP) label in an Office file's
custom properties, or a `Classification:` / `Sensitivity:` marking line in a text file. The label is recorded on the
version. Labels listed as sensitive (default: Confidential, Highly Confidential, Restricted, Secret) are reported in
the alert history, and while **sharing outside the organization is refused for files with a sensitive label** (the
default), such a file cannot be shared through links for anyone, guests or domains, and an existing outside link to
it stops on its next request. Colleagues inside the organization keep their access. Turning the rule off never
creates a link or grant by itself.

## Limits today

- The scanner is a separate service you deploy; Chest ships its protocol, not an engine.
- Sensitive content is recognised by the label or marking a document carries; Chest does not infer sensitivity from
  the text itself.
- Labels are read from originals up to 8 MB.
