# Office files in Chest

Open a `.docx`, `.xlsx` or `.pptx` in **Files** to preview it inside Chest. Word text, tables, basic run formatting and embedded raster pictures are rendered in the installation. Workbooks show each sheet, resolved shared strings and saved cell values. Slides follow the presentation's relationship order, with text, basic shapes, tables and embedded raster pictures. No editor account, remote conversion service or external font or image request is used.

Owners and people with contributor or editor access can choose **Edit in browser** on Word and Excel files. Change existing text or cell values, then **Save new version**. The file's address, permissions and links stay the same. The original upload and all later versions remain in Version history; **Restore as current version** creates an attributed restoration without deleting later work. Office packages retain untouched ZIP records and parts, including original images and custom XML.

The editor changes existing text runs and cell values. It does not redesign documents, edit formulas, recalculate workbooks, or edit presentations. Formula results are the workbook's saved calculation; edited workbooks request recalculation when opened in a spreadsheet application. Unsupported Office layout features, themes, charts and animations may differ from the originating app. Encrypted files, ZIP64 packages, files above 8 MB and oversized or malformed parts are refused.

**Presence** shows other signed-in people viewing or editing the same file. Heartbeats expire after 45 seconds and recheck current sessions and access. Saving independent fields merges with the latest version when their structure is unchanged; overlapping or structurally stale edits are refused. The built-in editor uses explicit saves. With Collabora configured, staff and verified guests can type together in the engine; DOCX commenters record tracked changes and contributors decide them. The broader shared review thread and email loop remain under EDIT-001 and EDIT-003.

People with comment access can post a version-bound comment. Chest creates a notice and sends the file owner an email using the installation's mail provider. In a personal space the owner is the space's owner; in a team space it is the person who created the file, provided they still have access. RER Managed currently shows one line that email is not available yet because its outbound connection is pending. Self-hosted installs use their configured mail provider. Provider acceptance is not a delivery receipt.

Viewers receive previews and cannot fetch editor fields or save edits. A public link must still be active and unlocked; its restricted paths, no-download setting, expiry and limits also gate Office previews. Revoking it ends preview access. Visitors to a link for anyone cannot edit or comment. Verified guest links use their granted role.

The public-door core flow lives in `tests/chest/office.mjs`, with synthetic Office packages in `tests/chest/office-fixtures.mjs`. It exercises preview structure and slide order, Word and Excel saves, immutable versions and restore, conflict handling, two-person presence, the owner email at the network edge, viewer refusal, and password-protected/revoked shared links.

## Create a new file

Open a writable folder or space and choose **New** beside **New folder** and **Upload a file**. Create a document, spreadsheet or presentation, blank or from a template. Office documents and spreadsheets open in Chest’s existing text and cell editor; save to add an immutable version. Presentations and OpenDocument files download for editing in your own application.

**Files › Templates** shows the gallery and lets the owner choose Office (DOCX/XLSX/PPTX) or OpenDocument (ODT/ODS/ODP) defaults, including group overrides. Each format includes letter, memo, meeting notes, project proposal, invoice, budget, project tracker, schedule and two presentation designs. Publish a current Office or OpenDocument file from its file page as an organization, group or space template; a space manager publishes for their space. Templates are snapshots: users can make independent copies without access to the source. Unpublishing hides a template and keeps existing copies. Published templates use the existing 8 MB Office limit.

The API uses `POST /api/chest/new-files` with `kind`, destination `space` or `parent`, optional `name`/`template`, and a required caller `key`. Reusing a key with the same request returns the same currently authorized item; changing the request returns `caller_key_conflict`. `GET /api/chest/templates` lists the caller’s audience, and `POST /api/chest/templates` and `/templates/:id/unpublish` publish and unpublish.

## Review versions in a folder

A folder manager chooses a reviewer under **Version review** and selects **Require version review**. New originals in that folder and its subfolders await the assigned reviewer’s exact-version decision. Existing files enter the workflow on their next replacement. Assignment gives no access: share the folder separately. Once a version is approved, it stays current while replacements, editor saves and restores await review. Approving version B selects B even when C was uploaded later. Moving a governed file keeps its review requirement. This is version review; the typed filing workflow in Library is still separate.

