Chest can run on your own Cloudflare account instead of your computer, at its own web
address, for everyone on your team. It uses three Cloudflare pieces: a Worker (the
app), a D1 database (people, folders, sharing, history) and an R2 bucket (every
original file). People sign in by email, so a hosted Chest also needs a mail
provider. Everything below runs from the Chest folder on your computer.

## What you need

- **Chest set up on your computer.** Follow [Run Chest on your computer](/docs/run)
  with `--owner-email` set to the mailbox you will sign in with. That address
  becomes the hosted owner.
- **A Cloudflare account** with R2 turned on (Cloudflare dashboard, **R2**, then
  follow its one-time setup). Copy your **Account ID** from the dashboard, then
  create an **API token** at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
  with these account permissions: **Workers Scripts: Edit**, **D1: Edit** and
  **Workers R2 Storage: Edit**.
- **A mail provider**: [SendGrid](https://sendgrid.com) or [Resend](https://resend.com).
  Verify the sender address there first (SendGrid: **Settings › Sender
  Authentication**; Resend: **Domains**), then create an API key that can send mail.

## Choose the settings

Put your settings in a private file in the Chest folder, for example
`chest.env`, readable only by you:

```sh
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
MAIL_PROVIDER=sendgrid
MAIL_FROM=files@example.com
SENDGRID_API_KEY=SG.your-key
```

```sh
chmod 600 chest.env
```

- `MAIL_PROVIDER` is `sendgrid` or `resend`. Leave it out and Chest uses the
  provider whose key you set.
- `MAIL_FROM` is the sender you verified. It may carry a name:
  `MAIL_FROM="Example Files <files@example.com>"`.
- With Resend, set `RESEND_API_KEY` instead of `SENDGRID_API_KEY`.
- `rer setup` and `rer deploy --dry-run` may list this key as
  `MAIL_API_KEY`. It is the same key under rer's general name: set
  `SENDGRID_API_KEY` or `RESEND_API_KEY` as above (or `MAIL_API_KEY`, which works
  too), and Chest uses it.

These are deploy settings: you never edit `deploy.json`. The same names work as
environment variables instead of a file.

## Deploy

Pick an environment name, such as `production` (lower-case letters, digits and
hyphens, kept short). Check first, then deploy:

```sh
rer deploy --environment production --env-file chest.env --dry-run
rer deploy --environment production --env-file chest.env
```

The check builds Chest and lists anything still missing, without touching
Cloudflare. The deploy creates the Worker `chest-production`, the database
`chest-production-db` and the bucket `chest-production-blobs`, makes your
setup email the owner and prints the address, for example
`https://chest-production.your-subdomain.workers.dev`.

Keep the `.rer/deploy` folder that the deploy writes. It records which Cloudflare
resources belong to this Chest, so later deploys and removal touch only those.

To change the sender or provider later, edit `chest.env` and run the same
deploy command again. Your files and people stay.

## Sign in

Open the address and choose **Sign in**. Enter the owner email and choose
**Email a sign-in link**. Open the email (from your `MAIL_FROM` sender, subject
"Your sign-in link for Chest"), choose **Confirm**, then **Finish setup**.
Chest opens on **Files**.

Invite your team from **People & settings**: each person gets an email and signs
in the same way. See [Set up Chest](/docs/set-up).

If no email arrives, check the sender is verified with your provider and look
in spam. To get in without mail, `rer signin --environment production --env-file chest.env`
prints a one-time owner sign-in link in your terminal.

## Receive files by email

A hosted Chest can give a space its own email address: files attached to emails
sent there land in a folder you choose. It needs a domain name whose DNS is on
your Cloudflare account, with Cloudflare Email Routing (free) turned on. If the
domain already receives your mail elsewhere (Google Workspace, Microsoft 365),
use a subdomain such as `files.example.com` so that mail is not affected.

Open **Files › Filing agents › Email intake**. Choose a space, an inbox folder
and an address at your domain, then **Save intake**. In the Cloudflare dashboard
open the domain, **Email › Email Routing** (turn it on and let Cloudflare add its
records), then **Routing rules › Create address**: type the part before the @,
choose **Send to a Worker** and pick `chest-production` (the Worker your deploy
made). Send a test email with an attachment; it shows under **Received
attachments**.

Without a domain on Cloudflare, use a **file request** instead: open a folder and
**Create file request** for a link anyone can upload to, with no account.

## Where your files are kept

Every original file and every version lives in the R2 bucket, stored once per
distinct content. The database holds everything else. Nothing is kept on your
computer, so back up the hosted Chest itself.

## Back up a hosted Chest

`rer export` saves only the copy on your computer and refuses a hosted address.
To back up the hosted Chest, run Chest's hosted backup from the same folder:

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
under **People & settings**.

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
