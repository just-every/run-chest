# Open source and dependency licenses

Chest's source is licensed under the [MIT license](../LICENSE). There is no Chest license key, seat fee or feature payment. Hosting, storage, mail, editors and other services can charge their own provider costs. The provider cost view belongs to ADMIN-002.

Every source release contains `LICENSE` and the generated [third-party license inventory](../THIRD-PARTY-LICENSES.md) beside it at the root. The RER source exporter includes every ordinary committed source file; there is no separate release inclusion list to maintain. Commit the inventory with each dependency change.

After a frozen dependency install, regenerate it with:

```sh
node scripts/third-party-licenses.mjs
```

Generation walks the production roots in `pnpm-lock.yaml`, including transitive dependencies, peer-resolved snapshots, package aliases and optional platform dependencies. It reads installed package manifests. When pnpm excludes an optional binary for another platform, it reads that version's published npm manifest and requires its distribution integrity to match the lock. A missing required package, missing license or metadata failure stops generation. Development-only dependency roots are excluded; tooling reachable from a production dependency is included.

Verification is offline:

```sh
node scripts/third-party-licenses.mjs --check
node tests/chest/open-source.mjs
```

The first command requires exact inventory coverage, current locked distribution identities and matching installed license declarations. For other-platform optional binaries it retains the recorded, integrity-bound declaration. Regeneration refreshes these declarations from npm. Dependencies retain their own licenses: the inventory includes LGPL dependencies and does not relicense them as MIT. Full dependency distributions contain their license texts and notices.

The OPEN-001 journey exports the current candidate source with the same `publicExport` implementation as `rer release`, extracts the actual tar into a fresh source directory and checks the MIT license and every production dependency against the archived lock. It scans application source and the exported source for charge gates. RER's release command separately requires a clean committed source checkout and performs its publication and verification gates.

The production Worker journey invites 150 staff through the public API and verifies that each invitation reaches the mail-provider edge. Requests use several trusted Cloudflare source addresses to stay within the normal per-IP mail abuse protection. The last invited person signs in, uploads, shares through the browser form route, searches and downloads with a colleague, and connects through a device credential. Rendered file, search, library and admin pages are checked for charge prompts. These checks supplement the existing delivered-feature journeys; they do not claim native client delivery or the unfinished ADMIN-002 provider cost view.