The added public journeys are `tests/chest/new-files.mjs`, `tests/chest/governance.mjs` and `tests/chest/browser-new-files.mjs`. The complete contract also requires Collabora/provider and native editing, guest creation, delegated settings administration, desktop-format certification and reference-scale proof; these remain undelivered.

For a reviewed file, choose **Create link › Audience › Anyone with the link**, then **Version for links for anyone › Approved versions only**. A reviewer must first approve a retained version. The link follows that exact approved pointer while pending replacements stay private to authorized staff; approving B never selects a newer pending C. Preview and download both recheck the decision, current access and link policy. Revoke from the file’s page or Links to end access, including old preview addresses. Approved-only applies to individual files; folder snapshots and guest/domain audiences remain unimplemented.

## Restores in an open Collabora session

When Collabora is configured, **Open in Collabora Online** opens a Chest host page. Continue once to load the editor in its frame. The host checks for restores every 12 seconds using the same expiring editor token and current staff or verified guest authority. A restore starts Collabora's version-restore handshake; the engine reconciles, closes and reloads the current original. The host accepts messages only from its editor frame at the configured origin and never discards that frame on a timer. If reconciliation cannot finish, keep unsaved work in the editor before reopening it. A stale lock refresh or save cannot overwrite restored bytes.

`tests/chest/wopi-flow.mjs` covers the authenticated state door, stale-write refusal and host protocol. Its `liveCollaboraRestoreFlow` runs against an explicitly provisioned engine with trusted local TLS and proves DOCX and XLSX remote restores at 1440 and 390 through the engine's original-read audit and exact downloaded bytes. This configured integration does not establish the other EDIT-001 requirements.

## Tracked suggestions in the built-in DOCX editor

Commenters open **Suggest changes** on a DOCX file. Their text becomes attributed
tracked insertions and deletions in a new immutable original. The preview displays
both sides of each replacement. A direct save is refused with `suggest_only` and
creates no version. Viewers open the read-only editor and cannot save.

A contributor chooses **Accept suggestions** or **Reject suggestions**. Each decision
creates a version attributed to that contributor, retains the original proposal
and records its author, source version and decision in the file history and audit.
A stale decision is refused. One proposal batch may be pending at a time; ordinary
built-in edits resume after its decision. Existing tracked changes from another
editor must be decided there first. This bounded workflow does not claim the full
Collabora review loop or migrated-review fidelity under EDIT-001 and EDIT-003.

File comments accept comma-separated mention addresses and an optional assignee.
Every recipient must be active and already able to view the file. An unavailable
recipient refuses the complete comment without creating a grant or notification.
Authorized recipients receive the ordinary in-app notice and installation mail;
assignment itself grants no access. The file page retains the version and author.

## Collabora review roles

With Collabora configured, viewers open a read-only session. DOCX commenters
open with recording enabled before typing; the recording switch is hidden.
Chest validates each saved package against the original after removing proposed
changes. A direct edit, an altered author or another person's changed proposal
is refused without publishing a version. Contributors use **Review suggestions**
on the host page to accept or reject one change and save an attributed version.
Spreadsheet and presentation commenter sessions allow comments only. Every
request rechecks current staff or verified guest access and the retained version.

## PDF annotations and restricted previews

Under **Comments**, choose **Annotate a PDF**, select the retained version and
page, and enter the region as percentages from its top left. Replies, mentions,
assignment and resolution stay with that original version. Uploading a replacement
does not move the annotation; **Open original page** returns to its original.

The no-download setting gives viewers and commenters rendered page images from
Collabora for text, Office, PDF and image files. Page navigation remains available.
Original bytes, extraction, retained originals, ranges, sync and archive inclusion
are refused. The viewer suppresses browser copy and print commands and blanks
printed content. If rendering is unavailable, Chest reports that condition.
Moving or copying a folder also checks the current rights on each descendant.
