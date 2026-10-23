# Built-in eSignature (SIGN-001)

Open a PDF or Word file, choose **Request signatures** and Chest drafts a request from the file's exact current
version. You need contributor, content-manager or manager access on a space file, or editor access on a file in
your personal area, with downloads allowed.

- **Word files** are rendered to a PDF first. The rendition records its source version and its SHA-256, and the
  compose page shows a fidelity report (substituted fonts, pictures, headers and footers, text boxes, columns and
  characters Chest cannot reproduce) before anything is sent. Signers sign that PDF.
- **Signers** are staff or anyone with an email address; no Chest, Google or Microsoft account is needed. Set the
  order (one after another, or everyone at once), place signature, initials, date-signed, text and checkbox fields
  by clicking the page, then choose an expiry and a reminder cadence.
- **ESIGN exclusions:** Chest warns when the text looks like a will, court notice, default or eviction notice and
  asks you to acknowledge the warning. It claims no legal sufficiency for any particular document.

## What a signer sees

The invitation carries a link naming one signer on one request. An external signer opens it and Chest emails a
six-digit PIN to the invited address (valid 10 minutes, five wrong guesses burn it, five PINs per 15 minutes); the
PIN earns a one-hour cookie scoped to that link. A staff signer signs in to Chest as the invited address. Before
signing, each signer reads and accepts the electronic-records disclosure, adopts a signature by typing their name
and confirms intent, or declines with a reason. A signer sees only this document and gains no other access. Links
are derived from the installation secret, so **Send a fresh link** replaces one and a restore into another
installation leaves old links inert.

## Completion

When the last signer signs, Chest stamps every completed field into the PDF, seals it with a PAdES
(ETSI.CAdES.detached, ECDSA P-256 with SHA-256) digital signature made with the installation's signing key, writes an
audit certificate (signers, verification methods, every event with address and browser, timestamps, and the SHA-256
of the document before and after signing; sealed with the same key) and files both as new versions of the source file
linked to the source version. The source version, the file's current version, grants and links do not change. On a
governed folder the new versions wait for review. Every signer receives the completed copy by email link. Declined,
voided and expired requests file nothing and keep their record. Signing approves nothing (CHEST-08).

**Check seal** on a request validates a signed PDF; the API `POST /api/chest/signatures/validate` accepts a version or
the bytes of a downloaded copy and reports whether the signature validates and covers the whole file. One changed byte
fails it; OpenSSL (`openssl cms -verify`) verifies the same bytes.

## Key custody and retention

The signing key is generated on first use and sealed in `chest_signing_key` using a dedicated
`SIGNING_KEY_SECRET`, with HKDF-SHA-256 info `chest-document-signing-custody-v2` and AES-GCM.
This managed setup secret must differ from `SESSION_SECRET`. Neither secret nor the private key appears in archives,
logs, served assets or prompts. Session-secret rotation does not change the signing-key wrapping key.
A restored Chest makes a new key; earlier signed PDFs still validate from their embedded certificate.

To rotate custody, retain the old wrapping secret privately as `SIGNING_KEY_PREVIOUS_SECRET` and configure a fresh
`SIGNING_KEY_SECRET` using the install's secret-management door. Until re-sealing succeeds, new signing fails closed;
existing signed originals remain downloadable and verifiable. With an ordinary current owner session, POST
`{"confirm":true}` to `/api/chest/signatures/rotate-key` on the installation's own origin. The operation re-seals the same
private key and certificate, records the certificate fingerprint in the audit, and atomically refuses a stale session or
concurrent rotation. It never returns key material. Remove `SIGNING_KEY_PREVIOUS_SECRET` after success. Other users,
cross-origin requests and missing confirmation are refused. The previous secret is never used to sign.

For an installation upgrading from session-sealed v1 custody, first configure `SIGNING_KEY_SECRET`, retain the old
`SESSION_SECRET` until the same owner-confirmed rotation call has migrated the key, and only then rotate the session
secret. A missing or wrong old key fails without generating a replacement signing identity. Preserve the custody
secrets in the owner's private recovery system; they do not travel in a product backup. `SECURITY-001` retains the
remaining installation-wide rotation and recovery obligations. Signed records stay with the file until an
authorized erasure (ERASE-001), which also removes the file's requests and signer links. Reminders and expiry are
processed by the scheduled sweep and on requests; they stop on completion, decline, void and expiry.
