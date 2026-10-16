Chest runs on your own computer with **rer**, the Run Edit Run command. It runs
on macOS, Linux or Windows with WSL2, with git; the installer brings Node when it is missing, and rer brings pnpm.

## Get Chest and start it

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
rer dev just-every/run-chest
```

The first line installs `rer` for you alone, with its own Node if you have none. It changes no shell settings: if it prints an `export PATH=…` line, run that line before the second. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-chest` does both lines in one.

The two lines install `rer`, clone Chest, install everything Chest needs, make you the owner and start the
app. The first launch can take a few minutes and prints progress as it goes.
When it is ready it prints three lines:

- `RER_READY`: the address of your Chest.
- `RER_SIGNED_IN`: the owner it signed you in as.
- `RER_OPEN`: a link that opens Chest signed in as that owner.

Open the `RER_OPEN` link on the same computer. Treat it like a password: it
signs in whoever opens it, so do not paste it into a chat or a ticket.

## Finish setup

The first time you open Chest it shows **Finish setup**. Check the owner's name
and email, tick **I confirm this owner account is ready to use.** and press
**Finish setup**. The library opens.

From then on, the Chest address shows a small front page with one button,
**Sign in**. Sign-in works by an emailed link: enter your email, press
**Email a sign-in link**, and open the link on the same device.

## Use your own email as the owner

`rer dev` on a fresh copy makes a local owner for you. To be the owner under
your real address instead, set it up yourself before the first `rer dev`:

```sh
rer install
rer setup --owner-email you@example.com
rer dev
```

While Chest runs on your computer it sends no email. To try Chest as a staff
member, start it with `rer dev --as member`.

## Stop and start again

```sh
rer dev --stop
```

Run `cd run-chest && rer dev` again to start Chest with everything you left in it. Your library
lives in the `run-chest` folder on your computer.

## Next

[Set up your library](/docs/set-up): invite your staff and create the first
collection and document type.
