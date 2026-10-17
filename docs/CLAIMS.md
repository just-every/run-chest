# Chest homepage: every capability claim and the code behind it

Page: the run site's `/` on `just-every/run-chest` branch `br/style`, built from `src/site/landing/` (copy in
`src/site/landing/copy.ts`, exactly the desk's owner-accepted words). Code read on that branch (main 023bd1f plus
this lane's site and brand changes; the product code under `src/chest/` is unchanged by this lane).

The copy describes the new contract (CONTRACT.md: a general business file system replacing Google Drive, Dropbox
and Box). The page keeps the copy; this table is what the run-site gate checks before any deploy.

Status:
- **in code**: the code does this today.
- **partial**: part is in code (named), the rest is contract.
- **contract**: contract, not yet in code.

## Summary

46 claims (rows below): **24 in code**, **3 partial**, **19 contract, not yet in code**.

Rows 1, 9, 24, 25, 36, 39c and 40 were re-read against `just-every/run-chest` main on 17 October 2026 after
the folders, uploads and restore work (sd-chest-folders), and rows 3, 10, 16, 17, 18, 30, 39b and 39f after the
sharing work (links for anyone, revoke, file requests and Shared too widely; sd-chest-sharing); the other rows are as
the desk built them.

## Hero (page 1)

| # | Claim on the page | Status | Code that backs it, or what is missing |
|---|---|---|---|
| 1 | "Chest stores … your team's files" | in code | Ordinary files in team spaces and personal areas, in nested folders, with no type, reviewer or approval (`src/chest/files/items.ts`, `spaces.ts`); dropped, picked or photographed on a phone and uploaded with progress, resumably, up to 4 GB per file (`src/chest/files/uploads.ts`, `public/chest-upload.js`). Every original is kept as an immutable version and SHA-256 checked on write and on every read, streamed for large files (`src/chest/blobs.ts`). Tests: `tests/chest/files.mjs` (SPACE-001, TRANSFER-001), `tests/chest/browser-files.mjs` at 1440 and 390. |
| 2 | "syncs" | contract | No sync client (`seed.json` nonGoals: "Signed desktop and phone sync clients"). |
| 3 | "shares your team's files" | in code | Share a file or folder with colleagues or groups at viewer, commenter or editor, with a message and an optional expiry, notice and email (`src/chest/files/shares.ts`); organisation links (`links.ts`); and links for anyone with no account, behind an optional password, expiry and download limit (`src/chest/files/public-links.ts`, `public.ts`). Access is recomputed on every request through every door, including the creator's current right to share. Tests: `tests/chest/files.mjs` SHARE-004, "SHARE-001 links for anyone". |
| 4 | "reads every scan" | contract | No OCR or PDF text; only UTF-8 text files are extracted (`src/chest/api.ts` search, `ui-document.ts` "Extraction: chest:signature-only:1" for PDFs). |
| 5 | "quietly files what arrives" | contract | No automatic filing ("AI jobs (phase two)" in `seed.json`). |
| 6 | "100% free, open source" | in code | `LICENSE` (MIT); nothing charges or meters seats. |
| 7 | "alternative to Google Drive, Dropbox and Box" | contract | The positioning is the contract's; today Chest is a governed document library (UI-REFERENCE §0). |
| 8 | Collage: contract co-edited by Dana and Luis | contract | No in-browser editing or presence. |
| 9 | Collage: receipt "Uploading 62%" | in code | Each file being uploaded shows its percentage, bytes received, Pause and Cancel; a lost connection shows "Connection lost at 61% · resumes by itself", and after a reload choosing the same file continues from the parts Chest holds (`public/chest-upload.js`, `src/chest/files/uploads.ts`). On a phone the drop area offers "Take a photo" (camera) next to the file picker. Browser only: native apps are row 14. |
| 10 | Collage: share link "expires Nov 30 · 3 of 10 downloads" | in code | Each link for anyone is listed on the item's page and under Links as, for example, "Expires Nov 30 · 3 of 10 downloads · password" (`src/chest/files/public-links.ts` `linkSummary`, `ui-item.ts`, `ui-links.ts`); the recipient sees "Open until … · 7 of 10 downloads left". Test: `tests/chest/files.mjs` "SHARE-001 links for anyone" asserts the summary after three downloads. |
| 11 | Collage: version stack v7 (approved), v6, v5 | in code | Every version kept; approval binds one exact version (`src/chest/reviews.ts:12-13`, `ui-document.ts` "Current approved"). |
| 12 | Collage: scanned NDA with extracted fields boxed | contract | Typed fields exist but are typed in by people (`src/chest/fields.ts`, `ui-fields.ts`); nothing reads a scan. |
| 13 | Collage: "Filed W-9 Acme Supply.pdf → Vendors / Acme / Tax · Undo" | contract | No automatic filing, no folder paths. |

