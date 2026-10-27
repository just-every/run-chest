# Chest rulings

Each ruling that shapes a clause in [CONTRACT.md](CONTRACT.md): the clause states the outcome, and the entry here says why. A ruling only unblocks a clause; done still needs its proof. RL-1 to RL-9 were moved out of the contract's clause text and Status gaps in the 28 October 2026 contract cleanup, RL-10 to RL-23 record the cleanup's own decisions under the owner-approved cleanup rules, and RL-101 and above are ct's ruling pass, copied verbatim. Old clause ids map to the current ones through [docs/contract/ID-MAP.json](docs/contract/ID-MAP.json).

## Rulings moved from the contract

### RL-1 — run-auth proves federation

- Date: 17 October 2026 (owner direction); recorded in ADMIN-001 on 19 October 2026
- Ruled by: the owner
- Governs: ADMIN-001

Run Edit Run's own Auth product (run-auth), run locally as the live OIDC, SAML and SCIM provider, proves ADMIN-001's protocol and lifecycle. Per the default sent to ct, these real protocol and lifecycle journeys satisfy the tenant acceptance. Okta, Microsoft Entra ID and Google Workspace tenant certification is not claimed by that journey; it is Field proof register row R-17.

### RL-2 — Clause boundaries on the 19 October planning defaults

- Date: 19 October 2026
- Ruled by: planning defaults accepted for the builders and sent to ct
- Governs: QUOTA-001, SYNC-011, MOBILE-001, OPEN-001, ADMIN-005

The macOS and Windows tray and the mobile upload-queue display of a storage-limit refusal belong to the client clauses (SYNC-011 and MOBILE-001), not QUOTA-001. The provider-only cost view that OPEN-001 relies on belongs to the administration clauses (ADMIN-005). Native client delivery stays in its own clauses.

### RL-3 — Link and guest admission riders

- Date: 22 October 2026
- Ruled by: ct (approved riders on SHARE-001 and SHARE-005)
- Governs: SHARE-001, SHARE-005, SHARE-009, SHARE-010

Password admission is bound to the current staff session, lasts at most the shorter of 12 hours and the ADMIN-004 session, and ends on sign-out or revocation; public and guest password admissions are revocable and link-scoped with the same cap. Selected versions never expose pending replacements, and independent grants keep their rights. Downloads charge the oldest eligible link for the same item and effective rights. Guest PINs are six digits, expire after 10 minutes and five guesses, and a new PIN invalidates its predecessor for that address; sends are limited atomically to five per invitation per rolling hour. Guest sessions last the shorter of the configured re-verification interval and the ADMIN-004 session. Grants always expire, with a default 30-day maximum shared with SHARE-009. Onward sharing is off, with no setting. Editor (WOPI) tokens last at most 30 minutes and recheck live guest and password authority.

### RL-4 — Content-security policy

- Date: recorded in the SECURITY-002 Status row (21 October 2026 judgement)
- Ruled by: the owner (owner-directed adopted policy)
- Governs: SECURITY-002, SECURITY-004

Processing needs explicit owner confirmation; only the owner configures reader and reviewer groups; a release needs a recorded reason and the owner or a selected reviewer with current security scope over the uploader. Originals up to 1 GiB are processed, and larger ones stay quarantined.

### RL-5 — eSignature signer defaults (adopted, awaiting ct)

- Date: recorded in the SIGN-001 Status row
- Ruled by: adopted default, awaiting ct
- Governs: SIGN-001

A six-digit signer PIN valid for 10 minutes with five guesses, a one-hour signer session, and typed-name signature adoption. Signing-key custody uses dedicated `SIGNING_KEY_SECRET` material and its own HKDF label (`chest-document-signing-custody-v2`), independent of the session secret; an explicit owner-confirmed rotation re-seals the same key and certificate, including migration from legacy session-sealed custody, and old wrapping keys, a wrong KDF purpose, non-owners and cross-origin calls are refused (`docs/signatures.md`).

### RL-6 — Scan reading defaults (adopted; ruled by RL-103)

- Date: recorded in the SEARCH-002 Status row
- Ruled by: adopted default, awaiting ct; ct ruled on it in RL-103
- Governs: SEARCH-002

