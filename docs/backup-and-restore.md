One export holds your whole library in one file: every original and version,
the typed fields, people, groups, roles and grants, review decisions, completed
work, trash, the audit trail and move-in history. Sign-in sessions, links and
local passwords are not included.

## Export

Stop Chest, then export into the `exports` folder inside your Chest folder:

```sh
rer dev --stop
rer export --output exports/library.rer
```

The file holds your private originals and records. Keep it somewhere safe, and
keep a second copy away from this computer.

## Restore into a fresh Chest

Restore only into a Chest with nothing in it, such as a new copy:

```sh
git clone https://github.com/just-every/run-chest.git chest-restored
cd chest-restored
rer install
rer import --input exports/library.rer --yes
```

Copy the archive into the new copy's `exports` folder first. Chest checks the
whole archive before it writes anything, and refuses a damaged archive or a
Chest that already holds data.

## After a restore

Restored people come back with their grants, but not their sign-ins. Set up the
owner again, start Chest and invite your staff again with the same emails:

```sh
rer setup --owner-email you@example.com
rer dev
```

Old sign-in links and sessions do not open the restored Chest.

## Start over

`rer reset --yes` removes every record and setting from this copy of Chest.
Export first if anything should survive.
