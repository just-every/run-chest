# sx-chest-kbdfix-1 — main fails the same keyboard leaf

Outcome: BLOCKED main fails the same leaf. No product edit, commit, push, PR, contract change, workflow edit, test edit, dispatch or rerun was made. The brief explicitly assigns this outcome to fv. This is report-only evidence, not product READY, acceptance or landing.

## Custody and scope

- Repository: just-every/run-chest.
- Local requested product branch: cloud/sx-chest-kbdfix-1, at unchanged main `dec6581db16d6959957485b3deb25cbd03d1531d`.
- Refused candidate inspected and executed: `cloud/sx-chest-c-f52-rebase-269add145f68b382355dcc6d04c5a68c802cec70`, head `269add145f68b382355dcc6d04c5a68c802cec70`.
- The named local branch contains none of the refused f50/f52 keyboard changes. Neither refused landing is superseded by this blocked diagnostic run. The fetched rebased candidate contains the keyboard disclosure/tooltip dismissal, focus scroll margins, shell script inclusion and connected keyboard journey from that slice. Its three commits are recorded in candidate-commits.txt; its scope is in candidate-scope.txt. The brief states f52 added no delta over f50.
- Candidate and main share the exact same `src/chest/files/ui-item.ts` and `src/chest/files/ui-panel.ts`; `git diff --quiet` for both paths succeeded. Main is an ancestor of the candidate. A final remote main lookup still returned `dec6581db16d6959957485b3deb25cbd03d1531d`.
- Evidence lives outside the product checkout in the task packet and is published only to evidence/sx-chest-kbdfix-1. No Inbox or State file was accessed.

## Plan and execution

The full plan is PLAN.md. Completed: fleet launcher and credential setup, fresh shallow filtered main clone, local fleet identity and hooks, frozen dependency/setup step, candidate fetch, unchanged candidate reproduction, same-host main comparison, source attribution, clean terminal checkout and report transport. The conditional repair/rebase/lock/typecheck/three-pass/CI-push steps were not entered because main reproduces the missing target. There is no new source change to lock or validate; no empty commit was created.

Verify's `shards (browser-files)` step runs `node scripts/verify-ci.mjs browser-files`. verification.json declares these 11 commands in order: browser-files.mjs, browser-scan-fields.mjs, link-policy.mjs, collection.mjs, guest-links.mjs, link-discussions.mjs, reading.mjs, scan-fields.mjs, search.mjs, quota.mjs and open-source.mjs, all under tests/chest.

The unchanged candidate was built through the published RER setup in a clean committed clone. On this Linux cloud host, with Chromium `/usr/bin/chromium` and `--no-sandbox`, the bounded command was:

```sh
CHEST_TEST_CHECKOUT=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium timeout 600 node scripts/verify-ci.mjs browser-files
```

It ran through cloud_run, exited 1 at the first command, and reproduced the exact reported assertion at desktop 1440×1000:

```
no keyboard trap while reaching getByRole('link', { name: 'Open safe text preview', exact: true }).first(): []; active=<a class="wordmark" href="/app/files">...
```

candidate-browser-files.log is the complete actual command output, including non-blocking local self-signed TLS diagnostics and the assertion stack at browser-accessibility.mjs:51,142 and browser-files.mjs:253. candidate-keyboard-trap-failure.png is the original failure screenshot; candidate-1440-keyboard-store.png is the original journey's preceding screen. The remaining ten manifest commands did not execute after the first command failed. There is no whole-group pass or three-consecutive-pass claim.

## Main comparison and measurement limits

Main was rebuilt separately with `cloud_run timeout 300 npx -y @runeditrun/rer build`, in the same checkout and host. An external report-only diagnostic uses the same public-door nested folder fixture, the same two retained text originals, ordinary email-link staff sign-in, and the candidate's unmodified `focusProof` and `tabTo` functions. Only the Playwright import resolution and export wrapper differ; helper-provenance.json records this provenance. No repository test or product source was edited. Its selector and trap assertion are unchanged.