Conservative scan consent, call-based spend, and persistent retention until the original is erased. Uncommon TIFF encodings and age-based expiry are explicitly unavailable.

### RL-7 — Ask defaults (adopted; ruled by RL-102)

- Date: recorded in the AGENT-007 Status row
- Ruled by: adopted default, awaiting ct; ct ruled on it in RL-102
- Governs: AGENT-007

Owner-only policy activation bound to the current reader, verified provider retention and residency attestations, fresh approval per send, no local answer persistence, original-text authority, and existence-blind notices for restricted skipped files.

### RL-8 — Editor licence records (adopted; ruled by RL-101)

- Date: recorded in the ADMIN-002 Status row
- Ruled by: adopted default, awaiting ct; ct ruled on it in RL-101
- Governs: ADMIN-005, EDIT-006

A licensed editor's edition, limits and annual price are administrator-recorded from a quote; an explicit audited capabilities probe records only the reported product and version; every Chest admission refusal stays recorded, and browser-reported outcomes name their Chest admission or stay unmatched. Provider-side live capacity and independent licensed-limit verification stay unknown.

### RL-9 — One pending suggestion batch in the built-in editor

- Date: recorded in the ROLE-001 Status row
- Ruled by: implementation choice recorded with the ROLE-001 judgement
- Governs: ROLE-001, EDIT-009

Built-in DOCX suggestions keep a single pending batch, and contributors decide one engine change per saved version. Recorded so a later judge does not read it as a gap.

## Decisions of the 28 October 2026 contract cleanup

Each was made by the cleanup round under the owner-approved cleanup rules (27 October 2026) and the RER contract standard; ct may revise any of them by its own ruling.

### RL-10 — Later comes from the buyer review's "Also noted" test

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: SPACE-003, SYNC-012, MOBILE-006, AUDIT-002, CONNECT-003, CONNECT-013, MOBILE-004, FOLLOW-002, CONNECT-016, EDIT-012, EDIT-011, FOLLOW-003, EDIT-010, AGENT-009, SYNC-005, GOVERN-001, CONNECT-004, CONNECT-005, SEARCH-004, MIGRATE-013, SYNC-010, SYNC-014

Items the Chest buyer review (rounds 3 to 7, 16-17 October 2026) listed as non-blocking, but that rounds wrote in at full weight, move to Later: SPACE-003 (round 3, personal file ownership transfer), SYNC-012 (round 3, sync client network settings), MOBILE-006 (round 3, mobile editing), AUDIT-002 (round 3, file activity for editors), CONNECT-003 (round 3, HubSpot, with Salesforce following), CONNECT-013 (round 4, admin control of third-party apps), MOBILE-004 (round 4, ChromeOS), FOLLOW-002 (round 4, reply to a comment from the email), CONNECT-016 (round 4, Forms uploads; round 5, Forms responses sheet), EDIT-012 (round 5, CODE in production), EDIT-011 (round 5, download as another format), FOLLOW-003 (round 5, personal notification settings), EDIT-010 (round 6, assignment inside the comment box and linking to Chest files from the editor) and AGENT-009 (round 6, Gemini-style file and folder summaries).

Moved on the 27 October review's grounds (enterprise, rare, or outside a 10-100 person buyer's first week with Google Drive), not from an Also-noted list: SYNC-005, GOVERN-001, CONNECT-004, CONNECT-005, SEARCH-004, MIGRATE-013, SYNC-010 and SYNC-014.

Not moved: round 3's "SECURITY-002 thresholds". The thresholds are the defaults of Core mass-activity detection, so SECURITY-004 stays Core.

### RL-11 — Day-one gaps stay Core

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: SYNC-007, SYNC-013, CONNECT-009, CONNECT-015, MIGRATE-012, MIGRATE-011, EDIT-007, EDIT-008, EDIT-009