## Sync, Sharing (page 2)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 14 | "Files stay in sync on Mac, Windows, iPhone and Android" | contract | Browser only. |
| 15 | "open on demand without filling your disk" | contract | No sync client. |
| 16 | "Links with a password, an expiry and a download limit" | in code | "Link for anyone" on any file or folder page: optional password (only a salted PBKDF2 hash is stored; ten wrong tries in 15 minutes pause the link), expiry date and download limit, counted in the same D1 commit that re-checks the link, so parallel downloads cannot pass the limit (`src/chest/files/public-links.ts`, `capability.ts`, `public.ts`). The recipient needs no account. Every open (`link.view`), download (`link.download`) and wrong password is in the audit and the file's activity. Folder links never reach restricted or trashed subfolders; the no-download setting refuses a link. Test: `tests/chest/files.mjs` "SHARE-001 links for anyone" (five parallel downloads at a limit of three). |
| 17 | "Revoke any link in one click" | in code | One "Revoke" button on the item's page and on Links, with no further step; the next request through the link answers a plain "Link turned off" page, never the file (`src/chest/files/public-links.ts` `revokePublicLink`, `ui-public.ts`). Expired links answer "Link expired"; trashing the item or the sharer losing share rights ends the link too. Organisation links have the same one-click Revoke. Test: `tests/chest/files.mjs` "SHARE-001 links for anyone". |
| 18 | "ask anyone to upload with a file request" | in code | "File request" on any folder page: title, message, accepted types, largest file (up to 8 MB per file today), deadline. Anyone with the link uploads up to ten files with no account, gets a receipt with each SHA-256, and never sees the folder's name or contents; files arrive attributed "<email> via file request", and the asker gets an in-app notice and an email (`src/chest/files/file-requests.ts`, `public.ts`, `notify.ts`). Close in one click; a closed or past-deadline request answers a plain page. Test: `tests/chest/files.mjs` "SHARE-002 file requests". Not yet: resumable uploads through a request and replacing one's own submission (SHARE-002). |

## Search, Work together (page 3)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 19 | "Chest reads every document and scan, so search finds the words inside" | partial | Plain substring search over titles, typed fields, relationship and the text of UTF-8 files up to 500 kB (`src/chest/api.ts`, `ui-library.ts` "Search titles, fields and extracted UTF-8 text"). No PDF text, Office text, OCR or ranking. |
| 20 | "and only shows what you are allowed to see" | in code | Lists, counts, search, detail, previews and downloads check current access; no access is a 404 (`src/chest/access.ts`, `src/chest/api.ts`, `tests/chest/flows.mjs`). |
| 21 | "Word, Excel and PowerPoint files open right in the browser" | contract | Previews are PDF, PNG, JPEG, GIF, WebP and UTF-8 text only (`src/chest/blobs.ts`). |
| 22 | "Edit at the same time, comment" | contract | No editing; comments exist only on a version's review (`src/chest/reviews.ts`). |
| 23 | "and keep one copy" | contract | Identical bytes share one stored object (`blobs.ts`, `sha256/<hash>` keys), but there is no single live document. |

## Versions, Agents (page 4)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 24 | "Go back to any earlier version of a file" | in code | Every version is kept; "Restore as current version" on any earlier version adds a new attributed version with the same bytes and keeps the later ones (`src/chest/files/items.ts` `restoreVersion`, `ui-item.ts`); on a governed record it enters as a new submission (`documents.ts`). Tests: `tests/chest/files.mjs` VERSION-001, `browser-files.mjs`. |
| 25 | "or a whole folder" (and "Restore Clients / Harbor Freight to Oct 12") | in code | "Restore to a date" on a folder or space previews every change (earlier versions, names, places, trash state, items added since, and items moved out of the folder since), restores the selected items as new states and keeps all later history; the receipt and the folder page offer Undo, which returns each item to its state just before the restore (`src/chest/files/rewind.ts`, `ui-item.ts`). Sharing removed since is never restored. Tests: `tests/chest/files.mjs` "RECOVER-001 folder to a date", `browser-files.mjs`. |
| 26 | "see who changed what" | in code | Audit row on every write and every read, preview and download (`src/chest/store.ts`, `api.ts` `recordAccess`); per-version decision events (`reviews.ts`). |
| 27 | "Approvals stay with the exact version signed off" | in code | `src/chest/reviews.ts:12-13` (assigned reviewer only; approving B never selects a later C), `tests/chest/flows.mjs`. |
| 28 | "Agents file what arrives from email and apps" | contract | Phase two. |
| 29 | "merge duplicates" | contract | Storage de-duplicates identical bytes, but no records are merged. |
| 30 | "flag links shared too widely" (and "Make private") | in code | Links → "Shared too widely" lists every link for anyone, links with no expiry or open more than 90 more days, links past their expiry or download limit and not revoked, and discoverable or long-lived organisation links, each with the reason; "Make private" turns off every link on the item in one click and keeps the named people and groups (`src/chest/files/exposure.ts`, `ui-links.ts`). It is computed from current links on every visit; there is no background agent or notice yet (AGENT-005). Test: `tests/chest/files.mjs` "SHARE-001 links for anyone". |

