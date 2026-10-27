# Measuring operating scale

Super administrators open **Administration**, then **Operating scale**. The console
retains the latest submitted journey's admitted counts, source commit, seed,
environment, p50 and p95 milliseconds, sample counts and target comparisons.
The authenticated `GET /api/chest/administration/scale/health` returns 503 when
no measurement exists, reference dimensions or the measured US 100 Mbps network
are unproved, or any p95 target is missed. Undersized fast runs remain failing.
Submissions use `POST /api/chest/administration/scale` with the report shape emitted
by the journey. These are operator-submitted observations, not certified capacity.
Reports survive restart and recording is audited. Only current super administrators
may read or submit installation-wide measurements.

Run the committed `tests/chest/scale.mjs` after building a disposable checkout.
It admits deterministic originals using `scripts/scale/generator.mjs` through
ordinary identity, group, space, upload and device doors. It records actual
items, original bytes, depth, people, devices, largest space and folder, direct
members, remote changes and elapsed offline days. It measures ten listings,
ten deep opens, exactly 50 searches, an initial device tree and a cursor catch-up.
The next requests after a group removal must refuse folder access, return no
search matches, refuse original download and refuse device hydration. The tree
must also omit the revoked space. Browser proof covers the operator results and
icon tooltips at 1440 and 390.

The default is a bounded diagnostic: 60 files, eight folders, three people,
two device credentials and 20 remote renames, with no seven-day offline wait.
`CHEST_SCALE_DIRECT_MEMBERS` adds that many individual grants, including the manager, to the
populated measurement space. The group-only revocation subject has no direct
grant; the direct roster uses separate people admitted by ordinary invitations. `CHEST_SCALE_DEVICES` enrols additional device credentials, and
`CHEST_SCALE_CHANGES` selects the exact remote rename count after the initial
enumeration. Credentials alone do not establish active native synced devices.
The generator records maximum actual child count and counts the deepest file
as one level below its folder.
`CHEST_SCALE_FILES` and `CHEST_SCALE_DEPTH` select larger admitted datasets.
`CHEST_SCALE_INVENTORY` names a private JSON inventory with the numeric dimensions
exported by `inventoryTarget` in the generator. The output records the larger of
the reference and each supplied inventory dimension with 25 percent headroom;
this plans the required size and does not claim that size was generated.
No originals are represented by sparse files or invented byte counts.

Use the **Scale journey** workflow on the candidate branch. Its manual `dimensions`
profile selects 100 folders and 600 direct grants in the populated measurement space,
300 total device credentials and 10,000 immediate renames. Invitations use
distinct synthetic client addresses at the test runtime network edge; all
authentication rate limits remain enabled. This is a bounded protocol profile. Changes to its workflow, generator or journey start it on a pull request at the exact candidate head; manual dispatch is also available after workflow registration on the default branch.
It runs separately from push Verify, records the exact checked-out commit and
uploads measurements and browser captures. It exercises the actual built Worker
in an isolated local runtime, without a network latency claim. The real 10 TB,
2,000,000-item installation, 150 people, 300 synced devices, 500,000-item space,
600 direct members, 100 levels, 20,000-child scrolling without reload, US-region
100 Mbps measurement, seven-day device catch-up on 10,000 changes, on-demand
500,000-item enumeration without hydration, and buyer inventory rerun remain
acceptance gaps. Device enumeration uses bounded metadata pages. `GET /api/chest/sync/tree`
returns at most 500 candidate items and a `next` identifier. Continue with
`after=<next>&cursor=<initial cursor>` until `next` is null, including pages
whose visible item list is empty. Every page recomputes current access. Retain
the same optional `space` selector on each page to enumerate one space through
its indexed metadata path. A selector grants no access. Retain
the initial cursor and replay changes after enumeration: a concurrent insert
can sort before an already-scanned identifier. The change feed reads bounded
ordered journal windows and returns `until`; retain it while following `more`
to finish one catch-up despite concurrent writes. Both paths load only the
requested items and their ancestor closure, preserving the existing grant, link
and content-security checks. No enumeration request reads original bytes.
The file-backed companion consumes all pages before transferring any file and
retains its explicit 500-file queue limit. It still accumulates global metadata.
Folder child reads use an indexed space and parent predicate, and deep opens
read their bounded ancestor chain in one recursive database query. Authorization
still evaluates every ancestor and every current grant before serving a result.
These bounded protocol measurements do not establish reference capacity or
native client behavior. In particular, the existing device security session
expires before seven days; this change does not relax that policy.