A gap a buyer review called day-one never moves to Later. The 27 October Chest review suggested Later for five items the buyer review had called day-one, and they stay Core: desktop Office presence and locks (round 2, day-one gap 5; only the perpetual Office versions, SYNC-014, move); CONNECT-009's Make app (round 1, day-one gap 12 named Zapier and Make); CONNECT-015, the Chat app (round 3, day-one gap 1 named Meet, Calendar and Chat); the move-in of open review work, MIGRATE-012 and MIGRATE-011 (round 6, day-one gap 1); and the editor review loop, EDIT-007 to EDIT-009 (round 5, day-one gap 1).

### RL-12 — Platform cells

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: SYNC-008, SYNC-009, SYNC-010, SYNC-007, SYNC-014, MOBILE-003

Full journeys run on current macOS (Apple silicon), Windows 11 x64 and Microsoft 365 Apps; the other supported cells build, install and smoke-test in CI (SYNC-009, MOBILE-003). Windows 10 22H2 (Microsoft support ended 14 October 2025, extended updates only) and perpetual Office 2016 to LTSC 2024 move to Later (SYNC-010, SYNC-014). The supported floors (macOS 13, iOS 17, Android 10) are unchanged; raising them is a separate decision.

### RL-13 — One mobile clause carries the feature doors

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: MOBILE-005, PREVIEW-001, SEARCH-001, SEARCH-002, SEARCH-003, SIGN-001, EDIT-003, EDIT-004, EDIT-013

"And in the iOS and Android apps" sentences held previews, search, scan fields, signing, comment threads and new files partial while no app exists. Those doors are now one clause, MOBILE-005, with its own acceptance, and the feature clauses are judged on their browser and API doors.

### RL-14 — Scale health: unmeasured is a warning

- Date: 28 October 2026
- Ruled by: contract cleanup round (cleanup proposal, section 3)
- Governs: SCALE-001, SCALE-002

An install not yet measured at the reference size reports "unmeasured", not failing; a measured miss still fails. Before this, every undersized install returned 503. The reference installation itself is register row R-1 and each buyer's inventory rerun is R-2.

### RL-15 — Vault-held content arrives under a preservation instruction

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: MIGRATE-010, GOVERN-001, ERASE-001

Held content arrives with erasure refused under ERASE-001's existing preservation instruction instead of waiting for a GOVERN-001 provider policy, which is Later. A provider policy can take it over later; plain R2 is still never called WORM.

### RL-16 — Door rules stated once

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: every clause that lists D-1 to D-4 under *Rules:*

D-1 to D-4 replace about a dozen "future doors inherit these gates before shipping" and "never grants access" sentences repeated across SECURITY-002, ADMIN-002, SHARE-001, SHARE-005, SIGN-001, AGENT-007, POLICY-001 and the connectors.

### RL-17 — The editor is pinned to the shipped Collabora version

- Date: 28 October 2026
- Ruled by: contract cleanup round (cleanup proposal, section 3)
- Governs: EDIT-001, EDIT-005

The failing-format rule stays, judged on the Collabora version Chest ships. The "in Chest's integration or upstream" duty, an open-ended obligation to patch a third-party engine rather than a buyer outcome, is dropped.

### RL-18 — Fakes and sandboxes prove Core; live tenants are register rows

- Date: 28 October 2026
- Ruled by: contract cleanup round (cleanup rule 2)
- Governs: MIGRATE-002 to MIGRATE-014, CONNECT-001 to CONNECT-016, EDIT-002, EDIT-014, OPS-001

Vendor adapters and connectors are proven against official-schema fakes built from the vendor's published API and export formats, or free developer sandboxes (Slack, Docusign, Zoom, Salesforce and HubSpot developer accounts; Zapier and Make private apps). Live tenants, marketplace listings, licensed apps and physical devices are register rows R-4 to R-19 and R-24. This supersedes the old ACCEPTANCE.md rule that each provider and device journey needs real test tenants and devices, and OPS-001's "no demo or provider stub counts as production acceptance": production still uses the owner's real accounts, and a fake proves behaviour, never a provider's availability.

### RL-19 — ESIGN and UETA wording

- Date: 28 October 2026
- Ruled by: contract cleanup round
- Governs: SIGN-001

SIGN-001 says it implements the ESIGN and UETA mechanics instead of "Evidential standard claimed". The substance (intent, consent, association, retention, the excluded-category warning, no claim of legal sufficiency) is unchanged.