## Interlude (page 5)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 31 | Mascot filing files from email, phone and laptop; "312 files filed this week" | contract | No email intake, mobile app or agents. |

## Move in, For teams (page 6)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 32 | "Move from Google Drive, Dropbox or Box with folders, permissions, versions and shared links" | partial | The only importer is Chest's own `chest-archive-1` JSON, up to 100 items and 16 MB, with preview, apply, resume and undo (`src/chest/archive.ts:14`, `ui-admin.ts` Move-in). No Drive, Dropbox or Box reader; no folder, permission or link mapping. |
| 33 | "Links inside your files point to the new copies, and any old link opens its new home in Chest" (and "Shared links rewritten · 214") | contract | MIGRATE-007 (CONTRACT.md "Homepage claims": missing). Chest does not control Google, Dropbox or Box domains, so it rewrites links inside imported files and opens an old link at its new home in Chest; it never forwards vendor URLs. Not yet in code. |
| 34 | "Single sign-on" (Okta) | contract | Email-link sign-in only (`src/modules/operator-auth`). |
| 35 | "automatic user setup" (User sync · 42 people) | contract | People are invited one at a time (`ui-admin.ts` "Invite staff"). |
| 36 | "team spaces" | in code | Team spaces with members at five cumulative roles, nested folders whose grants are inherited (restricted folders stop inheritance), create, rename, move and trash for folders, and a breadcrumb that wraps at phone width (`src/chest/files/spaces.ts`, `access.ts`, `items.ts`, `ui-item.ts`). Storage limits per space are row 37; space-creation rules are SPACE-002. |
| 37 | "storage limits" (1.2 TB of 5 TB) | contract | Local custody shows total bytes only (`ui-admin.ts` "Local custody"); no limits. |

## Ownership (page 7)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 38 | "Run Chest on your own computer or server and keep every file. Export everything, any time." (Your own storage · Your own computer or server · Export any time; terminal: `npx -y @runeditrun/rer dev just-every/run-chest`, then lines rer 0.2.38 prints: `Restart: cd run-chest && rer dev`, `rer dev: installing dependencies`, `RER_READY http://127.0.0.1:8787`) | in code | `rer dev`/`rer setup` (README, `docs/run.md`); deploys to the owner's own account (`deploy.json`, `OPERATIONS.md`); versions are never deleted (`documents.ts:21`); `rer export` / `rer import` hold and restore the whole library (`docs/backup-and-restore.md`, `tests/chest/restore.mjs`). The one-line start was checked against `npx -y @runeditrun/rer@latest --help` (rer 0.2.38: `rer dev <repo>` clones, installs, sets up a local owner and starts the app) and its output lines against the rer source (`global/cli/repo-command.mjs`, `global/launch/prepare.mjs`, `cli/managed-server.mjs`). |

## The quiet details (page 8)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 39a | "Exact-version approvals: Sign-off sticks to the version that was approved." | in code | `src/chest/reviews.ts`. |
| 39b | "File requests: Anyone can upload to the folder you choose." | in code | As row 18 (`src/chest/files/file-requests.ts`). |
| 39c | "Large files: Big uploads resume where they stopped." | in code | Resumable multipart uploads to R2 keep every received part; after a lost connection, reload or restart, choosing the same file continues from there (`src/chest/files/uploads.ts`, `public/chest-upload.js`), up to 4 GB per file. Tested in `tests/chest/files.mjs` TRANSFER-001 (Worker restarted mid-upload). |
| 39d | "Trash you can undo: Deleted files come back until you choose to erase them." | in code | CHEST-13 (CONTRACT.md "Homepage claims": done): trash is reversible and keeps items until a deliberate ERASE-001 erasure (`documents.ts:21`). |
| 39e | "Previews: Documents, video and design files open in the browser." | partial | PDF, images and UTF-8 text open in the browser's own viewer, decided from the bytes (`blobs.ts`); no video, design or Office previews. |
| 39f | "Activity log: Every view, share and change, recorded." | in code | `document.read`, `version.preview`, `version.download`, `access.change` and every write are audited (`store.ts`, `api.ts`); Audit page `ui-receipts.ts`. Shares, links for anyone (`link.create`, `link.view`, `link.download`, `link.revoke`) and file-request uploads are audited too (`src/chest/files/public.ts`, `file-requests.ts`). |

## Closing and footer (page 9)

| # | Claim | Status | Code / gap |
|---|---|---|---|
| 40 | "Open source file storage for your whole team." | in code | Open source (MIT) file storage: team spaces, nested folders and ordinary files for invited staff with roles (`src/chest/files/`, `ui-admin.ts`); team use needs Chest deployed with outbound mail (`OPERATIONS.md`). |
| 41 | "Free and open source, MIT licensed." | in code | `LICENSE`. |

## "Try the demo"

Links to `https://demo.run-chest.com/` (the repo's hosted demo: `deploy-demo.json`, `DEMO.md`; answered 200 on
17 Oct 2026). The demo shows today's governed library, not the contract's file system.