Both builds have **zero** exact-name `Open safe text preview` links, **two** exact-name `Preview` links to the retained original byte endpoints, and **one** embedded text preview frame. Both originals are classified `text`; corresponding original hashes and sizes match between builds. This rules out a missing seeded file or unsupported preview format.

The initial isolated runs at 1440×1000 encountered other visibility assertions before completing the target search: the direct-navigation candidate probe stopped at a partly clipped Comment textarea after 38 focus events; main's folder-to-file probe stopped at a partly clipped Star button after 51. These actual receipts/logs are retained and are not represented as the reported trap assertion.

To isolate target reachability from those separate geometry assertions, the final matched comparison uses **1440×8000**, the same unchanged helpers and keyboard folder-to-file navigation on both builds. This is a diagnostic viewport, not passing acceptance proof or a replacement for the original 1440×1000 journey. Commands, each bounded to 180 seconds and run through cloud_run:

```sh
node ../packet/keyboard-leaf.mjs main isolated
node ../packet/keyboard-leaf.mjs candidate isolated
```

Both exit 1 with the **identical exact trap assertion**, empty target array and focused wordmark. Both record 80 focus events; the control sequence matches, with only the synthetic retained-version creation-minute text differing. Both report zero target links and the same two alternative links. The actual receipts are main-isolated-leaf-receipt.json and candidate-isolated-leaf-receipt.json; complete logs and 1440/390 screenshots accompany them. The width-390 captures are observational screenshots, not a passing keyboard journey claim. Browser contexts and harnesses are closed in finally blocks.

Main's stock browser-files script does not contain accessibilityJourney, so a stock-main shard pass would not answer this comparison. It was not represented as running the candidate's full journey. Main's demonstrated absent target and identical isolated leaf failure trigger the brief's explicit stop condition.

## Source attribution

Main commit `b3849d16ba7549a31ac045de06fe38165a9df612` (CH6: owner words on owner screens) changes the retained-version link label in `src/chest/files/ui-item.ts:74` from `Open safe ${v.preview} preview` to `Preview`. Its commit message explicitly says journeys follow the renamed labels. label-rename.patch contains the actual source diff. The candidate's `tests/chest/browser-accessibility.mjs:141` still asks for `Open safe text preview`.

The evidence establishes a label/selector mismatch already present in main's product code, not an actual focus cycle confined to the wordmark: the focus trace traverses the file-page controls before returning there. Restoring the old product label or changing the selector would require resolving the main wording interaction; this task forbids changing the selector and explicitly stops when main fails this leaf. No product workaround or test relaxation was made. A candidate-only bisect is unnecessary because its prerequisite was not met.

## CI and clause accounting

One GitHub API call verified the historical run metadata, saved in refused-ci-run.json: Verify **42279132311**, attempt **2**, completed/failure, exact head **269add145f68b382355dcc6d04c5a68c802cec70**. The brief supplies failed browser-files job **128125386665**. No new CI was triggered and no green result is claimed. No dispatch/rerun was performed. GitHub API budget used: 1 of 10; no repeated poll or archive request.

CLAIM OPS-001 PARTIAL -> PARTIAL. No Status, Gap or Evidence edit in CONTRACT.md. No generated view, source lock or workflow edit.

Before -> after counts, all unchanged:

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 40 -> 40 | 45 -> 45 | 38 -> 38 | 123 -> 123 |
| Agent surface | 0 -> 0 | 2 -> 2 | 24 -> 24 | 26 -> 26 |
| Later | 1 -> 1 | 4 -> 4 | 16 -> 16 | 21 -> 21 |
| Full target | 41 -> 41 | 51 -> 51 | 78 -> 78 | 170 -> 170 |

Blocker for fv: main fails the same missing-preview-link keyboard leaf. The retained preview exists as `Preview`; the refused keyboard slice expects the prior label. Product branch remains local and unchanged; there is no product push rejection or finished unpublished product commit requiring rescue. Evidence publication is independent custody.
