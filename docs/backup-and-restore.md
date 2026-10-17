One export holds your whole Chest in one file: team spaces, folders and files,
every original and version, people, groups, roles and grants, the
Library's typed fields and review decisions, completed work, trash, the audit
trail and move-in history. Sign-in sessions, links and
local passwords are not included.

This page is for Chest on your computer. A hosted Chest is backed up with its own
command; see [Host Chest on Cloudflare](/docs/hosting#back-up-a-hosted-chest).
`rer export` saves only the copy on this computer and refuses a hosted address.

## Export

Stop Chest, then export into the `exports` folder inside your Chest folder:

```sh
rer dev --stop
rer export --output exports/library.rer
```

Export and restore take time in proportion to your files: on a busy computer,
about half an hour for each gigabyte (1.2 GB took 29 minutes to export and 37 to
restore). They print nothing while they work, so leave them running until they
print `Exported` or `import: complete`. Stop Chest first; it stays stopped
while they run.

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

Copy the archive into the new copy's `exports` folder first. rer reads the whole
archive and checks every part before it restores anything, and refuses a damaged
archive or a Chest that already holds data.

If a restore stops partway (an error, a closed terminal, a restart), run the same
`rer import` command again in the same copy: it starts over. If it is refused
because the copy now holds data, clear that copy with `rer reset --yes` and run
the import again. Your archive is never changed by a restore.

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
