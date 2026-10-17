Chest is a document library for the records a business has to get right:
supplier certificates, customer agreements, project evidence and the rest. It
keeps every original, shows everyone which version is the approved one, and
records who decided what. It is free and open source under the MIT licence,
and you run it yourself.

## How a document moves through Chest

1. **File it.** Someone uploads the original and files it: a title, a
   collection, a document type with its fields, a responsible owner, a reviewer,
   and optionally the supplier, customer or project it belongs to. See
   [File and find documents](/docs/filing).
2. **Approve the exact version.** The assigned reviewer opens the record and
   records **Approve this exact version**. That version becomes the current
   approved one. See [Versions and approval](/docs/versions).
3. **Replace it when a new one arrives.** A replacement adds a new version.
   Everyone keeps opening the approved one until the reviewer approves the new
   version; the earlier version stays, with its decisions.
4. **Keep the dates.** A review date and an expiry date put the record on the
   library's **Review and expiry work** list when it is due. See
   [Review and expiry dates](/docs/dates).

## Who sees what

Access comes from roles: **reader**, **editor** and **reviewer**, granted to a
person or a group, on a collection or on one document. Lists, counts, search,
previews and downloads all follow the current grants, so removing someone ends
their access everywhere at once. See [People and access](/docs/access).

## What Chest keeps

- Every original exactly as uploaded, with its filename, size and SHA-256
  fingerprint.
- Every version and every decision on it: comments, requested changes,
  approvals and reviewer assignments, each with who and when.
- Completed reviews and expiries with their evidence.
- An audit trail of every change. Nothing is deleted automatically; trash is
  reversible.

One export holds all of it, and restores into a fresh Chest. See
[Backup and restore](/docs/backup-and-restore).

## What it does not do

Chest previews PDFs and images in the browser and shows text files as plain
text; other formats download. It does not edit or render Office files, read
text out of scanned PDFs or images, sync folders to computers or phones, or
share records by public link. Library originals are limited to 8 MB each;
files in [folders](/docs/files) upload up to 4 GB each.

## Next

[Run Chest on your computer](/docs/run), then
[set up your library](/docs/set-up).
