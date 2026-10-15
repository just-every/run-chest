Before the first upload, Chest needs somewhere to file documents and a
description of what they are. All of this lives under **People & settings**,
which only the owner sees.

## Invite your staff

In **People and local sign-in**, enter a **Name** and an **Email** and press
**Invite staff**. Chest sends that person an invitation; when they follow it
they are signed in, and afterwards they return through **Sign in** with their
email.

Each person's row shows their email, role and status, with two actions:

- **Deactivate and revoke sessions** signs them out everywhere and stops them
  signing in. **Reactivate identity** lets them back.
- **Inspect sessions** lists their sign-ins, and you can revoke one at a time.

While Chest runs on your computer it sends no email; try a staff role with
`rer dev --as member` (see [Run Chest on your computer](/docs/run#use-your-own-email-as-the-owner)).

## Create a collection

A collection is a shelf of related records, such as *Supplier certificates*
or *Customer agreements*. Enter a **Collection name** and press
**Create collection**.

Each collection carries grants: who can read, edit or review the documents in
it. See [People and access](/docs/access) for how grants work.

## Create a document type

A document type says what a record is and which fields it must carry. Enter a
**Type name** and a **Field schema (JSON)**, then press **Create document type**.
Each field has a name, a type (`text`, `number`, `date` or `boolean`) and
whether it is required:

```json
[
  { "name": "policy number", "type": "text", "required": true },
  { "name": "insurer", "type": "text", "required": true },
  { "name": "cover", "type": "number", "required": false }
]
```

You can change a type later and press **Save document type**. Values already
saved stay as they are; records that no longer meet the type show
**Fields need attention** until someone edits their filing. New uploads and
filing changes must meet the current type.

## Create a group

Groups let you grant access once to a team. Enter a **Group name** and the
**Member emails (JSON array)**, for example `["maria@example.com", "dan@example.com"]`,
then press **Create group**. Each group shows its ID; use that ID in grants.
Change members later with **Save group membership**.

## Next

[File your first document](/docs/filing).
