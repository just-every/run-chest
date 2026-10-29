One export holds your whole Chest in one file: team spaces, folders and files,
every original and version, people, groups, roles and grants, the
Library's typed fields and review decisions, completed work, trash, the audit
trail and move-in history. Sign-in sessions, links and
local passwords are not included.

This page is for Chest on your computer. A hosted Chest is backed up with its own
command; see [Back up a hosted Chest](#back-up-a-hosted-chest) below.
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
owner again with your name (without `--owner-name` Chest calls you "Owner"),
start Chest and invite your staff again with the same emails:

```sh
rer setup --owner-email you@example.com --owner-name "Your Name"
rer dev
```

Old sign-in links and sessions do not open the restored Chest.

## Start over

`rer reset --yes` removes every record and setting from this copy of Chest.
Export first if anything should survive.

## Back up a hosted Chest

`rer export` without a target saves the copy on your computer. For a native
installation archive, use `rer export --target remote --origin YOUR_DEPLOYED_HTTPS_ORIGIN
--output exports/hosted.rer` with your deploying credentials in the process
environment and the matching `.rer/deploy` record in this checkout. Restore that
archive with `rer import --target remote --origin YOUR_DEPLOYED_HTTPS_ORIGIN
--input exports/hosted.rer --yes` into an empty deployment. See
[Linux server installation](/docs/server) for moving between targets.

For Chest's existing hosted backup directory format, run the hosted backup from
the same folder:

```sh
rer run hosted-backup --environment production --env-file chest.env
```

`rer run` uses the Node that rer keeps for itself, so this works right after the
`install.sh` install with nothing else to set up. If something stops it (a wrong
environment name, the wrong Cloudflare token, a dropped connection), it says so
in one line and saves nothing partial you need to clean up: fix that and run the
same command again.

It saves the whole database (with `wrangler d1 export --remote`) and every
original file from the bucket, each checked against its SHA-256, into a new
folder such as `exports/hosted-production-2026-10-17T09-00-00`, readable only by
you. The folder holds every file and record, so keep it private and keep a
second copy somewhere safe.

## Restore a hosted backup

Restore into a freshly deployed environment of the same Chest version, before
anyone adds files to it:

```sh
rer deploy --environment production --env-file chest.env
rer run hosted-restore --environment production --input exports/hosted-production-2026-10-17T09-00-00 --env-file chest.env
```

The restore checks the backup's checksums, that the database versions match and
that the new Chest holds nothing yet, before it writes anything. It puts every
original back, then replaces the database with the backup's. People sign in
again by email. If you read scans with an AI model key, enter the key again
under **People & settings**. Company sign-in is locked to the deployment it was
saved in, so the restore switches it off: if you used it, enter your provider's
details again under **People & settings › Company sign-in** and test it. SCIM
tokens, links and file requests keep working. Invitations sent before the backup
stop working: invite anyone who had not accepted yet again, with the same email.

## Remove a hosted Chest

Removal deletes the Worker, the database and the bucket, with every file in
them. Back up first, then remove from the folder that deployed it:

```sh
rer run hosted-backup --environment production --env-file chest.env
rer deploy --environment production --env-file chest.env --remove --yes
```

Remove only after the backup ends with "Backed up … to exports/…". If the backup
stopped with a message instead, nothing is removed yet: fix what it names and
back up again before you remove.

rer deletes only what this environment's deploy created, then reads back that
none of it remains. The address stops working at once.
