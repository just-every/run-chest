# Send a delivery package

Open a file or folder and use **Send a delivery package**. Chest pins its current
versions, including a folder's membership and paths. Later replacements and new
files do not change that package. Current access restrictions, trash, sharing
policy and revocation still apply.

Choose anyone with the link, or invited email addresses. Invited recipients verify
their address by email and get access only to that package. You can email the
package while creating it, or copy its link once. Chest stores only a fingerprint
of the link. Set an expiry and a maximum number of download sessions if needed.
A recipient starts a session explicitly; that session can resume downloads with
HTTP byte ranges without spending another session. A new browser uses another
session. Expiry and revocation stop even an existing session's next request.

**Deliveries** shows the package's history. Page views, known scanner views, email
provider acknowledgments, complete file bytes served and explicit recipient
confirmations are separate events. A view or email acknowledgment never proves
human receipt. Complete bytes served means the server finished every byte range;
it does not prove a saved file. Public confirmations are self-reported. Invited
confirmations identify the email address verified for that link.

A package accepts a file or a folder snapshot with up to 500 descendants and 100
levels. It streams originals from storage, including originals admitted through
resumable uploads, without buffering the file in the Worker. Downloads support
`Range`, `Accept-Ranges`, `Content-Range` and SHA-256 ETags. Invalid ranges return
416; a mismatched `If-Range` returns 412. Keep the download session cookie to resume.
