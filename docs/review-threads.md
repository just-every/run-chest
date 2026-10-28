# Review threads on retained originals

On a file page, **Compare versions** opens two retained versions beside each
other. Choose the left and right originals independently. Each preview uses your
current file permissions, including a link's version scope and download policy.
An unsupported format shows a download option where allowed; comparison does not
convert it or change either original.

**Your assigned comments** opens the task list in Notices. An assignment grants
no access. Resolved comments leave this list; reopening brings them back while
you still have access to that retained version. Revoked access removes the task
on the next request.

## Receive exported review history

After bringing a file into Chest, its owner can use **Import review threads**
on the file page. This receiving door takes a `chest-review-1` JSON export, binds
it to one explicitly selected retained original, previews the identities and
states, and requires confirmation. Only the installation owner with contribution
rights on the destination can publish it. The source adapters' extraction,
automatic identity evidence collection and delta reconciliation remain separate
migration work; ordinary downloaded ZIP files do not supply this review export.

The export has these fields:

- `format`: `chest-review-1`.
- `provider`: `Google Drive`, `Dropbox` or `Box`; `file`: the source file ID.
- `mappings`: optional entries with `authorId`, the destination person's `email`
  and a nonempty `evidence` description reviewed by the owner. An inactive or
  unknown destination identity is refused. Omit an unproved mapping; names are
  never matched automatically.
- `threads`: up to 100 entries. Each has its source `id`, `author` with `id` and
  `name`, original ISO `at`, `message`, boolean `resolved`, optional
  `resolvedAt` and `resolver` (a source identity with `id` and `name`), and optional `replies` with source `id`, `author`, `at` and
  `message`. Replies retain their source times and appear chronologically.
- Each thread has either an `anchor` containing `kind: "pdf"`, a one-based
  `page` and a four-number `region` in page fractions, or `quotedText` when its
  source anchor cannot be located. A supplied PDF anchor must fit the actual
  selected original. A missing anchor is visibly marked **Anchor not found**.
- Optional `mentions` and `assignee` contain source author IDs. Mentions grant
  nothing. If an unresolved assignee is unmapped or cannot open the destination
  version, the preview names the gap and routes the task to the file owner or current space managers with
  destination access. A destination with no available custodian is refused. No grants are made.

For example, this export preserves an unmatched person's comment without
claiming that a current colleague wrote it:

```json
{
  "format": "chest-review-1",
  "provider": "Google Drive",
  "file": "synthetic-chest-1",
  "threads": [{
    "id": "synthetic-chest-2",
    "author": { "id": "synthetic-chest-3", "name": "Sam Archive" },
    "at": "2022-04-05T10:00:00.000Z",
    "message": "Please keep the original delivery terms.",
    "resolved": false,
    "quotedText": "Delivery within thirty days."
  }]
}
```

Imports and retries send no email or in-app notices. The source file and thread
IDs, original attribution, times, state and quote appear on the file page.
Unmatched authors display as **Former collaborator (name as in source)** using
the actual source name. Native replies and decisions use the signed-in person's
identity. Saving a replacement never changes the source author's attribution.

The source thread ID identifies one publication on that file. Repeating an
identical export leaves later replies and resolution unchanged, including after
a restart. Changed history under an already imported source ID is refused with
`source_comment_conflict`; use the migration adapter's reconciliation workflow
when delivered, rather than overwriting local review work. A changed destination
or preview input requires a fresh preview. Up to 512,000 JSON characters and 100
replies per thread are accepted; split larger exports into distinct batches.

## Google Drive comment responses

The receiving door also accepts `google-drive-comments-1`, containing `file`
(the Drive file ID) and `comments` from the Drive v3 `comments.list` response.
Collect every page first; a remaining `nextPageToken` is refused. The response
must include `id`, `content`, `createdTime`, `modifiedTime`, `resolved`,
`author.displayName`, `anchor`, `quotedFileContent`, and `replies` with their
IDs, content, times, authors and resolution actions where available. Deleted
records are not published as active threads.

Drive does not identify a comment author by email. The optional `mappings`
therefore bind each explicitly evidenced source record, rather than guessing
from its display name: `authorId` is `comment:<comment ID>` for a thread and
`reply:<comment ID>:<reply ID>` for a reply. The owner must verify each mapping
and its evidence in the preview. An omitted mapping remains a former
collaborator. If the export exposes `assigneeEmailAddress`, map its confirmed
identity as `assignee:<comment ID>`; exposed `mentionedEmailAddresses` use
`mention:<source address>`. Unmapped mentions create no delivery or access.

An optional `anchors` object maps a comment's source ID to a verified PDF page
and region in the selected Chest original. An opaque Drive anchor is never
silently reused as a PDF location. If it cannot be located, the source
`quotedFileContent.value` is kept with **Anchor not found**. A source anchor
that has neither a verified location nor a quote is refused for review.
This supports supplied API exports; Chest does not fetch a Drive account or
claim the rest of its migration and delta workflow is complete.

A source resolution action retains its own actor and time where exposed. When
the resolver is absent, Chest labels the state as recorded in the source and
does not attribute the resolution to the comment author. The original source
state stays in provenance after a later Chest resolve or reopen.