### RL-20 — Availability is measured against a configurable target

- Date: 28 October 2026
- Ruled by: contract cleanup round (cleanup proposal, section 3)
- Governs: OPS-002

Chest is owner-run, so the owner's hosting decides availability. Chest measures each door against a target (99.9% monthly by default) and alerts when a month falls below it. The 30-day measurement is register row R-20.

### RL-21 — Empty parts of partial clauses are carried as missing

- Date: 28 October 2026
- Ruled by: contract cleanup round (standard section 7)
- Governs: every split part carried as missing from a partial clause

Each split part starts at its old clause's status. Where the old Gap named every point of a part as absent (for example the native clients split from SYNC-001, whose partial status rested on the server protocol), the part is carried as missing with that reason: a demotion, never a promotion.

### RL-22 — Agent surface clauses start missing

- Date: 28 October 2026
- Ruled by: contract cleanup round (standard section 7)
- Governs: SURFACE-001 to SURFACE-013, CONNECT-007

SURFACE-001 to SURFACE-013 are new, so no carry rule applies. Each starts missing, and partial only where an existing test proves some of its points through the integration door the agent's token uses (SURFACE-003 and SURFACE-012). None starts done; a fresh judge decides. CONNECT-007 stays done because its three points pass: the Base agent duties arrive as new clauses, not as a narrowing of an old one.

### RL-23 — The company's policy decides agent actions

- Date: 27 October 2026 (owner direction); applied 28 October 2026
- Ruled by: the owner (risk classes and company policy)
- Governs: the Agent surface, AGENT-001 to AGENT-008, SEARCH-002

Each Chest tool declares its risk classes, and Chest computes them per call on its server. The company's policy, from the paired Business or from Chest's own Agents settings, decides each call; setup asks every class Chest's tools carry, with no answer pre-selected, and agent access opens only once each is answered. Where a Core clause said a person approves an agent's step (AGENT-001 to AGENT-006 and AGENT-008), it is now worded as the class that step carries; each keeps its status, and the tests behind the done ones still prove the path. SEARCH-002's confirmation of typed values read from scans is a person's own act on Chest's built-in reader output under RL-103, not an agent's call; an agent's typed-field call carries its own class and is recorded as "<agent> for <person>" (BASE-AGENT-008).

## ct ruling pass, 28 October 2026

Copied verbatim from ct's ruling file. RL-101 governs the licence records that ADMIN-002 held, now ADMIN-005; RL-102 governs AGENT-007; RL-103 governs SEARCH-002.

### RL-101 — Configured licensed limits versus provider observation

- Date: 2026-10-28
- Ruler: ct
- Governs: ADMIN-002
- Outcome: **adopt with rider** — Adopt attributable administrator-recorded edition, source quote, limits and USD estimates with explicit audited probing, separately labeled Chest reservations/refusals and observed matched/unmatched provider outcomes; unknown provider-side enforcement or licensed limits must remain unknown until independently qualified.

**Question:** May admin-entered license quotes and explicit probes support honest local admission reporting without claiming provider capacity verification?

**Adopted default:** Administrator records licensed edition, limits and annual price from quote; explicit audited capability probe reports product/version; Chest admission refusals and matched browser outcomes remain separate; live provider capacity unknown.

**Incumbent behavior and why:** Google Workspace exposes privilege-controlled usage/storage/sharing reports. Collabora staff distinguish default CODE, Home Mode and commercial offerings; therefore old universal document/connection caps must not be invented. No common norm supplies a fixed commercial limit or USD price: use the installation’s actual quote, distinguish configured from observed limits and qualify the exact product/mode. The 23 October accepted reporting note and later main wording remain intact.

**Single placement:** ADMIN-002 owns reporting provenance once; EDIT-001 retains editor packaging/capacity proof and QUOTA-001 retains storage-limit behavior.

**Engineering/proof boundary:** Trusted licensed-limit verification, live provider capacity and complete provider refusal reporting remain qualification/proof work. A quote or probe does not authorize purchase/spend, certify licensing, prove invoice charges or satisfy independent editor operation. Preserve interrupted output uncertainty and original-byte versus ZIP-framing accounting.

