After first-run setup you can upload straight away: open **Files**, then
**My files** or a team space, and drop files in. This page covers the rest:
inviting your staff, team spaces, groups, and the Library's collections and
document types if you need records with sign-off. Inviting people and the
Library's settings live under **People & settings**, which only the owner sees.

## Invite your staff

In **People and sign-in**, enter a **Name** and an **Email** and press
**Invite staff**. Chest sends that person an invitation; when they follow it
they are signed in, and afterwards they return through **Sign in** with their
email.

Each person's row shows their email, role and status, with two actions:

- **Deactivate and revoke sessions** signs them out everywhere and stops them
  signing in. **Reactivate identity** lets them back.
- **Inspect sessions** lists their sign-ins, and you can revoke one at a time.

While Chest runs on your computer it sends no email, so an invitation is not
delivered. To use Chest as someone you invited, stop Chest and start it as them:

```sh
rer dev --stop
rer dev --as sam@example.com
```

`rer dev` on its own signs you back in as the owner. On a hosted Chest
([Host Chest on Cloudflare](/docs/hosting)) the invitation arrives by email.

## Create a team space

In **Files**, enter a name under **Team spaces** and press
**Create team space**. Anyone signed in can create one and becomes its
manager. Open the space: its **Members** card lists everyone with their role.
Choose **Add a person**, type their email, choose a **Role** and press
**Add to space**. When the owner adds someone not yet in Chest, Chest invites
them by email first. **Add a group** adds a whole group. On each member's row,
choose another role and press **Change role**, or press **Remove**. Every folder
and file inside inherits those roles. See [Folders and files](/docs/files).

## For the Library: collections and document types

The Library is optional: use it for records that need an owner, a reviewer
and an approved version. Before the first Library record, create a collection
to file it in and a document type that describes it.

### Create a collection

A collection is a shelf of related records, such as *Supplier certificates*
or *Customer agreements*. Enter a **Collection name** and press
**Create collection**.

Each collection carries grants: who can read, edit or review the documents in
it. See [People and access](/docs/access) for how grants work.

### Create a document type

A document type says what a record is and which fields it must carry. Enter a
**Type name**, then fill one row per field: its name, its **Kind** (Text,
Number, Date or Yes or no) and whether it is **Required**, for example
*policy number* (Text, required), *insurer* (Text, required) and *cover*
(Number). Press **Create document type**.

You can change a type later: open it, edit the rows (blank rows add fields;
clearing a name removes that field) and press **Save document type**. Values already
saved stay as they are; records that no longer meet the type show
**Fields need attention** until someone edits their filing. New uploads and
filing changes must meet the current type.

## Create a group

Groups let you grant access once to a team, in a team space, a share or a
Library grant. Enter a **Group name** and press **Create group**. Open the
group, type a member's email under **Add a member (email)** and press
**Add member**; **Remove** on a member's row takes them out, and
**Rename group** changes its name. Groups then appear by name wherever you
add people.

## Next

[Folders and files](/docs/files): upload, organize and go back to an earlier
version.
