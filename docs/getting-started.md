Chest runs on your own computer with **rer**, the Run Edit Run command. It runs
on macOS, Linux or Windows with WSL2. Git is required; rer brings Node and pnpm.

## Get Chest and start it

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-chest
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-chest` does the same. The installer changes no shell settings, so if it prints an `export PATH=…` line, run that line to use `rer` again later. To set Chest up without starting it, use `setup` in place of `dev`.

The line installs `rer`, clones Chest into `run-chest`, installs everything Chest needs, makes you the owner and
starts the app. The first launch can take a few minutes and prints progress as it goes.
When it is ready it prints three lines:

- `RER_READY`: the address of your Chest.
- `RER_SIGNED_IN`: the owner it signed you in as.
- `RER_OPEN`: a link that opens Chest signed in as that owner.

Open the `RER_OPEN` link on the same computer. Treat it like a password: it
signs in whoever opens it, so do not paste it into a chat or a ticket.

## Finish setup

The first time you open Chest it shows **Finish setup**. Check the owner's name
and email, tick **I confirm this owner account is ready to use.** and press
**Finish setup**. **Files** opens.

From then on, the Chest address shows a small front page with one button,
**Sign in**. Sign-in works by an emailed link: enter your email, press
**Email a sign-in link**, and open the link on the same device.

## Use your own email as the owner

`rer dev` on a fresh copy makes a local owner for you. To be the owner under
your real address instead, set it up first with the set-up-only line, then start it:

```sh
npx -y @runeditrun/rer setup just-every/run-chest --owner-email you@example.com
cd run-chest
rer dev
```

While Chest runs on your computer it sends no email. To use Chest as someone
you invited, start it with `rer dev --as their@email`; to try a staff role
without inviting anyone, use `rer dev --as member`. To put Chest on the web for
your team, see [Host Chest on Cloudflare](/docs/hosting).

## Stop and start again

```sh
rer dev --stop
```

Run `cd run-chest && rer dev` again to start Chest with everything you left in it. Your library
lives in the `run-chest` folder on your computer.

## Next

[Set up your library](/docs/set-up): invite your staff and create the first
collection and document type.

## Start from a fresh clone

On macOS or Ubuntu LTS with Git and Node 22.20.0 or later, these five commands
install the locked dependencies, claim your owner account and open Chest:

```sh
git clone https://github.com/just-every/run-chest.git
cd run-chest
npx -y @runeditrun/rer install
npx -y @runeditrun/rer setup --owner-email you@example.com
npx -y @runeditrun/rer dev
```

Open the private `RER_OPEN` link and finish setup. This computer installation
listens on the same computer; staff on other devices cannot reach it. For team
access on your own Linux host, follow [Linux server installation](/docs/server).