**Sources:**
- [Administrators with report privileges inspect usage, storage and sharing metrics.](https://support.google.com/a/answer/6000244?hl=en)
- [Collabora staff distinguish unlimited default CODE from bounded Home Mode; commercial terms need qualification.](https://forum.collaboraonline.com/t/does-collabora-code-26-04-2-4-have-any-user-or-concurrent-connection-limits/5023)

### RL-102 — Exact reader policy and transient cited answers

- Date: 2026-10-28
- Ruler: ct
- Governs: AGENT-007
- Outcome: **adopt with rider** — Adopt owner-activated current reader/retention/residency policy and fresh approval of each exact Ask disclosure and quote-based budget; check original-text access before dispatch and return, keep question/answer transient, retain only content-free policy/version/usage receipts and use an existence-blind restricted-entry notice.

**Question:** May an owner activate a reader policy while each Ask send requires fresh approval and current original-text access?

**Adopted default:** Owner-only reader-policy activation, verified processor retention/residency terms, current reader binding, fresh per-send approval, no local answer persistence, original-text authority and existence-blind restricted skips.

**Incumbent behavior and why:** Google Workspace Gemini respects user access and data-training permission; Ask Gemini supports selected sources and citations, including saved projects. No common norm requires transient answers, a fresh approval on every Ask or owner-only policy activation. Choose the stricter explicit processor/snapshot disclosure because Chest operates a separately configured paid reader and cannot infer its provider’s region or retention from its own settings.

**Single placement:** AGENT-007 owns shared processor/access/Ask consent once; SEARCH-002 cites it and owns only its separate automatic-scan policy delta.

**Engineering/proof boundary:** Native iOS/Android Ask remains required under MOBILE-001. Provider terms are recorded and verified evidence, not an enforceable change to provider behavior; no tool, mutation, autonomous signature or hidden-file name/count can be enabled by this ruling.

**Sources:**
- [Gemini respects user access; Workspace data is not trained on without permission.](https://workspace.google.com/security/ai-privacy/)
- [Ask Gemini uses selected sources and citations and supports saved projects.](https://support.google.com/drive/answer/16963068?hl=en)

### RL-103 — Separately consented scan calls and explicit persistent custody

- Date: 2026-10-28
- Ruler: ct
- Governs: SEARCH-002
- Outcome: **adopt with rider** — Adopt a separately activated owner scan policy bound to the current reader configuration, durable per-original call allowances and per-call output ceilings, with every failure/interruption charged against the allowance and no reset on copying/policy edits; disclose persistent local reading custody until governed original erasure, stop new calls on disablement and require authorized human confirmation before typed values become authoritative.

**Question:** May automatic scan reading use a separate bounded owner policy and retain readings until original erasure?

**Adopted default:** Separate automatic-scan policy initially off; explicit reader terms; durable call allowances per identical original bytes, failed/interrupted calls counted; output ceiling; explicit persistence until original erasure; disabling retains prior originals/decisions.

**Incumbent behavior and why:** Google Drive mobile scanning saves searchable PDFs, and Google’s managed Gemini follows current access and data-use controls. No common norm establishes per-checksum paid-call allowances, mandatory human field confirmation or Chest’s persistence-until-erasure choice. Choose explicit bounded opt-in and visible persistent custody; saved searchable scanning is not evidence of any third-party processor’s retention.

**Single placement:** SEARCH-002 owns automatic-scan consent/call-budget/retention deltas once; cite AGENT-007 for provider terms, current access, source treatment and processor consent rather than copying them.

**Engineering/proof boundary:** Native device scan panels, unsupported TIFF encodings and age-based expiry remain honest missing capabilities. Call/token bounds are not a USD spend guarantee; provider cost stays explicitly estimated/unknown as appropriate. Retained originals/decisions are not erased by switching reading off, and full TINs or sensitive model notes must not enter stored field proposals.

**Sources:**
- [Drive mobile scanning saves documents as searchable PDFs.](https://support.google.com/drive/answer/3145835?hl=en)
- [Gemini respects user access; Workspace data is not trained on without permission.](https://workspace.google.com/security/ai-privacy/)
