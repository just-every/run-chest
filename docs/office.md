# Office files in Chest

Open a `.docx`, `.xlsx` or `.pptx` in **Files** to preview it inside Chest. Word text, tables, basic run formatting and embedded raster pictures are rendered in the installation. Workbooks show each sheet, resolved shared strings and saved cell values. Slides follow the presentation's relationship order, with text, basic shapes, tables and embedded raster pictures. No editor account, remote conversion service or external font or image request is used.

Owners and people with contributor or editor access can choose **Edit in browser** on Word and Excel files. Change existing text or cell values, then **Save new version**. The file's address, permissions and links stay the same. The original upload and all later versions remain in Version history; **Restore as current version** creates an attributed restoration without deleting later work. Office packages retain untouched ZIP records and parts, including original images and custom XML.

The editor changes existing text runs and cell values. It does not redesign documents, edit formulas, recalculate workbooks, or edit presentations. Formula results are the workbook's saved calculation; edited workbooks request recalculation when opened in a spreadsheet application. Unsupported Office layout features, themes, charts and animations may differ from the originating app. Encrypted files, ZIP64 packages, files above 8 MB and oversized or malformed parts are refused.

**Presence** shows other signed-in people viewing or editing the same file. Heartbeats expire after 45 seconds and recheck current sessions and access. Saving independent fields merges with the latest version when their structure is unchanged; overlapping or structurally stale edits are refused. This is explicit save collaboration, without a live shared typing cursor. Full Collabora co-authoring, tracked changes and the contract's broader review loop remain future work.

People with comment access can post a version-bound comment. Chest creates a notice and sends the file owner an email using the installation's mail provider. In a personal space the owner is the space's owner; in a team space it is the person who created the file, provided they still have access. RER Managed currently shows one line that email is not available yet because its outbound connection is pending. Self-hosted installs use their configured mail provider. Provider acceptance is not a delivery receipt.

Viewers receive previews and cannot fetch editor fields or save edits. A public link must still be active and unlocked; its restricted paths, no-download setting, expiry and limits also gate Office previews. Revoking it ends preview access. Shared-link visitors cannot edit or comment.

The public-door core flow lives in `tests/chest/office.mjs`, with synthetic Office packages in `tests/chest/office-fixtures.mjs`. It exercises preview structure and slide order, Word and Excel saves, immutable versions and restore, conflict handling, two-person presence, the owner email at the network edge, viewer refusal, and password-protected/revoked shared links.

## Create a new file

Open a writable folder or space and choose **New** beside **New folder** and **Upload a file**. Create a document, spreadsheet or presentation, blank or from a template. Office documents and spreadsheets open in Chest’s existing text and cell editor; save to add an immutable version. Presentations and OpenDocument files download for editing in your own application.

**Files › Templates** shows the gallery and lets the owner choose Office (DOCX/XLSX/PPTX) or OpenDocument (ODT/ODS/ODP) defaults, including group overrides. Each format includes letter, memo, meeting notes, project proposal, invoice, budget, project tracker, schedule and two presentation designs. Publish a current Office or OpenDocument file from its file page as an organization, group or space template; a space manager publishes for their space. Templates are snapshots: users can make independent copies without access to the source. Unpublishing hides a template and keeps existing copies. Published templates use the existing 8 MB Office limit.

The API uses `POST /api/chest/new-files` with `kind`, destination `space` or `parent`, optional `name`/`template`, and a required caller `key`. Reusing a key with the same request returns the same currently authorized item; changing the request returns `caller_key_conflict`. `GET /api/chest/templates` lists the caller’s audience, and `POST /api/chest/templates` and `/templates/:id/unpublish` publish and unpublish.

## Review versions in a folder

A folder manager chooses a reviewer under **Version review** and selects **Require version review**. New originals in that folder and its subfolders await the assigned reviewer’s exact-version decision. Existing files enter the workflow on their next replacement. Assignment gives no access: share the folder separately. Once a version is approved, it stays current while replacements, editor saves and restores await review. Approving version B selects B even when C was uploaded later. Moving a governed file keeps its review requirement. This is version review; the typed filing workflow in Library is still separate.

The added public journeys are `tests/chest/new-files.mjs`, `tests/chest/governance.mjs` and `tests/chest/browser-new-files.mjs`. The complete contract also requires Collabora/provider and native editing, guest creation, delegated settings administration, desktop-format certification and reference-scale proof; these remain undelivered.
