Run Chest on a Linux server you control, with your domain, your mail provider and
your local disk holding the database and every original file. A TLS reverse proxy
on that server serves your HTTPS address and forwards requests to Chest's
loopback listener. Node and the locked dependencies are needed while serving.

## Prepare the installation

From a fresh Chest checkout on your server, install and claim the owner:

```sh
rer install
rer setup --owner-email you@example.com
rer build
```

Use the real mailbox you will sign in with. Setup prepares the owner and the
database; the production build excludes development identity. Keep `.dev.vars`
private and preserve its generated signing and session secrets. Server startup
keeps those settings and the owner's existing records.

## Configure mail and your address

Create a private `server.env` inside the Chest folder:

```sh
AUTH_ORIGIN=https://files.example.com
MAIL_PROVIDER=sendgrid
MAIL_FROM=files@example.com
SENDGRID_API_KEY=your-provider-key
CHEST_SERVER_PORT=8787
```

```sh
chmod 600 server.env
```

Use your domain and a sender verified with your provider. For Resend, use
`MAIL_PROVIDER=resend` and `RESEND_API_KEY`. `MAIL_API_KEY` also accepts the
chosen provider's key. The same settings can come from the process environment.
Do not add development or demo settings. Keep the file out of Git, build output
and public assets. Runtime credentials are excluded from `rer export`.

## Serve over HTTPS

Configure your reverse proxy to terminate TLS for exactly `AUTH_ORIGIN` and
forward to `http://127.0.0.1:8787`, preserving the public Host header. Keep the
loopback listener private. With Cloudflare Tunnel, map your hostname to that
loopback address and set its HTTP Host Header to your public hostname. The
server uses its configured HTTPS origin for requests, secure cookies and email
links; incoming forwarded headers cannot choose another origin.

Start Chest from its checkout:

```sh
rer run server --env-file server.env
```

It stays in the foreground and prints `CHEST_SERVER_READY` with the public
address and its PID. Run it under your service manager with that checkout as
the working directory and a private environment file to restart after reboot.
Stop this process with Ctrl-C or SIGTERM to its printed PID before maintenance.
Do not run another Chest server, setup, build or archive transfer against the
same installation while it serves.

Open `https://files.example.com/health` from another computer, then open
`https://files.example.com/signin`. Request the owner's email link, open it,
confirm and finish setup. Invite staff from **People & settings**; they receive
links through your configured provider. Upload a file, share it with the staff
member and download it from that second computer.

This server serves the built release until stopped. WebSocket upgrades and
automatic Cron execution are not provided by this command.

## Storage, backup and moving to your cloud

The database and R2-compatible original object storage live in the checkout's
`.wrangler/state/v3` directory on your server. Keep that directory on durable
local storage, restrict access to the server account and back up independently.
An R2-compatible local store does not require a Cloudflare account. TLS protects
connections; protect the server's disks and backups using your own storage
encryption and access controls.

Stop the server before exporting:

```sh
rer export --output exports/server.rer
```

The archive contains portable records and original bytes, without sign-in
credentials or private configuration. Keep it private. Start the same server
command again after export. Restore into an empty installation; configure its
owner, mail and secrets separately, then require fresh email sign-in. See
[Cloudflare hosting](/docs/hosting) for deploying on your own cloud account.

Deploy the same release from the checkout that will hold its deployment record.
Copy the private archive into that checkout's `exports` directory, then restore:

```sh
rer deploy --environment production --env-file chest.env
rer import --target remote --origin https://chest-production.your-subdomain.workers.dev --input exports/server.rer --yes
```

For the import command, supply `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` through your private process environment. Use the exact
HTTPS address printed by deployment. The command checks the recorded active
Worker, database and bucket before restoring. It requires an empty destination,
validates the complete archive, and uses the same exclusions and atomic database
publication as a local restore. It refuses changed resources, damaged archives
and occupied destinations. Keep the server and archive until you have signed in
by email and reconciled all records and original checksums in the cloud.

The server needs no Run Edit Run connection while serving. Installation and
updates acquire published dependencies; mail goes directly to your chosen
provider. Keep the runtime's provider access available when blocking other
outbound destinations.

To restrict outbound fetch requests, set `CHEST_OUTBOUND_HOSTS` to a comma-separated
list of exact provider hostnames, for example `api.sendgrid.com`. Every other
host is refused, and allowed requests refuse redirects. Leave it unset for
ordinary provider access. The same setting works with `rer deploy` on Cloudflare.
Keep every provider needed by your chosen capabilities in the list; a refused
provider action reports its real failure. This boundary covers Chest's current
fetch transports; future transports inherit OWN-001's independence obligation.
