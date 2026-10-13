Chest runs on your own computer with **rer**, the Run Edit Run command. You need
Node 22 or later and pnpm 10.12.4, on macOS, Linux or Windows with WSL2.

## Install rer

Once per computer:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
```

or, with npm:

```sh
npm install -g @runeditrun/rer
```

## Get Chest and start it

```sh
git clone https://github.com/just-every/run-chest.git chest
cd chest && rer dev
```

`rer dev` installs everything Chest needs, makes you the owner and starts the
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

While Chest runs on your computer it sends no real email. Sign-in links and
staff invitations land in a private local outbox; `rer dev --login` prints its
address as `RER_SIGN_IN`.

## Stop and start again

```sh
rer dev --stop
```

Run `rer dev` again to start Chest with everything you left in it. Your library
lives in the `chest` folder on your computer.

## Next

[Set up your library](/docs/set-up): invite your staff and create the first
collection and document type.
