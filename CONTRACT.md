# Chest product contract

Chest is a Documents edition for an owner-operated library of supplier, customer
and project records. Each clause is exercised through public HTTP doors; the
fresh-clone browser journey checks the built interface at 1440 and 390 pixels.

| Clause | Observable guarantee | Public proof |
| --- | --- | --- |
| CHEST-01 | One-time owner claim, ordinary staff invitation and email-link return, session revocation; development personas are separately gated. | `tests/chest/flows.mjs`, `tests/chest/journey.mjs` |
| CHEST-02 | Collections, owner-editable typed schemas, required fields, accountable people and groups. Schema changes retain authoritative values and report missing/invalid fields only on accessible records; new filings and uploads validate current definitions. | `flows.mjs` |
| CHEST-03 | Validate actual uploaded bytes, checksum and size; durable R2 custody precedes atomic record admission. No failed upload appears in the library. | `flows.mjs` |
| CHEST-04 | Supplier/customer/project filing preserves original filenames, typed values and accountable responsibility. Collection moves require current source-record and destination-collection editor access; inherited access follows the destination and versions/review survive unchanged. | `flows.mjs` |
| CHEST-05 | Signature-classified PDF/raster and escaped UTF-8 text previews; unknown formats download only. Active HTML/SVG is served as sandboxed plain text. | `flows.mjs`, `journey.mjs` |
| CHEST-06 | Current access filters lists, counts, title/metadata/extracted-text search, detail, previews, downloads and mutations. Derived text retains parser provenance and version identity. | `flows.mjs` |
| CHEST-07 | Immutable original versions; approved A stays current while B/C await review. Approving B never selects pending C. | `flows.mjs`, `journey.mjs` |
| CHEST-08 | Assignment, comments, requested changes and approval record exact actor/version. Resubmission uploads a new immutable version, retaining earlier requested changes and the approved pointer until exact replacement approval. Approval requires assigned reviewer plus current reviewer access. | `flows.mjs` |
| CHEST-09 | Separate review and expiry dates, due/upcoming work and evidence-bound completion without destruction. | `flows.mjs` |
| CHEST-10 | Owner grants/revokes reader/editor/reviewer access for people/groups; effective readers require active local identities. Revocation reaches every private door. | `flows.mjs` |
| CHEST-11 | Archive preview makes no document writes, reports every item/hash/duplicate/mapping/gap and binds apply to reviewed fingerprint. Actual Base D1 journal and native target publish inert records, resume across restart, undo untouched batches and preserve conflicting native edits. Unsafe paths/corrupt bytes publish no documents. | `flows.mjs` |
| CHEST-12 | Full local RER export/empty-target restore retains semantic records, portable people/groups/roles/grants, original version bytes, derived provenance, decisions, completions, trash, audit and import custody. Credentials/outbox are excluded; new setup regenerates secrets; old credentials fail. Nonempty/corrupt restore publishes no partial library. Public asset export is refused before writing and archive-bearing public assets block build/setup. | `journey.mjs` |
| CHEST-13 | Reversible trash retains bytes/history; only the owner can inspect trashed records. Every mutation is audited; no automated destruction. | `flows.mjs` |

No AI jobs, sync clients, anonymous sharing, Office rendering, statutory retention,
WORM, legal hold, certification or signature-validity claim is included. PDF and
raster previews use the browser viewer; PDF/raster OCR and text extraction are
not implemented. Searchable extraction covers admitted UTF-8 text (up to 500 kB).
Other original files are admitted up to 8 MB; archives up to 100 items and 16 MB
JSON. These are disclosed local admission limits, not provider capacity claims.

Validate a representative owner archive before relying on a migration.
Documented-shape synthetic fixtures prove implementation behavior, not incumbent
fidelity or economic advantage. Remote hosting and external email require the
owner's accounts and separate acceptance. AI jobs are not implemented.
